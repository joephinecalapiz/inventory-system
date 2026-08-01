import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rules = fs.readFileSync("firestore.rules", "utf8");

test("uses lean Stock-Out atomic validators", () => {
  assert.match(rules, /function isValidStockOutOperationCreate/);
  assert.match(rules, /function isValidManualStockOutProductUpdate/);
  assert.match(rules, /function isValidManualStockOutMovement/);
});

test("Product Stock-Out validation links to the immutable operation", () => {
  assert.match(rules, /stockOutProductMatchesMovementAndOperation/);
  assert.match(rules, /operation\.previousQuantity[\s\S]*resource\.data\.quantity/);
  assert.match(rules, /operation\.newQuantity[\s\S]*request\.resource\.data\.quantity/);
});

test("Operation validation links Product and permanent movement", () => {
  assert.match(rules, /stockOutMovementMatchesOperation/);
  assert.match(rules, /product\.lastStockMovementId == operationId/);
  assert.match(rules, /movement\.movementId == operationId/);
});

test("keeps Stock-Out immutability and role restrictions", () => {
  assert.match(rules, /match \/stockOutOperations\/\{operationId\}[\s\S]*allow list: if false;/);
  assert.match(rules, /match \/stockOutOperations\/\{operationId\}[\s\S]*allow update, delete: if false;/);
  assert.match(rules, /match \/stockMovements\/\{movementId\}[\s\S]*allow update, delete: if false;/);
});

test("keeps Stock Adjustment, Stock In, and procurement rules", () => {
  assert.match(rules, /match \/stockAdjustmentRequests\/\{adjustmentId\}/);
  assert.match(rules, /match \/stockInOperations\/\{operationId\}/);
  assert.match(rules, /match \/purchaseOrders\/\{purchaseOrderId\}/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
});
