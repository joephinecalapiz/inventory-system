export const INVENTORY_TRANSACTION_COLLECTION = "inventoryTransactions";

export const INVENTORY_TRANSACTION_SCHEMA_VERSION = 1;

export const INVENTORY_TRANSACTION_REQUIRED_FIELDS = Object.freeze([
  "referenceNumber",
  "transactionType",
  "productId",
  "productName",
  "sku",
  "quantityBefore",
  "quantityChanged",
  "quantityAfter",
  "quantityIn",
  "quantityOut",
  "performedBy",
  "performedByName",
  "performedByRole",
  "transactionDate",
  "createdAt",
]);

export const INVENTORY_TRANSACTION_IMMUTABLE_FIELDS = Object.freeze([
  "referenceNumber",
  "transactionType",
  "productId",
  "sourceProductId",
  "quantityBefore",
  "quantityChanged",
  "quantityAfter",
  "quantityIn",
  "quantityOut",
  "relatedDocumentId",
  "relatedDocumentType",
  "performedBy",
  "createdAt",
]);

export const INVENTORY_TRANSACTION_OPTIONAL_FIELDS = Object.freeze([
  "sourceProductId",
  "barcode",
  "category",
  "categoryCode",
  "unitCode",
  "unitName",
  "unitAbbreviation",
  "unitCost",
  "totalCost",
  "supplierId",
  "supplierName",
  "reason",
  "remarks",
  "approvedBy",
  "approvedByName",
  "approvedByRole",
  "updatedAt",
  "metadata",
]);
