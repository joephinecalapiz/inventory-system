export const PURCHASE_ORDER_STATUSES = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
});

export const PURCHASE_ORDER_STATUS_LABELS = Object.freeze({
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Fully Received",
  CANCELLED: "Cancelled",
});

export const PURCHASE_ORDER_STATUS_OPTIONS = Object.freeze(
  Object.values(PURCHASE_ORDER_STATUSES).map((value) =>
    Object.freeze({
      value,
      label: PURCHASE_ORDER_STATUS_LABELS[value],
    }),
  ),
);

/**
 * Valid Purchase Order status changes.
 */
export const PURCHASE_ORDER_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze([
    PURCHASE_ORDER_STATUSES.SUBMITTED,
    PURCHASE_ORDER_STATUSES.CANCELLED,
  ]),

  SUBMITTED: Object.freeze([
    PURCHASE_ORDER_STATUSES.APPROVED,
    PURCHASE_ORDER_STATUSES.CANCELLED,
  ]),

  APPROVED: Object.freeze([
    PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
    PURCHASE_ORDER_STATUSES.RECEIVED,
    PURCHASE_ORDER_STATUSES.CANCELLED,
  ]),

  PARTIALLY_RECEIVED: Object.freeze([PURCHASE_ORDER_STATUSES.RECEIVED]),

  RECEIVED: Object.freeze([]),

  CANCELLED: Object.freeze([]),
});

export const PURCHASE_ORDER_LIMITS = Object.freeze({
  MAX_CODE_SEQUENCE: 999999,

  SUPPLIER_NAME_MAX_LENGTH: 150,
  SUPPLIER_CODE_MAX_LENGTH: 30,
  SUPPLIER_ADDRESS_MAX_LENGTH: 300,
  SUPPLIER_TIN_MAX_LENGTH: 50,

  NOTES_MAX_LENGTH: 1000,
  CANCELLATION_REASON_MAX_LENGTH: 500,

  PRODUCT_NAME_MAX_LENGTH: 150,
  PRODUCT_SKU_MAX_LENGTH: 50,

  MAX_ITEM_COUNT: 100,

  MAX_QUANTITY: 999999999,
  MAX_UNIT_COST: 999999999,

  MAX_MONEY_VALUE: 999999999999.99,
});

/**
 * Required fields stored in:
 *
 * purchaseOrders/{purchaseOrderId}
 */
export const PURCHASE_ORDER_REQUIRED_FIELDS = Object.freeze([
  "poNumber",
  "poYear",
  "poSequence",

  "supplierId",
  "supplierCode",
  "supplierName",
  "supplierAddress",
  "supplierTin",
  "supplierPaymentTerm",
  "supplierCustomPaymentTerms",

  "orderDate",
  "orderDateKey",
  "expectedDeliveryDate",
  "expectedDeliveryDateKey",

  "status",

  "itemCount",
  "itemProductIds",
  "totalOrderedQuantity",
  "totalReceivedQuantity",

  "subtotal",
  "discountAmount",
  "taxAmount",
  "shippingAmount",
  "grandTotal",

  "hasReceivingHistory",
  "goodsReceiptCount",

  "notes",
  "revision",

  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
]);

export const PURCHASE_ORDER_WORKFLOW_OPTIONAL_FIELDS = Object.freeze([
  "submittedBy",
  "submittedByName",
  "submittedAt",
  "approvedBy",
  "approvedByName",
  "approvedAt",
  "cancellationReason",
  "cancelledBy",
  "cancelledByName",
  "cancelledAt",
]);

export const PURCHASE_ORDER_RECEIVING_OPTIONAL_FIELDS = Object.freeze([
  "lastGoodsReceiptId",
  "lastGoodsReceiptNumber",
  "lastGoodsReceiptReference",
  "lastReceivedAt",
]);

/**
 * Required fields stored in:
 *
 * purchaseOrders/{purchaseOrderId}/items/{itemId}
 */
export const PURCHASE_ORDER_ITEM_REQUIRED_FIELDS = Object.freeze([
  "purchaseOrderId",
  "poNumber",
  "poStatus",

  "productId",
  "productName",
  "productSku",
  "barcode",

  "category",
  "categoryCode",

  "unitCode",
  "unitName",
  "unitAbbreviation",

  "orderedQuantity",
  "receivedQuantity",
  "remainingQuantity",

  "unitCost",
  "lineTotal",

  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
]);

export function normalizePurchaseOrderText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePurchaseOrderNumber(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidPurchaseOrderStatus(value) {
  return Object.values(PURCHASE_ORDER_STATUSES).includes(value);
}

export function isPurchaseOrderEditable(status) {
  return status === PURCHASE_ORDER_STATUSES.DRAFT;
}

export function isPurchaseOrderSubmitted(status) {
  return status === PURCHASE_ORDER_STATUSES.SUBMITTED;
}

export function isPurchaseOrderApproved(status) {
  return (
    status === PURCHASE_ORDER_STATUSES.APPROVED ||
    status === PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED
  );
}

export function isPurchaseOrderReceivable(status) {
  return [
    PURCHASE_ORDER_STATUSES.APPROVED,
    PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
  ].includes(status);
}

export function isPurchaseOrderCompleted(status) {
  return [
    PURCHASE_ORDER_STATUSES.RECEIVED,
    PURCHASE_ORDER_STATUSES.CANCELLED,
  ].includes(status);
}

export function canCancelPurchaseOrder(status, totalReceivedQuantity = 0) {
  const receivedQuantity = Number(totalReceivedQuantity);

  if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
    return false;
  }

  return (
    receivedQuantity === 0 &&
    [
      PURCHASE_ORDER_STATUSES.DRAFT,
      PURCHASE_ORDER_STATUSES.SUBMITTED,
      PURCHASE_ORDER_STATUSES.APPROVED,
    ].includes(status)
  );
}

export function canTransitionPurchaseOrderStatus(currentStatus, nextStatus) {
  if (
    !isValidPurchaseOrderStatus(currentStatus) ||
    !isValidPurchaseOrderStatus(nextStatus)
  ) {
    return false;
  }

  return (
    PURCHASE_ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) ??
    false
  );
}

export function isValidPurchaseOrderQuantity(value) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= PURCHASE_ORDER_LIMITS.MAX_QUANTITY
  );
}

export function isValidReceivedQuantity(value) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= PURCHASE_ORDER_LIMITS.MAX_QUANTITY
  );
}

export function isValidPurchaseOrderMoney(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE
  );
}

export function isValidPurchaseOrderUnitCost(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= PURCHASE_ORDER_LIMITS.MAX_UNIT_COST
  );
}

/**
 * Validates YYYY-MM-DD.
 */
export function isValidPurchaseOrderDate(value) {
  const normalizedDate = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return false;
  }

  const [yearText, monthText, dayText] = normalizedDate.split("-");

  const year = Number(yearText);

  const month = Number(monthText);

  const day = Number(dayText);

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

export function isValidExpectedDeliveryDate(orderDate, expectedDeliveryDate) {
  if (!expectedDeliveryDate) {
    return true;
  }

  if (
    !isValidPurchaseOrderDate(orderDate) ||
    !isValidPurchaseOrderDate(expectedDeliveryDate)
  ) {
    return false;
  }

  return expectedDeliveryDate >= orderDate;
}

export function getTodayPurchaseOrderDate() {
  const currentDate = new Date();

  const timezoneOffset = currentDate.getTimezoneOffset() * 60 * 1000;

  return new Date(currentDate.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export function roundPurchaseOrderMoney(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

export function calculatePurchaseOrderLineTotal(orderedQuantity, unitCost) {
  const quantity = Number(orderedQuantity);

  const cost = Number(unitCost);

  if (
    !isValidPurchaseOrderQuantity(quantity) ||
    !isValidPurchaseOrderUnitCost(cost)
  ) {
    return 0;
  }

  const lineTotal = quantity * cost;

  if (
    !Number.isFinite(lineTotal) ||
    lineTotal > PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE
  ) {
    return 0;
  }

  return roundPurchaseOrderMoney(lineTotal);
}

export function calculatePurchaseOrderTotals(items, adjustments = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];

  const subtotal = roundPurchaseOrderMoney(
    normalizedItems.reduce((currentTotal, item) => {
      const storedLineTotal = Number(item?.lineTotal);

      const lineTotal = isValidPurchaseOrderMoney(storedLineTotal)
        ? storedLineTotal
        : calculatePurchaseOrderLineTotal(
            Number(item?.orderedQuantity),
            Number(item?.unitCost),
          );

      return currentTotal + lineTotal;
    }, 0),
  );

  const discountAmount = Number(adjustments.discountAmount ?? 0);

  const taxAmount = Number(adjustments.taxAmount ?? 0);

  const shippingAmount = Number(adjustments.shippingAmount ?? 0);

  const safeDiscount = isValidPurchaseOrderMoney(discountAmount)
    ? discountAmount
    : 0;

  const safeTax = isValidPurchaseOrderMoney(taxAmount) ? taxAmount : 0;

  const safeShipping = isValidPurchaseOrderMoney(shippingAmount)
    ? shippingAmount
    : 0;

  const grandTotal = roundPurchaseOrderMoney(
    subtotal - safeDiscount + safeTax + safeShipping,
  );

  return {
    subtotal,

    discountAmount: safeDiscount,

    taxAmount: safeTax,

    shippingAmount: safeShipping,

    grandTotal: grandTotal >= 0 ? grandTotal : 0,
  };
}

export function isValidPurchaseOrderTotals(totals) {
  if (!totals) {
    return false;
  }

  const subtotal = Number(totals.subtotal);

  const discountAmount = Number(totals.discountAmount);

  const taxAmount = Number(totals.taxAmount);

  const shippingAmount = Number(totals.shippingAmount);

  const grandTotal = Number(totals.grandTotal);

  if (
    !isValidPurchaseOrderMoney(subtotal) ||
    !isValidPurchaseOrderMoney(discountAmount) ||
    !isValidPurchaseOrderMoney(taxAmount) ||
    !isValidPurchaseOrderMoney(shippingAmount) ||
    !isValidPurchaseOrderMoney(grandTotal)
  ) {
    return false;
  }

  if (discountAmount > subtotal) {
    return false;
  }

  const expectedGrandTotal = roundPurchaseOrderMoney(
    subtotal - discountAmount + taxAmount + shippingAmount,
  );

  return grandTotal === expectedGrandTotal;
}

/**
 * Generates:
 *
 * PO-2026-000001
 */
export function formatPurchaseOrderNumber(year, sequence) {
  const numericYear = Number(year);

  const numericSequence = Number(sequence);

  if (
    !Number.isInteger(numericYear) ||
    numericYear < 2000 ||
    numericYear > 9999
  ) {
    throw new Error("The Purchase Order year is invalid.");
  }

  if (
    !Number.isInteger(numericSequence) ||
    numericSequence < 1 ||
    numericSequence > PURCHASE_ORDER_LIMITS.MAX_CODE_SEQUENCE
  ) {
    throw new Error("The Purchase Order sequence is invalid.");
  }

  return `PO-${numericYear}-${String(numericSequence).padStart(6, "0")}`;
}

export function createEmptyPurchaseOrderItem(product = null) {
  return {
    productId: String(product?.id ?? "").trim(),

    productName: normalizePurchaseOrderText(product?.name),

    productSku: String(product?.sku ?? "")
      .trim()
      .toUpperCase(),

    barcode: String(product?.barcode ?? "").trim(),

    category: normalizePurchaseOrderText(
      product?.category ?? product?.categoryName,
    ),

    categoryCode: String(product?.categoryCode ?? product?.categoryId ?? "")
      .trim()
      .toUpperCase(),

    unitCode: String(product?.unitCode ?? product?.unitId ?? "")
      .trim()
      .toUpperCase(),

    unitName: normalizePurchaseOrderText(product?.unitName),

    unitAbbreviation: String(product?.unitAbbreviation ?? "")
      .trim()
      .toUpperCase(),

    orderedQuantity: "",

    receivedQuantity: 0,

    remainingQuantity: "",

    unitCost:
      product?.costPrice === null ||
      product?.costPrice === undefined ||
      product?.costPrice === ""
        ? ""
        : String(product.costPrice),

    lineTotal: 0,
  };
}

export function createEmptyPurchaseOrderForm() {
  return {
    supplierId: "",

    orderDate: getTodayPurchaseOrderDate(),

    expectedDeliveryDate: "",

    discountAmount: "0",

    taxAmount: "0",

    shippingAmount: "0",

    notes: "",

    items: [],
  };
}
