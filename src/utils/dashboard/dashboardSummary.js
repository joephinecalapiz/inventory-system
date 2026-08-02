import {
  DASHBOARD_PENDING_STATUS_GROUPS,
  EMPTY_DASHBOARD_SUMMARY,
} from "../../constants/dashboard/index.js";

import { INVENTORY_TRANSACTION_TYPES } from "../../constants/reports/index.js";

import { PRODUCT_STOCK_STATUSES } from "../../constants/stockStatus.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUppercase(value) {
  return normalizeText(value).toUpperCase();
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function isSameMonth(value, referenceDate) {
  const date = toDate(value);

  if (!date) {
    return false;
  }

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

function isActiveProduct(product = {}) {
  if (typeof product.isActive === "boolean") {
    return product.isActive;
  }

  const status = normalizeUppercase(product.status);

  if (!status) {
    return true;
  }

  return status === "ACTIVE";
}

function getProductCost(product = {}) {
  if (
    product.costPrice !== null &&
    product.costPrice !== undefined &&
    Number.isFinite(Number(product.costPrice))
  ) {
    return Math.max(Number(product.costPrice), 0);
  }

  if (
    product.unitCost !== null &&
    product.unitCost !== undefined &&
    Number.isFinite(Number(product.unitCost))
  ) {
    return Math.max(Number(product.unitCost), 0);
  }

  return 0;
}

function getStockStatus(product = {}) {
  const storedStatus = normalizeUppercase(product.stockStatus);

  if (Object.values(PRODUCT_STOCK_STATUSES).includes(storedStatus)) {
    return storedStatus;
  }

  const quantity = Math.max(Math.trunc(toFiniteNumber(product.quantity, 0)), 0);

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

function isPendingStatus(status, allowedStatuses) {
  return allowedStatuses.includes(normalizeUppercase(status));
}

function getTransactionDate(transaction = {}) {
  return (
    transaction.transactionDate ??
    transaction.createdAt ??
    transaction.updatedAt ??
    null
  );
}

function sumMonthlyTransactionQuantity(
  transactions,
  transactionTypes,
  referenceDate,
) {
  return transactions.reduce((total, transaction) => {
    if (
      !transactionTypes.includes(
        normalizeUppercase(transaction.transactionType),
      )
    ) {
      return total;
    }

    if (!isSameMonth(getTransactionDate(transaction), referenceDate)) {
      return total;
    }

    return total + Math.abs(toFiniteNumber(transaction.quantityChanged, 0));
  }, 0);
}

export function buildDashboardSummary({
  products = [],
  inventoryTransactions = [],
  purchaseOrders = [],
  goodsReceipts = [],
  stockAdjustments = [],
  referenceDate = new Date(),
} = {}) {
  const normalizedProducts = Array.isArray(products) ? products : [];

  const normalizedTransactions = Array.isArray(inventoryTransactions)
    ? inventoryTransactions
    : [];

  const activeProducts = normalizedProducts.filter(isActiveProduct);

  const totalStockQuantity = activeProducts.reduce(
    (total, product) =>
      total + Math.max(toFiniteNumber(product.quantity, 0), 0),
    0,
  );

  const inventoryValue = activeProducts.reduce(
    (total, product) =>
      total +
      Math.max(toFiniteNumber(product.quantity, 0), 0) *
        getProductCost(product),
    0,
  );

  const lowStockProducts = activeProducts.filter(
    (product) => getStockStatus(product) === PRODUCT_STOCK_STATUSES.LOW_STOCK,
  ).length;

  const outOfStockProducts = activeProducts.filter(
    (product) =>
      getStockStatus(product) === PRODUCT_STOCK_STATUSES.OUT_OF_STOCK,
  ).length;

  const inboundTypes = [
    INVENTORY_TRANSACTION_TYPES.OPENING_STOCK,
    INVENTORY_TRANSACTION_TYPES.STOCK_IN,
    INVENTORY_TRANSACTION_TYPES.GOODS_RECEIPT,
    INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_INCREASE,
    INVENTORY_TRANSACTION_TYPES.RETURN_IN,
  ];

  const outboundTypes = [
    INVENTORY_TRANSACTION_TYPES.STOCK_OUT,
    INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_DECREASE,
    INVENTORY_TRANSACTION_TYPES.RETURN_OUT,
  ];

  const stockReceivedThisMonth = sumMonthlyTransactionQuantity(
    normalizedTransactions,
    inboundTypes,
    referenceDate,
  );

  const stockReleasedThisMonth = sumMonthlyTransactionQuantity(
    normalizedTransactions,
    outboundTypes,
    referenceDate,
  );

  const pendingPurchaseOrders = (
    Array.isArray(purchaseOrders) ? purchaseOrders : []
  ).filter((purchaseOrder) =>
    isPendingStatus(
      purchaseOrder.status,
      DASHBOARD_PENDING_STATUS_GROUPS.PURCHASE_ORDERS,
    ),
  ).length;

  const pendingGoodsReceipts = (
    Array.isArray(goodsReceipts) ? goodsReceipts : []
  ).filter((goodsReceipt) =>
    isPendingStatus(
      goodsReceipt.status,
      DASHBOARD_PENDING_STATUS_GROUPS.GOODS_RECEIPTS,
    ),
  ).length;

  const pendingStockAdjustments = (
    Array.isArray(stockAdjustments) ? stockAdjustments : []
  ).filter((stockAdjustment) =>
    isPendingStatus(
      stockAdjustment.status,
      DASHBOARD_PENDING_STATUS_GROUPS.STOCK_ADJUSTMENTS,
    ),
  ).length;

  return {
    ...EMPTY_DASHBOARD_SUMMARY,

    totalActiveProducts: activeProducts.length,

    totalStockQuantity,

    inventoryValue: Math.round((inventoryValue + Number.EPSILON) * 100) / 100,

    lowStockProducts,

    outOfStockProducts,

    stockReceivedThisMonth,

    stockReleasedThisMonth,

    pendingPurchaseOrders,

    pendingGoodsReceipts,

    pendingStockAdjustments,
  };
}

export function buildDashboardSummaryFromSources(
  sources = {},
  referenceDate = new Date(),
) {
  return buildDashboardSummary({
    products: sources.products,
    inventoryTransactions: sources.inventoryTransactions,
    purchaseOrders: sources.purchaseOrders,
    goodsReceipts: sources.goodsReceipts,
    stockAdjustments: sources.stockAdjustments,
    referenceDate,
  });
}
