import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import "../styles/ReorderManagement.css";

import {
  createDefaultReorderFilters,
  REORDER_PURCHASE_ORDER_FILTERS,
  REORDER_SORT_DIRECTIONS,
  REORDER_SORT_FIELDS,
  REORDER_STOCK_FILTERS,
  REORDER_SUPPLIER_FILTERS,
} from "../constants/reorder/index.js";

import {
  getEmptyReorderRecommendationPayload,
  subscribeToReorderRecommendations,
} from "../services/reorderRecommendationService.js";

import ReorderSummaryCards from "../components/reorder/ReorderSummaryCards.jsx";
import ReorderFilters from "../components/reorder/ReorderFilters.jsx";
import ReorderTable from "../components/reorder/ReorderTable.jsx";
import ReorderLoading from "../components/reorder/ReorderLoading.jsx";
import ReorderEmptyState from "../components/reorder/ReorderEmptyState.jsx";
import ReorderError from "../components/reorder/ReorderError.jsx";

function ReorderManagement({ currentUserRole }) {
  const [filters, setFilters] = useState(() =>
    createDefaultReorderFilters(),
  );

  const [payload, setPayload] = useState(() =>
    getEmptyReorderRecommendationPayload(),
  );

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToReorderRecommendations(
      filters,
      setPayload,
      (error, context) => {
        console.error(
          "Unable to load reorder recommendation source:",
          context?.source,
          error,
        );
      },
    );

    return unsubscribe;
  }, [filters, retryKey]);

  const categoryOptions = useMemo(() => {
    const values = new Map();

    for (const item of payload.allRecommendations) {
      if (item.categoryCode) {
        values.set(item.categoryCode, item.category);
      }
    }

    return [...values.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label),
      );
  }, [payload.allRecommendations]);

  const supplierOptions = useMemo(() => {
    const values = new Map();

    for (const item of payload.allRecommendations) {
      if (item.supplierId && item.supplierName) {
        values.set(item.supplierId, item.supplierName);
      }
    }

    return [...values.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label),
      );
  }, [payload.allRecommendations]);

  const estimatedTotal = useMemo(
    () =>
      payload.recommendations.reduce(
        (total, item) =>
          total + Number(item.estimatedReorderCost ?? 0),
        0,
      ),
    [payload.recommendations],
  );

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetFilters() {
    setFilters(createDefaultReorderFilters());
  }

  return (
    <main className="reorder-page">
      <section className="reorder-page-header">
        <div>
          <p className="reorder-eyebrow">Inventory replenishment</p>
          <h1>Low Stock & Reorder Management</h1>
          <span>
            Review products requiring replenishment and prepare the next
            purchase order.
          </span>
        </div>

        <Link className="reorder-header-link" to="/purchase-orders">
          Open Purchase Orders
        </Link>
      </section>

      {payload.hasError && !payload.isLoading && (
        <ReorderError
          failedSources={payload.failedSources}
          onRetry={() => setRetryKey((value) => value + 1)}
        />
      )}

      <ReorderSummaryCards
        counts={payload.counts}
        estimatedTotal={estimatedTotal}
      />

      <ReorderFilters
        filters={filters}
        categoryOptions={categoryOptions}
        supplierOptions={supplierOptions}
        onChange={updateFilter}
        onReset={resetFilters}
        stockFilters={REORDER_STOCK_FILTERS}
        supplierFilters={REORDER_SUPPLIER_FILTERS}
        purchaseOrderFilters={REORDER_PURCHASE_ORDER_FILTERS}
        sortFields={REORDER_SORT_FIELDS}
        sortDirections={REORDER_SORT_DIRECTIONS}
      />

      {payload.isLoading ? (
        <ReorderLoading />
      ) : payload.recommendations.length === 0 ? (
        <ReorderEmptyState
          hasUnfilteredItems={payload.counts.total > 0}
          onReset={resetFilters}
        />
      ) : (
        <ReorderTable
          items={payload.recommendations}
          currentUserRole={currentUserRole}
        />
      )}
    </main>
  );
}

export default ReorderManagement;
