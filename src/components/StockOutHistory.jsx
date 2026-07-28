import { useEffect, useMemo, useState } from "react";

import "../styles/StockOutHistory.css";

import {
  STOCK_OUT_REASON_LABELS,
  STOCK_OUT_REASON_OPTIONS,
} from "../constants/stockOut";

import {
  getStockOutReceiptDetails,
  subscribeToStockOutReceipts,
} from "../services/stockOutService";

const ALL_REASONS = "ALL";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function convertToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDisplayDate(value) {
  const date = convertToDate(value);

  if (!date) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDisplayDateTime(value) {
  const date = convertToDate(value);

  if (!date) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDateKey(value) {
  const date = convertToDate(value);

  if (!date) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function getReasonLabel(reason) {
  return (
    STOCK_OUT_REASON_LABELS[reason] ||
    String(reason ?? "")
      .replaceAll("_", " ")
      .toLowerCase()
  );
}

function getUnitLabel(movement) {
  return (
    movement?.unitAbbreviation ||
    movement?.unitName ||
    movement?.unitCode ||
    "Not assigned"
  );
}

function StockOutHistory() {
  const [movements, setMovements] = useState([]);

  const [selectedMovement, setSelectedMovement] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [reasonFilter, setReasonFilter] = useState(ALL_REASONS);

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToStockOutReceipts(
      (stockOutMovements) => {
        setMovements(stockOutMovements);

        setErrorMessage("");

        setIsLoading(false);
      },

      (error) => {
        console.error("Unable to load Stock-Out history:", error);

        setErrorMessage(error?.message || "Unable to load Stock-Out history.");

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    const productIds = new Set();

    let totalQuantity = 0;
    let totalValue = 0;

    for (const movement of movements) {
      if (movement.productId) {
        productIds.add(movement.productId);
      }

      totalQuantity += Number(movement.quantity ?? 0);

      totalValue += Number(movement.totalCost ?? 0);
    }

    return {
      movementCount: movements.length,
      productCount: productIds.size,
      totalQuantity,
      totalValue,
    };
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return movements.filter((movement) => {
      const searchableText = [
        movement.movementId,
        movement.operationId,
        movement.productName,
        movement.productSku,
        movement.barcode,
        movement.category,
        movement.reason,
        getReasonLabel(movement.reason),
        movement.destination,
        movement.referenceNumber,
        movement.releasedByName,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesReason =
        reasonFilter === ALL_REASONS || movement.reason === reasonFilter;

      const movementDateKey = getDateKey(
        movement.dateReleased ?? movement.createdAt,
      );

      const matchesDateFrom =
        !dateFrom || (movementDateKey && movementDateKey >= dateFrom);

      const matchesDateTo =
        !dateTo || (movementDateKey && movementDateKey <= dateTo);

      return matchesSearch && matchesReason && matchesDateFrom && matchesDateTo;
    });
  }, [movements, searchTerm, reasonFilter, dateFrom, dateTo]);

  async function handleViewDetails(movement) {
    try {
      setIsLoadingDetails(true);

      setErrorMessage("");

      const details = await getStockOutReceiptDetails(movement.id);

      setSelectedMovement(details);

      window.requestAnimationFrame(() => {
        document
          .querySelector(".stock-out-history-detail-card")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      });
    } catch (error) {
      console.error("Unable to load Stock-Out movement details:", error);

      setErrorMessage(
        error?.message || "Unable to load the selected Stock-Out movement.",
      );
    } finally {
      setIsLoadingDetails(false);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setReasonFilter(ALL_REASONS);
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="stock-out-history-section">
      <div className="stock-out-history-heading">
        <div>
          <p className="section-label">Permanent inventory records</p>

          <h3>Stock-Out History</h3>

          <p>
            Review immutable OUT movements, release reasons, Product balances,
            destinations, and cost values.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="stock-out-history-message" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="stock-out-history-summary">
        <article>
          <span>OUT movements</span>

          <strong>{summary.movementCount}</strong>
        </article>

        <article>
          <span>Products released</span>

          <strong>{summary.productCount}</strong>
        </article>

        <article>
          <span>Total quantity</span>

          <strong>{summary.totalQuantity}</strong>
        </article>

        <article>
          <span>Total cost value</span>

          <strong>{formatCurrency(summary.totalValue)}</strong>
        </article>
      </div>

      {selectedMovement && (
        <section className="stock-out-history-detail-card">
          <div className="stock-out-history-detail-heading">
            <div>
              <p className="section-label">Permanent movement detail</p>

              <h4>{selectedMovement.productName}</h4>

              <span>Movement ID: {selectedMovement.movementId}</span>
            </div>

            <button type="button" onClick={() => setSelectedMovement(null)}>
              Close Details
            </button>
          </div>

          <div className="stock-out-history-detail-grid">
            <div>
              <span>Operation ID</span>

              <strong>{selectedMovement.operationId}</strong>
            </div>

            <div>
              <span>Product SKU</span>

              <strong>{selectedMovement.productSku}</strong>
            </div>

            <div>
              <span>Barcode</span>

              <strong>{selectedMovement.barcode || "Not assigned"}</strong>
            </div>

            <div>
              <span>Category</span>

              <strong>{selectedMovement.category || "Not assigned"}</strong>
            </div>

            <div>
              <span>Unit</span>

              <strong>{getUnitLabel(selectedMovement)}</strong>
            </div>

            <div>
              <span>Reason</span>

              <strong>{getReasonLabel(selectedMovement.reason)}</strong>
            </div>

            <div>
              <span>Quantity released</span>

              <strong>{selectedMovement.quantity}</strong>
            </div>

            <div>
              <span>Previous stock</span>

              <strong>{selectedMovement.previousQuantity}</strong>
            </div>

            <div>
              <span>New stock</span>

              <strong>{selectedMovement.newQuantity}</strong>
            </div>

            <div>
              <span>Unit cost</span>

              <strong>{formatCurrency(selectedMovement.unitCost)}</strong>
            </div>

            <div>
              <span>Total cost value</span>

              <strong>{formatCurrency(selectedMovement.totalCost)}</strong>
            </div>

            <div>
              <span>Date released</span>

              <strong>
                {formatDisplayDate(selectedMovement.dateReleased)}
              </strong>
            </div>

            <div>
              <span>Destination</span>

              <strong>{selectedMovement.destination || "Not provided"}</strong>
            </div>

            <div>
              <span>Reference number</span>

              <strong>
                {selectedMovement.referenceNumber || "Not provided"}
              </strong>
            </div>

            <div>
              <span>Released by</span>

              <strong>
                {selectedMovement.releasedByName ||
                  selectedMovement.releasedBy ||
                  "Not recorded"}
              </strong>
            </div>

            <div>
              <span>Recorded at</span>

              <strong>
                {formatDisplayDateTime(selectedMovement.createdAt)}
              </strong>
            </div>

            <div>
              <span>Movement type</span>

              <strong>{selectedMovement.movementType}</strong>
            </div>

            <div>
              <span>Record status</span>

              <strong>Permanent</strong>
            </div>
          </div>

          {selectedMovement.remarks && (
            <div className="stock-out-history-detail-remarks">
              <span>Remarks</span>

              <p>{selectedMovement.remarks}</p>
            </div>
          )}

          <div className="stock-out-history-permanent-notice">
            <strong>Immutable inventory record</strong>

            <span>
              This OUT movement is part of the permanent inventory audit trail.
              No edit or delete action is available.
            </span>
          </div>
        </section>
      )}

      <section className="stock-out-history-list-card">
        <div className="stock-out-history-list-heading">
          <div>
            <p className="section-label">Movement directory</p>

            <h4>Permanent OUT Movements</h4>
          </div>

          <span>
            {filteredMovements.length} of {movements.length}
          </span>
        </div>

        <div className="stock-out-history-filters">
          <label>
            Search movements
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search product, SKU, reason, destination, reference, receiver, or ID"
            />
          </label>

          <label>
            Reason
            <select
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value)}
            >
              <option value={ALL_REASONS}>All reasons</option>

              {STOCK_OUT_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date from
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              max={dateTo || undefined}
            />
          </label>

          <label>
            Date to
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              min={dateFrom || undefined}
            />
          </label>

          <button
            type="button"
            onClick={clearFilters}
            disabled={
              !searchTerm &&
              reasonFilter === ALL_REASONS &&
              !dateFrom &&
              !dateTo
            }
          >
            Clear Filters
          </button>
        </div>

        {isLoading ? (
          <div className="stock-out-history-empty">
            <strong>Loading Stock-Out history...</strong>

            <p>Fetching permanent OUT movement records from Firebase.</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="stock-out-history-empty">
            <strong>No Stock-Out movements found</strong>

            <p>Post a Stock-Out transaction or change the selected filters.</p>
          </div>
        ) : (
          <div className="stock-out-history-table-wrapper">
            <table className="stock-out-history-table">
              <thead>
                <tr>
                  <th>Date Released</th>
                  <th>Product</th>
                  <th>Reason</th>
                  <th>Quantity</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>Destination</th>
                  <th>Reference</th>
                  <th>Cost Value</th>
                  <th>Released By</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      {formatDisplayDate(
                        movement.dateReleased ?? movement.createdAt,
                      )}
                    </td>

                    <td>
                      <div className="stock-out-history-product-cell">
                        <strong>{movement.productName}</strong>

                        <span>{movement.productSku}</span>
                      </div>
                    </td>

                    <td>
                      <span className="stock-out-history-reason-badge">
                        {getReasonLabel(movement.reason)}
                      </span>
                    </td>

                    <td>
                      <strong>{movement.quantity}</strong>
                    </td>

                    <td>{movement.previousQuantity}</td>

                    <td>{movement.newQuantity}</td>

                    <td>{movement.destination || "Not provided"}</td>

                    <td>{movement.referenceNumber || "Not provided"}</td>

                    <td>
                      <strong>{formatCurrency(movement.totalCost)}</strong>
                    </td>

                    <td>
                      {movement.releasedByName ||
                        movement.releasedBy ||
                        "Not recorded"}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="stock-out-history-view-button"
                        onClick={() => handleViewDetails(movement)}
                        disabled={isLoadingDetails}
                      >
                        {isLoadingDetails ? "Loading..." : "View Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default StockOutHistory;
