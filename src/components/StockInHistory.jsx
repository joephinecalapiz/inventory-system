import { useEffect, useMemo, useState } from "react";

import "../styles/StockInHistory.css";

import {
  STOCK_IN_REASON_LABELS,
  getTodayInputDate,
} from "../constants/stockIn";

import { subscribeToStockInReceipts } from "../services/stockInService";

const ALL_FILTER = "ALL";

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

function getDateInputValue(value) {
  const date = convertToDate(value);

  if (!date) {
    return "";
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatReceiptDate(value) {
  const date = convertToDate(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function getReasonLabel(reason) {
  return STOCK_IN_REASON_LABELS[reason] || reason || "Not specified";
}

function getProductFilterValue(receipt) {
  return String(receipt.productId || receipt.productName || "").trim();
}

function StockInHistory() {
  const [receipts, setReceipts] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [productFilter, setProductFilter] = useState(ALL_FILTER);

  const [sourceFilter, setSourceFilter] = useState(ALL_FILTER);

  const [referenceFilter, setReferenceFilter] = useState("");

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToStockInReceipts(
      (stockInReceipts) => {
        setReceipts(stockInReceipts);

        setLoadError("");
        setIsLoading(false);
      },

      (error) => {
        setLoadError(error?.message || "Unable to load Stock-In history.");

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const productOptions = useMemo(() => {
    const productMap = new Map();

    for (const receipt of receipts) {
      const value = getProductFilterValue(receipt);

      if (!value) {
        continue;
      }

      const productName = String(
        receipt.productName ?? "Unknown product",
      ).trim();

      const productSku = String(receipt.productSku ?? "").trim();

      const label = productSku ? `${productName} — ${productSku}` : productName;

      productMap.set(value, label);
    }

    return [...productMap.entries()]
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort((firstProduct, secondProduct) =>
        firstProduct.label.localeCompare(secondProduct.label),
      );
  }, [receipts]);

  const sourceOptions = useMemo(() => {
    return [
      ...new Set(
        receipts
          .map((receipt) => String(receipt.source ?? "").trim())
          .filter(Boolean),
      ),
    ].sort((firstSource, secondSource) =>
      firstSource.localeCompare(secondSource),
    );
  }, [receipts]);

  const isDateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filteredReceipts = useMemo(() => {
    if (isDateRangeInvalid) {
      return [];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const normalizedReference = referenceFilter.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const receiptDate = getDateInputValue(
        receipt.dateReceived ?? receipt.createdAt,
      );

      const searchableText = [
        receipt.productName,
        receipt.productSku,
        receipt.barcode,
        receipt.category,
        receipt.source,
        receipt.referenceNumber,
        receipt.receivedByName,
        receipt.remarks,
        receipt.reason,
        getReasonLabel(receipt.reason),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesProduct =
        productFilter === ALL_FILTER ||
        getProductFilterValue(receipt) === productFilter;

      const matchesSource =
        sourceFilter === ALL_FILTER ||
        String(receipt.source ?? "").trim() === sourceFilter;

      const matchesReference = String(receipt.referenceNumber ?? "")
        .toLowerCase()
        .includes(normalizedReference);

      const matchesDateFrom =
        !dateFrom || Boolean(receiptDate && receiptDate >= dateFrom);

      const matchesDateTo =
        !dateTo || Boolean(receiptDate && receiptDate <= dateTo);

      return (
        matchesSearch &&
        matchesProduct &&
        matchesSource &&
        matchesReference &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    receipts,
    searchTerm,
    productFilter,
    sourceFilter,
    referenceFilter,
    dateFrom,
    dateTo,
    isDateRangeInvalid,
  ]);

  const historySummary = useMemo(() => {
    const totalQuantity = filteredReceipts.reduce(
      (total, receipt) => total + Number(receipt.quantity ?? 0),
      0,
    );

    const totalValue = filteredReceipts.reduce(
      (total, receipt) => total + Number(receipt.totalCost ?? 0),
      0,
    );

    const uniqueProducts = new Set(
      filteredReceipts.map(getProductFilterValue).filter(Boolean),
    ).size;

    return {
      totalReceipts: filteredReceipts.length,

      totalQuantity,

      totalValue,

      uniqueProducts,
    };
  }, [filteredReceipts]);

  function clearFilters() {
    setSearchTerm("");
    setProductFilter(ALL_FILTER);
    setSourceFilter(ALL_FILTER);
    setReferenceFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="stock-in-history-card">
      <div className="stock-in-history-heading">
        <div>
          <p className="section-label">Permanent records</p>

          <h3>Stock-In History</h3>

          <span>
            Review completed stock receipts, inventory balance changes,
            suppliers, references, and receiving information.
          </span>
        </div>

        <span className="stock-in-history-count">
          {filteredReceipts.length} of {receipts.length} receipt(s)
        </span>
      </div>

      <div className="stock-in-history-summary">
        <article>
          <span>Filtered receipts</span>

          <strong>{historySummary.totalReceipts}</strong>
        </article>

        <article>
          <span>Quantity received</span>

          <strong>{historySummary.totalQuantity}</strong>
        </article>

        <article>
          <span>Receipt value</span>

          <strong>{formatCurrency(historySummary.totalValue)}</strong>
        </article>

        <article>
          <span>Products received</span>

          <strong>{historySummary.uniqueProducts}</strong>
        </article>
      </div>

      {loadError && (
        <div
          className="stock-in-history-message stock-in-history-message-error"
          role="alert"
        >
          {loadError}
        </div>
      )}

      <div className="stock-in-history-filters">
        <label className="stock-in-history-search">
          <span>Search receipts</span>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search product, SKU, supplier, recipient, or remarks"
          />
        </label>

        <label>
          <span>Product</span>

          <select
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          >
            <option value={ALL_FILTER}>All products</option>

            {productOptions.map((product) => (
              <option key={product.value} value={product.value}>
                {product.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Source or supplier</span>

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value={ALL_FILTER}>All sources</option>

            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Reference number</span>

          <input
            type="search"
            value={referenceFilter}
            onChange={(event) => setReferenceFilter(event.target.value)}
            placeholder="Search reference"
          />
        </label>

        <label>
          <span>Date from</span>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            max={dateTo || getTodayInputDate()}
          />
        </label>

        <label>
          <span>Date to</span>

          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            min={dateFrom}
            max={getTodayInputDate()}
          />
        </label>

        <button
          type="button"
          className="stock-in-history-clear"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </div>

      {isDateRangeInvalid && (
        <div
          className="stock-in-history-message stock-in-history-message-error"
          role="alert"
        >
          The starting date cannot be later than the ending date.
        </div>
      )}

      {isLoading ? (
        <div className="stock-in-history-empty">
          <strong>Loading Stock-In history...</strong>

          <p>Fetching permanent inventory receipt records from Firebase.</p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="stock-in-history-empty">
          <strong>No Stock-In receipts found</strong>

          <p>Save a Stock-In receipt or change the selected history filters.</p>
        </div>
      ) : (
        <div className="stock-in-history-table-wrapper">
          <table className="stock-in-history-table">
            <thead>
              <tr>
                <th>Date received</th>
                <th>Product</th>
                <th>Reference</th>
                <th>Source</th>
                <th>Reason</th>
                <th>Quantity</th>
                <th>Unit cost</th>
                <th>Total value</th>
                <th>Balance</th>
                <th>Received by</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td>
                    <span className="stock-in-history-date">
                      {formatReceiptDate(
                        receipt.dateReceived ?? receipt.createdAt,
                      )}
                    </span>
                  </td>

                  <td>
                    <div className="stock-in-history-product">
                      <strong>
                        {receipt.productName || "Unknown product"}
                      </strong>

                      <span>{receipt.productSku || "No SKU"}</span>
                    </div>
                  </td>

                  <td>
                    <span className="stock-in-history-reference">
                      {receipt.referenceNumber || "No reference"}
                    </span>
                  </td>

                  <td>{receipt.source || "Not recorded"}</td>

                  <td>
                    <span className="stock-in-history-reason">
                      {getReasonLabel(receipt.reason)}
                    </span>
                  </td>

                  <td>
                    <strong>{Number(receipt.quantity ?? 0)}</strong>
                  </td>

                  <td>{formatCurrency(receipt.unitCost)}</td>

                  <td>
                    <strong>{formatCurrency(receipt.totalCost)}</strong>
                  </td>

                  <td>
                    <span className="stock-in-history-balance">
                      {Number(receipt.previousQuantity ?? 0)} →{" "}
                      {Number(receipt.newQuantity ?? 0)}
                    </span>
                  </td>

                  <td>{receipt.receivedByName || "Unknown user"}</td>

                  <td>
                    <span className="stock-in-history-remarks">
                      {receipt.remarks || "No remarks"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="stock-in-history-notice">
        <strong>Read-only inventory history</strong>

        <span>
          Stock-In receipt records are permanent. Corrections should be handled
          through a controlled adjustment process instead of editing or deleting
          movement history.
        </span>
      </div>
    </section>
  );
}

export default StockInHistory;
