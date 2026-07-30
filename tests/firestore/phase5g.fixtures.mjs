import {
  Timestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

export const PHASE5G_PROJECT_ID =
  "demo-inventory-phase5g";

export const PHASE5G_USERS = Object.freeze({
  superadmin: {
    uid: "phase5g-superadmin",
    role: "SUPERADMIN",
    displayName: "Test Superadmin",
  },

  admin: {
    uid: "phase5g-admin",
    role: "ADMIN",
    displayName: "Test Admin",
  },

  inventory: {
    uid: "phase5g-inventory",
    role: "INVENTORY_STAFF",
    displayName: "Test Inventory Staff",
  },

  auditor: {
    uid: "phase5g-auditor",
    role: "AUDITOR",
    displayName: "Test Auditor",
  },

  cashier: {
    uid: "phase5g-cashier",
    role: "CASHIER",
    displayName: "Test Cashier",
  },

  inactive: {
    uid: "phase5g-inactive",
    role: "ADMIN",
    displayName: "Inactive Admin",
    status: "INACTIVE",
  },
});

export const PHASE5G_PRODUCT_ID =
  "phase5g-product";

export const PHASE5G_TIMESTAMP =
  Timestamp.fromDate(
    new Date(
      Date.now() -
        2 * 24 * 60 * 60 * 1000,
    ),
  );

function userProfile(user) {
  return {
    email: `${user.uid}@example.test`,
    displayName: user.displayName,
    role: user.role,
    status: user.status ?? "ACTIVE",
    createdAt: PHASE5G_TIMESTAMP,
    updatedAt: PHASE5G_TIMESTAMP,
  };
}

export function phase5gProduct() {
  return {
    name: "Water Meter",
    sku: "WAME",
    description: "Phase 5F Product",
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

    createdBy: PHASE5G_USERS.admin.uid,
    createdAt: PHASE5G_TIMESTAMP,
    updatedBy: PHASE5G_USERS.admin.uid,
    updatedAt: PHASE5G_TIMESTAMP,
  };
}

export async function seedPhase5fData(
  testEnv,
) {
  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();
      const batch = writeBatch(db);

      for (
        const user of
        Object.values(PHASE5G_USERS)
      ) {
        batch.set(
          doc(db, "users", user.uid),
          userProfile(user),
        );
      }

      batch.set(
        doc(
          db,
          "products",
          PHASE5G_PRODUCT_ID,
        ),
        phase5gProduct(),
      );

      await batch.commit();
    },
  );
}
