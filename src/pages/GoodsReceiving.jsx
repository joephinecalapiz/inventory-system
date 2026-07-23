import { useEffect, useMemo, useRef, useState } from "react";

import "../styles/GoodsReceiving.css";

import { USER_ROLES } from "../constants/roles";

import { PURCHASE_ORDER_STATUS_LABELS } from "../constants/purchaseOrders";

import {
  GOODS_RECEIPT_LIMITS,
  calculateGoodsReceiptLineTotal,
  calculateGoodsReceiptTotals,
  createEmptyGoodsReceiptForm,
  getTodayGoodsReceiptDate,
  isPurchaseOrderEligibleForReceiving,
  isValidGoodsReceiptDateNotFuture,
  isValidGoodsReceiptQuantity,
  isValidGoodsReceiptReference,
  isValidGoodsReceiptRemarks,
  isValidGoodsReceiptUnitCost,
  normalizeGoodsReceiptReference,
  validateGoodsReceiptItemQuantities,
} from "../constants/goodsReceiving";

import {
  getReceivablePurchaseOrderDetails,
  postGoodsReceipt,
  subscribeToReceivablePurchaseOrders,
} from "../services/goodsReceivingService";

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
  return `goods-receiving-status-${String(status ?? "")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function getItemRemainingAfterReceiving(item) {
  const remainingBeforeReceiving = Number(item.remainingBeforeReceiving ?? 0);

  const quantityReceived = Number(item.quantityReceived || 0);

  if (
    !Number.isInteger(remainingBeforeReceiving) ||
    !Number.isInteger(quantityReceived)
  ) {
    return remainingBeforeReceiving;
  }

  return Math.max(remainingBeforeReceiving - quantityReceived, 0);
}

function GoodsReceiving({ currentUserRole }) {
  const canPrepareReceipts = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  const isReadOnly = currentUserRole === USER_ROLES.AUDITOR;

  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");

  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);

  const [form, setForm] = useState(() => createEmptyGoodsReceiptForm());

  const [searchTerm, setSearchTerm] = useState("");

  const [isLoadingPurchaseOrders, setIsLoadingPurchaseOrders] = useState(true);

  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [message, setMessage] = useState({
    type: "",

    text: "",
  });

  const feedbackRef = useRef(null);

  const [isPosting, setIsPosting] = useState(false);

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const [postedReceipt, setPostedReceipt] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToReceivablePurchaseOrders(
      (receivablePurchaseOrders) => {
        setPurchaseOrders(receivablePurchaseOrders);

        setLoadError("");

        setIsLoadingPurchaseOrders(false);
      },

      (error) => {
        console.error("Unable to load receivable Purchase Orders:", error);

        setLoadError(
          error?.message || "Unable to load approved Purchase Orders.",
        );

        setIsLoadingPurchaseOrders(false);
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

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      return;
    }

    const matchingPurchaseOrder = purchaseOrders.find(
      (purchaseOrder) => purchaseOrder.id === selectedPurchaseOrder.id,
    );

    if (
      !matchingPurchaseOrder ||
      !isPurchaseOrderEligibleForReceiving(matchingPurchaseOrder)
    ) {
      setSelectedPurchaseOrder(null);

      setSelectedPurchaseOrderId("");

      setForm(createEmptyGoodsReceiptForm());

      setMessage({
        type: "error",

        text: "The selected Purchase Order is no longer available for receiving.",
      });
    }
  }, [purchaseOrders, selectedPurchaseOrder]);

  const filteredPurchaseOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return purchaseOrders.filter((purchaseOrder) => {
      const searchableText = [
        purchaseOrder.poNumber,
        purchaseOrder.supplierCode,
        purchaseOrder.supplierName,
        purchaseOrder.supplierTin,
        purchaseOrder.status,
        PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status],
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(normalizedSearch);
    });
  }, [purchaseOrders, searchTerm]);

  const calculatedItems = useMemo(() => {
    return form.items.map((item) => {
      const quantityReceived = Number(item.quantityReceived);

      const unitCost = Number(item.unitCost);

      return {
        ...item,

        lineTotal:
          item.quantityReceived !== "" &&
          isValidGoodsReceiptQuantity(quantityReceived) &&
          item.unitCost !== "" &&
          isValidGoodsReceiptUnitCost(unitCost)
            ? calculateGoodsReceiptLineTotal(quantityReceived, unitCost)
            : 0,

        remainingAfterReceiving: getItemRemainingAfterReceiving(item),
      };
    });
  }, [form.items]);

  const totals = useMemo(() => {
    return calculateGoodsReceiptTotals(calculatedItems);
  }, [calculatedItems]);

  const isFormUnavailable =
    !canPrepareReceipts ||
    !selectedPurchaseOrder ||
    isLoadingDetails ||
    isPosting;

  function scrollToFeedback() {
    window.requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function clearMessageError() {
    if (message.type === "error") {
      setMessage({
        type: "",

        text: "",
      });
    }
  }

  async function handleLoadPurchaseOrder(purchaseOrderId) {
    if (!canPrepareReceipts) {
      setMessage({
        type: "error",

        text: "Your role has read-only access to Goods Receiving.",
      });

      return;
    }

    try {
      setIsLoadingDetails(true);

      setSelectedPurchaseOrderId(purchaseOrderId);

      setMessage({
        type: "",

        text: "",
      });

      const details = await getReceivablePurchaseOrderDetails(purchaseOrderId);

      setSelectedPurchaseOrder(details);

      setForm(createEmptyGoodsReceiptForm(details, details.items));

      setMessage({
        type: "success",

        text: `${details.poNumber} is ready for receiving preparation.`,
      });

      window.scrollTo({
        top: 0,

        behavior: "smooth",
      });
    } catch (error) {
      console.error("Unable to load Purchase Order for receiving:", error);

      setSelectedPurchaseOrder(null);

      setForm(createEmptyGoodsReceiptForm());

      setMessage({
        type: "error",

        text:
          error?.message || "Unable to load the Purchase Order for receiving.",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  }

  function handleHeaderChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,

      [name]:
        name === "referenceNumber"
          ? normalizeGoodsReceiptReference(value)
          : value,
    }));

    clearMessageError();
  }

  function handleItemChange(productId, fieldName, value) {
    setForm((currentForm) => ({
      ...currentForm,

      items: currentForm.items.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const updatedItem = {
          ...item,

          [fieldName]: value,
        };

        const quantityReceived = Number(updatedItem.quantityReceived);

        const unitCost = Number(updatedItem.unitCost);

        updatedItem.lineTotal =
          updatedItem.quantityReceived !== "" &&
          isValidGoodsReceiptQuantity(quantityReceived) &&
          updatedItem.unitCost !== "" &&
          isValidGoodsReceiptUnitCost(unitCost)
            ? calculateGoodsReceiptLineTotal(quantityReceived, unitCost)
            : 0;

        return updatedItem;
      }),
    }));

    clearMessageError();
  }

  function handleReceiveAllItem(item) {
    setForm((currentForm) => ({
      ...currentForm,

      items: currentForm.items.map((currentItem) =>
        currentItem.productId === item.productId
          ? {
              ...currentItem,

              quantityReceived: String(currentItem.remainingBeforeReceiving),

              lineTotal:
                currentItem.unitCost === ""
                  ? 0
                  : calculateGoodsReceiptLineTotal(
                      Number(currentItem.remainingBeforeReceiving),
                      Number(currentItem.unitCost),
                    ),
            }
          : currentItem,
      ),
    }));

    clearMessageError();
  }

  function handleClearItem(item) {
    setForm((currentForm) => ({
      ...currentForm,

      items: currentForm.items.map((currentItem) =>
        currentItem.productId === item.productId
          ? {
              ...currentItem,

              quantityReceived: "",

              lineTotal: 0,
            }
          : currentItem,
      ),
    }));

    clearMessageError();
  }

  function handleReceiveAllRemaining() {
    setForm((currentForm) => ({
      ...currentForm,

      items: currentForm.items.map((item) => ({
        ...item,

        quantityReceived: String(item.remainingBeforeReceiving),

        lineTotal:
          item.unitCost === ""
            ? 0
            : calculateGoodsReceiptLineTotal(
                Number(item.remainingBeforeReceiving),
                Number(item.unitCost),
              ),
      })),
    }));

    clearMessageError();
  }

  function handleClearAllQuantities() {
    setForm((currentForm) => ({
      ...currentForm,

      items: currentForm.items.map((item) => ({
        ...item,

        quantityReceived: "",

        lineTotal: 0,
      })),
    }));

    clearMessageError();
  }

  function validateForm() {
    if (!selectedPurchaseOrder) {
      return "Select an approved Purchase Order.";
    }

    if (!isPurchaseOrderEligibleForReceiving(selectedPurchaseOrder)) {
      return "The selected Purchase Order is no longer eligible for receiving.";
    }

    if (!isValidGoodsReceiptReference(form.referenceNumber)) {
      return `Enter a delivery receipt, invoice, or receiving reference of up to ${GOODS_RECEIPT_LIMITS.REFERENCE_MAX_LENGTH} characters.`;
    }

    if (!isValidGoodsReceiptDateNotFuture(form.dateReceived)) {
      return "Enter a valid receiving date that is not in the future.";
    }

    if (!isValidGoodsReceiptRemarks(form.remarks)) {
      return `Remarks cannot exceed ${GOODS_RECEIPT_LIMITS.REMARKS_MAX_LENGTH} characters.`;
    }

    const selectedItems = calculatedItems.filter(
      (item) =>
        item.quantityReceived !== "" && Number(item.quantityReceived) > 0,
    );

    if (selectedItems.length === 0) {
      return "Enter a receiving quantity for at least one product.";
    }

    for (const item of selectedItems) {
      if (!validateGoodsReceiptItemQuantities(item)) {
        return `The receiving quantity for ${item.productName} must be a positive whole number and cannot exceed ${item.remainingBeforeReceiving}.`;
      }

      if (
        item.unitCost === "" ||
        !isValidGoodsReceiptUnitCost(Number(item.unitCost))
      ) {
        return `Enter a valid actual unit cost for ${item.productName}.`;
      }

      if (item.lineTotal > GOODS_RECEIPT_LIMITS.MAX_MONEY_VALUE) {
        return `The receiving value for ${item.productName} exceeds the allowed maximum.`;
      }
    }

    return "";
  }

  function handleReviewReceipt(event) {
    event.preventDefault();

    if (!canPrepareReceipts) {
      setMessage({
        type: "error",

        text: "Your role has read-only access to Goods Receiving.",
      });

      scrollToFeedback();

      return;
    }

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

  async function handleConfirmPost() {
    if (!canPrepareReceipts) {
      setIsConfirmationOpen(false);

      setMessage({
        type: "error",

        text: "Your role is not allowed to post Goods Receipts.",
      });

      scrollToFeedback();

      return;
    }

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

      const result = await postGoodsReceipt({
        ...form,

        items: calculatedItems,
      });

      setPostedReceipt(result);

      setIsConfirmationOpen(false);

      setSelectedPurchaseOrder(null);

      setSelectedPurchaseOrderId("");

      setForm(createEmptyGoodsReceiptForm());

      setMessage({
        type: "success",

        text: `${result.goodsReceiptNumber} was posted successfully. ${result.totalReceivedQuantity} unit(s) were added to inventory and ${result.poNumber} is now ${
          PURCHASE_ORDER_STATUS_LABELS[result.purchaseOrderStatus] ||
          result.purchaseOrderStatus
        }.`,
      });

      scrollToFeedback();
    } catch (error) {
      console.error("Unable to post Goods Receipt:", error);

      setIsConfirmationOpen(false);

      setMessage({
        type: "error",

        text: error?.message || "Unable to post the Goods Receipt.",
      });

      scrollToFeedback();
    } finally {
      setIsPosting(false);
    }
  }

  function handleClearSelectedPurchaseOrder() {
    if (isPosting) {
      return;
    }

    const hasEnteredData =
      form.referenceNumber ||
      form.remarks ||
      calculatedItems.some(
        (item) =>
          item.quantityReceived !== "" && Number(item.quantityReceived) > 0,
      );

    if (hasEnteredData) {
      const shouldClear = window.confirm(
        "Clear the current Goods Receiving preparation?",
      );

      if (!shouldClear) {
        return;
      }
    }

    setSelectedPurchaseOrder(null);

    setSelectedPurchaseOrderId("");

    setForm(createEmptyGoodsReceiptForm());

    setMessage({
      type: "",

      text: "",
    });
  }

  return (
    <main className="page goods-receiving-page">
      <header className="goods-receiving-page-header">
        <div>
          <p className="section-label">Procurement receiving</p>

          <h2>Goods Receiving</h2>

          <p>
            Select an approved Purchase Order, review delivered quantities, and
            post the Goods Receipt to inventory.
          </p>
        </div>
      </header>

      {isReadOnly && (
        <div className="goods-receiving-readonly-notice">
          <strong>Read-only receiving access</strong>

          <span>
            Your Auditor role may review receivable Purchase Orders but cannot
            prepare a Goods Receipt.
          </span>
        </div>
      )}

      <div ref={feedbackRef}>
        {message.text && (
          <div
            className={`goods-receiving-message goods-receiving-message-${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </div>
        )}

        {loadError && (
          <div
            className="goods-receiving-message goods-receiving-message-error"
            role="alert"
          >
            {loadError}
          </div>
        )}
      </div>

      {postedReceipt && (
        <section className="goods-receiving-success-result">
          <div className="goods-receiving-success-result-heading">
            <div>
              <p className="section-label">Posting completed</p>

              <h3>Goods Receipt Posted Successfully</h3>
            </div>

            <span>COMPLETED</span>
          </div>

          <div className="goods-receiving-success-result-grid">
            <div>
              <span>Goods Receipt number</span>

              <strong>{postedReceipt.goodsReceiptNumber}</strong>
            </div>

            <div>
              <span>Purchase Order</span>

              <strong>{postedReceipt.poNumber}</strong>
            </div>

            <div>
              <span>Supplier</span>

              <strong>{postedReceipt.supplierName}</strong>
            </div>

            <div>
              <span>Supplier reference</span>

              <strong>{postedReceipt.referenceNumber}</strong>
            </div>

            <div>
              <span>Date received</span>

              <strong>{postedReceipt.dateReceived}</strong>
            </div>

            <div>
              <span>Receipt items</span>

              <strong>{postedReceipt.itemCount}</strong>
            </div>

            <div>
              <span>Quantity posted</span>

              <strong>{postedReceipt.totalReceivedQuantity}</strong>
            </div>

            <div>
              <span>Total value</span>

              <strong>{formatCurrency(postedReceipt.totalValue)}</strong>
            </div>

            <div>
              <span>PO status</span>

              <strong>
                {PURCHASE_ORDER_STATUS_LABELS[
                  postedReceipt.purchaseOrderStatus
                ] || postedReceipt.purchaseOrderStatus}
              </strong>
            </div>
          </div>

          <div className="goods-receiving-success-result-actions">
            <button
              type="button"
              onClick={() => {
                setPostedReceipt(null);

                setMessage({
                  type: "",
                  text: "",
                });
              }}
            >
              Receive Another Purchase Order
            </button>
          </div>
        </section>
      )}

      <section className="goods-receiving-summary">
        <article>
          <span>Available POs</span>

          <strong>{purchaseOrders.length}</strong>
        </article>

        <article>
          <span>Selected PO</span>

          <strong>{selectedPurchaseOrder?.poNumber || "None"}</strong>
        </article>

        <article>
          <span>Receiving quantity</span>

          <strong>{totals.totalReceivedQuantity}</strong>
        </article>

        <article>
          <span>Receiving value</span>

          <strong>{formatCurrency(totals.totalValue)}</strong>
        </article>
      </section>

      {canPrepareReceipts && selectedPurchaseOrder && (
        <section className="goods-receiving-form-card">
          <div className="goods-receiving-card-heading">
            <div>
              <p className="section-label">Receiving preparation</p>

              <h3>{selectedPurchaseOrder.poNumber}</h3>
            </div>

            <span
              className={`goods-receiving-status-badge ${getStatusClassName(
                selectedPurchaseOrder.status,
              )}`}
            >
              {PURCHASE_ORDER_STATUS_LABELS[selectedPurchaseOrder.status] ||
                selectedPurchaseOrder.status}
            </span>
          </div>

          <div className="goods-receiving-po-preview">
            <div>
              <span>Supplier</span>

              <strong>{selectedPurchaseOrder.supplierName}</strong>

              <small>{selectedPurchaseOrder.supplierCode}</small>
            </div>

            <div>
              <span>Order date</span>

              <strong>
                {formatDisplayDate(selectedPurchaseOrder.orderDate)}
              </strong>
            </div>

            <div>
              <span>Expected delivery</span>

              <strong>
                {formatDisplayDate(selectedPurchaseOrder.expectedDeliveryDate)}
              </strong>
            </div>

            <div>
              <span>Remaining PO quantity</span>

              <strong>
                {Number(selectedPurchaseOrder.remainingQuantity ?? 0)}
              </strong>
            </div>
          </div>

          <form className="goods-receiving-form" onSubmit={handleReviewReceipt}>
            <div className="goods-receiving-form-grid">
              <label>
                Delivery receipt or invoice reference *
                <input
                  type="text"
                  name="referenceNumber"
                  value={form.referenceNumber}
                  onChange={handleHeaderChange}
                  maxLength={GOODS_RECEIPT_LIMITS.REFERENCE_MAX_LENGTH}
                  placeholder="Example: DR-2026-00125"
                  disabled={isFormUnavailable}
                  required
                />
              </label>

              <label>
                Date received *
                <input
                  type="date"
                  name="dateReceived"
                  value={form.dateReceived}
                  onChange={handleHeaderChange}
                  max={getTodayGoodsReceiptDate()}
                  disabled={isFormUnavailable}
                  required
                />
              </label>
            </div>

            <div className="goods-receiving-items-heading">
              <div>
                <strong>Purchase Order items</strong>

                <span>
                  Leave the receiving quantity blank for items that were not
                  delivered.
                </span>
              </div>

              <div className="goods-receiving-items-heading-actions">
                <button
                  type="button"
                  onClick={handleReceiveAllRemaining}
                  disabled={isFormUnavailable}
                >
                  Receive All Remaining
                </button>

                <button
                  type="button"
                  onClick={handleClearAllQuantities}
                  disabled={isFormUnavailable}
                >
                  Clear Quantities
                </button>
              </div>
            </div>

            <div className="goods-receiving-items-wrapper">
              <table className="goods-receiving-items-table">
                <thead>
                  <tr>
                    <th>Product</th>

                    <th>Unit</th>

                    <th>Ordered</th>

                    <th>Previously Received</th>

                    <th>Remaining</th>

                    <th>Receive Now</th>

                    <th>Actual Unit Cost</th>

                    <th>Remaining After</th>

                    <th>Line Total</th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {calculatedItems.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <div className="goods-receiving-product-cell">
                          <strong>{item.productName}</strong>

                          <span>{item.productSku}</span>

                          <small>{item.category}</small>
                        </div>
                      </td>

                      <td>
                        {item.unitAbbreviation ||
                          item.unitName ||
                          "Not assigned"}
                      </td>

                      <td>{item.orderedQuantity}</td>

                      <td>{item.previouslyReceivedQuantity}</td>

                      <td>
                        <strong>{item.remainingBeforeReceiving}</strong>
                      </td>

                      <td>
                        <input
                          type="number"
                          value={item.quantityReceived}
                          onChange={(event) =>
                            handleItemChange(
                              item.productId,
                              "quantityReceived",
                              event.target.value,
                            )
                          }
                          min="1"
                          max={item.remainingBeforeReceiving}
                          step="1"
                          placeholder="0"
                          disabled={isFormUnavailable}
                          aria-label={`Quantity received for ${item.productName}`}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(event) =>
                            handleItemChange(
                              item.productId,
                              "unitCost",
                              event.target.value,
                            )
                          }
                          min="0"
                          max={GOODS_RECEIPT_LIMITS.MAX_UNIT_COST}
                          step="0.01"
                          disabled={isFormUnavailable}
                          aria-label={`Actual unit cost for ${item.productName}`}
                        />
                      </td>

                      <td>{item.remainingAfterReceiving}</td>

                      <td>
                        <strong>{formatCurrency(item.lineTotal)}</strong>
                      </td>

                      <td>
                        <div className="goods-receiving-row-actions">
                          <button
                            type="button"
                            onClick={() => handleReceiveAllItem(item)}
                            disabled={isFormUnavailable}
                          >
                            All
                          </button>

                          <button
                            type="button"
                            onClick={() => handleClearItem(item)}
                            disabled={
                              isFormUnavailable || item.quantityReceived === ""
                            }
                          >
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="goods-receiving-remarks-field">
              Receiving remarks
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleHeaderChange}
                maxLength={GOODS_RECEIPT_LIMITS.REMARKS_MAX_LENGTH}
                rows="4"
                placeholder="Optional notes about damaged packaging, shortages, or delivery conditions"
                disabled={isFormUnavailable}
              />
              <small>
                {form.remarks.length}/{GOODS_RECEIPT_LIMITS.REMARKS_MAX_LENGTH}
              </small>
            </label>

            <div className="goods-receiving-total-preview">
              <article>
                <span>Receipt items</span>

                <strong>{totals.itemCount}</strong>
              </article>

              <article>
                <span>Quantity received</span>

                <strong>{totals.totalReceivedQuantity}</strong>
              </article>

              <article>
                <span>Receiving value</span>

                <strong>{formatCurrency(totals.totalValue)}</strong>
              </article>
            </div>

            <div className="goods-receiving-form-actions">
              <button
                type="submit"
                className="goods-receiving-review-button"
                disabled={isFormUnavailable || totals.itemCount === 0}
              >
                Review & Post Goods Receipt
              </button>

              <button
                type="button"
                className="goods-receiving-clear-button"
                onClick={handleClearSelectedPurchaseOrder}
                disabled={isLoadingDetails || isPosting}
              >
                Clear Selected PO
              </button>
            </div>

            <div className="goods-receiving-phase-notice">
              <strong>Atomic posting workflow</strong>

              <span>
                After confirmation, the transaction will create a permanent
                Goods Receipt, update the Purchase Order, increase product
                stock, and create Stock-In movement records. Firestore
                permissions are finalized in Phase 4G-3.
              </span>
            </div>
          </form>
        </section>
      )}

      <section className="goods-receiving-list-card">
        <div className="goods-receiving-list-heading">
          <div>
            <p className="section-label">Approved procurement</p>

            <h3>Purchase Orders Available for Receiving</h3>
          </div>

          <span>
            {filteredPurchaseOrders.length} of {purchaseOrders.length}
          </span>
        </div>

        <div className="goods-receiving-list-filter">
          <label>
            Search Purchase Orders
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search PO number, supplier, TIN, or status"
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

        {isLoadingPurchaseOrders ? (
          <div className="goods-receiving-list-empty">
            <strong>Loading approved Purchase Orders...</strong>

            <p>Fetching receivable procurement records from Firebase.</p>
          </div>
        ) : filteredPurchaseOrders.length === 0 ? (
          <div className="goods-receiving-list-empty">
            <strong>No Purchase Orders are ready for receiving</strong>

            <p>
              A Purchase Order must be Approved or Partially Received and still
              have a remaining quantity.
            </p>
          </div>
        ) : (
          <div className="goods-receiving-list-wrapper">
            <table className="goods-receiving-list-table">
              <thead>
                <tr>
                  <th>PO Number</th>

                  <th>Supplier</th>

                  <th>Order Date</th>

                  <th>Expected Delivery</th>

                  <th>Ordered</th>

                  <th>Previously Received</th>

                  <th>Remaining</th>

                  <th>Status</th>

                  {canPrepareReceipts && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredPurchaseOrders.map((purchaseOrder) => {
                  const isSelected =
                    selectedPurchaseOrderId === purchaseOrder.id;

                  return (
                    <tr
                      key={purchaseOrder.id}
                      className={
                        isSelected ? "goods-receiving-selected-row" : ""
                      }
                    >
                      <td>
                        <strong>{purchaseOrder.poNumber}</strong>
                      </td>

                      <td>
                        <div className="goods-receiving-supplier-cell">
                          <strong>{purchaseOrder.supplierName}</strong>

                          <span>{purchaseOrder.supplierCode}</span>
                        </div>
                      </td>

                      <td>{formatDisplayDate(purchaseOrder.orderDate)}</td>

                      <td>
                        {formatDisplayDate(purchaseOrder.expectedDeliveryDate)}
                      </td>

                      <td>{Number(purchaseOrder.totalOrderedQuantity ?? 0)}</td>

                      <td>
                        {Number(purchaseOrder.totalReceivedQuantity ?? 0)}
                      </td>

                      <td>
                        <strong>
                          {Number(purchaseOrder.remainingQuantity ?? 0)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`goods-receiving-status-badge ${getStatusClassName(
                            purchaseOrder.status,
                          )}`}
                        >
                          {PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status] ||
                            purchaseOrder.status}
                        </span>
                      </td>

                      {canPrepareReceipts && (
                        <td>
                          <button
                            type="button"
                            className="goods-receiving-select-button"
                            onClick={() =>
                              handleLoadPurchaseOrder(purchaseOrder.id)
                            }
                            disabled={isLoadingDetails}
                          >
                            {isLoadingDetails && isSelected
                              ? "Loading..."
                              : isSelected
                                ? "Reload PO"
                                : "Prepare Receipt"}
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

      {isConfirmationOpen && selectedPurchaseOrder && (
        <div
          className="goods-receiving-confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseConfirmation();
            }
          }}
        >
          <section
            className="goods-receiving-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goods-receiving-confirmation-title"
          >
            <div className="goods-receiving-confirmation-heading">
              <div>
                <p className="section-label">Final confirmation</p>

                <h3 id="goods-receiving-confirmation-title">
                  Post Goods Receipt?
                </h3>
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

            <div className="goods-receiving-confirmation-warning">
              <strong>This action changes inventory stock.</strong>

              <span>
                The Goods Receipt, Purchase Order, product balances, and
                Stock-In movements will be updated in one transaction.
              </span>
            </div>

            <div className="goods-receiving-confirmation-summary">
              <div>
                <span>Purchase Order</span>

                <strong>{selectedPurchaseOrder.poNumber}</strong>
              </div>

              <div>
                <span>Supplier</span>

                <strong>{selectedPurchaseOrder.supplierName}</strong>
              </div>

              <div>
                <span>Supplier reference</span>

                <strong>{form.referenceNumber}</strong>
              </div>

              <div>
                <span>Date received</span>

                <strong>{form.dateReceived}</strong>
              </div>

              <div>
                <span>Receipt items</span>

                <strong>{totals.itemCount}</strong>
              </div>

              <div>
                <span>Total quantity</span>

                <strong>{totals.totalReceivedQuantity}</strong>
              </div>

              <div>
                <span>Total value</span>

                <strong>{formatCurrency(totals.totalValue)}</strong>
              </div>
            </div>

            <div className="goods-receiving-confirmation-items">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>

                    <th>Receive Now</th>

                    <th>Unit Cost</th>

                    <th>Line Total</th>
                  </tr>
                </thead>

                <tbody>
                  {calculatedItems
                    .filter(
                      (item) =>
                        item.quantityReceived !== "" &&
                        Number(item.quantityReceived) > 0,
                    )
                    .map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <strong>{item.productName}</strong>

                          <span>{item.productSku}</span>
                        </td>

                        <td>{item.quantityReceived}</td>

                        <td>{formatCurrency(item.unitCost)}</td>

                        <td>
                          <strong>{formatCurrency(item.lineTotal)}</strong>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="goods-receiving-confirmation-actions">
              <button
                type="button"
                className="goods-receiving-confirmation-cancel"
                onClick={handleCloseConfirmation}
                disabled={isPosting}
              >
                Go Back
              </button>

              <button
                type="button"
                className="goods-receiving-confirmation-post"
                onClick={handleConfirmPost}
                disabled={isPosting}
              >
                {isPosting ? "Posting Goods Receipt..." : "Post Goods Receipt"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default GoodsReceiving;
