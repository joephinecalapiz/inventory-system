export const PRODUCT_SNAPSHOT_FIELDS = Object.freeze([
  "productId",
  "sourceProductId",
  "productName",
  "sku",
  "barcode",
  "category",
  "categoryCode",
  "unitCode",
  "unitName",
  "unitAbbreviation",
]);

export const USER_SNAPSHOT_FIELDS = Object.freeze([
  "performedBy",
  "performedByName",
  "performedByEmail",
  "performedByRole",
]);

export const SUPPLIER_SNAPSHOT_FIELDS = Object.freeze([
  "supplierId",
  "supplierName",
]);

export const APPROVAL_SNAPSHOT_FIELDS = Object.freeze([
  "approvedBy",
  "approvedByName",
  "approvedByRole",
]);

export const INVENTORY_TRANSACTION_SNAPSHOT_FIELDS = Object.freeze([
  ...PRODUCT_SNAPSHOT_FIELDS,
  ...USER_SNAPSHOT_FIELDS,
  ...SUPPLIER_SNAPSHOT_FIELDS,
  ...APPROVAL_SNAPSHOT_FIELDS,
]);

export const PRODUCT_SNAPSHOT_SOURCE_ALIASES = Object.freeze({
  productId: ["id", "productId"],
  sourceProductId: ["sourceProductId"],
  productName: ["name", "productName"],
  sku: ["sku", "productSku"],
  barcode: ["barcode"],
  category: ["category", "categoryName"],
  categoryCode: ["categoryCode", "categoryId"],
  unitCode: ["unitCode", "unitId"],
  unitName: ["unitName"],
  unitAbbreviation: ["unitAbbreviation"],
});

export const USER_SNAPSHOT_SOURCE_ALIASES = Object.freeze({
  performedBy: ["uid", "id", "userId", "performedBy"],
  performedByName: [
    "displayName",
    "name",
    "performedByName",
    "receivedByName",
    "releasedByName",
  ],
  performedByEmail: ["email", "performedByEmail"],
  performedByRole: ["role", "performedByRole"],
});
