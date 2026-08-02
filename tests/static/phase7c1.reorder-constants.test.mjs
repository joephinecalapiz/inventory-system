import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateEstimatedReorderCost,
  calculateSuggestedReorderQuantity,
  resolveReorderStatus,
  shouldCreateReorder,
} from "../../src/constants/reorder/index.js";

test("suggested quantity restores stock to twice the reorder level", () => {
  const result = calculateSuggestedReorderQuantity({
    currentQuantity: 3,
    reorderLevel: 5,
  });

  assert.equal(result, 7);
});

test("out of stock is resolved before low stock", () => {
  const result = resolveReorderStatus({
    currentQuantity: 0,
    reorderLevel: 5,
  });

  assert.equal(result, "OUT_OF_STOCK");
});

test("purchase-order status overrides stock status", () => {
  const result = resolveReorderStatus({
    currentQuantity: 0,
    reorderLevel: 5,
    purchaseOrderStatus: "ORDERED",
  });

  assert.equal(result, "ORDERED");
});

test("shouldCreateReorder returns true for low stock", () => {
  assert.equal(
    shouldCreateReorder({
      quantity: 2,
      reorderLevel: 5,
    }),
    true,
  );
});

test("estimated reorder cost is calculated", () => {
  assert.equal(
    calculateEstimatedReorderCost({
      suggestedQuantity: 10,
      unitCost: 25.5,
    }),
    255,
  );
});
