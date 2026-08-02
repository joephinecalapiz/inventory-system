import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  INVENTORY_TRANSACTION_COLLECTION,
  INVENTORY_TRANSACTION_REQUIRED_FIELDS,
  INVENTORY_TRANSACTION_TYPES,
  REPORT_MIGRATION_ISSUE_TYPES,
  REPORT_MIGRATION_LIMITS,
  REPORT_MIGRATION_SEVERITIES,
  REPORT_MIGRATION_STATUSES,
} from "../constants/reports";

import {
  calculateProductStockStatus,
  isValidProductStockStatus,
} from "../constants/stockStatus";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUppercase(value) {
  return normalizeText(value).toUpperCase();
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function createIssue({
  type,
  severity,
  collectionName,
  documentId,
  message,
  details = {},
}) {
  return {
    type,
    severity,
    collectionName,
    documentId,
    message,
    details,
  };
}

function getMovementType(movement = {}) {
  return normalizeUppercase(
    movement.movementType ?? movement.type,
  );
}

function getMovementReason(movement = {}) {
  return normalizeUppercase(movement.reason);
}

export function inferLegacyTransactionType(movement = {}) {
  const movementType = getMovementType(movement);
  const reason = getMovementReason(movement);

  if (movementType === "IN") {
    if (reason === "OPENING_BALANCE") {
      return INVENTORY_TRANSACTION_TYPES.OPENING_STOCK;
    }

    if (
      reason === "RETURNED_STOCK" ||
      reason === "RETURN_IN"
    ) {
      return INVENTORY_TRANSACTION_TYPES.RETURN_IN;
    }

    if (
      reason === "PURCHASE_RECEIPT" ||
      normalizeText(movement.goodsReceiptId)
    ) {
      return INVENTORY_TRANSACTION_TYPES.GOODS_RECEIPT;
    }

    if (reason === "STOCK_ADJUSTMENT") {
      return INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_INCREASE;
    }

    return INVENTORY_TRANSACTION_TYPES.STOCK_IN;
  }

  if (movementType === "OUT") {
    if (
      reason === "RETURN_OUT" ||
      reason === "SUPPLIER_RETURN"
    ) {
      return INVENTORY_TRANSACTION_TYPES.RETURN_OUT;
    }

    if (reason === "STOCK_ADJUSTMENT") {
      return INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_DECREASE;
    }

    return INVENTORY_TRANSACTION_TYPES.STOCK_OUT;
  }

  return null;
}

function inspectProduct(product) {
  const issues = [];

  const quantity = toFiniteNumber(product.quantity);
  const reorderLevel = toFiniteNumber(product.reorderLevel);

  if (
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    !Number.isInteger(reorderLevel) ||
    reorderLevel < 0
  ) {
    return issues;
  }

  const expectedStatus = calculateProductStockStatus(
    quantity,
    reorderLevel,
  );

  if (!isValidProductStockStatus(product.stockStatus)) {
    issues.push(
      createIssue({
        type:
          REPORT_MIGRATION_ISSUE_TYPES
            .PRODUCT_MISSING_STOCK_STATUS,
        severity: REPORT_MIGRATION_SEVERITIES.WARNING,
        collectionName: "products",
        documentId: product.id,
        message: "Product has no valid stockStatus field.",
        details: {
          expectedStatus,
          quantity,
          reorderLevel,
        },
      }),
    );
  } else if (product.stockStatus !== expectedStatus) {
    issues.push(
      createIssue({
        type:
          REPORT_MIGRATION_ISSUE_TYPES
            .PRODUCT_INCORRECT_STOCK_STATUS,
        severity: REPORT_MIGRATION_SEVERITIES.ERROR,
        collectionName: "products",
        documentId: product.id,
        message:
          "Stored product stockStatus does not match quantity and reorder level.",
        details: {
          currentStatus: product.stockStatus,
          expectedStatus,
          quantity,
          reorderLevel,
        },
      }),
    );
  }

  return issues;
}

function inspectTransaction(transaction) {
  const issues = [];

  for (const fieldName of INVENTORY_TRANSACTION_REQUIRED_FIELDS) {
    const value = transaction[fieldName];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      issues.push(
        createIssue({
          type:
            REPORT_MIGRATION_ISSUE_TYPES
              .REPORT_TRANSACTION_MISSING_REQUIRED_FIELD,
          severity: REPORT_MIGRATION_SEVERITIES.ERROR,
          collectionName: INVENTORY_TRANSACTION_COLLECTION,
          documentId: transaction.id,
          message: `Required field "${fieldName}" is missing.`,
          details: {
            fieldName,
          },
        }),
      );
    }
  }

  const quantityBefore = toFiniteNumber(
    transaction.quantityBefore,
  );
  const quantityChanged = toFiniteNumber(
    transaction.quantityChanged,
  );
  const quantityAfter = toFiniteNumber(
    transaction.quantityAfter,
  );
  const quantityIn = toFiniteNumber(transaction.quantityIn);
  const quantityOut = toFiniteNumber(transaction.quantityOut);

  if (
    quantityBefore === null ||
    quantityChanged === null ||
    quantityAfter === null ||
    quantityIn === null ||
    quantityOut === null ||
    quantityAfter !== quantityBefore + quantityChanged ||
    quantityIn !== (quantityChanged > 0 ? quantityChanged : 0) ||
    quantityOut !==
      (quantityChanged < 0 ? Math.abs(quantityChanged) : 0)
  ) {
    issues.push(
      createIssue({
        type:
          REPORT_MIGRATION_ISSUE_TYPES
            .REPORT_TRANSACTION_INVALID_QUANTITIES,
        severity: REPORT_MIGRATION_SEVERITIES.BLOCKER,
        collectionName: INVENTORY_TRANSACTION_COLLECTION,
        documentId: transaction.id,
        message:
          "Transaction quantity fields are missing or inconsistent.",
        details: {
          quantityBefore,
          quantityChanged,
          quantityAfter,
          quantityIn,
          quantityOut,
        },
      }),
    );
  }

  return issues;
}

function buildMovementBackfillPreview(movement) {
  const transactionType = inferLegacyTransactionType(movement);

  if (!transactionType) {
    return null;
  }

  const movementType = getMovementType(movement);
  const quantity = toFiniteNumber(
    movement.quantity ??
      movement.quantityReceived ??
      movement.quantityReleased,
  );

  const previousQuantity = toFiniteNumber(
    movement.previousQuantity,
  );
  const newQuantity = toFiniteNumber(movement.newQuantity);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(previousQuantity) ||
    !Number.isFinite(newQuantity)
  ) {
    return null;
  }

  const quantityChanged =
    movementType === "OUT" ? -quantity : quantity;

  if (newQuantity !== previousQuantity + quantityChanged) {
    return null;
  }

  return {
    transactionId: movement.id,
    transactionType,
    referenceNumber:
      normalizeUppercase(movement.referenceNumber) ||
      normalizeUppercase(
        movement.goodsReceiptNumber ??
          movement.operationId ??
          movement.movementId ??
          movement.id,
      ),
    relatedDocumentId:
      normalizeText(
        movement.goodsReceiptId ??
          movement.adjustmentId ??
          movement.operationId ??
          movement.movementId ??
          movement.id,
      ) || null,
    productId: normalizeText(movement.productId),
    productName: normalizeText(movement.productName),
    sku: normalizeUppercase(
      movement.productSku ?? movement.sku,
    ),
    quantityBefore: previousQuantity,
    quantityChanged,
    quantityAfter: newQuantity,
    quantityIn: quantityChanged > 0 ? quantityChanged : 0,
    quantityOut:
      quantityChanged < 0 ? Math.abs(quantityChanged) : 0,
    unitCost: toFiniteNumber(movement.unitCost, 0),
    transactionDate:
      movement.dateReceived ??
      movement.dateReleased ??
      movement.countDate ??
      movement.createdAt ??
      null,
    movementId:
      normalizeText(movement.movementId ?? movement.id),
  };
}

function determineMigrationStatus(issues) {
  if (
    issues.some(
      (issue) =>
        issue.severity === REPORT_MIGRATION_SEVERITIES.BLOCKER,
    )
  ) {
    return REPORT_MIGRATION_STATUSES.BLOCKED;
  }

  if (
    issues.some(
      (issue) =>
        issue.severity === REPORT_MIGRATION_SEVERITIES.ERROR ||
        issue.severity === REPORT_MIGRATION_SEVERITIES.WARNING,
    )
  ) {
    return REPORT_MIGRATION_STATUSES.NEEDS_REVIEW;
  }

  return REPORT_MIGRATION_STATUSES.READY;
}

export async function auditLegacyReportingData() {
  const [
    productSnapshot,
    movementSnapshot,
    transactionSnapshot,
  ] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "stockMovements")),
    getDocs(collection(db, INVENTORY_TRANSACTION_COLLECTION)),
  ]);

  const products = productSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  const movements = movementSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  const transactions = transactionSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  if (
    products.length +
      movements.length +
      transactions.length >
    REPORT_MIGRATION_LIMITS.MAX_PREVIEW_RECORDS
  ) {
    throw new Error(
      "The reporting migration preview exceeds the supported record limit.",
    );
  }

  const issues = [];

  for (const product of products) {
    issues.push(...inspectProduct(product));
  }

  for (const transaction of transactions) {
    issues.push(...inspectTransaction(transaction));
  }

  const transactionById = new Map(
    transactions.map((transaction) => [
      transaction.id,
      transaction,
    ]),
  );

  const movementById = new Map(
    movements.map((movement) => [movement.id, movement]),
  );

  const backfillCandidates = [];

  for (const movement of movements) {
    if (transactionById.has(movement.id)) {
      continue;
    }

    const preview = buildMovementBackfillPreview(movement);

    if (!preview) {
      issues.push(
        createIssue({
          type:
            REPORT_MIGRATION_ISSUE_TYPES
              .UNSUPPORTED_LEGACY_MOVEMENT,
          severity: REPORT_MIGRATION_SEVERITIES.WARNING,
          collectionName: "stockMovements",
          documentId: movement.id,
          message:
            "Legacy movement cannot be converted automatically and requires review.",
          details: {
            movementType: getMovementType(movement),
            reason: getMovementReason(movement),
          },
        }),
      );

      continue;
    }

    backfillCandidates.push(preview);

    issues.push(
      createIssue({
        type:
          REPORT_MIGRATION_ISSUE_TYPES
            .MOVEMENT_MISSING_REPORT_TRANSACTION,
        severity: REPORT_MIGRATION_SEVERITIES.INFO,
        collectionName: "stockMovements",
        documentId: movement.id,
        message:
          "Movement has no matching inventoryTransactions document.",
        details: {
          proposedTransactionType: preview.transactionType,
        },
      }),
    );
  }

  for (const transaction of transactions) {
    const movementId = normalizeText(
      transaction.metadata?.movementId ??
        transaction.relatedDocumentId ??
        transaction.id,
    );

    if (movementId && !movementById.has(movementId)) {
      issues.push(
        createIssue({
          type:
            REPORT_MIGRATION_ISSUE_TYPES
              .REPORT_TRANSACTION_MISSING_MOVEMENT,
          severity: REPORT_MIGRATION_SEVERITIES.WARNING,
          collectionName: INVENTORY_TRANSACTION_COLLECTION,
          documentId: transaction.id,
          message:
            "Report transaction does not have a matching stock movement.",
          details: {
            movementId,
          },
        }),
      );
    }
  }

  const latestTransactionByProduct = new Map();

  for (const transaction of transactions) {
    const productId = normalizeText(transaction.productId);

    if (!productId) {
      continue;
    }

    const current = latestTransactionByProduct.get(productId);

    const currentMillis =
      current?.transactionDate?.toMillis?.() ??
      current?.createdAt?.toMillis?.() ??
      0;

    const candidateMillis =
      transaction.transactionDate?.toMillis?.() ??
      transaction.createdAt?.toMillis?.() ??
      0;

    if (!current || candidateMillis >= currentMillis) {
      latestTransactionByProduct.set(productId, transaction);
    }
  }

  for (const product of products) {
    const latestTransaction = latestTransactionByProduct.get(
      product.id,
    );

    if (!latestTransaction) {
      continue;
    }

    const productQuantity = toFiniteNumber(product.quantity);
    const reportedQuantity = toFiniteNumber(
      latestTransaction.quantityAfter,
    );

    if (
      productQuantity !== null &&
      reportedQuantity !== null &&
      productQuantity !== reportedQuantity
    ) {
      issues.push(
        createIssue({
          type:
            REPORT_MIGRATION_ISSUE_TYPES
              .PRODUCT_BALANCE_MISMATCH,
          severity: REPORT_MIGRATION_SEVERITIES.ERROR,
          collectionName: "products",
          documentId: product.id,
          message:
            "Product quantity does not match the latest report transaction balance.",
          details: {
            productQuantity,
            reportedQuantity,
            transactionId: latestTransaction.id,
          },
        }),
      );
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    status: determineMigrationStatus(issues),
    totals: {
      products: products.length,
      movements: movements.length,
      reportTransactions: transactions.length,
      issues: issues.length,
      backfillCandidates: backfillCandidates.length,
    },
    issues,
    backfillCandidates,
  };
}
