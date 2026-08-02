import { REORDER_REQUIREMENTS } from "./reorderRequirements.js";

import { REORDER_STATUSES } from "./reorderStatuses.js";

function toWholeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  if (
    !Number.isFinite(numericValue) ||
    !Number.isInteger(numericValue) ||
    numericValue < 0
  ) {
    return fallback;
  }

  return numericValue;
}

export function calculateSuggestedReorderQuantity({
  currentQuantity,
  reorderLevel,
  targetMultiplier = REORDER_REQUIREMENTS.DEFAULT_TARGET_MULTIPLIER,
  minimumQuantity = REORDER_REQUIREMENTS.MINIMUM_SUGGESTED_QUANTITY,
  maximumQuantity = REORDER_REQUIREMENTS.MAXIMUM_SUGGESTED_QUANTITY,
}) {
  const quantity = toWholeNumber(currentQuantity, 0);
  const level = toWholeNumber(reorderLevel, 0);

  const multiplier = Number(targetMultiplier);

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("Target multiplier must be greater than zero.");
  }

  const minimum = toWholeNumber(minimumQuantity, 1);
  const maximum = toWholeNumber(maximumQuantity, 999999999);

  if (maximum < minimum) {
    throw new Error(
      "Maximum suggested quantity cannot be lower than minimum quantity.",
    );
  }

  const targetStock = Math.ceil(level * multiplier);

  const suggestedQuantity = Math.max(targetStock - quantity, minimum);

  return Math.min(suggestedQuantity, maximum);
}

export function resolveReorderStatus({
  currentQuantity,
  reorderLevel,
  purchaseOrderStatus = "",
  receivedQuantity = 0,
  orderedQuantity = 0,
  cancelled = false,
}) {
  if (cancelled) {
    return REORDER_STATUSES.CANCELLED;
  }

  const quantity = toWholeNumber(currentQuantity, 0);
  const level = toWholeNumber(reorderLevel, 0);
  const received = toWholeNumber(receivedQuantity, 0);
  const ordered = toWholeNumber(orderedQuantity, 0);

  const normalizedPurchaseOrderStatus = String(purchaseOrderStatus ?? "")
    .trim()
    .toUpperCase();

  if (normalizedPurchaseOrderStatus === "RECEIVED") {
    return REORDER_STATUSES.RECEIVED;
  }

  if (
    normalizedPurchaseOrderStatus === "PARTIALLY_RECEIVED" ||
    (ordered > 0 && received > 0 && received < ordered)
  ) {
    return REORDER_STATUSES.PARTIALLY_RECEIVED;
  }

  if (
    normalizedPurchaseOrderStatus === "ORDERED" ||
    normalizedPurchaseOrderStatus === "APPROVED"
  ) {
    return REORDER_STATUSES.ORDERED;
  }

  if (
    normalizedPurchaseOrderStatus === "PURCHASE_ORDER_CREATED" ||
    normalizedPurchaseOrderStatus === "DRAFT" ||
    normalizedPurchaseOrderStatus === "PENDING"
  ) {
    return REORDER_STATUSES.PURCHASE_ORDER_CREATED;
  }

  if (quantity === 0) {
    return REORDER_STATUSES.OUT_OF_STOCK;
  }

  if (quantity <= level) {
    return REORDER_STATUSES.LOW_STOCK;
  }

  return REORDER_STATUSES.NOT_REQUIRED;
}

export function shouldCreateReorder(product = {}) {
  const currentQuantity = toWholeNumber(product.quantity, 0);
  const reorderLevel = toWholeNumber(product.reorderLevel, 0);

  const status = resolveReorderStatus({
    currentQuantity,
    reorderLevel,
  });

  return (
    status === REORDER_STATUSES.LOW_STOCK ||
    status === REORDER_STATUSES.OUT_OF_STOCK
  );
}

export function calculateEstimatedReorderCost({ suggestedQuantity, unitCost }) {
  const quantity = toWholeNumber(suggestedQuantity, 0);
  const cost = Number(unitCost);

  if (!Number.isFinite(cost) || cost < 0) {
    return null;
  }

  return Math.round((quantity * cost + Number.EPSILON) * 100) / 100;
}
