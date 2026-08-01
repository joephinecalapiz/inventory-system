import { useEffect, useMemo, useState } from "react";

import "../styles/StockAdjustmentHistory.css";

import {
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASON_OPTIONS,
  STOCK_ADJUSTMENT_STATUS_LABELS,
  STOCK_ADJUSTMENT_STATUSES,
} from "../constants/stockAdjustment";

import {
  getStockAdjustmentHistoryDetails,
  subscribeToStockAdjustmentRequests,
} from "../services/stockAdjustmentService";

const HISTORY_STATUSES = [
  STOCK_ADJUSTMENT_STATUSES.SUBMITTED,
  STOCK_ADJUSTMENT_STATUSES.POSTED,
  STOCK_ADJUSTMENT_STATUSES.REJECTED,
  STOCK_ADJUSTMENT_STATUSES.CANCELLED,
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function formatDifference(value) {
  const difference = Number(value);

  if (!Number.isInteger(difference)) {
    return "—";
  }

  return difference > 0 ? `+${difference}` : String(difference);
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDateTime(value) {
  const date = toDate(value);

  return date ? date.toLocaleString() : "Not available";
}

function getRequestDateKey(request) {
  if (request.countDateKey) {
    return request.countDateKey;
  }

  const date = toDate(request.countDate) || toDate(request.createdAt);

  if (!date) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getStatusLabel(status) {
  return STOCK_ADJUSTMENT_STATUS_LABELS[status] || status || "Unknown";
}

function getReasonLabel(reason) {
  return (
    STOCK_ADJUSTMENT_REASON_LABELS[reason] ||
    String(reason ?? "").replaceAll("_", " ")
  );
}

function getReviewerName(request) {
  return (
    request.approvedByName ||
    request.rejectedByName ||
    request.cancelledByName ||
    "Pending review"
  );
}

function getFinalDate(request) {
  return request.postedAt || request.rejectedAt || request.cancelledAt || null;
}

function StockAdjustmentHistory() {
  const [requests, setRequests] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [reasonFilter, setReasonFilter] = useState("ALL");

  const [productFilter, setProductFilter] = useState("ALL");

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  const [details, setDetails] = useState(null);

  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToStockAdjustmentRequests(
      (requestItems) => {
        setRequests(
          requestItems.filter((request) =>
            HISTORY_STATUSES.includes(request.status),
          ),
        );

        setIsLoading(false);
      },

      (error) => {
        console.error("Unable to load Stock Adjustment history:", error);

        setMessage({
          type: "error",
          text: error?.message || "Unable to load Stock Adjustment history.",
        });

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!details) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setDetails(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [details]);

  const productOptions = useMemo(() => {
    const productMap = new Map();

    requests.forEach((request) => {
      if (!request.productId) {
        return;
      }

      productMap.set(request.productId, {
        value: request.productId,
        label: `${request.productName || "Product"} (${request.productSku || "No SKU"})`,
      });
    });

    return Array.from(productMap.values()).sort((first, second) =>
      first.label.localeCompare(second.label),
    );
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const requestDateKey = getRequestDateKey(request);

      const matchesSearch =
        !normalizedSearch ||
        [
          request.adjustmentId,
          request.productName,
          request.productSku,
          request.barcode,
          request.referenceNumber,
          request.requestedByName,
          getReviewerName(request),
          request.reason,
          request.status,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesStatus =
        statusFilter === "ALL" || request.status === statusFilter;

      const matchesReason =
        reasonFilter === "ALL" || request.reason === reasonFilter;

      const matchesProduct =
        productFilter === "ALL" || request.productId === productFilter;

      const matchesDateFrom =
        !dateFrom || (requestDateKey && requestDateKey >= dateFrom);

      const matchesDateTo =
        !dateTo || (requestDateKey && requestDateKey <= dateTo);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesReason &&
        matchesProduct &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    requests,
    searchTerm,
    statusFilter,
    reasonFilter,
    productFilter,
    dateFrom,
    dateTo,
  ]);

  const summary = useMemo(() => {
    return filteredRequests.reduce(
      (totals, request) => {
        totals.total += 1;

        if (request.status === STOCK_ADJUSTMENT_STATUSES.SUBMITTED) {
          totals.submitted += 1;
        }

        if (request.status === STOCK_ADJUSTMENT_STATUSES.POSTED) {
          totals.posted += 1;
          totals.netPostedDifference += Number(request.quantityDifference ?? 0);

          totals.postedValue += Number(
            request.postedTotalValue ?? request.estimatedAdjustmentValue ?? 0,
          );
        }

        return totals;
      },
      {
        total: 0,
        submitted: 0,
        posted: 0,
        netPostedDifference: 0,
        postedValue: 0,
      },
    );
  }, [filteredRequests]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setReasonFilter("ALL");
    setProductFilter("ALL");
    setDateFrom("");
    setDateTo("");
  }

  async function openDetails(adjustmentId) {
    setIsDetailLoading(true);

    setMessage({
      type: "",
      text: "",
    });

    try {
      const historyDetails =
        await getStockAdjustmentHistoryDetails(adjustmentId);

      if (!historyDetails) {
        throw new Error("The Stock Adjustment record no longer exists.");
      }

      setDetails(historyDetails);
    } catch (error) {
      console.error("Unable to load Stock Adjustment details:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to load Stock Adjustment details.",
      });
    } finally {
      setIsDetailLoading(false);
    }
  }

  return (
    <main className="stock-adjustment-history-page">
      <header className="stock-adjustment-history-header">
        <div>
          <p className="stock-adjustment-history-eyebrow">Inventory audit</p>

          <h2>Stock Adjustment History</h2>

          <p>
            Review submitted and finalized physical-count corrections, including
            quantities, reasons, users, dates, operations, and permanent
            movements.
          </p>
        </div>

        <div className="stock-adjustment-history-header-card">
          <span>Visible records</span>
          <strong>{filteredRequests.length}</strong>
        </div>
      </header>

      {message.text && (
        <div
          className={[
            "stock-adjustment-history-message",
            `stock-adjustment-history-message-${message.type}`,
          ].join(" ")}
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <section className="stock-adjustment-history-summary">
        <article>
          <span>Total Records</span>
          <strong>{summary.total}</strong>
        </article>

        <article>
          <span>Submitted</span>
          <strong>{summary.submitted}</strong>
        </article>

        <article>
          <span>Posted</span>
          <strong>{summary.posted}</strong>
        </article>

        <article>
          <span>Net Posted Difference</span>
          <strong>{formatDifference(summary.netPostedDifference)}</strong>
        </article>

        <article>
          <span>Posted Value</span>
          <strong>{formatCurrency(summary.postedValue)}</strong>
        </article>
      </section>

      <section className="stock-adjustment-history-card">
        <div className="stock-adjustment-history-filters">
          <label className="wide">
            Search
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Request ID, Product, SKU, reference, requester, or reviewer"
            />
          </label>

          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All Statuses</option>

              {HISTORY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Reason
            <select
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value)}
            >
              <option value="ALL">All Reasons</option>

              {STOCK_ADJUSTMENT_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Product
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="ALL">All Products</option>

              {productOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Count Date From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              max={dateTo || undefined}
            />
          </label>

          <label>
            Count Date To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              min={dateFrom || undefined}
            />
          </label>

          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        {isLoading ? (
          <div className="stock-adjustment-history-empty">
            Loading Stock Adjustment history...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="stock-adjustment-history-empty">
            No Stock Adjustment records match the selected filters.
          </div>
        ) : (
          <div className="stock-adjustment-history-table-wrapper">
            <table className="stock-adjustment-history-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>System</th>
                  <th>Actual</th>
                  <th>Difference</th>
                  <th>Reason</th>
                  <th>Requester</th>
                  <th>Reviewer</th>
                  <th>Count Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.adjustmentId}>
                    <td>
                      <div className="stock-adjustment-history-product-cell">
                        <strong>{request.productName}</strong>

                        <span>{request.productSku}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={[
                          "stock-adjustment-history-status",
                          `status-${String(request.status).toLowerCase()}`,
                        ].join(" ")}
                      >
                        {getStatusLabel(request.status)}
                      </span>
                    </td>

                    <td>{request.systemQuantityAtRequest}</td>

                    <td>{request.actualCountedQuantity}</td>

                    <td>
                      <strong>
                        {formatDifference(request.quantityDifference)}
                      </strong>
                    </td>

                    <td>{getReasonLabel(request.reason)}</td>

                    <td>{request.requestedByName}</td>

                    <td>{getReviewerName(request)}</td>

                    <td>{getRequestDateKey(request) || "Not available"}</td>

                    <td>
                      <button
                        type="button"
                        className="stock-adjustment-history-detail-button"
                        onClick={() => openDetails(request.adjustmentId)}
                        disabled={isDetailLoading}
                      >
                        {isDetailLoading ? "Loading..." : "View Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {details && (
        <div
          className="stock-adjustment-history-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetails(null);
            }
          }}
        >
          <section
            className="stock-adjustment-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjustment-history-detail-title"
          >
            <div className="stock-adjustment-history-modal-heading">
              <div>
                <p className="stock-adjustment-history-eyebrow">
                  Permanent audit detail
                </p>

                <h3 id="stock-adjustment-history-detail-title">
                  {details.request.productName}
                </h3>

                <span>{details.request.adjustmentId}</span>
              </div>

              <button
                type="button"
                onClick={() => setDetails(null)}
                aria-label="Close Stock Adjustment details"
              >
                ×
              </button>
            </div>

            <div className="stock-adjustment-history-detail-status-row">
              <span
                className={[
                  "stock-adjustment-history-status",
                  `status-${String(details.request.status).toLowerCase()}`,
                ].join(" ")}
              >
                {getStatusLabel(details.request.status)}
              </span>

              <strong>{getReasonLabel(details.request.reason)}</strong>
            </div>

            <section className="stock-adjustment-history-detail-section">
              <h4>Quantity and Value</h4>

              <div className="stock-adjustment-history-detail-grid">
                <div>
                  <span>System at Request</span>
                  <strong>{details.request.systemQuantityAtRequest}</strong>
                </div>

                <div>
                  <span>Actual Count</span>
                  <strong>{details.request.actualCountedQuantity}</strong>
                </div>

                <div>
                  <span>Saved Difference</span>
                  <strong>
                    {formatDifference(details.request.quantityDifference)}
                  </strong>
                </div>

                <div>
                  <span>Direction</span>
                  <strong>{details.request.adjustmentDirection}</strong>
                </div>

                <div>
                  <span>Posted Previous</span>
                  <strong>
                    {details.request.postedPreviousQuantity ?? "Not posted"}
                  </strong>
                </div>

                <div>
                  <span>Posted New</span>
                  <strong>
                    {details.request.postedNewQuantity ?? "Not posted"}
                  </strong>
                </div>

                <div>
                  <span>Unit Cost</span>
                  <strong>
                    {formatCurrency(
                      details.request.postedUnitCost ??
                        details.request.unitCostAtRequest,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Total Value</span>
                  <strong>
                    {formatCurrency(
                      details.request.postedTotalValue ??
                        details.request.estimatedAdjustmentValue,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="stock-adjustment-history-detail-section">
              <h4>Request Information</h4>

              <div className="stock-adjustment-history-detail-grid">
                <div>
                  <span>SKU</span>
                  <strong>{details.request.productSku}</strong>
                </div>

                <div>
                  <span>Barcode</span>
                  <strong>{details.request.barcode || "Not assigned"}</strong>
                </div>

                <div>
                  <span>Count Date</span>
                  <strong>
                    {getRequestDateKey(details.request) || "Not available"}
                  </strong>
                </div>

                <div>
                  <span>Reference</span>
                  <strong>
                    {details.request.referenceNumber || "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Requested By</span>
                  <strong>{details.request.requestedByName}</strong>
                </div>

                <div>
                  <span>Submitted At</span>
                  <strong>{formatDateTime(details.request.createdAt)}</strong>
                </div>

                <div>
                  <span>Reviewed By</span>
                  <strong>{getReviewerName(details.request)}</strong>
                </div>

                <div>
                  <span>Finalized At</span>
                  <strong>
                    {formatDateTime(getFinalDate(details.request))}
                  </strong>
                </div>
              </div>

              <div className="stock-adjustment-history-notes">
                <div>
                  <span>Remarks</span>
                  <p>{details.request.remarks || "No remarks provided."}</p>
                </div>

                {(details.request.rejectionReason ||
                  details.request.cancellationReason) && (
                  <div>
                    <span>Decision Reason</span>
                    <p>
                      {details.request.rejectionReason ||
                        details.request.cancellationReason}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="stock-adjustment-history-detail-section">
              <h4>Immutable Audit Links</h4>

              <div className="stock-adjustment-history-detail-grid">
                <div>
                  <span>Create Operation</span>
                  <strong>
                    {details.createOperation?.operationId ||
                      details.request.createOperationId ||
                      "Not available"}
                  </strong>
                </div>

                <div>
                  <span>Final Operation</span>
                  <strong>
                    {details.finalOperation?.operationId ||
                      details.request.postedOperationId ||
                      details.request.rejectedOperationId ||
                      details.request.cancelledOperationId ||
                      "Not available"}
                  </strong>
                </div>

                <div>
                  <span>Movement ID</span>
                  <strong>
                    {details.movement?.movementId ||
                      details.request.movementId ||
                      "No movement"}
                  </strong>
                </div>

                <div>
                  <span>Movement Type</span>
                  <strong>
                    {details.movement?.movementType || "No movement"}
                  </strong>
                </div>
              </div>

              <div className="stock-adjustment-history-immutable-note">
                These records are read-only. Stock Adjustment history cannot be
                edited or deleted from this page.
              </div>
            </section>

            <div className="stock-adjustment-history-modal-actions">
              <button type="button" onClick={() => setDetails(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default StockAdjustmentHistory;
