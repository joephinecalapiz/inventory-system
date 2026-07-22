import { useEffect, useMemo, useState } from "react";

import "../styles/Suppliers.css";

import { USER_ROLES } from "../constants/roles";

import {
  SUPPLIER_LIMITS,
  SUPPLIER_PAYMENT_TERMS,
  SUPPLIER_PAYMENT_TERM_LABELS,
  SUPPLIER_PAYMENT_TERM_OPTIONS,
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABELS,
  createEmptySupplierForm,
  isValidCustomPaymentTerms,
  isValidSupplierAddress,
  isValidSupplierContactNumber,
  isValidSupplierContactPerson,
  isValidSupplierEmail,
  isValidSupplierName,
  isValidSupplierNotes,
  isValidSupplierPaymentTerm,
  isValidSupplierTin,
} from "../constants/suppliers";

import {
  createSupplier,
  subscribeToSuppliers,
  updateSupplierMasterData,
  updateSupplierStatus,
} from "../services/supplierService";

const ALL_FILTER = "ALL";

function getSupplierStatus(supplier) {
  return supplier?.status ?? SUPPLIER_STATUSES.ACTIVE;
}

function getPaymentTermLabel(supplier) {
  const paymentTerm = supplier?.paymentTerm;

  if (paymentTerm === SUPPLIER_PAYMENT_TERMS.CUSTOM) {
    return supplier.customPaymentTerms || "Custom Terms";
  }

  return (
    SUPPLIER_PAYMENT_TERM_LABELS[paymentTerm] || paymentTerm || "Not specified"
  );
}

function getPurchaseHistoryLabel(supplier) {
  const purchaseOrderCount = Number(supplier?.purchaseOrderCount ?? 0);

  if (!supplier?.hasPurchaseHistory && purchaseOrderCount === 0) {
    return "No purchase orders";
  }

  return `${purchaseOrderCount} purchase order${
    purchaseOrderCount === 1 ? "" : "s"
  }`;
}

function Suppliers({ currentUserRole }) {
  const canManageSuppliers = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN].includes(
    currentUserRole,
  );

  const isReadOnly =
    currentUserRole === USER_ROLES.INVENTORY_STAFF ||
    currentUserRole === USER_ROLES.AUDITOR;

  const [suppliers, setSuppliers] = useState([]);

  const [form, setForm] = useState(() => createEmptySupplierForm());

  const [editingSupplierId, setEditingSupplierId] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);

  const [paymentTermFilter, setPaymentTermFilter] = useState(ALL_FILTER);

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [busySupplierId, setBusySupplierId] = useState("");

  const [loadError, setLoadError] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToSuppliers(
      (firebaseSuppliers) => {
        setSuppliers(firebaseSuppliers);

        setLoadError("");
        setIsLoading(false);
      },

      (error) => {
        console.error("Unable to load suppliers:", error);

        setLoadError(error?.message || "Unable to load supplier records.");

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const supplierSummary = useMemo(() => {
    const activeCount = suppliers.filter(
      (supplier) => getSupplierStatus(supplier) === SUPPLIER_STATUSES.ACTIVE,
    ).length;

    const inactiveCount = suppliers.filter(
      (supplier) => getSupplierStatus(supplier) === SUPPLIER_STATUSES.INACTIVE,
    ).length;

    const withPurchaseHistory = suppliers.filter(
      (supplier) =>
        supplier.hasPurchaseHistory ||
        Number(supplier.purchaseOrderCount ?? 0) > 0,
    ).length;

    return {
      total: suppliers.length,

      active: activeCount,

      inactive: inactiveCount,

      withPurchaseHistory,
    };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const status = getSupplierStatus(supplier);

      const paymentTerm = supplier.paymentTerm ?? "";

      const searchableText = [
        supplier.supplierCode,
        supplier.name,
        supplier.contactPerson,
        supplier.contactNumber,
        supplier.email,
        supplier.address,
        supplier.tin,
        supplier.paymentTerm,
        supplier.customPaymentTerms,
        getPaymentTermLabel(supplier),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER || status === statusFilter;

      const matchesPaymentTerm =
        paymentTermFilter === ALL_FILTER || paymentTerm === paymentTermFilter;

      return matchesSearch && matchesStatus && matchesPaymentTerm;
    });
  }, [suppliers, searchTerm, statusFilter, paymentTermFilter]);

  const editingSupplier = useMemo(() => {
    return (
      suppliers.find((supplier) => supplier.id === editingSupplierId) ?? null
    );
  }, [suppliers, editingSupplierId]);

  function clearMessage() {
    setMessage({
      type: "",
      text: "",
    });
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      };

      if (name === "paymentTerm" && value !== SUPPLIER_PAYMENT_TERMS.CUSTOM) {
        nextForm.customPaymentTerms = "";
      }

      return nextForm;
    });

    if (message.type === "error") {
      clearMessage();
    }
  }

  function validateForm() {
    if (!isValidSupplierName(form.name)) {
      return `Supplier name must contain ${SUPPLIER_LIMITS.NAME_MIN_LENGTH} to ${SUPPLIER_LIMITS.NAME_MAX_LENGTH} characters.`;
    }

    if (!isValidSupplierContactPerson(form.contactPerson)) {
      return `Contact person cannot exceed ${SUPPLIER_LIMITS.CONTACT_PERSON_MAX_LENGTH} characters.`;
    }

    if (!isValidSupplierContactNumber(form.contactNumber)) {
      return "Enter a valid contact number using numbers, spaces, parentheses, periods, plus signs, or hyphens.";
    }

    if (!isValidSupplierEmail(form.email)) {
      return "Enter a valid supplier email address.";
    }

    if (!isValidSupplierAddress(form.address)) {
      return `Supplier address cannot exceed ${SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH} characters.`;
    }

    if (!isValidSupplierTin(form.tin)) {
      return "Enter a valid TIN using letters, numbers, spaces, or hyphens.";
    }

    if (!isValidSupplierPaymentTerm(form.paymentTerm)) {
      return "Select a valid payment term.";
    }

    if (!isValidCustomPaymentTerms(form.customPaymentTerms, form.paymentTerm)) {
      return form.paymentTerm === SUPPLIER_PAYMENT_TERMS.CUSTOM
        ? `Custom payment terms are required and cannot exceed ${SUPPLIER_LIMITS.CUSTOM_PAYMENT_TERMS_MAX_LENGTH} characters.`
        : "Remove the custom payment terms or select Custom Terms.";
    }

    if (!isValidSupplierNotes(form.notes)) {
      return `Supplier notes cannot exceed ${SUPPLIER_LIMITS.NOTES_MAX_LENGTH} characters.`;
    }

    return "";
  }

  function resetForm() {
    setForm(createEmptySupplierForm());

    setEditingSupplierId("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageSuppliers) {
      setMessage({
        type: "error",
        text: "Your role has read-only access to supplier records.",
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

    const actionLabel = editingSupplierId ? "update" : "create";

    const shouldContinue = window.confirm(
      editingSupplierId
        ? `Update supplier "${form.name}"?`
        : `Create supplier "${form.name}"?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setIsSaving(true);
      clearMessage();

      if (editingSupplierId) {
        const result = await updateSupplierMasterData(editingSupplierId, form);

        setMessage({
          type: "success",
          text: `${result.name} was updated successfully.`,
        });
      } else {
        const result = await createSupplier(form);

        setMessage({
          type: "success",
          text: `${result.name} was created with supplier code ${result.supplierCode}.`,
        });
      }

      resetForm();
    } catch (error) {
      console.error(`Unable to ${actionLabel} supplier:`, error);

      setMessage({
        type: "error",
        text: error?.message || `Unable to ${actionLabel} the supplier.`,
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditSupplier(supplier) {
    if (!canManageSuppliers) {
      setMessage({
        type: "error",
        text: "Your role has read-only access to supplier records.",
      });

      return;
    }

    setEditingSupplierId(supplier.id);

    setForm({
      name: supplier.name ?? "",

      contactPerson: supplier.contactPerson ?? "",

      contactNumber: supplier.contactNumber ?? "",

      email: supplier.email ?? "",

      address: supplier.address ?? "",

      tin: supplier.tin ?? "",

      paymentTerm:
        supplier.paymentTerm ?? SUPPLIER_PAYMENT_TERMS.CASH_ON_DELIVERY,

      customPaymentTerms: supplier.customPaymentTerms ?? "",

      notes: supplier.notes ?? "",
    });

    clearMessage();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleCancelEdit() {
    if (
      form.name ||
      form.contactPerson ||
      form.contactNumber ||
      form.email ||
      form.address ||
      form.tin ||
      form.customPaymentTerms ||
      form.notes
    ) {
      const shouldCancel = window.confirm(
        "Discard the current supplier form changes?",
      );

      if (!shouldCancel) {
        return;
      }
    }

    resetForm();
    clearMessage();
  }

  async function handleStatusChange(supplier) {
    if (!canManageSuppliers) {
      setMessage({
        type: "error",
        text: "Your role has read-only access to supplier records.",
      });

      return;
    }

    const currentStatus = getSupplierStatus(supplier);

    const nextStatus =
      currentStatus === SUPPLIER_STATUSES.ACTIVE
        ? SUPPLIER_STATUSES.INACTIVE
        : SUPPLIER_STATUSES.ACTIVE;

    const actionLabel =
      nextStatus === SUPPLIER_STATUSES.ACTIVE ? "activate" : "deactivate";

    const shouldContinue = window.confirm(
      `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(
        1,
      )} supplier "${supplier.name}"?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setBusySupplierId(supplier.id);

      clearMessage();

      await updateSupplierStatus(supplier.id, nextStatus);

      setMessage({
        type: "success",
        text: `${supplier.name} was ${actionLabel}d successfully.`,
      });

      if (
        editingSupplierId === supplier.id &&
        nextStatus === SUPPLIER_STATUSES.INACTIVE
      ) {
        resetForm();
      }
    } catch (error) {
      console.error("Unable to update supplier status:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to update the supplier status.",
      });
    } finally {
      setBusySupplierId("");
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter(ALL_FILTER);
    setPaymentTermFilter(ALL_FILTER);
  }

  return (
    <main className="page suppliers-page">
      <header className="suppliers-page-header">
        <div>
          <p className="section-label">Procurement master data</p>

          <h2>Supplier Management</h2>

          <p>
            Maintain supplier contact information, payment terms, status, and
            purchasing history.
          </p>
        </div>
      </header>

      {isReadOnly && (
        <div className="suppliers-readonly-notice">
          <strong>Read-only supplier access</strong>

          <span>
            Your role can review supplier records, but it cannot create, edit,
            activate, or deactivate suppliers.
          </span>
        </div>
      )}

      {message.text && (
        <div
          className={`suppliers-message suppliers-message-${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      {loadError && (
        <div className="suppliers-message suppliers-message-error" role="alert">
          {loadError}
        </div>
      )}

      <section className="suppliers-summary">
        <article>
          <span>Total suppliers</span>

          <strong>{supplierSummary.total}</strong>
        </article>

        <article>
          <span>Active suppliers</span>

          <strong>{supplierSummary.active}</strong>
        </article>

        <article>
          <span>Inactive suppliers</span>

          <strong>{supplierSummary.inactive}</strong>
        </article>

        <article>
          <span>With purchase history</span>

          <strong>{supplierSummary.withPurchaseHistory}</strong>
        </article>
      </section>

      <div
        className={`suppliers-layout ${
          canManageSuppliers ? "" : "suppliers-layout-readonly"
        }`}
      >
        {canManageSuppliers && (
          <section className="supplier-form-card">
            <div className="supplier-card-heading">
              <div>
                <p className="section-label">
                  {editingSupplierId ? "Edit supplier" : "New supplier"}
                </p>

                <h3>
                  {editingSupplierId
                    ? editingSupplier?.supplierCode || "Update Supplier"
                    : "Supplier Information"}
                </h3>
              </div>

              {editingSupplierId && (
                <span className="supplier-editing-badge">Editing</span>
              )}
            </div>

            <form className="supplier-form" onSubmit={handleSubmit}>
              <label>
                Supplier name *
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleInputChange}
                  minLength={SUPPLIER_LIMITS.NAME_MIN_LENGTH}
                  maxLength={SUPPLIER_LIMITS.NAME_MAX_LENGTH}
                  placeholder="Enter supplier or company name"
                  disabled={isSaving}
                  required
                />
              </label>

              <div className="supplier-form-grid">
                <label>
                  Contact person
                  <input
                    type="text"
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={handleInputChange}
                    maxLength={SUPPLIER_LIMITS.CONTACT_PERSON_MAX_LENGTH}
                    placeholder="Full name"
                    disabled={isSaving}
                  />
                </label>

                <label>
                  Contact number
                  <input
                    type="text"
                    name="contactNumber"
                    value={form.contactNumber}
                    onChange={handleInputChange}
                    maxLength={SUPPLIER_LIMITS.CONTACT_NUMBER_MAX_LENGTH}
                    placeholder="Mobile or landline"
                    disabled={isSaving}
                  />
                </label>
              </div>

              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  maxLength={SUPPLIER_LIMITS.EMAIL_MAX_LENGTH}
                  placeholder="supplier@example.com"
                  disabled={isSaving}
                />
              </label>

              <label>
                Business address
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleInputChange}
                  maxLength={SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH}
                  rows="3"
                  placeholder="Complete business address"
                  disabled={isSaving}
                />
                <small>
                  {form.address.length}/{SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH}
                </small>
              </label>

              <label>
                TIN
                <input
                  type="text"
                  name="tin"
                  value={form.tin}
                  onChange={handleInputChange}
                  maxLength={SUPPLIER_LIMITS.TIN_MAX_LENGTH}
                  placeholder="000-000-000-000"
                  disabled={isSaving}
                />
              </label>

              <label>
                Payment terms *
                <select
                  name="paymentTerm"
                  value={form.paymentTerm}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  required
                >
                  {SUPPLIER_PAYMENT_TERM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.paymentTerm === SUPPLIER_PAYMENT_TERMS.CUSTOM && (
                <label>
                  Custom payment terms *
                  <input
                    type="text"
                    name="customPaymentTerms"
                    value={form.customPaymentTerms}
                    onChange={handleInputChange}
                    maxLength={SUPPLIER_LIMITS.CUSTOM_PAYMENT_TERMS_MAX_LENGTH}
                    placeholder="Example: 50% down payment, balance upon delivery"
                    disabled={isSaving}
                    required
                  />
                </label>
              )}

              <label>
                Notes
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleInputChange}
                  maxLength={SUPPLIER_LIMITS.NOTES_MAX_LENGTH}
                  rows="4"
                  placeholder="Optional supplier notes"
                  disabled={isSaving}
                />
                <small>
                  {form.notes.length}/{SUPPLIER_LIMITS.NOTES_MAX_LENGTH}
                </small>
              </label>

              <div className="supplier-form-actions">
                <button
                  type="submit"
                  className="supplier-save-button"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingSupplierId
                      ? "Update Supplier"
                      : "Create Supplier"}
                </button>

                <button
                  type="button"
                  className="supplier-cancel-button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  {editingSupplierId ? "Cancel Edit" : "Clear Form"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="supplier-list-card">
          <div className="supplier-list-heading">
            <div>
              <p className="section-label">Supplier records</p>

              <h3>Supplier Directory</h3>
            </div>

            <span className="supplier-record-count">
              {filteredSuppliers.length} of {suppliers.length}
            </span>
          </div>

          <div className="supplier-filters">
            <label className="supplier-search-field">
              <span>Search suppliers</span>

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search code, name, contact, email, TIN, or address"
              />
            </label>

            <label>
              <span>Status</span>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value={ALL_FILTER}>All statuses</option>

                <option value={SUPPLIER_STATUSES.ACTIVE}>Active</option>

                <option value={SUPPLIER_STATUSES.INACTIVE}>Inactive</option>
              </select>
            </label>

            <label>
              <span>Payment terms</span>

              <select
                value={paymentTermFilter}
                onChange={(event) => setPaymentTermFilter(event.target.value)}
              >
                <option value={ALL_FILTER}>All payment terms</option>

                {SUPPLIER_PAYMENT_TERM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="supplier-clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          {isLoading ? (
            <div className="supplier-empty-state">
              <strong>Loading suppliers...</strong>

              <p>Fetching supplier master records from Firebase.</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="supplier-empty-state">
              <strong>No suppliers found</strong>

              <p>Create a supplier or change the selected filters.</p>
            </div>
          ) : (
            <div className="supplier-table-wrapper">
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th>Address</th>
                    <th>TIN</th>
                    <th>Payment Terms</th>
                    <th>Purchase History</th>
                    <th>Status</th>

                    {canManageSuppliers && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.map((supplier) => {
                    const status = getSupplierStatus(supplier);

                    const isBusy = busySupplierId === supplier.id;

                    return (
                      <tr key={supplier.id}>
                        <td>
                          <div className="supplier-name-cell">
                            <strong>{supplier.name}</strong>

                            <span>
                              {supplier.supplierCode || "Code unavailable"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="supplier-contact-cell">
                            <strong>
                              {supplier.contactPerson || "No contact person"}
                            </strong>

                            <span>
                              {supplier.contactNumber || "No contact number"}
                            </span>

                            <span>{supplier.email || "No email address"}</span>
                          </div>
                        </td>

                        <td>
                          <span className="supplier-address-cell">
                            {supplier.address || "No address"}
                          </span>
                        </td>

                        <td>{supplier.tin || "Not provided"}</td>

                        <td>
                          <span className="supplier-payment-badge">
                            {getPaymentTermLabel(supplier)}
                          </span>
                        </td>

                        <td>{getPurchaseHistoryLabel(supplier)}</td>

                        <td>
                          <span
                            className={`supplier-status-badge ${
                              status === SUPPLIER_STATUSES.ACTIVE
                                ? "supplier-status-active"
                                : "supplier-status-inactive"
                            }`}
                          >
                            {SUPPLIER_STATUS_LABELS[status]}
                          </span>
                        </td>

                        {canManageSuppliers && (
                          <td>
                            <div className="supplier-table-actions">
                              <button
                                type="button"
                                className="supplier-edit-button"
                                onClick={() => handleEditSupplier(supplier)}
                                disabled={isBusy || isSaving}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className={
                                  status === SUPPLIER_STATUSES.ACTIVE
                                    ? "supplier-deactivate-button"
                                    : "supplier-activate-button"
                                }
                                onClick={() => handleStatusChange(supplier)}
                                disabled={isBusy || isSaving}
                              >
                                {isBusy
                                  ? "Updating..."
                                  : status === SUPPLIER_STATUSES.ACTIVE
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="supplier-history-notice">
            <strong>Supplier records are permanent</strong>

            <span>
              Suppliers are activated or deactivated instead of deleted so
              Purchase Orders and Goods Receipts retain valid historical
              references.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Suppliers;
