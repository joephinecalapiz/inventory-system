import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "../..");

const serviceSource = fs.readFileSync(
  path.join(projectRoot, "src/services/stockAdjustmentService.js"),
  "utf8",
);

const pageSource = fs.readFileSync(
  path.join(projectRoot, "src/pages/StockAdjustmentReview.jsx"),
  "utf8",
);

const cssSource = fs.readFileSync(
  path.join(projectRoot, "src/styles/StockAdjustmentReview.css"),
  "utf8",
);

test("exports approve, reject, and cancel service actions", () => {
  assert.match(serviceSource, /export async function approveAndPostStockAdjustment/);
  assert.match(serviceSource, /export async function rejectStockAdjustmentRequest/);
  assert.match(serviceSource, /export async function cancelStockAdjustmentRequest/);
});

test("posting writes Product, request, movement, and operation atomically", () => {
  assert.match(serviceSource, /transaction\.update\(\s*productReference/);
  assert.match(serviceSource, /transaction\.update\(\s*requestReference/);
  assert.match(serviceSource, /transaction\.set\(\s*movementReference/);
  assert.match(serviceSource, /transaction\.set\(\s*operationReference/);
});

test("only submitted requests can be reviewed", () => {
  assert.match(serviceSource, /STOCK_ADJUSTMENT_STATUSES\.SUBMITTED/);
  assert.match(serviceSource, /Only submitted Stock Adjustment requests can be reviewed/);
});

test("uses the saved difference against current Product stock", () => {
  assert.match(serviceSource, /calculatePostedAdjustmentBalance/);
  assert.match(serviceSource, /isStaleStockAdjustmentRequest/);
  assert.match(serviceSource, /confirmStaleRequest/);
});

test("blocks Admin self-approval", () => {
  assert.match(serviceSource, /canApproveOwnStockAdjustment/);
  assert.match(serviceSource, /An Admin cannot approve and post their own/);
});

test("updates standard Product movement summary fields", () => {
  assert.match(serviceSource, /stockMovementCount/);
  assert.match(serviceSource, /lastStockMovementId/);
  assert.match(serviceSource, /lastStockMovementReason/);
  assert.match(serviceSource, /lastStockMovementQuantity/);
});

test("supports idempotent review operation replay", () => {
  assert.match(serviceSource, /isMatchingPostReplay/);
  assert.match(serviceSource, /isMatchingDecisionReplay/);
  assert.match(serviceSource, /isReplay:\s*true/);
});

test("review page lists submitted requests", () => {
  assert.match(pageSource, /function StockAdjustmentReview/);
  assert.match(pageSource, /Pending review/);
  assert.match(pageSource, /STOCK_ADJUSTMENT_STATUSES\s*\.SUBMITTED/);
});

test("review page offers approve, reject, and cancel", () => {
  assert.match(pageSource, /Approve & Post/);
  assert.match(pageSource, /Reject/);
  assert.match(pageSource, /Cancel/);
});

test("review operation ID is generated once when opening a decision", () => {
  assert.match(pageSource, /decisionOperationId/);
  assert.match(pageSource, /setDecisionOperationId\(/);
  assert.match(pageSource, /createStockAdjustmentOperationId\(/);
});

test("review page contains stale-balance acknowledgement", () => {
  assert.match(pageSource, /confirmStaleRequest/);
  assert.match(pageSource, /saved difference/);
});

test("styles are border-based without shadows", () => {
  assert.match(cssSource, /border:/);
  assert.doesNotMatch(cssSource, /box-shadow\s*:/);
});

test("Phase 6D does not add routes or Firestore Rules", () => {
  assert.doesNotMatch(pageSource, /<Route/);
  assert.doesNotMatch(serviceSource, /match \/stockAdjustment/);
});
