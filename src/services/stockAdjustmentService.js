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

import { USER_STATUSES } from "../constants/roles";

import {
  STOCK_ADJUSTMENT_DIRECTIONS,
  STOCK_ADJUSTMENT_LIMITS,
  STOCK_ADJUSTMENT_MOVEMENT_REASON,
  STOCK_ADJUSTMENT_OPERATION_STATUSES,
  STOCK_ADJUSTMENT_OPERATION_TYPES,
  STOCK_ADJUSTMENT_STATUSES,
  calculateStockAdjustmentDifference,
  calculateStockAdjustmentValue,
  canRoleCreateStockAdjustment,
  getStockAdjustmentDirection,
  isAdjustmentReasonAllowedForDirection,
  isValidStockAdjustmentDateNotFuture,
  isValidStockAdjustmentId,
  isValidStockAdjustmentOperationId,
  isValidStockAdjustmentQuantity,
  isValidStockAdjustmentReason,
  isValidStockAdjustmentReference,
  isValidStockAdjustmentRemarks,
  isValidStockAdjustmentUnitCost,
  normalizeStockAdjustmentReference,
  normalizeStockAdjustmentText,
} from "../constants/stockAdjustment";

const STOCK_ADJUSTMENT_REQUESTS_COLLECTION = "stockAdjustmentRequests";

const STOCK_ADJUSTMENT_OPERATIONS_COLLECTION = "stockAdjustmentOperations";

function createPermissionError() {
  return new Error(
    "Only an active Superadmin, Admin, or Inventory Staff account can submit a Stock Adjustment request.",
  );
}

/**
 * Loads the authenticated Firestore user profile and
 * confirms that the account may create requests.
 */
async function getCurrentStockAdjustmentUser() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error(
      "You must be signed in to submit a Stock Adjustment request.",
    );
  }

  const userReference = doc(db, "users", currentUser.uid);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (
    userProfile.status !== USER_STATUSES.ACTIVE ||
    !canRoleCreateStockAdjustment(userProfile.role)
  ) {
    throw createPermissionError();
  }

  return {
    userId: currentUser.uid,

    displayName: normalizeStockAdjustmentText(
      userProfile.displayName ||
        currentUser.displayName ||
        userProfile.email ||
        currentUser.email ||
        "Inventory User",
    ),

    role: userProfile.role,
  };
}

function prepareDocumentId(value, label) {
  const documentId = String(value ?? "").trim();

  if (!documentId) {
    throw new Error(`${label} is required.`);
  }

  if (documentId.includes("/") || documentId === "." || documentId === "..") {
    throw new Error(`${label} is invalid.`);
  }

  return documentId;
}

function prepareAdjustmentId(value) {
  const adjustmentId = prepareDocumentId(value, "Stock Adjustment ID");

  if (!isValidStockAdjustmentId(adjustmentId)) {
    throw new Error(
      "The Stock Adjustment ID is missing or invalid. Refresh the form and try again.",
    );
  }

  return adjustmentId;
}

function prepareCreateOperationId(value) {
  const operationId = prepareDocumentId(value, "Stock Adjustment operation ID");

  if (
    !isValidStockAdjustmentOperationId(operationId) ||
    !operationId.startsWith("stockadj_create_")
  ) {
    throw new Error(
      "The request operation ID is missing or invalid. Refresh the form and try again.",
    );
  }

  return operationId;
}

function prepareProductId(value) {
  return prepareDocumentId(value, "Product");
}

function prepareActualCountedQuantity(value) {
  if (value === undefined || value === null || value === "") {
    throw new Error("Actual counted quantity is required.");
  }

  const actualCountedQuantity = Number(value);

  if (!isValidStockAdjustmentQuantity(actualCountedQuantity)) {
    throw new Error(
      `Actual counted quantity must be a non-negative whole number not greater than ${STOCK_ADJUSTMENT_LIMITS.MAX_STOCK_QUANTITY}.`,
    );
  }

  return actualCountedQuantity;
}

function prepareReason(value) {
  const reason = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!isValidStockAdjustmentReason(reason)) {
    throw new Error("Select a valid Stock Adjustment reason.");
  }

  return reason;
}

function prepareReferenceNumber(value) {
  const referenceNumber = normalizeStockAdjustmentReference(value);

  if (!isValidStockAdjustmentReference(referenceNumber)) {
    throw new Error(
      `Reference number cannot exceed ${STOCK_ADJUSTMENT_LIMITS.REFERENCE_MAX_LENGTH} characters.`,
    );
  }

  return referenceNumber;
}

function prepareRemarks(value) {
  const remarks = String(value ?? "").trim();

  if (!isValidStockAdjustmentRemarks(remarks)) {
    throw new Error(
      `Remarks cannot exceed ${STOCK_ADJUSTMENT_LIMITS.REMARKS_MAX_LENGTH} characters.`,
    );
  }

  return remarks;
}

/**
 * Stores the selected count date at local midnight,
 * plus a YYYY-MM-DD key for stable display and
 * idempotency comparisons.
 */
function prepareCountDate(value) {
  const countDateKey = String(value ?? "").trim();

  if (!isValidStockAdjustmentDateNotFuture(countDateKey)) {
    throw new Error("Enter a valid count date that is not in the future.");
  }

  const [yearText, monthText, dayText] = countDateKey.split("-");

  const countDate = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    0,
    0,
    0,
    0,
  );

  return {
    countDate: Timestamp.fromDate(countDate),

    countDateKey,
  };
}

function prepareRequestInput(stockAdjustmentData) {
  const adjustmentId = prepareAdjustmentId(stockAdjustmentData?.adjustmentId);

  const createOperationId = prepareCreateOperationId(
    stockAdjustmentData?.createOperationId,
  );

  const productId = prepareProductId(stockAdjustmentData?.productId);

  const actualCountedQuantity = prepareActualCountedQuantity(
    stockAdjustmentData?.actualCountedQuantity,
  );

  const reason = prepareReason(stockAdjustmentData?.reason);

  const referenceNumber = prepareReferenceNumber(
    stockAdjustmentData?.referenceNumber,
  );

  const remarks = prepareRemarks(stockAdjustmentData?.remarks);

  const { countDate, countDateKey } = prepareCountDate(
    stockAdjustmentData?.countDate,
  );

  return {
    adjustmentId,
    createOperationId,
    productId,
    actualCountedQuantity,
    reason,
    referenceNumber,
    countDate,
    countDateKey,
    remarks,
  };
}

function resolveProductUnitCost(product) {
  const possibleUnitCost = Number(product?.costPrice ?? product?.unitCost ?? 0);

  if (isValidStockAdjustmentUnitCost(possibleUnitCost)) {
    return possibleUnitCost;
  }

  return 0;
}

function getProductName(product) {
  const productName = normalizeStockAdjustmentText(product?.name);

  if (!productName) {
    throw new Error("The selected Product does not have a valid name.");
  }

  return productName;
}

function getProductSku(product) {
  const productSku = String(product?.sku ?? "")
    .trim()
    .toUpperCase();

  if (!productSku) {
    throw new Error("The selected Product does not have a valid SKU.");
  }

  return productSku;
}

function addOptionalProductSnapshots(target, product) {
  const barcode = String(product?.barcode ?? "").trim();

  if (barcode) {
    target.barcode = barcode;
  }

  const category = normalizeStockAdjustmentText(
    product?.category ?? product?.categoryName,
  );

  if (category) {
    target.category = category;
  }

  const categoryCode = String(
    product?.categoryCode ?? product?.categoryId ?? "",
  )
    .trim()
    .toUpperCase();

  if (categoryCode) {
    target.categoryCode = categoryCode;
  }

  const unitCode = String(product?.unitCode ?? product?.unitId ?? "")
    .trim()
    .toUpperCase();

  if (unitCode) {
    target.unitCode = unitCode;
  }

  const unitName = normalizeStockAdjustmentText(product?.unitName);

  if (unitName) {
    target.unitName = unitName;
  }

  const unitAbbreviation = String(product?.unitAbbreviation ?? "")
    .trim()
    .toUpperCase();

  if (unitAbbreviation) {
    target.unitAbbreviation = unitAbbreviation;
  }
}

function buildRequestResult(requestData, { isReplay = false } = {}) {
  return {
    adjustmentId: requestData.adjustmentId,

    createOperationId: requestData.createOperationId,

    status: requestData.status,

    productId: requestData.productId,

    productName: requestData.productName,

    productSku: requestData.productSku,

    systemQuantityAtRequest: requestData.systemQuantityAtRequest,

    actualCountedQuantity: requestData.actualCountedQuantity,

    quantityDifference: requestData.quantityDifference,

    adjustmentDirection: requestData.adjustmentDirection,

    unitCostAtRequest: requestData.unitCostAtRequest,

    estimatedAdjustmentValue: requestData.estimatedAdjustmentValue,

    reason: requestData.reason,

    referenceNumber: requestData.referenceNumber,

    countDate: requestData.countDateKey,

    remarks: requestData.remarks,

    requestedBy: requestData.requestedBy,

    requestedByName: requestData.requestedByName,

    isReplay,
  };
}

function isSameCreateRequest(existingOperation, preparedInput, currentUser) {
  return (
    existingOperation.operationType ===
      STOCK_ADJUSTMENT_OPERATION_TYPES.CREATE_REQUEST &&
    existingOperation.operationStatus ===
      STOCK_ADJUSTMENT_OPERATION_STATUSES.COMPLETED &&
    existingOperation.adjustmentId === preparedInput.adjustmentId &&
    existingOperation.productId === preparedInput.productId &&
    existingOperation.actualCountedQuantity ===
      preparedInput.actualCountedQuantity &&
    existingOperation.reason === preparedInput.reason &&
    existingOperation.referenceNumber === preparedInput.referenceNumber &&
    existingOperation.countDateKey === preparedInput.countDateKey &&
    existingOperation.remarks === preparedInput.remarks &&
    existingOperation.performedBy === currentUser.userId
  );
}

/**
 * Creates a submitted Stock Adjustment request.
 *
 * This transaction does not update the Product
 * quantity and does not create a Stock Movement.
 *
 * It atomically creates:
 *
 * 1. stockAdjustmentRequests/{adjustmentId}
 * 2. stockAdjustmentOperations/{createOperationId}
 */
export async function createStockAdjustmentRequest(stockAdjustmentData) {
  const currentUser = await getCurrentStockAdjustmentUser();

  const preparedInput = prepareRequestInput(stockAdjustmentData);

  const requestReference = doc(
    db,
    STOCK_ADJUSTMENT_REQUESTS_COLLECTION,
    preparedInput.adjustmentId,
  );

  const operationReference = doc(
    db,
    STOCK_ADJUSTMENT_OPERATIONS_COLLECTION,
    preparedInput.createOperationId,
  );

  const productReference = doc(db, "products", preparedInput.productId);

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      /*
       * Read the idempotency record first.
       */
      const operationSnapshot = await transaction.get(operationReference);

      if (operationSnapshot.exists()) {
        const existingOperation = operationSnapshot.data();

        if (
          !isSameCreateRequest(existingOperation, preparedInput, currentUser)
        ) {
          throw new Error(
            "This Stock Adjustment operation ID is already linked to another request.",
          );
        }

        const existingRequestSnapshot = await transaction.get(requestReference);

        if (!existingRequestSnapshot.exists()) {
          throw new Error(
            "The existing Stock Adjustment operation is missing its linked request.",
          );
        }

        const existingRequest = existingRequestSnapshot.data();

        if (
          existingRequest.adjustmentId !== preparedInput.adjustmentId ||
          existingRequest.createOperationId !==
            preparedInput.createOperationId ||
          existingRequest.requestedBy !== currentUser.userId
        ) {
          throw new Error(
            "The existing Stock Adjustment request is inconsistent.",
          );
        }

        result = buildRequestResult(existingRequest, {
          isReplay: true,
        });

        return;
      }

      const requestSnapshot = await transaction.get(requestReference);

      if (requestSnapshot.exists()) {
        throw new Error(
          "This Stock Adjustment ID is already in use. Refresh the form and try again.",
        );
      }

      const productSnapshot = await transaction.get(productReference);

      if (!productSnapshot.exists()) {
        throw new Error("The selected Product no longer exists.");
      }

      const product = productSnapshot.data();

      const productStatus = product.status ?? PRODUCT_STATUSES.ACTIVE;

      if (productStatus !== PRODUCT_STATUSES.ACTIVE) {
        throw new Error("Inactive Products cannot be adjusted.");
      }

      const systemQuantityAtRequest = Number(product.quantity ?? 0);

      if (!isValidStockAdjustmentQuantity(systemQuantityAtRequest)) {
        throw new Error(
          "The selected Product contains an invalid current stock quantity.",
        );
      }

      const quantityDifference = calculateStockAdjustmentDifference(
        systemQuantityAtRequest,
        preparedInput.actualCountedQuantity,
      );

      if (quantityDifference === null) {
        throw new Error(
          "Unable to calculate a valid Stock Adjustment difference.",
        );
      }

      if (quantityDifference === 0) {
        throw new Error(
          "No Stock Adjustment is required because the actual count matches the system quantity.",
        );
      }

      const adjustmentDirection =
        getStockAdjustmentDirection(quantityDifference);

      if (
        !adjustmentDirection ||
        !Object.values(STOCK_ADJUSTMENT_DIRECTIONS).includes(
          adjustmentDirection,
        )
      ) {
        throw new Error("Unable to determine the Stock Adjustment direction.");
      }

      if (
        !isAdjustmentReasonAllowedForDirection(
          preparedInput.reason,
          adjustmentDirection,
        )
      ) {
        throw new Error(
          "The selected reason is not valid for this adjustment direction.",
        );
      }

      const productName = getProductName(product);

      const productSku = getProductSku(product);

      const unitCostAtRequest = resolveProductUnitCost(product);

      const estimatedAdjustmentValue = calculateStockAdjustmentValue(
        quantityDifference,
        unitCostAtRequest,
      );

      const rawEstimatedValue =
        Math.abs(quantityDifference) * unitCostAtRequest;

      if (
        !Number.isFinite(rawEstimatedValue) ||
        rawEstimatedValue > STOCK_ADJUSTMENT_LIMITS.MAX_TOTAL_VALUE
      ) {
        throw new Error(
          "The estimated adjustment value exceeds the allowed maximum.",
        );
      }

      const requestData = {
        adjustmentId: preparedInput.adjustmentId,

        createOperationId: preparedInput.createOperationId,

        status: STOCK_ADJUSTMENT_STATUSES.SUBMITTED,

        productId: preparedInput.productId,

        productName,

        productSku,

        systemQuantityAtRequest,

        actualCountedQuantity: preparedInput.actualCountedQuantity,

        quantityDifference,

        adjustmentDirection,

        unitCostAtRequest,

        estimatedAdjustmentValue,

        reason: preparedInput.reason,

        referenceNumber: preparedInput.referenceNumber,

        countDate: preparedInput.countDate,

        countDateKey: preparedInput.countDateKey,

        remarks: preparedInput.remarks,

        requestedBy: currentUser.userId,

        requestedByName: currentUser.displayName,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      };

      addOptionalProductSnapshots(requestData, product);

      const operationData = {
        operationId: preparedInput.createOperationId,

        operationType: STOCK_ADJUSTMENT_OPERATION_TYPES.CREATE_REQUEST,

        operationStatus: STOCK_ADJUSTMENT_OPERATION_STATUSES.COMPLETED,

        adjustmentId: preparedInput.adjustmentId,

        productId: preparedInput.productId,

        actualCountedQuantity: preparedInput.actualCountedQuantity,

        quantityDifference,

        adjustmentDirection,

        reason: preparedInput.reason,

        referenceNumber: preparedInput.referenceNumber,

        countDate: preparedInput.countDate,

        countDateKey: preparedInput.countDateKey,

        remarks: preparedInput.remarks,

        performedBy: currentUser.userId,

        performedByName: currentUser.displayName,

        createdBy: currentUser.userId,

        createdAt: serverTimestamp(),
      };

      /*
       * No Product write and no Stock Movement
       * write is allowed in Phase 6B.
       */
      transaction.set(requestReference, requestData);

      transaction.set(operationReference, operationData);

      result = buildRequestResult(requestData);
    });

    return result;
  } catch (error) {
    console.error("Unable to create Stock Adjustment request:", error);

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

function getRequestSortTime(request) {
  return (
    getFirestoreDateMilliseconds(request.createdAt) ||
    getFirestoreDateMilliseconds(request.countDate)
  );
}

function normalizeRequestSnapshot(requestId, request) {
  return {
    id: requestId,
    ...request,
    adjustmentId: request.adjustmentId ?? requestId,
  };
}

/**
 * Subscribes to Stock Adjustment requests and sorts
 * newest requests first without requiring a Firestore
 * composite index.
 */
export function subscribeToStockAdjustmentRequests(
  onData,
  onError = console.error,
) {
  if (typeof onData !== "function") {
    throw new Error("A Stock Adjustment request callback is required.");
  }

  const requestsCollection = collection(
    db,
    STOCK_ADJUSTMENT_REQUESTS_COLLECTION,
  );

  return onSnapshot(
    requestsCollection,
    (snapshot) => {
      const requests = snapshot.docs
        .map((requestSnapshot) =>
          normalizeRequestSnapshot(requestSnapshot.id, requestSnapshot.data()),
        )
        .sort(
          (firstRequest, secondRequest) =>
            getRequestSortTime(secondRequest) -
            getRequestSortTime(firstRequest),
        );

      onData(requests);
    },
    onError,
  );
}

/**
 * Loads one Stock Adjustment request by document ID.
 */
export async function getStockAdjustmentRequest(adjustmentId) {
  const preparedAdjustmentId = prepareAdjustmentId(adjustmentId);

  const requestReference = doc(
    db,
    STOCK_ADJUSTMENT_REQUESTS_COLLECTION,
    preparedAdjustmentId,
  );

  const requestSnapshot = await getDoc(requestReference);

  if (!requestSnapshot.exists()) {
    return null;
  }

  return normalizeRequestSnapshot(requestSnapshot.id, requestSnapshot.data());
}

/**
 * Public collection-name constants are useful for
 * Firestore Rules tests and future Phase 6 services.
 */
export const STOCK_ADJUSTMENT_COLLECTIONS = Object.freeze({
  REQUESTS: STOCK_ADJUSTMENT_REQUESTS_COLLECTION,

  OPERATIONS: STOCK_ADJUSTMENT_OPERATIONS_COLLECTION,

  MOVEMENTS: "stockMovements",

  PRODUCTS: "products",
});

export const STOCK_ADJUSTMENT_REQUEST_MOVEMENT_REASON =
  STOCK_ADJUSTMENT_MOVEMENT_REASON;
