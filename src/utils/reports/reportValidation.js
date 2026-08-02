import {
  INVENTORY_TRANSACTION_REQUIRED_FIELDS,
  INVENTORY_TRANSACTION_TYPES,
} from "../../constants/reports/index.js";

import {
  calculateProductStockStatus,
  isValidProductStockStatus,
} from "../../constants/stockStatus.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function validateReportTransactionRecord(transaction = {}) {
  const errors = [];

  for (const fieldName of INVENTORY_TRANSACTION_REQUIRED_FIELDS) {
    const value = transaction[fieldName];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      errors.push(`Missing required field: ${fieldName}`);
    }
  }

  if (
    !Object.values(INVENTORY_TRANSACTION_TYPES).includes(
      transaction.transactionType,
    )
  ) {
    errors.push("Invalid transaction type.");
  }

  const quantityBefore = toFiniteNumber(transaction.quantityBefore);
  const quantityChanged = toFiniteNumber(transaction.quantityChanged);
  const quantityAfter = toFiniteNumber(transaction.quantityAfter);
  const quantityIn = toFiniteNumber(transaction.quantityIn);
  const quantityOut = toFiniteNumber(transaction.quantityOut);

  if (
    quantityBefore === null ||
    quantityChanged === null ||
    quantityAfter === null
  ) {
    errors.push("Quantity fields must be valid numbers.");
  } else if (quantityAfter !== quantityBefore + quantityChanged) {
    errors.push(
      "quantityAfter must equal quantityBefore plus quantityChanged.",
    );
  }

  if (quantityChanged !== null) {
    const expectedQuantityIn =
      quantityChanged > 0 ? quantityChanged : 0;

    const expectedQuantityOut =
      quantityChanged < 0 ? Math.abs(quantityChanged) : 0;

    if (quantityIn !== expectedQuantityIn) {
      errors.push("quantityIn is inconsistent with quantityChanged.");
    }

    if (quantityOut !== expectedQuantityOut) {
      errors.push("quantityOut is inconsistent with quantityChanged.");
    }
  }

  if (!normalizeText(transaction.productId)) {
    errors.push("Product ID is required.");
  }

  if (!normalizeText(transaction.performedBy)) {
    errors.push("Acting user ID is required.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateProductReportState(product = {}) {
  const errors = [];

  const quantity = toFiniteNumber(product.quantity);
  const reorderLevel = toFiniteNumber(product.reorderLevel);

  if (
    quantity === null ||
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    errors.push("Product quantity must be a non-negative whole number.");
  }

  if (
    reorderLevel === null ||
    !Number.isInteger(reorderLevel) ||
    reorderLevel < 0
  ) {
    errors.push(
      "Product reorder level must be a non-negative whole number.",
    );
  }

  if (!isValidProductStockStatus(product.stockStatus)) {
    errors.push("Product stockStatus is missing or invalid.");
  }

  if (errors.length === 0) {
    const expectedStatus = calculateProductStockStatus(
      quantity,
      reorderLevel,
    );

    if (product.stockStatus !== expectedStatus) {
      errors.push(
        `Product stockStatus should be ${expectedStatus}.`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function reconcileProductBalance({
  openingBalance = 0,
  transactions = [],
  currentQuantity,
}) {
  const normalizedOpeningBalance = toFiniteNumber(openingBalance);
  const normalizedCurrentQuantity = toFiniteNumber(currentQuantity);

  if (
    normalizedOpeningBalance === null ||
    normalizedCurrentQuantity === null
  ) {
    throw new Error(
      "Opening and current quantities must be valid numbers.",
    );
  }

  const movementTotal = transactions.reduce((total, transaction) => {
    const quantityChanged = toFiniteNumber(
      transaction.quantityChanged,
    );

    if (quantityChanged === null) {
      throw new Error(
        "A transaction contains an invalid quantityChanged value.",
      );
    }

    return total + quantityChanged;
  }, 0);

  const calculatedQuantity =
    normalizedOpeningBalance + movementTotal;

  return {
    openingBalance: normalizedOpeningBalance,
    movementTotal,
    calculatedQuantity,
    currentQuantity: normalizedCurrentQuantity,
    isReconciled: calculatedQuantity === normalizedCurrentQuantity,
    difference: normalizedCurrentQuantity - calculatedQuantity,
  };
}
