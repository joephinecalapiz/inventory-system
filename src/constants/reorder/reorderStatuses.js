export const REORDER_STATUSES = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  PURCHASE_ORDER_CREATED: "PURCHASE_ORDER_CREATED",
  ORDERED: "ORDERED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
});

export const REORDER_STATUS_LABELS = Object.freeze({
  [REORDER_STATUSES.NOT_REQUIRED]: "Not Required",
  [REORDER_STATUSES.LOW_STOCK]: "Low Stock",
  [REORDER_STATUSES.OUT_OF_STOCK]: "Out of Stock",
  [REORDER_STATUSES.PURCHASE_ORDER_CREATED]:
    "Purchase Order Created",
  [REORDER_STATUSES.ORDERED]: "Ordered",
  [REORDER_STATUSES.PARTIALLY_RECEIVED]:
    "Partially Received",
  [REORDER_STATUSES.RECEIVED]: "Received",
  [REORDER_STATUSES.CANCELLED]: "Cancelled",
});

export const ACTIVE_REORDER_STATUSES = Object.freeze([
  REORDER_STATUSES.LOW_STOCK,
  REORDER_STATUSES.OUT_OF_STOCK,
  REORDER_STATUSES.PURCHASE_ORDER_CREATED,
  REORDER_STATUSES.ORDERED,
  REORDER_STATUSES.PARTIALLY_RECEIVED,
]);

export const CLOSED_REORDER_STATUSES = Object.freeze([
  REORDER_STATUSES.NOT_REQUIRED,
  REORDER_STATUSES.RECEIVED,
  REORDER_STATUSES.CANCELLED,
]);

export const REORDER_STATUS_OPTIONS = Object.freeze(
  Object.values(REORDER_STATUSES).map((value) =>
    Object.freeze({
      value,
      label: REORDER_STATUS_LABELS[value],
    }),
  ),
);

export function isValidReorderStatus(value) {
  return Object.values(REORDER_STATUSES).includes(value);
}

export function isActiveReorderStatus(value) {
  return ACTIVE_REORDER_STATUSES.includes(value);
}

export function getReorderStatusLabel(value) {
  return REORDER_STATUS_LABELS[value] ?? value ?? "Unknown";
}
