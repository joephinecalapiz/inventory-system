import { useEffect, useMemo, useRef, useState } from "react";

import "../styles/StockAdjustments.css";

import { USER_ROLES } from "../constants/roles";

import {
  STOCK_ADJUSTMENT_DIRECTIONS,
  STOCK_ADJUSTMENT_LIMITS,
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASON_OPTIONS,
  calculateStockAdjustmentDifference,
  calculateStockAdjustmentValue,
  canRoleCreateStockAdjustment,
  createEmptyStockAdjustmentForm,
  getStockAdjustmentDirection,
  isAdjustmentReasonAllowedForDirection,
  isValidStockAdjustmentDateNotFuture,
  isValidStockAdjustmentQuantity,
  isValidStockAdjustmentReference,
  isValidStockAdjustmentRemarks,
} from "../constants/stockAdjustment";

import { subscribeToActiveProducts } from "../services/productService";

import { createStockAdjustmentRequest } from "../services/stockAdjustmentService";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function getProductQuantity(product) {
  const quantity = Number(product?.quantity ?? 0);

  return Number.isInteger(quantity) && quantity >= 0 ? quantity : 0;
}

function getProductCostPrice(product) {
  const costPrice = Number(product?.costPrice ?? product?.unitCost ?? 0);

  return Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0;
}

function getProductUnitLabel(product) {
  return (
    product?.unitAbbreviation ||
    product?.unitName ||
    product?.unitCode ||
    "Not assigned"
  );
}

function getReasonLabel(reason) {
  return (
    STOCK_ADJUSTMENT_REASON_LABELS[reason] ||
    String(reason ?? "")
      .replaceAll("_", " ")
      .toLowerCase()
  );
}

function getDirectionLabel(direction) {
  if (direction === STOCK_ADJUSTMENT_DIRECTIONS.IN) {
    return "Increase";
  }

  if (direction === STOCK_ADJUSTMENT_DIRECTIONS.OUT) {
    return "Decrease";
  }

  return "No change";
}

function getDifferenceDisplay(difference) {
  if (!Number.isInteger(difference)) {
    return "—";
  }

  return difference > 0 ? `+${difference}` : String(difference);
}

function StockAdjustments({ currentUserRole }) {
  const feedbackRef = useRef(null);

  const canCreateRequest = canRoleCreateStockAdjustment(currentUserRole);

  const isAuditor = currentUserRole === USER_ROLES.AUDITOR;

  const [products, setProducts] = useState([]);

  const [form, setForm] = useState(() => createEmptyStockAdjustmentForm());

  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [submittedRequest, setSubmittedRequest] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToActiveProducts(
      (activeProducts) => {
        setProducts(activeProducts);
        setIsLoading(false);
      },

      (error) => {
        console.error(
          "Unable to load active Products for Stock Adjustment:",
          error,
        );

        setMessage({
          type: "error",
          text: error?.message || "Unable to load active Products.",
        });

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!message.text) {
      return;
    }

    feedbackRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [message]);

  useEffect(() => {
    if (!isConfirmationOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        setIsConfirmationOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirmationOpen, isSubmitting]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) ?? null,
    [products, form.productId],
  );

  const systemQuantity = selectedProduct
    ? getProductQuantity(selectedProduct)
    : null;

  const actualCountedQuantity =
    form.actualCountedQuantity === ""
      ? null
      : Number(form.actualCountedQuantity);

  const quantityDifference =
    selectedProduct && isValidStockAdjustmentQuantity(actualCountedQuantity)
      ? calculateStockAdjustmentDifference(
          systemQuantity,
          actualCountedQuantity,
        )
      : null;

  const adjustmentDirection = getStockAdjustmentDirection(quantityDifference);

  const estimatedValue =
    selectedProduct &&
    Number.isInteger(quantityDifference) &&
    quantityDifference !== 0
      ? calculateStockAdjustmentValue(
          quantityDifference,
          getProductCostPrice(selectedProduct),
        )
      : 0;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) => {
      const searchableValues = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.categoryName,
        product.unitName,
        product.unitAbbreviation,
        product.unitCode,
      ];

      return searchableValues.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    });
  }, [products, searchTerm]);

  const allowedReasonOptions = useMemo(() => {
    if (!adjustmentDirection) {
      return STOCK_ADJUSTMENT_REASON_OPTIONS;
    }

    return STOCK_ADJUSTMENT_REASON_OPTIONS.filter((option) =>
      isAdjustmentReasonAllowedForDirection(option.value, adjustmentDirection),
    );
  }, [adjustmentDirection]);

  useEffect(() => {
    if (
      !adjustmentDirection ||
      isAdjustmentReasonAllowedForDirection(form.reason, adjustmentDirection)
    ) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      reason: allowedReasonOptions[0]?.value ?? "",
    }));
  }, [adjustmentDirection, allowedReasonOptions, form.reason]);

  function handleSelectProduct(productId) {
    if (!canCreateRequest) {
      return;
    }

    setSubmittedRequest(null);

    setMessage({
      type: "",
      text: "",
    });

    setForm((currentForm) => ({
      ...currentForm,
      productId,
      actualCountedQuantity: "",
    }));

    window.requestAnimationFrame(() => {
      document.querySelector(".stock-adjustment-form-card")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setMessage({
      type: "",
      text: "",
    });

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function resetRequestForm({ keepSelectedProduct = false } = {}) {
    setForm(
      createEmptyStockAdjustmentForm(keepSelectedProduct ? form.productId : ""),
    );

    setSubmittedRequest(null);

    setMessage({
      type: "",
      text: "",
    });

    setIsConfirmationOpen(false);
  }

  function validateRequestForm() {
    if (!canCreateRequest) {
      return "Your account cannot submit Stock Adjustment requests.";
    }

    if (!selectedProduct) {
      return "Select an active Product first.";
    }

    if (!isValidStockAdjustmentQuantity(actualCountedQuantity)) {
      return `Actual counted quantity must be a non-negative whole number not greater than ${STOCK_ADJUSTMENT_LIMITS.MAX_STOCK_QUANTITY}.`;
    }

    if (quantityDifference === null) {
      return "Unable to calculate a valid stock difference.";
    }

    if (quantityDifference === 0) {
      return "No Stock Adjustment is required because the physical count matches the system quantity.";
    }

    if (!adjustmentDirection) {
      return "Unable to determine whether the adjustment increases or decreases stock.";
    }

    if (
      !isAdjustmentReasonAllowedForDirection(form.reason, adjustmentDirection)
    ) {
      return "The selected reason is not valid for this adjustment direction.";
    }

    if (!isValidStockAdjustmentDateNotFuture(form.countDate)) {
      return "Enter a valid count date that is not in the future.";
    }

    if (!isValidStockAdjustmentReference(form.referenceNumber)) {
      return `Reference number cannot exceed ${STOCK_ADJUSTMENT_LIMITS.REFERENCE_MAX_LENGTH} characters.`;
    }

    if (!isValidStockAdjustmentRemarks(form.remarks)) {
      return `Remarks cannot exceed ${STOCK_ADJUSTMENT_LIMITS.REMARKS_MAX_LENGTH} characters.`;
    }

    return "";
  }

  function handleReviewRequest(event) {
    event.preventDefault();

    const validationMessage = validateRequestForm();

    if (validationMessage) {
      setMessage({
        type: "error",
        text: validationMessage,
      });

      return;
    }

    setMessage({
      type: "",
      text: "",
    });

    setIsConfirmationOpen(true);
  }

  function closeConfirmation() {
    if (!isSubmitting) {
      setIsConfirmationOpen(false);
    }
  }

  async function handleSubmitRequest() {
    const validationMessage = validateRequestForm();

    if (validationMessage) {
      setMessage({
        type: "error",
        text: validationMessage,
      });

      setIsConfirmationOpen(false);

      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createStockAdjustmentRequest(form);

      setSubmittedRequest(result);

      setMessage({
        type: "success",
        text: result.isReplay
          ? "This Stock Adjustment request was already submitted. The stored request was loaded."
          : "Stock Adjustment request submitted successfully for review.",
      });

      setIsConfirmationOpen(false);

      setForm(createEmptyStockAdjustmentForm());
    } catch (error) {
      console.error("Unable to submit Stock Adjustment request:", error);

      setMessage({
        type: "error",
        text:
          error?.message || "Unable to submit the Stock Adjustment request.",
      });

      setIsConfirmationOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="stock-adjustment-page">
      <header className="stock-adjustment-page-header">
        <div>
          <p className="stock-adjustment-eyebrow">Inventory control</p>

          <h2>Stock Adjustments</h2>

          <p>
            Record a verified physical-count difference without changing Product
            stock until an authorised reviewer approves and posts it.
          </p>
        </div>

        <div className="stock-adjustment-header-status">
          <span>Workflow status</span>
          <strong>Request stage</strong>
        </div>
      </header>

      <div ref={feedbackRef} aria-live="polite">
        {message.text && (
          <div
            className={[
              "stock-adjustment-message",
              `stock-adjustment-message-${message.type}`,
            ].join(" ")}
          >
            {message.text}
          </div>
        )}
      </div>

      {!canCreateRequest && (
        <section className="stock-adjustment-read-only-notice">
          <strong>Read-only access</strong>

          <p>
            {isAuditor
              ? "Auditors can review active Product balances, but they cannot submit Stock Adjustment requests."
              : "Your role cannot submit or review Stock Adjustment requests."}
          </p>
        </section>
      )}

      {submittedRequest && (
        <section className="stock-adjustment-success-card">
          <div>
            <p className="stock-adjustment-eyebrow">Request submitted</p>

            <h3>{submittedRequest.productName}</h3>

            <p>
              The Product balance has not changed. This request is waiting for
              review.
            </p>
          </div>

          <div className="stock-adjustment-success-grid">
            <div>
              <span>Request ID</span>
              <strong>{submittedRequest.adjustmentId}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{submittedRequest.status}</strong>
            </div>

            <div>
              <span>System quantity</span>
              <strong>{submittedRequest.systemQuantityAtRequest}</strong>
            </div>

            <div>
              <span>Actual count</span>
              <strong>{submittedRequest.actualCountedQuantity}</strong>
            </div>

            <div>
              <span>Difference</span>
              <strong>
                {getDifferenceDisplay(submittedRequest.quantityDifference)}
              </strong>
            </div>

            <div>
              <span>Direction</span>
              <strong>
                {getDirectionLabel(submittedRequest.adjustmentDirection)}
              </strong>
            </div>
          </div>

          <button type="button" onClick={() => resetRequestForm()}>
            Create Another Request
          </button>
        </section>
      )}

      <section className="stock-adjustment-summary-grid">
        <article>
          <span>Active Products</span>
          <strong>{products.length}</strong>
        </article>

        <article>
          <span>Visible Results</span>
          <strong>{filteredProducts.length}</strong>
        </article>

        <article>
          <span>Selected Product</span>
          <strong>{selectedProduct?.sku || "None"}</strong>
        </article>

        <article>
          <span>Calculated Difference</span>
          <strong>{getDifferenceDisplay(quantityDifference)}</strong>
        </article>
      </section>

      {canCreateRequest && selectedProduct && (
        <section className="stock-adjustment-form-card">
          <div className="stock-adjustment-card-heading">
            <div>
              <p className="stock-adjustment-eyebrow">Adjustment request</p>

              <h3>{selectedProduct.name}</h3>
            </div>

            <span className="stock-adjustment-selected-badge">
              {selectedProduct.sku}
            </span>
          </div>

          <div className="stock-adjustment-product-preview">
            <div>
              <span>Category</span>
              <strong>
                {selectedProduct.category ||
                  selectedProduct.categoryName ||
                  "Not assigned"}
              </strong>
            </div>

            <div>
              <span>Unit</span>
              <strong>{getProductUnitLabel(selectedProduct)}</strong>
            </div>

            <div>
              <span>System quantity</span>
              <strong>{systemQuantity}</strong>
            </div>

            <div>
              <span>Cost price</span>
              <strong>
                {formatCurrency(getProductCostPrice(selectedProduct))}
              </strong>
            </div>
          </div>

          <form
            className="stock-adjustment-form"
            onSubmit={handleReviewRequest}
          >
            <div className="stock-adjustment-form-grid">
              <label>
                Actual Counted Quantity *
                <input
                  type="number"
                  name="actualCountedQuantity"
                  value={form.actualCountedQuantity}
                  onChange={handleFormChange}
                  min="0"
                  max={STOCK_ADJUSTMENT_LIMITS.MAX_STOCK_QUANTITY}
                  step="1"
                  placeholder="Enter physical count"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                Adjustment Reason *
                <select
                  name="reason"
                  value={form.reason}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  required
                >
                  {allowedReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Count Date *
                <input
                  type="date"
                  name="countDate"
                  value={form.countDate}
                  onChange={handleFormChange}
                  max={new Date().toLocaleDateString("en-CA")}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                Reference Number
                <input
                  type="text"
                  name="referenceNumber"
                  value={form.referenceNumber}
                  onChange={handleFormChange}
                  maxLength={STOCK_ADJUSTMENT_LIMITS.REFERENCE_MAX_LENGTH}
                  placeholder="Example: COUNT-2026-001"
                  disabled={isSubmitting}
                />
              </label>
            </div>

            <label className="stock-adjustment-remarks-field">
              Remarks
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleFormChange}
                maxLength={STOCK_ADJUSTMENT_LIMITS.REMARKS_MAX_LENGTH}
                rows="4"
                placeholder="Describe how the discrepancy was verified."
                disabled={isSubmitting}
              />
              <span>
                {form.remarks.length}/
                {STOCK_ADJUSTMENT_LIMITS.REMARKS_MAX_LENGTH}
              </span>
            </label>

            <div className="stock-adjustment-calculation-grid">
              <article>
                <span>System Quantity</span>
                <strong>{systemQuantity}</strong>
              </article>

              <article>
                <span>Actual Count</span>
                <strong>{actualCountedQuantity ?? "—"}</strong>
              </article>

              <article
                className={[
                  "stock-adjustment-difference-card",
                  adjustmentDirection
                    ? `stock-adjustment-direction-${adjustmentDirection.toLowerCase()}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>Difference</span>
                <strong>{getDifferenceDisplay(quantityDifference)}</strong>
              </article>

              <article>
                <span>Estimated Value</span>
                <strong>{formatCurrency(estimatedValue)}</strong>
              </article>
            </div>

            <div className="stock-adjustment-form-note">
              <strong>This is a request only.</strong>

              <span>
                Submitting will not change the Product quantity and will not
                create an inventory movement.
              </span>
            </div>

            <div className="stock-adjustment-form-actions">
              <button
                type="button"
                className="stock-adjustment-secondary-button"
                onClick={() => resetRequestForm()}
                disabled={isSubmitting}
              >
                Clear Form
              </button>

              <button
                type="submit"
                className="stock-adjustment-primary-button"
                disabled={isSubmitting}
              >
                Review Request
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="stock-adjustment-product-card">
        <div className="stock-adjustment-card-heading">
          <div>
            <p className="stock-adjustment-eyebrow">Active inventory</p>

            <h3>Select a Product to Count</h3>
          </div>

          <span>
            {filteredProducts.length} of {products.length}
          </span>
        </div>

        <div className="stock-adjustment-search-row">
          <label>
            Search Products
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, SKU, barcode, category, or unit"
            />
          </label>

          <button
            type="button"
            onClick={() => setSearchTerm("")}
            disabled={!searchTerm}
          >
            Clear Search
          </button>
        </div>

        {isLoading ? (
          <div className="stock-adjustment-empty-state">
            <strong>Loading active Products...</strong>

            <p>Fetching inventory balances from Firestore.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="stock-adjustment-empty-state">
            <strong>No matching Products found</strong>

            <p>
              Try another search term or confirm that active Products exist.
            </p>
          </div>
        ) : (
          <div className="stock-adjustment-table-wrapper">
            <table className="stock-adjustment-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Barcode</th>
                  <th>Cost Price</th>
                  <th>System Quantity</th>

                  {canCreateRequest && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const isSelected = product.id === selectedProduct?.id;

                  return (
                    <tr
                      key={product.id}
                      className={
                        isSelected ? "stock-adjustment-selected-row" : ""
                      }
                    >
                      <td>
                        <div className="stock-adjustment-product-cell">
                          <strong>{product.name}</strong>

                          <span>{product.sku}</span>
                        </div>
                      </td>

                      <td>
                        {product.category ||
                          product.categoryName ||
                          "Not assigned"}
                      </td>

                      <td>{getProductUnitLabel(product)}</td>

                      <td>{product.barcode || "Not assigned"}</td>

                      <td>{formatCurrency(getProductCostPrice(product))}</td>

                      <td>
                        <strong>{getProductQuantity(product)}</strong>
                      </td>

                      {canCreateRequest && (
                        <td>
                          <button
                            type="button"
                            className="stock-adjustment-select-button"
                            onClick={() => handleSelectProduct(product.id)}
                            disabled={isSubmitting}
                          >
                            {isSelected ? "Selected" : "Select Product"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isConfirmationOpen && selectedProduct && (
        <div
          className="stock-adjustment-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmation();
            }
          }}
        >
          <section
            className="stock-adjustment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjustment-confirmation-title"
          >
            <div className="stock-adjustment-modal-heading">
              <div>
                <p className="stock-adjustment-eyebrow">Final confirmation</p>

                <h3 id="stock-adjustment-confirmation-title">
                  Submit Adjustment Request?
                </h3>
              </div>

              <button
                type="button"
                aria-label="Close confirmation"
                onClick={closeConfirmation}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>

            <div className="stock-adjustment-modal-notice">
              <strong>Product stock will not change.</strong>

              <span>
                An authorised reviewer must approve and post this request in
                Phase 6D.
              </span>
            </div>

            <div className="stock-adjustment-modal-grid">
              <div>
                <span>Product</span>
                <strong>{selectedProduct.name}</strong>
              </div>

              <div>
                <span>SKU</span>
                <strong>{selectedProduct.sku}</strong>
              </div>

              <div>
                <span>System quantity</span>
                <strong>{systemQuantity}</strong>
              </div>

              <div>
                <span>Actual count</span>
                <strong>{actualCountedQuantity}</strong>
              </div>

              <div>
                <span>Difference</span>
                <strong>{getDifferenceDisplay(quantityDifference)}</strong>
              </div>

              <div>
                <span>Direction</span>
                <strong>{getDirectionLabel(adjustmentDirection)}</strong>
              </div>

              <div>
                <span>Reason</span>
                <strong>{getReasonLabel(form.reason)}</strong>
              </div>

              <div>
                <span>Estimated value</span>
                <strong>{formatCurrency(estimatedValue)}</strong>
              </div>

              <div>
                <span>Count date</span>
                <strong>{form.countDate}</strong>
              </div>

              <div>
                <span>Reference</span>
                <strong>{form.referenceNumber || "Not provided"}</strong>
              </div>
            </div>

            <div className="stock-adjustment-modal-actions">
              <button
                type="button"
                className="stock-adjustment-secondary-button"
                onClick={closeConfirmation}
                disabled={isSubmitting}
              >
                Go Back
              </button>

              <button
                type="button"
                className="stock-adjustment-primary-button"
                onClick={handleSubmitRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default StockAdjustments;
