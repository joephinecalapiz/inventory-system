import {
  Timestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

export const TEST_PROJECT_ID =
  "demo-inventory-phase4i3";

export const TEST_USERS = Object.freeze({
  superadmin: {
    uid: "phase4i3-superadmin",
    role: "SUPERADMIN",
    displayName: "Test Superadmin",
  },

  admin: {
    uid: "phase4i3-admin",
    role: "ADMIN",
    displayName: "Test Admin",
  },

  inventory: {
    uid: "phase4i3-inventory",
    role: "INVENTORY_STAFF",
    displayName: "Test Inventory Staff",
  },

  auditor: {
    uid: "phase4i3-auditor",
    role: "AUDITOR",
    displayName: "Test Auditor",
  },

  cashier: {
    uid: "phase4i3-cashier",
    role: "CASHIER",
    displayName: "Test Cashier",
  },

  inactive: {
    uid: "phase4i3-inactive",
    role: "ADMIN",
    displayName: "Inactive Admin",
    status: "INACTIVE",
  },
});

export const TEST_IDS = Object.freeze({
  product: "phase4i3-product-1",
  cleanProduct: "phase4i3-product-clean",
  supplier: "phase4i3-supplier-1",
  purchaseOrder: "phase4i3-po-submitted",
  goodsReceipt: "phase4i3-grn-1",
  stockMovement: "phase4i3-seeded-movement",
});

export const TEST_TIMESTAMP = Timestamp.fromDate(
  new Date("2026-07-24T04:00:00.000Z"),
);

function createUserProfile(user) {
  return {
    email: `${user.uid}@example.test`,
    displayName: user.displayName,
    role: user.role,
    status: user.status ?? "ACTIVE",
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
  };
}

function createProduct({
  quantity = 10,
  hasStockHistory = false,
  stockMovementCount = 0,
} = {}) {
  return {
    name: "Water Meter",
    sku: "WAME",
    description: "Phase 4I-3 test product",
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

    quantity,
    reorderLevel: 2,
    barcode: "100000000001",

    hasStockHistory,
    stockMovementCount,

    createdBy: TEST_USERS.admin.uid,
    createdAt: TEST_TIMESTAMP,
    updatedBy: TEST_USERS.admin.uid,
    updatedAt: TEST_TIMESTAMP,
  };
}

function createSupplier() {
  return {
    supplierCode: "SUP-000001",
    name: "Andres Warehouse",
    nameNormalized: "andres warehouse",
    contactPerson: "Andres",
    contactNumber: "09123456789",
    email: "supplier@example.test",
    address: "Test Address",
    tin: "123-456-789",
    paymentTerm: "CASH_ON_DELIVERY",
    customPaymentTerms: "",
    notes: "",
    status: "ACTIVE",

    hasPurchaseHistory: true,
    purchaseOrderCount: 1,
    lastPurchaseOrderId: TEST_IDS.purchaseOrder,
    lastPurchaseOrderNumber: "PO-2026-000001",
    lastPurchaseOrderSubmittedAt: TEST_TIMESTAMP,

    createdBy: TEST_USERS.admin.uid,
    createdAt: TEST_TIMESTAMP,
    updatedBy: TEST_USERS.inventory.uid,
    updatedAt: TEST_TIMESTAMP,
  };
}

function createPurchaseOrder() {
  return {
    poNumber: "PO-2026-000001",
    poYear: 2026,
    poSequence: 1,

    supplierId: TEST_IDS.supplier,
    supplierCode: "SUP-000001",
    supplierName: "Andres Warehouse",
    supplierAddress: "Test Address",
    supplierTin: "123-456-789",
    supplierPaymentTerm: "CASH_ON_DELIVERY",
    supplierCustomPaymentTerms: "",

    orderDate: TEST_TIMESTAMP,
    orderDateKey: "2026-07-23",
    expectedDeliveryDate: null,
    expectedDeliveryDateKey: "",

    status: "SUBMITTED",

    itemCount: 1,
    itemProductIds: [TEST_IDS.product],

    totalOrderedQuantity: 5,
    totalReceivedQuantity: 0,

    subtotal: 50,
    discountAmount: 0,
    taxAmount: 0,
    shippingAmount: 0,
    grandTotal: 50,

    hasReceivingHistory: false,
    goodsReceiptCount: 0,

    notes: "",
    revision: 2,

    submittedBy: TEST_USERS.inventory.uid,
    submittedByName: TEST_USERS.inventory.displayName,
    submittedAt: TEST_TIMESTAMP,

    createdBy: TEST_USERS.inventory.uid,
    createdAt: TEST_TIMESTAMP,
    updatedBy: TEST_USERS.inventory.uid,
    updatedAt: TEST_TIMESTAMP,
  };
}

function createPurchaseOrderItem() {
  return {
    purchaseOrderId: TEST_IDS.purchaseOrder,
    poNumber: "PO-2026-000001",
    poStatus: "SUBMITTED",

    productId: TEST_IDS.product,
    productName: "Water Meter",
    productSku: "WAME",
    barcode: "100000000001",

    category: "WATER METERS",
    categoryCode: "WATER_METERS",

    unitCode: "PCS",
    unitName: "Pieces",
    unitAbbreviation: "PCS",

    orderedQuantity: 5,
    receivedQuantity: 0,
    remainingQuantity: 5,

    unitCost: 10,
    lineTotal: 50,

    createdBy: TEST_USERS.inventory.uid,
    createdAt: TEST_TIMESTAMP,
    updatedBy: TEST_USERS.inventory.uid,
    updatedAt: TEST_TIMESTAMP,
  };
}

function createGoodsReceipt() {
  return {
    goodsReceiptNumber: "GRN-2026-000001",
    goodsReceiptYear: 2026,
    goodsReceiptSequence: 1,

    purchaseOrderId: TEST_IDS.purchaseOrder,
    poNumber: "PO-2026-000001",

    supplierId: TEST_IDS.supplier,
    supplierCode: "SUP-000001",
    supplierName: "Andres Warehouse",

    referenceNumber: "DR-TEST-001",
    dateReceived: TEST_TIMESTAMP,
    dateReceivedKey: "2026-07-24",

    status: "COMPLETED",

    itemCount: 1,
    totalReceivedQuantity: 5,
    totalValue: 50,

    remarks: "",
    purchaseOrderStatusBefore: "APPROVED",
    purchaseOrderStatusAfter: "RECEIVED",

    receivedBy: TEST_USERS.inventory.uid,
    receivedByName: TEST_USERS.inventory.displayName,

    createdBy: TEST_USERS.inventory.uid,
    createdAt: TEST_TIMESTAMP,
  };
}

function createGoodsReceiptItem() {
  return {
    goodsReceiptId: TEST_IDS.goodsReceipt,
    goodsReceiptNumber: "GRN-2026-000001",

    purchaseOrderId: TEST_IDS.purchaseOrder,
    poNumber: "PO-2026-000001",

    productId: TEST_IDS.product,
    productName: "Water Meter",
    productSku: "WAME",

    category: "WATER METERS",
    categoryCode: "WATER_METERS",

    unitCode: "PCS",
    unitName: "Pieces",
    unitAbbreviation: "PCS",

    orderedQuantity: 5,
    previouslyReceivedQuantity: 0,
    quantityReceived: 5,
    remainingQuantity: 0,

    unitCost: 10,
    lineTotal: 50,

    stockMovementId: TEST_IDS.stockMovement,

    createdBy: TEST_USERS.inventory.uid,
    createdAt: TEST_TIMESTAMP,
  };
}

function createStockMovement() {
  return {
    movementId: TEST_IDS.stockMovement,
    movementType: "IN",
    reason: "PURCHASE_RECEIPT",

    productId: TEST_IDS.product,
    productName: "Water Meter",
    productSku: "WAME",

    quantity: 5,
    previousQuantity: 5,
    newQuantity: 10,

    unitCost: 10,
    totalCost: 50,

    source: "Andres Warehouse",
    referenceNumber: "DR-TEST-001",
    dateReceived: TEST_TIMESTAMP,

    receivedBy: TEST_USERS.inventory.uid,
    receivedByName: TEST_USERS.inventory.displayName,

    purchaseOrderId: TEST_IDS.purchaseOrder,
    poNumber: "PO-2026-000001",
    goodsReceiptId: TEST_IDS.goodsReceipt,
    goodsReceiptNumber: "GRN-2026-000001",

    createdBy: TEST_USERS.inventory.uid,
    createdAt: TEST_TIMESTAMP,
  };
}

export async function seedPhase4I3Data(testEnv) {
  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db = context.firestore();
      const batch = writeBatch(db);

      for (const user of Object.values(TEST_USERS)) {
        batch.set(
          doc(db, "users", user.uid),
          createUserProfile(user),
        );
      }

      batch.set(
        doc(db, "products", TEST_IDS.product),
        createProduct(),
      );

      batch.set(
        doc(db, "products", TEST_IDS.cleanProduct),
        createProduct({
          quantity: 0,
          hasStockHistory: false,
          stockMovementCount: 0,
        }),
      );

      batch.set(
        doc(db, "suppliers", TEST_IDS.supplier),
        createSupplier(),
      );

      batch.set(
        doc(db, "purchaseOrders", TEST_IDS.purchaseOrder),
        createPurchaseOrder(),
      );

      batch.set(
        doc(
          db,
          "purchaseOrders",
          TEST_IDS.purchaseOrder,
          "items",
          TEST_IDS.product,
        ),
        createPurchaseOrderItem(),
      );

      batch.set(
        doc(db, "goodsReceipts", TEST_IDS.goodsReceipt),
        createGoodsReceipt(),
      );

      batch.set(
        doc(
          db,
          "goodsReceipts",
          TEST_IDS.goodsReceipt,
          "items",
          TEST_IDS.product,
        ),
        createGoodsReceiptItem(),
      );

      batch.set(
        doc(db, "stockMovements", TEST_IDS.stockMovement),
        createStockMovement(),
      );

      await batch.commit();
    },
  );
}
