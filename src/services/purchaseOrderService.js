import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

import { USER_ROLES } from "../constants/roles";

import { PRODUCT_STATUSES } from "../constants/products";

import { SUPPLIER_STATUSES } from "../constants/suppliers";

import {
  PURCHASE_ORDER_LIMITS,
  PURCHASE_ORDER_STATUSES,
  calculatePurchaseOrderLineTotal,
  calculatePurchaseOrderTotals,
  formatPurchaseOrderNumber,
  getTodayPurchaseOrderDate,
  isPurchaseOrderEditable,
  isValidExpectedDeliveryDate,
  isValidPurchaseOrderDate,
  isValidPurchaseOrderMoney,
  isValidPurchaseOrderQuantity,
  isValidPurchaseOrderUnitCost,
  normalizePurchaseOrderText,
} from "../constants/purchaseOrders";

const purchaseOrdersCollection = collection(db, "purchaseOrders");

const PURCHASE_ORDER_EDITOR_ROLES = new Set([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.INVENTORY_STAFF,
]);

function getPurchaseOrderPermissionError() {
  return new Error(
    "Only an active Superadmin, Admin, or Inventory Staff account can manage Purchase Order drafts.",
  );
}

/**
 * Confirms that the current user can create or
 * update Purchase Order drafts.
 */
async function getCurrentPurchaseOrderEditor() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("You must be signed in to manage Purchase Orders.");
  }

  const userReference = doc(db, "users", currentUser.uid);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (userProfile.status !== "ACTIVE") {
    throw getPurchaseOrderPermissionError();
  }

  if (!PURCHASE_ORDER_EDITOR_ROLES.has(userProfile.role)) {
    throw getPurchaseOrderPermissionError();
  }

  return {
    userId: currentUser.uid,

    displayName: normalizePurchaseOrderText(
      userProfile.displayName ||
        currentUser.displayName ||
        userProfile.email ||
        currentUser.email ||
        "Inventory User",
    ),

    role: userProfile.role,
  };
}

function prepareDocumentId(value, fieldLabel) {
  const documentId = String(value ?? "").trim();

  if (!documentId) {
    throw new Error(`${fieldLabel} is required.`);
  }

  if (documentId.includes("/")) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return documentId;
}

function createPurchaseOrderTimestamp(
  dateInput,
  fieldLabel,
  allowEmpty = false,
) {
  const normalizedDate = String(dateInput ?? "").trim();

  if (allowEmpty && !normalizedDate) {
    return null;
  }

  if (!isValidPurchaseOrderDate(normalizedDate)) {
    throw new Error(`${fieldLabel} must be a valid date.`);
  }

  const [yearText, monthText, dayText] = normalizedDate.split("-");

  const date = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    12,
    0,
    0,
    0,
  );

  return Timestamp.fromDate(date);
}

function prepareOrderDate(value) {
  const orderDate = String(value ?? "").trim();

  if (!isValidPurchaseOrderDate(orderDate)) {
    throw new Error("Enter a valid Purchase Order date.");
  }

  if (orderDate > getTodayPurchaseOrderDate()) {
    throw new Error("The Purchase Order date cannot be in the future.");
  }

  return orderDate;
}

function prepareExpectedDeliveryDate(orderDate, value) {
  const expectedDeliveryDate = String(value ?? "").trim();

  if (!expectedDeliveryDate) {
    return "";
  }

  if (!isValidExpectedDeliveryDate(orderDate, expectedDeliveryDate)) {
    throw new Error(
      "The expected delivery date cannot be earlier than the Purchase Order date.",
    );
  }

  return expectedDeliveryDate;
}

function prepareNotes(value) {
  const notes = String(value ?? "").trim();

  if (notes.length > PURCHASE_ORDER_LIMITS.NOTES_MAX_LENGTH) {
    throw new Error(
      `Purchase Order notes cannot exceed ${PURCHASE_ORDER_LIMITS.NOTES_MAX_LENGTH} characters.`,
    );
  }

  return notes;
}

function prepareMoneyAmount(value, fieldLabel) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const amount = Number(value);

  if (!isValidPurchaseOrderMoney(amount)) {
    throw new Error(`${fieldLabel} must be a valid non-negative amount.`);
  }

  return amount;
}

function prepareOrderedQuantity(value, productLabel) {
  const orderedQuantity = Number(value);

  if (!isValidPurchaseOrderQuantity(orderedQuantity)) {
    throw new Error(
      `The ordered quantity for ${productLabel} must be a positive whole number.`,
    );
  }

  return orderedQuantity;
}

function prepareUnitCost(value, productLabel) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Unit cost is required for ${productLabel}.`);
  }

  const unitCost = Number(value);

  if (!isValidPurchaseOrderUnitCost(unitCost)) {
    throw new Error(
      `The unit cost for ${productLabel} must be a valid non-negative amount.`,
    );
  }

  return unitCost;
}

function preparePurchaseOrderItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("A Purchase Order item list is required.");
  }

  if (items.length === 0) {
    throw new Error("Add at least one product to the Purchase Order.");
  }

  if (items.length > PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT) {
    throw new Error(
      `A Purchase Order cannot contain more than ${PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT} products.`,
    );
  }

  const productIds = new Set();

  return items.map((item, index) => {
    const productId = prepareDocumentId(
      item?.productId,
      `Product on row ${index + 1}`,
    );

    if (productIds.has(productId)) {
      throw new Error(
        "The same product cannot be added twice to one Purchase Order.",
      );
    }

    productIds.add(productId);

    const productLabel =
      normalizePurchaseOrderText(item?.productName) ||
      `product on row ${index + 1}`;

    return {
      productId,

      orderedQuantity: prepareOrderedQuantity(
        item?.orderedQuantity,
        productLabel,
      ),

      unitCost: prepareUnitCost(item?.unitCost, productLabel),
    };
  });
}

function preparePurchaseOrderData(purchaseOrderData) {
  const supplierId = prepareDocumentId(
    purchaseOrderData?.supplierId,
    "Supplier",
  );

  const orderDate = prepareOrderDate(purchaseOrderData?.orderDate);

  const expectedDeliveryDate = prepareExpectedDeliveryDate(
    orderDate,
    purchaseOrderData?.expectedDeliveryDate,
  );

  const items = preparePurchaseOrderItems(purchaseOrderData?.items);

  return {
    supplierId,

    orderDate,

    expectedDeliveryDate,

    discountAmount: prepareMoneyAmount(
      purchaseOrderData?.discountAmount,
      "Discount",
    ),

    taxAmount: prepareMoneyAmount(purchaseOrderData?.taxAmount, "Tax"),

    shippingAmount: prepareMoneyAmount(
      purchaseOrderData?.shippingAmount,
      "Shipping amount",
    ),

    notes: prepareNotes(purchaseOrderData?.notes),

    items,
  };
}

function validateSupplierSnapshot(supplierSnapshot) {
  if (!supplierSnapshot.exists()) {
    throw new Error("The selected supplier no longer exists.");
  }

  const supplier = supplierSnapshot.data();

  const supplierStatus = supplier.status ?? SUPPLIER_STATUSES.ACTIVE;

  if (supplierStatus !== SUPPLIER_STATUSES.ACTIVE) {
    throw new Error(
      "Inactive suppliers cannot be used for new Purchase Orders.",
    );
  }

  const supplierCode = String(supplier.supplierCode ?? "").trim();

  const supplierName = normalizePurchaseOrderText(supplier.name);

  if (!supplierCode) {
    throw new Error(
      "The selected supplier does not have a valid supplier code.",
    );
  }

  if (!supplierName) {
    throw new Error("The selected supplier does not have a valid name.");
  }

  return {
    supplierCode,

    supplierName,

    supplierAddress: normalizePurchaseOrderText(supplier.address),

    supplierTin: String(supplier.tin ?? "").trim(),

    supplierPaymentTerm: String(supplier.paymentTerm ?? "CASH_ON_DELIVERY")
      .trim()
      .toUpperCase(),

    supplierCustomPaymentTerms: normalizePurchaseOrderText(
      supplier.customPaymentTerms,
    ),
  };
}

function validateProductSnapshot(productSnapshot, preparedItem) {
  if (!productSnapshot.exists()) {
    throw new Error("A selected product no longer exists.");
  }

  const product = productSnapshot.data();

  const productStatus = product.status ?? PRODUCT_STATUSES.ACTIVE;

  if (productStatus !== PRODUCT_STATUSES.ACTIVE) {
    throw new Error(
      `${product.name || "A selected product"} is inactive and cannot be ordered.`,
    );
  }

  const productName = normalizePurchaseOrderText(product.name);

  const productSku = String(product.sku ?? "")
    .trim()
    .toUpperCase();

  const category = normalizePurchaseOrderText(
    product.category ?? product.categoryName,
  );

  const categoryCode = String(product.categoryCode ?? product.categoryId ?? "")
    .trim()
    .toUpperCase();

  const unitCode = String(product.unitCode ?? product.unitId ?? "")
    .trim()
    .toUpperCase();

  const unitName = normalizePurchaseOrderText(product.unitName);

  const unitAbbreviation = String(product.unitAbbreviation ?? "")
    .trim()
    .toUpperCase();

  if (!productName) {
    throw new Error("A selected product does not have a valid name.");
  }

  if (!productSku) {
    throw new Error(`${productName} does not have a valid SKU.`);
  }

  if (!category || !categoryCode) {
    throw new Error(
      `${productName} does not have complete category information.`,
    );
  }

  if (!unitCode || !unitName || !unitAbbreviation) {
    throw new Error(`${productName} does not have a complete unit assignment.`);
  }

  const lineTotal = calculatePurchaseOrderLineTotal(
    preparedItem.orderedQuantity,
    preparedItem.unitCost,
  );

  const rawLineTotal = preparedItem.orderedQuantity * preparedItem.unitCost;

  if (
    !Number.isFinite(rawLineTotal) ||
    rawLineTotal > PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE
  ) {
    throw new Error(
      `The line total for ${productName} exceeds the allowed maximum.`,
    );
  }

  return {
    productId: productSnapshot.id,

    productName,

    productSku,

    barcode: String(product.barcode ?? "").trim(),

    category,

    categoryCode,

    unitCode,

    unitName,

    unitAbbreviation,

    orderedQuantity: preparedItem.orderedQuantity,

    receivedQuantity: 0,

    remainingQuantity: preparedItem.orderedQuantity,

    unitCost: preparedItem.unitCost,

    lineTotal,
  };
}

function calculateDraftSummary(itemSnapshots, preparedData) {
  const totals = calculatePurchaseOrderTotals(itemSnapshots, {
    discountAmount: preparedData.discountAmount,

    taxAmount: preparedData.taxAmount,

    shippingAmount: preparedData.shippingAmount,
  });

  if (totals.discountAmount > totals.subtotal) {
    throw new Error(
      "The discount cannot be greater than the Purchase Order subtotal.",
    );
  }

  const expectedGrandTotal =
    Math.round(
      (totals.subtotal -
        totals.discountAmount +
        totals.taxAmount +
        totals.shippingAmount +
        Number.EPSILON) *
        100,
    ) / 100;

  if (totals.grandTotal !== expectedGrandTotal) {
    throw new Error(
      "The Purchase Order total could not be calculated correctly.",
    );
  }

  const totalOrderedQuantity = itemSnapshots.reduce(
    (total, item) => total + item.orderedQuantity,
    0,
  );

  if (!Number.isSafeInteger(totalOrderedQuantity) || totalOrderedQuantity < 1) {
    throw new Error("The total ordered quantity is invalid.");
  }

  return {
    ...totals,

    itemCount: itemSnapshots.length,

    totalOrderedQuantity,

    totalReceivedQuantity: 0,
  };
}

function getPurchaseOrderSortTime(purchaseOrder) {
  if (typeof purchaseOrder.createdAt?.toMillis === "function") {
    return purchaseOrder.createdAt.toMillis();
  }

  if (typeof purchaseOrder.orderDate?.toMillis === "function") {
    return purchaseOrder.orderDate.toMillis();
  }

  return 0;
}

/**
 * Real-time Purchase Order header subscription.
 */
export function subscribeToPurchaseOrders(onData, onError) {
  return onSnapshot(
    purchaseOrdersCollection,

    (snapshot) => {
      const purchaseOrders = snapshot.docs.map((purchaseOrderDocument) => ({
        id: purchaseOrderDocument.id,

        ...purchaseOrderDocument.data(),
      }));

      purchaseOrders.sort(
        (firstPurchaseOrder, secondPurchaseOrder) =>
          getPurchaseOrderSortTime(secondPurchaseOrder) -
          getPurchaseOrderSortTime(firstPurchaseOrder),
      );

      if (typeof onData === "function") {
        onData(purchaseOrders);
      }
    },

    (error) => {
      console.error("Unable to load Purchase Orders:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}

/**
 * Real-time subscription for one Purchase Order's
 * item subcollection.
 */
export function subscribeToPurchaseOrderItems(
  purchaseOrderId,
  onData,
  onError,
) {
  const normalizedPurchaseOrderId = prepareDocumentId(
    purchaseOrderId,
    "Purchase Order ID",
  );

  const itemsCollection = collection(
    db,
    "purchaseOrders",
    normalizedPurchaseOrderId,
    "items",
  );

  return onSnapshot(
    itemsCollection,

    (snapshot) => {
      const items = snapshot.docs.map((itemDocument) => ({
        id: itemDocument.id,

        ...itemDocument.data(),
      }));

      items.sort((firstItem, secondItem) =>
        String(firstItem.productName ?? "").localeCompare(
          String(secondItem.productName ?? ""),
        ),
      );

      if (typeof onData === "function") {
        onData(items);
      }
    },

    (error) => {
      console.error("Unable to load Purchase Order items:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}

/**
 * Loads one Purchase Order and all its items.
 */
export async function getPurchaseOrderDetails(purchaseOrderId) {
  const normalizedPurchaseOrderId = prepareDocumentId(
    purchaseOrderId,
    "Purchase Order ID",
  );

  const purchaseOrderReference = doc(
    db,
    "purchaseOrders",
    normalizedPurchaseOrderId,
  );

  const itemsCollection = collection(
    db,
    "purchaseOrders",
    normalizedPurchaseOrderId,
    "items",
  );

  const [purchaseOrderSnapshot, itemSnapshot] = await Promise.all([
    getDoc(purchaseOrderReference),

    getDocs(itemsCollection),
  ]);

  if (!purchaseOrderSnapshot.exists()) {
    throw new Error("The selected Purchase Order could not be found.");
  }

  const items = itemSnapshot.docs.map((itemDocument) => ({
    id: itemDocument.id,

    ...itemDocument.data(),
  }));

  items.sort((firstItem, secondItem) =>
    String(firstItem.productName ?? "").localeCompare(
      String(secondItem.productName ?? ""),
    ),
  );

  return {
    id: purchaseOrderSnapshot.id,

    ...purchaseOrderSnapshot.data(),

    items,
  };
}

/**
 * Creates a Draft Purchase Order, its items, and
 * its permanent PO number in one transaction.
 */
export async function createPurchaseOrderDraft(purchaseOrderData) {
  const currentUser = await getCurrentPurchaseOrderEditor();

  const preparedData = preparePurchaseOrderData(purchaseOrderData);

  const orderYear = Number(preparedData.orderDate.slice(0, 4));

  const purchaseOrderReference = doc(collection(db, "purchaseOrders"));

  const counterReference = doc(db, "purchaseOrderCounters", String(orderYear));

  const supplierReference = doc(db, "suppliers", preparedData.supplierId);

  const productReferences = preparedData.items.map((item) =>
    doc(db, "products", item.productId),
  );

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      /*
       * Every transaction read must happen before
       * the first write.
       */
      const supplierSnapshot = await transaction.get(supplierReference);

      const productSnapshots = [];

      for (const productReference of productReferences) {
        productSnapshots.push(await transaction.get(productReference));
      }

      const counterSnapshot = await transaction.get(counterReference);

      const supplierSnapshotData = validateSupplierSnapshot(supplierSnapshot);

      const itemSnapshots = preparedData.items.map((preparedItem, index) =>
        validateProductSnapshot(productSnapshots[index], preparedItem),
      );

      const summary = calculateDraftSummary(itemSnapshots, preparedData);

      const previousSequence = counterSnapshot.exists()
        ? Number(counterSnapshot.data().lastSequence ?? 0)
        : 0;

      if (!Number.isInteger(previousSequence) || previousSequence < 0) {
        throw new Error(
          "The Purchase Order counter contains an invalid sequence.",
        );
      }

      const nextSequence = previousSequence + 1;

      if (nextSequence > PURCHASE_ORDER_LIMITS.MAX_CODE_SEQUENCE) {
        throw new Error("The Purchase Order number sequence is already full.");
      }

      const poNumber = formatPurchaseOrderNumber(orderYear, nextSequence);

      const itemProductIds = itemSnapshots.map((item) => item.productId);

      transaction.set(purchaseOrderReference, {
        poNumber,

        poYear: orderYear,

        supplierId: preparedData.supplierId,

        ...supplierSnapshotData,

        orderDate: createPurchaseOrderTimestamp(
          preparedData.orderDate,
          "Purchase Order date",
        ),

        orderDateKey: preparedData.orderDate,

        expectedDeliveryDate: createPurchaseOrderTimestamp(
          preparedData.expectedDeliveryDate,
          "Expected delivery date",
          true,
        ),

        expectedDeliveryDateKey: preparedData.expectedDeliveryDate,

        status: PURCHASE_ORDER_STATUSES.DRAFT,

        itemCount: summary.itemCount,

        itemProductIds,

        totalOrderedQuantity: summary.totalOrderedQuantity,

        totalReceivedQuantity: 0,

        subtotal: summary.subtotal,

        discountAmount: summary.discountAmount,

        taxAmount: summary.taxAmount,

        shippingAmount: summary.shippingAmount,

        grandTotal: summary.grandTotal,

        hasReceivingHistory: false,

        goodsReceiptCount: 0,

        notes: preparedData.notes,

        revision: 1,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),

        updatedBy: currentUser.userId,

        updatedAt: serverTimestamp(),
      });

      for (const item of itemSnapshots) {
        const itemReference = doc(
          db,
          "purchaseOrders",
          purchaseOrderReference.id,
          "items",
          item.productId,
        );

        transaction.set(itemReference, {
          purchaseOrderId: purchaseOrderReference.id,

          poNumber,

          poStatus: PURCHASE_ORDER_STATUSES.DRAFT,

          ...item,

          createdBy: currentUser.userId,

          createdAt: serverTimestamp(),

          updatedBy: currentUser.userId,

          updatedAt: serverTimestamp(),
        });
      }

      result = {
        id: purchaseOrderReference.id,

        poNumber,

        status: PURCHASE_ORDER_STATUSES.DRAFT,

        supplierId: preparedData.supplierId,

        supplierName: supplierSnapshotData.supplierName,

        orderDate: preparedData.orderDate,

        expectedDeliveryDate: preparedData.expectedDeliveryDate,

        ...summary,

        items: itemSnapshots,
      };
    });

    return result;
  } catch (error) {
    console.error("Unable to create Purchase Order draft:", error);

    throw error;
  }
}

/**
 * Updates a Purchase Order while it is still Draft.
 *
 * Its PO number and creation audit fields remain
 * permanent.
 */
export async function updatePurchaseOrderDraft(
  purchaseOrderId,
  purchaseOrderData,
) {
  const normalizedPurchaseOrderId = prepareDocumentId(
    purchaseOrderId,
    "Purchase Order ID",
  );

  const currentUser = await getCurrentPurchaseOrderEditor();

  const preparedData = preparePurchaseOrderData(purchaseOrderData);

  const purchaseOrderReference = doc(
    db,
    "purchaseOrders",
    normalizedPurchaseOrderId,
  );

  const supplierReference = doc(db, "suppliers", preparedData.supplierId);

  const productReferences = preparedData.items.map((item) =>
    doc(db, "products", item.productId),
  );

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      const purchaseOrderSnapshot = await transaction.get(
        purchaseOrderReference,
      );

      if (!purchaseOrderSnapshot.exists()) {
        throw new Error("The selected Purchase Order no longer exists.");
      }

      const existingPurchaseOrder = purchaseOrderSnapshot.data();

      if (!isPurchaseOrderEditable(existingPurchaseOrder.status)) {
        throw new Error("Only Draft Purchase Orders can be edited.");
      }

      if (
        existingPurchaseOrder.hasReceivingHistory ||
        Number(existingPurchaseOrder.totalReceivedQuantity ?? 0) > 0
      ) {
        throw new Error(
          "A Purchase Order with receiving history cannot be edited.",
        );
      }

      const existingPoYear = Number(
        existingPurchaseOrder.poYear ??
          String(existingPurchaseOrder.poNumber ?? "").split("-")[1],
      );

      const nextOrderYear = Number(preparedData.orderDate.slice(0, 4));

      if (existingPoYear !== nextOrderYear) {
        throw new Error(
          "The Purchase Order date cannot be moved to another year because its PO number is permanent.",
        );
      }

      const existingItemProductIds = Array.isArray(
        existingPurchaseOrder.itemProductIds,
      )
        ? existingPurchaseOrder.itemProductIds
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
        : [];

      const supplierSnapshot = await transaction.get(supplierReference);

      const productSnapshots = [];

      for (const productReference of productReferences) {
        productSnapshots.push(await transaction.get(productReference));
      }

      const existingItemSnapshots = new Map();

      for (const existingProductId of existingItemProductIds) {
        const existingItemReference = doc(
          db,
          "purchaseOrders",
          normalizedPurchaseOrderId,
          "items",
          existingProductId,
        );

        const existingItemSnapshot = await transaction.get(
          existingItemReference,
        );

        if (existingItemSnapshot.exists()) {
          existingItemSnapshots.set(
            existingProductId,
            existingItemSnapshot.data(),
          );
        }
      }

      const supplierSnapshotData = validateSupplierSnapshot(supplierSnapshot);

      const itemSnapshots = preparedData.items.map((preparedItem, index) =>
        validateProductSnapshot(productSnapshots[index], preparedItem),
      );

      const summary = calculateDraftSummary(itemSnapshots, preparedData);

      const nextItemProductIds = itemSnapshots.map((item) => item.productId);

      const nextItemProductIdSet = new Set(nextItemProductIds);

      transaction.update(purchaseOrderReference, {
        supplierId: preparedData.supplierId,

        ...supplierSnapshotData,

        orderDate: createPurchaseOrderTimestamp(
          preparedData.orderDate,
          "Purchase Order date",
        ),

        orderDateKey: preparedData.orderDate,

        expectedDeliveryDate: createPurchaseOrderTimestamp(
          preparedData.expectedDeliveryDate,
          "Expected delivery date",
          true,
        ),

        expectedDeliveryDateKey: preparedData.expectedDeliveryDate,

        itemCount: summary.itemCount,

        itemProductIds: nextItemProductIds,

        totalOrderedQuantity: summary.totalOrderedQuantity,

        totalReceivedQuantity: 0,

        subtotal: summary.subtotal,

        discountAmount: summary.discountAmount,

        taxAmount: summary.taxAmount,

        shippingAmount: summary.shippingAmount,

        grandTotal: summary.grandTotal,

        notes: preparedData.notes,

        revision: Number(existingPurchaseOrder.revision ?? 1) + 1,

        updatedBy: currentUser.userId,

        updatedAt: serverTimestamp(),
      });

      for (const existingProductId of existingItemProductIds) {
        if (nextItemProductIdSet.has(existingProductId)) {
          continue;
        }

        transaction.delete(
          doc(
            db,
            "purchaseOrders",
            normalizedPurchaseOrderId,
            "items",
            existingProductId,
          ),
        );
      }

      for (const item of itemSnapshots) {
        const itemReference = doc(
          db,
          "purchaseOrders",
          normalizedPurchaseOrderId,
          "items",
          item.productId,
        );

        const existingItem = existingItemSnapshots.get(item.productId);

        transaction.set(itemReference, {
          purchaseOrderId: normalizedPurchaseOrderId,

          poNumber: existingPurchaseOrder.poNumber,

          poStatus: PURCHASE_ORDER_STATUSES.DRAFT,

          ...item,

          createdBy: existingItem?.createdBy || currentUser.userId,

          createdAt: existingItem?.createdAt || serverTimestamp(),

          updatedBy: currentUser.userId,

          updatedAt: serverTimestamp(),
        });
      }

      result = {
        id: normalizedPurchaseOrderId,

        poNumber: existingPurchaseOrder.poNumber,

        status: PURCHASE_ORDER_STATUSES.DRAFT,

        supplierId: preparedData.supplierId,

        supplierName: supplierSnapshotData.supplierName,

        orderDate: preparedData.orderDate,

        expectedDeliveryDate: preparedData.expectedDeliveryDate,

        revision: Number(existingPurchaseOrder.revision ?? 1) + 1,

        ...summary,

        items: itemSnapshots,
      };
    });

    return result;
  } catch (error) {
    console.error("Unable to update Purchase Order draft:", error);

    throw error;
  }
}
