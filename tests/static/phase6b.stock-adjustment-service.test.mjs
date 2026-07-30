import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);

const projectRoot = path.resolve(path.dirname(currentFile), "../..");

const servicePath = path.join(
  projectRoot,
  "src/services/stockAdjustmentService.js",
);

const constantsPath = path.join(
  projectRoot,
  "src/constants/stockAdjustment.js",
);

const serviceSource = fs.readFileSync(servicePath, "utf8");

const constantsSource = fs.readFileSync(constantsPath, "utf8");

test("exports the Phase 6B request functions", () => {
  assert.match(
    serviceSource,
    /export async function createStockAdjustmentRequest/,
  );

  assert.match(
    serviceSource,
    /export function subscribeToStockAdjustmentRequests/,
  );

  assert.match(
    serviceSource,
    /export async function getStockAdjustmentRequest/,
  );
});

test("uses a Firestore transaction", () => {
  assert.match(serviceSource, /runTransaction/);

  assert.match(serviceSource, /await transaction\.get\(\s*operationReference/);
});

test("creates a request and immutable create operation", () => {
  assert.match(serviceSource, /stockAdjustmentRequests/);

  assert.match(serviceSource, /stockAdjustmentOperations/);

  assert.match(serviceSource, /transaction\.set\(\s*requestReference/);

  assert.match(serviceSource, /transaction\.set\(\s*operationReference/);
});

test("does not change Product stock in Phase 6B", () => {
  assert.doesNotMatch(
    serviceSource,
    /transaction\.update\(\s*productReference/,
  );

  assert.doesNotMatch(serviceSource, /transaction\.set\(\s*productReference/);

  assert.doesNotMatch(serviceSource, /stockMovements",\s*preparedInput/);
});

test("uses a submitted request status", () => {
  assert.match(serviceSource, /STOCK_ADJUSTMENT_STATUSES\s*\.SUBMITTED/);
});

test("calculates the difference from Product stock", () => {
  assert.match(serviceSource, /calculateStockAdjustmentDifference\(/);

  assert.match(serviceSource, /systemQuantityAtRequest/);

  assert.match(serviceSource, /actualCountedQuantity/);
});

test("blocks zero-difference requests", () => {
  assert.match(serviceSource, /quantityDifference === 0/);

  assert.match(serviceSource, /No Stock Adjustment is required/);
});

test("validates reason against adjustment direction", () => {
  assert.match(serviceSource, /isAdjustmentReasonAllowedForDirection\(/);

  assert.match(serviceSource, /adjustmentDirection/);
});

test("supports idempotent operation replay", () => {
  assert.match(serviceSource, /isSameCreateRequest\(/);

  assert.match(serviceSource, /isReplay:\s*true/);
});

test("stores countDate and countDateKey", () => {
  assert.match(serviceSource, /countDate:\s*preparedInput\.countDate/);

  assert.match(serviceSource, /countDateKey:\s*preparedInput\.countDateKey/);

  assert.match(constantsSource, /"countDateKey"/);
});

test("requires an active allowed Firestore user profile", () => {
  assert.match(serviceSource, /USER_STATUSES\.ACTIVE/);

  assert.match(serviceSource, /canRoleCreateStockAdjustment\(/);

  assert.match(serviceSource, /"users"/);
});

test("stores Product snapshots and adjustment value", () => {
  assert.match(serviceSource, /productName/);

  assert.match(serviceSource, /productSku/);

  assert.match(serviceSource, /unitCostAtRequest/);

  assert.match(serviceSource, /estimatedAdjustmentValue/);
});
