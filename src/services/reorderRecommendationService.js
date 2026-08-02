import {
  REORDER_DATA_STATES,
  REORDER_ERROR_CODES,
  REORDER_ERROR_MESSAGES,
} from "../constants/reorder/index.js";

import { subscribeToActiveProducts } from "./productService.js";
import { subscribeToActiveSuppliers } from "./supplierService.js";
import { subscribeToPurchaseOrders } from "./purchaseOrderService.js";

import {
  buildReorderRecommendations,
  filterAndSortReorderRecommendations,
} from "../utils/reorder/index.js";

const SOURCE_KEYS = Object.freeze(["products", "suppliers", "purchaseOrders"]);

function createInitialSources() {
  return { products: [], suppliers: [], purchaseOrders: [] };
}

function createInitialLoading() {
  return { products: true, suppliers: true, purchaseOrders: true };
}

function createInitialErrors() {
  return { products: null, suppliers: null, purchaseOrders: null };
}

function createSourceError(code, error) {
  return {
    code,
    message:
      REORDER_ERROR_MESSAGES[code] ??
      REORDER_ERROR_MESSAGES[REORDER_ERROR_CODES.UNKNOWN],
    originalMessage: String(error?.message ?? ""),
  };
}

function getState({ loading, errors, recommendations }) {
  const loadingCount = SOURCE_KEYS.filter((key) => loading[key]).length;
  const errorCount = SOURCE_KEYS.filter((key) => Boolean(errors[key])).length;

  if (loadingCount === SOURCE_KEYS.length) {
    return REORDER_DATA_STATES.LOADING;
  }

  if (errorCount === SOURCE_KEYS.length) {
    return REORDER_DATA_STATES.ERROR;
  }

  if (loadingCount > 0) {
    return REORDER_DATA_STATES.LOADING;
  }

  return recommendations.length > 0
    ? REORDER_DATA_STATES.SUCCESS
    : REORDER_DATA_STATES.EMPTY;
}

function buildPayload({ sources, loading, errors, filters }) {
  const recommendations = buildReorderRecommendations({
    products: sources.products,
    suppliers: sources.suppliers,
    purchaseOrders: sources.purchaseOrders,
  });

  const filteredRecommendations = filterAndSortReorderRecommendations(
    recommendations,
    filters,
  );

  const state = getState({
    loading,
    errors,
    recommendations: filteredRecommendations,
  });

  return {
    state,
    recommendations: filteredRecommendations,
    allRecommendations: recommendations,
    counts: {
      total: recommendations.length,
      filtered: filteredRecommendations.length,
      lowStock: recommendations.filter(
        (item) => item.reorderStatus === "LOW_STOCK",
      ).length,
      outOfStock: recommendations.filter(
        (item) => item.reorderStatus === "OUT_OF_STOCK",
      ).length,
      withPurchaseOrder: recommendations.filter((item) =>
        Boolean(item.purchaseOrderId),
      ).length,
      withoutSupplier: recommendations.filter((item) => !item.supplierId)
        .length,
    },
    loading: { ...loading },
    errors: { ...errors },
    isLoading: state === REORDER_DATA_STATES.LOADING,
    hasError: Object.values(errors).some(Boolean),
    failedSources: SOURCE_KEYS.filter((key) => Boolean(errors[key])),
  };
}

export function subscribeToReorderRecommendations(
  filters,
  onData,
  onError = console.error,
) {
  if (typeof onData !== "function") {
    throw new Error("A reorder recommendation callback is required.");
  }

  const sources = createInitialSources();
  const loading = createInitialLoading();
  const errors = createInitialErrors();
  const unsubscribers = [];
  let stopped = false;

  const emit = () => {
    if (!stopped) {
      onData(buildPayload({ sources, loading, errors, filters }));
    }
  };

  const handleSuccess = (key, records) => {
    sources[key] = Array.isArray(records) ? records : [];
    loading[key] = false;
    errors[key] = null;
    emit();
  };

  const handleError = (key, code, error) => {
    loading[key] = false;
    errors[key] = createSourceError(code, error);
    onError?.(error, { source: key, code });
    emit();
  };

  emit();

  unsubscribers.push(
    subscribeToActiveProducts(
      (products) => handleSuccess("products", products),
      (error) =>
        handleError("products", REORDER_ERROR_CODES.PRODUCTS_FAILED, error),
    ),
  );

  unsubscribers.push(
    subscribeToActiveSuppliers(
      (suppliers) => handleSuccess("suppliers", suppliers),
      (error) =>
        handleError("suppliers", REORDER_ERROR_CODES.SUPPLIERS_FAILED, error),
    ),
  );

  unsubscribers.push(
    subscribeToPurchaseOrders(
      (purchaseOrders) => handleSuccess("purchaseOrders", purchaseOrders),
      (error) =>
        handleError(
          "purchaseOrders",
          REORDER_ERROR_CODES.PURCHASE_ORDERS_FAILED,
          error,
        ),
    ),
  );

  return () => {
    stopped = true;
    for (const unsubscribe of unsubscribers) {
      if (typeof unsubscribe === "function") unsubscribe();
    }
  };
}

export function getEmptyReorderRecommendationPayload() {
  return buildPayload({
    sources: createInitialSources(),
    loading: createInitialLoading(),
    errors: createInitialErrors(),
    filters: {},
  });
}
