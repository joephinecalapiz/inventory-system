import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

import { USER_ROLES } from "../constants/roles";

import { PRODUCT_STATUSES } from "../constants/products";

import {
  STOCK_IN_LIMITS,
  STOCK_IN_REASONS,
  STOCK_MOVEMENT_TYPES,
} from "../constants/stockIn";

import {
  PURCHASE_ORDER_LIMITS,
  PURCHASE_ORDER_STATUSES,
} from "../constants/purchaseOrders";

import {
  GOODS_RECEIPT_LIMITS,
  GOODS_RECEIPT_STATUSES,
  calculateGoodsReceiptLineTotal,
  calculateGoodsReceiptTotals,
  formatGoodsReceiptNumber,
  isPurchaseOrderEligibleForReceiving,
  isValidGoodsReceiptDateNotFuture,
  isValidGoodsReceiptQuantity,
  isValidGoodsReceiptReference,
  isValidGoodsReceiptRemarks,
  isValidGoodsReceiptUnitCost,
  normalizeGoodsReceiptReference,
  normalizeGoodsReceiptText,
} from "../constants/goodsReceiving";

import {
  getPurchaseOrderDetails,
  subscribeToPurchaseOrders,
} from "./purchaseOrderService";

const GOODS_RECEIVING_ROLES = new Set([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.INVENTORY_STAFF,
]);

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

function preparePurchaseOrderId(value) {
  return prepareDocumentId(value, "Purchase Order ID");
}

function getGoodsReceivingPermissionError() {
  return new Error(
    "Only an active Superadmin, Admin, or Inventory Staff account can post Goods Receipts.",
  );
}

async function getCurrentGoodsReceivingUser() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("You must be signed in to post a Goods Receipt.");
  }

  const userReference = doc(db, "users", currentUser.uid);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (
    userProfile.status !== "ACTIVE" ||
    !GOODS_RECEIVING_ROLES.has(userProfile.role)
  ) {
    throw getGoodsReceivingPermissionError();
  }

  return {
    userId: currentUser.uid,

    displayName: normalizeGoodsReceiptText(
      userProfile.displayName ||
        currentUser.displayName ||
        userProfile.email ||
        currentUser.email ||
        "Inventory User",
    ),

    role: userProfile.role,
  };
}

function createGoodsReceiptTimestamp(dateInput) {
  const normalizedDate = String(dateInput ?? "").trim();

  if (!isValidGoodsReceiptDateNotFuture(normalizedDate)) {
    throw new Error("Enter a valid receiving date that is not in the future.");
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

function prepareGoodsReceiptReference(value) {
  const referenceNumber = normalizeGoodsReceiptReference(value);

  if (!isValidGoodsReceiptReference(referenceNumber)) {
    throw new Error(
      `Enter a delivery receipt, invoice, or receiving reference of up to ${GOODS_RECEIPT_LIMITS.REFERENCE_MAX_LENGTH} characters.`,
    );
  }

  return referenceNumber;
}

function prepareGoodsReceiptRemarks(value) {
  const remarks = String(value ?? "").trim();

  if (!isValidGoodsReceiptRemarks(remarks)) {
    throw new Error(
      `Remarks cannot exceed ${GOODS_RECEIPT_LIMITS.REMARKS_MAX_LENGTH} characters.`,
    );
  }

  return remarks;
}

function prepareGoodsReceiptItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("A Goods Receipt item list is required.");
  }

  const selectedItems = items.filter(
    (item) =>
      item?.quantityReceived !== "" &&
      item?.quantityReceived !== null &&
      item?.quantityReceived !== undefined &&
      Number(item.quantityReceived) > 0,
  );

  if (selectedItems.length === 0) {
    throw new Error("Enter a receiving quantity for at least one product.");
  }

  if (selectedItems.length > GOODS_RECEIPT_LIMITS.MAX_POSTING_ITEM_COUNT) {
    throw new Error(
      `A single Goods Receipt can post at most ${GOODS_RECEIPT_LIMITS.MAX_POSTING_ITEM_COUNT} product lines. Post the remaining products in another Goods Receipt.`,
    );
  }

  const productIds = new Set();

  return selectedItems.map((item, index) => {
    const productId = prepareDocumentId(
      item?.productId,
      `Product on receiving row ${index + 1}`,
    );

    if (productIds.has(productId)) {
      throw new Error(
        "The same product cannot be received twice in one Goods Receipt.",
      );
    }

    productIds.add(productId);

    const quantityReceived = Number(item?.quantityReceived);

    if (!isValidGoodsReceiptQuantity(quantityReceived)) {
      throw new Error(
        `The receiving quantity on row ${index + 1} must be a positive whole number.`,
      );
    }

    const unitCost = Number(item?.unitCost);

    if (
      item?.unitCost === "" ||
      item?.unitCost === null ||
      item?.unitCost === undefined ||
      !isValidGoodsReceiptUnitCost(unitCost)
    ) {
      throw new Error(`The actual unit cost on row ${index + 1} is invalid.`);
    }

    const lineTotal = calculateGoodsReceiptLineTotal(
      quantityReceived,
      unitCost,
    );

    const rawLineTotal = quantityReceived * unitCost;

    if (
      !Number.isFinite(rawLineTotal) ||
      rawLineTotal > GOODS_RECEIPT_LIMITS.MAX_MONEY_VALUE
    ) {
      throw new Error(
        `The receiving value on row ${index + 1} exceeds the allowed maximum.`,
      );
    }

    return {
      productId,

      quantityReceived,

      unitCost,

      lineTotal,
    };
  });
}

function prepareGoodsReceiptData(goodsReceiptData) {
  const purchaseOrderId = preparePurchaseOrderId(
    goodsReceiptData?.purchaseOrderId,
  );

  const referenceNumber = prepareGoodsReceiptReference(
    goodsReceiptData?.referenceNumber,
  );

  const dateReceivedKey = String(goodsReceiptData?.dateReceived ?? "").trim();

  const dateReceived = createGoodsReceiptTimestamp(dateReceivedKey);

  const remarks = prepareGoodsReceiptRemarks(goodsReceiptData?.remarks);

  const items = prepareGoodsReceiptItems(goodsReceiptData?.items);

  return {
    purchaseOrderId,

    referenceNumber,

    dateReceived,

    dateReceivedKey,

    remarks,

    items,
  };
}

function createReferenceReservationId(supplierId, referenceNumber) {
  return encodeURIComponent(`${supplierId}__${referenceNumber}`);
}

function getPurchaseOrderSortTime(purchaseOrder) {
  if (typeof purchaseOrder.expectedDeliveryDate?.toMillis === "function") {
    return purchaseOrder.expectedDeliveryDate.toMillis();
  }

  if (typeof purchaseOrder.orderDate?.toMillis === "function") {
    return purchaseOrder.orderDate.toMillis();
  }

  return 0;
}

function getRemainingQuantity(purchaseOrder) {
  const totalOrderedQuantity = Number(purchaseOrder?.totalOrderedQuantity ?? 0);

  const totalReceivedQuantity = Number(
    purchaseOrder?.totalReceivedQuantity ?? 0,
  );

  if (
    !Number.isInteger(totalOrderedQuantity) ||
    !Number.isInteger(totalReceivedQuantity)
  ) {
    return 0;
  }

  return Math.max(totalOrderedQuantity - totalReceivedQuantity, 0);
}

function validatePurchaseOrderHeader(purchaseOrder, preparedData) {
  if (!isPurchaseOrderEligibleForReceiving(purchaseOrder)) {
    throw new Error(
      "Only Approved or Partially Received Purchase Orders with remaining quantities can be posted.",
    );
  }

  const supplierId = prepareDocumentId(
    purchaseOrder.supplierId,
    "Purchase Order supplier",
  );

  const poNumber = String(purchaseOrder.poNumber ?? "")
    .trim()
    .toUpperCase();

  if (!poNumber) {
    throw new Error("The Purchase Order does not have a valid PO number.");
  }

  const orderDateKey = String(purchaseOrder.orderDateKey ?? "").trim();

  if (orderDateKey && preparedData.dateReceivedKey < orderDateKey) {
    throw new Error(
      "The receiving date cannot be earlier than the Purchase Order date.",
    );
  }

  const totalOrderedQuantity = Number(purchaseOrder.totalOrderedQuantity ?? 0);

  const totalReceivedQuantity = Number(
    purchaseOrder.totalReceivedQuantity ?? 0,
  );

  const goodsReceiptCount = Number(purchaseOrder.goodsReceiptCount ?? 0);

  if (
    !Number.isInteger(totalOrderedQuantity) ||
    totalOrderedQuantity < 1 ||
    totalOrderedQuantity > PURCHASE_ORDER_LIMITS.MAX_QUANTITY
  ) {
    throw new Error(
      "The Purchase Order contains an invalid total ordered quantity.",
    );
  }

  if (
    !Number.isInteger(totalReceivedQuantity) ||
    totalReceivedQuantity < 0 ||
    totalReceivedQuantity > totalOrderedQuantity
  ) {
    throw new Error(
      "The Purchase Order contains an invalid received quantity.",
    );
  }

  if (!Number.isInteger(goodsReceiptCount) || goodsReceiptCount < 0) {
    throw new Error(
      "The Purchase Order contains an invalid Goods Receipt count.",
    );
  }

  const itemProductIds = Array.isArray(purchaseOrder.itemProductIds)
    ? purchaseOrder.itemProductIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];

  const itemCount = Number(purchaseOrder.itemCount ?? 0);

  if (
    !Number.isInteger(itemCount) ||
    itemCount < 1 ||
    itemProductIds.length !== itemCount ||
    new Set(itemProductIds).size !== itemProductIds.length
  ) {
    throw new Error(
      "The Purchase Order item summary is incomplete or inconsistent.",
    );
  }

  return {
    supplierId,

    supplierCode: String(purchaseOrder.supplierCode ?? "")
      .trim()
      .toUpperCase(),

    supplierName: normalizeGoodsReceiptText(purchaseOrder.supplierName),

    poNumber,

    totalOrderedQuantity,

    totalReceivedQuantity,

    goodsReceiptCount,

    itemProductIds,
  };
}

function validatePurchaseOrderItem(itemSnapshot, productId, purchaseOrder) {
  if (!itemSnapshot.exists()) {
    throw new Error(
      `The Purchase Order item for product ${productId} no longer exists.`,
    );
  }

  const item = itemSnapshot.data();

  if (
    String(item.purchaseOrderId ?? "").trim() !== purchaseOrder.id ||
    String(item.productId ?? "").trim() !== productId
  ) {
    throw new Error(
      "A Purchase Order item contains invalid document identifiers.",
    );
  }

  if (
    String(item.poNumber ?? "")
      .trim()
      .toUpperCase() !==
    String(purchaseOrder.poNumber ?? "")
      .trim()
      .toUpperCase()
  ) {
    throw new Error(
      "A Purchase Order item contains an invalid PO number snapshot.",
    );
  }

  const allowedItemStatuses = new Set([
    PURCHASE_ORDER_STATUSES.APPROVED,
    PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
  ]);

  if (!allowedItemStatuses.has(item.poStatus)) {
    throw new Error(
      `${item.productName || productId} is not available for receiving.`,
    );
  }

  const orderedQuantity = Number(item.orderedQuantity ?? 0);

  const receivedQuantity = Number(item.receivedQuantity ?? 0);

  const remainingQuantity = Number(
    item.remainingQuantity ?? orderedQuantity - receivedQuantity,
  );

  if (
    !Number.isInteger(orderedQuantity) ||
    orderedQuantity < 1 ||
    !Number.isInteger(receivedQuantity) ||
    receivedQuantity < 0 ||
    !Number.isInteger(remainingQuantity) ||
    remainingQuantity < 0 ||
    receivedQuantity + remainingQuantity !== orderedQuantity
  ) {
    throw new Error(
      `The quantities for ${item.productName || productId} are inconsistent.`,
    );
  }

  return {
    ...item,

    productId,

    orderedQuantity,

    receivedQuantity,

    remainingQuantity,
  };
}

function validateProductForReceipt(productSnapshot, purchaseOrderItem) {
  if (!productSnapshot.exists()) {
    throw new Error(
      `${purchaseOrderItem.productName || "A selected product"} no longer exists.`,
    );
  }

  const product = productSnapshot.data();

  const productStatus = product.status ?? PRODUCT_STATUSES.ACTIVE;

  if (productStatus !== PRODUCT_STATUSES.ACTIVE) {
    throw new Error(
      `${purchaseOrderItem.productName || "A selected product"} is inactive and cannot receive stock.`,
    );
  }

  const productName = normalizeGoodsReceiptText(product.name);

  const productSku = String(product.sku ?? "")
    .trim()
    .toUpperCase();

  if (!productName || !productSku) {
    throw new Error(
      "A selected product does not have complete identity information.",
    );
  }

  if (
    productSku !==
    String(purchaseOrderItem.productSku ?? "")
      .trim()
      .toUpperCase()
  ) {
    throw new Error(
      `${productName} no longer matches the SKU stored on the Purchase Order.`,
    );
  }

  const previousQuantity = Number(product.quantity ?? 0);

  const stockMovementCount = Number(product.stockMovementCount ?? 0);

  if (!Number.isInteger(previousQuantity) || previousQuantity < 0) {
    throw new Error(
      `${productName} contains an invalid current stock quantity.`,
    );
  }

  if (!Number.isInteger(stockMovementCount) || stockMovementCount < 0) {
    throw new Error(`${productName} contains an invalid stock movement count.`);
  }

  return {
    ...product,

    productName,

    productSku,

    previousQuantity,

    stockMovementCount,
  };
}

function createStockMovementData({
  product,
  purchaseOrder,
  goodsReceiptId,
  goodsReceiptNumber,
  preparedData,
  preparedItem,
  previousQuantity,
  newQuantity,
  currentUser,
}) {
  const movementData = {
    movementType: STOCK_MOVEMENT_TYPES.IN,

    reason: STOCK_IN_REASONS.PURCHASE_RECEIPT,

    productId: preparedItem.productId,

    productName: product.productName,

    productSku: product.productSku,

    quantity: preparedItem.quantityReceived,

    previousQuantity,

    newQuantity,

    unitCost: preparedItem.unitCost,

    totalCost: preparedItem.lineTotal,

    source: normalizeGoodsReceiptText(purchaseOrder.supplierName),

    referenceNumber: preparedData.referenceNumber,

    dateReceived: preparedData.dateReceived,

    receivedBy: currentUser.userId,

    receivedByName: currentUser.displayName,

    purchaseOrderId: purchaseOrder.id,

    poNumber: purchaseOrder.poNumber,

    goodsReceiptId,

    goodsReceiptNumber,

    createdBy: currentUser.userId,

    createdAt: serverTimestamp(),
  };

  const optionalSnapshotFields = [
    "barcode",
    "category",
    "categoryCode",
    "unitCode",
    "unitName",
    "unitAbbreviation",
  ];

  for (const fieldName of optionalSnapshotFields) {
    const value = product[fieldName] ?? purchaseOrder[fieldName];

    if (value !== undefined && value !== null && String(value).trim()) {
      movementData[fieldName] =
        typeof value === "string" ? value.trim() : value;
    }
  }

  if (preparedData.remarks) {
    movementData.remarks = preparedData.remarks;
  }

  return movementData;
}

export function subscribeToReceivablePurchaseOrders(onData, onError) {
  return subscribeToPurchaseOrders(
    (purchaseOrders) => {
      const receivablePurchaseOrders = purchaseOrders
        .filter(isPurchaseOrderEligibleForReceiving)
        .map((purchaseOrder) => ({
          ...purchaseOrder,

          remainingQuantity: getRemainingQuantity(purchaseOrder),
        }))
        .sort((firstPurchaseOrder, secondPurchaseOrder) => {
          const firstTime = getPurchaseOrderSortTime(firstPurchaseOrder);

          const secondTime = getPurchaseOrderSortTime(secondPurchaseOrder);

          if (firstTime !== secondTime) {
            return firstTime - secondTime;
          }

          return String(firstPurchaseOrder.poNumber ?? "").localeCompare(
            String(secondPurchaseOrder.poNumber ?? ""),
          );
        });

      if (typeof onData === "function") {
        onData(receivablePurchaseOrders);
      }
    },

    onError,
  );
}

export async function getReceivablePurchaseOrderDetails(purchaseOrderId) {
  const normalizedPurchaseOrderId = preparePurchaseOrderId(purchaseOrderId);

  const purchaseOrder = await getPurchaseOrderDetails(
    normalizedPurchaseOrderId,
  );

  if (!isPurchaseOrderEligibleForReceiving(purchaseOrder)) {
    throw new Error(
      "Only Approved or Partially Received Purchase Orders with remaining quantities can be loaded.",
    );
  }

  const allowedStatuses = new Set([
    PURCHASE_ORDER_STATUSES.APPROVED,
    PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
  ]);

  const receivableItems = [];

  for (const item of purchaseOrder.items) {
    const orderedQuantity = Number(item.orderedQuantity ?? 0);

    const receivedQuantity = Number(item.receivedQuantity ?? 0);

    const remainingQuantity = Number(
      item.remainingQuantity ?? orderedQuantity - receivedQuantity,
    );

    if (
      !Number.isInteger(orderedQuantity) ||
      orderedQuantity < 1 ||
      !Number.isInteger(receivedQuantity) ||
      receivedQuantity < 0 ||
      !Number.isInteger(remainingQuantity) ||
      remainingQuantity < 0 ||
      receivedQuantity + remainingQuantity !== orderedQuantity
    ) {
      throw new Error(
        `The quantities for ${
          item.productName || item.productId
        } are inconsistent.`,
      );
    }

    if (item.poStatus && !allowedStatuses.has(item.poStatus)) {
      throw new Error(
        `The status for ${
          item.productName || item.productId
        } does not match a receivable Purchase Order.`,
      );
    }

    if (remainingQuantity === 0) {
      continue;
    }

    receivableItems.push({
      ...item,

      orderedQuantity,

      receivedQuantity,

      remainingQuantity,
    });
  }

  if (receivableItems.length === 0) {
    throw new Error(
      "This Purchase Order no longer has items available for receiving.",
    );
  }

  return {
    ...purchaseOrder,

    remainingQuantity: getRemainingQuantity(purchaseOrder),

    items: receivableItems,
  };
}

/**
 * Atomically:
 *
 * 1. Creates a permanent Goods Receipt.
 * 2. Creates Goods Receipt item documents.
 * 3. Updates PO item received quantities.
 * 4. Updates the PO status and receipt summary.
 * 5. Increases product stock.
 * 6. Creates permanent Stock-In movements.
 * 7. Reserves the supplier reference number.
 * 8. Advances the yearly GRN counter.
 */
export async function postGoodsReceipt(goodsReceiptData) {
  const currentUser = await getCurrentGoodsReceivingUser();

  const preparedData = prepareGoodsReceiptData(goodsReceiptData);

  const receiptYear = Number(preparedData.dateReceivedKey.slice(0, 4));

  const purchaseOrderReference = doc(
    db,
    "purchaseOrders",
    preparedData.purchaseOrderId,
  );

  const goodsReceiptReference = doc(collection(db, "goodsReceipts"));

  const counterReference = doc(db, "goodsReceiptCounters", String(receiptYear));

  const preparedItemMap = new Map(
    preparedData.items.map((item) => [item.productId, item]),
  );

  const productReferences = new Map(
    preparedData.items.map((item) => [
      item.productId,
      doc(db, "products", item.productId),
    ]),
  );

  const movementReferences = new Map(
    preparedData.items.map((item) => [
      item.productId,
      doc(collection(db, "stockMovements")),
    ]),
  );

  let receiptResult = null;

  try {
    await runTransaction(db, async (transaction) => {
      const purchaseOrderSnapshot = await transaction.get(
        purchaseOrderReference,
      );

      if (!purchaseOrderSnapshot.exists()) {
        throw new Error("The selected Purchase Order no longer exists.");
      }

      const purchaseOrder = {
        id: purchaseOrderSnapshot.id,

        ...purchaseOrderSnapshot.data(),
      };

      const header = validatePurchaseOrderHeader(purchaseOrder, preparedData);

      const reservationId = createReferenceReservationId(
        header.supplierId,
        preparedData.referenceNumber,
      );

      const reservationReference = doc(
        db,
        "goodsReceiptReferenceReservations",
        reservationId,
      );

      const itemReferences = new Map(
        header.itemProductIds.map((productId) => [
          productId,
          doc(db, "purchaseOrders", purchaseOrder.id, "items", productId),
        ]),
      );

      const itemSnapshots = new Map();

      for (const [productId, itemReference] of itemReferences) {
        itemSnapshots.set(productId, await transaction.get(itemReference));
      }

      const productSnapshots = new Map();

      for (const [productId, productReference] of productReferences) {
        productSnapshots.set(
          productId,
          await transaction.get(productReference),
        );
      }

      const counterSnapshot = await transaction.get(counterReference);

      const reservationSnapshot = await transaction.get(reservationReference);

      if (reservationSnapshot.exists()) {
        throw new Error(
          "This supplier reference number has already been posted as a Goods Receipt.",
        );
      }

      const validatedItems = new Map();

      let calculatedExistingReceived = 0;

      for (const productId of header.itemProductIds) {
        const validatedItem = validatePurchaseOrderItem(
          itemSnapshots.get(productId),
          productId,
          purchaseOrder,
        );

        validatedItems.set(productId, validatedItem);

        calculatedExistingReceived += validatedItem.receivedQuantity;
      }

      if (calculatedExistingReceived !== header.totalReceivedQuantity) {
        throw new Error(
          "The Purchase Order received total does not match its item records.",
        );
      }

      const postingRows = [];

      for (const preparedItem of preparedData.items) {
        const purchaseOrderItem = validatedItems.get(preparedItem.productId);

        if (!purchaseOrderItem) {
          throw new Error(
            "A selected receiving product does not belong to this Purchase Order.",
          );
        }

        if (
          preparedItem.quantityReceived > purchaseOrderItem.remainingQuantity
        ) {
          throw new Error(
            `The receiving quantity for ${purchaseOrderItem.productName} exceeds the remaining quantity of ${purchaseOrderItem.remainingQuantity}.`,
          );
        }

        const product = validateProductForReceipt(
          productSnapshots.get(preparedItem.productId),
          purchaseOrderItem,
        );

        const newProductQuantity =
          product.previousQuantity + preparedItem.quantityReceived;

        if (
          !Number.isSafeInteger(newProductQuantity) ||
          newProductQuantity > STOCK_IN_LIMITS.MAX_QUANTITY
        ) {
          throw new Error(
            `The resulting stock quantity for ${product.productName} exceeds the allowed maximum.`,
          );
        }

        const nextItemReceivedQuantity =
          purchaseOrderItem.receivedQuantity + preparedItem.quantityReceived;

        const nextItemRemainingQuantity =
          purchaseOrderItem.orderedQuantity - nextItemReceivedQuantity;

        postingRows.push({
          preparedItem,

          purchaseOrderItem,

          product,

          newProductQuantity,

          nextItemReceivedQuantity,

          nextItemRemainingQuantity,
        });
      }

      const receiptTotals = calculateGoodsReceiptTotals(preparedData.items);

      const nextTotalReceivedQuantity =
        header.totalReceivedQuantity + receiptTotals.totalReceivedQuantity;

      if (
        !Number.isSafeInteger(nextTotalReceivedQuantity) ||
        nextTotalReceivedQuantity > header.totalOrderedQuantity
      ) {
        throw new Error(
          "The Goods Receipt would exceed the total quantity ordered.",
        );
      }

      const nextPurchaseOrderStatus =
        nextTotalReceivedQuantity === header.totalOrderedQuantity
          ? PURCHASE_ORDER_STATUSES.RECEIVED
          : PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED;

      const previousSequence = counterSnapshot.exists()
        ? Number(counterSnapshot.data().lastSequence ?? 0)
        : 0;

      if (!Number.isInteger(previousSequence) || previousSequence < 0) {
        throw new Error(
          "The Goods Receipt counter contains an invalid sequence.",
        );
      }

      const nextSequence = previousSequence + 1;

      if (nextSequence > GOODS_RECEIPT_LIMITS.MAX_CODE_SEQUENCE) {
        throw new Error("The Goods Receipt number sequence is already full.");
      }

      const goodsReceiptNumber = formatGoodsReceiptNumber(
        receiptYear,
        nextSequence,
      );

      /*
       * All transaction reads are complete.
       * Writes begin below this point.
       */
      transaction.set(
        counterReference,
        {
          year: receiptYear,

          lastSequence: nextSequence,

          updatedBy: currentUser.userId,

          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      transaction.set(reservationReference, {
        supplierId: header.supplierId,

        supplierCode: header.supplierCode,

        supplierName: header.supplierName,

        referenceNumber: preparedData.referenceNumber,

        purchaseOrderId: purchaseOrder.id,

        poNumber: header.poNumber,

        goodsReceiptId: goodsReceiptReference.id,

        goodsReceiptNumber,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),
      });

      transaction.set(goodsReceiptReference, {
        goodsReceiptNumber,

        goodsReceiptYear: receiptYear,

        purchaseOrderId: purchaseOrder.id,

        poNumber: header.poNumber,

        supplierId: header.supplierId,

        supplierCode: header.supplierCode,

        supplierName: header.supplierName,

        referenceNumber: preparedData.referenceNumber,

        dateReceived: preparedData.dateReceived,

        dateReceivedKey: preparedData.dateReceivedKey,

        status: GOODS_RECEIPT_STATUSES.COMPLETED,

        itemCount: receiptTotals.itemCount,

        totalReceivedQuantity: receiptTotals.totalReceivedQuantity,

        totalValue: receiptTotals.totalValue,

        remarks: preparedData.remarks,

        purchaseOrderStatusBefore: purchaseOrder.status,

        purchaseOrderStatusAfter: nextPurchaseOrderStatus,

        receivedBy: currentUser.userId,

        receivedByName: currentUser.displayName,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),
      });

      const shouldSynchronizeAllItemStatuses =
        purchaseOrder.status !== nextPurchaseOrderStatus ||
        nextPurchaseOrderStatus === PURCHASE_ORDER_STATUSES.RECEIVED;

      if (shouldSynchronizeAllItemStatuses) {
        for (const [productId, itemReference] of itemReferences) {
          if (preparedItemMap.has(productId)) {
            continue;
          }

          transaction.update(itemReference, {
            poStatus: nextPurchaseOrderStatus,

            updatedBy: currentUser.userId,

            updatedAt: serverTimestamp(),
          });
        }
      }

      for (const postingRow of postingRows) {
        const {
          preparedItem,
          purchaseOrderItem,
          product,
          newProductQuantity,
          nextItemReceivedQuantity,
          nextItemRemainingQuantity,
        } = postingRow;

        const itemReference = itemReferences.get(preparedItem.productId);

        const productReference = productReferences.get(preparedItem.productId);

        const movementReference = movementReferences.get(
          preparedItem.productId,
        );

        const receiptItemReference = doc(
          db,
          "goodsReceipts",
          goodsReceiptReference.id,
          "items",
          preparedItem.productId,
        );

        transaction.update(itemReference, {
          receivedQuantity: nextItemReceivedQuantity,

          remainingQuantity: nextItemRemainingQuantity,

          poStatus: nextPurchaseOrderStatus,

          lastReceivedQuantity: preparedItem.quantityReceived,

          lastReceivedUnitCost: preparedItem.unitCost,

          lastGoodsReceiptId: goodsReceiptReference.id,

          lastGoodsReceiptNumber: goodsReceiptNumber,

          lastReceivedAt: serverTimestamp(),

          updatedBy: currentUser.userId,

          updatedAt: serverTimestamp(),
        });

        const productUpdate = {
          quantity: newProductQuantity,

          hasStockHistory: true,

          stockMovementCount: product.stockMovementCount + 1,

          updatedBy: currentUser.userId,

          updatedAt: serverTimestamp(),
        };

        /*
         * Keep the same costing behavior used by
         * manual Stock In: a positive actual cost
         * becomes the latest product cost price.
         */
        if (preparedItem.unitCost > 0) {
          productUpdate.costPrice = preparedItem.unitCost;
        }

        transaction.update(productReference, productUpdate);

        transaction.set(
          movementReference,
          createStockMovementData({
            product,

            purchaseOrder,

            goodsReceiptId: goodsReceiptReference.id,

            goodsReceiptNumber,

            preparedData,

            preparedItem,

            previousQuantity: product.previousQuantity,

            newQuantity: newProductQuantity,

            currentUser,
          }),
        );

        transaction.set(receiptItemReference, {
          goodsReceiptId: goodsReceiptReference.id,

          goodsReceiptNumber,

          purchaseOrderId: purchaseOrder.id,

          poNumber: header.poNumber,

          productId: preparedItem.productId,

          productName: purchaseOrderItem.productName,

          productSku: purchaseOrderItem.productSku,

          category: purchaseOrderItem.category,

          categoryCode: purchaseOrderItem.categoryCode,

          unitCode: purchaseOrderItem.unitCode,

          unitName: purchaseOrderItem.unitName,

          unitAbbreviation: purchaseOrderItem.unitAbbreviation,

          orderedQuantity: purchaseOrderItem.orderedQuantity,

          previouslyReceivedQuantity: purchaseOrderItem.receivedQuantity,

          quantityReceived: preparedItem.quantityReceived,

          remainingQuantity: nextItemRemainingQuantity,

          unitCost: preparedItem.unitCost,

          lineTotal: preparedItem.lineTotal,

          stockMovementId: movementReference.id,

          createdBy: currentUser.userId,

          createdAt: serverTimestamp(),
        });
      }

      transaction.update(purchaseOrderReference, {
        status: nextPurchaseOrderStatus,

        totalReceivedQuantity: nextTotalReceivedQuantity,

        hasReceivingHistory: true,

        goodsReceiptCount: header.goodsReceiptCount + 1,

        lastGoodsReceiptId: goodsReceiptReference.id,

        lastGoodsReceiptNumber: goodsReceiptNumber,

        lastGoodsReceiptReference: preparedData.referenceNumber,

        lastReceivedAt: serverTimestamp(),

        revision: Number(purchaseOrder.revision ?? 1) + 1,

        updatedBy: currentUser.userId,

        updatedAt: serverTimestamp(),
      });

      receiptResult = {
        id: goodsReceiptReference.id,

        goodsReceiptNumber,

        purchaseOrderId: purchaseOrder.id,

        poNumber: header.poNumber,

        supplierId: header.supplierId,

        supplierName: header.supplierName,

        referenceNumber: preparedData.referenceNumber,

        dateReceived: preparedData.dateReceivedKey,

        status: GOODS_RECEIPT_STATUSES.COMPLETED,

        purchaseOrderStatus: nextPurchaseOrderStatus,

        itemCount: receiptTotals.itemCount,

        totalReceivedQuantity: receiptTotals.totalReceivedQuantity,

        totalValue: receiptTotals.totalValue,

        receivedBy: currentUser.userId,

        receivedByName: currentUser.displayName,
      };
    });

    return receiptResult;
  } catch (error) {
    console.error("Unable to post Goods Receipt:", error);

    throw error;
  }
}

/**
 * Real-time Goods Receipt header subscription.
 * This is used by Phase 4H for receipt history and
 * printing, but is included now for immediate
 * posting verification.
 */
export function subscribeToGoodsReceipts(onData, onError) {
  const goodsReceiptCollection = collection(db, "goodsReceipts");

  return onSnapshot(
    goodsReceiptCollection,

    (snapshot) => {
      const receipts = snapshot.docs.map((receiptSnapshot) => ({
        id: receiptSnapshot.id,

        ...receiptSnapshot.data(),
      }));

      receipts.sort((firstReceipt, secondReceipt) => {
        const firstTime =
          typeof firstReceipt.createdAt?.toMillis === "function"
            ? firstReceipt.createdAt.toMillis()
            : 0;

        const secondTime =
          typeof secondReceipt.createdAt?.toMillis === "function"
            ? secondReceipt.createdAt.toMillis()
            : 0;

        return secondTime - firstTime;
      });

      if (typeof onData === "function") {
        onData(receipts);
      }
    },

    (error) => {
      console.error("Unable to load Goods Receipts:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}
