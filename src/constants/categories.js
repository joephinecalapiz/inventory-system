export const CATEGORY_STATUSES =
  Object.freeze({
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
  });

export const CATEGORY_STATUS_LABELS =
  Object.freeze({
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  });

export const CATEGORY_LIMITS =
  Object.freeze({
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    CODE_MIN_LENGTH: 2,
    CODE_MAX_LENGTH: 50,
    DESCRIPTION_MAX_LENGTH: 500,
  });

/**
 * Cleans a category name and stores it
 * consistently in uppercase.
 *
 * Example:
 * "  Water   Meters  "
 * becomes:
 * "WATER METERS"
 */
export function normalizeCategoryName(
  value,
) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Generates the permanent category code.
 *
 * Examples:
 * WATER METERS
 * becomes:
 * WATER_METERS
 *
 * OIL & LUBRICANTS
 * becomes:
 * OIL_AND_LUBRICANTS
 */
export function createCategoryCode(
  value,
) {
  return normalizeCategoryName(value)
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(
      0,
      CATEGORY_LIMITS.CODE_MAX_LENGTH,
    );
}

/**
 * Barcode prefixes must contain exactly
 * two digits.
 */
export function normalizeBarcodePrefix(
  value,
) {
  return String(value ?? "").trim();
}

export function isValidBarcodePrefix(
  value,
) {
  return /^\d{2}$/.test(
    normalizeBarcodePrefix(value),
  );
}

export function isValidCategoryStatus(
  status,
) {
  return Object.values(
    CATEGORY_STATUSES,
  ).includes(status);
}