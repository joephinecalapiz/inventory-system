import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateInventoryValueByCategory,
  aggregateMonthlyStockInOut,
  aggregateMostIssuedProducts,
  buildRecentStockMovements,
} from "../../src/utils/dashboard/stockMovementAggregation.js";

test("monthly stock movement aggregation separates in and out", () => {
  const result = aggregateMonthlyStockInOut(
    [
      {
        transactionType: "STOCK_IN",
        quantityChanged: 10,
        transactionDate: new Date("2026-08-02T08:00:00"),
      },
      {
        transactionType: "STOCK_OUT",
        quantityChanged: -4,
        transactionDate: new Date("2026-08-02T10:00:00"),
      },
    ],
    new Date("2026-08-15T00:00:00"),
  );

  assert.equal(result.stockIn[1], 10);
  assert.equal(result.stockOut[1], 4);
  assert.equal(result.totals.stockIn, 10);
  assert.equal(result.totals.stockOut, 4);
});

test("inventory value by category uses cost and quantity", () => {
  const result = aggregateInventoryValueByCategory([
    {
      category: "VALVES",
      quantity: 5,
      costPrice: 100,
    },
    {
      category: "VALVES",
      quantity: 2,
      costPrice: 50,
    },
  ]);

  assert.equal(result[0].name, "VALVES");
  assert.equal(result[0].value, 600);
});

test("most issued products aggregates outbound quantity", () => {
  const result = aggregateMostIssuedProducts([
    {
      productId: "P1",
      productName: "Product One",
      transactionType: "STOCK_OUT",
      quantityChanged: -3,
    },
    {
      productId: "P1",
      productName: "Product One",
      transactionType: "ADJUSTMENT_DECREASE",
      quantityChanged: -2,
    },
  ]);

  assert.equal(result[0].quantityIssued, 5);
  assert.equal(result[0].transactionCount, 2);
});

test("recent movements are sorted newest first", () => {
  const result = buildRecentStockMovements([
    {
      id: "old",
      productName: "Old",
      transactionType: "STOCK_IN",
      quantityChanged: 1,
      transactionDate: new Date("2026-08-01T08:00:00"),
    },
    {
      id: "new",
      productName: "New",
      transactionType: "STOCK_OUT",
      quantityChanged: -1,
      transactionDate: new Date("2026-08-02T08:00:00"),
    },
  ]);

  assert.equal(result[0].id, "new");
  assert.equal(result[1].id, "old");
});
