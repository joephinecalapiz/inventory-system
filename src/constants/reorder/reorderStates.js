export const REORDER_DATA_STATES = Object.freeze({
  IDLE: "IDLE",
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  EMPTY: "EMPTY",
  ERROR: "ERROR",
});

export const REORDER_ERROR_CODES = Object.freeze({
  PRODUCTS_FAILED: "PRODUCTS_FAILED",
  SUPPLIERS_FAILED: "SUPPLIERS_FAILED",
  PURCHASE_ORDERS_FAILED: "PURCHASE_ORDERS_FAILED",
  DUPLICATE_OPEN_REORDER: "DUPLICATE_OPEN_REORDER",
  SUPPLIER_REQUIRED: "SUPPLIER_REQUIRED",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  UNKNOWN: "UNKNOWN",
});

export const REORDER_ERROR_MESSAGES = Object.freeze({
  [REORDER_ERROR_CODES.PRODUCTS_FAILED]:
    "Unable to load products requiring reorder.",
  [REORDER_ERROR_CODES.SUPPLIERS_FAILED]: "Unable to load suppliers.",
  [REORDER_ERROR_CODES.PURCHASE_ORDERS_FAILED]:
    "Unable to load linked purchase orders.",
  [REORDER_ERROR_CODES.DUPLICATE_OPEN_REORDER]:
    "This product already has an open reorder record.",
  [REORDER_ERROR_CODES.SUPPLIER_REQUIRED]:
    "Assign a supplier before creating a purchase order.",
  [REORDER_ERROR_CODES.INVALID_QUANTITY]: "Enter a valid reorder quantity.",
  [REORDER_ERROR_CODES.PERMISSION_DENIED]:
    "You do not have permission to perform this reorder action.",
  [REORDER_ERROR_CODES.UNKNOWN]: "Unable to complete the reorder request.",
});
