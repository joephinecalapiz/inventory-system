import { useEffect, useMemo, useState } from "react";

import "../styles/PurchaseOrders.css";

import { USER_ROLES } from "../constants/roles";
import { PRODUCT_STATUSES } from "../constants/products";

import {
  PURCHASE_ORDER_LIMITS,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
  calculatePurchaseOrderLineTotal,
  calculatePurchaseOrderTotals,
  createEmptyPurchaseOrderForm,
  createEmptyPurchaseOrderItem,
  getTodayPurchaseOrderDate,
  isValidExpectedDeliveryDate,
  isValidPurchaseOrderDate,
  isValidPurchaseOrderMoney,
  isValidPurchaseOrderQuantity,
  isValidPurchaseOrderUnitCost,
} from "../constants/purchaseOrders";

import { subscribeToProducts } from "../services/productService";

import { subscribeToActiveSuppliers } from "../services/supplierService";

import {
  createPurchaseOrderDraft,
  getPurchaseOrderDetails,
  subscribeToPurchaseOrders,
  updatePurchaseOrderDraft,
} from "../services/purchaseOrderService";

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

function getPurchaseOrderStatus(purchaseOrder) {
  return purchaseOrder?.status ?? PURCHASE_ORDER_STATUSES.DRAFT;
}

function getStatusClassName(status) {
  return `purchase-order-status-${String(status ?? "")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function getProductUnitLabel(product) {
  const unitName = String(product?.unitName ?? "").trim();
  const abbreviation = String(product?.unitAbbreviation ?? "").trim();

  if (unitName && abbreviation) {
    return `${unitName} (${abbreviation})`;
  }

  return unitName || abbreviation || "Unit not assigned";
}

function PurchaseOrders({ currentUserRole }) {
  const canManageDrafts = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  const isReadOnly = currentUserRole === USER_ROLES.AUDITOR;

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [form, setForm] = useState(() => createEmptyPurchaseOrderForm());

  const [editingPurchaseOrderId, setEditingPurchaseOrderId] = useState("");

  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const [purchaseOrderSearchTerm, setPurchaseOrderSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);

  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingPurchaseOrders, setIsLoadingPurchaseOrders] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [busyPurchaseOrderId, setBusyPurchaseOrderId] = useState("");

  const [supplierError, setSupplierError] = useState("");
  const [productError, setProductError] = useState("");
  const [purchaseOrderError, setPurchaseOrderError] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToActiveSuppliers(
      (activeSuppliers) => {
        setSuppliers(activeSuppliers);
        setSupplierError("");
        setIsLoadingSuppliers(false);
      },

      (error) => {
        console.error("Unable to load suppliers:", error);

        setSupplierError(
          error?.message || "Unable to load active suppliers.",
        );

        setIsLoadingSuppliers(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (firebaseProducts) => {
        setProducts(firebaseProducts);
        setProductError("");
        setIsLoadingProducts(false);
      },

      (error) => {
        console.error("Unable to load products:", error);

        setProductError(
          error?.message || "Unable to load inventory products.",
        );

        setIsLoadingProducts(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPurchaseOrders(
      (firebasePurchaseOrders) => {
        setPurchaseOrders(firebasePurchaseOrders);
        setPurchaseOrderError("");
        setIsLoadingPurchaseOrders(false);
      },

      (error) => {
        console.error("Unable to load Purchase Orders:", error);

        setPurchaseOrderError(
          error?.message || "Unable to load Purchase Orders.",
        );

        setIsLoadingPurchaseOrders(false);
      },
    );

    return unsubscribe;
  }, []);

  const activeProducts = useMemo(() => {
    return products.filter(
      (product) =>
        (product.status ?? PRODUCT_STATUSES.ACTIVE) ===
        PRODUCT_STATUSES.ACTIVE,
    );
  }, [products]);

  const selectedProductIds = useMemo(() => {
    return new Set(
      form.items
        .map((item) => String(item.productId ?? "").trim())
        .filter(Boolean),
    );
  }, [form.items]);

  const availableProducts = useMemo(() => {
    const normalizedSearch = productSearchTerm.trim().toLowerCase();

    return activeProducts
      .filter((product) => !selectedProductIds.has(product.id))
      .filter((product) => {
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
      })
      .sort((firstProduct, secondProduct) => {
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
  }, [activeProducts, selectedProductIds, productSearchTerm]);

  const selectedSupplier = useMemo(() => {
    return (
      suppliers.find((supplier) => supplier.id === form.supplierId) ?? null
    );
  }, [suppliers, form.supplierId]);

  const calculatedItems = useMemo(() => {
    return form.items.map((item) => {
      const quantity = Number(item.orderedQuantity);
      const unitCost = Number(item.unitCost);

      return {
        ...item,

        lineTotal:
          isValidPurchaseOrderQuantity(quantity) &&
          item.unitCost !== "" &&
          isValidPurchaseOrderUnitCost(unitCost)
            ? calculatePurchaseOrderLineTotal(quantity, unitCost)
            : 0,
      };
    });
  }, [form.items]);

  const totals = useMemo(() => {
    return calculatePurchaseOrderTotals(calculatedItems, {
      discountAmount: Number(form.discountAmount || 0),
      taxAmount: Number(form.taxAmount || 0),
      shippingAmount: Number(form.shippingAmount || 0),
    });
  }, [
    calculatedItems,
    form.discountAmount,
    form.taxAmount,
    form.shippingAmount,
  ]);

  const totalOrderedQuantity = useMemo(() => {
    return calculatedItems.reduce((total, item) => {
      const quantity = Number(item.orderedQuantity);

      return total + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
  }, [calculatedItems]);

  const purchaseOrderSummary = useMemo(() => {
    return {
      total: purchaseOrders.length,

      draft: purchaseOrders.filter(
        (purchaseOrder) =>
          getPurchaseOrderStatus(purchaseOrder) ===
          PURCHASE_ORDER_STATUSES.DRAFT,
      ).length,

      submitted: purchaseOrders.filter(
        (purchaseOrder) =>
          getPurchaseOrderStatus(purchaseOrder) ===
          PURCHASE_ORDER_STATUSES.SUBMITTED,
      ).length,

      approved: purchaseOrders.filter((purchaseOrder) =>
        [
          PURCHASE_ORDER_STATUSES.APPROVED,
          PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
        ].includes(getPurchaseOrderStatus(purchaseOrder)),
      ).length,
    };
  }, [purchaseOrders]);

  const filteredPurchaseOrders = useMemo(() => {
    const normalizedSearch = purchaseOrderSearchTerm.trim().toLowerCase();

    return purchaseOrders.filter((purchaseOrder) => {
      const status = getPurchaseOrderStatus(purchaseOrder);

      const searchableText = [
        purchaseOrder.poNumber,
        purchaseOrder.supplierCode,
        purchaseOrder.supplierName,
        purchaseOrder.supplierTin,
        purchaseOrder.notes,
        status,
        PURCHASE_ORDER_STATUS_LABELS[status],
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, purchaseOrderSearchTerm, statusFilter]);

  const isFormUnavailable =
    !canManageDrafts ||
    isSaving ||
    isLoadingSuppliers ||
    isLoadingProducts ||
    Boolean(supplierError) ||
    Boolean(productError);

  function clearErrorMessage() {
    if (message.type === "error") {
      setMessage({
        type: "",
        text: "",
      });
    }
  }

  function handleHeaderChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    clearErrorMessage();
  }

  function handleProductSelection(event) {
    setSelectedProductId(event.target.value);
    clearErrorMessage();
  }

  function handleAddProduct() {
    if (!selectedProductId) {
      setMessage({
        type: "error",
        text: "Select a product to add to the Purchase Order.",
      });

      return;
    }

    if (form.items.length >= PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT) {
      setMessage({
        type: "error",
        text: `A Purchase Order cannot contain more than ${PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT} products.`,
      });

      return;
    }

    const product = activeProducts.find(
      (currentProduct) => currentProduct.id === selectedProductId,
    );

    if (!product) {
      setMessage({
        type: "error",
        text: "The selected product is no longer active or available.",
      });

      return;
    }

    if (selectedProductIds.has(product.id)) {
      setMessage({
        type: "error",
        text: "The selected product is already included in this Purchase Order.",
      });

      return;
    }

    const item = createEmptyPurchaseOrderItem(product);

    const unitCost =
      item.unitCost === "" ? "" : Number(item.unitCost);

    const preparedItem = {
      ...item,

      orderedQuantity: "1",

      receivedQuantity: 0,

      remainingQuantity: 1,

      unitCost: unitCost === "" ? "" : String(unitCost),

      lineTotal:
        unitCost === "" || !isValidPurchaseOrderUnitCost(unitCost)
          ? 0
          : calculatePurchaseOrderLineTotal(1, unitCost),
    };

    setForm((currentForm) => ({
      ...currentForm,
      items: [...currentForm.items, preparedItem],
    }));

    setSelectedProductId("");
    setProductSearchTerm("");

    setMessage({
      type: "success",
      text: `${product.name} was added to the Purchase Order.`,
    });
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

        const quantity = Number(updatedItem.orderedQuantity);
        const unitCost = Number(updatedItem.unitCost);

        updatedItem.remainingQuantity = isValidPurchaseOrderQuantity(quantity)
          ? quantity
          : "";

        updatedItem.lineTotal =
          isValidPurchaseOrderQuantity(quantity) &&
          updatedItem.unitCost !== "" &&
          isValidPurchaseOrderUnitCost(unitCost)
            ? calculatePurchaseOrderLineTotal(quantity, unitCost)
            : 0;

        return updatedItem;
      }),
    }));

    clearErrorMessage();
  }

  function handleRemoveProduct(productId) {
    const item = form.items.find(
      (currentItem) => currentItem.productId === productId,
    );

    if (!item) {
      return;
    }

    const shouldRemove = window.confirm(
      `Remove "${item.productName}" from this Purchase Order?`,
    );

    if (!shouldRemove) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,

      items: currentForm.items.filter(
        (currentItem) => currentItem.productId !== productId,
      ),
    }));

    clearErrorMessage();
  }

  function validateForm() {
    if (!form.supplierId) {
      return "Select an active supplier.";
    }

    if (!selectedSupplier) {
      return "The selected supplier is no longer active or available.";
    }

    if (!isValidPurchaseOrderDate(form.orderDate)) {
      return "Enter a valid Purchase Order date.";
    }

    if (form.orderDate > getTodayPurchaseOrderDate()) {
      return "The Purchase Order date cannot be in the future.";
    }

    if (
      !isValidExpectedDeliveryDate(
        form.orderDate,
        form.expectedDeliveryDate,
      )
    ) {
      return "The expected delivery date cannot be earlier than the Purchase Order date.";
    }

    if (form.items.length === 0) {
      return "Add at least one product to the Purchase Order.";
    }

    if (form.items.length > PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT) {
      return `A Purchase Order cannot contain more than ${PURCHASE_ORDER_LIMITS.MAX_ITEM_COUNT} products.`;
    }

    const duplicateProductIds = new Set();

    for (const item of form.items) {
      if (!item.productId) {
        return "A Purchase Order item does not have a valid product.";
      }

      if (duplicateProductIds.has(item.productId)) {
        return "The same product cannot appear twice in one Purchase Order.";
      }

      duplicateProductIds.add(item.productId);

      const quantity = Number(item.orderedQuantity);
      const unitCost = Number(item.unitCost);

      if (!isValidPurchaseOrderQuantity(quantity)) {
        return `Enter a positive whole quantity for ${item.productName}.`;
      }

      if (
        item.unitCost === "" ||
        !isValidPurchaseOrderUnitCost(unitCost)
      ) {
        return `Enter a valid non-negative unit cost for ${item.productName}.`;
      }

      const rawLineTotal = quantity * unitCost;

      if (
        !Number.isFinite(rawLineTotal) ||
        rawLineTotal > PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE
      ) {
        return `The line total for ${item.productName} exceeds the allowed maximum.`;
      }
    }

    const moneyFields = [
      {
        label: "Discount",
        value: Number(form.discountAmount || 0),
      },
      {
        label: "Tax",
        value: Number(form.taxAmount || 0),
      },
      {
        label: "Shipping amount",
        value: Number(form.shippingAmount || 0),
      },
    ];

    for (const moneyField of moneyFields) {
      if (!isValidPurchaseOrderMoney(moneyField.value)) {
        return `${moneyField.label} must be a valid non-negative amount.`;
      }
    }

    if (totals.discountAmount > totals.subtotal) {
      return "The discount cannot be greater than the Purchase Order subtotal.";
    }

    if (form.notes.length > PURCHASE_ORDER_LIMITS.NOTES_MAX_LENGTH) {
      return `Purchase Order notes cannot exceed ${PURCHASE_ORDER_LIMITS.NOTES_MAX_LENGTH} characters.`;
    }

    return "";
  }

  function resetForm() {
    setForm(createEmptyPurchaseOrderForm());
    setEditingPurchaseOrderId("");
    setSelectedProductId("");
    setProductSearchTerm("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageDrafts) {
      setMessage({
        type: "error",
        text: "Your role has read-only access to Purchase Orders.",
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
        editingPurchaseOrderId
          ? "Update this Draft Purchase Order?"
          : "Create this Draft Purchase Order?",
        "",
        `Supplier: ${selectedSupplier.name}`,
        `Items: ${form.items.length}`,
        `Total quantity: ${totalOrderedQuantity}`,
        `Grand total: ${formatCurrency(totals.grandTotal)}`,
        "",
        "The Purchase Order will remain in Draft status.",
      ].join("\n"),
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setIsSaving(true);

      setMessage({
        type: "",
        text: "",
      });

      const payload = {
        ...form,

        items: calculatedItems,
      };

      if (editingPurchaseOrderId) {
        const result = await updatePurchaseOrderDraft(
          editingPurchaseOrderId,
          payload,
        );

        setMessage({
          type: "success",
          text: `${result.poNumber} was updated successfully.`,
        });
      } else {
        const result = await createPurchaseOrderDraft(payload);

        setMessage({
          type: "success",
          text: `${result.poNumber} was created successfully as a Draft Purchase Order.`,
        });
      }

      resetForm();
    } catch (error) {
      console.error("Unable to save Purchase Order:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to save the Purchase Order.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditDraft(purchaseOrder) {
    if (!canManageDrafts) {
      setMessage({
        type: "error",
        text: "Your role has read-only access to Purchase Orders.",
      });

      return;
    }

    if (
      getPurchaseOrderStatus(purchaseOrder) !==
      PURCHASE_ORDER_STATUSES.DRAFT
    ) {
      setMessage({
        type: "error",
        text: "Only Draft Purchase Orders can be edited.",
      });

      return;
    }

    try {
      setBusyPurchaseOrderId(purchaseOrder.id);

      setMessage({
        type: "",
        text: "",
      });

      const details = await getPurchaseOrderDetails(purchaseOrder.id);

      const formItems = details.items.map((item) => ({
        ...item,

        orderedQuantity: String(item.orderedQuantity ?? ""),

        receivedQuantity: Number(item.receivedQuantity ?? 0),

        remainingQuantity: Number(
          item.remainingQuantity ?? item.orderedQuantity ?? 0,
        ),

        unitCost:
          item.unitCost === null || item.unitCost === undefined
            ? ""
            : String(item.unitCost),

        lineTotal: Number(item.lineTotal ?? 0),
      }));

      setForm({
        supplierId: String(details.supplierId ?? ""),

        orderDate:
          details.orderDateKey ||
          getDateInputValue(details.orderDate) ||
          getTodayPurchaseOrderDate(),

        expectedDeliveryDate:
          details.expectedDeliveryDateKey ||
          getDateInputValue(details.expectedDeliveryDate),

        discountAmount: String(details.discountAmount ?? 0),

        taxAmount: String(details.taxAmount ?? 0),

        shippingAmount: String(details.shippingAmount ?? 0),

        notes: String(details.notes ?? ""),

        items: formItems,
      });

      setEditingPurchaseOrderId(details.id);
      setSelectedProductId("");
      setProductSearchTerm("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      setMessage({
        type: "success",
        text: `${details.poNumber} is ready for editing.`,
      });
    } catch (error) {
      console.error("Unable to load Purchase Order details:", error);

      setMessage({
        type: "error",
        text:
          error?.message || "Unable to load the Purchase Order for editing.",
      });
    } finally {
      setBusyPurchaseOrderId("");
    }
  }

  function handleClearForm() {
    const hasEnteredData =
      form.supplierId ||
      form.items.length > 0 ||
      form.expectedDeliveryDate ||
      Number(form.discountAmount) > 0 ||
      Number(form.taxAmount) > 0 ||
      Number(form.shippingAmount) > 0 ||
      form.notes;

    if (hasEnteredData) {
      const shouldClear = window.confirm(
        editingPurchaseOrderId
          ? "Discard the changes to this Draft Purchase Order?"
          : "Clear the current Purchase Order form?",
      );

      if (!shouldClear) {
        return;
      }
    }

    resetForm();

    setMessage({
      type: "",
      text: "",
    });
  }

  function clearListFilters() {
    setPurchaseOrderSearchTerm("");
    setStatusFilter(ALL_FILTER);
  }

  return (
    <main className="page purchase-orders-page">
      <header className="purchase-orders-page-header">
        <div>
          <p className="section-label">Procurement</p>

          <h2>Purchase Orders</h2>

          <p>
            Create supplier Purchase Orders, maintain draft item details, and
            review procurement records.
          </p>
        </div>
      </header>

      {isReadOnly && (
        <div className="purchase-orders-readonly-notice">
          <strong>Read-only Purchase Order access</strong>

          <span>
            Your Auditor role can review Purchase Orders but cannot create or
            edit drafts.
          </span>
        </div>
      )}

      {message.text && (
        <div
          className={`purchase-orders-message purchase-orders-message-${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      {[supplierError, productError, purchaseOrderError]
        .filter(Boolean)
        .map((errorMessage) => (
          <div
            key={errorMessage}
            className="purchase-orders-message purchase-orders-message-error"
            role="alert"
          >
            {errorMessage}
          </div>
        ))}

      <section className="purchase-orders-summary">
        <article>
          <span>Total Purchase Orders</span>
          <strong>{purchaseOrderSummary.total}</strong>
        </article>

        <article>
          <span>Drafts</span>
          <strong>{purchaseOrderSummary.draft}</strong>
        </article>

        <article>
          <span>Pending Approval</span>
          <strong>{purchaseOrderSummary.submitted}</strong>
        </article>

        <article>
          <span>Approved/Receiving</span>
          <strong>{purchaseOrderSummary.approved}</strong>
        </article>
      </section>

      {canManageDrafts && (
        <section className="purchase-order-form-card">
          <div className="purchase-order-card-heading">
            <div>
              <p className="section-label">
                {editingPurchaseOrderId ? "Edit draft" : "New draft"}
              </p>

              <h3>
                {editingPurchaseOrderId
                  ? "Update Purchase Order"
                  : "Purchase Order Information"}
              </h3>
            </div>

            {editingPurchaseOrderId && (
              <span className="purchase-order-editing-badge">
                Editing Draft
              </span>
            )}
          </div>

          <form className="purchase-order-form" onSubmit={handleSubmit}>
            <div className="purchase-order-form-grid">
              <label>
                Supplier *
                <select
                  name="supplierId"
                  value={form.supplierId}
                  onChange={handleHeaderChange}
                  disabled={isFormUnavailable}
                  required
                >
                  <option value="">
                    {isLoadingSuppliers
                      ? "Loading suppliers..."
                      : suppliers.length === 0
                        ? "No active suppliers available"
                        : "Select an active supplier"}
                  </option>

                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplierCode} — {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Purchase Order date *
                <input
                  type="date"
                  name="orderDate"
                  value={form.orderDate}
                  onChange={handleHeaderChange}
                  max={getTodayPurchaseOrderDate()}
                  disabled={isFormUnavailable}
                  required
                />
              </label>

              <label>
                Expected delivery date
                <input
                  type="date"
                  name="expectedDeliveryDate"
                  value={form.expectedDeliveryDate}
                  onChange={handleHeaderChange}
                  min={form.orderDate}
                  disabled={isFormUnavailable}
                />
              </label>
            </div>

            {selectedSupplier && (
              <div className="purchase-order-supplier-preview">
                <div>
                  <span>Selected supplier</span>
                  <strong>{selectedSupplier.name}</strong>
                </div>

                <div>
                  <span>Supplier code</span>
                  <strong>{selectedSupplier.supplierCode}</strong>
                </div>

                <div>
                  <span>Payment terms</span>
                  <strong>
                    {selectedSupplier.customPaymentTerms ||
                      selectedSupplier.paymentTerm ||
                      "Not specified"}
                  </strong>
                </div>

                <div>
                  <span>Contact</span>
                  <strong>
                    {selectedSupplier.contactNumber ||
                      selectedSupplier.email ||
                      "Not provided"}
                  </strong>
                </div>
              </div>
            )}

            <div className="purchase-order-product-picker">
              <div className="purchase-order-product-search">
                <label>
                  Search product
                  <input
                    type="search"
                    value={productSearchTerm}
                    onChange={(event) =>
                      setProductSearchTerm(event.target.value)
                    }
                    placeholder="Search name, SKU, barcode, category, or source ID"
                    disabled={isFormUnavailable}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setProductSearchTerm("")}
                  disabled={isFormUnavailable || !productSearchTerm}
                >
                  Clear
                </button>
              </div>

              <div className="purchase-order-product-select">
                <label>
                  Product
                  <select
                    value={selectedProductId}
                    onChange={handleProductSelection}
                    disabled={isFormUnavailable}
                  >
                    <option value="">
                      {isLoadingProducts
                        ? "Loading products..."
                        : availableProducts.length === 0
                          ? "No additional products available"
                          : `Select from ${availableProducts.length} product(s)`}
                    </option>

                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {product.sku} —{" "}
                        {getProductUnitLabel(product)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="purchase-order-add-product-button"
                  onClick={handleAddProduct}
                  disabled={isFormUnavailable || !selectedProductId}
                >
                  Add Product
                </button>
              </div>
            </div>

            {form.items.length === 0 ? (
              <div className="purchase-order-items-empty">
                <strong>No products added</strong>

                <p>
                  Search and add at least one active product to the Purchase
                  Order.
                </p>
              </div>
            ) : (
              <div className="purchase-order-items-wrapper">
                <table className="purchase-order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Ordered Quantity</th>
                      <th>Unit Cost</th>
                      <th>Line Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {calculatedItems.map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <div className="purchase-order-product-cell">
                            <strong>{item.productName}</strong>
                            <span>{item.productSku}</span>
                          </div>
                        </td>

                        <td>{item.category || "Uncategorized"}</td>

                        <td>
                          {item.unitAbbreviation ||
                            item.unitName ||
                            "Not assigned"}
                        </td>

                        <td>
                          <input
                            type="number"
                            value={item.orderedQuantity}
                            onChange={(event) =>
                              handleItemChange(
                                item.productId,
                                "orderedQuantity",
                                event.target.value,
                              )
                            }
                            min="1"
                            max={PURCHASE_ORDER_LIMITS.MAX_QUANTITY}
                            step="1"
                            disabled={isFormUnavailable}
                            aria-label={`Ordered quantity for ${item.productName}`}
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
                            max={PURCHASE_ORDER_LIMITS.MAX_UNIT_COST}
                            step="0.01"
                            disabled={isFormUnavailable}
                            aria-label={`Unit cost for ${item.productName}`}
                          />
                        </td>

                        <td>
                          <strong>{formatCurrency(item.lineTotal)}</strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="purchase-order-remove-item-button"
                            onClick={() => handleRemoveProduct(item.productId)}
                            disabled={isFormUnavailable}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="purchase-order-adjustments-grid">
              <label>
                Discount
                <input
                  type="number"
                  name="discountAmount"
                  value={form.discountAmount}
                  onChange={handleHeaderChange}
                  min="0"
                  max={PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE}
                  step="0.01"
                  disabled={isFormUnavailable}
                />
              </label>

              <label>
                Tax
                <input
                  type="number"
                  name="taxAmount"
                  value={form.taxAmount}
                  onChange={handleHeaderChange}
                  min="0"
                  max={PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE}
                  step="0.01"
                  disabled={isFormUnavailable}
                />
              </label>

              <label>
                Shipping
                <input
                  type="number"
                  name="shippingAmount"
                  value={form.shippingAmount}
                  onChange={handleHeaderChange}
                  min="0"
                  max={PURCHASE_ORDER_LIMITS.MAX_MONEY_VALUE}
                  step="0.01"
                  disabled={isFormUnavailable}
                />
              </label>
            </div>

            <label className="purchase-order-notes-field">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleHeaderChange}
                maxLength={PURCHASE_ORDER_LIMITS.NOTES_MAX_LENGTH}
                rows="4"
                placeholder="Delivery instructions or Purchase Order notes"
                disabled={isFormUnavailable}
              />

              <small>
                {form.notes.length}/{PURCHASE_ORDER_LIMITS.NOTES_MAX_LENGTH}
              </small>
            </label>

            <div className="purchase-order-total-preview">
              <article>
                <span>Items</span>
                <strong>{form.items.length}</strong>
              </article>

              <article>
                <span>Total quantity</span>
                <strong>{totalOrderedQuantity}</strong>
              </article>

              <article>
                <span>Subtotal</span>
                <strong>{formatCurrency(totals.subtotal)}</strong>
              </article>

              <article>
                <span>Grand total</span>
                <strong>{formatCurrency(totals.grandTotal)}</strong>
              </article>
            </div>

            <div className="purchase-order-form-actions">
              <button
                type="submit"
                className="purchase-order-save-button"
                disabled={isFormUnavailable || form.items.length === 0}
              >
                {isSaving
                  ? "Saving Draft..."
                  : editingPurchaseOrderId
                    ? "Update Draft"
                    : "Create Draft"}
              </button>

              <button
                type="button"
                className="purchase-order-clear-button"
                onClick={handleClearForm}
                disabled={isSaving}
              >
                {editingPurchaseOrderId ? "Cancel Edit" : "Clear Form"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="purchase-order-list-card">
        <div className="purchase-order-list-heading">
          <div>
            <p className="section-label">Procurement records</p>
            <h3>Purchase Order Directory</h3>
          </div>

          <span>
            {filteredPurchaseOrders.length} of {purchaseOrders.length}
          </span>
        </div>

        <div className="purchase-order-list-filters">
          <label>
            Search Purchase Orders
            <input
              type="search"
              value={purchaseOrderSearchTerm}
              onChange={(event) =>
                setPurchaseOrderSearchTerm(event.target.value)
              }
              placeholder="Search PO number, supplier, TIN, notes, or status"
            />
          </label>

          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value={ALL_FILTER}>All statuses</option>

              {Object.values(PURCHASE_ORDER_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {PURCHASE_ORDER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={clearListFilters}>
            Clear filters
          </button>
        </div>

        {isLoadingPurchaseOrders ? (
          <div className="purchase-order-list-empty">
            <strong>Loading Purchase Orders...</strong>
            <p>Fetching procurement records from Firebase.</p>
          </div>
        ) : filteredPurchaseOrders.length === 0 ? (
          <div className="purchase-order-list-empty">
            <strong>No Purchase Orders found</strong>
            <p>Create a draft or change the selected filters.</p>
          </div>
        ) : (
          <div className="purchase-order-list-wrapper">
            <table className="purchase-order-list-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Order Date</th>
                  <th>Expected Delivery</th>
                  <th>Items</th>
                  <th>Quantity</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  {canManageDrafts && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredPurchaseOrders.map((purchaseOrder) => {
                  const status = getPurchaseOrderStatus(purchaseOrder);

                  const isBusy =
                    busyPurchaseOrderId === purchaseOrder.id;

                  return (
                    <tr key={purchaseOrder.id}>
                      <td>
                        <strong>{purchaseOrder.poNumber}</strong>
                      </td>

                      <td>
                        <div className="purchase-order-supplier-cell">
                          <strong>{purchaseOrder.supplierName}</strong>
                          <span>{purchaseOrder.supplierCode}</span>
                        </div>
                      </td>

                      <td>{formatDisplayDate(purchaseOrder.orderDate)}</td>

                      <td>
                        {formatDisplayDate(
                          purchaseOrder.expectedDeliveryDate,
                        )}
                      </td>

                      <td>{Number(purchaseOrder.itemCount ?? 0)}</td>

                      <td>
                        {Number(purchaseOrder.totalOrderedQuantity ?? 0)}
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(purchaseOrder.grandTotal)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`purchase-order-status-badge ${getStatusClassName(
                            status,
                          )}`}
                        >
                          {PURCHASE_ORDER_STATUS_LABELS[status] || status}
                        </span>
                      </td>

                      {canManageDrafts && (
                        <td>
                          {status === PURCHASE_ORDER_STATUSES.DRAFT ? (
                            <button
                              type="button"
                              className="purchase-order-edit-button"
                              onClick={() => handleEditDraft(purchaseOrder)}
                              disabled={isBusy || isSaving}
                            >
                              {isBusy ? "Loading..." : "Edit Draft"}
                            </button>
                          ) : (
                            <span className="purchase-order-locked-label">
                              Locked
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="purchase-order-list-notice">
          <strong>Draft workflow</strong>

          <span>
            Draft Purchase Orders may still be edited. Submission, approval,
            cancellation, receiving, printing, and PDF generation will be added
            in the next Purchase Order phases.
          </span>
        </div>
      </section>
    </main>
  );
}

export default PurchaseOrders;