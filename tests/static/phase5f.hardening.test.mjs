import test from "node:test";
import assert from "node:assert/strict";

import {
  readFileSync,
  statSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

function read(relativePath) {
  return readFileSync(
    resolve(process.cwd(), relativePath),
    "utf8",
  );
}

test(
  "Stock-Out operation and linking rules are installed",
  () => {
    const rules = read("firestore.rules");

    for (const token of [
      "match /stockOutOperations/{operationId}",
      "isValidStockOutOperationId",
      "stockOutOperationMatchesMovement",
      "stockOutMovementMatchesOperation",
      "stockOutProductMatchesMovementAndOperation",
      "manualStockInProductMatchesMovementAndOperation",
      "isValidProductStockUpdate(",
      "data.dateReleased <= request.time",
    ]) {
      assert.match(
        rules,
        new RegExp(
          token.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      );
    }
  },
);

test(
  "Hardened collection match blocks are unique",
  () => {
    const rules = read("firestore.rules");

    for (const block of [
      "match /products/{productId}",
      "match /stockMovements/{movementId}",
      "match /stockInOperations/{operationId}",
      "match /stockOutOperations/{operationId}",
    ]) {
      assert.equal(
        rules.split(block).length - 1,
        1,
        `${block} must appear exactly once`,
      );
    }
  },
);

test(
  "Legacy broad Stock-Out schema was removed",
  () => {
    const rules = read("firestore.rules");

    assert.match(
      rules,
      /"operationId"/,
    );

    assert.match(
      rules,
      /"dateReleased"/,
    );

    assert.match(
      rules,
      /"releasedBy"/,
    );

    assert.match(
      rules,
      /"totalCost"/,
    );

    assert.doesNotMatch(
      rules,
      /data\.lastStockMovementUnitCost == 0/,
    );
  },
);

test(
  "Rules source remains below the Firebase 256 KB source limit",
  () => {
    const size = statSync(
      resolve(
        process.cwd(),
        "firestore.rules",
      ),
    ).size;

    assert.ok(
      size < 256 * 1024,
      `Rules source is ${size} bytes`,
    );
  },
);

test(
  "Stock-Out service stores release dates at local midnight",
  () => {
    const service = read(
      "src/services/stockOutService.js",
    );

    assert.match(
      service,
      /Number\(dayText\),\s*0,\s*0,\s*0,\s*0,/s,
    );

    assert.doesNotMatch(
      service,
      /Number\(dayText\),\s*12,\s*0,\s*0,\s*0,/s,
    );

    assert.match(
      service,
      /stockOutOperations/,
    );

    assert.match(
      service,
      /stockMovements/,
    );
  },
);
