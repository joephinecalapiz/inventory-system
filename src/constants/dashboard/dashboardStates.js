export const DASHBOARD_DATA_STATES = Object.freeze({
  IDLE: "IDLE",
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  EMPTY: "EMPTY",
  PARTIAL: "PARTIAL",
  ERROR: "ERROR",
});

export const DASHBOARD_ERROR_CODES = Object.freeze({
  PRODUCTS_FAILED: "PRODUCTS_FAILED",
  TRANSACTIONS_FAILED: "TRANSACTIONS_FAILED",
  PURCHASE_ORDERS_FAILED: "PURCHASE_ORDERS_FAILED",
  GOODS_RECEIPTS_FAILED: "GOODS_RECEIPTS_FAILED",
  ADJUSTMENTS_FAILED: "ADJUSTMENTS_FAILED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  UNKNOWN: "UNKNOWN",
});

export const DASHBOARD_ERROR_MESSAGES = Object.freeze({
  [DASHBOARD_ERROR_CODES.PRODUCTS_FAILED]: "Unable to load product analytics.",
  [DASHBOARD_ERROR_CODES.TRANSACTIONS_FAILED]:
    "Unable to load stock movement analytics.",
  [DASHBOARD_ERROR_CODES.PURCHASE_ORDERS_FAILED]:
    "Unable to load purchase-order analytics.",
  [DASHBOARD_ERROR_CODES.GOODS_RECEIPTS_FAILED]:
    "Unable to load goods-receipt analytics.",
  [DASHBOARD_ERROR_CODES.ADJUSTMENTS_FAILED]:
    "Unable to load stock-adjustment analytics.",
  [DASHBOARD_ERROR_CODES.PERMISSION_DENIED]:
    "You do not have permission to view this dashboard data.",
  [DASHBOARD_ERROR_CODES.UNKNOWN]: "Unable to load dashboard analytics.",
});

export const EMPTY_DASHBOARD_SUMMARY = Object.freeze({
  totalActiveProducts: 0,
  totalStockQuantity: 0,
  inventoryValue: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  stockReceivedThisMonth: 0,
  stockReleasedThisMonth: 0,
  pendingPurchaseOrders: 0,
  pendingGoodsReceipts: 0,
  pendingStockAdjustments: 0,
});
