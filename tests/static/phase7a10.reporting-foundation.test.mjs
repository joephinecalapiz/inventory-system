import test from "node:test";
import assert from "node:assert/strict";

import {
  reconcileProductBalance,
  validateProductReportState,
  validateReportTransactionRecord,
} from "../../src/utils/reports/reportValidation.js";

test("valid transaction passes report validation", () => {
  const result = validateReportTransactionRecord({
    referenceNumber: "STI-TEST-001",
    transactionType: "STOCK_IN",
    productId: "product-1",
    productName: "Test Product",
    sku: "TEST-1",
    quantityBefore: 5,
    quantityChanged: 3,
    quantityAfter: 8,
    quantityIn: 3,
    quantityOut: 0,
    performedBy: "user-1",
    performedByName: "Test User",
    performedByRole: "ADMIN",
    transactionDate: {},
    createdAt: {},
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, []);
});

test("invalid quantity transition fails report validation", () => {
  const result = validateReportTransactionRecord({
    referenceNumber: "STO-TEST-001",
    transactionType: "STOCK_OUT",
    productId: "product-1",
    productName: "Test Product",
    sku: "TEST-1",
    quantityBefore: 10,
    quantityChanged: -3,
    quantityAfter: 9,
    quantityIn: 0,
    quantityOut: 3,
    performedBy: "user-1",
    performedByName: "Test User",
    performedByRole: "ADMIN",
    transactionDate: {},
    createdAt: {},
  });

  assert.equal(result.isValid, false);
});

test("product stock status validation detects mismatch", () => {
  const result = validateProductReportState({
    quantity: 2,
    reorderLevel: 5,
    stockStatus: "IN_STOCK",
  });

  assert.equal(result.isValid, false);
});

test("product balance reconciliation succeeds", () => {
  const result = reconcileProductBalance({
    openingBalance: 10,
    transactions: [
      { quantityChanged: 5 },
      { quantityChanged: -3 },
      { quantityChanged: 2 },
    ],
    currentQuantity: 14,
  });

  assert.equal(result.isReconciled, true);
  assert.equal(result.difference, 0);
});
