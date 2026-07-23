import { useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "react-router-dom";
import "../styles/StockIn.css";

import { PRODUCT_STATUSES } from "../constants/products";

import { USER_ROLES } from "../constants/roles";

import {
  MANUAL_STOCK_IN_REASON_OPTIONS,
  STOCK_IN_LIMITS,
  calculateStockInTotal,
  createEmptyStockInForm,
  getTodayInputDate,
  isValidStockInDate,
  isValidStockInQuantity,
  isValidStockInReason,
  isValidStockInReference,
  isValidStockInRemarks,
  isValidStockInSource,
  isValidStockInUnitCost,
} from "../constants/stockIn";

import { subscribeToProducts } from "../services/productService";

import { createStockInReceipt } from "../services/stockInService";

import StockInHistory from "../components/StockInHistory";

function getProductSellingPrice(product) {
  return Number(product?.sellingPrice ?? product?.price ?? 0);
}

function getProductCostInput(product) {
  const costPrice = product?.costPrice;

  if (costPrice === null || costPrice === undefined || costPrice === "") {
    return "";
  }

  const numericCostPrice = Number(costPrice);

  if (!Number.isFinite(numericCostPrice) || numericCostPrice < 0) {
    return "";
  }

  return String(numericCostPrice);
}

function getProductUnitLabel(product) {
  const unitName = String(product?.unitName ?? "").trim();

  const abbreviation = String(product?.unitAbbreviation ?? "").trim();

  if (unitName && abbreviation) {
    return `${unitName} (${abbreviation})`;
  }

  return unitName || abbreviation || "Unit not assigned";
}

function getReasonLabel(reason) {
  return (
    MANUAL_STOCK_IN_REASON_OPTIONS.find((option) => option.value === reason)
      ?.label ?? reason
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function StockIn({ currentUserRole }) {
  const canReceiveStock = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  const isHistoryOnly = currentUserRole === USER_ROLES.AUDITOR;
  const [products, setProducts] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();

  const processedProductIdRef = useRef("");

  const [form, setForm] = useState(() => createEmptyStockInForm());

  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [productSearchTerm, setProductSearchTerm] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [receiptResult, setReceiptResult] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (firebaseProducts) => {
        setProducts(firebaseProducts);

        setLoadError("");
        setIsLoadingProducts(false);
      },

      (error) => {
        console.error("Unable to load products:", error);

        setLoadError(
          error?.message || "Unable to load products from Firebase.",
        );

        setIsLoadingProducts(false);
      },
    );

    return unsubscribe;
  }, []);

  const activeProducts = useMemo(() => {
    return products.filter(
      (product) =>
        (product.status ?? PRODUCT_STATUSES.ACTIVE) === PRODUCT_STATUSES.ACTIVE,
    );
  }, [products]);

  const inactiveProductCount = useMemo(() => {
    return products.filter(
      (product) => product.status === PRODUCT_STATUSES.INACTIVE,
    ).length;
  }, [products]);

  const searchedProducts = useMemo(() => {
    const normalizedSearch = productSearchTerm.trim().toLowerCase();

    const matchingProducts = activeProducts.filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.categoryCode,
        product.unitName,
        product.unitAbbreviation,
        product.sourceProductId,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(normalizedSearch);
    });

    return matchingProducts.sort((firstProduct, secondProduct) => {
      const categoryComparison = String(
        firstProduct.category ?? "",
      ).localeCompare(String(secondProduct.category ?? ""));

      if (categoryComparison !== 0) {
        return categoryComparison;
      }

      return String(firstProduct.name ?? "").localeCompare(
        String(secondProduct.name ?? ""),
      );
    });
  }, [activeProducts, productSearchTerm]);

  const groupedProductOptions = useMemo(() => {
    const groups = new Map();

    for (const product of searchedProducts) {
      const category =
        String(product.category ?? "Uncategorized").trim() || "Uncategorized";

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push(product);
    }

    return [...groups.entries()].map(([category, categoryProducts]) => ({
      category,
      products: categoryProducts,
    }));
  }, [searchedProducts]);

  const activeCategoryCount = useMemo(() => {
    return new Set(
      activeProducts
        .map((product) => String(product.category ?? "").trim())
        .filter(Boolean),
    ).size;
  }, [activeProducts]);

  const selectedProduct = useMemo(() => {
    return (
      activeProducts.find((product) => product.id === form.productId) ?? null
    );
  }, [activeProducts, form.productId]);

  const requestedProductId = String(searchParams.get("productId") ?? "").trim();

  useEffect(() => {
    if (isLoadingProducts || !requestedProductId) {
      return;
    }

    if (processedProductIdRef.current === requestedProductId) {
      return;
    }

    processedProductIdRef.current = requestedProductId;

    const requestedProduct = products.find(
      (product) => product.id === requestedProductId,
    );

    if (!requestedProduct) {
      setMessage({
        type: "error",
        text: "The product requested in the URL could not be found.",
      });

      return;
    }

    const requestedStatus = requestedProduct.status ?? PRODUCT_STATUSES.ACTIVE;

    if (requestedStatus !== PRODUCT_STATUSES.ACTIVE) {
      setMessage({
        type: "error",
        text: `${requestedProduct.name} is inactive and cannot receive stock.`,
      });

      return;
    }

    // const existingCostPrice = Number(requestedProduct.costPrice);

    setForm((currentForm) => ({
      ...currentForm,

      productId: requestedProduct.id,

      unitCost: getProductCostInput(requestedProduct),
    }));

    setProductSearchTerm("");

    setMessage({
      type: "success",
      text: `${requestedProduct.name} was selected automatically.`,
    });
  }, [isLoadingProducts, products, requestedProductId]);

  useEffect(() => {
    if (!form.productId || isLoadingProducts) {
      return;
    }

    const productStillActive = activeProducts.some(
      (product) => product.id === form.productId,
    );

    if (productStillActive) {
      return;
    }

    setForm(createEmptyStockInForm());

    setMessage({
      type: "error",
      text: "The selected product is no longer active or available.",
    });
  }, [activeProducts, form.productId, isLoadingProducts]);

  const numericQuantity = Number(form.quantityReceived);

  const numericUnitCost = Number(form.unitCost);

  const hasValidQuantity = isValidStockInQuantity(numericQuantity);

  const hasValidUnitCost =
    form.unitCost !== "" && isValidStockInUnitCost(numericUnitCost);

  const currentQuantity = Number(selectedProduct?.quantity ?? 0);

  const expectedNewQuantity =
    selectedProduct && hasValidQuantity
      ? currentQuantity + numericQuantity
      : currentQuantity;

  const totalCost =
    hasValidQuantity && hasValidUnitCost
      ? calculateStockInTotal(numericQuantity, numericUnitCost)
      : 0;

  const isFormUnavailable =
    !canReceiveStock || isSubmitting || isLoadingProducts || Boolean(loadError);

  function clearErrorMessage() {
    if (message.type === "error") {
      setMessage({
        type: "",
        text: "",
      });
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setReceiptResult(null);
    clearErrorMessage();
  }

  function updateProductIdInUrl(productId) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (productId) {
      nextSearchParams.set("productId", productId);
    } else {
      nextSearchParams.delete("productId");
    }

    setSearchParams(nextSearchParams, {
      replace: true,
    });
  }

  function handleProductChange(event) {
    const productId = event.target.value;

    const product = activeProducts.find((item) => item.id === productId);

    setForm((currentForm) => ({
      ...currentForm,

      productId,

      unitCost: getProductCostInput(product),
    }));

    setProductSearchTerm("");

    updateProductIdInUrl(productId);

    processedProductIdRef.current = productId;

    setReceiptResult(null);
    clearErrorMessage();
  }

  function validateForm() {
    if (!form.productId) {
      return "Select a product.";
    }

    if (!selectedProduct) {
      return "The selected product is no longer available or active.";
    }

    if (!isValidStockInQuantity(numericQuantity)) {
      return `Quantity received must be a positive whole number not greater than ${STOCK_IN_LIMITS.MAX_QUANTITY}.`;
    }

    if (form.unitCost === "" || !isValidStockInUnitCost(numericUnitCost)) {
      return "Unit cost must be a valid non-negative amount.";
    }

    const unroundedTotal = numericQuantity * numericUnitCost;

    if (
      !Number.isFinite(unroundedTotal) ||
      unroundedTotal > STOCK_IN_LIMITS.MAX_TOTAL_VALUE
    ) {
      return "The total receipt value exceeds the allowed maximum.";
    }

    if (!isValidStockInSource(form.source)) {
      return `Source or supplier is required and cannot exceed ${STOCK_IN_LIMITS.SOURCE_MAX_LENGTH} characters.`;
    }

    if (!isValidStockInReference(form.referenceNumber)) {
      return `Reference number cannot exceed ${STOCK_IN_LIMITS.REFERENCE_MAX_LENGTH} characters.`;
    }

    if (!isValidStockInDate(form.dateReceived)) {
      return "Enter a valid received date.";
    }

    if (form.dateReceived > getTodayInputDate()) {
      return "The received date cannot be in the future.";
    }

    if (
      !isValidStockInReason(form.reason) ||
      !MANUAL_STOCK_IN_REASON_OPTIONS.some(
        (option) => option.value === form.reason,
      )
    ) {
      return "Select a valid Stock-In reason.";
    }

    if (!isValidStockInRemarks(form.remarks)) {
      return `Remarks cannot exceed ${STOCK_IN_LIMITS.REMARKS_MAX_LENGTH} characters.`;
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canReceiveStock) {
      setMessage({
        type: "error",
        text: "Your role can review Stock-In history but cannot create stock receipts.",
      });

      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });

      return;
    }

    const shouldContinue = window.confirm(
      [
        "Confirm this Stock-In receipt?",
        "",
        `Product: ${selectedProduct.name}`,
        `Quantity received: ${numericQuantity}`,
        `Unit cost: ${formatCurrency(numericUnitCost)}`,
        `Total value: ${formatCurrency(totalCost)}`,
        `Current stock: ${currentQuantity}`,
        `Expected new stock: ${expectedNewQuantity}`,
        "",
        "This will create a permanent stock movement.",
      ].join("\n"),
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setIsSubmitting(true);
      setReceiptResult(null);

      setMessage({
        type: "",
        text: "",
      });

      const result = await createStockInReceipt({
        operationId: form.operationId,

        productId: form.productId,

        quantityReceived: form.quantityReceived,

        unitCost: form.unitCost,

        source: form.source,

        referenceNumber: form.referenceNumber,

        dateReceived: form.dateReceived,

        reason: form.reason,

        remarks: form.remarks,
      });

      setReceiptResult(result);

      setMessage({
        type: "success",
        text: `Stock receipt saved successfully. ${result.productName} now has ${result.newQuantity} item(s) in stock.`,
      });

      setForm(createEmptyStockInForm());

      setProductSearchTerm("");

      updateProductIdInUrl("");

      processedProductIdRef.current = "";
    } catch (error) {
      console.error("Unable to save Stock-In receipt:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to save the Stock-In receipt.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClearForm() {
    const hasEnteredData =
      form.productId ||
      form.quantityReceived ||
      form.unitCost ||
      form.source ||
      form.referenceNumber ||
      form.remarks;

    if (hasEnteredData) {
      const shouldClear = window.confirm("Clear the current Stock-In form?");

      if (!shouldClear) {
        return;
      }
    }

    setForm(createEmptyStockInForm());

    setProductSearchTerm("");

    updateProductIdInUrl("");

    processedProductIdRef.current = "";

    setReceiptResult(null);

    setMessage({
      type: "",
      text: "",
    });
  }

  return (
    <main className="page stock-in-page">
      <header className="stock-in-page-header">
        <div>
          <p className="section-label">Inventory receiving</p>

          <h2>Stock In</h2>

          <p className="stock-in-page-description">
            Record received inventory, update the current product balance, and
            create a permanent Stock-In movement.
          </p>
        </div>
      </header>

      {isHistoryOnly && (
        <div className="stock-in-history-only-notice">
          <strong>Stock-In history access</strong>

          <span>
            Your Auditor role can review permanent Stock-In receipts and apply
            history filters, but it cannot create or modify inventory receipts.
          </span>
        </div>
      )}

      {message.text && (
        <div
          className={`stock-in-message stock-in-message-${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      {loadError && (
        <div className="stock-in-message stock-in-message-error" role="alert">
          {loadError}
        </div>
      )}

      {canReceiveStock && receiptResult && (
        <section className="stock-in-success-card">
          <div>
            <p className="section-label">Receipt completed</p>

            <h3>Stock balance updated</h3>
          </div>

          <div className="stock-in-success-grid">
            <article>
              <span>Product</span>

              <strong>{receiptResult.productName}</strong>
            </article>

            <article>
              <span>Quantity received</span>

              <strong>{receiptResult.quantityReceived}</strong>
            </article>

            <article>
              <span>Previous stock</span>

              <strong>{receiptResult.previousQuantity}</strong>
            </article>

            <article>
              <span>New stock</span>

              <strong>{receiptResult.newQuantity}</strong>
            </article>

            <article>
              <span>Total value</span>

              <strong>{formatCurrency(receiptResult.totalCost)}</strong>
            </article>

            <article>
              <span>Reference</span>

              <strong>{receiptResult.referenceNumber || "No reference"}</strong>
            </article>
          </div>
        </section>
      )}

      {canReceiveStock && (
        <div className="stock-in-layout">
          <section className="stock-in-form-card">
            <div className="stock-in-card-heading">
              <div>
                <p className="section-label">New receipt</p>

                <h3>Stock-In Information</h3>
              </div>

              <span className="stock-in-required-note">* Required fields</span>
            </div>

            <div className="stock-in-availability-grid">
              <article>
                <span>Active products</span>

                <strong>{activeProducts.length}</strong>
              </article>

              <article>
                <span>Search results</span>

                <strong>{searchedProducts.length}</strong>
              </article>

              <article>
                <span>Active categories</span>

                <strong>{activeCategoryCount}</strong>
              </article>

              <article>
                <span>Inactive hidden</span>

                <strong>{inactiveProductCount}</strong>
              </article>
            </div>

            <form className="stock-in-form" onSubmit={handleSubmit}>
              <div className="stock-in-product-picker">
                <label className="stock-in-full-field">
                  Search product
                  <div className="stock-in-product-search-row">
                    <input
                      type="search"
                      value={productSearchTerm}
                      onChange={(event) =>
                        setProductSearchTerm(event.target.value)
                      }
                      placeholder="Search name, SKU, barcode, category, or source ID"
                      disabled={isFormUnavailable}
                    />

                    <button
                      type="button"
                      className="stock-in-product-search-clear"
                      onClick={() => setProductSearchTerm("")}
                      disabled={isFormUnavailable || !productSearchTerm}
                    >
                      Clear
                    </button>
                  </div>
                  <small>
                    Search by product name, SKU, barcode, category, unit, or
                    source product ID.
                  </small>
                </label>

                <label className="stock-in-full-field">
                  Product *
                  <select
                    name="productId"
                    value={form.productId}
                    onChange={handleProductChange}
                    disabled={isFormUnavailable}
                    required
                  >
                    <option value="">
                      {isLoadingProducts
                        ? "Loading products..."
                        : activeProducts.length === 0
                          ? "No active products available"
                          : searchedProducts.length === 0
                            ? "No matching active products"
                            : `Select from ${searchedProducts.length} product(s)`}
                    </option>

                    {groupedProductOptions.map((productGroup) => (
                      <optgroup
                        key={productGroup.category}
                        label={`${productGroup.category} — ${productGroup.products.length}`}
                      >
                        {productGroup.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} — {product.sku} —{" "}
                            {product.unitAbbreviation ||
                              product.unitName ||
                              "No unit"}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <small>
                    Only active products can receive stock. Inactive products
                    are automatically hidden.
                  </small>
                </label>
              </div>

              <div className="stock-in-form-grid">
                <label>
                  Quantity received *
                  <input
                    type="number"
                    name="quantityReceived"
                    value={form.quantityReceived}
                    onChange={handleChange}
                    min="1"
                    max={STOCK_IN_LIMITS.MAX_QUANTITY}
                    step="1"
                    placeholder="0"
                    disabled={isFormUnavailable}
                    required
                  />
                </label>

                <label>
                  Unit cost *
                  <input
                    type="number"
                    name="unitCost"
                    value={form.unitCost}
                    onChange={handleChange}
                    min="0"
                    max={STOCK_IN_LIMITS.MAX_UNIT_COST}
                    step="0.01"
                    placeholder="0.00"
                    disabled={isFormUnavailable}
                    required
                  />
                </label>
              </div>

              <div className="stock-in-form-grid">
                <label>
                  Source or supplier *
                  <input
                    type="text"
                    name="source"
                    value={form.source}
                    onChange={handleChange}
                    maxLength={STOCK_IN_LIMITS.SOURCE_MAX_LENGTH}
                    placeholder="Enter supplier or stock source"
                    disabled={isFormUnavailable}
                    required
                  />
                </label>

                <label>
                  Reference number
                  <input
                    type="text"
                    name="referenceNumber"
                    value={form.referenceNumber}
                    onChange={handleChange}
                    maxLength={STOCK_IN_LIMITS.REFERENCE_MAX_LENGTH}
                    placeholder="DR, invoice, or receipt number"
                    disabled={isFormUnavailable}
                  />
                </label>
              </div>

              <div className="stock-in-form-grid">
                <label>
                  Date received *
                  <input
                    type="date"
                    name="dateReceived"
                    value={form.dateReceived}
                    onChange={handleChange}
                    max={getTodayInputDate()}
                    disabled={isFormUnavailable}
                    required
                  />
                </label>

                <label>
                  Stock-In reason *
                  <select
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    disabled={isFormUnavailable}
                    required
                  >
                    {MANUAL_STOCK_IN_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="stock-in-full-field">
                Remarks
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  maxLength={STOCK_IN_LIMITS.REMARKS_MAX_LENGTH}
                  rows="4"
                  placeholder="Optional receiving notes"
                  disabled={isFormUnavailable}
                />
                <small>
                  {form.remarks.length}/{STOCK_IN_LIMITS.REMARKS_MAX_LENGTH}
                </small>
              </label>

              <div className="stock-in-form-actions">
                <button
                  type="submit"
                  className="stock-in-submit-button"
                  disabled={isFormUnavailable || !selectedProduct}
                >
                  {isSubmitting ? "Saving Receipt..." : "Save Stock-In Receipt"}
                </button>

                <button
                  type="button"
                  className="stock-in-clear-button"
                  onClick={handleClearForm}
                  disabled={isSubmitting}
                >
                  Clear Form
                </button>
              </div>
            </form>
          </section>

          <aside className="stock-in-summary-card">
            <div className="stock-in-card-heading">
              <div>
                <p className="section-label">Receipt preview</p>

                <h3>Stock Summary</h3>
              </div>
            </div>

            {!selectedProduct ? (
              <div className="stock-in-empty-product">
                <strong>No product selected</strong>

                <p>
                  Select an active product to view its current stock, pricing,
                  and expected new balance.
                </p>
              </div>
            ) : (
              <>
                <div className="stock-in-product-preview">
                  <span>Selected product</span>

                  <strong>{selectedProduct.name}</strong>

                  <small>
                    {selectedProduct.sku} · {selectedProduct.category}
                  </small>
                </div>

                <dl className="stock-in-product-details">
                  <div>
                    <dt>Barcode</dt>

                    <dd>{selectedProduct.barcode || "Not available"}</dd>
                  </div>

                  <div>
                    <dt>Unit</dt>

                    <dd>{getProductUnitLabel(selectedProduct)}</dd>
                  </div>

                  <div>
                    <dt>Current cost price</dt>

                    <dd>
                      {selectedProduct.costPrice === null ||
                      selectedProduct.costPrice === undefined
                        ? "Not set"
                        : formatCurrency(selectedProduct.costPrice)}
                    </dd>
                  </div>

                  <div>
                    <dt>Selling price</dt>

                    <dd>
                      {formatCurrency(getProductSellingPrice(selectedProduct))}
                    </dd>
                  </div>
                </dl>

                <div className="stock-in-balance-grid">
                  <article>
                    <span>Current stock</span>

                    <strong>{currentQuantity}</strong>
                  </article>

                  <article>
                    <span>Quantity received</span>

                    <strong>{hasValidQuantity ? numericQuantity : 0}</strong>
                  </article>

                  <article>
                    <span>Expected stock</span>

                    <strong>{expectedNewQuantity}</strong>
                  </article>
                </div>

                <div className="stock-in-value-summary">
                  <div>
                    <span>Unit cost</span>

                    <strong>
                      {hasValidUnitCost
                        ? formatCurrency(numericUnitCost)
                        : formatCurrency(0)}
                    </strong>
                  </div>

                  <div>
                    <span>Total receipt value</span>

                    <strong>{formatCurrency(totalCost)}</strong>
                  </div>

                  <div>
                    <span>Reason</span>

                    <strong>{getReasonLabel(form.reason)}</strong>
                  </div>
                </div>

                <div className="stock-in-permanent-notice">
                  <strong>Permanent movement record</strong>

                  <span>
                    Saving this form updates the product balance and creates a
                    permanent Stock-In history document in one Firestore
                    transaction.
                  </span>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <StockInHistory />
    </main>
  );
}

export default StockIn;
