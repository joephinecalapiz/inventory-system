export const INVENTORY_RELATED_DOCUMENT_TYPES = Object.freeze({
  STOCK_IN_OPERATION: "STOCK_IN_OPERATION",
  STOCK_OUT_OPERATION: "STOCK_OUT_OPERATION",
  GOODS_RECEIPT: "GOODS_RECEIPT",
  STOCK_ADJUSTMENT_REQUEST: "STOCK_ADJUSTMENT_REQUEST",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  RETURN: "RETURN",
  VOID: "VOID",
});

export const INVENTORY_REFERENCE_PREFIXES = Object.freeze({
  TRANSACTION: "TXN",
  STOCK_IN: "STI",
  STOCK_OUT: "STO",
  GOODS_RECEIPT: "GRN",
  STOCK_ADJUSTMENT: "ADJ",
  PURCHASE_ORDER: "PO",
  RETURN: "RTN",
  VOID: "VOID",
});

export const INVENTORY_REFERENCE_FIELDS = Object.freeze([
  "referenceNumber",
  "relatedDocumentId",
  "relatedDocumentType",
]);

export function isValidRelatedDocumentType(value) {
  return Object.values(INVENTORY_RELATED_DOCUMENT_TYPES).includes(value);
}

export function normalizeInventoryReference(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function normalizeRelatedDocumentId(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("/") ||
    normalized === "." ||
    normalized === ".."
  ) {
    throw new Error("Related document ID is invalid.");
  }

  return normalized;
}

export function resolveInventoryReferenceNumber({
  referenceNumber,
  fallbackReference,
}) {
  return (
    normalizeInventoryReference(referenceNumber) ||
    normalizeInventoryReference(fallbackReference)
  );
}
