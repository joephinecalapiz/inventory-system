import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "src/services/stockAdjustmentService.js",
  "utf8",
);

const start = source.indexOf(
  "export async function createStockAdjustmentRequest",
);
const end = source.indexOf(
  "function getFirestoreDateMilliseconds",
  start,
);

assert.ok(start >= 0 && end > start);

const createSource = source.slice(start, end);

test("uses a write batch for the two atomic create writes", () => {
  assert.match(createSource, /const batch = writeBatch\(db\)/);
  assert.match(createSource, /batch\.set\(requestReference, requestData\)/);
  assert.match(createSource, /batch\.set\(operationReference, operationData\)/);
  assert.match(createSource, /await batch\.commit\(\)/);
});

test("does not run the request creation inside a Firestore transaction", () => {
  assert.doesNotMatch(createSource, /runTransaction\(/);
  assert.doesNotMatch(createSource, /transaction\.get\(/);
  assert.doesNotMatch(createSource, /transaction\.set\(/);
});

test("keeps duplicate replay validation", () => {
  assert.match(createSource, /async function loadExistingReplay/);
  assert.match(createSource, /isSameCreateRequest/);
  assert.match(createSource, /isReplay:\s*true/);
});

test("reads current Product data before building the batch", () => {
  const productRead = createSource.indexOf(
    "const productSnapshot = await getDoc(productReference)",
  );
  const batchCreate = createSource.indexOf("const batch = writeBatch(db)");

  assert.ok(productRead >= 0);
  assert.ok(batchCreate > productRead);
});
