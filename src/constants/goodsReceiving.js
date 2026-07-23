import {
  PURCHASE_ORDER_LIMITS,
  PURCHASE_ORDER_STATUSES,
} from "./purchaseOrders";

export const GOODS_RECEIPT_STATUSES = Object.freeze({
  COMPLETED: "COMPLETED",
});

export const GOODS_RECEIPT_STATUS_LABELS = Object.freeze({
  COMPLETED: "Completed",
});

export const GOODS_RECEIPT_LIMITS = Object.freeze({
  MAX_CODE_SEQUENCE: 999999,

  MAX_ITEM_COUNT: PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT,

  MAX_QUANTITY: PURCHASE_ORDER_LIMITS.MAX_QUANTITY,

  MAX_UNIT_COST: PURCHASE_ORDER_LIMITS.MAX_UNIT_COST,

  MAX_MONEY_VALUE: PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE,

  REFERENCE_MAX_LENGTH: 100,

  REMARKS_MAX_LENGTH: 500,

  RECEIVED_BY_NAME_MAX_LENGTH: 150,

  SUPPLIER_NAME_MAX_LENGTH: 150,

  PRODUCT_NAME_MAX_LENGTH: 150,

  PRODUCT_SKU_MAX_LENGTH: 50,
});

export const GOODS_RECEIPT_REQUIRED_FIELDS = Object.freeze([
  "goodsReceiptNumber",
  "goodsReceiptYear",

  "purchaseOrderId",
  "poNumber",

  "supplierId",
  "supplierCode",
  "supplierName",

  "referenceNumber",
  "dateReceived",
  "dateReceivedKey",

  "status",

  "itemCount",
  "totalReceivedQuantity",
  "totalValue",

  "remarks",

  "receivedBy",
  "receivedByName",

  "createdBy",
  "createdAt",
]);

export const GOODS_RECEIPT_ITEM_REQUIRED_FIELDS = Object.freeze([
  "goodsReceiptId",
  "goodsReceiptNumber",

  "purchaseOrderId",
  "poNumber",

  "productId",
  "productName",
  "productSku",

  "category",
  "categoryCode",

  "unitCode",
  "unitName",
  "unitAbbreviation",

  "orderedQuantity",
  "previouslyReceivedQuantity",
  "quantityReceived",
  "remainingQuantity",

  "unitCost",
  "lineTotal",

  "createdBy",
  "createdAt",
]);

export function normalizeGoodsReceiptText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeGoodsReceiptReference(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function isValidGoodsReceiptStatus(value) {
  return Object.values(GOODS_RECEIPT_STATUSES).includes(value);
}

export function isValidGoodsReceiptReference(value) {
  const referenceNumber = normalizeGoodsReceiptReference(value);

  return (
    referenceNumber.length >= 1 &&
    referenceNumber.length <= GOODS_RECEIPT_LIMITS.REFERENCE_MAX_LENGTH
  );
}

export function isValidGoodsReceiptRemarks(value) {
  return (
    String(value ?? "").trim().length <= GOODS_RECEIPT_LIMITS.REMARKS_MAX_LENGTH
  );
}

export function isValidGoodsReceiptQuantity(value) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= GOODS_RECEIPT_LIMITS.MAX_QUANTITY
  );
}

export function isValidGoodsReceiptUnitCost(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= GOODS_RECEIPT_LIMITS.MAX_UNIT_COST
  );
}

export function isValidGoodsReceiptDate(value) {
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

export function getTodayGoodsReceiptDate() {
  const currentDate = new Date();

  const timezoneOffset = currentDate.getTimezoneOffset() * 60 * 1000;

  return new Date(currentDate.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export function isValidGoodsReceiptDateNotFuture(value) {
  return isValidGoodsReceiptDate(value) && value <= getTodayGoodsReceiptDate();
}

export function roundGoodsReceiptMoney(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

export function calculateGoodsReceiptLineTotal(quantityReceived, unitCost) {
  const quantity = Number(quantityReceived);
  const cost = Number(unitCost);

  if (
    !isValidGoodsReceiptQuantity(quantity) ||
    !isValidGoodsReceiptUnitCost(cost)
  ) {
    return 0;
  }

  const lineTotal = quantity * cost;

  if (
    !Number.isFinite(lineTotal) ||
    lineTotal > GOODS_RECEIPT_LIMITS.MAX_MONEY_VALUE
  ) {
    return 0;
  }

  return roundGoodsReceiptMoney(lineTotal);
}

export function calculateGoodsReceiptTotals(items) {
  const normalizedItems = Array.isArray(items) ? items : [];

  let itemCount = 0;
  let totalReceivedQuantity = 0;
  let totalValue = 0;

  for (const item of normalizedItems) {
    const quantityReceived = Number(item?.quantityReceived);
    const unitCost = Number(item?.unitCost);

    if (!isValidGoodsReceiptQuantity(quantityReceived)) {
      continue;
    }

    if (!isValidGoodsReceiptUnitCost(unitCost)) {
      continue;
    }

    itemCount += 1;

    totalReceivedQuantity += quantityReceived;

    totalValue += calculateGoodsReceiptLineTotal(quantityReceived, unitCost);
  }

  return {
    itemCount,

    totalReceivedQuantity,

    totalValue: roundGoodsReceiptMoney(totalValue),
  };
}

export function isPurchaseOrderEligibleForReceiving(purchaseOrder) {
  if (!purchaseOrder) {
    return false;
  }

  const status = purchaseOrder.status ?? PURCHASE_ORDER_STATUSES.DRAFT;

  const totalOrderedQuantity = Number(purchaseOrder.totalOrderedQuantity ?? 0);

  const totalReceivedQuantity = Number(
    purchaseOrder.totalReceivedQuantity ?? 0,
  );

  const hasReceivableStatus = [
    PURCHASE_ORDER_STATUSES.APPROVED,
    PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
  ].includes(status);

  return (
    hasReceivableStatus &&
    Number.isInteger(totalOrderedQuantity) &&
    totalOrderedQuantity > 0 &&
    Number.isInteger(totalReceivedQuantity) &&
    totalReceivedQuantity >= 0 &&
    totalReceivedQuantity < totalOrderedQuantity
  );
}

export function validateGoodsReceiptItemQuantities(item) {
  const orderedQuantity = Number(item?.orderedQuantity ?? 0);

  const previouslyReceivedQuantity = Number(
    item?.previouslyReceivedQuantity ?? item?.receivedQuantity ?? 0,
  );

  const quantityReceived = Number(item?.quantityReceived ?? 0);

  if (
    !Number.isInteger(orderedQuantity) ||
    orderedQuantity < 1 ||
    !Number.isInteger(previouslyReceivedQuantity) ||
    previouslyReceivedQuantity < 0 ||
    previouslyReceivedQuantity > orderedQuantity ||
    !isValidGoodsReceiptQuantity(quantityReceived)
  ) {
    return false;
  }

  const remainingBeforeReceiving = orderedQuantity - previouslyReceivedQuantity;

  return quantityReceived <= remainingBeforeReceiving;
}

export function formatGoodsReceiptNumber(year, sequence) {
  const numericYear = Number(year);
  const numericSequence = Number(sequence);

  if (
    !Number.isInteger(numericYear) ||
    numericYear < 2000 ||
    numericYear > 9999
  ) {
    throw new Error("The Goods Receipt year is invalid.");
  }

  if (
    !Number.isInteger(numericSequence) ||
    numericSequence < 1 ||
    numericSequence > GOODS_RECEIPT_LIMITS.MAX_CODE_SEQUENCE
  ) {
    throw new Error("The Goods Receipt sequence is invalid.");
  }

  return `GRN-${numericYear}-${String(numericSequence).padStart(6, "0")}`;
}

export function createEmptyGoodsReceiptItem(purchaseOrderItem = null) {
  const orderedQuantity = Number(purchaseOrderItem?.orderedQuantity ?? 0);

  const previouslyReceivedQuantity = Number(
    purchaseOrderItem?.receivedQuantity ?? 0,
  );

  const remainingQuantity = Math.max(
    orderedQuantity - previouslyReceivedQuantity,
    0,
  );

  const storedUnitCost = purchaseOrderItem?.unitCost;

  return {
    productId: String(
      purchaseOrderItem?.productId ?? purchaseOrderItem?.id ?? "",
    ).trim(),

    productName: normalizeGoodsReceiptText(purchaseOrderItem?.productName),

    productSku: String(purchaseOrderItem?.productSku ?? "")
      .trim()
      .toUpperCase(),

    barcode: String(purchaseOrderItem?.barcode ?? "").trim(),

    category: normalizeGoodsReceiptText(purchaseOrderItem?.category),

    categoryCode: String(purchaseOrderItem?.categoryCode ?? "")
      .trim()
      .toUpperCase(),

    unitCode: String(purchaseOrderItem?.unitCode ?? "")
      .trim()
      .toUpperCase(),

    unitName: normalizeGoodsReceiptText(purchaseOrderItem?.unitName),

    unitAbbreviation: String(purchaseOrderItem?.unitAbbreviation ?? "")
      .trim()
      .toUpperCase(),

    orderedQuantity,

    previouslyReceivedQuantity,

    remainingBeforeReceiving: remainingQuantity,

    quantityReceived: "",

    unitCost:
      storedUnitCost === null ||
      storedUnitCost === undefined ||
      storedUnitCost === ""
        ? ""
        : String(storedUnitCost),

    lineTotal: 0,
  };
}

export function createEmptyGoodsReceiptForm(
  purchaseOrder = null,
  purchaseOrderItems = [],
) {
  const preparedItems = Array.isArray(purchaseOrderItems)
    ? purchaseOrderItems
        .map(createEmptyGoodsReceiptItem)
        .filter((item) => item.productId && item.remainingBeforeReceiving > 0)
    : [];

  return {
    purchaseOrderId: String(purchaseOrder?.id ?? "").trim(),

    poNumber: String(purchaseOrder?.poNumber ?? "")
      .trim()
      .toUpperCase(),

    supplierId: String(purchaseOrder?.supplierId ?? "").trim(),

    supplierCode: String(purchaseOrder?.supplierCode ?? "")
      .trim()
      .toUpperCase(),

    supplierName: normalizeGoodsReceiptText(purchaseOrder?.supplierName),

    referenceNumber: "",

    dateReceived: getTodayGoodsReceiptDate(),

    remarks: "",

    items: preparedItems,
  };
}
