import {
  Timestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

export const PHASE6G_PROJECT_ID =
  "demo-inventory-phase6g";

export const PHASE6G_PRODUCT_ID =
  "phase6g-product";

export const PHASE6G_USERS =
  Object.freeze({
    superadmin: {
      uid: "phase6g-superadmin",
      role: "SUPERADMIN",
      displayName: "Phase 6G Superadmin",
    },

    admin: {
      uid: "phase6g-admin",
      role: "ADMIN",
      displayName: "Phase 6G Admin",
    },

    secondAdmin: {
      uid: "phase6g-admin-two",
      role: "ADMIN",
      displayName: "Phase 6G Second Admin",
    },

    inventory: {
      uid: "phase6g-inventory",
      role: "INVENTORY_STAFF",
      displayName: "Phase 6G Inventory Staff",
    },

    auditor: {
      uid: "phase6g-auditor",
      role: "AUDITOR",
      displayName: "Phase 6G Auditor",
    },

    cashier: {
      uid: "phase6g-cashier",
      role: "CASHIER",
      displayName: "Phase 6G Cashier",
    },

    inactive: {
      uid: "phase6g-inactive",
      role: "ADMIN",
      status: "INACTIVE",
      displayName: "Phase 6G Inactive Admin",
    },
  });

export const PHASE6G_PAST_TIMESTAMP =
  Timestamp.fromDate(
    new Date(
      Date.now() -
        24 * 60 * 60 * 1000,
    ),
  );

function userProfile(user) {
  return {
    email:
      `${user.uid}@example.test`,
    displayName:
      user.displayName,
    role:
      user.role,
    status:
      user.status ?? "ACTIVE",
    createdAt:
      PHASE6G_PAST_TIMESTAMP,
    updatedAt:
      PHASE6G_PAST_TIMESTAMP,
  };
}

export function phase6gProduct(
  overrides = {},
) {
  return {
    name: "Water Meter",
    sku: "WAME",
    description: "Phase 6G Product",
    status: "ACTIVE",

    category: "WATER METERS",
    categoryName: "WATER METERS",
    categoryCode: "WATER_METERS",
    categoryId: "WATER_METERS",
    barcodePrefix: "10",

    unitCode: "PCS",
    unitId: "PCS",
    unitName: "Pieces",
    unitAbbreviation: "PCS",

    costPrice: 10,
    sellingPrice: 15,
    price: 15,

    quantity: 10,
    reorderLevel: 2,
    barcode: "100000000001",

    hasStockHistory: false,
    stockMovementCount: 0,

    createdBy:
      PHASE6G_USERS.admin.uid,
    createdAt:
      PHASE6G_PAST_TIMESTAMP,

    updatedBy:
      PHASE6G_USERS.admin.uid,
    updatedAt:
      PHASE6G_PAST_TIMESTAMP,

    ...overrides,
  };
}

export async function seedPhase6gData(
  testEnv,
) {
  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();
      const batch = writeBatch(db);

      for (
        const user of
        Object.values(PHASE6G_USERS)
      ) {
        batch.set(
          doc(
            db,
            "users",
            user.uid,
          ),
          userProfile(user),
        );
      }

      batch.set(
        doc(
          db,
          "products",
          PHASE6G_PRODUCT_ID,
        ),
        phase6gProduct(),
      );

      await batch.commit();
    },
  );
}
