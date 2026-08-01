import {
  Timestamp,
  doc,
  writeBatch,
} from "firebase/firestore";

export const PHASE6H_PROJECT_ID =
  "demo-inventory-phase6h";

export const PHASE6H_IDS =
  Object.freeze({
    product:
      "phase6h-product",

    submittedRequest:
      "stockadj_request_phase6h_submitted",

    postedRequest:
      "stockadj_request_phase6h_posted",

    rejectedRequest:
      "stockadj_request_phase6h_rejected",

    cancelledRequest:
      "stockadj_request_phase6h_cancelled",

    createOperation:
      "stockadj_create_phase6h_submitted",

    postedOperation:
      "stockadj_post_phase6h_posted",

    rejectedOperation:
      "stockadj_reject_phase6h_rejected",

    cancelledOperation:
      "stockadj_cancel_phase6h_cancelled",

    movement:
      "stockadj_post_phase6h_posted",
  });

export const PHASE6H_USERS =
  Object.freeze({
    superadmin: {
      uid:
        "phase6h-superadmin",
      role:
        "SUPERADMIN",
    },

    admin: {
      uid:
        "phase6h-admin",
      role:
        "ADMIN",
    },

    inventory: {
      uid:
        "phase6h-inventory",
      role:
        "INVENTORY_STAFF",
    },

    auditor: {
      uid:
        "phase6h-auditor",
      role:
        "AUDITOR",
    },

    cashier: {
      uid:
        "phase6h-cashier",
      role:
        "CASHIER",
    },
  });

const seededAt =
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
      user.uid,

    role:
      user.role,

    status:
      "ACTIVE",

    createdAt:
      seededAt,

    updatedAt:
      seededAt,
  };
}

function requestDocument({
  adjustmentId,
  status,
  operationId,
}) {
  const document = {
    adjustmentId,

    createOperationId:
      PHASE6H_IDS.createOperation,

    status,

    productId:
      PHASE6H_IDS.product,

    productName:
      "Water Meter",

    productSku:
      "WAME",

    systemQuantityAtRequest:
      10,

    actualCountedQuantity:
      8,

    quantityDifference:
      -2,

    adjustmentDirection:
      "OUT",

    unitCostAtRequest:
      10,

    estimatedAdjustmentValue:
      20,

    reason:
      "PHYSICAL_COUNT_CORRECTION",

    referenceNumber:
      "COUNT-PHASE6H",

    countDate:
      seededAt,

    countDateKey:
      seededAt
        .toDate()
        .toISOString()
        .slice(0, 10),

    remarks:
      "Seeded Phase 6H record.",

    requestedBy:
      PHASE6H_USERS.inventory.uid,

    requestedByName:
      "Phase 6H Inventory Staff",

    createdBy:
      PHASE6H_USERS.inventory.uid,

    createdAt:
      seededAt,

    updatedAt:
      seededAt,
  };

  if (status === "POSTED") {
    Object.assign(
      document,
      {
        approvedBy:
          PHASE6H_USERS.admin.uid,

        approvedByName:
          "Phase 6H Admin",

        approvedAt:
          seededAt,

        postedOperationId:
          operationId,

        movementId:
          PHASE6H_IDS.movement,

        postedPreviousQuantity:
          10,

        postedNewQuantity:
          8,

        postedUnitCost:
          10,

        postedTotalValue:
          20,

        postedAt:
          seededAt,
      },
    );
  }

  if (status === "REJECTED") {
    Object.assign(
      document,
      {
        rejectedBy:
          PHASE6H_USERS.admin.uid,

        rejectedByName:
          "Phase 6H Admin",

        rejectedAt:
          seededAt,

        rejectionReason:
          "Insufficient evidence.",

        rejectedOperationId:
          operationId,
      },
    );
  }

  if (status === "CANCELLED") {
    Object.assign(
      document,
      {
        cancelledBy:
          PHASE6H_USERS.admin.uid,

        cancelledByName:
          "Phase 6H Admin",

        cancelledAt:
          seededAt,

        cancellationReason:
          "Recount required.",

        cancelledOperationId:
          operationId,
      },
    );
  }

  return document;
}

export async function seedPhase6hData(
  testEnv,
) {
  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db =
        context.firestore();

      const batch =
        writeBatch(db);

      for (
        const user of
        Object.values(
          PHASE6H_USERS,
        )
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
          PHASE6H_IDS.product,
        ),
        {
          name:
            "Water Meter",

          sku:
            "WAME",

          status:
            "ACTIVE",

          quantity:
            8,

          costPrice:
            10,

          sellingPrice:
            15,

          price:
            15,

          category:
            "WATER METERS",

          categoryName:
            "WATER METERS",

          categoryCode:
            "WATER_METERS",

          categoryId:
            "WATER_METERS",

          barcodePrefix:
            "10",

          unitCode:
            "PCS",

          unitId:
            "PCS",

          unitName:
            "Pieces",

          unitAbbreviation:
            "PCS",

          reorderLevel:
            2,

          barcode:
            "100000000001",

          hasStockHistory:
            true,

          stockMovementCount:
            1,

          lastStockMovementId:
            PHASE6H_IDS.movement,

          lastStockMovementType:
            "OUT",

          lastStockMovementReason:
            "STOCK_ADJUSTMENT",

          lastStockMovementQuantity:
            2,

          lastStockMovementUnitCost:
            10,

          lastStockMovementAt:
            seededAt,

          lastStockMovementBy:
            PHASE6H_USERS.admin.uid,

          createdBy:
            PHASE6H_USERS.admin.uid,

          createdAt:
            seededAt,

          updatedBy:
            PHASE6H_USERS.admin.uid,

          updatedAt:
            seededAt,
        },
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentRequests",
          PHASE6H_IDS.submittedRequest,
        ),
        requestDocument({
          adjustmentId:
            PHASE6H_IDS.submittedRequest,

          status:
            "SUBMITTED",

          operationId:
            PHASE6H_IDS.createOperation,
        }),
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentRequests",
          PHASE6H_IDS.postedRequest,
        ),
        requestDocument({
          adjustmentId:
            PHASE6H_IDS.postedRequest,

          status:
            "POSTED",

          operationId:
            PHASE6H_IDS.postedOperation,
        }),
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentRequests",
          PHASE6H_IDS.rejectedRequest,
        ),
        requestDocument({
          adjustmentId:
            PHASE6H_IDS.rejectedRequest,

          status:
            "REJECTED",

          operationId:
            PHASE6H_IDS.rejectedOperation,
        }),
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentRequests",
          PHASE6H_IDS.cancelledRequest,
        ),
        requestDocument({
          adjustmentId:
            PHASE6H_IDS.cancelledRequest,

          status:
            "CANCELLED",

          operationId:
            PHASE6H_IDS.cancelledOperation,
        }),
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentOperations",
          PHASE6H_IDS.createOperation,
        ),
        {
          operationId:
            PHASE6H_IDS.createOperation,

          operationType:
            "CREATE_REQUEST",

          operationStatus:
            "COMPLETED",

          adjustmentId:
            PHASE6H_IDS.submittedRequest,

          productId:
            PHASE6H_IDS.product,

          performedBy:
            PHASE6H_USERS.inventory.uid,

          performedByName:
            "Phase 6H Inventory Staff",

          createdBy:
            PHASE6H_USERS.inventory.uid,

          createdAt:
            seededAt,
        },
      );

      batch.set(
        doc(
          db,
          "stockAdjustmentOperations",
          PHASE6H_IDS.postedOperation,
        ),
        {
          operationId:
            PHASE6H_IDS.postedOperation,

          operationType:
            "POST_ADJUSTMENT",

          operationStatus:
            "COMPLETED",

          adjustmentId:
            PHASE6H_IDS.postedRequest,

          movementId:
            PHASE6H_IDS.movement,

          productId:
            PHASE6H_IDS.product,

          performedBy:
            PHASE6H_USERS.admin.uid,

          performedByName:
            "Phase 6H Admin",

          createdBy:
            PHASE6H_USERS.admin.uid,

          createdAt:
            seededAt,
        },
      );

      batch.set(
        doc(
          db,
          "stockMovements",
          PHASE6H_IDS.movement,
        ),
        {
          movementId:
            PHASE6H_IDS.movement,

          operationId:
            PHASE6H_IDS.postedOperation,

          adjustmentId:
            PHASE6H_IDS.postedRequest,

          movementType:
            "OUT",

          reason:
            "STOCK_ADJUSTMENT",

          adjustmentReason:
            "PHYSICAL_COUNT_CORRECTION",

          adjustmentDirection:
            "OUT",

          productId:
            PHASE6H_IDS.product,

          productName:
            "Water Meter",

          productSku:
            "WAME",

          quantity:
            2,

          quantityDifference:
            -2,

          previousQuantity:
            10,

          newQuantity:
            8,

          unitCost:
            10,

          totalCost:
            20,

          referenceNumber:
            "COUNT-PHASE6H",

          countDate:
            seededAt,

          countDateKey:
            seededAt
              .toDate()
              .toISOString()
              .slice(0, 10),

          remarks:
            "Seeded movement.",

          requestedBy:
            PHASE6H_USERS.inventory.uid,

          requestedByName:
            "Phase 6H Inventory Staff",

          approvedBy:
            PHASE6H_USERS.admin.uid,

          approvedByName:
            "Phase 6H Admin",

          createdBy:
            PHASE6H_USERS.admin.uid,

          createdAt:
            seededAt,
        },
      );

      await batch.commit();
    },
  );
}
