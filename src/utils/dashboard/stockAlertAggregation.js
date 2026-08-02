import {
  PRODUCT_STOCK_STATUSES,
} from "../../constants/stockStatus.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function isActiveProduct(product = {}) {
  if (typeof product.isActive === "boolean") {
    return product.isActive;
  }

  const status = normalizeText(product.status).toUpperCase();

  return !status || status === "ACTIVE";
}

function resolveStockStatus(product = {}) {
  const storedStatus = normalizeText(product.stockStatus).toUpperCase();

  if (
    Object.values(PRODUCT_STOCK_STATUSES).includes(storedStatus)
  ) {
    return storedStatus;
  }

  const quantity = Math.max(
    Math.trunc(toFiniteNumber(product.quantity, 0)),
    0,
  );

  const reorderLevel = Math.max(
    Math.trunc(toFiniteNumber(product.reorderLevel, 0)),
    0,
  );

  if (quantity === 0) {
    return PRODUCT_STOCK_STATUSES.OUT_OF_STOCK;
  }

  if (quantity <= reorderLevel) {
    return PRODUCT_STOCK_STATUSES.LOW_STOCK;
  }

  return PRODUCT_STOCK_STATUSES.IN_STOCK;
}

function calculateSuggestedOrderQuantity(product = {}) {
  const quantity = Math.max(
    Math.trunc(toFiniteNumber(product.quantity, 0)),
    0,
  );

  const reorderLevel = Math.max(
    Math.trunc(toFiniteNumber(product.reorderLevel, 0)),
    0,
  );

  return Math.max(reorderLevel * 2 - quantity, 1);
}

function normalizeAlertProduct(product = {}) {
  const quantity = Math.max(
    Math.trunc(toFiniteNumber(product.quantity, 0)),
    0,
  );

  const reorderLevel = Math.max(
    Math.trunc(toFiniteNumber(product.reorderLevel, 0)),
    0,
  );

  return {
    id: product.id,
    productName:
      normalizeText(product.name ?? product.productName) ||
      "Unnamed Product",
    sku: normalizeText(product.sku),
    barcode: normalizeText(product.barcode),
    category:
      normalizeText(
        product.category ??
          product.categoryName ??
          product.categoryCode,
      ) || "Uncategorized",
    unit:
      normalizeText(
        product.unitAbbreviation ??
          product.unitName ??
          product.unitCode,
      ) || "No unit",
    quantity,
    reorderLevel,
    stockStatus: resolveStockStatus(product),
    suggestedOrderQuantity:
      calculateSuggestedOrderQuantity(product),
    preferredSupplierId:
      normalizeText(product.preferredSupplierId) || null,
    preferredSupplierName:
      normalizeText(product.preferredSupplierName) || null,
    lastPurchaseCost:
      product.lastPurchaseCost === null ||
      product.lastPurchaseCost === undefined
        ? null
        : Math.max(
            toFiniteNumber(product.lastPurchaseCost, 0),
            0,
          ),
    lastMovementAt:
      product.lastMovementAt ??
      product.updatedAt ??
      product.createdAt ??
      null,
  };
}

function compareStockAlerts(first, second) {
  if (first.stockStatus !== second.stockStatus) {
    if (
      first.stockStatus ===
      PRODUCT_STOCK_STATUSES.OUT_OF_STOCK
    ) {
      return -1;
    }

    if (
      second.stockStatus ===
      PRODUCT_STOCK_STATUSES.OUT_OF_STOCK
    ) {
      return 1;
    }
  }

  const firstDeficit = first.reorderLevel - first.quantity;
  const secondDeficit = second.reorderLevel - second.quantity;

  return (
    secondDeficit - firstDeficit ||
    first.productName.localeCompare(second.productName)
  );
}

export function buildLowStockAlerts(
  products = [],
  limit = 8,
) {
  return products
    .filter(isActiveProduct)
    .map(normalizeAlertProduct)
    .filter(
      (product) =>
        product.stockStatus ===
        PRODUCT_STOCK_STATUSES.LOW_STOCK,
    )
    .sort(compareStockAlerts)
    .slice(0, Math.max(Number(limit) || 0, 0));
}

export function buildOutOfStockAlerts(
  products = [],
  limit = 8,
) {
  return products
    .filter(isActiveProduct)
    .map(normalizeAlertProduct)
    .filter(
      (product) =>
        product.stockStatus ===
        PRODUCT_STOCK_STATUSES.OUT_OF_STOCK,
    )
    .sort(compareStockAlerts)
    .slice(0, Math.max(Number(limit) || 0, 0));
}

export function buildStockAlertSummary(products = []) {
  const normalizedProducts = products
    .filter(isActiveProduct)
    .map(normalizeAlertProduct);

  const lowStock = normalizedProducts
    .filter(
      (product) =>
        product.stockStatus ===
        PRODUCT_STOCK_STATUSES.LOW_STOCK,
    )
    .sort(compareStockAlerts);

  const outOfStock = normalizedProducts
    .filter(
      (product) =>
        product.stockStatus ===
        PRODUCT_STOCK_STATUSES.OUT_OF_STOCK,
    )
    .sort(compareStockAlerts);

  const totalSuggestedOrderQuantity = [
    ...lowStock,
    ...outOfStock,
  ].reduce(
    (total, product) =>
      total + product.suggestedOrderQuantity,
    0,
  );

  return {
    lowStock,
    outOfStock,
    counts: {
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      totalAlerts: lowStock.length + outOfStock.length,
    },
    totalSuggestedOrderQuantity,
    hasAlerts: lowStock.length + outOfStock.length > 0,
  };
}

export function buildDashboardStockAlertWidgets(
  products = [],
  options = {},
) {
  const lowStockLimit = Number(options.lowStockLimit ?? 8);
  const outOfStockLimit = Number(options.outOfStockLimit ?? 8);

  const summary = buildStockAlertSummary(products);

  return {
    ...summary,
    lowStockPreview: summary.lowStock.slice(
      0,
      Math.max(lowStockLimit, 0),
    ),
    outOfStockPreview: summary.outOfStock.slice(
      0,
      Math.max(outOfStockLimit, 0),
    ),
  };
}
