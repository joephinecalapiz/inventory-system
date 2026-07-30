import { USER_ROLES } from "./roles.js";

import { STOCK_MOVEMENT_TYPES } from "./stockIn.js";

/**
 * Phase 6 — Stock Adjustment
 *
 * A Stock Adjustment corrects inventory after a
 * physical count or verified inventory discrepancy.
 *
 * It is not a replacement for normal Stock In,
 * Stock Out, or Goods Receiving transactions.
 */

export const STOCK_ADJUSTMENT_STATUSES = Object.freeze({
  /*
   * DRAFT exists only in the client form.
   * It is not stored as a Firestore request.
   */
  DRAFT: "DRAFT",

  SUBMITTED: "SUBMITTED",

  /*
   * APPROVED is reserved for a future workflow
   * where approval and posting are separate.
   *
   * Phase 6D should normally approve and post in
   * one atomic transaction, ending in POSTED.
   */
  APPROVED: "APPROVED",

  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  POSTED: "POSTED",
});

export const STOCK_ADJUSTMENT_STATUS_LABELS = Object.freeze({
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  POSTED: "Posted",
});

export const STOCK_ADJUSTMENT_PERSISTED_STATUSES = Object.freeze([
  STOCK_ADJUSTMENT_STATUSES.SUBMITTED,
  STOCK_ADJUSTMENT_STATUSES.APPROVED,
  STOCK_ADJUSTMENT_STATUSES.REJECTED,
  STOCK_ADJUSTMENT_STATUSES.CANCELLED,
  STOCK_ADJUSTMENT_STATUSES.POSTED,
]);

export const STOCK_ADJUSTMENT_FINAL_STATUSES = Object.freeze([
  STOCK_ADJUSTMENT_STATUSES.REJECTED,
  STOCK_ADJUSTMENT_STATUSES.CANCELLED,
  STOCK_ADJUSTMENT_STATUSES.POSTED,
]);

export const STOCK_ADJUSTMENT_DIRECTIONS = Object.freeze({
  IN: STOCK_MOVEMENT_TYPES.IN,
  OUT: STOCK_MOVEMENT_TYPES.OUT,
});

export const STOCK_ADJUSTMENT_DIRECTION_LABELS = Object.freeze({
  IN: "Increase Stock",
  OUT: "Decrease Stock",
});

export const STOCK_ADJUSTMENT_REASONS = Object.freeze({
  PHYSICAL_COUNT_CORRECTION: "PHYSICAL_COUNT_CORRECTION",

  ENCODING_ERROR: "ENCODING_ERROR",

  DAMAGED_FOUND_DURING_COUNT: "DAMAGED_FOUND_DURING_COUNT",

  EXPIRED_FOUND_DURING_COUNT: "EXPIRED_FOUND_DURING_COUNT",

  UNRECORDED_STOCK_FOUND: "UNRECORDED_STOCK_FOUND",

  LOSS_OR_SHORTAGE: "LOSS_OR_SHORTAGE",

  UNIT_CONVERSION_CORRECTION: "UNIT_CONVERSION_CORRECTION",

  OTHER: "OTHER",
});

export const STOCK_ADJUSTMENT_REASON_LABELS = Object.freeze({
  PHYSICAL_COUNT_CORRECTION: "Physical Count Correction",

  ENCODING_ERROR: "Encoding Error",

  DAMAGED_FOUND_DURING_COUNT: "Damaged Stock Found During Count",

  EXPIRED_FOUND_DURING_COUNT: "Expired Stock Found During Count",

  UNRECORDED_STOCK_FOUND: "Unrecorded Stock Found",

  LOSS_OR_SHORTAGE: "Loss or Shortage",

  UNIT_CONVERSION_CORRECTION: "Unit Conversion Correction",

  OTHER: "Other",
});

export const STOCK_ADJUSTMENT_REASON_OPTIONS = Object.freeze(
  Object.values(STOCK_ADJUSTMENT_REASONS).map((value) =>
    Object.freeze({
      value,

      label: STOCK_ADJUSTMENT_REASON_LABELS[value],
    }),
  ),
);

/**
 * Direction restrictions prevent contradictory
 * requests.
 *
 * Example:
 * "Unrecorded Stock Found" must increase stock.
 * "Loss or Shortage" must decrease stock.
 */
export const STOCK_ADJUSTMENT_IN_ONLY_REASONS = Object.freeze([
  STOCK_ADJUSTMENT_REASONS.UNRECORDED_STOCK_FOUND,
]);

export const STOCK_ADJUSTMENT_OUT_ONLY_REASONS = Object.freeze([
  STOCK_ADJUSTMENT_REASONS.DAMAGED_FOUND_DURING_COUNT,

  STOCK_ADJUSTMENT_REASONS.EXPIRED_FOUND_DURING_COUNT,

  STOCK_ADJUSTMENT_REASONS.LOSS_OR_SHORTAGE,
]);

export const STOCK_ADJUSTMENT_OPERATION_TYPES = Object.freeze({
  CREATE_REQUEST: "CREATE_REQUEST",

  POST_ADJUSTMENT: "POST_ADJUSTMENT",

  REJECT_REQUEST: "REJECT_REQUEST",

  CANCEL_REQUEST: "CANCEL_REQUEST",
});

export const STOCK_ADJUSTMENT_OPERATION_STATUSES = Object.freeze({
  COMPLETED: "COMPLETED",
});

export const STOCK_ADJUSTMENT_MOVEMENT_REASON = "STOCK_ADJUSTMENT";

export const STOCK_ADJUSTMENT_LIMITS = Object.freeze({
  MAX_STOCK_QUANTITY: 999999999,

  MAX_ABSOLUTE_DIFFERENCE: 999999999,

  MAX_UNIT_COST: 999999999,

  MAX_TOTAL_VALUE: 999999999999.99,

  REFERENCE_MAX_LENGTH: 100,

  REMARKS_MAX_LENGTH: 500,

  DECISION_REASON_MAX_LENGTH: 500,

  ADJUSTMENT_ID_MAX_LENGTH: 100,

  OPERATION_ID_MAX_LENGTH: 120,
});

/**
 * Phase 6 role access.
 */
export const STOCK_ADJUSTMENT_PERMISSIONS = Object.freeze({
  CREATE_REQUEST: Object.freeze([
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ]),

  REVIEW_REQUEST: Object.freeze([USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]),

  POST_ADJUSTMENT: Object.freeze([USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]),

  CANCEL_ANY_REQUEST: Object.freeze([USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]),

  VIEW_HISTORY: Object.freeze([
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
    USER_ROLES.AUDITOR,
  ]),
});

export const STOCK_ADJUSTMENT_POLICY = Object.freeze({
  REQUIRE_ACTIVE_PRODUCT: true,

  REQUIRE_NON_ZERO_DIFFERENCE: true,

  REQUIRE_WHOLE_NUMBER_QUANTITY: true,

  ALLOW_ZERO_ACTUAL_COUNT: true,

  ALLOW_SUPERADMIN_SELF_APPROVAL: true,

  ALLOW_ADMIN_SELF_APPROVAL: false,

  /*
   * If stock changed after the request was created,
   * the reviewer must see a warning before posting.
   */
  REQUIRE_STALE_REQUEST_CONFIRMATION: true,

  /*
   * Posting applies the signed request difference
   * to the Product's current quantity.
   *
   * It does not blindly overwrite current stock
   * with the old physical-count value.
   */
  APPLY_DIFFERENCE_TO_CURRENT_STOCK: true,
});

/**
 * Required fields for a newly submitted request:
 *
 * stockAdjustmentRequests/{adjustmentId}
 */
export const STOCK_ADJUSTMENT_REQUEST_REQUIRED_FIELDS = Object.freeze([
  "adjustmentId",
  "createOperationId",
  "status",

  "productId",
  "productName",
  "productSku",

  "systemQuantityAtRequest",
  "actualCountedQuantity",
  "quantityDifference",
  "adjustmentDirection",

  "unitCostAtRequest",
  "estimatedAdjustmentValue",

  "reason",
  "referenceNumber",
  "countDate",
  "countDateKey",
  "remarks",

  "requestedBy",
  "requestedByName",
  "createdBy",
  "createdAt",
  "updatedAt",
]);

export const STOCK_ADJUSTMENT_REQUEST_OPTIONAL_FIELDS = Object.freeze([
  "barcode",

  "category",
  "categoryCode",

  "unitCode",
  "unitName",
  "unitAbbreviation",

  "approvedBy",
  "approvedByName",
  "approvedAt",

  "rejectedBy",
  "rejectedByName",
  "rejectedAt",
  "rejectionReason",

  "cancelledBy",
  "cancelledByName",
  "cancelledAt",
  "cancellationReason",

  "postedOperationId",
  "movementId",

  "postedPreviousQuantity",
  "postedNewQuantity",
  "postedUnitCost",
  "postedTotalValue",
  "postedAt",
]);

/**
 * Required fields for the permanent adjustment
 * movement created only when posting succeeds:
 *
 * stockMovements/{movementId}
 */
export const STOCK_ADJUSTMENT_MOVEMENT_REQUIRED_FIELDS = Object.freeze([
  "movementId",
  "operationId",
  "adjustmentId",

  "movementType",
  "reason",
  "adjustmentReason",
  "adjustmentDirection",

  "productId",
  "productName",
  "productSku",

  "quantity",
  "quantityDifference",
  "previousQuantity",
  "newQuantity",

  "unitCost",
  "totalCost",

  "referenceNumber",
  "countDate",

  "requestedBy",
  "requestedByName",

  "approvedBy",
  "approvedByName",

  "createdBy",
  "createdAt",
]);

export const STOCK_ADJUSTMENT_MOVEMENT_OPTIONAL_FIELDS = Object.freeze([
  "barcode",

  "category",
  "categoryCode",

  "unitCode",
  "unitName",
  "unitAbbreviation",

  "remarks",
]);

/**
 * Required fields for immutable operation records:
 *
 * stockAdjustmentOperations/{operationId}
 */
export const STOCK_ADJUSTMENT_OPERATION_REQUIRED_FIELDS = Object.freeze([
  "operationId",
  "operationType",
  "operationStatus",

  "adjustmentId",
  "productId",

  "performedBy",
  "performedByName",

  "createdBy",
  "createdAt",
]);

export const STOCK_ADJUSTMENT_CREATE_OPERATION_FIELDS = Object.freeze([
  ...STOCK_ADJUSTMENT_OPERATION_REQUIRED_FIELDS,

  "actualCountedQuantity",
  "quantityDifference",
  "adjustmentDirection",
  "reason",
  "referenceNumber",
]);

export const STOCK_ADJUSTMENT_POST_OPERATION_FIELDS = Object.freeze([
  ...STOCK_ADJUSTMENT_OPERATION_REQUIRED_FIELDS,

  "movementId",

  "previousQuantity",
  "newQuantity",

  "quantity",
  "quantityDifference",
  "adjustmentDirection",

  "unitCost",
  "totalCost",
]);

export function normalizeStockAdjustmentText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeStockAdjustmentReference(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function isValidStockAdjustmentStatus(value) {
  return Object.values(STOCK_ADJUSTMENT_STATUSES).includes(value);
}

export function isPersistedStockAdjustmentStatus(value) {
  return STOCK_ADJUSTMENT_PERSISTED_STATUSES.includes(value);
}

export function isFinalStockAdjustmentStatus(value) {
  return STOCK_ADJUSTMENT_FINAL_STATUSES.includes(value);
}

export function isValidStockAdjustmentDirection(value) {
  return Object.values(STOCK_ADJUSTMENT_DIRECTIONS).includes(value);
}

export function isValidStockAdjustmentReason(value) {
  return Object.values(STOCK_ADJUSTMENT_REASONS).includes(value);
}

export function getStockAdjustmentDirection(quantityDifference) {
  const difference = Number(quantityDifference);

  if (!Number.isInteger(difference) || difference === 0) {
    return null;
  }

  return difference > 0
    ? STOCK_ADJUSTMENT_DIRECTIONS.IN
    : STOCK_ADJUSTMENT_DIRECTIONS.OUT;
}

export function isAdjustmentReasonAllowedForDirection(reason, direction) {
  if (
    !isValidStockAdjustmentReason(reason) ||
    !isValidStockAdjustmentDirection(direction)
  ) {
    return false;
  }

  if (STOCK_ADJUSTMENT_IN_ONLY_REASONS.includes(reason)) {
    return direction === STOCK_ADJUSTMENT_DIRECTIONS.IN;
  }

  if (STOCK_ADJUSTMENT_OUT_ONLY_REASONS.includes(reason)) {
    return direction === STOCK_ADJUSTMENT_DIRECTIONS.OUT;
  }

  return true;
}

export function isValidStockAdjustmentQuantity(value) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= STOCK_ADJUSTMENT_LIMITS.MAX_STOCK_QUANTITY
  );
}

export function calculateStockAdjustmentDifference(
  systemQuantity,
  actualCountedQuantity,
) {
  const system = Number(systemQuantity);

  const actual = Number(actualCountedQuantity);

  if (
    !isValidStockAdjustmentQuantity(system) ||
    !isValidStockAdjustmentQuantity(actual)
  ) {
    return null;
  }

  const difference = actual - system;

  if (Math.abs(difference) > STOCK_ADJUSTMENT_LIMITS.MAX_ABSOLUTE_DIFFERENCE) {
    return null;
  }

  return difference;
}

/**
 * Posting policy:
 *
 * postedNewQuantity =
 * currentProductQuantity + requestDifference
 *
 * This preserves valid Stock-In or Stock-Out
 * movements that happened after the count.
 */
export function calculatePostedAdjustmentBalance(
  currentProductQuantity,
  quantityDifference,
) {
  const current = Number(currentProductQuantity);

  const difference = Number(quantityDifference);

  if (
    !isValidStockAdjustmentQuantity(current) ||
    !Number.isInteger(difference) ||
    difference === 0 ||
    Math.abs(difference) > STOCK_ADJUSTMENT_LIMITS.MAX_ABSOLUTE_DIFFERENCE
  ) {
    return null;
  }

  const newQuantity = current + difference;

  if (!isValidStockAdjustmentQuantity(newQuantity)) {
    return null;
  }

  return newQuantity;
}

export function isStaleStockAdjustmentRequest(
  systemQuantityAtRequest,
  currentProductQuantity,
) {
  const requestedSystemQuantity = Number(systemQuantityAtRequest);

  const currentQuantity = Number(currentProductQuantity);

  if (
    !isValidStockAdjustmentQuantity(requestedSystemQuantity) ||
    !isValidStockAdjustmentQuantity(currentQuantity)
  ) {
    return true;
  }

  return requestedSystemQuantity !== currentQuantity;
}

export function isValidStockAdjustmentUnitCost(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= STOCK_ADJUSTMENT_LIMITS.MAX_UNIT_COST
  );
}

export function roundStockAdjustmentMoney(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

export function calculateStockAdjustmentValue(quantityDifference, unitCost) {
  const difference = Number(quantityDifference);

  const cost = Number(unitCost);

  if (
    !Number.isInteger(difference) ||
    difference === 0 ||
    Math.abs(difference) > STOCK_ADJUSTMENT_LIMITS.MAX_ABSOLUTE_DIFFERENCE ||
    !isValidStockAdjustmentUnitCost(cost)
  ) {
    return 0;
  }

  const total = Math.abs(difference) * cost;

  if (
    !Number.isFinite(total) ||
    total > STOCK_ADJUSTMENT_LIMITS.MAX_TOTAL_VALUE
  ) {
    return 0;
  }

  return roundStockAdjustmentMoney(total);
}

export function isValidStockAdjustmentReference(value) {
  return (
    normalizeStockAdjustmentReference(value).length <=
    STOCK_ADJUSTMENT_LIMITS.REFERENCE_MAX_LENGTH
  );
}

export function isValidStockAdjustmentRemarks(value) {
  return (
    String(value ?? "").trim().length <=
    STOCK_ADJUSTMENT_LIMITS.REMARKS_MAX_LENGTH
  );
}

export function isValidStockAdjustmentDecisionReason(value) {
  const reason = normalizeStockAdjustmentText(value);

  return (
    reason.length >= 1 &&
    reason.length <= STOCK_ADJUSTMENT_LIMITS.DECISION_REASON_MAX_LENGTH
  );
}

/**
 * Validates YYYY-MM-DD.
 */
export function isValidStockAdjustmentDate(value) {
  const normalizedDate = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return false;
  }

  const [yearText, monthText, dayText] = normalizedDate.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function getTodayStockAdjustmentDate() {
  const currentDate = new Date();

  const timezoneOffset = currentDate.getTimezoneOffset() * 60 * 1000;

  return new Date(currentDate.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export function isValidStockAdjustmentDateNotFuture(value) {
  return (
    isValidStockAdjustmentDate(value) && value <= getTodayStockAdjustmentDate()
  );
}

function createStockAdjustmentRandomPart() {
  const randomUuid = globalThis.crypto?.randomUUID?.();

  return randomUuid
    ? randomUuid.replaceAll("-", "")
    : `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function createStockAdjustmentId() {
  return `stockadj_${createStockAdjustmentRandomPart()}`.slice(
    0,
    STOCK_ADJUSTMENT_LIMITS.ADJUSTMENT_ID_MAX_LENGTH,
  );
}

export function createStockAdjustmentOperationId(
  operationType = STOCK_ADJUSTMENT_OPERATION_TYPES.CREATE_REQUEST,
) {
  const prefixByType = {
    [STOCK_ADJUSTMENT_OPERATION_TYPES.CREATE_REQUEST]: "stockadj_create",

    [STOCK_ADJUSTMENT_OPERATION_TYPES.POST_ADJUSTMENT]: "stockadj_post",

    [STOCK_ADJUSTMENT_OPERATION_TYPES.REJECT_REQUEST]: "stockadj_reject",

    [STOCK_ADJUSTMENT_OPERATION_TYPES.CANCEL_REQUEST]: "stockadj_cancel",
  };

  const prefix = prefixByType[operationType];

  if (!prefix) {
    throw new Error("Invalid Stock Adjustment operation type.");
  }

  return `${prefix}_${createStockAdjustmentRandomPart()}`.slice(
    0,
    STOCK_ADJUSTMENT_LIMITS.OPERATION_ID_MAX_LENGTH,
  );
}

export function isValidStockAdjustmentId(value) {
  const adjustmentId = String(value ?? "").trim();

  return (
    adjustmentId.length >= 16 &&
    adjustmentId.length <= STOCK_ADJUSTMENT_LIMITS.ADJUSTMENT_ID_MAX_LENGTH &&
    /^stockadj_[A-Za-z0-9_-]+$/.test(adjustmentId)
  );
}

export function isValidStockAdjustmentOperationId(value) {
  const operationId = String(value ?? "").trim();

  return (
    operationId.length >= 20 &&
    operationId.length <= STOCK_ADJUSTMENT_LIMITS.OPERATION_ID_MAX_LENGTH &&
    /^stockadj_(create|post|reject|cancel)_[A-Za-z0-9_-]+$/.test(operationId)
  );
}

export function canRoleCreateStockAdjustment(role) {
  return STOCK_ADJUSTMENT_PERMISSIONS.CREATE_REQUEST.includes(role);
}

export function canRoleReviewStockAdjustment(role) {
  return STOCK_ADJUSTMENT_PERMISSIONS.REVIEW_REQUEST.includes(role);
}

export function canRolePostStockAdjustment(role) {
  return STOCK_ADJUSTMENT_PERMISSIONS.POST_ADJUSTMENT.includes(role);
}

export function canRoleViewStockAdjustmentHistory(role) {
  return STOCK_ADJUSTMENT_PERMISSIONS.VIEW_HISTORY.includes(role);
}

export function canApproveOwnStockAdjustment(role, requesterId, reviewerId) {
  const normalizedRequesterId = String(requesterId ?? "").trim();

  const normalizedReviewerId = String(reviewerId ?? "").trim();

  if (!normalizedRequesterId || !normalizedReviewerId) {
    return false;
  }

  if (normalizedRequesterId !== normalizedReviewerId) {
    return true;
  }

  if (role === USER_ROLES.SUPERADMIN) {
    return STOCK_ADJUSTMENT_POLICY.ALLOW_SUPERADMIN_SELF_APPROVAL;
  }

  if (role === USER_ROLES.ADMIN) {
    return STOCK_ADJUSTMENT_POLICY.ALLOW_ADMIN_SELF_APPROVAL;
  }

  return false;
}

export function createEmptyStockAdjustmentForm(productId = "") {
  return {
    adjustmentId: createStockAdjustmentId(),

    createOperationId: createStockAdjustmentOperationId(
      STOCK_ADJUSTMENT_OPERATION_TYPES.CREATE_REQUEST,
    ),

    productId: String(productId ?? "").trim(),

    actualCountedQuantity: "",

    reason: STOCK_ADJUSTMENT_REASONS.PHYSICAL_COUNT_CORRECTION,

    referenceNumber: "",

    countDate: getTodayStockAdjustmentDate(),

    remarks: "",
  };
}
