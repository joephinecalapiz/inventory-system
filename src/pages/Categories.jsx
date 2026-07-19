import { useEffect, useMemo, useState } from "react";

import "../styles/Categories.css";

import {
  CATEGORY_STATUSES,
  createCategoryCode,
  isValidBarcodePrefix,
  normalizeCategoryName,
} from "../constants/categories";

import { CATEGORY_SEED_DATA } from "../data/categorySeedData";

import {
  createCategory,
  seedDefaultCategories,
  subscribeToCategories,
  updateCategory,
  updateCategoryStatus,
} from "../services/categoryService";

import { USER_ROLES } from "../constants/roles";

const EMPTY_FORM = {
  name: "",
  barcodePrefix: "",
  description: "",
  status: CATEGORY_STATUSES.ACTIVE,
};

function Categories({ currentUserRole }) {
  const canManageCategories = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
  ].includes(currentUserRole);

  const [categories, setCategories] = useState([]);

  const [isSeeding, setIsSeeding] = useState(false);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [busyCategoryId, setBusyCategoryId] = useState(null);

  const [loadError, setLoadError] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToCategories(
      (firebaseCategories) => {
        setCategories(firebaseCategories);

        setIsLoading(false);
        setLoadError("");
      },

      (error) => {
        console.error("Unable to load categories:", error);

        setLoadError(
          error?.message || "Unable to load categories from Firebase.",
        );

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return categories.filter((category) => {
      const searchableText = [
        category.name,
        category.code,
        category.barcodePrefix,
        category.description,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" || category.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchTerm, statusFilter]);

  const categorySummary = useMemo(
    () => ({
      total: categories.length,

      active: categories.filter(
        (category) => category.status === CATEGORY_STATUSES.ACTIVE,
      ).length,

      inactive: categories.filter(
        (category) => category.status === CATEGORY_STATUSES.INACTIVE,
      ).length,
    }),
    [categories],
  );

  const missingSeedCategories = useMemo(() => {
    const existingCodes = new Set(
      categories.map((category) => category.code ?? category.id),
    );

    return CATEGORY_SEED_DATA.filter((category) => {
      const categoryCode = createCategoryCode(category.name);

      return !existingCodes.has(categoryCode);
    });
  }, [categories]);

  const generatedCode = editingCategoryId
    ? form.code
    : createCategoryCode(form.name);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (message.type === "error") {
      setMessage({
        type: "",
        text: "",
      });
    }
  }

  function resetForm() {
    setEditingCategoryId(null);

    setForm({
      ...EMPTY_FORM,
    });
  }

  function cancelEditing() {
    resetForm();

    setMessage({
      type: "",
      text: "",
    });
  }

  function startEditing(category) {
    if (!canManageCategories) {
      return;
    }

    setEditingCategoryId(category.id);

    setForm({
      name: category.name ?? "",
      code: category.code ?? category.id,
      barcodePrefix: category.barcodePrefix ?? "",
      description: category.description ?? "",
      status: category.status ?? CATEGORY_STATUSES.ACTIVE,
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

  function categoryNameExists(categoryName, excludedCategoryId = null) {
    const normalizedName = normalizeCategoryName(categoryName);

    return categories.some(
      (category) =>
        category.id !== excludedCategoryId &&
        normalizeCategoryName(category.name) === normalizedName,
    );
  }

  function barcodePrefixExists(barcodePrefix) {
    return categories.some(
      (category) => category.barcodePrefix === barcodePrefix,
    );
  }

  function validateForm() {
    const normalizedName = normalizeCategoryName(form.name);

    if (normalizedName.length < 2) {
      return "The category name must contain at least 2 characters.";
    }

    if (categoryNameExists(normalizedName, editingCategoryId)) {
      return `The category "${normalizedName}" already exists.`;
    }

    if (!editingCategoryId) {
      if (!isValidBarcodePrefix(form.barcodePrefix)) {
        return "The barcode prefix must contain exactly two digits.";
      }

      if (barcodePrefixExists(form.barcodePrefix)) {
        return `Barcode prefix ${form.barcodePrefix} is already being used.`;
      }
    }

    if (String(form.description ?? "").length > 500) {
      return "The description cannot exceed 500 characters.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageCategories) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to manage categories.",
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

      if (editingCategoryId) {
        await updateCategory(editingCategoryId, {
          name: form.name,
          description: form.description,
          status: form.status,
        });

        setMessage({
          type: "success",
          text: "The category was updated successfully.",
        });
      } else {
        await createCategory({
          name: form.name,
          barcodePrefix: form.barcodePrefix,
          description: form.description,
        });

        setMessage({
          type: "success",
          text: "The category was created successfully.",
        });
      }

      resetForm();
    } catch (error) {
      console.error("Unable to save category:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to save the category.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(category) {
    if (!canManageCategories) {
      return;
    }

    const nextStatus =
      category.status === CATEGORY_STATUSES.ACTIVE
        ? CATEGORY_STATUSES.INACTIVE
        : CATEGORY_STATUSES.ACTIVE;

    const actionLabel =
      nextStatus === CATEGORY_STATUSES.ACTIVE ? "activate" : "deactivate";

    const shouldContinue = window.confirm(
      `Are you sure you want to ${actionLabel} "${category.name}"?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setBusyCategoryId(category.id);

      setMessage({
        type: "",
        text: "",
      });

      await updateCategoryStatus(category.id, nextStatus);

      if (editingCategoryId === category.id) {
        setForm((currentForm) => ({
          ...currentForm,
          status: nextStatus,
        }));
      }

      setMessage({
        type: "success",
        text: `${category.name} is now ${nextStatus.toLowerCase()}.`,
      });
    } catch (error) {
      console.error("Unable to change category status:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to update the category status.",
      });
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function handleSeedCategories() {
    if (!canManageCategories) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to import categories.",
      });

      return;
    }

    const missingCount = missingSeedCategories.length;

    if (missingCount === 0) {
      setMessage({
        type: "success",
        text: "All default categories have already been imported.",
      });

      return;
    }

    const shouldContinue = window.confirm(
      `Import ${missingCount} existing category record(s) into Firestore?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setIsSeeding(true);

      setMessage({
        type: "",
        text: "",
      });

      const result = await seedDefaultCategories();

      console.table(result.results);

      if (result.failedCount > 0) {
        setMessage({
          type: "error",
          text: `${result.createdCount} category record(s) were imported, ${result.skippedCount} were skipped, and ${result.failedCount} failed. Check the browser console for details.`,
        });

        return;
      }

      setMessage({
        type: "success",
        text: `${result.createdCount} category record(s) were imported successfully. ${result.skippedCount} existing record(s) were skipped.`,
      });
    } catch (error) {
      console.error("Unable to import categories:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to import the existing categories.",
      });
    } finally {
      setIsSeeding(false);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
  }

  return (
    <main className="page categories-page">
      <header className="categories-page-header">
        <div>
          <p className="section-label">Master data</p>

          <h2>Category Management</h2>

          <p className="categories-description">
            Manage the product categories and permanent barcode prefixes used by
            the inventory system.
          </p>
        </div>

        {canManageCategories && missingSeedCategories.length > 0 && (
          <button
            type="button"
            className="category-seed-button"
            onClick={handleSeedCategories}
            disabled={isSeeding || isSubmitting}
          >
            {isSeeding
              ? "Importing Categories..."
              : `Import ${missingSeedCategories.length} Existing Categories`}
          </button>
        )}
      </header>

      <section className="categories-summary-grid">
        <article className="categories-summary-card">
          <span>Total categories</span>

          <strong>{categorySummary.total}</strong>
        </article>

        <article className="categories-summary-card">
          <span>Active categories</span>

          <strong>{categorySummary.active}</strong>
        </article>

        <article className="categories-summary-card">
          <span>Inactive categories</span>

          <strong>{categorySummary.inactive}</strong>
        </article>
      </section>

      {!canManageCategories && (
        <div className="categories-readonly-notice">
          <strong>Read-only category access</strong>

          <span>
            Your role can review category records but cannot create, edit, or
            change their status.
          </span>
        </div>
      )}

      <div
        className={[
          "categories-layout",
          !canManageCategories ? "categories-layout-readonly" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {canManageCategories && (
          <aside className="category-form-card">
            <div className="category-card-heading">
              <p className="section-label">
                {editingCategoryId ? "Update record" : "New record"}
              </p>

              <h3>{editingCategoryId ? "Edit Category" : "Create Category"}</h3>

              <span>
                Category codes and barcode prefixes become permanent after
                creation.
              </span>
            </div>

            {message.text && (
              <div
                className={`category-message category-message-${message.type}`}
                role={message.type === "error" ? "alert" : "status"}
              >
                {message.text}
              </div>
            )}

            <form className="category-form" onSubmit={handleSubmit}>
              <label>
                Category name
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength="100"
                  placeholder="Example: Water Meters"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                Category code
                <input
                  type="text"
                  value={generatedCode}
                  placeholder="Generated automatically"
                  readOnly
                />
              </label>

              <label>
                Barcode prefix
                <input
                  type="text"
                  name="barcodePrefix"
                  value={form.barcodePrefix}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength="2"
                  placeholder="Example: 10"
                  readOnly={Boolean(editingCategoryId)}
                  disabled={isSubmitting}
                  required
                />
              </label>

              {editingCategoryId && (
                <div className="category-permanent-notice">
                  <strong>Permanent fields</strong>

                  <span>
                    The category code and barcode prefix cannot be changed
                    because existing product barcodes may depend on them.
                  </span>
                </div>
              )}

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  maxLength="500"
                  rows="4"
                  placeholder="Optional category description"
                  disabled={isSubmitting}
                />
              </label>

              {editingCategoryId && (
                <label>
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  >
                    <option value={CATEGORY_STATUSES.ACTIVE}>Active</option>

                    <option value={CATEGORY_STATUSES.INACTIVE}>Inactive</option>
                  </select>
                </label>
              )}

              <div className="category-form-actions">
                <button
                  type="submit"
                  className="category-primary-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingCategoryId
                      ? "Save Changes"
                      : "Create Category"}
                </button>

                {editingCategoryId && (
                  <button
                    type="button"
                    className="category-secondary-button"
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </aside>
        )}

        <section className="category-table-card">
          <div className="category-table-heading">
            <div>
              <p className="section-label">Category records</p>

              <h3>Categories</h3>
            </div>

            <span className="record-count">
              {filteredCategories.length} of {categories.length} records
            </span>
          </div>

          {canManageCategories && message.text && (
            <div
              className={`category-mobile-message category-message category-message-${message.type}`}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </div>
          )}

          {loadError && (
            <div
              className="category-message category-message-error"
              role="alert"
            >
              {loadError}
            </div>
          )}

          <div className="category-filters">
            <label>
              <span>Search categories</span>

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, code, prefix, or description"
              />
            </label>

            <label>
              <span>Status</span>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>

                <option value={CATEGORY_STATUSES.ACTIVE}>Active</option>

                <option value={CATEGORY_STATUSES.INACTIVE}>Inactive</option>
              </select>
            </label>

            <button
              type="button"
              className="category-clear-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          {isLoading ? (
            <div className="category-empty-state">
              <h3>Loading categories...</h3>

              <p>Fetching category records from Firebase.</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="category-empty-state">
              <h3>No categories found</h3>

              <p>Create the first category or change the selected filters.</p>
            </div>
          ) : (
            <div className="category-table-wrapper">
              <table className="category-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Code</th>
                    <th>Barcode Prefix</th>
                    <th>Description</th>
                    <th>Status</th>

                    {canManageCategories && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredCategories.map((category) => {
                    const isBusy = busyCategoryId === category.id;

                    return (
                      <tr key={category.id}>
                        <td>
                          <strong>{category.name}</strong>
                        </td>

                        <td>
                          <code>{category.code}</code>
                        </td>

                        <td>
                          <span className="category-prefix">
                            {category.barcodePrefix}
                          </span>
                        </td>

                        <td>
                          <span className="category-description-cell">
                            {category.description || "No description"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`category-status category-status-${String(
                              category.status,
                            ).toLowerCase()}`}
                          >
                            {category.status}
                          </span>
                        </td>

                        {canManageCategories && (
                          <td>
                            <div className="category-table-actions">
                              <button
                                type="button"
                                className="category-edit-button"
                                onClick={() => startEditing(category)}
                                disabled={isBusy || isSubmitting}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="category-status-button"
                                onClick={() => handleStatusChange(category)}
                                disabled={isBusy || isSubmitting}
                              >
                                {isBusy
                                  ? "Please wait..."
                                  : category.status === CATEGORY_STATUSES.ACTIVE
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

export default Categories;
