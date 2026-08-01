import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  assert.equal(
    fs.existsSync(path),
    true,
    `Missing required file: ${path}`,
  );

  return fs.readFileSync(path, "utf8");
}

const inventorySource =
  read("src/pages/Inventory.jsx");

const stockOutPageSource =
  read("src/pages/StockOut.jsx");

const stockOutServiceSource =
  read("src/services/stockOutService.js");

const purchaseOrderServiceSource =
  read("src/services/purchaseOrderService.js");

test(
  "Inventory Stock Out navigates to the dedicated page",
  () => {
    assert.doesNotMatch(
      inventorySource,
      /\badjustProductStock\b/,
    );

    assert.match(
      inventorySource,
      /function handleOpenStockOut/,
    );

    assert.match(
      inventorySource,
      /navigate\(`\/stock-out\?productId=/,
    );

    assert.match(
      inventorySource,
      /onClick=\{\(\) => handleOpenStockOut\(product\)\}/,
    );
  },
);

test(
  "Stock Out page accepts the Inventory product query",
  () => {
    assert.match(
      stockOutPageSource,
      /useSearchParams/,
    );

    assert.match(
      stockOutPageSource,
      /searchParams\.get\("productId"\)/,
    );

    assert.match(
      stockOutPageSource,
      /createEmptyStockOutForm\(requestedProductId\)/,
    );

    assert.match(
      stockOutPageSource,
      /if \(isLoading \|\| !form\.productId \|\| selectedProduct\)/,
    );
  },
);

test(
  "Stock Out runtime writes use a separate-read atomic batch",
  () => {
    const functionStart =
      stockOutServiceSource.indexOf(
        "export async function createStockOutReceipt",
      );

    const functionEnd =
      stockOutServiceSource.indexOf(
        "function getFirestoreDateMilliseconds",
        functionStart,
      );

    const functionSource =
      stockOutServiceSource.slice(
        functionStart,
        functionEnd,
      );

    assert.doesNotMatch(
      functionSource,
      /\brunTransaction\s*\(/,
    );

    assert.match(
      functionSource,
      /getDoc\(operationReference\)/,
    );

    assert.match(
      functionSource,
      /getDoc\(productReference\)/,
    );

    assert.match(
      functionSource,
      /const batch = writeBatch\(db\)/,
    );

    assert.match(
      functionSource,
      /batch\.update\(productReference/,
    );

    assert.match(
      functionSource,
      /batch\.set\(movementReference/,
    );

    assert.match(
      functionSource,
      /batch\.set\(operationReference/,
    );

    assert.match(
      functionSource,
      /await batch\.commit\(\)/,
    );
  },
);

test(
  "Purchase Order creation writes the missing counter update",
  () => {
    const functionStart =
      purchaseOrderServiceSource.indexOf(
        "export async function createPurchaseOrderDraft",
      );

    const functionEnd =
      purchaseOrderServiceSource.indexOf(
        "/**\n * Updates a Purchase Order",
        functionStart,
      );

    const functionSource =
      purchaseOrderServiceSource.slice(
        functionStart,
        functionEnd,
      );

    assert.match(
      functionSource,
      /Promise\.all\(\[/,
    );

    assert.match(
      functionSource,
      /getDoc\(supplierReference\)/,
    );

    assert.match(
      functionSource,
      /productReferences\.map\(\(productReference\) => getDoc\(productReference\)\)/,
    );

    assert.match(
      functionSource,
      /transaction\.get\(counterReference\)/,
    );

    assert.match(
      functionSource,
      /transaction\.set\(\s*counterReference,/,
    );

    assert.match(
      functionSource,
      /lastSequence: nextSequence/,
    );

    assert.match(
      functionSource,
      /merge: true/,
    );

    assert.match(
      functionSource,
      /transaction\.set\(purchaseOrderReference/,
    );
  },
);
