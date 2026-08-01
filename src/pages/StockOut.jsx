import { useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "react-router-dom";

import "../styles/StockOut.css";

import StockOutHistory from "../components/StockOutHistory";

import { USER_ROLES } from "../constants/roles";

import {
  STOCK_OUT_LIMITS,
  STOCK_OUT_REASON_LABELS,
  STOCK_OUT_REASON_OPTIONS,
  calculateStockOutBalance,
  calculateStockOutTotalCost,
  createEmptyStockOutForm,
  getTodayStockOutDate,
  isStockOutDestinationRequired,
  isValidStockOutDateNotFuture,
  isValidStockOutDestination,
  isValidStockOutQuantity,
  isValidStockOutReason,
  isValidStockOutReference,
  isValidStockOutRemarks,
  normalizeStockOutReference,
} from "../constants/stockOut";

import { subscribeToActiveProducts } from "../services/productService";

import { createStockOutReceipt } from "../services/stockOutService";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function getProductUnitLabel(product) {
  return (
    product?.unitAbbreviation ||
    product?.unitName ||
    product?.unitCode ||
    "Not assigned"
  );
}

function getProductCostPrice(product) {
  const costPrice = Number(product?.costPrice ?? 0);

  return Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0;
}

function getProductQuantity(product) {
  const quantity = Number(product?.quantity ?? 0);

  return Number.isInteger(quantity) && quantity >= 0 ? quantity : 0;
}

function getReasonLabel(reason) {
  return (
    STOCK_OUT_REASON_LABELS[reason] ||
    String(reason ?? "")
      .replaceAll("_", " ")
      .toLowerCase()
  );
}

function StockOut({ currentUserRole }) {
  const [searchParams] = useSearchParams();

  const requestedProductId = String(searchParams.get("productId") ?? "").trim();

  const canCreateStockOut = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  const isReadOnly = currentUserRole === USER_ROLES.AUDITOR;

  const feedbackRef = useRef(null);

  const [products, setProducts] = useState([]);

  const [form, setForm] = useState(() =>
    createEmptyStockOutForm(requestedProductId),
  );

  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [isPosting, setIsPosting] = useState(false);

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const [selectedResult, setSelectedResult] = useState(null);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToActiveProducts(
      (activeProducts) => {
        setProducts(activeProducts);

        setIsLoading(false);

        setMessage((currentMessage) =>
          currentMessage.type === "error"
            ? {
                type: "",
                text: "",
              }
            : currentMessage,
        );
      },

      (error) => {
        console.error("Unable to load active Products for Stock Out:", error);

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
    if (!isConfirmationOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isConfirmationOpen]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) || null,
    [products, form.productId],
  );

  useEffect(() => {
    if (isLoading || !form.productId || selectedProduct) {
      return;
    }

    setForm(createEmptyStockOutForm());

    setMessage({
      type: "error",
      text: "The selected Product is no longer active or available.",
    });
  }, [form.productId, selectedProduct, isLoading]);

  const productsWithStock = useMemo(
    () => products.filter((product) => getProductQuantity(product) > 0),
    [products],
  );

  const outOfStockCount = products.length - productsWithStock.length;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return productsWithStock.filter((product) => {
      const searchableText = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.categoryCode,
        product.unitName,
        product.unitAbbreviation,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(normalizedSearch);
    });
  }, [productsWithStock, searchTerm]);

  const availableQuantity = getProductQuantity(selectedProduct);

  const numericQuantity = Number(form.quantityReleased);

  const hasValidQuantity =
    form.quantityReleased !== "" && isValidStockOutQuantity(numericQuantity);

  const expectedNewQuantity =
    selectedProduct && hasValidQuantity
      ? calculateStockOutBalance(availableQuantity, numericQuantity)
      : null;

  const unitCost = getProductCostPrice(selectedProduct);

  const totalCost = hasValidQuantity
    ? calculateStockOutTotalCost(numericQuantity, unitCost)
    : 0;

  const destinationRequired = isStockOutDestinationRequired(form.reason);

  const isFormUnavailable = !canCreateStockOut || !selectedProduct || isPosting;

  function scrollToFeedback() {
    window.requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function clearErrorMessage() {
    if (message.type === "error") {
      setMessage({
        type: "",
        text: "",
      });
    }
  }

  function handleSelectProduct(productId) {
    if (!canCreateStockOut) {
      setMessage({
        type: "error",
        text: "Your role has read-only access to Stock Out.",
      });

      scrollToFeedback();

      return;
    }

    setForm(createEmptyStockOutForm(productId));

    setSelectedResult(null);

    setMessage({
      type: "",
      text: "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,

        [name]:
          name === "referenceNumber"
            ? normalizeStockOutReference(value)
            : value,
      };

      if (name === "reason" && !isStockOutDestinationRequired(value)) {
        nextForm.destination = "";
      }

      return nextForm;
    });

    clearErrorMessage();
  }

  function validateForm() {
    if (!canCreateStockOut) {
      return "Your role cannot create Stock-Out transactions.";
    }

    if (!selectedProduct) {
      return "Select a Product to release.";
    }

    if (availableQuantity <= 0) {
      return "The selected Product does not have available stock.";
    }

    if (!isValidStockOutQuantity(numericQuantity)) {
      return `Quantity released must be a positive whole number not greater than ${STOCK_OUT_LIMITS.MAX_QUANTITY}.`;
    }

    if (numericQuantity > availableQuantity) {
      return `Insufficient stock. Only ${availableQuantity} item(s) are available.`;
    }

    if (!isValidStockOutReason(form.reason)) {
      return "Select a valid Stock-Out reason.";
    }

    if (!isValidStockOutDestination(form.destination, form.reason)) {
      return destinationRequired
        ? `Destination is required and cannot exceed ${STOCK_OUT_LIMITS.DESTINATION_MAX_LENGTH} characters.`
        : `Destination cannot exceed ${STOCK_OUT_LIMITS.DESTINATION_MAX_LENGTH} characters.`;
    }

    if (!isValidStockOutReference(form.referenceNumber)) {
      return `Reference number cannot exceed ${STOCK_OUT_LIMITS.REFERENCE_MAX_LENGTH} characters.`;
    }

    if (!isValidStockOutDateNotFuture(form.dateReleased)) {
      return "Enter a valid release date that is not in the future.";
    }

    if (!isValidStockOutRemarks(form.remarks)) {
      return `Remarks cannot exceed ${STOCK_OUT_LIMITS.REMARKS_MAX_LENGTH} characters.`;
    }

    if (expectedNewQuantity === null) {
      return "The resulting Product stock could not be calculated.";
    }

    if (totalCost > STOCK_OUT_LIMITS.MAX_TOTAL_VALUE) {
      return "The Stock-Out value exceeds the allowed maximum.";
    }

    return "";
  }

  function handleReviewStockOut(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });

      scrollToFeedback();

      return;
    }

    setMessage({
      type: "",
      text: "",
    });

    setIsConfirmationOpen(true);
  }

  function handleCloseConfirmation() {
    if (isPosting) {
      return;
    }

    setIsConfirmationOpen(false);
  }

  async function handleConfirmStockOut() {
    const validationError = validateForm();

    if (validationError) {
      setIsConfirmationOpen(false);

      setMessage({
        type: "error",
        text: validationError,
      });

      scrollToFeedback();

      return;
    }

    try {
      setIsPosting(true);

      setMessage({
        type: "",
        text: "",
      });

      const result = await createStockOutReceipt(form);

      setSelectedResult(result);

      setIsConfirmationOpen(false);

      setForm(createEmptyStockOutForm());

      setMessage({
        type: "success",
        text: result.isReplay
          ? `The Stock-Out operation was already completed earlier. ${result.productName} remains at ${result.newQuantity} item(s).`
          : `${result.quantityReleased} item(s) of ${result.productName} were released successfully. The new stock balance is ${result.newQuantity}.`,
      });

      scrollToFeedback();
    } catch (error) {
      console.error("Unable to post Stock Out:", error);

      setIsConfirmationOpen(false);

      setMessage({
        type: "error",
        text: error?.message || "Unable to post the Stock-Out transaction.",
      });

      scrollToFeedback();
    } finally {
      setIsPosting(false);
    }
  }

  function handleClearForm() {
    if (isPosting) {
      return;
    }

    const hasEnteredData =
      form.productId ||
      form.quantityReleased ||
      form.destination ||
      form.referenceNumber ||
      form.remarks;

    if (hasEnteredData) {
      const shouldClear = window.confirm("Clear the current Stock-Out form?");

      if (!shouldClear) {
        return;
      }
    }

    setForm(createEmptyStockOutForm());

    setSelectedResult(null);

    setMessage({
      type: "",
      text: "",
    });
  }

  return (
    <main className="page stock-out-page">
      <header className="stock-out-page-header">
        <div>
          <p className="section-label">Inventory release</p>

          <h2>Stock Out</h2>

          <p>
            Release available Product stock, review the resulting balance, and
            create a permanent OUT movement.
          </p>
        </div>
      </header>

      {isReadOnly && (
        <div className="stock-out-readonly-notice">
          <strong>Read-only Stock-Out access</strong>

          <span>
            Your Auditor role may review available Products, but it cannot
            release stock.
          </span>
        </div>
      )}

      <div ref={feedbackRef}>
        {message.text && (
          <div
            className={`stock-out-message stock-out-message-${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </div>
        )}
      </div>

      {selectedResult && (
        <section className="stock-out-success-card">
          <div className="stock-out-success-heading">
            <div>
              <p className="section-label">Release completed</p>

              <h3>Stock-Out Posted Successfully</h3>
            </div>

            <span>OUT</span>
          </div>

          <div className="stock-out-success-grid">
            <div>
              <span>Product</span>

              <strong>{selectedResult.productName}</strong>

              <small>{selectedResult.productSku}</small>
            </div>

            <div>
              <span>Quantity released</span>

              <strong>{selectedResult.quantityReleased}</strong>
            </div>

            <div>
              <span>Previous stock</span>

              <strong>{selectedResult.previousQuantity}</strong>
            </div>

            <div>
              <span>New stock</span>

              <strong>{selectedResult.newQuantity}</strong>
            </div>

            <div>
              <span>Reason</span>

              <strong>{getReasonLabel(selectedResult.reason)}</strong>
            </div>

            <div>
              <span>Reference</span>

              <strong>
                {selectedResult.referenceNumber || "Not provided"}
              </strong>
            </div>

            <div>
              <span>Cost value</span>

              <strong>{formatCurrency(selectedResult.totalCost)}</strong>
            </div>

            <div>
              <span>Released by</span>

              <strong>{selectedResult.releasedByName}</strong>
            </div>
          </div>

          <div className="stock-out-success-actions">
            <button
              type="button"
              onClick={() => {
                setSelectedResult(null);

                setMessage({
                  type: "",
                  text: "",
                });
              }}
            >
              Release Another Product
            </button>
          </div>
        </section>
      )}

      <section className="stock-out-summary-grid">
        <article>
          <span>Active Products</span>

          <strong>{products.length}</strong>
        </article>

        <article>
          <span>Available for release</span>

          <strong>{productsWithStock.length}</strong>
        </article>

        <article>
          <span>Out of stock hidden</span>

          <strong>{outOfStockCount}</strong>
        </article>

        <article>
          <span>Selected Product</span>

          <strong>{selectedProduct?.sku || "None"}</strong>
        </article>
      </section>

      {canCreateStockOut && selectedProduct && (
        <section className="stock-out-form-card">
          <div className="stock-out-card-heading">
            <div>
              <p className="section-label">Release form</p>

              <h3>{selectedProduct.name}</h3>
            </div>

            <span className="stock-out-selected-badge">
              {selectedProduct.sku}
            </span>
          </div>

          <div className="stock-out-product-preview">
            <div>
              <span>Category</span>

              <strong>{selectedProduct.category || "Not assigned"}</strong>
            </div>

            <div>
              <span>Unit</span>

              <strong>{getProductUnitLabel(selectedProduct)}</strong>
            </div>

            <div>
              <span>Barcode</span>

              <strong>{selectedProduct.barcode || "Not assigned"}</strong>
            </div>

            <div>
              <span>Available stock</span>

              <strong>{availableQuantity}</strong>
            </div>
          </div>

          <form className="stock-out-form" onSubmit={handleReviewStockOut}>
            <div className="stock-out-form-grid">
              <label>
                Quantity to release *
                <input
                  type="number"
                  name="quantityReleased"
                  value={form.quantityReleased}
                  onChange={handleFormChange}
                  min="1"
                  max={availableQuantity}
                  step="1"
                  placeholder="Enter quantity"
                  disabled={isFormUnavailable}
                  required
                />
              </label>

              <label>
                Stock-Out reason *
                <select
                  name="reason"
                  value={form.reason}
                  onChange={handleFormChange}
                  disabled={isFormUnavailable}
                  required
                >
                  {STOCK_OUT_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Destination
                {destinationRequired ? " *" : ""}
                <input
                  type="text"
                  name="destination"
                  value={form.destination}
                  onChange={handleFormChange}
                  maxLength={STOCK_OUT_LIMITS.DESTINATION_MAX_LENGTH}
                  placeholder={
                    destinationRequired
                      ? "Required department, branch, or recipient"
                      : "Optional destination"
                  }
                  disabled={isFormUnavailable}
                  required={destinationRequired}
                />
              </label>

              <label>
                Reference number
                <input
                  type="text"
                  name="referenceNumber"
                  value={form.referenceNumber}
                  onChange={handleFormChange}
                  maxLength={STOCK_OUT_LIMITS.REFERENCE_MAX_LENGTH}
                  placeholder="Optional request, transfer, or issue reference"
                  disabled={isFormUnavailable}
                />
              </label>

              <label>
                Date released *
                <input
                  type="date"
                  name="dateReleased"
                  value={form.dateReleased}
                  onChange={handleFormChange}
                  max={getTodayStockOutDate()}
                  disabled={isFormUnavailable}
                  required
                />
              </label>
            </div>

            <label className="stock-out-remarks-field">
              Remarks
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleFormChange}
                maxLength={STOCK_OUT_LIMITS.REMARKS_MAX_LENGTH}
                rows="4"
                placeholder="Optional notes about the release"
                disabled={isFormUnavailable}
              />
              <small>
                {form.remarks.length}/{STOCK_OUT_LIMITS.REMARKS_MAX_LENGTH}
              </small>
            </label>

            <div className="stock-out-balance-grid">
              <article>
                <span>Current stock</span>

                <strong>{availableQuantity}</strong>
              </article>

              <article>
                <span>Quantity released</span>

                <strong>{hasValidQuantity ? numericQuantity : 0}</strong>
              </article>

              <article>
                <span>Expected stock</span>

                <strong>
                  {expectedNewQuantity === null
                    ? availableQuantity
                    : expectedNewQuantity}
                </strong>
              </article>
            </div>

            <div className="stock-out-value-summary">
              <div>
                <span>Cost per unit</span>

                <strong>{formatCurrency(unitCost)}</strong>
              </div>

              <div>
                <span>Total cost value</span>

                <strong>{formatCurrency(totalCost)}</strong>
              </div>

              <div>
                <span>Reason</span>

                <strong>{getReasonLabel(form.reason)}</strong>
              </div>
            </div>

            <div className="stock-out-form-actions">
              <button
                type="submit"
                className="stock-out-review-button"
                disabled={isFormUnavailable || !hasValidQuantity}
              >
                Review & Post Stock Out
              </button>

              <button
                type="button"
                className="stock-out-clear-button"
                onClick={handleClearForm}
                disabled={isPosting}
              >
                Clear Form
              </button>
            </div>

            <div className="stock-out-phase-notice">
              <strong>Atomic Stock-Out workflow</strong>

              <span>
                After confirmation, Product stock, the immutable OUT movement,
                and the idempotency operation record are created together.
                Firestore Rules support is finalised in Phase 5F.
              </span>
            </div>
          </form>
        </section>
      )}

      <section className="stock-out-product-list-card">
        <div className="stock-out-list-heading">
          <div>
            <p className="section-label">Available inventory</p>

            <h3>Products Available for Stock Out</h3>
          </div>

          <span>
            {filteredProducts.length} of {productsWithStock.length}
          </span>
        </div>

        <div className="stock-out-list-filter">
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
          <div className="stock-out-empty-state">
            <strong>Loading available Products...</strong>

            <p>Fetching active Product balances from Firebase.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="stock-out-empty-state">
            <strong>No Products are available for release</strong>

            <p>Active Products must have a stock quantity greater than zero.</p>
          </div>
        ) : (
          <div className="stock-out-product-table-wrapper">
            <table className="stock-out-product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Barcode</th>
                  <th>Cost Price</th>
                  <th>Available Stock</th>

                  {canCreateStockOut && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const isSelected = product.id === form.productId;

                  return (
                    <tr
                      key={product.id}
                      className={isSelected ? "stock-out-selected-row" : ""}
                    >
                      <td>
                        <div className="stock-out-product-cell">
                          <strong>{product.name}</strong>

                          <span>{product.sku}</span>
                        </div>
                      </td>

                      <td>{product.category || "Not assigned"}</td>

                      <td>{getProductUnitLabel(product)}</td>

                      <td>{product.barcode || "Not assigned"}</td>

                      <td>{formatCurrency(getProductCostPrice(product))}</td>

                      <td>
                        <strong>{getProductQuantity(product)}</strong>
                      </td>

                      {canCreateStockOut && (
                        <td>
                          <button
                            type="button"
                            className="stock-out-select-button"
                            onClick={() => handleSelectProduct(product.id)}
                            disabled={isPosting}
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

      <StockOutHistory />

      {isConfirmationOpen && selectedProduct && (
        <div
          className="stock-out-confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseConfirmation();
            }
          }}
        >
          <section
            className="stock-out-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-out-confirmation-title"
          >
            <div className="stock-out-confirmation-heading">
              <div>
                <p className="section-label">Final confirmation</p>

                <h3 id="stock-out-confirmation-title">Post Stock Out?</h3>
              </div>

              <button
                type="button"
                aria-label="Close confirmation"
                onClick={handleCloseConfirmation}
                disabled={isPosting}
              >
                ×
              </button>
            </div>

            <div className="stock-out-confirmation-warning">
              <strong>This action reduces inventory stock.</strong>

              <span>
                The Product balance, permanent OUT movement, and Stock-Out
                operation will be committed together.
              </span>
            </div>

            <div className="stock-out-confirmation-product">
              <div>
                <span>Product</span>

                <strong>{selectedProduct.name}</strong>

                <small>{selectedProduct.sku}</small>
              </div>

              <div>
                <span>Category</span>

                <strong>{selectedProduct.category || "Not assigned"}</strong>
              </div>

              <div>
                <span>Unit</span>

                <strong>{getProductUnitLabel(selectedProduct)}</strong>
              </div>
            </div>

            <div className="stock-out-confirmation-summary">
              <div>
                <span>Current stock</span>

                <strong>{availableQuantity}</strong>
              </div>

              <div>
                <span>Quantity released</span>

                <strong>{numericQuantity}</strong>
              </div>

              <div>
                <span>New stock</span>

                <strong>{expectedNewQuantity}</strong>
              </div>

              <div>
                <span>Reason</span>

                <strong>{getReasonLabel(form.reason)}</strong>
              </div>

              <div>
                <span>Destination</span>

                <strong>{form.destination || "Not provided"}</strong>
              </div>

              <div>
                <span>Reference</span>

                <strong>{form.referenceNumber || "Not provided"}</strong>
              </div>

              <div>
                <span>Date released</span>

                <strong>{form.dateReleased}</strong>
              </div>

              <div>
                <span>Cost per unit</span>

                <strong>{formatCurrency(unitCost)}</strong>
              </div>

              <div>
                <span>Total cost value</span>

                <strong>{formatCurrency(totalCost)}</strong>
              </div>
            </div>

            {form.remarks && (
              <div className="stock-out-confirmation-remarks">
                <span>Remarks</span>

                <p>{form.remarks}</p>
              </div>
            )}

            <div className="stock-out-confirmation-actions">
              <button
                type="button"
                className="stock-out-confirmation-cancel"
                onClick={handleCloseConfirmation}
                disabled={isPosting}
              >
                Go Back
              </button>

              <button
                type="button"
                className="stock-out-confirmation-post"
                onClick={handleConfirmStockOut}
                disabled={isPosting}
              >
                {isPosting ? "Posting Stock Out..." : "Post Stock Out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default StockOut;
