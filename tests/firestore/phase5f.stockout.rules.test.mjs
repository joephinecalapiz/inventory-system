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
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import {
  PHASE5F_PRODUCT_ID,
  PHASE5F_PROJECT_ID,
  PHASE5F_USERS,
  seedPhase5fData,
} from "./phase5f.fixtures.mjs";

let testEnv;
let operationCounter = 0;

function authenticatedDb(userKey) {
  const user = PHASE5F_USERS[userKey];

  return testEnv
    .authenticatedContext(user.uid)
    .firestore();
}

function createOperationId() {
  operationCounter += 1;

  return (
    "stockout_phase5f_" +
    String(operationCounter).padStart(
      6,
      "0",
    )
  );
}

function pastReleaseDate() {
  return Timestamp.fromDate(
    new Date(
      Date.now() -
        24 * 60 * 60 * 1000,
    ),
  );
}

function futureReleaseDate() {
  return Timestamp.fromDate(
    new Date(
      Date.now() +
        24 * 60 * 60 * 1000,
    ),
  );
}

function releaseDateKey(timestamp) {
  return timestamp
    .toDate()
    .toISOString()
    .slice(0, 10);
}

function createStockOutDocuments({
  operationId,
  userKey = "admin",
  reason = "MANUAL_STOCK_OUT",
  destination = "",
  quantity = 5,
  previousQuantity = 10,
  newQuantity =
    previousQuantity - quantity,
  unitCost = 10,
  totalCost = quantity * unitCost,
  referenceNumber = "REQ-PHASE5F-001",
  dateReleased = pastReleaseDate(),
  remarks = "",
  movementOverrides = {},
  operationOverrides = {},
} = {}) {
  const user = PHASE5F_USERS[userKey];

  const movement = {
    movementId: operationId,
    operationId,

    movementType: "OUT",
    reason,

    productId: PHASE5F_PRODUCT_ID,
    productName: "Water Meter",
    productSku: "WAME",

    quantity,
    previousQuantity,
    newQuantity,

    unitCost,
    totalCost,

    destination,
    referenceNumber,
    dateReleased,

    releasedBy: user.uid,
    releasedByName: user.displayName,

    createdBy: user.uid,
    createdAt: serverTimestamp(),

    barcode: "100000000001",
    category: "WATER METERS",
    categoryCode: "WATER_METERS",

    unitCode: "PCS",
    unitName: "Pieces",
    unitAbbreviation: "PCS",

    ...movementOverrides,
  };

  if (remarks) {
    movement.remarks = remarks;
  }

  const operation = {
    operationId,
    status: "COMPLETED",
    movementId: operationId,

    productId: PHASE5F_PRODUCT_ID,
    productName: "Water Meter",
    productSku: "WAME",

    quantityReleased: quantity,
    previousQuantity,
    newQuantity,

    unitCost,
    totalCost,

    destination,
    referenceNumber,
    dateReleased,
    dateReleasedKey:
      releaseDateKey(dateReleased),

    reason,
    remarks,

    releasedBy: user.uid,
    releasedByName: user.displayName,

    createdBy: user.uid,
    createdAt: serverTimestamp(),

    ...operationOverrides,
  };

  return {
    movement,
    operation,
  };
}

async function commitStockOut({
  db,
  operationId = createOperationId(),
  userKey = "admin",
  reason = "MANUAL_STOCK_OUT",
  destination = "",
  quantity = 5,
  previousQuantity = 10,
  newQuantity =
    previousQuantity - quantity,
  unitCost = 10,
  totalCost = quantity * unitCost,
  referenceNumber = "REQ-PHASE5F-001",
  dateReleased = pastReleaseDate(),
  remarks = "",
  productUpdateOverrides = {},
  movementOverrides = {},
  operationOverrides = {},
} = {}) {
  const user = PHASE5F_USERS[userKey];

  const {
    movement,
    operation,
  } = createStockOutDocuments({
    operationId,
    userKey,
    reason,
    destination,
    quantity,
    previousQuantity,
    newQuantity,
    unitCost,
    totalCost,
    referenceNumber,
    dateReleased,
    remarks,
    movementOverrides,
    operationOverrides,
  });

  const batch = writeBatch(db);

  batch.update(
    doc(
      db,
      "products",
      PHASE5F_PRODUCT_ID,
    ),
    {
      quantity: newQuantity,

      hasStockHistory: true,
      stockMovementCount: 1,

      lastStockMovementId:
        operationId,

      lastStockMovementType: "OUT",

      lastStockMovementReason:
        reason,

      lastStockMovementQuantity:
        quantity,

      lastStockMovementUnitCost:
        unitCost,

      lastStockMovementAt:
        serverTimestamp(),

      updatedBy: user.uid,
      updatedAt: serverTimestamp(),

      ...productUpdateOverrides,
    },
  );

  batch.set(
    doc(
      db,
      "stockMovements",
      operationId,
    ),
    movement,
  );

  batch.set(
    doc(
      db,
      "stockOutOperations",
      operationId,
    ),
    operation,
  );

  await batch.commit();

  return operationId;
}

async function commitValidStockIn({
  db,
  userKey = "inventory",
} = {}) {
  const user = PHASE5F_USERS[userKey];

  const operationId =
    "stockin_phase5f_regression_001";

  const dateReceived =
    pastReleaseDate();

  const batch = writeBatch(db);

  batch.update(
    doc(
      db,
      "products",
      PHASE5F_PRODUCT_ID,
    ),
    {
      quantity: 13,
      costPrice: 12,

      hasStockHistory: true,
      stockMovementCount: 1,

      lastStockMovementId:
        operationId,

      lastStockMovementType: "IN",

      lastStockMovementReason:
        "MANUAL_STOCK_IN",

      lastStockMovementQuantity: 3,

      lastStockMovementUnitCost: 12,

      lastStockMovementAt:
        serverTimestamp(),

      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    },
  );

  batch.set(
    doc(
      db,
      "stockMovements",
      operationId,
    ),
    {
      movementId: operationId,
      operationId,

      movementType: "IN",
      reason: "MANUAL_STOCK_IN",

      productId: PHASE5F_PRODUCT_ID,
      productName: "Water Meter",
      productSku: "WAME",

      quantity: 3,
      previousQuantity: 10,
      newQuantity: 13,

      unitCost: 12,
      totalCost: 36,

      source: "Test Warehouse",
      referenceNumber:
        "DR-PHASE5F-001",
      dateReceived,

      receivedBy: user.uid,
      receivedByName:
        user.displayName,

      createdBy: user.uid,
      createdAt: serverTimestamp(),
    },
  );

  batch.set(
    doc(
      db,
      "stockInOperations",
      operationId,
    ),
    {
      operationId,
      status: "COMPLETED",
      movementId: operationId,

      productId: PHASE5F_PRODUCT_ID,
      productName: "Water Meter",
      productSku: "WAME",

      quantityReceived: 3,
      previousQuantity: 10,
      newQuantity: 13,

      unitCost: 12,
      totalCost: 36,

      source: "Test Warehouse",
      referenceNumber:
        "DR-PHASE5F-001",
      dateReceived,
      dateReceivedKey:
        releaseDateKey(dateReceived),

      reason: "MANUAL_STOCK_IN",
      remarks: "",

      receivedBy: user.uid,
      receivedByName:
        user.displayName,

      createdBy: user.uid,
      createdAt: serverTimestamp(),
    },
  );

  await batch.commit();

  return operationId;
}

before(async () => {
  const rules = readFileSync(
    resolve(
      process.cwd(),
      "firestore.rules",
    ),
    "utf8",
  );

  testEnv =
    await initializeTestEnvironment({
      projectId:
        PHASE5F_PROJECT_ID,

      firestore: {
        rules,
      },
    });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  operationCounter = 0;

  await testEnv.clearFirestore();

  await seedPhase5fData(testEnv);
});

test(
  "Admin can post one valid atomic Stock-Out",
  async () => {
    const db =
      authenticatedDb("admin");

    const operationId =
      await assertSucceeds(
        commitStockOut({ db }),
      );

    const productSnapshot =
      await assertSucceeds(
        getDoc(
          doc(
            db,
            "products",
            PHASE5F_PRODUCT_ID,
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

    const operationSnapshot =
      await assertSucceeds(
        getDoc(
          doc(
            db,
            "stockOutOperations",
            operationId,
          ),
        ),
      );

    assert.equal(
      productSnapshot.data().quantity,
      5,
    );

    assert.equal(
      productSnapshot.data()
        .lastStockMovementId,
      operationId,
    );

    assert.equal(
      movementSnapshot.data()
        .operationId,
      operationId,
    );

    assert.equal(
      operationSnapshot.data()
        .movementId,
      operationId,
    );
  },
);

test(
  "Inventory Staff can post a valid atomic Stock-Out",
  async () => {
    const db =
      authenticatedDb("inventory");

    await assertSucceeds(
      commitStockOut({
        db,
        userKey: "inventory",
      }),
    );
  },
);

test(
  "Transfer Stock-Out succeeds when destination is present",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertSucceeds(
      commitStockOut({
        db,
        reason: "TRANSFER",
        destination:
          "Cagayan Branch Warehouse",
      }),
    );
  },
);

test(
  "Product-only quantity reduction is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    const operationId =
      createOperationId();

    await assertFails(
      updateDoc(
        doc(
          db,
          "products",
          PHASE5F_PRODUCT_ID,
        ),
        {
          quantity: 5,

          hasStockHistory: true,
          stockMovementCount: 1,

          lastStockMovementId:
            operationId,

          lastStockMovementType:
            "OUT",

          lastStockMovementReason:
            "MANUAL_STOCK_OUT",

          lastStockMovementQuantity: 5,
          lastStockMovementUnitCost: 10,

          lastStockMovementAt:
            serverTimestamp(),

          updatedBy:
            PHASE5F_USERS.admin.uid,

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Movement-only Stock-Out creation is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    const operationId =
      createOperationId();

    const { movement } =
      createStockOutDocuments({
        operationId,
      });

    await assertFails(
      setDoc(
        doc(
          db,
          "stockMovements",
          operationId,
        ),
        movement,
      ),
    );
  },
);

test(
  "Operation-only Stock-Out creation is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    const operationId =
      createOperationId();

    const { operation } =
      createStockOutDocuments({
        operationId,
      });

    await assertFails(
      setDoc(
        doc(
          db,
          "stockOutOperations",
          operationId,
        ),
        operation,
      ),
    );
  },
);

test(
  "Mismatched Product and movement balances are denied",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      commitStockOut({
        db,

        productUpdateOverrides: {
          quantity: 4,
        },
      }),
    );
  },
);

test(
  "Stock-Out above available stock is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      commitStockOut({
        db,
        quantity: 11,
        previousQuantity: 10,
        newQuantity: -1,
        totalCost: 110,
      }),
    );
  },
);

test(
  "Stock-Out unit cost must match the Product cost snapshot",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      commitStockOut({
        db,
        unitCost: 12,
        totalCost: 60,
      }),
    );
  },
);

test(
  "Unknown Stock-Out reason is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      commitStockOut({
        db,
        reason: "SALE",
      }),
    );
  },
);

test(
  "Transfer without destination is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      commitStockOut({
        db,
        reason: "TRANSFER",
        destination: "",
      }),
    );
  },
);

test(
  "Future Stock-Out date is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      commitStockOut({
        db,
        dateReleased:
          futureReleaseDate(),
      }),
    );
  },
);

test(
  "Auditor cannot create Stock-Out records",
  async () => {
    const db =
      authenticatedDb("auditor");

    await assertFails(
      commitStockOut({
        db,
        userKey: "auditor",
      }),
    );
  },
);

test(
  "Cashier cannot create Stock-Out records",
  async () => {
    const db =
      authenticatedDb("cashier");

    await assertFails(
      commitStockOut({
        db,
        userKey: "cashier",
      }),
    );
  },
);

test(
  "Inactive Admin cannot create Stock-Out records",
  async () => {
    const db =
      authenticatedDb("inactive");

    await assertFails(
      commitStockOut({
        db,
        userKey: "inactive",
      }),
    );
  },
);

test(
  "Auditor can read OUT movement but cannot read the internal operation",
  async () => {
    const adminDb =
      authenticatedDb("admin");

    const operationId =
      await commitStockOut({
        db: adminDb,
      });

    const auditorDb =
      authenticatedDb("auditor");

    await assertSucceeds(
      getDoc(
        doc(
          auditorDb,
          "stockMovements",
          operationId,
        ),
      ),
    );

    await assertFails(
      getDoc(
        doc(
          auditorDb,
          "stockOutOperations",
          operationId,
        ),
      ),
    );
  },
);

test(
  "Cashier cannot read permanent OUT movements",
  async () => {
    const adminDb =
      authenticatedDb("admin");

    const operationId =
      await commitStockOut({
        db: adminDb,
      });

    const cashierDb =
      authenticatedDb("cashier");

    await assertFails(
      getDoc(
        doc(
          cashierDb,
          "stockMovements",
          operationId,
        ),
      ),
    );
  },
);

test(
  "OUT movement and operation records are immutable",
  async () => {
    const db =
      authenticatedDb("admin");

    const operationId =
      await commitStockOut({ db });

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

    await assertFails(
      deleteDoc(
        doc(
          db,
          "stockMovements",
          operationId,
        ),
      ),
    );

    await assertFails(
      updateDoc(
        doc(
          db,
          "stockOutOperations",
          operationId,
        ),
        {
          totalCost: 0,
        },
      ),
    );

    await assertFails(
      deleteDoc(
        doc(
          db,
          "stockOutOperations",
          operationId,
        ),
      ),
    );
  },
);

test(
  "Legacy minimal OUT movement without operation is denied",
  async () => {
    const db =
      authenticatedDb("admin");

    await assertFails(
      setDoc(
        doc(
          db,
          "stockMovements",
          "legacy_stockout_phase5f",
        ),
        {
          movementId:
            "legacy_stockout_phase5f",

          productId:
            PHASE5F_PRODUCT_ID,

          productName: "Water Meter",
          productSku: "WAME",

          movementType: "OUT",
          reason:
            "MANUAL_STOCK_OUT",

          quantity: 5,
          previousQuantity: 10,
          newQuantity: 5,

          createdBy:
            PHASE5F_USERS.admin.uid,

          createdAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Manual Stock-In remains valid with its linked operation",
  async () => {
    const db =
      authenticatedDb("inventory");

    const operationId =
      await assertSucceeds(
        commitValidStockIn({ db }),
      );

    const productSnapshot =
      await getDoc(
        doc(
          db,
          "products",
          PHASE5F_PRODUCT_ID,
        ),
      );

    assert.equal(
      productSnapshot.data().quantity,
      13,
    );

    assert.equal(
      productSnapshot.data()
        .lastStockMovementId,
      operationId,
    );
  },
);
