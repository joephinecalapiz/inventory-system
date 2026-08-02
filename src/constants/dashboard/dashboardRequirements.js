export const DASHBOARD_REQUIREMENTS = Object.freeze({
  USE_INVENTORY_TRANSACTIONS: true,
  USE_PRODUCT_STOCK_STATUS: true,
  VALUATION_COST_FIELD: "costPrice",
  FALLBACK_COST_FIELD: "unitCost",
  RECENT_MOVEMENT_DATE_FIELD: "transactionDate",
  DEFAULT_CURRENCY: "PHP",
  DEFAULT_LOCALE: "en-PH",
});

export const DASHBOARD_COLLECTIONS = Object.freeze({
  PRODUCTS: "products",
  INVENTORY_TRANSACTIONS: "inventoryTransactions",
  PURCHASE_ORDERS: "purchaseOrders",
  GOODS_RECEIPTS: "goodsReceipts",
  STOCK_ADJUSTMENTS: "stockAdjustmentRequests",
});

export const DASHBOARD_PENDING_STATUS_GROUPS = Object.freeze({
  PURCHASE_ORDERS: Object.freeze([
    "DRAFT",
    "PENDING",
    "APPROVED",
    "PARTIALLY_RECEIVED",
  ]),
  GOODS_RECEIPTS: Object.freeze(["DRAFT", "PENDING", "PARTIALLY_RECEIVED"]),
  STOCK_ADJUSTMENTS: Object.freeze(["PENDING", "PENDING_REVIEW"]),
});
