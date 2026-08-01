import test, {
  after,
  before,
  beforeEach,
} from "node:test";

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
  PHASE6G_PAST_TIMESTAMP,
  PHASE6G_PRODUCT_ID,
  PHASE6G_PROJECT_ID,
  PHASE6G_USERS,
  seedPhase6gData,
} from "./phase6g.fixtures.mjs";

let testEnv;
let counter = 0;

function authenticatedDb(userKey) {
  const user = PHASE6G_USERS[userKey];

  return testEnv
    .authenticatedContext(user.uid)
    .firestore();
}

function nextId(prefix) {
  counter += 1;

  return (
    prefix +
    String(counter).padStart(
      8,
      "0",
    )
  );
}

function requestIds() {
  return {
    adjustmentId:
      nextId("stockadj_request_"),

    createOperationId:
      nextId("stockadj_create_"),
  };
}

function requestDocuments({
  userKey = "inventory",
  actualQuantity = 8,
  reason =
    "PHYSICAL_COUNT_CORRECTION",
  ids = requestIds(),
  requestOverrides = {},
  operationOverrides = {},
} = {}) {
  const user = PHASE6G_USERS[userKey];
  const difference =
    actualQuantity - 10;

  const direction =
    difference > 0
      ? "IN"
      : "OUT";

  const countDate =
    PHASE6G_PAST_TIMESTAMP;

  const request = {
    adjustmentId:
      ids.adjustmentId,

    createOperationId:
      ids.createOperationId,

    status:
      "SUBMITTED",

    productId:
      PHASE6G_PRODUCT_ID,

    productName:
      "Water Meter",

    productSku:
      "WAME",

    systemQuantityAtRequest:
      10,

    actualCountedQuantity:
      actualQuantity,

    quantityDifference:
      difference,

    adjustmentDirection:
      direction,

    unitCostAtRequest:
      10,

    estimatedAdjustmentValue:
      Math.abs(difference) * 10,

    reason,

    referenceNumber:
      "COUNT-PHASE6G-001",

    countDate,

    countDateKey:
      countDate
        .toDate()
        .toISOString()
        .slice(0, 10),

    remarks:
      "Verified physical count.",

    requestedBy:
      user.uid,

    requestedByName:
      user.displayName,

    createdBy:
      user.uid,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    barcode:
      "100000000001",

    category:
      "WATER METERS",

    categoryCode:
      "WATER_METERS",

    unitCode:
      "PCS",

    unitName:
      "Pieces",

    unitAbbreviation:
      "PCS",

    ...requestOverrides,
  };

  const operation = {
    operationId:
      ids.createOperationId,

    operationType:
      "CREATE_REQUEST",

    operationStatus:
      "COMPLETED",

    adjustmentId:
      ids.adjustmentId,

    productId:
      PHASE6G_PRODUCT_ID,

    actualCountedQuantity:
      actualQuantity,

    quantityDifference:
      difference,

    adjustmentDirection:
      direction,

    reason,

    referenceNumber:
      request.referenceNumber,

    countDate,

    countDateKey:
      request.countDateKey,

    remarks:
      request.remarks,

    performedBy:
      user.uid,

    performedByName:
      user.displayName,

    createdBy:
      user.uid,

    createdAt:
      serverTimestamp(),

    ...operationOverrides,
  };

  return {
    ids,
    request,
    operation,
  };
}

async function createRequest({
  db,
  ...options
} = {}) {
  const {
    ids,
    request,
    operation,
  } = requestDocuments(options);

  const batch = writeBatch(db);

  batch.set(
    doc(
      db,
      "stockAdjustmentRequests",
      ids.adjustmentId,
    ),
    request,
  );

  batch.set(
    doc(
      db,
      "stockAdjustmentOperations",
      ids.createOperationId,
    ),
    operation,
  );

  await batch.commit();

  return ids;
}

async function seedSubmittedRequest(
  options = {},
) {
  const documents =
    requestDocuments(options);

  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();
      const batch = writeBatch(db);

      batch.set(
        doc(
          db,
          "stockAdjustmentRequests",
          documents.ids.adjustmentId,
        ),
        {
          ...documents.request,

          createdAt:
            PHASE6G_PAST_TIMESTAMP,

          updatedAt:
            PHASE6G_PAST_TIMESTAMP,
        },
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentOperations",
          documents.ids.createOperationId,
        ),
        {
          ...documents.operation,

          createdAt:
            PHASE6G_PAST_TIMESTAMP,
        },
      );

      await batch.commit();
    },
  );

  return documents;
}

function postDocuments({
  submitted,
  reviewerKey = "admin",
  postOperationId =
    nextId("stockadj_post_"),
  productOverrides = {},
  requestOverrides = {},
  movementOverrides = {},
  operationOverrides = {},
} = {}) {
  const reviewer =
    PHASE6G_USERS[reviewerKey];

  const difference =
    submitted.request
      .quantityDifference;

  const quantity =
    Math.abs(difference);

  const previousQuantity = 10;
  const newQuantity =
    previousQuantity + difference;

  const requestUpdate = {
    status: "POSTED",

    approvedBy:
      reviewer.uid,

    approvedByName:
      reviewer.displayName,

    approvedAt:
      serverTimestamp(),

    postedOperationId:
      postOperationId,

    movementId:
      postOperationId,

    postedPreviousQuantity:
      previousQuantity,

    postedNewQuantity:
      newQuantity,

    postedUnitCost:
      10,

    postedTotalValue:
      quantity * 10,

    postedAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    ...requestOverrides,
  };

  const productUpdate = {
    quantity:
      newQuantity,

    hasStockHistory:
      true,

    stockMovementCount:
      1,

    lastStockMovementId:
      postOperationId,

    lastStockMovementType:
      difference > 0
        ? "IN"
        : "OUT",

    lastStockMovementReason:
      "STOCK_ADJUSTMENT",

    lastStockMovementQuantity:
      quantity,

    lastStockMovementUnitCost:
      10,

    lastStockMovementAt:
      serverTimestamp(),

    lastStockMovementBy:
      reviewer.uid,

    updatedBy:
      reviewer.uid,

    updatedAt:
      serverTimestamp(),

    ...productOverrides,
  };

  const movement = {
    movementId:
      postOperationId,

    operationId:
      postOperationId,

    adjustmentId:
      submitted.ids.adjustmentId,

    movementType:
      difference > 0
        ? "IN"
        : "OUT",

    reason:
      "STOCK_ADJUSTMENT",

    adjustmentReason:
      submitted.request.reason,

    adjustmentDirection:
      submitted.request
        .adjustmentDirection,

    productId:
      PHASE6G_PRODUCT_ID,

    productName:
      "Water Meter",

    productSku:
      "WAME",

    quantity,

    quantityDifference:
      difference,

    previousQuantity,

    newQuantity,

    unitCost:
      10,

    totalCost:
      quantity * 10,

    referenceNumber:
      submitted.request
        .referenceNumber,

    countDate:
      submitted.request.countDate,

    countDateKey:
      submitted.request.countDateKey,

    remarks:
      submitted.request.remarks,

    requestedBy:
      submitted.request.requestedBy,

    requestedByName:
      submitted.request
        .requestedByName,

    approvedBy:
      reviewer.uid,

    approvedByName:
      reviewer.displayName,

    createdBy:
      reviewer.uid,

    createdAt:
      serverTimestamp(),

    barcode:
      "100000000001",

    category:
      "WATER METERS",

    categoryCode:
      "WATER_METERS",

    unitCode:
      "PCS",

    unitName:
      "Pieces",

    unitAbbreviation:
      "PCS",

    ...movementOverrides,
  };

  const operation = {
    operationId:
      postOperationId,

    operationType:
      "POST_ADJUSTMENT",

    operationStatus:
      "COMPLETED",

    adjustmentId:
      submitted.ids.adjustmentId,

    movementId:
      postOperationId,

    productId:
      PHASE6G_PRODUCT_ID,

    previousQuantity,

    newQuantity,

    quantity,

    quantityDifference:
      difference,

    adjustmentDirection:
      submitted.request
        .adjustmentDirection,

    unitCost:
      10,

    totalCost:
      quantity * 10,

    performedBy:
      reviewer.uid,

    performedByName:
      reviewer.displayName,

    createdBy:
      reviewer.uid,

    createdAt:
      serverTimestamp(),

    ...operationOverrides,
  };

  return {
    postOperationId,
    requestUpdate,
    productUpdate,
    movement,
    operation,
  };
}

async function postAdjustment({
  db,
  submitted,
  reviewerKey = "admin",
  ...overrides
}) {
  const documents =
    postDocuments({
      submitted,
      reviewerKey,
      ...overrides,
    });

  const batch = writeBatch(db);

  batch.update(
    doc(
      db,
      "products",
      PHASE6G_PRODUCT_ID,
    ),
    documents.productUpdate,
  );

  batch.update(
    doc(
      db,
      "stockAdjustmentRequests",
      submitted.ids.adjustmentId,
    ),
    documents.requestUpdate,
  );

  batch.set(
    doc(
      db,
      "stockMovements",
      documents.postOperationId,
    ),
    documents.movement,
  );

  batch.set(
    doc(
      db,
      "stockAdjustmentOperations",
      documents.postOperationId,
    ),
    documents.operation,
  );

  await batch.commit();

  return documents;
}

async function decideAdjustment({
  db,
  submitted,
  reviewerKey = "admin",
  decision = "REJECTED",
  reason = "Count sheet is incomplete.",
  operationOverrides = {},
  requestOverrides = {},
}) {
  const reviewer =
    PHASE6G_USERS[reviewerKey];

  const isRejected =
    decision === "REJECTED";

  const operationId = nextId(
    isRejected
      ? "stockadj_reject_"
      : "stockadj_cancel_",
  );

  const operationType =
    isRejected
      ? "REJECT_REQUEST"
      : "CANCEL_REQUEST";

  const requestUpdate =
    isRejected
      ? {
          status: "REJECTED",
          rejectedBy:
            reviewer.uid,
          rejectedByName:
            reviewer.displayName,
          rejectedAt:
            serverTimestamp(),
          rejectionReason:
            reason,
          rejectedOperationId:
            operationId,
          updatedAt:
            serverTimestamp(),
          ...requestOverrides,
        }
      : {
          status: "CANCELLED",
          cancelledBy:
            reviewer.uid,
          cancelledByName:
            reviewer.displayName,
          cancelledAt:
            serverTimestamp(),
          cancellationReason:
            reason,
          cancelledOperationId:
            operationId,
          updatedAt:
            serverTimestamp(),
          ...requestOverrides,
        };

  const operation = {
    operationId,
    operationType,
    operationStatus:
      "COMPLETED",
    adjustmentId:
      submitted.ids.adjustmentId,
    productId:
      PHASE6G_PRODUCT_ID,
    decisionReason:
      reason,
    performedBy:
      reviewer.uid,
    performedByName:
      reviewer.displayName,
    createdBy:
      reviewer.uid,
    createdAt:
      serverTimestamp(),
    ...operationOverrides,
  };

  const batch = writeBatch(db);

  batch.update(
    doc(
      db,
      "stockAdjustmentRequests",
      submitted.ids.adjustmentId,
    ),
    requestUpdate,
  );

  batch.set(
    doc(
      db,
      "stockAdjustmentOperations",
      operationId,
    ),
    operation,
  );

  await batch.commit();

  return operationId;
}

before(async () => {
  testEnv =
    await initializeTestEnvironment({
      projectId:
        PHASE6G_PROJECT_ID,

      firestore: {
        rules:
          readFileSync(
            resolve(
              "firestore.rules",
            ),
            "utf8",
          ),
      },
    });
});

beforeEach(async () => {
  counter = 0;
  await testEnv.clearFirestore();
  await seedPhase6gData(testEnv);
});

after(async () => {
  await testEnv.cleanup();
});

test(
  "Inventory Staff can submit a valid request atomically",
  async () => {
    await assertSucceeds(
      createRequest({
        db:
          authenticatedDb(
            "inventory",
          ),
      }),
    );
  },
);

test(
  "Superadmin can submit a valid request",
  async () => {
    await assertSucceeds(
      createRequest({
        db:
          authenticatedDb(
            "superadmin",
          ),
        userKey:
          "superadmin",
      }),
    );
  },
);

test(
  "Auditor cannot create a request",
  async () => {
    await assertFails(
      createRequest({
        db:
          authenticatedDb(
            "auditor",
          ),
        userKey:
          "auditor",
      }),
    );
  },
);

test(
  "Cashier cannot create a request",
  async () => {
    await assertFails(
      createRequest({
        db:
          authenticatedDb(
            "cashier",
          ),
        userKey:
          "cashier",
      }),
    );
  },
);

test(
  "Inactive Admin cannot create a request",
  async () => {
    await assertFails(
      createRequest({
        db:
          authenticatedDb(
            "inactive",
          ),
        userKey:
          "inactive",
      }),
    );
  },
);

test(
  "Request-only creation is denied",
  async () => {
    const db =
      authenticatedDb(
        "inventory",
      );

    const documents =
      requestDocuments();

    await assertFails(
      setDoc(
        doc(
          db,
          "stockAdjustmentRequests",
          documents.ids.adjustmentId,
        ),
        documents.request,
      ),
    );
  },
);

test(
  "Operation-only creation is denied",
  async () => {
    const db =
      authenticatedDb(
        "inventory",
      );

    const documents =
      requestDocuments();

    await assertFails(
      setDoc(
        doc(
          db,
          "stockAdjustmentOperations",
          documents.ids.createOperationId,
        ),
        documents.operation,
      ),
    );
  },
);

test(
  "Zero-difference request is denied",
  async () => {
    await assertFails(
      createRequest({
        db:
          authenticatedDb(
            "inventory",
          ),
        actualQuantity: 10,
      }),
    );
  },
);

test(
  "Contradictory reason and direction is denied",
  async () => {
    await assertFails(
      createRequest({
        db:
          authenticatedDb(
            "inventory",
          ),
        actualQuantity: 8,
        reason:
          "UNRECORDED_STOCK_FOUND",
      }),
    );
  },
);

test(
  "Future count date is denied",
  async () => {
    const future =
      Timestamp.fromDate(
        new Date(
          Date.now() +
            24 * 60 * 60 * 1000,
        ),
      );

    await assertFails(
      createRequest({
        db:
          authenticatedDb(
            "inventory",
          ),
        requestOverrides: {
          countDate: future,
          countDateKey:
            future
              .toDate()
              .toISOString()
              .slice(0, 10),
        },
        operationOverrides: {
          countDate: future,
          countDateKey:
            future
              .toDate()
              .toISOString()
              .slice(0, 10),
        },
      }),
    );
  },
);

test(
  "Authorized roles can list adjustment requests",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    for (
      const userKey of [
        "superadmin",
        "admin",
        "inventory",
        "auditor",
      ]
    ) {
      await assertSucceeds(
        getDocs(
          collection(
            authenticatedDb(
              userKey,
            ),
            "stockAdjustmentRequests",
          ),
        ),
      );
    }

    await assertSucceeds(
      getDoc(
        doc(
          authenticatedDb(
            "auditor",
          ),
          "stockAdjustmentRequests",
          submitted.ids.adjustmentId,
        ),
      ),
    );
  },
);

test(
  "Cashier cannot list adjustment requests",
  async () => {
    await assertFails(
      getDocs(
        collection(
          authenticatedDb(
            "cashier",
          ),
          "stockAdjustmentRequests",
        ),
      ),
    );
  },
);

test(
  "Admin can approve and post another user's request",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertSucceeds(
      postAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
      }),
    );
  },
);

test(
  "Superadmin can approve their own request",
  async () => {
    const submitted =
      await seedSubmittedRequest({
        userKey:
          "superadmin",
      });

    await assertSucceeds(
      postAdjustment({
        db:
          authenticatedDb(
            "superadmin",
          ),
        submitted,
        reviewerKey:
          "superadmin",
      }),
    );
  },
);

test(
  "Admin cannot approve their own request",
  async () => {
    const submitted =
      await seedSubmittedRequest({
        userKey:
          "admin",
      });

    await assertFails(
      postAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
        reviewerKey:
          "admin",
      }),
    );
  },
);

test(
  "Inventory Staff cannot approve and post",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertFails(
      postAdjustment({
        db:
          authenticatedDb(
            "inventory",
          ),
        submitted,
        reviewerKey:
          "inventory",
      }),
    );
  },
);

test(
  "Product-only adjustment is denied",
  async () => {
    const db =
      authenticatedDb(
        "admin",
      );

    await assertFails(
      updateDoc(
        doc(
          db,
          "products",
          PHASE6G_PRODUCT_ID,
        ),
        {
          quantity: 8,
          hasStockHistory: true,
          stockMovementCount: 1,
          lastStockMovementId:
            nextId(
              "stockadj_post_",
            ),
          lastStockMovementType:
            "OUT",
          lastStockMovementReason:
            "STOCK_ADJUSTMENT",
          lastStockMovementQuantity:
            2,
          lastStockMovementUnitCost:
            10,
          lastStockMovementAt:
            serverTimestamp(),
          lastStockMovementBy:
            PHASE6G_USERS.admin.uid,
          updatedBy:
            PHASE6G_USERS.admin.uid,
          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Movement-only adjustment is denied",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    const documents =
      postDocuments({
        submitted,
      });

    await assertFails(
      setDoc(
        doc(
          authenticatedDb(
            "admin",
          ),
          "stockMovements",
          documents.postOperationId,
        ),
        documents.movement,
      ),
    );
  },
);

test(
  "Post operation-only creation is denied",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    const documents =
      postDocuments({
        submitted,
      });

    await assertFails(
      setDoc(
        doc(
          authenticatedDb(
            "admin",
          ),
          "stockAdjustmentOperations",
          documents.postOperationId,
        ),
        documents.operation,
      ),
    );
  },
);

test(
  "Mismatched Product balance is denied",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertFails(
      postAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
        productOverrides: {
          quantity: 7,
        },
      }),
    );
  },
);

test(
  "Mismatched movement cost is denied",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertFails(
      postAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
        movementOverrides: {
          totalCost: 999,
        },
      }),
    );
  },
);

test(
  "Posted movement and operation are immutable",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    const posted =
      await postAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
      });

    const db =
      authenticatedDb(
        "admin",
      );

    await assertFails(
      updateDoc(
        doc(
          db,
          "stockMovements",
          posted.postOperationId,
        ),
        {
          remarks: "Changed",
        },
      ),
    );

    await assertFails(
      deleteDoc(
        doc(
          db,
          "stockAdjustmentOperations",
          posted.postOperationId,
        ),
      ),
    );
  },
);

test(
  "Admin can reject a submitted request",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertSucceeds(
      decideAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
        decision:
          "REJECTED",
      }),
    );
  },
);

test(
  "Admin can cancel a submitted request",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertSucceeds(
      decideAdjustment({
        db:
          authenticatedDb(
            "admin",
          ),
        submitted,
        decision:
          "CANCELLED",
      }),
    );
  },
);

test(
  "Decision without linked operation is denied",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertFails(
      updateDoc(
        doc(
          authenticatedDb(
            "admin",
          ),
          "stockAdjustmentRequests",
          submitted.ids.adjustmentId,
        ),
        {
          status:
            "REJECTED",
          rejectedBy:
            PHASE6G_USERS.admin.uid,
          rejectedByName:
            PHASE6G_USERS.admin
              .displayName,
          rejectedAt:
            serverTimestamp(),
          rejectionReason:
            "No evidence.",
          rejectedOperationId:
            nextId(
              "stockadj_reject_",
            ),
          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Inventory Staff cannot reject a request",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertFails(
      decideAdjustment({
        db:
          authenticatedDb(
            "inventory",
          ),
        submitted,
        reviewerKey:
          "inventory",
        decision:
          "REJECTED",
      }),
    );
  },
);

test(
  "Authorized history roles can get operation documents",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertSucceeds(
      getDoc(
        doc(
          authenticatedDb(
            "auditor",
          ),
          "stockAdjustmentOperations",
          submitted.ids
            .createOperationId,
        ),
      ),
    );

    await assertFails(
      getDocs(
        collection(
          authenticatedDb(
            "auditor",
          ),
          "stockAdjustmentOperations",
        ),
      ),
    );
  },
);

test(
  "Cashier cannot read adjustment operations",
  async () => {
    const submitted =
      await seedSubmittedRequest();

    await assertFails(
      getDoc(
        doc(
          authenticatedDb(
            "cashier",
          ),
          "stockAdjustmentOperations",
          submitted.ids
            .createOperationId,
        ),
      ),
    );
  },
);
