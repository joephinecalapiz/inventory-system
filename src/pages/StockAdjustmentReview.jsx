import { useEffect, useMemo, useState } from "react";

import "../styles/StockAdjustmentReview.css";

import {
  STOCK_ADJUSTMENT_OPERATION_TYPES,
  STOCK_ADJUSTMENT_STATUSES,
  createStockAdjustmentOperationId,
} from "../constants/stockAdjustment";

import {
  approveAndPostStockAdjustment,
  cancelStockAdjustmentRequest,
  rejectStockAdjustmentRequest,
  subscribeToStockAdjustmentRequests,
} from "../services/stockAdjustmentService";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);

  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function formatDifference(value) {
  const difference = Number(value);

  if (!Number.isInteger(difference)) {
    return "—";
  }

  return difference > 0 ? `+${difference}` : String(difference);
}

function getOperationType(decisionType) {
  if (decisionType === "APPROVE") {
    return STOCK_ADJUSTMENT_OPERATION_TYPES.POST_ADJUSTMENT;
  }

  if (decisionType === "REJECT") {
    return STOCK_ADJUSTMENT_OPERATION_TYPES.REJECT_REQUEST;
  }

  return STOCK_ADJUSTMENT_OPERATION_TYPES.CANCEL_REQUEST;
}

function StockAdjustmentReview() {
  const [requests, setRequests] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedRequestId, setSelectedRequestId] = useState("");

  const [decisionType, setDecisionType] = useState("");

  const [decisionOperationId, setDecisionOperationId] = useState("");

  const [decisionReason, setDecisionReason] = useState("");

  const [confirmStaleRequest, setConfirmStaleRequest] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToStockAdjustmentRequests(
      (items) => {
        setRequests(items);
        setIsLoading(false);
      },

      (error) => {
        console.error("Unable to load Stock Adjustment requests:", error);

        setMessage({
          type: "error",
          text: error?.message || "Unable to load Stock Adjustment requests.",
        });

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const submittedRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status === STOCK_ADJUSTMENT_STATUSES.SUBMITTED,
      ),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return submittedRequests;
    }

    return submittedRequests.filter((request) =>
      [
        request.adjustmentId,
        request.productName,
        request.productSku,
        request.referenceNumber,
        request.requestedByName,
        request.reason,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(search),
      ),
    );
  }, [submittedRequests, searchTerm]);

  const selectedRequest = useMemo(
    () =>
      submittedRequests.find(
        (request) => request.adjustmentId === selectedRequestId,
      ) ?? null,
    [submittedRequests, selectedRequestId],
  );

  function resetDecision() {
    setSelectedRequestId("");
    setDecisionType("");
    setDecisionOperationId("");
    setDecisionReason("");
    setConfirmStaleRequest(false);
  }

  function openDecision(request, nextDecisionType) {
    setSelectedRequestId(request.adjustmentId);

    setDecisionType(nextDecisionType);

    /*
     * Generate once when the dialog opens.
     * Retrying after a network error reuses the
     * same operation ID for idempotency.
     */
    setDecisionOperationId(
      createStockAdjustmentOperationId(getOperationType(nextDecisionType)),
    );

    setDecisionReason("");
    setConfirmStaleRequest(false);

    setMessage({
      type: "",
      text: "",
    });
  }

  async function processDecision() {
    if (!selectedRequest || !decisionOperationId) {
      return;
    }

    setIsProcessing(true);

    try {
      let result;

      if (decisionType === "APPROVE") {
        result = await approveAndPostStockAdjustment({
          adjustmentId: selectedRequest.adjustmentId,

          postOperationId: decisionOperationId,

          confirmStaleRequest,
        });
      } else if (decisionType === "REJECT") {
        result = await rejectStockAdjustmentRequest({
          adjustmentId: selectedRequest.adjustmentId,

          rejectOperationId: decisionOperationId,

          rejectionReason: decisionReason,
        });
      } else {
        result = await cancelStockAdjustmentRequest({
          adjustmentId: selectedRequest.adjustmentId,

          cancelOperationId: decisionOperationId,

          cancellationReason: decisionReason,
        });
      }

      setMessage({
        type: "success",
        text:
          result.status === STOCK_ADJUSTMENT_STATUSES.POSTED
            ? "Stock Adjustment approved and posted successfully."
            : `Stock Adjustment marked as ${result.status}.`,
      });

      resetDecision();
    } catch (error) {
      console.error("Unable to process Stock Adjustment review:", error);

      setMessage({
        type: "error",
        text:
          error?.message || "Unable to process the Stock Adjustment request.",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="stock-adjustment-review-page">
      <header className="stock-adjustment-review-header">
        <div>
          <p className="stock-adjustment-review-eyebrow">Inventory control</p>

          <h2>Stock Adjustment Review</h2>

          <p>
            Review physical-count differences, reject unsupported requests, or
            approve and post valid inventory corrections.
          </p>
        </div>

        <div className="stock-adjustment-review-counter">
          <span>Pending review</span>
          <strong>{submittedRequests.length}</strong>
        </div>
      </header>

      {message.text && (
        <div
          className={[
            "stock-adjustment-review-message",
            `stock-adjustment-review-message-${message.type}`,
          ].join(" ")}
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <section className="stock-adjustment-review-card">
        <div className="stock-adjustment-review-toolbar">
          <label>
            Search requests
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search request, Product, SKU, reference, or requester"
            />
          </label>

          <button
            type="button"
            onClick={() => setSearchTerm("")}
            disabled={!searchTerm}
          >
            Clear
          </button>
        </div>

        {isLoading ? (
          <div className="stock-adjustment-review-empty">
            Loading submitted requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="stock-adjustment-review-empty">
            No submitted Stock Adjustment requests require review.
          </div>
        ) : (
          <div className="stock-adjustment-review-table-wrapper">
            <table className="stock-adjustment-review-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Requester</th>
                  <th>System</th>
                  <th>Actual</th>
                  <th>Difference</th>
                  <th>Reason</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.adjustmentId}>
                    <td>
                      <strong>{request.productName}</strong>
                      <span>{request.productSku}</span>
                    </td>

                    <td>{request.requestedByName}</td>

                    <td>{request.systemQuantityAtRequest}</td>

                    <td>{request.actualCountedQuantity}</td>

                    <td>
                      <strong>
                        {formatDifference(request.quantityDifference)}
                      </strong>
                    </td>

                    <td>{String(request.reason ?? "").replaceAll("_", " ")}</td>

                    <td>{formatDateTime(request.createdAt)}</td>

                    <td>
                      <div className="stock-adjustment-review-actions">
                        <button
                          type="button"
                          className="approve"
                          onClick={() => openDecision(request, "APPROVE")}
                        >
                          Approve & Post
                        </button>

                        <button
                          type="button"
                          className="reject"
                          onClick={() => openDecision(request, "REJECT")}
                        >
                          Reject
                        </button>

                        <button
                          type="button"
                          className="cancel"
                          onClick={() => openDecision(request, "CANCEL")}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRequest && decisionType && (
        <div className="stock-adjustment-review-modal-backdrop">
          <section
            className="stock-adjustment-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjustment-review-title"
          >
            <div className="stock-adjustment-review-modal-heading">
              <div>
                <p className="stock-adjustment-review-eyebrow">
                  Review decision
                </p>

                <h3 id="stock-adjustment-review-title">
                  {decisionType === "APPROVE"
                    ? "Approve and Post"
                    : decisionType === "REJECT"
                      ? "Reject Request"
                      : "Cancel Request"}
                </h3>
              </div>

              <button
                type="button"
                onClick={resetDecision}
                disabled={isProcessing}
                aria-label="Close review dialog"
              >
                ×
              </button>
            </div>

            <div className="stock-adjustment-review-details">
              <div>
                <span>Product</span>
                <strong>{selectedRequest.productName}</strong>
              </div>

              <div>
                <span>SKU</span>
                <strong>{selectedRequest.productSku}</strong>
              </div>

              <div>
                <span>System quantity</span>
                <strong>{selectedRequest.systemQuantityAtRequest}</strong>
              </div>

              <div>
                <span>Actual count</span>
                <strong>{selectedRequest.actualCountedQuantity}</strong>
              </div>

              <div>
                <span>Difference</span>
                <strong>
                  {formatDifference(selectedRequest.quantityDifference)}
                </strong>
              </div>

              <div>
                <span>Estimated value</span>
                <strong>
                  {formatCurrency(selectedRequest.estimatedAdjustmentValue)}
                </strong>
              </div>
            </div>

            {decisionType === "APPROVE" ? (
              <>
                <div className="stock-adjustment-review-warning">
                  Approval updates Product stock, creates a permanent inventory
                  movement, and marks this request as posted.
                </div>

                <label className="stock-adjustment-review-checkbox">
                  <input
                    type="checkbox"
                    checked={confirmStaleRequest}
                    onChange={(event) =>
                      setConfirmStaleRequest(event.target.checked)
                    }
                  />

                  <span>
                    Permit posting when the Product balance changed after the
                    request. The saved difference will be applied to the current
                    balance.
                  </span>
                </label>
              </>
            ) : (
              <label className="stock-adjustment-review-reason">
                {decisionType === "REJECT"
                  ? "Rejection reason *"
                  : "Cancellation reason *"}

                <textarea
                  rows="4"
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  maxLength="500"
                  placeholder="Enter a clear audit reason."
                />
              </label>
            )}

            <div className="stock-adjustment-review-modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={resetDecision}
                disabled={isProcessing}
              >
                Go Back
              </button>

              <button
                type="button"
                className="primary"
                onClick={processDecision}
                disabled={
                  isProcessing ||
                  (decisionType !== "APPROVE" && !decisionReason.trim())
                }
              >
                {isProcessing
                  ? "Processing..."
                  : decisionType === "APPROVE"
                    ? "Approve and Post"
                    : decisionType === "REJECT"
                      ? "Reject Request"
                      : "Cancel Request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default StockAdjustmentReview;
