import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  DASHBOARD_COLLECTIONS,
  DASHBOARD_DATA_STATES,
  DASHBOARD_ERROR_CODES,
  DASHBOARD_ERROR_MESSAGES,
  EMPTY_DASHBOARD_SUMMARY,
} from "../constants/dashboard/index.js";

import {
  buildDashboardMovementAnalytics,
  buildDashboardStockAlertWidgets,
  buildDashboardSummaryFromSources,
  buildDashboardTrendAnalytics,
  buildInventoryValuationSummary,
} from "../utils/dashboard/index.js";

const SOURCE_KEYS = Object.freeze([
  "products",
  "inventoryTransactions",
  "purchaseOrders",
  "goodsReceipts",
  "stockAdjustments",
]);

function normalizeDocuments(snapshot) {
  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
}

function createInitialSourceState() {
  return {
    products: [],
    inventoryTransactions: [],
    purchaseOrders: [],
    goodsReceipts: [],
    stockAdjustments: [],
  };
}

function createInitialLoadingState() {
  return {
    products: true,
    inventoryTransactions: true,
    purchaseOrders: true,
    goodsReceipts: true,
    stockAdjustments: true,
  };
}

function createInitialErrorState() {
  return {
    products: null,
    inventoryTransactions: null,
    purchaseOrders: null,
    goodsReceipts: null,
    stockAdjustments: null,
  };
}

function getDashboardState(loading, errors, summary) {
  const loadingCount = SOURCE_KEYS.filter((key) => loading[key]).length;

  const errorCount = SOURCE_KEYS.filter((key) => Boolean(errors[key])).length;

  if (loadingCount === SOURCE_KEYS.length) {
    return DASHBOARD_DATA_STATES.LOADING;
  }

  if (errorCount === SOURCE_KEYS.length) {
    return DASHBOARD_DATA_STATES.ERROR;
  }

  if (loadingCount > 0 || errorCount > 0) {
    return DASHBOARD_DATA_STATES.PARTIAL;
  }

  const hasSummaryData = Object.values(summary).some(
    (value) => Number(value) !== 0,
  );

  return hasSummaryData
    ? DASHBOARD_DATA_STATES.SUCCESS
    : DASHBOARD_DATA_STATES.EMPTY;
}

function buildDashboardPayload({ sources, loading, errors, referenceDate }) {
  const summary = buildDashboardSummaryFromSources(sources, referenceDate);

  const stockAlerts = buildDashboardStockAlertWidgets(sources.products);

  const valuation = buildInventoryValuationSummary(sources.products);

  const trends = buildDashboardTrendAnalytics({
    transactions: sources.inventoryTransactions,
    referenceDate,
  });

  const movementAnalytics = buildDashboardMovementAnalytics({
    products: sources.products,
    transactions: sources.inventoryTransactions,
    referenceDate,
  });

  const state = getDashboardState(loading, errors, summary);

  return {
    state,
    summary,
    stockAlerts,
    valuation,
    trends,
    movementAnalytics,
    loading: { ...loading },
    errors: { ...errors },
    isLoading: state === DASHBOARD_DATA_STATES.LOADING,
    isPartial: state === DASHBOARD_DATA_STATES.PARTIAL,
    hasError: Object.values(errors).some(Boolean),
    loadedSources: SOURCE_KEYS.filter((key) => !loading[key]),
    failedSources: SOURCE_KEYS.filter((key) => Boolean(errors[key])),
  };
}

function createSourceError(code, error) {
  return {
    code,
    message:
      DASHBOARD_ERROR_MESSAGES[code] ??
      DASHBOARD_ERROR_MESSAGES[DASHBOARD_ERROR_CODES.UNKNOWN],
    originalMessage: error?.message ?? "",
  };
}

export function subscribeToDashboardSummary(
  onDashboardChanged,
  onError = console.error,
  options = {},
) {
  if (typeof onDashboardChanged !== "function") {
    throw new Error("A dashboard callback is required.");
  }

  const referenceDate =
    options.referenceDate instanceof Date ? options.referenceDate : new Date();

  const sources = createInitialSourceState();

  const loading = createInitialLoadingState();

  const errors = createInitialErrorState();

  const unsubscribers = [];

  let stopped = false;

  const emit = () => {
    if (stopped) {
      return;
    }

    onDashboardChanged(
      buildDashboardPayload({
        sources,
        loading,
        errors,
        referenceDate,
      }),
    );
  };

  const subscribe = ({ key, collectionName, errorCode, queryFactory }) => {
    const collectionReference = collection(db, collectionName);

    const sourceQuery =
      typeof queryFactory === "function"
        ? queryFactory(collectionReference)
        : collectionReference;

    const unsubscribe = onSnapshot(
      sourceQuery,
      (snapshot) => {
        sources[key] = normalizeDocuments(snapshot);
        loading[key] = false;
        errors[key] = null;
        emit();
      },
      (error) => {
        loading[key] = false;
        errors[key] = createSourceError(errorCode, error);

        onError?.(error, {
          source: key,
          code: errorCode,
        });

        emit();
      },
    );

    unsubscribers.push(unsubscribe);
  };

  emit();

  subscribe({
    key: "products",
    collectionName: DASHBOARD_COLLECTIONS.PRODUCTS,
    errorCode: DASHBOARD_ERROR_CODES.PRODUCTS_FAILED,
  });

  subscribe({
    key: "inventoryTransactions",
    collectionName: DASHBOARD_COLLECTIONS.INVENTORY_TRANSACTIONS,
    errorCode: DASHBOARD_ERROR_CODES.TRANSACTIONS_FAILED,
    queryFactory: (reference) =>
      query(reference, orderBy("transactionDate", "desc")),
  });

  subscribe({
    key: "purchaseOrders",
    collectionName: DASHBOARD_COLLECTIONS.PURCHASE_ORDERS,
    errorCode: DASHBOARD_ERROR_CODES.PURCHASE_ORDERS_FAILED,
  });

  subscribe({
    key: "goodsReceipts",
    collectionName: DASHBOARD_COLLECTIONS.GOODS_RECEIPTS,
    errorCode: DASHBOARD_ERROR_CODES.GOODS_RECEIPTS_FAILED,
  });

  subscribe({
    key: "stockAdjustments",
    collectionName: DASHBOARD_COLLECTIONS.STOCK_ADJUSTMENTS,
    errorCode: DASHBOARD_ERROR_CODES.ADJUSTMENTS_FAILED,
  });

  return () => {
    stopped = true;

    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

/**
 * Temporary compatibility export for the existing Dashboard.jsx.
 *
 * Phase 7B-7 will remove the old sales-only dashboard UI.
 */
export function subscribeToSalesMovements(
  onSalesChanged,
  onError = console.error,
) {
  const transactionsQuery = query(
    collection(db, DASHBOARD_COLLECTIONS.INVENTORY_TRANSACTIONS),
    orderBy("transactionDate", "desc"),
  );

  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      const stockOutTransactions = normalizeDocuments(snapshot)
        .filter(
          (transaction) =>
            String(transaction.transactionType).toUpperCase() === "STOCK_OUT",
        )
        .map((transaction) => ({
          ...transaction,
          movementType: "OUT",
          quantity:
            Number(transaction.quantityOut ?? 0) ||
            Math.abs(Number(transaction.quantityChanged ?? 0)),
          productSku: transaction.sku ?? transaction.productSku ?? "",
          createdAt:
            transaction.transactionDate ?? transaction.createdAt ?? null,
        }));

      onSalesChanged?.(stockOutTransactions);
    },
    (error) => {
      onError?.(error);
    },
  );
}

export function getEmptyDashboardPayload() {
  return {
    state: DASHBOARD_DATA_STATES.IDLE,
    summary: { ...EMPTY_DASHBOARD_SUMMARY },
    stockAlerts: buildDashboardStockAlertWidgets([]),
    valuation: buildInventoryValuationSummary([]),
    trends: buildDashboardTrendAnalytics({
      transactions: [],
      referenceDate: new Date(),
    }),
    movementAnalytics: buildDashboardMovementAnalytics({
      products: [],
      transactions: [],
      referenceDate: new Date(),
    }),
    loading: createInitialLoadingState(),
    errors: createInitialErrorState(),
    isLoading: false,
    isPartial: false,
    hasError: false,
    loadedSources: [],
    failedSources: [],
  };
}
