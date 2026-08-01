import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rulesSource =
  fs.readFileSync(
    "firestore.rules",
    "utf8",
  );

test("contains Stock Adjustment request and operation matches", () => {
  assert.match(
    rulesSource,
    /match \/stockAdjustmentRequests\/\{adjustmentId\}/,
  );

  assert.match(
    rulesSource,
    /match \/stockAdjustmentOperations\/\{operationId\}/,
  );
});

test("allows authorized request and history reads", () => {
  assert.match(
    rulesSource,
    /function canReadStockAdjustments/,
  );

  assert.match(
    rulesSource,
    /"AUDITOR"/,
  );
});

test("validates atomic create, post, and decision operations", () => {
  assert.match(
    rulesSource,
    /isValidStockAdjustmentCreateOperation/,
  );

  assert.match(
    rulesSource,
    /isValidStockAdjustmentPostOperation/,
  );

  assert.match(
    rulesSource,
    /isValidStockAdjustmentDecisionOperation/,
  );
});

test("links Product, request, movement, and post operation", () => {
  assert.match(
    rulesSource,
    /isValidStockAdjustmentProductUpdate/,
  );

  assert.match(
    rulesSource,
    /isValidStockAdjustmentMovement/,
  );

  assert.match(
    rulesSource,
    /stockAdjustmentPostLinkedDocumentsMatch/,
  );
});

test("keeps movements and operations immutable", () => {
  assert.match(
    rulesSource,
    /match \/stockAdjustmentOperations[\s\S]*allow update, delete: if false;/,
  );

  assert.match(
    rulesSource,
    /match \/stockMovements[\s\S]*allow update, delete: if false;/,
  );
});

test("keeps Stock In, Stock Out, procurement, and final deny rules", () => {
  assert.match(
    rulesSource,
    /match \/stockInOperations/,
  );

  assert.match(
    rulesSource,
    /match \/stockOutOperations/,
  );

  assert.match(
    rulesSource,
    /match \/purchaseOrders/,
  );

  assert.match(
    rulesSource,
    /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/,
  );
});

test("does not allow public read or write", () => {
  assert.doesNotMatch(
    rulesSource,
    /allow read, write: if true/,
  );
});

test("routes Stock Adjustment Product writes before unrelated validators", () => {
  const productMatchStart =
    rulesSource.indexOf(
      "match /products/{productId}",
    );

  const productMatchEnd =
    rulesSource.indexOf(
      "match /productMasterReservations",
      productMatchStart,
    );

  const productMatch =
    rulesSource.slice(
      productMatchStart,
      productMatchEnd,
    );

  assert.match(
    productMatch,
    /lastStockMovementReason/,
  );

  assert.match(
    productMatch,
    /== "STOCK_ADJUSTMENT"[\s\S]*isValidStockAdjustmentProductUpdate/,
  );
});

test("routes movement, request, and operation validators by discriminator", () => {
  assert.match(
    rulesSource,
    /reason",[\s\S]*== "STOCK_ADJUSTMENT"[\s\S]*isValidStockAdjustmentMovement/,
  );

  assert.match(
    rulesSource,
    /status[\s\S]*== "POSTED"[\s\S]*isValidPostedStockAdjustmentRequest/,
  );

  assert.match(
    rulesSource,
    /operationType[\s\S]*== "POST_ADJUSTMENT"[\s\S]*isValidStockAdjustmentPostOperation/,
  );
});

