import { useEffect, useMemo, useState } from "react";

import "../styles/GoodsReceiptHistory.css";

import GoodsReceiptPrint from "../components/GoodsReceiptPrint";

import { GOODS_RECEIPT_STATUS_LABELS } from "../constants/goodsReceiving";

import {
  getGoodsReceiptDetails,
  subscribeToGoodsReceiptHistory,
} from "../services/goodsReceiptHistoryService";

const ALL_FILTER = "ALL";

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

function getStatusClassName(status) {
  return `goods-receipt-history-status-${String(status ?? "")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function GoodsReceiptHistory() {
  const [receipts, setReceipts] = useState([]);

  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);

  const [isLoading, setIsLoading] = useState(true);

  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToGoodsReceiptHistory(
      (goodsReceipts) => {
        setReceipts(goodsReceipts);

        setErrorMessage("");

        setIsLoading(false);
      },

      (error) => {
        console.error("Unable to load Goods Receipt history:", error);

        setErrorMessage(
          error?.message || "Unable to load Goods Receipt history.",
        );

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    return receipts.reduce(
      (result, receipt) => ({
        count: result.count + 1,

        totalItems: result.totalItems + Number(receipt.itemCount ?? 0),

        totalQuantity:
          result.totalQuantity + Number(receipt.totalReceivedQuantity ?? 0),

        totalValue: result.totalValue + Number(receipt.totalValue ?? 0),
      }),
      {
        count: 0,
        totalItems: 0,
        totalQuantity: 0,
        totalValue: 0,
      },
    );
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const searchableText = [
        receipt.goodsReceiptNumber,
        receipt.poNumber,
        receipt.supplierCode,
        receipt.supplierName,
        receipt.referenceNumber,
        receipt.receivedByName,
        receipt.status,
        GOODS_RECEIPT_STATUS_LABELS[receipt.status],
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER || receipt.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [receipts, searchTerm, statusFilter]);

  async function handleViewReceipt(receipt) {
    try {
      setIsLoadingDetails(true);

      setErrorMessage("");

      const details = await getGoodsReceiptDetails(receipt.id);

      setSelectedReceipt(details);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Unable to load Goods Receipt details:", error);

      setErrorMessage(
        error?.message || "Unable to load Goods Receipt details.",
      );
    } finally {
      setIsLoadingDetails(false);
    }
  }

  function handlePrintReceipt() {
    if (!selectedReceipt) {
      setErrorMessage("Select a Goods Receipt before printing.");

      return;
    }

    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  function clearFilters() {
    setSearchTerm("");

    setStatusFilter(ALL_FILTER);
  }

  return (
    <main className="page goods-receipt-history-page">
      <header className="goods-receipt-history-header">
        <div>
          <p className="section-label">Procurement receiving</p>

          <h2>Goods Receipt History</h2>

          <p>
            Review permanent Goods Receipt records, supplier references,
            received quantities, and posted inventory values.
          </p>
        </div>
      </header>

      {errorMessage && (
        <div className="goods-receipt-history-message" role="alert">
          {errorMessage}
        </div>
      )}

      <section className="goods-receipt-history-summary">
        <article>
          <span>Total receipts</span>

          <strong>{summary.count}</strong>
        </article>

        <article>
          <span>Total receipt items</span>

          <strong>{summary.totalItems}</strong>
        </article>

        <article>
          <span>Total quantity received</span>

          <strong>{summary.totalQuantity}</strong>
        </article>

        <article>
          <span>Total receiving value</span>

          <strong>{formatCurrency(summary.totalValue)}</strong>
        </article>
      </section>

      {selectedReceipt && (
        <section className="goods-receipt-history-details-card">
          <div className="goods-receipt-history-details-heading">
            <div>
              <p className="section-label">Receipt details</p>

              <h3>{selectedReceipt.goodsReceiptNumber}</h3>
            </div>

            <div className="goods-receipt-history-details-actions">
              <button
                type="button"
                className="goods-receipt-history-print-button"
                onClick={handlePrintReceipt}
              >
                Print Goods Receipt
              </button>

              <button type="button" onClick={() => setSelectedReceipt(null)}>
                Close Details
              </button>
            </div>
          </div>

          <div className="goods-receipt-history-details-grid">
            <div>
              <span>Purchase Order</span>

              <strong>{selectedReceipt.poNumber}</strong>
            </div>

            <div>
              <span>Supplier</span>

              <strong>{selectedReceipt.supplierName}</strong>

              <small>{selectedReceipt.supplierCode}</small>
            </div>

            <div>
              <span>Supplier reference</span>

              <strong>{selectedReceipt.referenceNumber}</strong>
            </div>

            <div>
              <span>Date received</span>

              <strong>{formatDisplayDate(selectedReceipt.dateReceived)}</strong>
            </div>

            <div>
              <span>Received by</span>

              <strong>
                {selectedReceipt.receivedByName || selectedReceipt.receivedBy}
              </strong>
            </div>

            <div>
              <span>Status</span>

              <strong>
                {GOODS_RECEIPT_STATUS_LABELS[selectedReceipt.status] ||
                  selectedReceipt.status}
              </strong>
            </div>

            <div>
              <span>Receipt items</span>

              <strong>{selectedReceipt.itemCount}</strong>
            </div>

            <div>
              <span>Quantity received</span>

              <strong>{selectedReceipt.totalReceivedQuantity}</strong>
            </div>

            <div>
              <span>Total value</span>

              <strong>{formatCurrency(selectedReceipt.totalValue)}</strong>
            </div>
          </div>

          {selectedReceipt.remarks && (
            <div className="goods-receipt-history-remarks">
              <span>Remarks</span>

              <p>{selectedReceipt.remarks}</p>
            </div>
          )}

          <div className="goods-receipt-history-items-wrapper">
            <table className="goods-receipt-history-items-table">
              <thead>
                <tr>
                  <th>Product</th>

                  <th>Unit</th>

                  <th>Ordered</th>

                  <th>Previously Received</th>

                  <th>Received on GRN</th>

                  <th>Remaining</th>

                  <th>Unit Cost</th>

                  <th>Line Total</th>
                </tr>
              </thead>

              <tbody>
                {selectedReceipt.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="goods-receipt-history-product-cell">
                        <strong>{item.productName}</strong>

                        <span>{item.productSku}</span>

                        <small>{item.category}</small>
                      </div>
                    </td>

                    <td>
                      {item.unitAbbreviation || item.unitName || "Not assigned"}
                    </td>

                    <td>{Number(item.orderedQuantity ?? 0)}</td>

                    <td>{Number(item.previouslyReceivedQuantity ?? 0)}</td>

                    <td>
                      <strong>{Number(item.quantityReceived ?? 0)}</strong>
                    </td>

                    <td>{Number(item.remainingQuantity ?? 0)}</td>

                    <td>{formatCurrency(item.unitCost)}</td>

                    <td>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="goods-receipt-history-print-notice">
            <strong>Print-ready Goods Receipt Note</strong>

            <span>
              Use the Print Goods Receipt button to open your browser print
              dialog. Choose Save as PDF in the print dialog when a local PDF
              copy is needed.
            </span>
          </div>
        </section>
      )}

      <section className="goods-receipt-history-list-card">
        <div className="goods-receipt-history-list-heading">
          <div>
            <p className="section-label">Permanent records</p>

            <h3>Goods Receipt Directory</h3>
          </div>

          <span>
            {filteredReceipts.length} of {receipts.length}
          </span>
        </div>

        <div className="goods-receipt-history-filters">
          <label>
            Search Goods Receipts
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search GRN, PO, supplier, reference, receiver, or status"
            />
          </label>

          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value={ALL_FILTER}>All statuses</option>

              {Object.entries(GOODS_RECEIPT_STATUS_LABELS).map(
                ([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        {isLoading ? (
          <div className="goods-receipt-history-empty">
            <strong>Loading Goods Receipt history...</strong>

            <p>Fetching permanent receiving records from Firebase.</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="goods-receipt-history-empty">
            <strong>No Goods Receipts found</strong>

            <p>Post a Goods Receipt or change the selected filters.</p>
          </div>
        ) : (
          <div className="goods-receipt-history-list-wrapper">
            <table className="goods-receipt-history-list-table">
              <thead>
                <tr>
                  <th>GRN Number</th>

                  <th>Purchase Order</th>

                  <th>Supplier</th>

                  <th>Reference</th>

                  <th>Date Received</th>

                  <th>Items</th>

                  <th>Quantity</th>

                  <th>Total Value</th>

                  <th>Status</th>

                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <strong>{receipt.goodsReceiptNumber}</strong>
                    </td>

                    <td>{receipt.poNumber}</td>

                    <td>
                      <div className="goods-receipt-history-supplier-cell">
                        <strong>{receipt.supplierName}</strong>

                        <span>{receipt.supplierCode}</span>
                      </div>
                    </td>

                    <td>{receipt.referenceNumber}</td>

                    <td>{formatDisplayDate(receipt.dateReceived)}</td>

                    <td>{Number(receipt.itemCount ?? 0)}</td>

                    <td>{Number(receipt.totalReceivedQuantity ?? 0)}</td>

                    <td>
                      <strong>{formatCurrency(receipt.totalValue)}</strong>
                    </td>

                    <td>
                      <span
                        className={`goods-receipt-history-status-badge ${getStatusClassName(
                          receipt.status,
                        )}`}
                      >
                        {GOODS_RECEIPT_STATUS_LABELS[receipt.status] ||
                          receipt.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="goods-receipt-history-view-button"
                        onClick={() => handleViewReceipt(receipt)}
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

      <GoodsReceiptPrint receipt={selectedReceipt} />
    </main>
  );
}

export default GoodsReceiptHistory;
