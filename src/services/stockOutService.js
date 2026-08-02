import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

import { PRODUCT_STATUSES } from "../constants/products";

import { USER_ROLES } from "../constants/roles";

import { calculateProductStockStatus } from "../constants/stockStatus";

import {
  INVENTORY_TRANSACTION_COLLECTION,
  INVENTORY_TRANSACTION_TYPES,
} from "../constants/reports";

import { createInventoryTransactionData } from "../utils/reports";

import {
  STOCK_OUT_LIMITS,
  STOCK_OUT_MOVEMENT_TYPE,
  STOCK_OUT_OPERATION_STATUSES,
  calculateStockOutBalance,
  calculateStockOutTotalCost,
  isStockOutDestinationRequired,
  isValidStockOutDateNotFuture,
  isValidStockOutDestination,
  isValidStockOutOperationId,
  isValidStockOutQuantity,
  isValidStockOutReason,
  isValidStockOutReference,
  isValidStockOutRemarks,
  isValidStockOutUnitCost,
  normalizeStockOutReference,
  normalizeStockOutText,
} from "../constants/stockOut";

const STOCK_OUT_ALLOWED_ROLES = new Set([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.INVENTORY_STAFF,
]);

function getStockOutPermissionError() {
  return new Error(
    "Only an active Superadmin, Admin, or Inventory Staff account can release stock.",
  );
}

/**
 * Confirms that the current user may create a
 * manual Stock-Out transaction.
 */
async function getCurrentStockOutUser() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("You must be signed in to release stock.");
  }

  const userReference = doc(db, "users", currentUser.uid);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (
    userProfile.status !== "ACTIVE" ||
    !STOCK_OUT_ALLOWED_ROLES.has(userProfile.role)
  ) {
    throw getStockOutPermissionError();
  }

  return {
    userId: currentUser.uid,

    displayName: normalizeStockOutText(
      userProfile.displayName ||
        currentUser.displayName ||
        userProfile.email ||
        currentUser.email ||
        "Inventory User",
    ),

    role: userProfile.role,
  };
}

function prepareOperationId(value) {
  const operationId = String(value ?? "").trim();

  if (!isValidStockOutOperationId(operationId)) {
    throw new Error(
      "The Stock-Out operation ID is missing or invalid. Refresh the form and try again.",
    );
  }

  return operationId;
}

function prepareProductId(value) {
  const productId = String(value ?? "").trim();

  if (!productId) {
    throw new Error("A product is required.");
  }

  if (productId.includes("/")) {
    throw new Error("The selected product ID is invalid.");
  }

  return productId;
}

function prepareQuantity(value) {
  if (value === undefined || value === null || value === "") {
    throw new Error("Quantity released is required.");
  }

  const quantityReleased = Number(value);

  if (!isValidStockOutQuantity(quantityReleased)) {
    throw new Error(
      `Quantity released must be a positive whole number not greater than ${STOCK_OUT_LIMITS.MAX_QUANTITY}.`,
    );
  }

  return quantityReleased;
}

function prepareReason(value) {
  const reason = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!isValidStockOutReason(reason)) {
    throw new Error("Select a valid Stock-Out reason.");
  }

  return reason;
}

function prepareDestination(value, reason) {
  const destination = normalizeStockOutText(value);

  if (!isValidStockOutDestination(destination, reason)) {
    if (isStockOutDestinationRequired(reason)) {
      throw new Error(
        `Destination is required for ${reason.replaceAll("_", " ").toLowerCase()} and cannot exceed ${STOCK_OUT_LIMITS.DESTINATION_MAX_LENGTH} characters.`,
      );
    }

    throw new Error(
      `Destination cannot exceed ${STOCK_OUT_LIMITS.DESTINATION_MAX_LENGTH} characters.`,
    );
  }

  return destination;
}

function prepareReferenceNumber(value) {
  const referenceNumber = normalizeStockOutReference(value);

  if (!isValidStockOutReference(referenceNumber)) {
    throw new Error(
      `Reference number cannot exceed ${STOCK_OUT_LIMITS.REFERENCE_MAX_LENGTH} characters.`,
    );
  }

  return referenceNumber;
}

function prepareRemarks(value) {
  const remarks = String(value ?? "").trim();

  if (!isValidStockOutRemarks(remarks)) {
    throw new Error(
      `Remarks cannot exceed ${STOCK_OUT_LIMITS.REMARKS_MAX_LENGTH} characters.`,
    );
  }

  return remarks;
}

function createReleasedDateTimestamp(dateInput) {
  const dateReleasedKey = String(dateInput ?? "").trim();

  if (!isValidStockOutDateNotFuture(dateReleasedKey)) {
    throw new Error("Enter a valid release date that is not in the future.");
  }

  const [yearText, monthText, dayText] = dateReleasedKey.split("-");

  /*
   * Store the selected local date at midnight.
   *
   * This keeps today's release timestamp at or
   * before request.time so Firestore Rules can
   * reject genuinely future dates.
   */
  const releasedDate = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    0,
    0,
    0,
    0,
  );

  return {
    dateReleased: Timestamp.fromDate(releasedDate),

    dateReleasedKey,
  };
}

function prepareStockOutData(stockOutData) {
  const operationId = prepareOperationId(stockOutData?.operationId);

  const productId = prepareProductId(stockOutData?.productId);

  const quantityReleased = prepareQuantity(stockOutData?.quantityReleased);

  const reason = prepareReason(stockOutData?.reason);

  const destination = prepareDestination(stockOutData?.destination, reason);

  const referenceNumber = prepareReferenceNumber(stockOutData?.referenceNumber);

  const remarks = prepareRemarks(stockOutData?.remarks);

  const { dateReleased, dateReleasedKey } = createReleasedDateTimestamp(
    stockOutData?.dateReleased,
  );

  return {
    operationId,
    productId,
    quantityReleased,
    reason,
    destination,
    referenceNumber,
    dateReleased,
    dateReleasedKey,
    remarks,
  };
}

function resolveProductCostPrice(product) {
  const storedCostPrice = Number(product?.costPrice ?? 0);

  if (isValidStockOutUnitCost(storedCostPrice)) {
    return storedCostPrice;
  }

  return 0;
}

function getExistingOperationResult(existingOperation) {
  return {
    operationId: existingOperation.operationId,

    movementId: existingOperation.movementId,

    productId: existingOperation.productId,

    productName: existingOperation.productName,

    productSku: existingOperation.productSku,

    quantityReleased: existingOperation.quantityReleased,

    previousQuantity: existingOperation.previousQuantity,

    newQuantity: existingOperation.newQuantity,

    unitCost: existingOperation.unitCost,

    totalCost: existingOperation.totalCost,

    destination: existingOperation.destination,

    referenceNumber: existingOperation.referenceNumber,

    dateReleased: existingOperation.dateReleasedKey,

    reason: existingOperation.reason,

    remarks: existingOperation.remarks,

    releasedBy: existingOperation.releasedBy,

    releasedByName: existingOperation.releasedByName,

    isReplay: true,
  };
}

function isSameStockOutRequest(existingOperation, preparedData, currentUser) {
  return (
    existingOperation.createdBy === currentUser.userId &&
    existingOperation.productId === preparedData.productId &&
    existingOperation.quantityReleased === preparedData.quantityReleased &&
    existingOperation.reason === preparedData.reason &&
    existingOperation.destination === preparedData.destination &&
    existingOperation.referenceNumber === preparedData.referenceNumber &&
    existingOperation.dateReleasedKey === preparedData.dateReleasedKey &&
    existingOperation.remarks === preparedData.remarks
  );
}

function addOptionalProductSnapshots(movementData, product) {
  const barcode = String(product.barcode ?? "").trim();

  if (barcode) {
    movementData.barcode = barcode;
  }

  const category = normalizeStockOutText(
    product.category ?? product.categoryName,
  );

  if (category) {
    movementData.category = category;
  }

  const categoryCode = String(product.categoryCode ?? product.categoryId ?? "")
    .trim()
    .toUpperCase();

  if (categoryCode) {
    movementData.categoryCode = categoryCode;
  }

  const unitCode = String(product.unitCode ?? product.unitId ?? "")
    .trim()
    .toUpperCase();

  if (unitCode) {
    movementData.unitCode = unitCode;
  }

  const unitName = normalizeStockOutText(product.unitName);

  if (unitName) {
    movementData.unitName = unitName;
  }

  const unitAbbreviation = String(product.unitAbbreviation ?? "")
    .trim()
    .toUpperCase();

  if (unitAbbreviation) {
    movementData.unitAbbreviation = unitAbbreviation;
  }
}

/**
 * Atomically:
 *
 * 1. Checks an idempotency operation record.
 * 2. Reads the latest Product stock.
 * 3. Rejects a quantity above available stock.
 * 4. Deducts the Product quantity.
 * 5. Creates a permanent OUT movement.
 * 6. Creates an immutable Stock-Out operation.
 */
export async function createStockOutReceipt(stockOutData) {
  const currentUser = await getCurrentStockOutUser();

  const preparedData = prepareStockOutData(stockOutData);

  const productReference = doc(db, "products", preparedData.productId);

  const movementReference = doc(db, "stockMovements", preparedData.operationId);

  const operationReference = doc(
    db,
    "stockOutOperations",
    preparedData.operationId,
  );

  const inventoryTransactionReference = doc(
    db,
    INVENTORY_TRANSACTION_COLLECTION,
    preparedData.operationId,
  );

  try {
    /*
     * Keep the read operations outside the atomic
     * write request. This prevents the browser
     * workflow from exhausting the Firestore Rules
     * expression budget.
     */
    const operationSnapshot = await getDoc(operationReference);

    if (operationSnapshot.exists()) {
      const existingOperation = operationSnapshot.data();

      if (
        !isSameStockOutRequest(existingOperation, preparedData, currentUser)
      ) {
        throw new Error(
          "This Stock-Out operation ID is already linked to another release.",
        );
      }

      if (
        existingOperation.status !== STOCK_OUT_OPERATION_STATUSES.COMPLETED ||
        existingOperation.movementId !== preparedData.operationId
      ) {
        throw new Error(
          "The existing Stock-Out operation is incomplete or inconsistent.",
        );
      }

      return getExistingOperationResult(existingOperation);
    }

    const productSnapshot = await getDoc(productReference);

    if (!productSnapshot.exists()) {
      throw new Error("The selected product no longer exists.");
    }

    const product = productSnapshot.data();

    const productStatus = product.status ?? PRODUCT_STATUSES.ACTIVE;

    if (productStatus !== PRODUCT_STATUSES.ACTIVE) {
      throw new Error("Inactive products cannot be released from inventory.");
    }

    const previousQuantity = Number(product.quantity ?? 0);

    if (!Number.isInteger(previousQuantity) || previousQuantity < 0) {
      throw new Error(
        "The selected product contains an invalid current stock quantity.",
      );
    }

    const newQuantity = calculateStockOutBalance(
      previousQuantity,
      preparedData.quantityReleased,
    );

    if (newQuantity === null) {
      throw new Error(
        `Insufficient stock. Only ${previousQuantity} item(s) are available.`,
      );
    }

    const storedMovementCount = Number(product.stockMovementCount ?? 0);

    const previousMovementCount =
      Number.isInteger(storedMovementCount) && storedMovementCount >= 0
        ? storedMovementCount
        : 0;

    const productName = normalizeStockOutText(product.name);

    const productSku = String(product.sku ?? "")
      .trim()
      .toUpperCase();

    if (!productName) {
      throw new Error("The selected product does not have a valid name.");
    }

    if (!productSku) {
      throw new Error("The selected product does not have a valid SKU.");
    }

    const unitCost = resolveProductCostPrice(product);

    const totalCost = calculateStockOutTotalCost(
      preparedData.quantityReleased,
      unitCost,
    );

    const rawTotalCost = preparedData.quantityReleased * unitCost;

    if (
      !Number.isFinite(rawTotalCost) ||
      rawTotalCost > STOCK_OUT_LIMITS.MAX_TOTAL_VALUE
    ) {
      throw new Error("The total Stock-Out value exceeds the allowed maximum.");
    }

    const movementData = {
      movementId: movementReference.id,
      operationId: preparedData.operationId,
      movementType: STOCK_OUT_MOVEMENT_TYPE,
      reason: preparedData.reason,
      productId: preparedData.productId,
      productName,
      productSku,
      quantity: preparedData.quantityReleased,
      previousQuantity,
      newQuantity,
      unitCost,
      totalCost,
      destination: preparedData.destination,
      referenceNumber: preparedData.referenceNumber,
      dateReleased: preparedData.dateReleased,
      releasedBy: currentUser.userId,
      releasedByName: currentUser.displayName,
      createdBy: currentUser.userId,
      createdAt: serverTimestamp(),
    };

    addOptionalProductSnapshots(movementData, product);

    if (preparedData.remarks) {
      movementData.remarks = preparedData.remarks;
    }

    const inventoryTransactionData = createInventoryTransactionData({
      transactionType: INVENTORY_TRANSACTION_TYPES.STOCK_OUT,
      referenceNumber: preparedData.referenceNumber || preparedData.operationId,
      product: {
        id: preparedData.productId,
        ...product,
        name: productName,
        sku: productSku,
      },
      user: {
        uid: currentUser.userId,
        displayName: currentUser.displayName,
        role: currentUser.role,
      },
      quantityBefore: previousQuantity,
      quantityChanged: -preparedData.quantityReleased,
      quantityAfter: newQuantity,
      unitCost,
      relatedDocumentId: preparedData.operationId,
      relatedDocumentType: "STOCK_OUT_OPERATION",
      reason: preparedData.reason,
      remarks: preparedData.remarks,
      transactionDate: preparedData.dateReleased,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        movementId: movementReference.id,
        destination: preparedData.destination,
        dateReleasedKey: preparedData.dateReleasedKey,
      },
    });

    const operationData = {
      operationId: preparedData.operationId,
      status: STOCK_OUT_OPERATION_STATUSES.COMPLETED,
      movementId: movementReference.id,
      productId: preparedData.productId,
      productName,
      productSku,
      quantityReleased: preparedData.quantityReleased,
      previousQuantity,
      newQuantity,
      unitCost,
      totalCost,
      destination: preparedData.destination,
      referenceNumber: preparedData.referenceNumber,
      dateReleased: preparedData.dateReleased,
      dateReleasedKey: preparedData.dateReleasedKey,
      reason: preparedData.reason,
      remarks: preparedData.remarks,
      releasedBy: currentUser.userId,
      releasedByName: currentUser.displayName,
      createdBy: currentUser.userId,
      createdAt: serverTimestamp(),
    };

    /*
     * Product, movement, and operation still commit
     * atomically. Firestore Rules compare the Product's
     * current stock with previousQuantity/newQuantity,
     * so a concurrent stock change causes this batch to
     * fail instead of overwriting newer inventory.
     */
    const stockStatus = calculateProductStockStatus(
      newQuantity,
      Number(product.reorderLevel ?? 0),
    );

    const batch = writeBatch(db);

    batch.update(productReference, {
      quantity: newQuantity,
      stockStatus,
      hasStockHistory: true,
      stockMovementCount: previousMovementCount + 1,
      lastStockMovementId: movementReference.id,
      lastStockMovementType: STOCK_OUT_MOVEMENT_TYPE,
      lastStockMovementReason: preparedData.reason,
      lastStockMovementQuantity: preparedData.quantityReleased,
      lastStockMovementUnitCost: unitCost,
      lastStockMovementAt: serverTimestamp(),
      updatedBy: currentUser.userId,
      updatedAt: serverTimestamp(),
    });

    batch.set(movementReference, movementData);

    batch.set(inventoryTransactionReference, inventoryTransactionData);

    batch.set(operationReference, operationData);

    await batch.commit();

    return {
      operationId: preparedData.operationId,
      movementId: movementReference.id,
      productId: preparedData.productId,
      productName,
      productSku,
      quantityReleased: preparedData.quantityReleased,
      previousQuantity,
      newQuantity,
      unitCost,
      totalCost,
      destination: preparedData.destination,
      referenceNumber: preparedData.referenceNumber,
      dateReleased: preparedData.dateReleasedKey,
      reason: preparedData.reason,
      remarks: preparedData.remarks,
      releasedBy: currentUser.userId,
      releasedByName: currentUser.displayName,
      isReplay: false,
    };
  } catch (error) {
    /*
     * A repeated click may finish in another client
     * between the first operation read and batch commit.
     * Return the stored completed operation only when it
     * is an exact replay of this request.
     */
    try {
      const replaySnapshot = await getDoc(operationReference);

      if (replaySnapshot.exists()) {
        const existingOperation = replaySnapshot.data();

        if (
          isSameStockOutRequest(existingOperation, preparedData, currentUser) &&
          existingOperation.status === STOCK_OUT_OPERATION_STATUSES.COMPLETED &&
          existingOperation.movementId === preparedData.operationId
        ) {
          return getExistingOperationResult(existingOperation);
        }
      }
    } catch (replayError) {
      console.error("Unable to verify Stock-Out replay:", replayError);
    }

    console.error("Unable to create Stock-Out receipt:", error);

    throw error;
  }
}

function getFirestoreDateMilliseconds(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const parsedTime = new Date(value).getTime();

  return Number.isFinite(parsedTime) ? parsedTime : 0;
}

function getMovementSortTime(movement) {
  return (
    getFirestoreDateMilliseconds(movement.createdAt) ||
    getFirestoreDateMilliseconds(movement.dateReleased)
  );
}

function prepareMovementId(value) {
  const movementId = String(value ?? "").trim();

  if (!movementId) {
    throw new Error("Stock-Out movement ID is required.");
  }

  if (movementId.includes("/")) {
    throw new Error("Stock-Out movement ID is invalid.");
  }

  return movementId;
}

function normalizeStockOutMovement(movementId, movement) {
  const movementType = String(movement?.movementType ?? movement?.type ?? "")
    .trim()
    .toUpperCase();

  const quantity = Number(
    movement?.quantity ?? movement?.quantityReleased ?? 0,
  );

  const unitCost = Number(movement?.unitCost ?? 0);

  const storedTotalCost = Number(movement?.totalCost);

  const calculatedTotalCost =
    Number.isFinite(quantity) && Number.isFinite(unitCost)
      ? Math.round((quantity * unitCost + Number.EPSILON) * 100) / 100
      : 0;

  return {
    id: movementId,

    ...movement,

    movementId: String(movement?.movementId ?? movementId).trim(),

    operationId: String(movement?.operationId ?? movementId).trim(),

    movementType,

    reason: String(movement?.reason ?? "")
      .trim()
      .toUpperCase(),

    productId: String(movement?.productId ?? "").trim(),

    productName: normalizeStockOutText(movement?.productName),

    productSku: String(movement?.productSku ?? "")
      .trim()
      .toUpperCase(),

    quantity: Number.isFinite(quantity) ? quantity : 0,

    previousQuantity: Number(movement?.previousQuantity ?? 0),

    newQuantity: Number(movement?.newQuantity ?? 0),

    unitCost: Number.isFinite(unitCost) ? unitCost : 0,

    totalCost: Number.isFinite(storedTotalCost)
      ? storedTotalCost
      : calculatedTotalCost,

    destination: normalizeStockOutText(movement?.destination),

    referenceNumber: normalizeStockOutReference(movement?.referenceNumber),

    remarks: String(movement?.remarks ?? "").trim(),

    releasedBy: String(
      movement?.releasedBy ?? movement?.createdBy ?? "",
    ).trim(),

    releasedByName: normalizeStockOutText(movement?.releasedByName),

    sortTime: getMovementSortTime(movement ?? {}),
  };
}

/**
 * Loads one permanent OUT movement directly from
 * Firestore for the detail view.
 */
export async function getStockOutReceiptDetails(movementId) {
  const normalizedMovementId = prepareMovementId(movementId);

  const movementReference = doc(db, "stockMovements", normalizedMovementId);

  const movementSnapshot = await getDoc(movementReference);

  if (!movementSnapshot.exists()) {
    throw new Error("The selected Stock-Out movement could not be found.");
  }

  const movement = normalizeStockOutMovement(
    movementSnapshot.id,
    movementSnapshot.data(),
  );

  if (movement.movementType !== STOCK_OUT_MOVEMENT_TYPE) {
    throw new Error("The selected movement is not a Stock-Out record.");
  }

  return movement;
}

/**
 * Real-time permanent OUT movement history.
 *
 * Older OUT records that use `type` instead of
 * `movementType` remain visible.
 */
export function subscribeToStockOutReceipts(onData, onError) {
  const movementCollection = collection(db, "stockMovements");

  return onSnapshot(
    movementCollection,

    (snapshot) => {
      const receipts = snapshot.docs
        .map((movementSnapshot) =>
          normalizeStockOutMovement(
            movementSnapshot.id,
            movementSnapshot.data(),
          ),
        )
        .filter((movement) => movement.movementType === STOCK_OUT_MOVEMENT_TYPE)
        .sort(
          (firstMovement, secondMovement) =>
            secondMovement.sortTime - firstMovement.sortTime,
        );

      if (typeof onData === "function") {
        onData(receipts);
      }
    },

    (error) => {
      console.error("Unable to load Stock-Out history:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}
