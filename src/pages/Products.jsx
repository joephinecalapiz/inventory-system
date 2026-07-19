import { useEffect, useMemo, useState } from "react";

import "../styles/Products.css";

import {
  PRODUCT_LIMITS,
  PRODUCT_STATUSES,
  isValidProductStatus,
} from "../constants/products";

import { USER_ROLES } from "../constants/roles";

import {
  inspectProductSafeMigration,
  migrateLegacyProductSafeFields,
  subscribeToProducts,
  updateProductMasterData,
  updateProductStatus,
} from "../services/productService";

const EMPTY_FORM = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  categoryCode: "",
  unitName: "",
  unitAbbreviation: "",
  quantity: "",
  sourceProductId: "",
  description: "",
  costPrice: "",
  sellingPrice: "",
  reorderLevel: "",
  status: PRODUCT_STATUSES.ACTIVE,
};

function getProductStatus(product) {
  return product.status === PRODUCT_STATUSES.INACTIVE
    ? PRODUCT_STATUSES.INACTIVE
    : PRODUCT_STATUSES.ACTIVE;
}

function getProductUnitCode(product) {
  return String(product.unitCode ?? product.unitId ?? "")
    .trim()
    .toUpperCase();
}

function getProductSellingPrice(product) {
  return Number(product.sellingPrice ?? product.price ?? 0);
}

function Products({ currentUserRole }) {
  const canManageProducts = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  const canMigrateLegacyProducts = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
  ].includes(currentUserRole);

  const isReadOnly = currentUserRole === USER_ROLES.AUDITOR;

  const [products, setProducts] = useState([]);

  const [editingProductId, setEditingProductId] = useState(null);

  const [isMigratingProducts, setIsMigratingProducts] = useState(false);

  const [migrationReport, setMigrationReport] = useState(null);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [searchTerm, setSearchTerm] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [unitFilter, setUnitFilter] = useState("ALL");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [busyProductId, setBusyProductId] = useState(null);

  const [loadError, setLoadError] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (firebaseProducts) => {
        setProducts(firebaseProducts);

        setIsLoading(false);
        setLoadError("");
      },

      (error) => {
        console.error("Unable to load products:", error);

        setLoadError(
          error?.message || "Unable to load product records from Firebase.",
        );

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const productSummary = useMemo(() => {
    return {
      total: products.length,

      active: products.filter(
        (product) => getProductStatus(product) === PRODUCT_STATUSES.ACTIVE,
      ).length,

      inactive: products.filter(
        (product) => getProductStatus(product) === PRODUCT_STATUSES.INACTIVE,
      ).length,

      missingCost: products.filter(
        (product) =>
          product.costPrice === null ||
          product.costPrice === undefined ||
          product.costPrice === "",
      ).length,
    };
  }, [products]);

  const migrationSummary = useMemo(() => {
    let safeMigrationCount = 0;
    let blockedMigrationCount = 0;
    let missingSourceCount = 0;

    for (const product of products) {
      const inspection = inspectProductSafeMigration(product);

      if (inspection.needsMigration) {
        if (inspection.canMigrate) {
          safeMigrationCount += 1;
        } else {
          blockedMigrationCount += 1;
        }
      }

      if (!String(product.sourceProductId ?? "").trim()) {
        missingSourceCount += 1;
      }
    }

    return {
      safeMigrationCount,
      blockedMigrationCount,
      missingSourceCount,
    };
  }, [products]);

  const categories = useMemo(() => {
    return [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ].sort((first, second) => String(first).localeCompare(String(second)));
  }, [products]);

  const units = useMemo(() => {
    const unitMap = new Map();

    for (const product of products) {
      const code = getProductUnitCode(product);

      if (!code) {
        continue;
      }

      const name = String(product.unitName ?? code).trim();

      const abbreviation = String(product.unitAbbreviation ?? "").trim();

      unitMap.set(code, {
        code,
        label: abbreviation ? `${name} (${abbreviation})` : name,
      });
    }

    return [...unitMap.values()].sort((firstUnit, secondUnit) =>
      firstUnit.label.localeCompare(secondUnit.label),
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.categoryCode,
        product.unitName,
        product.unitAbbreviation,
        product.sourceProductId,
        product.description,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "ALL" || product.category === categoryFilter;

      const matchesUnit =
        unitFilter === "ALL" || getProductUnitCode(product) === unitFilter;

      const matchesStatus =
        statusFilter === "ALL" || getProductStatus(product) === statusFilter;

      return matchesSearch && matchesCategory && matchesUnit && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, unitFilter, statusFilter]);

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

    clearErrorMessage();
  }

  function startEditing(product) {
    if (!canManageProducts) {
      return;
    }

    setEditingProductId(product.id);

    setForm({
      name: String(product.name ?? ""),

      sku: String(product.sku ?? ""),

      barcode: String(product.barcode ?? ""),

      category: String(product.category ?? ""),

      categoryCode: String(product.categoryCode ?? product.categoryId ?? ""),

      unitName: String(product.unitName ?? ""),

      unitAbbreviation: String(product.unitAbbreviation ?? ""),

      quantity: String(Number(product.quantity ?? 0)),

      sourceProductId: String(product.sourceProductId ?? ""),

      description: String(product.description ?? ""),

      costPrice:
        product.costPrice === null || product.costPrice === undefined
          ? ""
          : String(product.costPrice),

      sellingPrice: String(getProductSellingPrice(product)),

      reorderLevel: String(Number(product.reorderLevel ?? 0)),

      status: getProductStatus(product),
    });

    setMessage({
      type: "",
      text: "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetEditor() {
    setEditingProductId(null);

    setForm({
      ...EMPTY_FORM,
    });
  }

  function cancelEditing() {
    resetEditor();

    setMessage({
      type: "",
      text: "",
    });
  }

  function validateForm() {
    const name = form.name.trim();

    if (name.length < PRODUCT_LIMITS.NAME_MIN_LENGTH) {
      return "The product name must contain at least 2 characters.";
    }

    if (name.length > PRODUCT_LIMITS.NAME_MAX_LENGTH) {
      return "The product name cannot exceed 150 characters.";
    }

    if (form.description.length > PRODUCT_LIMITS.DESCRIPTION_MAX_LENGTH) {
      return "The product description cannot exceed 500 characters.";
    }

    if (form.costPrice !== "") {
      const costPrice = Number(form.costPrice);

      if (
        !Number.isFinite(costPrice) ||
        costPrice < 0 ||
        costPrice > PRODUCT_LIMITS.MAX_MONEY_VALUE
      ) {
        return "Cost price must be a valid non-negative amount.";
      }
    }

    if (form.sellingPrice === "") {
      return "Selling price is required.";
    }

    const sellingPrice = Number(form.sellingPrice);

    if (
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0 ||
      sellingPrice > PRODUCT_LIMITS.MAX_MONEY_VALUE
    ) {
      return "Selling price must be a valid non-negative amount.";
    }

    if (form.reorderLevel === "") {
      return "Reorder level is required.";
    }

    const reorderLevel = Number(form.reorderLevel);

    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
      return "Reorder level must be a non-negative whole number.";
    }

    if (!isValidProductStatus(form.status)) {
      return "Product status must be ACTIVE or INACTIVE.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageProducts) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to update product master records.",
      });

      return;
    }

    if (!editingProductId) {
      setMessage({
        type: "error",
        text: "Select a product to edit.",
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

    try {
      setIsSubmitting(true);

      setMessage({
        type: "",
        text: "",
      });

      await updateProductMasterData(editingProductId, {
        name: form.name.trim(),

        description: form.description.trim(),

        costPrice: form.costPrice === "" ? null : Number(form.costPrice),

        sellingPrice: Number(form.sellingPrice),

        reorderLevel: Number(form.reorderLevel),

        status: form.status,
      });

      setMessage({
        type: "success",
        text: "The product master record was updated successfully.",
      });

      resetEditor();
    } catch (error) {
      console.error("Unable to update product:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to update the product master record.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(product) {
    if (!canManageProducts) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to change product status.",
      });

      return;
    }

    const currentStatus = getProductStatus(product);

    const nextStatus =
      currentStatus === PRODUCT_STATUSES.ACTIVE
        ? PRODUCT_STATUSES.INACTIVE
        : PRODUCT_STATUSES.ACTIVE;

    const actionLabel =
      nextStatus === PRODUCT_STATUSES.ACTIVE ? "activate" : "deactivate";

    const shouldContinue = window.confirm(
      `Are you sure you want to ${actionLabel} "${product.name}"?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setBusyProductId(product.id);

      setMessage({
        type: "",
        text: "",
      });

      await updateProductStatus(product.id, nextStatus);

      if (editingProductId === product.id) {
        setForm((currentForm) => ({
          ...currentForm,
          status: nextStatus,
        }));
      }

      setMessage({
        type: "success",
        text: `${product.name} is now ${nextStatus.toLowerCase()}.`,
      });
    } catch (error) {
      console.error("Unable to change product status:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to update the product status.",
      });
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleSafeMigration() {
    if (!canMigrateLegacyProducts) {
      setMessage({
        type: "error",
        text: "Only a Superadmin or Admin can migrate legacy products.",
      });

      return;
    }

    if (migrationSummary.safeMigrationCount === 0) {
      setMessage({
        type: "success",
        text: "There are no products requiring safe-field migration.",
      });

      return;
    }

    const shouldContinue = window.confirm(
      `Migrate ${migrationSummary.safeMigrationCount} legacy product record(s)? Source product identities will not be changed.`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setIsMigratingProducts(true);
      setMigrationReport(null);

      setMessage({
        type: "",
        text: "",
      });

      const result = await migrateLegacyProductSafeFields(products);

      setMigrationReport(result);

      setMessage({
        type: result.skipped > 0 ? "error" : "success",

        text:
          result.skipped > 0
            ? `${result.migrated} product(s) migrated. ${result.skipped} product(s) require manual review.`
            : `${result.migrated} legacy product record(s) migrated successfully.`,
      });
    } catch (error) {
      console.error("Unable to migrate legacy products:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to migrate the legacy product records.",
      });
    } finally {
      setIsMigratingProducts(false);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("ALL");
    setUnitFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <main className="page products-page">
      <header className="products-page-header">
        <div>
          <p className="section-label">Product master data</p>

          <h2>Product Management</h2>

          <p className="products-page-description">
            Maintain product descriptions, pricing, reorder levels, and product
            availability without changing permanent stock identifiers.
          </p>
        </div>
      </header>

      <section className="products-summary-grid">
        <article className="products-summary-card">
          <span>Total products</span>

          <strong>{productSummary.total}</strong>
        </article>

        <article className="products-summary-card">
          <span>Active products</span>

          <strong>{productSummary.active}</strong>
        </article>

        <article className="products-summary-card">
          <span>Inactive products</span>

          <strong>{productSummary.inactive}</strong>
        </article>

        <article className="products-summary-card">
          <span>Missing cost price</span>

          <strong>{productSummary.missingCost}</strong>
        </article>
      </section>

      {message.text && (
        <div
          className={`products-message products-message-${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      {loadError && (
        <div className="products-message products-message-error" role="alert">
          {loadError}
        </div>
      )}

      {isReadOnly && (
        <div className="products-readonly-notice">
          <strong>Read-only product access</strong>

          <span>
            Your Auditor role can review product master information but cannot
            edit product records or change their status.
          </span>
        </div>
      )}

      {canMigrateLegacyProducts && (
        <section className="products-migration-panel">
          <div className="products-migration-header">
            <div>
              <p className="section-label">Legacy data migration</p>

              <h3>Product Migration</h3>

              <span>
                Add safe Product Master fields and calculate stock-history
                values from permanent stock movement records.
              </span>
            </div>

            <button
              type="button"
              className="products-migration-button"
              onClick={handleSafeMigration}
              disabled={
                isLoading ||
                isMigratingProducts ||
                migrationSummary.safeMigrationCount === 0
              }
            >
              {isMigratingProducts ? "Migrating..." : "Migrate Safe Fields"}
            </button>
          </div>

          <div className="products-migration-counts">
            <article>
              <span>Ready for safe migration</span>

              <strong>{migrationSummary.safeMigrationCount}</strong>
            </article>

            <article>
              <span>Requires manual review</span>

              <strong>{migrationSummary.blockedMigrationCount}</strong>
            </article>

            <article>
              <span>Missing source identity</span>

              <strong>{migrationSummary.missingSourceCount}</strong>
            </article>
          </div>

          <div className="products-migration-note">
            <strong>Safe migration only</strong>

            <span>
              Product source identities are not assigned automatically because
              multiple master-list records may use the same SKU. Manual source
              assignment will be completed in Phase 2C-6B.
            </span>
          </div>

          {migrationReport?.errors?.length > 0 && (
            <div className="products-migration-errors">
              <strong>Products requiring manual review</strong>

              <ul>
                {migrationReport.errors.map((migrationError) => (
                  <li key={migrationError.productId}>
                    <b>{migrationError.productName}</b>:{" "}
                    {migrationError.reasons.join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div
        className={[
          "products-layout",
          !canManageProducts ? "products-layout-readonly" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {canManageProducts && (
          <aside className="product-master-form-card">
            <div className="product-master-card-heading">
              <p className="section-label">Product editor</p>

              <h3>{editingProductId ? "Edit Product" : "Select a Product"}</h3>

              <span>Permanent fields remain read-only.</span>
            </div>

            {!editingProductId ? (
              <div className="products-empty-editor">
                <strong>No product selected</strong>

                <p>
                  Click Edit beside a product record to update its description,
                  pricing, reorder level, or status.
                </p>
              </div>
            ) : (
              <form className="product-master-form" onSubmit={handleSubmit}>
                <label>
                  Product name
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    maxLength={PRODUCT_LIMITS.NAME_MAX_LENGTH}
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <div className="product-master-form-grid">
                  <label>
                    SKU
                    <input type="text" value={form.sku} readOnly />
                  </label>

                  <label>
                    Current stock
                    <input type="text" value={form.quantity} readOnly />
                  </label>
                </div>

                <label>
                  Barcode
                  <input type="text" value={form.barcode} readOnly />
                </label>

                <div className="product-master-form-grid">
                  <label>
                    Category
                    <input type="text" value={form.category} readOnly />
                  </label>

                  <label>
                    Category code
                    <input type="text" value={form.categoryCode} readOnly />
                  </label>
                </div>

                <div className="product-master-form-grid">
                  <label>
                    Unit
                    <input type="text" value={form.unitName} readOnly />
                  </label>

                  <label>
                    Abbreviation
                    <input type="text" value={form.unitAbbreviation} readOnly />
                  </label>
                </div>

                <label>
                  Source product ID
                  <input
                    type="text"
                    value={form.sourceProductId || "Not assigned"}
                    readOnly
                  />
                </label>

                <div className="product-permanent-notice">
                  <strong>Permanent product fields</strong>

                  <span>
                    SKU, barcode, category, unit, source identity, and current
                    stock cannot be changed from this page.
                  </span>
                </div>

                <label>
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    maxLength={PRODUCT_LIMITS.DESCRIPTION_MAX_LENGTH}
                    rows="4"
                    placeholder="Optional product description"
                    disabled={isSubmitting}
                  />
                  <small>
                    {form.description.length}/
                    {PRODUCT_LIMITS.DESCRIPTION_MAX_LENGTH}
                  </small>
                </label>

                <div className="product-master-form-grid">
                  <label>
                    Cost price
                    <input
                      type="number"
                      name="costPrice"
                      value={form.costPrice}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="Optional"
                      disabled={isSubmitting}
                    />
                  </label>

                  <label>
                    Selling price
                    <input
                      type="number"
                      name="sellingPrice"
                      value={form.sellingPrice}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      disabled={isSubmitting}
                      required
                    />
                  </label>
                </div>

                <div className="product-master-form-grid">
                  <label>
                    Reorder level
                    <input
                      type="number"
                      name="reorderLevel"
                      value={form.reorderLevel}
                      onChange={handleChange}
                      min="0"
                      step="1"
                      disabled={isSubmitting}
                      required
                    />
                  </label>

                  <label>
                    Status
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    >
                      <option value={PRODUCT_STATUSES.ACTIVE}>Active</option>

                      <option value={PRODUCT_STATUSES.INACTIVE}>
                        Inactive
                      </option>
                    </select>
                  </label>
                </div>

                <div className="product-master-form-actions">
                  <button
                    type="submit"
                    className="product-master-save-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="product-master-cancel-button"
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </aside>
        )}

        <section className="products-table-card">
          <div className="products-table-heading">
            <div>
              <p className="section-label">Product records</p>

              <h3>Product Master List</h3>
            </div>

            <span className="products-record-count">
              {filteredProducts.length} of {products.length} records
            </span>
          </div>

          <div className="products-filters">
            <label className="products-search-field">
              <span>Search products</span>

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, SKU, barcode, category, unit, or source ID"
              />
            </label>

            <label>
              <span>Category</span>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="ALL">All categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Unit</span>

              <select
                value={unitFilter}
                onChange={(event) => setUnitFilter(event.target.value)}
              >
                <option value="ALL">All units</option>

                {units.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Product status</span>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>

                <option value={PRODUCT_STATUSES.ACTIVE}>Active</option>

                <option value={PRODUCT_STATUSES.INACTIVE}>Inactive</option>
              </select>
            </label>

            <button
              type="button"
              className="products-clear-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          {isLoading ? (
            <div className="products-empty-state">
              <h3>Loading products...</h3>

              <p>Fetching product master records from Firebase.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="products-empty-state">
              <h3>No products found</h3>

              <p>Add a product or change the selected filters.</p>
            </div>
          ) : (
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Barcode</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Cost Price</th>
                    <th>Selling Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Source</th>

                    {canManageProducts && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const productStatus = getProductStatus(product);

                    const isBusy = busyProductId === product.id;

                    const costPriceMissing =
                      product.costPrice === null ||
                      product.costPrice === undefined ||
                      product.costPrice === "";

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="products-product-cell">
                            <strong>{product.name}</strong>

                            <span>
                              {product.description || "No description"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="products-code-cell">
                            <strong>{product.sku}</strong>

                            <span>{product.barcode}</span>
                          </div>
                        </td>

                        <td>
                          <div className="products-code-cell">
                            <strong>{product.category}</strong>

                            <span>{product.categoryCode || "No code"}</span>
                          </div>
                        </td>

                        <td>
                          <div className="products-code-cell">
                            <strong>
                              {product.unitName || "Not assigned"}
                            </strong>

                            <span>{product.unitAbbreviation || "—"}</span>
                          </div>
                        </td>

                        <td>
                          {costPriceMissing ? (
                            <span className="products-missing-value">
                              Not set
                            </span>
                          ) : (
                            formatCurrency(product.costPrice)
                          )}
                        </td>

                        <td>
                          {formatCurrency(getProductSellingPrice(product))}
                        </td>

                        <td>
                          <div className="products-stock-cell">
                            <strong>{Number(product.quantity ?? 0)}</strong>

                            <span>
                              Reorder at {Number(product.reorderLevel ?? 0)}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`products-status products-status-${productStatus.toLowerCase()}`}
                          >
                            {productStatus}
                          </span>
                        </td>

                        <td>
                          <span className="products-source-id">
                            {product.sourceProductId || "Legacy record"}
                          </span>
                        </td>

                        {canManageProducts && (
                          <td>
                            <div className="products-table-actions">
                              <button
                                type="button"
                                className="products-edit-button"
                                onClick={() => startEditing(product)}
                                disabled={isBusy || isSubmitting}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="products-status-button"
                                onClick={() => handleStatusChange(product)}
                                disabled={isBusy || isSubmitting}
                              >
                                {isBusy
                                  ? "Please wait..."
                                  : productStatus === PRODUCT_STATUSES.ACTIVE
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
        </section>
      </div>
    </main>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

export default Products;
