import {
  REORDER_SORT_DIRECTIONS,
  REORDER_SORT_FIELDS,
} from "./reorderRequirements.js";

export const REORDER_STOCK_FILTERS = Object.freeze({
  ALL: "ALL",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
});

export const REORDER_SUPPLIER_FILTERS = Object.freeze({
  ALL: "ALL",
  ASSIGNED: "ASSIGNED",
  UNASSIGNED: "UNASSIGNED",
});

export const REORDER_PURCHASE_ORDER_FILTERS = Object.freeze({
  ALL: "ALL",
  WITHOUT_PURCHASE_ORDER: "WITHOUT_PURCHASE_ORDER",
  WITH_PURCHASE_ORDER: "WITH_PURCHASE_ORDER",
});

export const DEFAULT_REORDER_FILTERS = Object.freeze({
  search: "",
  categoryCode: "",
  unitCode: "",
  supplierId: "",
  stockStatus: REORDER_STOCK_FILTERS.ALL,
  reorderStatus: "",
  supplierAssignment: REORDER_SUPPLIER_FILTERS.ALL,
  purchaseOrderState: REORDER_PURCHASE_ORDER_FILTERS.ALL,
  sortBy: REORDER_SORT_FIELDS.PRODUCT_NAME,
  sortDirection: REORDER_SORT_DIRECTIONS.ASC,
});

export function createDefaultReorderFilters(overrides = {}) {
  return {
    ...DEFAULT_REORDER_FILTERS,
    ...overrides,
  };
}

export function hasActiveReorderFilters(filters = {}) {
  return Object.entries(DEFAULT_REORDER_FILTERS).some(
    ([key, defaultValue]) =>
      String(filters[key] ?? defaultValue) !== String(defaultValue),
  );
}
