import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceSource =
  fs.readFileSync(
    "src/services/stockAdjustmentService.js",
    "utf8",
  );

const createStart =
  serviceSource.indexOf(
    "export async function createStockAdjustmentRequest",
  );

const createEnd =
  serviceSource.indexOf(
    "function getFirestoreDateMilliseconds",
    createStart,
  );

assert.ok(
  createStart >= 0 &&
  createEnd > createStart,
  "Unable to isolate createStockAdjustmentRequest().",
);

const createRequestSource =
  serviceSource.slice(
    createStart,
    createEnd,
  );

test(
  "new request checks the operation before Product stock",
  () => {
    const operationRead =
      /transaction\.get\(\s*operationReference\s*,?\s*\)/.exec(
        createRequestSource,
      );

    const productRead =
      /transaction\.get\(\s*productReference\s*,?\s*\)/.exec(
        createRequestSource,
      );

    assert.ok(
      operationRead,
      "Missing operation idempotency read.",
    );

    assert.ok(
      productRead,
      "Missing Product read.",
    );

    assert.ok(
      operationRead.index <
        productRead.index,
      "Operation must be checked before Product.",
    );
  },
);

test(
  "new-request path has no redundant requestSnapshot read",
  () => {
    assert.doesNotMatch(
      createRequestSource,
      /const requestSnapshot\s*=\s*await transaction\.get\(\s*requestReference/,
    );
  },
);

test(
  "replay path still loads the linked existing request",
  () => {
    assert.match(
      createRequestSource,
      /const existingRequestSnapshot\s*=\s*await transaction\.get\(\s*requestReference/,
    );
  },
);

test(
  "request and operation remain atomic transaction writes",
  () => {
    assert.match(
      createRequestSource,
      /transaction\.set\(\s*requestReference,\s*requestData/,
    );

    assert.match(
      createRequestSource,
      /transaction\.set\(\s*operationReference,\s*operationData/,
    );
  },
);
