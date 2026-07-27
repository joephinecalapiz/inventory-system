import test, {
  after,
  before,
  beforeEach,
} from "node:test";

import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import {
  TEST_IDS,
  TEST_PROJECT_ID,
  TEST_USERS,
  seedPhase4I3Data,
} from "./phase4i3.fixtures.mjs";

let testEnv;

function authenticatedDb(userKey) {
  const user = TEST_USERS[userKey];

  return testEnv
    .authenticatedContext(user.uid)
    .firestore();
}

function unauthenticatedDb() {
  return testEnv
    .unauthenticatedContext()
    .firestore();
}

async function commitValidManualStockIn(db) {
  const operationId =
    "stockin_operation_phase4i3_0001";

  const productReference = doc(
    db,
    "products",
    TEST_IDS.product,
  );

  const movementReference = doc(
    db,
    "stockMovements",
    operationId,
  );

  const operationReference = doc(
    db,
    "stockInOperations",
    operationId,
  );

  const dateReceived = Timestamp.fromDate(
    new Date("2026-07-24T04:00:00.000Z"),
  );

  const batch = writeBatch(db);

  batch.update(productReference, {
    quantity: 15,
    costPrice: 12.5,

    hasStockHistory: true,
    stockMovementCount: 1,

    lastStockMovementId: operationId,
    lastStockMovementType: "IN",
    lastStockMovementReason: "MANUAL_STOCK_IN",
    lastStockMovementQuantity: 5,
    lastStockMovementUnitCost: 12.5,
    lastStockMovementAt: serverTimestamp(),

    updatedBy: TEST_USERS.inventory.uid,
    updatedAt: serverTimestamp(),
  });

  batch.set(movementReference, {
    movementId: operationId,
    operationId,

    movementType: "IN",
    reason: "MANUAL_STOCK_IN",

    productId: TEST_IDS.product,
    productName: "Water Meter",
    productSku: "WAME",

    quantity: 5,
    previousQuantity: 10,
    newQuantity: 15,

    unitCost: 12.5,
    totalCost: 62.5,

    source: "Test Warehouse",
    referenceNumber: "DR-PHASE4I3-001",
    dateReceived,

    receivedBy: TEST_USERS.inventory.uid,
    receivedByName:
      TEST_USERS.inventory.displayName,

    createdBy: TEST_USERS.inventory.uid,
    createdAt: serverTimestamp(),

    category: "WATER METERS",
    categoryCode: "WATER_METERS",
    unitCode: "PCS",
    unitName: "Pieces",
    unitAbbreviation: "PCS",
  });

  batch.set(operationReference, {
    operationId,
    status: "COMPLETED",
    movementId: operationId,

    productId: TEST_IDS.product,
    productName: "Water Meter",
    productSku: "WAME",

    quantityReceived: 5,
    previousQuantity: 10,
    newQuantity: 15,

    unitCost: 12.5,
    totalCost: 62.5,

    source: "Test Warehouse",
    referenceNumber: "DR-PHASE4I3-001",
    dateReceived,
    dateReceivedKey: "2026-07-24",

    reason: "MANUAL_STOCK_IN",
    remarks: "",

    receivedBy: TEST_USERS.inventory.uid,
    receivedByName:
      TEST_USERS.inventory.displayName,

    createdBy: TEST_USERS.inventory.uid,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return operationId;
}

before(async () => {
  const rules = readFileSync(
    resolve(process.cwd(), "firestore.rules"),
    "utf8",
  );

  testEnv = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,

    firestore: {
      rules,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedPhase4I3Data(testEnv);
});

test(
  "unauthenticated users cannot read protected inventory data",
  async () => {
    const db = unauthenticatedDb();

    await assertFails(
      getDoc(
        doc(db, "products", TEST_IDS.product),
      ),
    );

    await assertFails(
      getDoc(
        doc(
          db,
          "purchaseOrders",
          TEST_IDS.purchaseOrder,
        ),
      ),
    );
  },
);

test(
  "inactive accounts cannot read protected inventory data",
  async () => {
    const db = authenticatedDb("inactive");

    await assertFails(
      getDoc(
        doc(db, "products", TEST_IDS.product),
      ),
    );

    await assertFails(
      getDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
        ),
      ),
    );
  },
);

test(
  "Cashier can read products for POS but cannot read procurement records",
  async () => {
    const db = authenticatedDb("cashier");

    await assertSucceeds(
      getDoc(
        doc(db, "products", TEST_IDS.product),
      ),
    );

    await assertFails(
      getDoc(
        doc(db, "suppliers", TEST_IDS.supplier),
      ),
    );

    await assertFails(
      getDoc(
        doc(
          db,
          "purchaseOrders",
          TEST_IDS.purchaseOrder,
        ),
      ),
    );

    await assertFails(
      getDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
        ),
      ),
    );

    await assertFails(
      getDoc(
        doc(
          db,
          "stockMovements",
          TEST_IDS.stockMovement,
        ),
      ),
    );
  },
);

test(
  "Auditor can read procurement and inventory history",
  async () => {
    const db = authenticatedDb("auditor");

    await assertSucceeds(
      getDoc(
        doc(db, "products", TEST_IDS.product),
      ),
    );

    await assertSucceeds(
      getDocs(collection(db, "suppliers")),
    );

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "purchaseOrders",
          TEST_IDS.purchaseOrder,
        ),
      ),
    );

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "purchaseOrders",
          TEST_IDS.purchaseOrder,
          "items",
          TEST_IDS.product,
        ),
      ),
    );

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
        ),
      ),
    );

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
          "items",
          TEST_IDS.product,
        ),
      ),
    );

    await assertSucceeds(
      getDocs(collection(db, "stockMovements")),
    );
  },
);

test(
  "Auditor cannot modify products, POs, receipts, or movements",
  async () => {
    const db = authenticatedDb("auditor");

    await assertFails(
      updateDoc(
        doc(db, "products", TEST_IDS.product),
        {
          quantity: 999,
        },
      ),
    );

    await assertFails(
      updateDoc(
        doc(
          db,
          "purchaseOrders",
          TEST_IDS.purchaseOrder,
        ),
        {
          status: "APPROVED",
        },
      ),
    );

    await assertFails(
      updateDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
        ),
        {
          remarks: "Changed by auditor",
        },
      ),
    );

    await assertFails(
      deleteDoc(
        doc(
          db,
          "stockMovements",
          TEST_IDS.stockMovement,
        ),
      ),
    );
  },
);

test(
  "Inventory Staff cannot directly tamper with product quantity",
  async () => {
    const db = authenticatedDb("inventory");

    await assertFails(
      updateDoc(
        doc(db, "products", TEST_IDS.product),
        {
          quantity: 999,
          updatedBy: TEST_USERS.inventory.uid,
          updatedAt: serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Admin cannot directly change permanent product identity fields",
  async () => {
    const db = authenticatedDb("admin");

    await assertFails(
      updateDoc(
        doc(db, "products", TEST_IDS.product),
        {
          sku: "FORGED-SKU",
          updatedBy: TEST_USERS.admin.uid,
          updatedAt: serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Malformed stock movement creation is denied",
  async () => {
    const db = authenticatedDb("inventory");

    await assertFails(
      setDoc(
        doc(
          db,
          "stockMovements",
          "fake_movement_phase4i3",
        ),
        {
          movementId:
            "fake_movement_phase4i3",
          movementType: "IN",
          reason: "PURCHASE_RECEIPT",
          productId: TEST_IDS.product,
          quantity: 5000,
          createdBy:
            TEST_USERS.inventory.uid,
          createdAt: serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Stock movement documents are immutable",
  async () => {
    const db = authenticatedDb("admin");

    const reference = doc(
      db,
      "stockMovements",
      TEST_IDS.stockMovement,
    );

    await assertFails(
      updateDoc(reference, {
        quantity: 999,
      }),
    );

    await assertFails(
      deleteDoc(reference),
    );
  },
);

test(
  "Goods Receipt headers and items are immutable",
  async () => {
    const db = authenticatedDb("admin");

    await assertFails(
      updateDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
        ),
        {
          totalValue: 0,
        },
      ),
    );

    await assertFails(
      deleteDoc(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
          "items",
          TEST_IDS.product,
        ),
      ),
    );
  },
);

test(
  "valid manual Stock-In atomic batch succeeds for Inventory Staff",
  async () => {
    const db = authenticatedDb("inventory");

    const operationId =
      await assertSucceeds(
        commitValidManualStockIn(db),
      );

    const productSnapshot =
      await assertSucceeds(
        getDoc(
          doc(
            db,
            "products",
            TEST_IDS.product,
          ),
        ),
      );

    const operationSnapshot =
      await assertSucceeds(
        getDoc(
          doc(
            db,
            "stockInOperations",
            operationId,
          ),
        ),
      );

    const movementSnapshot =
      await assertSucceeds(
        getDoc(
          doc(
            db,
            "stockMovements",
            operationId,
          ),
        ),
      );

    assert.equal(
      productSnapshot.data().quantity,
      15,
    );

    assert.equal(
      productSnapshot.data().stockMovementCount,
      1,
    );

    assert.equal(
      productSnapshot.data().lastStockMovementId,
      operationId,
    );

    assert.equal(
      operationSnapshot.data().movementId,
      operationId,
    );

    assert.equal(
      movementSnapshot.data().operationId,
      operationId,
    );
  },
);

test(
  "completed Stock-In operation and movement cannot be overwritten",
  async () => {
    const db = authenticatedDb("inventory");

    const operationId =
      await commitValidManualStockIn(db);

    await assertFails(
      updateDoc(
        doc(
          db,
          "stockInOperations",
          operationId,
        ),
        {
          totalCost: 0,
        },
      ),
    );

    await assertFails(
      updateDoc(
        doc(
          db,
          "stockMovements",
          operationId,
        ),
        {
          quantity: 999,
        },
      ),
    );
  },
);

test(
  "Admin can approve a Submitted PO and synchronize its item status",
  async () => {
    const db = authenticatedDb("admin");
    const batch = writeBatch(db);

    batch.update(
      doc(
        db,
        "purchaseOrders",
        TEST_IDS.purchaseOrder,
      ),
      {
        status: "APPROVED",

        approvedBy: TEST_USERS.admin.uid,
        approvedByName:
          TEST_USERS.admin.displayName,
        approvedAt: serverTimestamp(),

        revision: 3,
        updatedBy: TEST_USERS.admin.uid,
        updatedAt: serverTimestamp(),
      },
    );

    batch.update(
      doc(
        db,
        "purchaseOrders",
        TEST_IDS.purchaseOrder,
        "items",
        TEST_IDS.product,
      ),
      {
        poStatus: "APPROVED",
        updatedBy: TEST_USERS.admin.uid,
        updatedAt: serverTimestamp(),
      },
    );

    await assertSucceeds(batch.commit());

    const poSnapshot = await getDoc(
      doc(
        db,
        "purchaseOrders",
        TEST_IDS.purchaseOrder,
      ),
    );

    const itemSnapshot = await getDoc(
      doc(
        db,
        "purchaseOrders",
        TEST_IDS.purchaseOrder,
        "items",
        TEST_IDS.product,
      ),
    );

    assert.equal(
      poSnapshot.data().status,
      "APPROVED",
    );

    assert.equal(
      itemSnapshot.data().poStatus,
      "APPROVED",
    );
  },
);

test(
  "Inventory Staff cannot approve a Submitted PO",
  async () => {
    const db = authenticatedDb("inventory");
    const batch = writeBatch(db);

    batch.update(
      doc(
        db,
        "purchaseOrders",
        TEST_IDS.purchaseOrder,
      ),
      {
        status: "APPROVED",

        approvedBy: TEST_USERS.inventory.uid,
        approvedByName:
          TEST_USERS.inventory.displayName,
        approvedAt: serverTimestamp(),

        revision: 3,
        updatedBy: TEST_USERS.inventory.uid,
        updatedAt: serverTimestamp(),
      },
    );

    batch.update(
      doc(
        db,
        "purchaseOrders",
        TEST_IDS.purchaseOrder,
        "items",
        TEST_IDS.product,
      ),
      {
        poStatus: "APPROVED",
        updatedBy: TEST_USERS.inventory.uid,
        updatedAt: serverTimestamp(),
      },
    );

    await assertFails(batch.commit());
  },
);

test(
  "only Admin or Superadmin may delete a zero-stock product with no history",
  async () => {
    const inventoryDb =
      authenticatedDb("inventory");

    await assertFails(
      deleteDoc(
        doc(
          inventoryDb,
          "products",
          TEST_IDS.cleanProduct,
        ),
      ),
    );

    const adminDb =
      authenticatedDb("admin");

    await assertSucceeds(
      deleteDoc(
        doc(
          adminDb,
          "products",
          TEST_IDS.cleanProduct,
        ),
      ),
    );
  },
);
