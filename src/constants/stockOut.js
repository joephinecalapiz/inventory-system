import { STOCK_MOVEMENT_TYPES } from "./stockIn";

export const STOCK_OUT_REASONS = Object.freeze({
  MANUAL_STOCK_OUT: "MANUAL_STOCK_OUT",
  DAMAGED: "DAMAGED",
  EXPIRED: "EXPIRED",
  INTERNAL_USE: "INTERNAL_USE",
  TRANSFER: "TRANSFER",
  SAMPLE: "SAMPLE",
  LOSS: "LOSS",
  OTHER: "OTHER",
});

export const STOCK_OUT_REASON_LABELS = Object.freeze({
  MANUAL_STOCK_OUT: "Manual Stock Out",
  DAMAGED: "Damaged",
  EXPIRED: "Expired",
  INTERNAL_USE: "Internal Use",
  TRANSFER: "Transfer",
  SAMPLE: "Sample",
  LOSS: "Loss",
  OTHER: "Other",
});

export const STOCK_OUT_REASON_OPTIONS = Object.freeze(
  Object.values(STOCK_OUT_REASONS).map((value) =>
    Object.freeze({
      value,
      label: STOCK_OUT_REASON_LABELS[value],
    }),
  ),
);

export const STOCK_OUT_REASONS_REQUIRING_DESTINATION = Object.freeze([
  STOCK_OUT_REASONS.INTERNAL_USE,
  STOCK_OUT_REASONS.TRANSFER,
  STOCK_OUT_REASONS.SAMPLE,
]);

export const STOCK_OUT_LIMITS = Object.freeze({
  MAX_QUANTITY: 999999999,
  MAX_UNIT_COST: 999999999,
  MAX_TOTAL_VALUE: 999999999999.99,
  DESTINATION_MAX_LENGTH: 150,
  REFERENCE_MAX_LENGTH: 100,
  REMARKS_MAX_LENGTH: 500,
  OPERATION_ID_MAX_LENGTH: 100,
});

/**
 * Required fields stored in:
 *
 * stockMovements/{operationId}
 */
export const STOCK_OUT_MOVEMENT_REQUIRED_FIELDS = Object.freeze([
  "movementId",
  "operationId",
  "movementType",
  "reason",
  "productId",
  "productName",
  "productSku",
  "quantity",
  "previousQuantity",
  "newQuantity",
  "unitCost",
  "totalCost",
  "destination",
  "referenceNumber",
  "dateReleased",
  "releasedBy",
  "releasedByName",
  "createdBy",
  "createdAt",
]);

/**
 * Optional product snapshot fields added when
 * available on the Product document.
 */
export const STOCK_OUT_MOVEMENT_OPTIONAL_FIELDS = Object.freeze([
  "barcode",
  "category",
  "categoryCode",
  "unitCode",
  "unitName",
  "unitAbbreviation",
  "remarks",
]);

/**
 * Required fields stored in:
 *
 * stockOutOperations/{operationId}
 *
 * The operation document is used for idempotency.
 */
export const STOCK_OUT_OPERATION_REQUIRED_FIELDS = Object.freeze([
  "operationId",
  "status",
  "movementId",
  "productId",
  "productName",
  "productSku",
  "quantityReleased",
  "previousQuantity",
  "newQuantity",
  "unitCost",
  "totalCost",
  "destination",
  "referenceNumber",
  "dateReleased",
  "dateReleasedKey",
  "reason",
  "remarks",
  "releasedBy",
  "releasedByName",
  "createdBy",
  "createdAt",
]);

export const STOCK_OUT_OPERATION_STATUSES = Object.freeze({
  COMPLETED: "COMPLETED",
});

export function normalizeStockOutText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeStockOutReference(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function isValidStockOutReason(value) {
  return Object.values(STOCK_OUT_REASONS).includes(value);
}

export function isStockOutDestinationRequired(reason) {
  return STOCK_OUT_REASONS_REQUIRING_DESTINATION.includes(reason);
}

export function isValidStockOutQuantity(value) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= STOCK_OUT_LIMITS.MAX_QUANTITY
  );
}

export function isValidStockOutUnitCost(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= STOCK_OUT_LIMITS.MAX_UNIT_COST
  );
}

export function isValidStockOutDestination(value, reason) {
  const destination = normalizeStockOutText(value);

  if (destination.length > STOCK_OUT_LIMITS.DESTINATION_MAX_LENGTH) {
    return false;
  }

  if (isStockOutDestinationRequired(reason)) {
    return destination.length >= 1;
  }

  return true;
}

export function isValidStockOutReference(value) {
  return (
    normalizeStockOutReference(value).length <=
    STOCK_OUT_LIMITS.REFERENCE_MAX_LENGTH
  );
}

export function isValidStockOutRemarks(value) {
  return (
    String(value ?? "").trim().length <= STOCK_OUT_LIMITS.REMARKS_MAX_LENGTH
  );
}

/**
 * Validates YYYY-MM-DD.
 */
export function isValidStockOutDate(value) {
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

export function getTodayStockOutDate() {
  const currentDate = new Date();

  const timezoneOffset = currentDate.getTimezoneOffset() * 60 * 1000;

  return new Date(currentDate.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export function isValidStockOutDateNotFuture(value) {
  return isValidStockOutDate(value) && value <= getTodayStockOutDate();
}

export function roundStockOutMoney(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

export function calculateStockOutTotalCost(quantity, unitCost) {
  const numericQuantity = Number(quantity);
  const numericUnitCost = Number(unitCost);

  if (
    !isValidStockOutQuantity(numericQuantity) ||
    !isValidStockOutUnitCost(numericUnitCost)
  ) {
    return 0;
  }

  const total = numericQuantity * numericUnitCost;

  if (!Number.isFinite(total) || total > STOCK_OUT_LIMITS.MAX_TOTAL_VALUE) {
    return 0;
  }

  return roundStockOutMoney(total);
}

export function calculateStockOutBalance(previousQuantity, quantityReleased) {
  const previous = Number(previousQuantity);

  const released = Number(quantityReleased);

  if (
    !Number.isInteger(previous) ||
    previous < 0 ||
    !isValidStockOutQuantity(released) ||
    released > previous
  ) {
    return null;
  }

  return previous - released;
}

export function isStockOutQuantityAvailable(
  availableQuantity,
  quantityReleased,
) {
  return calculateStockOutBalance(availableQuantity, quantityReleased) !== null;
}

export function createStockOutOperationId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();

  const randomPart = randomUuid
    ? randomUuid.replaceAll("-", "")
    : `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;

  return `stockout_${randomPart}`.slice(
    0,
    STOCK_OUT_LIMITS.OPERATION_ID_MAX_LENGTH,
  );
}

export function isValidStockOutOperationId(value) {
  const operationId = String(value ?? "").trim();

  return (
    operationId.length >= 16 &&
    operationId.length <= STOCK_OUT_LIMITS.OPERATION_ID_MAX_LENGTH &&
    /^stockout_[A-Za-z0-9_-]+$/.test(operationId)
  );
}

/**
 * Creates a fresh Stock-Out form.
 *
 * A new operation ID is generated each time the
 * form is reset so a repeated submission can be
 * detected safely in Phase 5B.
 */
export function createEmptyStockOutForm(productId = "") {
  return {
    operationId: createStockOutOperationId(),

    productId: String(productId ?? "").trim(),

    quantityReleased: "",

    reason: STOCK_OUT_REASONS.MANUAL_STOCK_OUT,

    destination: "",

    referenceNumber: "",

    dateReleased: getTodayStockOutDate(),

    remarks: "",
  };
}

/**
 * Planned permanent Stock-Out movement shape:
 *
 * {
 *   movementId,
 *   operationId,
 *   movementType: STOCK_MOVEMENT_TYPES.OUT,
 *   reason,
 *   productId,
 *   productName,
 *   productSku,
 *   quantity,
 *   previousQuantity,
 *   newQuantity,
 *   unitCost,
 *   totalCost,
 *   destination,
 *   referenceNumber,
 *   dateReleased,
 *   releasedBy,
 *   releasedByName,
 *   createdBy,
 *   createdAt
 * }
 */
export const STOCK_OUT_MOVEMENT_TYPE = STOCK_MOVEMENT_TYPES.OUT;
