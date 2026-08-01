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
  updateDoc,
} from "firebase/firestore";

import {
  PHASE6H_IDS,
  PHASE6H_PROJECT_ID,
  PHASE6H_USERS,
  seedPhase6hData,
} from "./phase6h.fixtures.mjs";

let testEnv;

function dbFor(userKey) {
  const user =
    PHASE6H_USERS[userKey];

  return testEnv
    .authenticatedContext(
      user.uid,
    )
    .firestore();
}

before(async () => {
  testEnv =
    await initializeTestEnvironment({
      projectId:
        PHASE6H_PROJECT_ID,

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
  await testEnv.clearFirestore();

  await seedPhase6hData(
    testEnv,
  );
});

after(async () => {
  await testEnv.cleanup();
});

test(
  "Superadmin, Admin, Inventory Staff, and Auditor can list adjustment history",
  async () => {
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
            dbFor(userKey),
            "stockAdjustmentRequests",
          ),
        ),
      );
    }
  },
);

test(
  "Cashier cannot list adjustment history",
  async () => {
    await assertFails(
      getDocs(
        collection(
          dbFor("cashier"),
          "stockAdjustmentRequests",
        ),
      ),
    );
  },
);

test(
  "Unauthenticated user cannot list adjustment history",
  async () => {
    const db =
      testEnv
        .unauthenticatedContext()
        .firestore();

    await assertFails(
      getDocs(
        collection(
          db,
          "stockAdjustmentRequests",
        ),
      ),
    );
  },
);

test(
  "Auditor can get linked operations but cannot list the internal operation collection",
  async () => {
    const db =
      dbFor("auditor");

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "stockAdjustmentOperations",
          PHASE6H_IDS.createOperation,
        ),
      ),
    );

    await assertFails(
      getDocs(
        collection(
          db,
          "stockAdjustmentOperations",
        ),
      ),
    );
  },
);

test(
  "Cashier cannot read linked adjustment operations",
  async () => {
    await assertFails(
      getDoc(
        doc(
          dbFor("cashier"),
          "stockAdjustmentOperations",
          PHASE6H_IDS.createOperation,
        ),
      ),
    );
  },
);

test(
  "Auditor cannot modify a submitted request",
  async () => {
    await assertFails(
      updateDoc(
        doc(
          dbFor("auditor"),
          "stockAdjustmentRequests",
          PHASE6H_IDS.submittedRequest,
        ),
        {
          remarks:
            "Unauthorized edit.",

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Inventory Staff cannot approve a submitted request",
  async () => {
    await assertFails(
      updateDoc(
        doc(
          dbFor("inventory"),
          "stockAdjustmentRequests",
          PHASE6H_IDS.submittedRequest,
        ),
        {
          status:
            "POSTED",

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Posted adjustment request is immutable",
  async () => {
    await assertFails(
      updateDoc(
        doc(
          dbFor("admin"),
          "stockAdjustmentRequests",
          PHASE6H_IDS.postedRequest,
        ),
        {
          remarks:
            "Changed after posting.",

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Rejected adjustment request is immutable",
  async () => {
    await assertFails(
      updateDoc(
        doc(
          dbFor("admin"),
          "stockAdjustmentRequests",
          PHASE6H_IDS.rejectedRequest,
        ),
        {
          rejectionReason:
            "Changed reason.",

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Cancelled adjustment request is immutable",
  async () => {
    await assertFails(
      updateDoc(
        doc(
          dbFor("admin"),
          "stockAdjustmentRequests",
          PHASE6H_IDS.cancelledRequest,
        ),
        {
          cancellationReason:
            "Changed reason.",

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Adjustment request documents cannot be deleted",
  async () => {
    await assertFails(
      deleteDoc(
        doc(
          dbFor("superadmin"),
          "stockAdjustmentRequests",
          PHASE6H_IDS.postedRequest,
        ),
      ),
    );
  },
);

test(
  "Permanent adjustment movement cannot be updated or deleted",
  async () => {
    const db =
      dbFor("admin");

    const movementReference =
      doc(
        db,
        "stockMovements",
        PHASE6H_IDS.movement,
      );

    await assertFails(
      updateDoc(
        movementReference,
        {
          remarks:
            "Changed movement.",
        },
      ),
    );

    await assertFails(
      deleteDoc(
        movementReference,
      ),
    );
  },
);

test(
  "Adjustment operation cannot be updated or deleted",
  async () => {
    const db =
      dbFor("admin");

    const operationReference =
      doc(
        db,
        "stockAdjustmentOperations",
        PHASE6H_IDS.postedOperation,
      );

    await assertFails(
      updateDoc(
        operationReference,
        {
          performedByName:
            "Changed reviewer",
        },
      ),
    );

    await assertFails(
      deleteDoc(
        operationReference,
      ),
    );
  },
);

test(
  "Direct Product quantity editing remains denied",
  async () => {
    await assertFails(
      updateDoc(
        doc(
          dbFor("admin"),
          "products",
          PHASE6H_IDS.product,
        ),
        {
          quantity:
            999,

          updatedBy:
            PHASE6H_USERS.admin.uid,

          updatedAt:
            serverTimestamp(),
        },
      ),
    );
  },
);

test(
  "Auditor can read permanent movement history and Cashier cannot",
  async () => {
    const movementReference = (
      db
    ) =>
      doc(
        db,
        "stockMovements",
        PHASE6H_IDS.movement,
      );

    await assertSucceeds(
      getDoc(
        movementReference(
          dbFor("auditor"),
        ),
      ),
    );

    await assertFails(
      getDoc(
        movementReference(
          dbFor("cashier"),
        ),
      ),
    );
  },
);
