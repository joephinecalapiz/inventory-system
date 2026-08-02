import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  INVENTORY_TRANSACTION_COLLECTION,
  INVENTORY_TRANSACTION_TYPES,
} from "../constants/reports";

import { PRODUCT_STOCK_STATUSES } from "../constants/stockStatus";

import { createReportDateRange } from "../utils/reports";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function createInventoryTransactionConstraints(filters = {}) {
  const constraints = [];

  const dateFrom = normalizeText(filters.dateFrom);
  const dateTo = normalizeText(filters.dateTo);

  if (dateFrom || dateTo) {
    if (!dateFrom || !dateTo) {
      throw new Error("Both report start and end dates are required.");
    }

    const { startDate, endDateExclusive } = createReportDateRange(
      dateFrom,
      dateTo,
    );

    constraints.push(
      where("transactionDate", ">=", startDate),
      where("transactionDate", "<", endDateExclusive),
    );
  }

  const productId = normalizeText(filters.productId);

  if (productId) {
    constraints.push(where("productId", "==", productId));
  }

  const transactionType = normalizeText(filters.transactionType);

  if (transactionType) {
    constraints.push(where("transactionType", "==", transactionType));
  }

  const categoryCode = normalizeText(filters.categoryCode).toUpperCase();

  if (categoryCode) {
    constraints.push(where("categoryCode", "==", categoryCode));
  }

  const supplierId = normalizeText(filters.supplierId);

  if (supplierId) {
    constraints.push(where("supplierId", "==", supplierId));
  }

  const performedBy = normalizeText(filters.performedBy);

  if (performedBy) {
    constraints.push(where("performedBy", "==", performedBy));
  }

  constraints.push(orderBy("transactionDate", "desc"));

  const recordLimit = Number(filters.limit ?? 200);

  if (Number.isInteger(recordLimit) && recordLimit > 0) {
    constraints.push(limit(Math.min(recordLimit, 1000)));
  }

  return constraints;
}

function normalizeInventoryTransaction(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export function subscribeToInventoryTransactions(
  filters,
  onData,
  onError = console.error,
) {
  if (typeof onData !== "function") {
    throw new Error("A report data callback is required.");
  }

  const transactionsQuery = query(
    collection(db, INVENTORY_TRANSACTION_COLLECTION),
    ...createInventoryTransactionConstraints(filters),
  );

  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      onData(snapshot.docs.map(normalizeInventoryTransaction));
    },
    onError,
  );
}

export function subscribeToStockInReport(filters, onData, onError) {
  return subscribeToInventoryTransactions(
    {
      ...filters,
      transactionType:
        filters?.transactionType || INVENTORY_TRANSACTION_TYPES.STOCK_IN,
    },
    onData,
    onError,
  );
}

export function subscribeToStockOutReport(filters, onData, onError) {
  return subscribeToInventoryTransactions(
    {
      ...filters,
      transactionType: INVENTORY_TRANSACTION_TYPES.STOCK_OUT,
    },
    onData,
    onError,
  );
}

export function subscribeToGoodsReceiptReport(filters, onData, onError) {
  return subscribeToInventoryTransactions(
    {
      ...filters,
      transactionType: INVENTORY_TRANSACTION_TYPES.GOODS_RECEIPT,
    },
    onData,
    onError,
  );
}

export function subscribeToAdjustmentMovementReport(filters, onData, onError) {
  const adjustmentTypes = [
    INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_INCREASE,
    INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_DECREASE,
  ];

  const constraints = createInventoryTransactionConstraints(filters).filter(
    (constraint) => true,
  );

  const transactionsQuery = query(
    collection(db, INVENTORY_TRANSACTION_COLLECTION),
    where("transactionType", "in", adjustmentTypes),
    ...constraints,
  );

  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      onData?.(snapshot.docs.map(normalizeInventoryTransaction));
    },
    onError ?? console.error,
  );
}

function createProductReportConstraints(filters = {}) {
  const constraints = [];

  const categoryCode = normalizeText(filters.categoryCode).toUpperCase();

  if (categoryCode) {
    constraints.push(where("categoryCode", "==", categoryCode));
  }

  const unitCode = normalizeText(filters.unitCode).toUpperCase();

  if (unitCode) {
    constraints.push(where("unitCode", "==", unitCode));
  }

  const stockStatus = normalizeText(filters.stockStatus).toUpperCase();

  if (stockStatus && stockStatus !== "ALL") {
    constraints.push(where("stockStatus", "==", stockStatus));
  }

  constraints.push(orderBy("name", "asc"));

  return constraints;
}

export function subscribeToCurrentInventoryReport(
  filters,
  onData,
  onError = console.error,
) {
  const productsQuery = query(
    collection(db, "products"),
    ...createProductReportConstraints(filters),
  );

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      onData?.(
        snapshot.docs.map((productSnapshot) => ({
          id: productSnapshot.id,
          ...productSnapshot.data(),
        })),
      );
    },
    onError,
  );
}

export function subscribeToLowStockReport(
  filters,
  onData,
  onError = console.error,
) {
  const productsQuery = query(
    collection(db, "products"),
    where("stockStatus", "in", [
      PRODUCT_STOCK_STATUSES.LOW_STOCK,
      PRODUCT_STOCK_STATUSES.OUT_OF_STOCK,
    ]),
    orderBy("name", "asc"),
  );

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      let products = snapshot.docs.map((productSnapshot) => ({
        id: productSnapshot.id,
        ...productSnapshot.data(),
      }));

      const categoryCode = normalizeText(filters?.categoryCode).toUpperCase();

      if (categoryCode) {
        products = products.filter(
          (product) => product.categoryCode === categoryCode,
        );
      }

      onData?.(products);
    },
    onError,
  );
}

export function subscribeToProductLedger(productId, filters, onData, onError) {
  const normalizedProductId = normalizeText(productId);

  if (!normalizedProductId) {
    throw new Error("A product is required for the transaction ledger.");
  }

  return subscribeToInventoryTransactions(
    {
      ...filters,
      productId: normalizedProductId,
    },
    onData,
    onError,
  );
}
