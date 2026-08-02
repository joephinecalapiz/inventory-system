export const PRODUCT_STOCK_STATUSES = Object.freeze({
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
});

export const PRODUCT_STOCK_STATUS_LABELS = Object.freeze({
  [PRODUCT_STOCK_STATUSES.IN_STOCK]: "In Stock",
  [PRODUCT_STOCK_STATUSES.LOW_STOCK]: "Low Stock",
  [PRODUCT_STOCK_STATUSES.OUT_OF_STOCK]: "Out of Stock",
});

export const PRODUCT_STOCK_STATUS_OPTIONS = Object.freeze(
  Object.values(PRODUCT_STOCK_STATUSES).map((value) =>
    Object.freeze({
      value,
      label: PRODUCT_STOCK_STATUS_LABELS[value],
    }),
  ),
);

function normalizeWholeNumber(value, fieldName) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new Error(`${fieldName} must be a non-negative whole number.`);
  }

  return numericValue;
}

export function calculateProductStockStatus(quantity, reorderLevel) {
  const normalizedQuantity = normalizeWholeNumber(quantity, "Quantity");

  const normalizedReorderLevel = normalizeWholeNumber(
    reorderLevel,
    "Reorder level",
  );

  if (normalizedQuantity === 0) {
    return PRODUCT_STOCK_STATUSES.OUT_OF_STOCK;
  }

  if (normalizedQuantity <= normalizedReorderLevel) {
    return PRODUCT_STOCK_STATUSES.LOW_STOCK;
  }

  return PRODUCT_STOCK_STATUSES.IN_STOCK;
}

export function isValidProductStockStatus(value) {
  return Object.values(PRODUCT_STOCK_STATUSES).includes(value);
}

export function getProductStockStatusLabel(value) {
  return PRODUCT_STOCK_STATUS_LABELS[value] ?? value ?? "Unknown";
}

export function resolveProductStockStatus(product = {}) {
  return calculateProductStockStatus(
    Number(product.quantity ?? 0),
    Number(product.reorderLevel ?? 0),
  );
}

export function hasCorrectProductStockStatus(product = {}) {
  try {
    return (
      isValidProductStockStatus(product.stockStatus) &&
      product.stockStatus === resolveProductStockStatus(product)
    );
  } catch {
    return false;
  }
}
