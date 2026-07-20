export const STOCK_MOVEMENT_TYPES = Object.freeze({
  IN: "IN",
  OUT: "OUT",
});

export const STOCK_IN_REASONS = Object.freeze({
  MANUAL_STOCK_IN: "MANUAL_STOCK_IN",

  /*
   * Reserved for Phase 4:
   * Purchase Orders and Goods Receiving.
   */
  PURCHASE_RECEIPT: "PURCHASE_RECEIPT",

  RETURNED_STOCK: "RETURNED_STOCK",

  OPENING_BALANCE: "OPENING_BALANCE",

  OTHER: "OTHER",
});

export const STOCK_IN_REASON_LABELS = Object.freeze({
  MANUAL_STOCK_IN: "Manual Stock In",

  PURCHASE_RECEIPT: "Purchase Receipt",

  RETURNED_STOCK: "Returned Stock",

  OPENING_BALANCE: "Opening Balance",

  OTHER: "Other",
});

/*
 * These are the reasons available on the Phase 3
 * manual Stock-In form.
 *
 * PURCHASE_RECEIPT is intentionally excluded because
 * formal purchase receiving belongs to Phase 4.
 */
export const MANUAL_STOCK_IN_REASON_OPTIONS = Object.freeze([
  Object.freeze({
    value: STOCK_IN_REASONS.MANUAL_STOCK_IN,

    label: STOCK_IN_REASON_LABELS.MANUAL_STOCK_IN,
  }),

  Object.freeze({
    value: STOCK_IN_REASONS.RETURNED_STOCK,

    label: STOCK_IN_REASON_LABELS.RETURNED_STOCK,
  }),

  Object.freeze({
    value: STOCK_IN_REASONS.OPENING_BALANCE,

    label: STOCK_IN_REASON_LABELS.OPENING_BALANCE,
  }),

  Object.freeze({
    value: STOCK_IN_REASONS.OTHER,

    label: STOCK_IN_REASON_LABELS.OTHER,
  }),
]);

export const STOCK_IN_LIMITS = Object.freeze({
  MAX_QUANTITY: 999999999,

  MAX_UNIT_COST: 999999999,

  MAX_TOTAL_VALUE: 999999999999.99,

  SOURCE_MAX_LENGTH: 150,

  REFERENCE_MAX_LENGTH: 100,

  REMARKS_MAX_LENGTH: 500,
});

/*
 * Fields that every Stock-In movement document
 * must contain.
 */
export const STOCK_IN_REQUIRED_FIELDS = Object.freeze([
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

  "source",
  "referenceNumber",
  "dateReceived",

  "receivedBy",
  "receivedByName",

  "createdBy",
  "createdAt",
]);

/*
 * Snapshot fields added when the selected product
 * contains them.
 */
export const STOCK_IN_OPTIONAL_FIELDS = Object.freeze([
  "barcode",

  "category",
  "categoryCode",

  "unitCode",
  "unitName",
  "unitAbbreviation",

  "remarks",
]);

/**
 * Removes unnecessary spaces from regular
 * Stock-In text fields.
 */
export function normalizeStockInText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Reference numbers are stored in uppercase
 * for consistent searching.
 *
 * Examples:
 * DR-2026-001
 * INV/2026/145
 * OR 00981
 */
export function normalizeStockInReference(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function isValidStockMovementType(value) {
  return Object.values(STOCK_MOVEMENT_TYPES).includes(value);
}

export function isValidStockInReason(value) {
  return Object.values(STOCK_IN_REASONS).includes(value);
}

/**
 * Stock quantities must be positive whole numbers.
 *
 * Examples:
 * 1
 * 10
 * 250
 *
 * Invalid:
 * 0
 * -5
 * 2.5
 */
export function isValidStockInQuantity(value) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= STOCK_IN_LIMITS.MAX_QUANTITY
  );
}

/**
 * A unit cost of zero is allowed for returned,
 * donated, or opening-balance stock.
 */
export function isValidStockInUnitCost(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= STOCK_IN_LIMITS.MAX_UNIT_COST
  );
}

export function isValidStockInSource(value) {
  const source = normalizeStockInText(value);

  return (
    source.length >= 1 && source.length <= STOCK_IN_LIMITS.SOURCE_MAX_LENGTH
  );
}

export function isValidStockInReference(value) {
  const referenceNumber = normalizeStockInReference(value);

  /*
   * Reference number may be empty for opening
   * balances or other receipts without documents.
   */
  return referenceNumber.length <= STOCK_IN_LIMITS.REFERENCE_MAX_LENGTH;
}

export function isValidStockInRemarks(value) {
  return (
    String(value ?? "").trim().length <= STOCK_IN_LIMITS.REMARKS_MAX_LENGTH
  );
}

/**
 * Validates an HTML date-input value.
 *
 * Expected format:
 * YYYY-MM-DD
 */
export function isValidStockInDate(value) {
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

/**
 * Returns today's date using the user's local
 * timezone in YYYY-MM-DD format.
 */
export function getTodayInputDate() {
  const currentDate = new Date();

  const timezoneOffset = currentDate.getTimezoneOffset() * 60 * 1000;

  return new Date(currentDate.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

/**
 * Calculates and rounds the total receipt value
 * to two decimal places.
 */
export function calculateStockInTotal(quantity, unitCost) {
  const numericQuantity = Number(quantity);

  const numericUnitCost = Number(unitCost);

  if (
    !isValidStockInQuantity(numericQuantity) ||
    !isValidStockInUnitCost(numericUnitCost)
  ) {
    return 0;
  }

  const total = numericQuantity * numericUnitCost;

  if (total > STOCK_IN_LIMITS.MAX_TOTAL_VALUE) {
    return 0;
  }

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/**
 * Creates a fresh Stock-In form object.
 *
 * Use this instead of sharing one mutable
 * EMPTY_FORM object between components.
 */
export function createEmptyStockInForm(productId = "") {
  return {
    productId: String(productId ?? "").trim(),

    quantityReceived: "",

    unitCost: "",

    source: "",

    referenceNumber: "",

    dateReceived: getTodayInputDate(),

    reason: STOCK_IN_REASONS.MANUAL_STOCK_IN,

    remarks: "",
  };
}
