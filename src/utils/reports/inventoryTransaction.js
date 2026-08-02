import {
  INVENTORY_TRANSACTION_DIRECTIONS,
  INVENTORY_TRANSACTION_SCHEMA_VERSION,
  INVENTORY_TRANSACTION_TYPES,
  isValidRelatedDocumentType,
  normalizeRelatedDocumentId,
  resolveInventoryReferenceNumber,
  getInventoryTransactionDirection,
  isValidInventoryTransactionType,
} from "../../constants/reports";

const EMPTY_TEXT = "";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUppercase(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function requireFiniteNumber(value, fieldName) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  return numericValue;
}

function requireNonNegativeNumber(value, fieldName) {
  const numericValue = requireFiniteNumber(value, fieldName);

  if (numericValue < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return numericValue;
}

export function getQuantityBreakdown(quantityChanged) {
  const normalizedQuantityChanged = requireFiniteNumber(
    quantityChanged,
    "Quantity changed",
  );

  return {
    quantityChanged: normalizedQuantityChanged,
    quantityIn: normalizedQuantityChanged > 0 ? normalizedQuantityChanged : 0,
    quantityOut:
      normalizedQuantityChanged < 0 ? Math.abs(normalizedQuantityChanged) : 0,
  };
}

export function calculateQuantityAfter(quantityBefore, quantityChanged) {
  return (
    requireNonNegativeNumber(quantityBefore, "Quantity before") +
    requireFiniteNumber(quantityChanged, "Quantity changed")
  );
}

export function validateQuantityTransition({
  quantityBefore,
  quantityChanged,
  quantityAfter,
  allowNegativeStock = false,
}) {
  const normalizedBefore = requireNonNegativeNumber(
    quantityBefore,
    "Quantity before",
  );
  const normalizedChanged = requireFiniteNumber(
    quantityChanged,
    "Quantity changed",
  );
  const normalizedAfter = requireFiniteNumber(quantityAfter, "Quantity after");

  const expectedAfter = normalizedBefore + normalizedChanged;

  if (normalizedAfter !== expectedAfter) {
    throw new Error(
      "Quantity after must equal quantity before plus quantity changed.",
    );
  }

  if (!allowNegativeStock && normalizedAfter < 0) {
    throw new Error("This transaction would result in negative stock.");
  }

  return {
    quantityBefore: normalizedBefore,
    quantityChanged: normalizedChanged,
    quantityAfter: normalizedAfter,
  };
}

export function validateTransactionDirection(transactionType, quantityChanged) {
  if (!isValidInventoryTransactionType(transactionType)) {
    throw new Error("Invalid inventory transaction type.");
  }

  const direction = getInventoryTransactionDirection(transactionType);
  const normalizedQuantityChanged = requireFiniteNumber(
    quantityChanged,
    "Quantity changed",
  );

  if (
    direction === INVENTORY_TRANSACTION_DIRECTIONS.IN &&
    normalizedQuantityChanged <= 0
  ) {
    throw new Error(
      "Inbound inventory transactions must use a positive quantity change.",
    );
  }

  if (
    direction === INVENTORY_TRANSACTION_DIRECTIONS.OUT &&
    normalizedQuantityChanged >= 0
  ) {
    throw new Error(
      "Outbound inventory transactions must use a negative quantity change.",
    );
  }

  return direction;
}

export function createProductSnapshot(product = {}) {
  return {
    productId: normalizeText(product.id ?? product.productId),
    sourceProductId: normalizeNullableText(product.sourceProductId),

    productName: normalizeText(product.name ?? product.productName),
    sku: normalizeUppercase(product.sku),
    barcode: normalizeNullableText(product.barcode),

    category: normalizeText(product.category),
    categoryCode: normalizeUppercase(product.categoryCode),

    unitCode: normalizeUppercase(product.unitCode),
    unitName: normalizeText(product.unitName),
    unitAbbreviation: normalizeUppercase(product.unitAbbreviation),
  };
}

export function createUserSnapshot(user = {}) {
  return {
    performedBy: normalizeText(user.uid ?? user.id ?? user.performedBy),
    performedByName: normalizeText(
      user.displayName ?? user.name ?? user.performedByName,
    ),
    performedByEmail: normalizeNullableText(
      user.email ?? user.performedByEmail,
    ),
    performedByRole: normalizeUppercase(user.role ?? user.performedByRole),
  };
}

export function createSupplierSnapshot(supplier = {}) {
  const supplierId = normalizeNullableText(supplier.id ?? supplier.supplierId);
  const supplierName = normalizeNullableText(
    supplier.name ?? supplier.supplierName,
  );

  return {
    supplierId,
    supplierName,
  };
}

export function createApprovalSnapshot(approver = {}) {
  return {
    approvedBy: normalizeNullableText(
      approver.uid ?? approver.id ?? approver.approvedBy,
    ),
    approvedByName: normalizeNullableText(
      approver.displayName ?? approver.name ?? approver.approvedByName,
    ),
    approvedByRole: normalizeNullableText(
      approver.role ?? approver.approvedByRole,
    ),
  };
}

export function createInventoryTransactionData({
  transactionType,
  referenceNumber,
  product,
  user,
  quantityBefore,
  quantityChanged,
  quantityAfter,
  unitCost = null,
  supplier = null,
  approver = null,
  relatedDocumentId = null,
  relatedDocumentType = null,
  reason = "",
  remarks = "",
  transactionDate = null,
  createdAt = null,
  updatedAt = null,
  allowNegativeStock = false,
  metadata = {},
}) {
  if (!isValidInventoryTransactionType(transactionType)) {
    throw new Error("Invalid inventory transaction type.");
  }

  const normalizedReferenceNumber = resolveInventoryReferenceNumber({
    referenceNumber,
    fallbackReference: relatedDocumentId,
  });

  if (!normalizedReferenceNumber) {
    throw new Error("Reference number or related document ID is required.");
  }

  const normalizedRelatedDocumentId =
    normalizeRelatedDocumentId(relatedDocumentId);

  const normalizedRelatedDocumentType =
    normalizeNullableText(relatedDocumentType);

  if (
    normalizedRelatedDocumentType &&
    !isValidRelatedDocumentType(normalizedRelatedDocumentType)
  ) {
    throw new Error("Related document type is invalid.");
  }

  const productSnapshot = createProductSnapshot(product);

  if (!productSnapshot.productId) {
    throw new Error("Product ID is required.");
  }

  if (!productSnapshot.productName) {
    throw new Error("Product name is required.");
  }

  if (!productSnapshot.sku) {
    throw new Error("Product SKU is required.");
  }

  const userSnapshot = createUserSnapshot(user);

  if (!userSnapshot.performedBy) {
    throw new Error("The acting user ID is required.");
  }

  if (!userSnapshot.performedByName) {
    throw new Error("The acting user name is required.");
  }

  const normalizedQuantityAfter =
    quantityAfter === undefined || quantityAfter === null
      ? calculateQuantityAfter(quantityBefore, quantityChanged)
      : quantityAfter;

  const quantities = validateQuantityTransition({
    quantityBefore,
    quantityChanged,
    quantityAfter: normalizedQuantityAfter,
    allowNegativeStock,
  });

  validateTransactionDirection(transactionType, quantities.quantityChanged);

  const quantityBreakdown = getQuantityBreakdown(quantities.quantityChanged);

  const normalizedUnitCost = normalizeNullableNumber(unitCost);

  if (normalizedUnitCost !== null && normalizedUnitCost < 0) {
    throw new Error("Unit cost cannot be negative.");
  }

  const totalCost =
    normalizedUnitCost === null
      ? null
      : Math.round(
          (Math.abs(quantityBreakdown.quantityChanged) * normalizedUnitCost +
            Number.EPSILON) *
            100,
        ) / 100;

  return {
    schemaVersion: INVENTORY_TRANSACTION_SCHEMA_VERSION,
    referenceNumber: normalizedReferenceNumber,
    transactionType,

    ...productSnapshot,

    ...quantities,
    quantityIn: quantityBreakdown.quantityIn,
    quantityOut: quantityBreakdown.quantityOut,

    unitCost: normalizedUnitCost,
    totalCost,

    ...createSupplierSnapshot(supplier ?? {}),

    relatedDocumentId: normalizedRelatedDocumentId,
    relatedDocumentType: normalizedRelatedDocumentType,

    reason: normalizeText(reason),
    remarks: normalizeText(remarks),

    ...userSnapshot,
    ...createApprovalSnapshot(approver ?? {}),

    transactionDate,
    createdAt,
    updatedAt,

    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : {},
  };
}

export function validateInventoryTransactionData(transaction = {}) {
  const requiredTextFields = [
    "referenceNumber",
    "transactionType",
    "productId",
    "productName",
    "sku",
    "performedBy",
    "performedByName",
    "performedByRole",
  ];

  for (const field of requiredTextFields) {
    if (!normalizeText(transaction[field])) {
      throw new Error(`${field} is required.`);
    }
  }

  if (!isValidInventoryTransactionType(transaction.transactionType)) {
    throw new Error("Invalid inventory transaction type.");
  }

  const quantities = validateQuantityTransition({
    quantityBefore: transaction.quantityBefore,
    quantityChanged: transaction.quantityChanged,
    quantityAfter: transaction.quantityAfter,
  });

  validateTransactionDirection(
    transaction.transactionType,
    transaction.quantityChanged,
  );

  const expectedBreakdown = getQuantityBreakdown(transaction.quantityChanged);

  if (
    Number(transaction.quantityIn) !== expectedBreakdown.quantityIn ||
    Number(transaction.quantityOut) !== expectedBreakdown.quantityOut
  ) {
    throw new Error(
      "Quantity in and quantity out do not match quantity changed.",
    );
  }

  return {
    ...transaction,
    ...quantities,
  };
}

export function isInboundTransaction(transactionType) {
  return (
    getInventoryTransactionDirection(transactionType) ===
    INVENTORY_TRANSACTION_DIRECTIONS.IN
  );
}

export function isOutboundTransaction(transactionType) {
  return (
    getInventoryTransactionDirection(transactionType) ===
    INVENTORY_TRANSACTION_DIRECTIONS.OUT
  );
}

export function getTransactionQuantityLabel(transaction = {}) {
  const quantityChanged = Number(transaction.quantityChanged ?? 0);

  if (quantityChanged > 0) {
    return `+${quantityChanged}`;
  }

  return String(quantityChanged);
}

export const EMPTY_INVENTORY_TRANSACTION = Object.freeze({
  referenceNumber: EMPTY_TEXT,
  transactionType: INVENTORY_TRANSACTION_TYPES.STOCK_IN,
  productId: EMPTY_TEXT,
  productName: EMPTY_TEXT,
  sku: EMPTY_TEXT,
  quantityBefore: 0,
  quantityChanged: 0,
  quantityAfter: 0,
  quantityIn: 0,
  quantityOut: 0,
});
