import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
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
  calculatePostedAdjustmentBalance,
  calculateStockAdjustmentValue,
  canApproveOwnStockAdjustment,
  canRoleCreateStockAdjustment,
  canRoleReviewStockAdjustment,
  getStockAdjustmentDirection,
  isAdjustmentReasonAllowedForDirection,
  isValidStockAdjustmentDateNotFuture,
  isValidStockAdjustmentId,
  isValidStockAdjustmentOperationId,
  isStaleStockAdjustmentRequest,
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

  async function loadExistingReplay() {
    const operationSnapshot = await getDoc(operationReference);

    if (!operationSnapshot.exists()) {
      return null;
    }

    const existingOperation = operationSnapshot.data();

    if (!isSameCreateRequest(existingOperation, preparedInput, currentUser)) {
      throw new Error(
        "This Stock Adjustment operation ID is already linked to another request.",
      );
    }

    const existingRequestSnapshot = await getDoc(requestReference);

    if (!existingRequestSnapshot.exists()) {
      throw new Error(
        "The existing Stock Adjustment operation is missing its linked request.",
      );
    }

    const existingRequest = existingRequestSnapshot.data();

    if (
      existingRequest.adjustmentId !== preparedInput.adjustmentId ||
      existingRequest.createOperationId !== preparedInput.createOperationId ||
      existingRequest.requestedBy !== currentUser.userId
    ) {
      throw new Error("The existing Stock Adjustment request is inconsistent.");
    }

    return buildRequestResult(existingRequest, {
      isReplay: true,
    });
  }

  try {
    /*
     * Keep request reads outside the atomic write.
     *
     * The previous implementation used a Firestore transaction
     * that read the operation and Product, then created the request
     * and operation. In the real browser workflow, those reads and
     * both large create validators shared one Rules evaluation and
     * exceeded Firestore's 1000-expression limit.
     *
     * The two writes remain atomic through writeBatch(). The Rules
     * still compare the request with the current Product and linked
     * operation using get() and getAfter().
     */
    const existingReplay = await loadExistingReplay();

    if (existingReplay) {
      return existingReplay;
    }

    const existingRequestSnapshot = await getDoc(requestReference);

    if (existingRequestSnapshot.exists()) {
      throw new Error(
        "This Stock Adjustment request ID already exists without its expected operation record. Create a new request or remove the incomplete emulator record.",
      );
    }

    const productSnapshot = await getDoc(productReference);

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

    const adjustmentDirection = getStockAdjustmentDirection(quantityDifference);

    if (
      !adjustmentDirection ||
      !Object.values(STOCK_ADJUSTMENT_DIRECTIONS).includes(adjustmentDirection)
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

    const rawEstimatedValue = Math.abs(quantityDifference) * unitCostAtRequest;

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

    const batch = writeBatch(db);

    batch.set(requestReference, requestData);

    batch.set(operationReference, operationData);

    await batch.commit();

    return buildRequestResult(requestData);
  } catch (error) {
    /*
     * A retry may race with a successful first submission. When
     * that happens, the immutable Rules deny the second write.
     * Load the stored linked documents and return them as a replay.
     */
    try {
      const replay = await loadExistingReplay();

      if (replay) {
        return replay;
      }
    } catch (replayError) {
      console.error(
        "Unable to verify the existing Stock Adjustment request:",
        replayError,
      );
    }

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

/*
 * Phase 6D - review, rejection, cancellation, and atomic posting.
 */

async function getCurrentStockAdjustmentReviewer() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error(
      "You must be signed in to review Stock Adjustment requests.",
    );
  }

  const profileSnapshot = await getDoc(doc(db, "users", currentUser.uid));

  if (!profileSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const profile = profileSnapshot.data();

  if (
    profile.status !== USER_STATUSES.ACTIVE ||
    !canRoleReviewStockAdjustment(profile.role)
  ) {
    throw new Error(
      "Only an active Superadmin or Admin account can review Stock Adjustment requests.",
    );
  }

  return {
    userId: currentUser.uid,
    role: profile.role,
    displayName: normalizeStockAdjustmentText(
      profile.displayName ||
        currentUser.displayName ||
        profile.email ||
        currentUser.email ||
        "Inventory Reviewer",
    ),
  };
}

function prepareReviewOperationId(value, expectedPrefix) {
  const operationId = prepareDocumentId(
    value,
    "Stock Adjustment review operation ID",
  );

  if (
    !isValidStockAdjustmentOperationId(operationId) ||
    !operationId.startsWith(expectedPrefix)
  ) {
    throw new Error(
      "The Stock Adjustment review operation ID is invalid. Refresh and try again.",
    );
  }

  return operationId;
}

function prepareDecisionReason(value, label) {
  const reason = normalizeStockAdjustmentText(value);

  if (
    !reason ||
    reason.length > STOCK_ADJUSTMENT_LIMITS.DECISION_REASON_MAX_LENGTH
  ) {
    throw new Error(
      `${label} is required and cannot exceed ${STOCK_ADJUSTMENT_LIMITS.DECISION_REASON_MAX_LENGTH} characters.`,
    );
  }

  return reason;
}

function validateSubmittedAdjustment(requestData) {
  if (requestData.status !== STOCK_ADJUSTMENT_STATUSES.SUBMITTED) {
    throw new Error(
      "Only submitted Stock Adjustment requests can be reviewed.",
    );
  }

  const systemQuantity = requestData.systemQuantityAtRequest;

  const actualQuantity = requestData.actualCountedQuantity;

  const difference = requestData.quantityDifference;

  if (
    !isValidStockAdjustmentQuantity(systemQuantity) ||
    !isValidStockAdjustmentQuantity(actualQuantity) ||
    !Number.isInteger(difference) ||
    difference === 0 ||
    actualQuantity - systemQuantity !== difference ||
    getStockAdjustmentDirection(difference) !==
      requestData.adjustmentDirection ||
    !isAdjustmentReasonAllowedForDirection(
      requestData.reason,
      requestData.adjustmentDirection,
    )
  ) {
    throw new Error(
      "The Stock Adjustment request contains an invalid quantity calculation.",
    );
  }
}

function getMovementCount(product) {
  const count = Number(product.stockMovementCount ?? 0);

  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function buildPostedResult(requestData, isReplay = false) {
  return {
    adjustmentId: requestData.adjustmentId,
    status: requestData.status,
    productId: requestData.productId,
    productName: requestData.productName,
    productSku: requestData.productSku,
    quantityDifference: requestData.quantityDifference,
    adjustmentDirection: requestData.adjustmentDirection,
    postedPreviousQuantity: requestData.postedPreviousQuantity,
    postedNewQuantity: requestData.postedNewQuantity,
    postedUnitCost: requestData.postedUnitCost,
    postedTotalValue: requestData.postedTotalValue,
    postedOperationId: requestData.postedOperationId,
    movementId: requestData.movementId,
    approvedBy: requestData.approvedBy,
    approvedByName: requestData.approvedByName,
    isReplay,
  };
}

function isMatchingPostReplay(operation, requestData, reviewer, operationId) {
  return (
    operation.operationId === operationId &&
    operation.operationType ===
      STOCK_ADJUSTMENT_OPERATION_TYPES.POST_ADJUSTMENT &&
    operation.operationStatus ===
      STOCK_ADJUSTMENT_OPERATION_STATUSES.COMPLETED &&
    operation.adjustmentId === requestData.adjustmentId &&
    operation.productId === requestData.productId &&
    operation.quantityDifference === requestData.quantityDifference &&
    operation.performedBy === reviewer.userId &&
    requestData.status === STOCK_ADJUSTMENT_STATUSES.POSTED &&
    requestData.postedOperationId === operationId &&
    requestData.movementId === operationId
  );
}

export async function approveAndPostStockAdjustment({
  adjustmentId,
  postOperationId,
  confirmStaleRequest = false,
}) {
  const reviewer = await getCurrentStockAdjustmentReviewer();

  const preparedAdjustmentId = prepareAdjustmentId(adjustmentId);

  const preparedOperationId = prepareReviewOperationId(
    postOperationId,
    "stockadj_post_",
  );

  const requestReference = doc(
    db,
    STOCK_ADJUSTMENT_REQUESTS_COLLECTION,
    preparedAdjustmentId,
  );

  const operationReference = doc(
    db,
    STOCK_ADJUSTMENT_OPERATIONS_COLLECTION,
    preparedOperationId,
  );

  const movementReference = doc(db, "stockMovements", preparedOperationId);

  let result = null;

  await runTransaction(db, async (transaction) => {
    const operationSnapshot = await transaction.get(operationReference);

    const requestSnapshot = await transaction.get(requestReference);

    if (!requestSnapshot.exists()) {
      throw new Error("The Stock Adjustment request no longer exists.");
    }

    const requestData = requestSnapshot.data();

    if (operationSnapshot.exists()) {
      if (
        !isMatchingPostReplay(
          operationSnapshot.data(),
          requestData,
          reviewer,
          preparedOperationId,
        )
      ) {
        throw new Error(
          "This post operation ID is already linked to another Stock Adjustment.",
        );
      }

      result = buildPostedResult(requestData, true);
      return;
    }

    validateSubmittedAdjustment(requestData);

    if (
      !canApproveOwnStockAdjustment(
        reviewer.role,
        requestData.requestedBy,
        reviewer.userId,
      )
    ) {
      throw new Error(
        "An Admin cannot approve and post their own Stock Adjustment request.",
      );
    }

    const productReference = doc(db, "products", requestData.productId);

    const productSnapshot = await transaction.get(productReference);

    if (!productSnapshot.exists()) {
      throw new Error("The Product linked to this request no longer exists.");
    }

    const product = productSnapshot.data();

    if (
      (product.status ?? PRODUCT_STATUSES.ACTIVE) !== PRODUCT_STATUSES.ACTIVE
    ) {
      throw new Error("Inactive Products cannot receive Stock Adjustments.");
    }

    const previousQuantity = Number(product.quantity ?? 0);

    if (!isValidStockAdjustmentQuantity(previousQuantity)) {
      throw new Error("The Product contains an invalid current quantity.");
    }

    const isStale = isStaleStockAdjustmentRequest(
      requestData.systemQuantityAtRequest,
      previousQuantity,
    );

    if (isStale && !confirmStaleRequest) {
      throw new Error(
        "The Product quantity changed after this request was submitted. Confirm the stale request before posting.",
      );
    }

    const newQuantity = calculatePostedAdjustmentBalance(
      previousQuantity,
      requestData.quantityDifference,
    );

    if (newQuantity === null) {
      throw new Error(
        "Posting this adjustment would create an invalid Product quantity.",
      );
    }

    const direction = getStockAdjustmentDirection(
      requestData.quantityDifference,
    );

    const quantity = Math.abs(requestData.quantityDifference);

    const unitCost = resolveProductUnitCost(product);

    const totalCost = calculateStockAdjustmentValue(
      requestData.quantityDifference,
      unitCost,
    );

    const postedAt = serverTimestamp();

    const requestUpdate = {
      status: STOCK_ADJUSTMENT_STATUSES.POSTED,
      approvedBy: reviewer.userId,
      approvedByName: reviewer.displayName,
      approvedAt: postedAt,
      postedOperationId: preparedOperationId,
      movementId: preparedOperationId,
      postedPreviousQuantity: previousQuantity,
      postedNewQuantity: newQuantity,
      postedUnitCost: unitCost,
      postedTotalValue: totalCost,
      postedAt,
      updatedAt: postedAt,
    };

    const movementData = {
      movementId: preparedOperationId,
      operationId: preparedOperationId,
      adjustmentId: requestData.adjustmentId,
      movementType: direction,
      reason: STOCK_ADJUSTMENT_MOVEMENT_REASON,
      adjustmentReason: requestData.reason,
      adjustmentDirection: direction,
      productId: requestData.productId,
      productName: requestData.productName,
      productSku: requestData.productSku,
      quantity,
      quantityDifference: requestData.quantityDifference,
      previousQuantity,
      newQuantity,
      unitCost,
      totalCost,
      referenceNumber: requestData.referenceNumber ?? "",
      countDate: requestData.countDate,
      countDateKey: requestData.countDateKey,
      remarks: requestData.remarks ?? "",
      requestedBy: requestData.requestedBy,
      requestedByName: requestData.requestedByName,
      approvedBy: reviewer.userId,
      approvedByName: reviewer.displayName,
      createdBy: reviewer.userId,
      createdAt: postedAt,
    };

    addOptionalProductSnapshots(movementData, requestData);

    const operationData = {
      operationId: preparedOperationId,
      operationType: STOCK_ADJUSTMENT_OPERATION_TYPES.POST_ADJUSTMENT,
      operationStatus: STOCK_ADJUSTMENT_OPERATION_STATUSES.COMPLETED,
      adjustmentId: requestData.adjustmentId,
      movementId: preparedOperationId,
      productId: requestData.productId,
      previousQuantity,
      newQuantity,
      quantity,
      quantityDifference: requestData.quantityDifference,
      adjustmentDirection: direction,
      unitCost,
      totalCost,
      performedBy: reviewer.userId,
      performedByName: reviewer.displayName,
      createdBy: reviewer.userId,
      createdAt: postedAt,
    };

    transaction.update(productReference, {
      quantity: newQuantity,
      hasStockHistory: true,
      stockMovementCount: getMovementCount(product) + 1,
      lastStockMovementId: preparedOperationId,
      lastStockMovementType: direction,
      lastStockMovementReason: STOCK_ADJUSTMENT_MOVEMENT_REASON,
      lastStockMovementQuantity: quantity,
      lastStockMovementUnitCost: unitCost,
      lastStockMovementAt: postedAt,
      lastStockMovementBy: reviewer.userId,
      updatedBy: reviewer.userId,
      updatedAt: postedAt,
    });

    transaction.update(requestReference, requestUpdate);

    transaction.set(movementReference, movementData);

    transaction.set(operationReference, operationData);

    result = buildPostedResult({
      ...requestData,
      ...requestUpdate,
    });
  });

  return result;
}

function isMatchingDecisionReplay(operation, requestData, input) {
  return (
    operation.operationId === input.operationId &&
    operation.operationType === input.operationType &&
    operation.operationStatus ===
      STOCK_ADJUSTMENT_OPERATION_STATUSES.COMPLETED &&
    operation.adjustmentId === requestData.adjustmentId &&
    operation.productId === requestData.productId &&
    operation.performedBy === input.reviewer.userId &&
    operation.decisionReason === input.decisionReason &&
    requestData.status === input.targetStatus
  );
}

async function finalizeStockAdjustmentDecision({
  adjustmentId,
  operationId,
  expectedPrefix,
  operationType,
  targetStatus,
  decisionReason,
  decisionLabel,
}) {
  const reviewer = await getCurrentStockAdjustmentReviewer();

  const preparedAdjustmentId = prepareAdjustmentId(adjustmentId);

  const preparedOperationId = prepareReviewOperationId(
    operationId,
    expectedPrefix,
  );

  const preparedDecisionReason = prepareDecisionReason(
    decisionReason,
    decisionLabel,
  );

  const requestReference = doc(
    db,
    STOCK_ADJUSTMENT_REQUESTS_COLLECTION,
    preparedAdjustmentId,
  );

  const operationReference = doc(
    db,
    STOCK_ADJUSTMENT_OPERATIONS_COLLECTION,
    preparedOperationId,
  );

  let result = null;

  await runTransaction(db, async (transaction) => {
    const operationSnapshot = await transaction.get(operationReference);

    const requestSnapshot = await transaction.get(requestReference);

    if (!requestSnapshot.exists()) {
      throw new Error("The Stock Adjustment request no longer exists.");
    }

    const requestData = requestSnapshot.data();

    const replayInput = {
      operationId: preparedOperationId,
      operationType,
      targetStatus,
      reviewer,
      decisionReason: preparedDecisionReason,
    };

    if (operationSnapshot.exists()) {
      if (
        !isMatchingDecisionReplay(
          operationSnapshot.data(),
          requestData,
          replayInput,
        )
      ) {
        throw new Error(
          "This review operation ID is already linked to another decision.",
        );
      }

      result = {
        adjustmentId: preparedAdjustmentId,
        status: targetStatus,
        isReplay: true,
      };
      return;
    }

    validateSubmittedAdjustment(requestData);

    const decidedAt = serverTimestamp();

    const requestUpdate =
      targetStatus === STOCK_ADJUSTMENT_STATUSES.REJECTED
        ? {
            status: STOCK_ADJUSTMENT_STATUSES.REJECTED,
            rejectedBy: reviewer.userId,
            rejectedByName: reviewer.displayName,
            rejectedAt: decidedAt,
            rejectionReason: preparedDecisionReason,
            rejectedOperationId: preparedOperationId,
            updatedAt: decidedAt,
          }
        : {
            status: STOCK_ADJUSTMENT_STATUSES.CANCELLED,
            cancelledBy: reviewer.userId,
            cancelledByName: reviewer.displayName,
            cancelledAt: decidedAt,
            cancellationReason: preparedDecisionReason,
            cancelledOperationId: preparedOperationId,
            updatedAt: decidedAt,
          };

    const operationData = {
      operationId: preparedOperationId,
      operationType,
      operationStatus: STOCK_ADJUSTMENT_OPERATION_STATUSES.COMPLETED,
      adjustmentId: preparedAdjustmentId,
      productId: requestData.productId,
      decisionReason: preparedDecisionReason,
      performedBy: reviewer.userId,
      performedByName: reviewer.displayName,
      createdBy: reviewer.userId,
      createdAt: decidedAt,
    };

    transaction.update(requestReference, requestUpdate);

    transaction.set(operationReference, operationData);

    result = {
      adjustmentId: preparedAdjustmentId,
      status: targetStatus,
      isReplay: false,
    };
  });

  return result;
}

export async function rejectStockAdjustmentRequest({
  adjustmentId,
  rejectOperationId,
  rejectionReason,
}) {
  return finalizeStockAdjustmentDecision({
    adjustmentId,
    operationId: rejectOperationId,
    expectedPrefix: "stockadj_reject_",
    operationType: STOCK_ADJUSTMENT_OPERATION_TYPES.REJECT_REQUEST,
    targetStatus: STOCK_ADJUSTMENT_STATUSES.REJECTED,
    decisionReason: rejectionReason,
    decisionLabel: "Rejection reason",
  });
}

export async function cancelStockAdjustmentRequest({
  adjustmentId,
  cancelOperationId,
  cancellationReason,
}) {
  return finalizeStockAdjustmentDecision({
    adjustmentId,
    operationId: cancelOperationId,
    expectedPrefix: "stockadj_cancel_",
    operationType: STOCK_ADJUSTMENT_OPERATION_TYPES.CANCEL_REQUEST,
    targetStatus: STOCK_ADJUSTMENT_STATUSES.CANCELLED,
    decisionReason: cancellationReason,
    decisionLabel: "Cancellation reason",
  });
}

function normalizeLinkedSnapshot(snapshot) {
  if (!snapshot?.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function getFinalStockAdjustmentOperationId(requestData) {
  if (requestData.status === STOCK_ADJUSTMENT_STATUSES.POSTED) {
    return requestData.postedOperationId || requestData.movementId || "";
  }

  if (requestData.status === STOCK_ADJUSTMENT_STATUSES.REJECTED) {
    return requestData.rejectedOperationId || "";
  }

  if (requestData.status === STOCK_ADJUSTMENT_STATUSES.CANCELLED) {
    return requestData.cancelledOperationId || "";
  }

  return "";
}

/**
 * Loads the full immutable audit context for one
 * Stock Adjustment request.
 *
 * Returned links:
 * - request
 * - createOperation
 * - finalOperation, when available
 * - movement, for POSTED requests
 *
 * Older rejected or cancelled requests created
 * before Phase 6E may not contain a final operation
 * ID. Their request audit fields are still returned.
 */
export async function getStockAdjustmentHistoryDetails(adjustmentId) {
  const request = await getStockAdjustmentRequest(adjustmentId);

  if (!request) {
    return null;
  }

  const createOperationReference = request.createOperationId
    ? doc(db, STOCK_ADJUSTMENT_OPERATIONS_COLLECTION, request.createOperationId)
    : null;

  const finalOperationId = getFinalStockAdjustmentOperationId(request);

  const finalOperationReference = finalOperationId
    ? doc(db, STOCK_ADJUSTMENT_OPERATIONS_COLLECTION, finalOperationId)
    : null;

  const movementReference = request.movementId
    ? doc(db, "stockMovements", request.movementId)
    : null;

  const [createOperationSnapshot, finalOperationSnapshot, movementSnapshot] =
    await Promise.all([
      createOperationReference
        ? getDoc(createOperationReference)
        : Promise.resolve(null),

      finalOperationReference
        ? getDoc(finalOperationReference)
        : Promise.resolve(null),

      movementReference ? getDoc(movementReference) : Promise.resolve(null),
    ]);

  return {
    request,

    createOperation: normalizeLinkedSnapshot(createOperationSnapshot),

    finalOperation: normalizeLinkedSnapshot(finalOperationSnapshot),

    movement: normalizeLinkedSnapshot(movementSnapshot),
  };
}
