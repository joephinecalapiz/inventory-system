import assert from "node:assert/strict";
import test from "node:test";

import {
  STOCK_ADJUSTMENT_DIRECTIONS,
  STOCK_ADJUSTMENT_OPERATION_TYPES,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_ADJUSTMENT_STATUSES,
  calculatePostedAdjustmentBalance,
  calculateStockAdjustmentDifference,
  calculateStockAdjustmentValue,
  canApproveOwnStockAdjustment,
  canRoleCreateStockAdjustment,
  canRolePostStockAdjustment,
  canRoleViewStockAdjustmentHistory,
  createEmptyStockAdjustmentForm,
  createStockAdjustmentId,
  createStockAdjustmentOperationId,
  getStockAdjustmentDirection,
  isAdjustmentReasonAllowedForDirection,
  isFinalStockAdjustmentStatus,
  isPersistedStockAdjustmentStatus,
  isStaleStockAdjustmentRequest,
  isValidStockAdjustmentDate,
  isValidStockAdjustmentId,
  isValidStockAdjustmentOperationId,
  isValidStockAdjustmentQuantity,
} from "../../src/constants/stockAdjustment.js";

import {
  USER_ROLES,
} from "../../src/constants/roles.js";

test("calculates positive and negative differences", () => {
  assert.equal(
    calculateStockAdjustmentDifference(100, 96),
    -4,
  );

  assert.equal(
    calculateStockAdjustmentDifference(50, 53),
    3,
  );
});

test("rejects invalid quantities", () => {
  assert.equal(
    isValidStockAdjustmentQuantity(0),
    true,
  );

  assert.equal(
    isValidStockAdjustmentQuantity(-1),
    false,
  );

  assert.equal(
    isValidStockAdjustmentQuantity(2.5),
    false,
  );
});

test("derives adjustment direction", () => {
  assert.equal(
    getStockAdjustmentDirection(3),
    STOCK_ADJUSTMENT_DIRECTIONS.IN,
  );

  assert.equal(
    getStockAdjustmentDirection(-3),
    STOCK_ADJUSTMENT_DIRECTIONS.OUT,
  );

  assert.equal(
    getStockAdjustmentDirection(0),
    null,
  );
});

test("enforces reason and direction restrictions", () => {
  assert.equal(
    isAdjustmentReasonAllowedForDirection(
      STOCK_ADJUSTMENT_REASONS
        .UNRECORDED_STOCK_FOUND,
      STOCK_ADJUSTMENT_DIRECTIONS.IN,
    ),
    true,
  );

  assert.equal(
    isAdjustmentReasonAllowedForDirection(
      STOCK_ADJUSTMENT_REASONS
        .UNRECORDED_STOCK_FOUND,
      STOCK_ADJUSTMENT_DIRECTIONS.OUT,
    ),
    false,
  );

  assert.equal(
    isAdjustmentReasonAllowedForDirection(
      STOCK_ADJUSTMENT_REASONS
        .LOSS_OR_SHORTAGE,
      STOCK_ADJUSTMENT_DIRECTIONS.OUT,
    ),
    true,
  );
});

test("applies the request difference to current stock", () => {
  assert.equal(
    calculatePostedAdjustmentBalance(98, -4),
    94,
  );

  assert.equal(
    calculatePostedAdjustmentBalance(20, 3),
    23,
  );

  assert.equal(
    calculatePostedAdjustmentBalance(2, -4),
    null,
  );
});

test("detects stale requests", () => {
  assert.equal(
    isStaleStockAdjustmentRequest(100, 100),
    false,
  );

  assert.equal(
    isStaleStockAdjustmentRequest(100, 98),
    true,
  );
});

test("calculates absolute adjustment value", () => {
  assert.equal(
    calculateStockAdjustmentValue(-4, 250),
    1000,
  );

  assert.equal(
    calculateStockAdjustmentValue(3, 10.25),
    30.75,
  );
});

test("validates real calendar dates", () => {
  assert.equal(
    isValidStockAdjustmentDate("2026-07-29"),
    true,
  );

  assert.equal(
    isValidStockAdjustmentDate("2026-02-30"),
    false,
  );
});

test("generates valid request and operation IDs", () => {
  const adjustmentId =
    createStockAdjustmentId();

  const createOperationId =
    createStockAdjustmentOperationId(
      STOCK_ADJUSTMENT_OPERATION_TYPES
        .CREATE_REQUEST,
    );

  const postOperationId =
    createStockAdjustmentOperationId(
      STOCK_ADJUSTMENT_OPERATION_TYPES
        .POST_ADJUSTMENT,
    );

  assert.equal(
    isValidStockAdjustmentId(adjustmentId),
    true,
  );

  assert.equal(
    isValidStockAdjustmentOperationId(
      createOperationId,
    ),
    true,
  );

  assert.equal(
    isValidStockAdjustmentOperationId(
      postOperationId,
    ),
    true,
  );
});

test("creates a fresh form with request IDs", () => {
  const form =
    createEmptyStockAdjustmentForm(
      "product-123",
    );

  assert.equal(
    form.productId,
    "product-123",
  );

  assert.equal(
    isValidStockAdjustmentId(
      form.adjustmentId,
    ),
    true,
  );

  assert.equal(
    isValidStockAdjustmentOperationId(
      form.createOperationId,
    ),
    true,
  );

  assert.equal(
    form.reason,
    STOCK_ADJUSTMENT_REASONS
      .PHYSICAL_COUNT_CORRECTION,
  );
});

test("defines persisted and final statuses", () => {
  assert.equal(
    isPersistedStockAdjustmentStatus(
      STOCK_ADJUSTMENT_STATUSES.DRAFT,
    ),
    false,
  );

  assert.equal(
    isPersistedStockAdjustmentStatus(
      STOCK_ADJUSTMENT_STATUSES.SUBMITTED,
    ),
    true,
  );

  assert.equal(
    isFinalStockAdjustmentStatus(
      STOCK_ADJUSTMENT_STATUSES.POSTED,
    ),
    true,
  );
});

test("enforces create, post, and history permissions", () => {
  assert.equal(
    canRoleCreateStockAdjustment(
      USER_ROLES.INVENTORY_STAFF,
    ),
    true,
  );

  assert.equal(
    canRolePostStockAdjustment(
      USER_ROLES.INVENTORY_STAFF,
    ),
    false,
  );

  assert.equal(
    canRoleViewStockAdjustmentHistory(
      USER_ROLES.AUDITOR,
    ),
    true,
  );

  assert.equal(
    canRoleViewStockAdjustmentHistory(
      USER_ROLES.CASHIER,
    ),
    false,
  );
});

test("blocks Admin self-approval but permits Superadmin", () => {
  assert.equal(
    canApproveOwnStockAdjustment(
      USER_ROLES.ADMIN,
      "same-user",
      "same-user",
    ),
    false,
  );

  assert.equal(
    canApproveOwnStockAdjustment(
      USER_ROLES.SUPERADMIN,
      "same-user",
      "same-user",
    ),
    true,
  );

  assert.equal(
    canApproveOwnStockAdjustment(
      USER_ROLES.ADMIN,
      "requester",
      "reviewer",
    ),
    true,
  );
});
