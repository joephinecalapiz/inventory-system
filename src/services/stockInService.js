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

import { PRODUCT_STATUSES } from "../constants/products";

import { USER_ROLES } from "../constants/roles";

import {
  MANUAL_STOCK_IN_REASON_OPTIONS,
  STOCK_IN_LIMITS,
  STOCK_MOVEMENT_TYPES,
  calculateStockInTotal,
  isValidStockInDate,
  isValidStockInOperationId,
  isValidStockInQuantity,
  isValidStockInReason,
  isValidStockInReference,
  isValidStockInRemarks,
  isValidStockInSource,
  isValidStockInUnitCost,
  normalizeStockInReference,
  normalizeStockInText,
} from "../constants/stockIn";

const STOCK_IN_ALLOWED_ROLES = new Set([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.INVENTORY_STAFF,
]);

const MANUAL_STOCK_IN_REASONS = new Set(
  MANUAL_STOCK_IN_REASON_OPTIONS.map((option) => option.value),
);

/**
 * Returns a clean Firebase permission error.
 */
function getPermissionError() {
  return new Error(
    "Only an active Superadmin, Admin, or Inventory Staff account can receive stock.",
  );
}

/**
 * Loads and validates the currently signed-in
 * employee before allowing Stock In.
 */
async function getCurrentStockInUser() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("You must be signed in to receive stock.");
  }

  const userReference = doc(db, "users", currentUser.uid);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (userProfile.status !== "ACTIVE") {
    throw getPermissionError();
  }

  if (!STOCK_IN_ALLOWED_ROLES.has(userProfile.role)) {
    throw getPermissionError();
  }

  const receivedByName = normalizeStockInText(
    userProfile.displayName ||
      currentUser.displayName ||
      userProfile.email ||
      currentUser.email ||
      "Inventory User",
  );

  return {
    userId: currentUser.uid,

    displayName: receivedByName,

    role: userProfile.role,
  };
}

/**
 * Converts an HTML date input into a Firestore
 * Timestamp.
 *
 * Local noon is used so that timezone conversion
 * does not accidentally display the previous day.
 */

function createReceivedDateTimestamp(dateInput) {
  if (!isValidStockInDate(dateInput)) {
    throw new Error("A valid received date is required.");
  }

  const [yearText, monthText, dayText] = String(dateInput).split("-");

  const receivedDate = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    12,
    0,
    0,
    0,
  );

  const currentDate = new Date();

  currentDate.setHours(23, 59, 59, 999);

  if (receivedDate.getTime() > currentDate.getTime()) {
    throw new Error("The received date cannot be in the future.");
  }

  return Timestamp.fromDate(receivedDate);
}

function prepareOperationId(value) {
  const operationId = String(value ?? "").trim();

  if (!isValidStockInOperationId(operationId)) {
    throw new Error(
      "The Stock-In operation ID is missing or invalid. Refresh the form and try again.",
    );
  }

  return operationId;
}

function prepareProductId(value) {
  const productId = String(value ?? "").trim();

  if (!productId) {
    throw new Error("A product is required.");
  }

  return productId;
}

function prepareQuantity(value) {
  if (value === undefined || value === null || value === "") {
    throw new Error("Quantity received is required.");
  }

  const quantity = Number(value);

  if (!isValidStockInQuantity(quantity)) {
    throw new Error(
      `Quantity received must be a positive whole number not greater than ${STOCK_IN_LIMITS.MAX_QUANTITY}.`,
    );
  }

  return quantity;
}

function prepareUnitCost(value) {
  if (value === undefined || value === null || value === "") {
    throw new Error("Unit cost is required.");
  }

  const unitCost = Number(value);

  if (!isValidStockInUnitCost(unitCost)) {
    throw new Error("Unit cost must be a valid non-negative amount.");
  }

  return unitCost;
}

function prepareReason(value) {
  const reason = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!isValidStockInReason(reason) || !MANUAL_STOCK_IN_REASONS.has(reason)) {
    throw new Error("Select a valid manual Stock-In reason.");
  }

  return reason;
}

function prepareSource(value) {
  const source = normalizeStockInText(value);

  if (!isValidStockInSource(source)) {
    throw new Error(
      `Source or supplier is required and cannot exceed ${STOCK_IN_LIMITS.SOURCE_MAX_LENGTH} characters.`,
    );
  }

  return source;
}

function prepareReferenceNumber(value) {
  const referenceNumber = normalizeStockInReference(value);

  if (!isValidStockInReference(referenceNumber)) {
    throw new Error(
      `Reference number cannot exceed ${STOCK_IN_LIMITS.REFERENCE_MAX_LENGTH} characters.`,
    );
  }

  return referenceNumber;
}

function prepareRemarks(value) {
  const remarks = String(value ?? "").trim();

  if (!isValidStockInRemarks(remarks)) {
    throw new Error(
      `Remarks cannot exceed ${STOCK_IN_LIMITS.REMARKS_MAX_LENGTH} characters.`,
    );
  }

  return remarks;
}

function prepareStockInData(stockInData) {
  const operationId = prepareOperationId(stockInData?.operationId);

  const productId = prepareProductId(stockInData?.productId);

  const quantityReceived = prepareQuantity(stockInData?.quantityReceived);

  const unitCost = prepareUnitCost(stockInData?.unitCost);

  const source = prepareSource(stockInData?.source);

  const referenceNumber = prepareReferenceNumber(stockInData?.referenceNumber);

  const reason = prepareReason(stockInData?.reason);

  const remarks = prepareRemarks(stockInData?.remarks);

  const dateReceivedInput = String(stockInData?.dateReceived ?? "").trim();

  const dateReceived = createReceivedDateTimestamp(dateReceivedInput);

  const totalCost = calculateStockInTotal(quantityReceived, unitCost);

  /*
   * calculateStockInTotal() returns zero for a
   * valid zero-cost receipt, so the maximum limit
   * is also checked directly.
   */
  const unroundedTotal = quantityReceived * unitCost;

  if (
    !Number.isFinite(unroundedTotal) ||
    unroundedTotal > STOCK_IN_LIMITS.MAX_TOTAL_VALUE
  ) {
    throw new Error("The total receipt value exceeds the allowed maximum.");
  }

  return {
    operationId,
    productId,
    quantityReceived,
    unitCost,
    totalCost,
    source,
    referenceNumber,
    dateReceived,
    dateReceivedInput,
    reason,
    remarks,
  };
}

/**
 * Creates a permanent Stock-In movement and updates
 * the selected product balance in one transaction.
 */
export async function createStockInReceipt(stockInData) {
  const currentUser = await getCurrentStockInUser();

  const preparedData = prepareStockInData(stockInData);

  const productReference = doc(db, "products", preparedData.productId);

  const movementReference = doc(db, "stockMovements", preparedData.operationId);

  const operationReference = doc(
    db,
    "stockInOperations",
    preparedData.operationId,
  );

  let receiptResult = null;

  try {
    await runTransaction(db, async (transaction) => {
      const operationSnapshot = await transaction.get(operationReference);

      if (operationSnapshot.exists()) {
        const existingOperation = operationSnapshot.data();

        const sameRequest =
          existingOperation.createdBy === currentUser.userId &&
          existingOperation.productId === preparedData.productId &&
          existingOperation.quantityReceived ===
            preparedData.quantityReceived &&
          existingOperation.unitCost === preparedData.unitCost &&
          existingOperation.source === preparedData.source &&
          existingOperation.referenceNumber === preparedData.referenceNumber &&
          existingOperation.dateReceivedKey ===
            preparedData.dateReceivedInput &&
          existingOperation.reason === preparedData.reason &&
          existingOperation.remarks === preparedData.remarks;

        if (!sameRequest) {
          throw new Error(
            "This Stock-In operation ID is already linked to another receipt.",
          );
        }

        receiptResult = {
          operationId: existingOperation.operationId,
          movementId: existingOperation.movementId,
          productId: existingOperation.productId,
          productName: existingOperation.productName,
          productSku: existingOperation.productSku,
          quantityReceived: existingOperation.quantityReceived,
          previousQuantity: existingOperation.previousQuantity,
          newQuantity: existingOperation.newQuantity,
          unitCost: existingOperation.unitCost,
          totalCost: existingOperation.totalCost,
          source: existingOperation.source,
          referenceNumber: existingOperation.referenceNumber,
          dateReceived: existingOperation.dateReceivedKey,
          reason: existingOperation.reason,
          receivedBy: existingOperation.receivedBy,
          receivedByName: existingOperation.receivedByName,
          idempotentReplay: true,
        };

        return;
      }

      /*
       * Always read the latest product balance
       * inside the transaction.
       */
      const productSnapshot = await transaction.get(productReference);

      if (!productSnapshot.exists()) {
        throw new Error("The selected product no longer exists.");
      }

      const product = productSnapshot.data();

      const productStatus = product.status ?? PRODUCT_STATUSES.ACTIVE;

      if (productStatus !== PRODUCT_STATUSES.ACTIVE) {
        throw new Error("Inactive products cannot receive stock.");
      }

      const previousQuantity = Number(product.quantity ?? 0);

      if (!Number.isInteger(previousQuantity) || previousQuantity < 0) {
        throw new Error(
          "The selected product contains an invalid current stock quantity.",
        );
      }

      const newQuantity = previousQuantity + preparedData.quantityReceived;

      if (
        !Number.isSafeInteger(newQuantity) ||
        newQuantity > STOCK_IN_LIMITS.MAX_QUANTITY
      ) {
        throw new Error(
          "The resulting product quantity exceeds the allowed maximum.",
        );
      }

      const storedMovementCount = Number(product.stockMovementCount ?? 0);

      const previousMovementCount =
        Number.isInteger(storedMovementCount) && storedMovementCount >= 0
          ? storedMovementCount
          : 0;

      const nextMovementCount = previousMovementCount + 1;

      const productName = normalizeStockInText(product.name);

      const productSku = String(product.sku ?? "")
        .trim()
        .toUpperCase();

      if (!productName) {
        throw new Error("The selected product does not have a valid name.");
      }

      if (!productSku) {
        throw new Error("The selected product does not have a valid SKU.");
      }

      const movementData = {
        movementId: movementReference.id,

        operationId: preparedData.operationId,

        movementType: STOCK_MOVEMENT_TYPES.IN,

        reason: preparedData.reason,

        productId: preparedData.productId,

        productName,

        productSku,

        quantity: preparedData.quantityReceived,

        previousQuantity,

        newQuantity,

        unitCost: preparedData.unitCost,

        totalCost: preparedData.totalCost,

        source: preparedData.source,

        referenceNumber: preparedData.referenceNumber,

        dateReceived: preparedData.dateReceived,

        receivedBy: currentUser.userId,

        receivedByName: currentUser.displayName,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),
      };

      /*
       * Add optional product snapshot fields only
       * when the product contains valid values.
       */
      const barcode = String(product.barcode ?? "").trim();

      if (barcode) {
        movementData.barcode = barcode;
      }

      const category = normalizeStockInText(
        product.category ?? product.categoryName,
      );

      if (category) {
        movementData.category = category;
      }

      const categoryCode = String(
        product.categoryCode ?? product.categoryId ?? "",
      )
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

      const unitName = normalizeStockInText(product.unitName);

      if (unitName) {
        movementData.unitName = unitName;
      }

      const unitAbbreviation = String(product.unitAbbreviation ?? "")
        .trim()
        .toUpperCase();

      if (unitAbbreviation) {
        movementData.unitAbbreviation = unitAbbreviation;
      }

      if (preparedData.remarks) {
        movementData.remarks = preparedData.remarks;
      }

      const productUpdate = {
        quantity: newQuantity,

        hasStockHistory: true,

        stockMovementCount: nextMovementCount,

        lastStockMovementId: movementReference.id,

        lastStockMovementType: STOCK_MOVEMENT_TYPES.IN,

        lastStockMovementReason: preparedData.reason,

        lastStockMovementQuantity: preparedData.quantityReceived,

        lastStockMovementUnitCost: preparedData.unitCost,

        lastStockMovementAt: serverTimestamp(),

        updatedBy: currentUser.userId,

        updatedAt: serverTimestamp(),
      };

      /*
       * Zero-cost returned stock or opening
       * balances should not overwrite a valid
       * existing cost price with zero.
       */
      if (preparedData.unitCost > 0) {
        productUpdate.costPrice = preparedData.unitCost;
      }

      transaction.update(productReference, productUpdate);

      transaction.set(movementReference, movementData);

      transaction.set(operationReference, {
        operationId: preparedData.operationId,

        status: "COMPLETED",

        movementId: movementReference.id,

        productId: preparedData.productId,

        productName,

        productSku,

        quantityReceived: preparedData.quantityReceived,

        previousQuantity,

        newQuantity,

        unitCost: preparedData.unitCost,

        totalCost: preparedData.totalCost,

        source: preparedData.source,

        referenceNumber: preparedData.referenceNumber,

        dateReceived: preparedData.dateReceived,

        dateReceivedKey: preparedData.dateReceivedInput,

        reason: preparedData.reason,

        remarks: preparedData.remarks,

        receivedBy: currentUser.userId,

        receivedByName: currentUser.displayName,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),
      });

      receiptResult = {
        operationId: preparedData.operationId,

        movementId: movementReference.id,

        productId: preparedData.productId,

        productName,

        productSku,

        quantityReceived: preparedData.quantityReceived,

        previousQuantity,

        newQuantity,

        unitCost: preparedData.unitCost,

        totalCost: preparedData.totalCost,

        source: preparedData.source,

        referenceNumber: preparedData.referenceNumber,

        dateReceived: preparedData.dateReceivedInput,

        reason: preparedData.reason,

        receivedBy: currentUser.userId,

        receivedByName: currentUser.displayName,
      };
    });

    return receiptResult;
  } catch (error) {
    console.error("Unable to create Stock-In receipt:", error);

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
    getFirestoreDateMilliseconds(movement.dateReceived)
  );
}

/**
 * Subscribes to permanent Stock-In movement
 * history in real time.
 *
 * It also supports older movement records that
 * may use `type` instead of `movementType`.
 */
export function subscribeToStockInReceipts(onData, onError) {
  const movementCollection = collection(db, "stockMovements");

  return onSnapshot(
    movementCollection,

    (snapshot) => {
      const receipts = snapshot.docs
        .map((movementSnapshot) => {
          const movement = movementSnapshot.data();

          const movementType = String(
            movement.movementType ?? movement.type ?? "",
          )
            .trim()
            .toUpperCase();

          const quantity = Number(
            movement.quantity ?? movement.quantityReceived ?? 0,
          );

          const unitCost = Number(movement.unitCost ?? 0);

          const storedTotalCost = Number(movement.totalCost);

          const calculatedTotalCost =
            Number.isFinite(quantity) && Number.isFinite(unitCost)
              ? Math.round((quantity * unitCost + Number.EPSILON) * 100) / 100
              : 0;

          return {
            id: movementSnapshot.id,

            ...movement,

            movementType,

            quantity: Number.isFinite(quantity) ? quantity : 0,

            previousQuantity: Number(movement.previousQuantity ?? 0),

            newQuantity: Number(movement.newQuantity ?? 0),

            unitCost: Number.isFinite(unitCost) ? unitCost : 0,

            totalCost: Number.isFinite(storedTotalCost)
              ? storedTotalCost
              : calculatedTotalCost,
          };
        })
        .filter((movement) => movement.movementType === STOCK_MOVEMENT_TYPES.IN)
        .sort(
          (firstMovement, secondMovement) =>
            getMovementSortTime(secondMovement) -
            getMovementSortTime(firstMovement),
        );

      if (typeof onData === "function") {
        onData(receipts);
      }
    },

    (error) => {
      console.error("Unable to load Stock-In history:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}
