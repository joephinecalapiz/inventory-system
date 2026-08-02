import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyMovementSeries,
  calculateMovingAverage,
  calculateTrend,
} from "../../src/utils/dashboard/dashboardTrends.js";

test("trend calculation detects increase", () => {
  const result = calculateTrend({
    currentValue: 150,
    previousValue: 100,
  });

  assert.equal(result.direction, "UP");
  assert.equal(result.percentage, 50);
  assert.equal(result.difference, 50);
});

test("trend calculation handles zero previous value", () => {
  const result = calculateTrend({
    currentValue: 20,
    previousValue: 0,
  });

  assert.equal(result.direction, "UP");
  assert.equal(result.percentage, 100);
  assert.equal(result.hasComparablePreviousValue, false);
});

test("moving average uses available values at series start", () => {
  const result = calculateMovingAverage(
    [2, 4, 6, 8],
    3,
  );

  assert.deepEqual(result, [2, 3, 4, 6]);
});

test("daily movement series separates stock in and out", () => {
  const result = buildDailyMovementSeries({
    transactions: [
      {
        quantityChanged: 10,
        transactionDate: new Date("2026-08-01T08:00:00"),
      },
      {
        quantityChanged: -4,
        transactionDate: new Date("2026-08-01T09:00:00"),
      },
    ],
    days: 3,
    referenceDate: new Date("2026-08-02T12:00:00"),
  });

  const augustFirst = result.points.find(
    (point) => point.key === "2026-08-01",
  );

  assert.equal(augustFirst.stockIn, 10);
  assert.equal(augustFirst.stockOut, 4);
  assert.equal(augustFirst.netMovement, 6);
});
