export const PRODUCT_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const PRODUCT_STATUS_LABELS = Object.freeze({
  ACTIVE: "Active",
  INACTIVE: "Inactive",
});

export const PRODUCT_LIMITS = Object.freeze({
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 150,

  SKU_MIN_LENGTH: 2,
  SKU_MAX_LENGTH: 50,

  DESCRIPTION_MAX_LENGTH: 500,

  SOURCE_ID_MAX_LENGTH: 100,

  MAX_MONEY_VALUE: 999999999,
});

/**
 * Cleans unnecessary spaces while preserving
 * the intended product-name capitalization.
 */
export function normalizeProductName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes existing product SKU values.
 *
 * Special characters such as #, &, /, period,
 * underscore, space, and hyphen remain supported.
 */
export function normalizeProductSku(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/**
 * Supports SKU values such as:
 *
 * WAME
 * BA1-112
 * BA#22
 * BO&123
 */
export function isValidProductSku(value) {
  const sku = normalizeProductSku(value);

  return /^[A-Z0-9][A-Z0-9#&._/ -]{1,49}$/.test(
    sku,
  );
}

export function isValidProductStatus(status) {
  return Object.values(
    PRODUCT_STATUSES,
  ).includes(status);
}

export function isValidMoneyValue(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= PRODUCT_LIMITS.MAX_MONEY_VALUE
  );
}

export function isValidWholeNumber(value) {
  return (
    Number.isInteger(value) &&
    value >= 0
  );
}

/**
 * The source ID identifies one exact record from
 * the product master list.
 *
 * Example:
 * sheet-row-12
 */
export function normalizeSourceProductId(value) {
  return String(value ?? "").trim();
}

export function isValidSourceProductId(value) {
  const sourceProductId =
    normalizeSourceProductId(value);

  return (
    sourceProductId.length >= 1 &&
    sourceProductId.length <=
      PRODUCT_LIMITS.SOURCE_ID_MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(
      sourceProductId,
    )
  );
}