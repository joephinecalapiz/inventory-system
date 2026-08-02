export const REORDER_COLLECTIONS = Object.freeze({
  PRODUCTS: "products",
  SUPPLIERS: "suppliers",
  PURCHASE_ORDERS: "purchaseOrders",
  REORDER_RECORDS: "reorderRecords",
});

export const REORDER_REQUIREMENTS = Object.freeze({
  REQUIRE_ACTIVE_PRODUCT: true,
  REQUIRE_REORDER_LEVEL: true,
  ALLOW_ZERO_REORDER_LEVEL: true,
  REQUIRE_SUPPLIER_FOR_PURCHASE_ORDER: true,
  ALLOW_MANUAL_SUGGESTED_QUANTITY_OVERRIDE: true,
  PREVENT_DUPLICATE_OPEN_REORDER: true,
  USE_PRODUCT_STOCK_STATUS: true,
  DEFAULT_TARGET_MULTIPLIER: 2,
  MINIMUM_SUGGESTED_QUANTITY: 1,
  MAXIMUM_SUGGESTED_QUANTITY: 999999999,
});

export const REORDER_REQUIRED_PRODUCT_FIELDS = Object.freeze([
  "name",
  "sku",
  "quantity",
  "reorderLevel",
  "stockStatus",
  "status",
]);

export const REORDER_OPTIONAL_PRODUCT_FIELDS = Object.freeze([
  "barcode",
  "category",
  "categoryCode",
  "unitCode",
  "unitName",
  "unitAbbreviation",
  "preferredSupplierId",
  "preferredSupplierName",
  "lastPurchaseCost",
  "costPrice",
  "lastMovementAt",
]);

export const REORDER_SORT_FIELDS = Object.freeze({
  PRODUCT_NAME: "productName",
  CURRENT_QUANTITY: "currentQuantity",
  REORDER_LEVEL: "reorderLevel",
  SUGGESTED_QUANTITY: "suggestedQuantity",
  LAST_PURCHASE_COST: "lastPurchaseCost",
  STATUS: "status",
  UPDATED_AT: "updatedAt",
});

export const REORDER_SORT_DIRECTIONS = Object.freeze({
  ASC: "asc",
  DESC: "desc",
});
