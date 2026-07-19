import { useEffect, useMemo, useState } from "react";

import "../styles/Units.css";

import {
  UNIT_OPTIONS,
  UNIT_STATUSES,
  normalizeUnitName,
} from "../constants/units";

import {
  createUnit,
  seedDefaultUnits,
  subscribeToUnits,
  updateUnit,
  updateUnitStatus,
} from "../services/unitService";

import { USER_ROLES } from "../constants/roles";

const EMPTY_FORM = {
  selectedUnitCode: "",
  name: "",
  abbreviation: "",
  description: "",
  status: UNIT_STATUSES.ACTIVE,
};

function Units({ currentUserRole }) {
  const canManageUnits = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN].includes(
    currentUserRole,
  );

  const [units, setUnits] = useState([]);

  const [isSeeding, setIsSeeding] = useState(false);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [editingUnitId, setEditingUnitId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [busyUnitId, setBusyUnitId] = useState(null);

  const [loadError, setLoadError] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeToUnits(
      (firebaseUnits) => {
        setUnits(firebaseUnits);
        setIsLoading(false);
        setLoadError("");
      },

      (error) => {
        console.error("Unable to load units:", error);

        setLoadError(
          error?.message ||
            "Unable to load units of measurement from Firebase.",
        );

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const filteredUnits = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return units.filter((unit) => {
      const searchableText = [
        unit.name,
        unit.code,
        unit.abbreviation,
        unit.description,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" || unit.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [units, searchTerm, statusFilter]);

  const unitSummary = useMemo(
    () => ({
      total: units.length,

      active: units.filter((unit) => unit.status === UNIT_STATUSES.ACTIVE)
        .length,

      inactive: units.filter((unit) => unit.status === UNIT_STATUSES.INACTIVE)
        .length,
    }),
    [units],
  );

  const missingDefaultUnits = useMemo(() => {
    const existingUnitCodes = new Set(
      units.map((unit) => unit.code ?? unit.id),
    );

    return UNIT_OPTIONS.filter(
      (unitOption) => !existingUnitCodes.has(unitOption.code),
    );
  }, [units]);

  const generatedCode = editingUnitId ? form.code : form.selectedUnitCode;

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

  function handleUnitOptionChange(event) {
    const selectedUnitCode = event.target.value;

    const selectedUnit = UNIT_OPTIONS.find(
      (unit) => unit.code === selectedUnitCode,
    );

    if (!selectedUnit) {
      setForm((currentForm) => ({
        ...currentForm,
        selectedUnitCode: "",
        name: "",
        abbreviation: "",
      }));

      clearErrorMessage();
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,

      selectedUnitCode: selectedUnit.code,

      name: selectedUnit.name,

      abbreviation: selectedUnit.abbreviation,
    }));

    clearErrorMessage();
  }

  function resetForm() {
    setEditingUnitId(null);

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

  function startEditing(unit) {
    if (!canManageUnits) {
      return;
    }

    setEditingUnitId(unit.id);

    setForm({
      selectedUnitCode: unit.code ?? unit.id,
      name: unit.name ?? "",
      code: unit.code ?? unit.id,
      abbreviation: unit.abbreviation ?? "",
      description: unit.description ?? "",
      status: unit.status ?? UNIT_STATUSES.ACTIVE,
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

  function unitNameExists(unitName, excludedUnitId = null) {
    const normalizedName = normalizeUnitName(unitName).toLowerCase();

    return units.some(
      (unit) =>
        unit.id !== excludedUnitId &&
        normalizeUnitName(unit.name).toLowerCase() === normalizedName,
    );
  }

  function abbreviationExists(abbreviation) {
    return units.some(
      (unit) =>
        String(unit.abbreviation ?? "").toUpperCase() ===
        String(abbreviation ?? "").toUpperCase(),
    );
  }

  function validateForm() {
    const normalizedName = normalizeUnitName(form.name);

    if (normalizedName.length < 2) {
      return "The unit name must contain at least 2 characters.";
    }

    if (normalizedName.length > 100) {
      return "The unit name cannot exceed 100 characters.";
    }

    if (unitNameExists(normalizedName, editingUnitId)) {
      return `The unit "${normalizedName}" already exists.`;
    }

    if (!editingUnitId) {
      const selectedUnit = UNIT_OPTIONS.find(
        (unit) => unit.code === form.selectedUnitCode,
      );

      if (!selectedUnit) {
        return "Please select a unit of measurement.";
      }

      if (
        form.name !== selectedUnit.name ||
        form.abbreviation !== selectedUnit.abbreviation
      ) {
        return "The selected unit information is invalid.";
      }

      if (abbreviationExists(selectedUnit.abbreviation)) {
        return `The abbreviation ${selectedUnit.abbreviation} is already being used.`;
      }
    }

    if (String(form.description ?? "").length > 500) {
      return "The description cannot exceed 500 characters.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageUnits) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to manage units of measurement.",
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

      if (editingUnitId) {
        await updateUnit(editingUnitId, {
          name: form.name,

          description: form.description,

          status: form.status,
        });

        setMessage({
          type: "success",
          text: "The unit of measurement was updated successfully.",
        });
      } else {
        await createUnit({
          name: form.name,

          abbreviation: form.abbreviation,

          description: form.description,
        });

        setMessage({
          type: "success",
          text: "The unit of measurement was created successfully.",
        });
      }

      resetForm();
    } catch (error) {
      console.error("Unable to save unit:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to save the unit of measurement.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(unit) {
    if (!canManageUnits) {
      return;
    }

    const nextStatus =
      unit.status === UNIT_STATUSES.ACTIVE
        ? UNIT_STATUSES.INACTIVE
        : UNIT_STATUSES.ACTIVE;

    const actionLabel =
      nextStatus === UNIT_STATUSES.ACTIVE ? "activate" : "deactivate";

    const shouldContinue = window.confirm(
      `Are you sure you want to ${actionLabel} "${unit.name}"?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setBusyUnitId(unit.id);

      setMessage({
        type: "",
        text: "",
      });

      await updateUnitStatus(unit.id, nextStatus);

      if (editingUnitId === unit.id) {
        setForm((currentForm) => ({
          ...currentForm,
          status: nextStatus,
        }));
      }

      setMessage({
        type: "success",
        text: `${unit.name} is now ${nextStatus.toLowerCase()}.`,
      });
    } catch (error) {
      console.error("Unable to change unit status:", error);

      setMessage({
        type: "error",
        text: error?.message || "Unable to update the unit status.",
      });
    } finally {
      setBusyUnitId(null);
    }
  }

  async function handleSeedUnits() {
    if (!canManageUnits) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to import units of measurement.",
      });

      return;
    }

    const missingCount = missingDefaultUnits.length;

    if (missingCount === 0) {
      setMessage({
        type: "success",
        text: "All default units have already been imported.",
      });

      return;
    }

    const shouldContinue = window.confirm(
      `Import ${missingCount} default unit record(s) into Firestore?`,
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

      const result = await seedDefaultUnits();

      console.table(result.results);

      if (result.failedCount > 0) {
        setMessage({
          type: "error",
          text: `${result.createdCount} unit record(s) were imported, ${result.skippedCount} were skipped, and ${result.failedCount} failed. Check the browser console for details.`,
        });

        return;
      }

      setMessage({
        type: "success",
        text: `${result.createdCount} unit record(s) were imported successfully. ${result.skippedCount} existing record(s) were skipped.`,
      });
    } catch (error) {
      console.error("Unable to import default units:", error);

      setMessage({
        type: "error",
        text:
          error?.message ||
          "Unable to import the default units of measurement.",
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
    <main className="page units-page">
      <header className="units-page-header">
        <div>
          <p className="section-label">Master data</p>

          <h2>Units of Measurement</h2>

          <p className="units-description">
            Manage the measurement units used when purchasing, storing, and
            issuing inventory products.
          </p>
        </div>

        {canManageUnits && missingDefaultUnits.length > 0 && (
          <button
            type="button"
            className="unit-seed-button"
            onClick={handleSeedUnits}
            disabled={isSeeding || isSubmitting}
          >
            {isSeeding
              ? "Importing Units..."
              : `Import ${missingDefaultUnits.length} Default Units`}
          </button>
        )}
      </header>

      <section className="units-summary-grid">
        <article className="units-summary-card">
          <span>Total units</span>

          <strong>{unitSummary.total}</strong>
        </article>

        <article className="units-summary-card">
          <span>Active units</span>

          <strong>{unitSummary.active}</strong>
        </article>

        <article className="units-summary-card">
          <span>Inactive units</span>

          <strong>{unitSummary.inactive}</strong>
        </article>
      </section>

      {!canManageUnits && (
        <div className="units-readonly-notice">
          <strong>Read-only unit access</strong>

          <span>
            Your role can review units of measurement but cannot create, edit,
            or change their status.
          </span>
        </div>
      )}

      <div
        className={[
          "units-layout",
          !canManageUnits ? "units-layout-readonly" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {canManageUnits && (
          <aside className="unit-form-card">
            <div className="unit-card-heading">
              <p className="section-label">
                {editingUnitId ? "Update record" : "New record"}
              </p>

              <h3>{editingUnitId ? "Edit Unit" : "Create Unit"}</h3>

              <span>
                Unit codes and abbreviations become permanent after creation.
              </span>
            </div>

            {message.text && (
              <div
                className={`unit-message unit-message-${message.type}`}
                role={message.type === "error" ? "alert" : "status"}
              >
                {message.text}
              </div>
            )}

            <form className="unit-form" onSubmit={handleSubmit}>
              <label>
                Unit of measurement
                <select
                  name="selectedUnitCode"
                  value={form.selectedUnitCode}
                  onChange={handleUnitOptionChange}
                  disabled={isSubmitting || Boolean(editingUnitId)}
                  required
                >
                  <option value="">Select a unit</option>

                  {UNIT_OPTIONS.map((unitOption) => {
                    const alreadyCreated = units.some(
                      (unit) => (unit.code ?? unit.id) === unitOption.code,
                    );

                    return (
                      <option
                        key={unitOption.code}
                        value={unitOption.code}
                        disabled={alreadyCreated && !editingUnitId}
                      >
                        {unitOption.name} ({unitOption.abbreviation})
                        {alreadyCreated && !editingUnitId
                          ? " — Already created"
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label>
                Unit name
                <input
                  type="text"
                  value={form.name}
                  placeholder="Selected automatically"
                  readOnly
                />
              </label>

              <label>
                Unit code
                <input
                  type="text"
                  value={generatedCode}
                  placeholder="Generated automatically"
                  readOnly
                />
              </label>

              <label>
                Abbreviation
                <input
                  type="text"
                  value={form.abbreviation}
                  placeholder="Selected automatically"
                  readOnly
                />
              </label>

              {editingUnitId && (
                <div className="unit-permanent-notice">
                  <strong>Permanent fields</strong>

                  <span>
                    The unit code and abbreviation cannot be changed because
                    products may already reference them.
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
                  placeholder="Optional unit description"
                  disabled={isSubmitting}
                />
              </label>

              {editingUnitId && (
                <label>
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  >
                    <option value={UNIT_STATUSES.ACTIVE}>Active</option>

                    <option value={UNIT_STATUSES.INACTIVE}>Inactive</option>
                  </select>
                </label>
              )}

              <div className="unit-form-actions">
                <button
                  type="submit"
                  className="unit-primary-button"
                  disabled={isSubmitting || isSeeding}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingUnitId
                      ? "Save Changes"
                      : "Create Unit"}
                </button>

                {editingUnitId && (
                  <button
                    type="button"
                    className="unit-secondary-button"
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

        <section className="unit-table-card">
          <div className="unit-table-heading">
            <div>
              <p className="section-label">Unit records</p>

              <h3>Units of Measurement</h3>
            </div>

            <span className="unit-record-count">
              {filteredUnits.length} of {units.length} records
            </span>
          </div>

          {canManageUnits && message.text && (
            <div
              className={`unit-mobile-message unit-message unit-message-${message.type}`}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </div>
          )}

          {loadError && (
            <div className="unit-message unit-message-error" role="alert">
              {loadError}
            </div>
          )}

          <div className="unit-filters">
            <label>
              <span>Search units</span>

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, code, abbreviation, or description"
              />
            </label>

            <label>
              <span>Status</span>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>

                <option value={UNIT_STATUSES.ACTIVE}>Active</option>

                <option value={UNIT_STATUSES.INACTIVE}>Inactive</option>
              </select>
            </label>

            <button
              type="button"
              className="unit-clear-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          {isLoading ? (
            <div className="unit-empty-state">
              <h3>Loading units...</h3>

              <p>Fetching unit records from Firebase.</p>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="unit-empty-state">
              <h3>No units found</h3>

              <p>Create the first unit or change the selected filters.</p>
            </div>
          ) : (
            <div className="unit-table-wrapper">
              <table className="unit-table">
                <thead>
                  <tr>
                    <th>Unit</th>

                    <th>Code</th>

                    <th>Abbreviation</th>

                    <th>Description</th>

                    <th>Status</th>

                    {canManageUnits && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredUnits.map((unit) => {
                    const isBusy = busyUnitId === unit.id;

                    return (
                      <tr key={unit.id}>
                        <td>
                          <strong>{unit.name}</strong>
                        </td>

                        <td>
                          <code>{unit.code}</code>
                        </td>

                        <td>
                          <span className="unit-abbreviation">
                            {unit.abbreviation}
                          </span>
                        </td>

                        <td>
                          <span className="unit-description-cell">
                            {unit.description || "No description"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`unit-status unit-status-${String(
                              unit.status,
                            ).toLowerCase()}`}
                          >
                            {unit.status}
                          </span>
                        </td>

                        {canManageUnits && (
                          <td>
                            <div className="unit-table-actions">
                              <button
                                type="button"
                                className="unit-edit-button"
                                onClick={() => startEditing(unit)}
                                disabled={isBusy || isSubmitting}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="unit-status-button"
                                onClick={() => handleStatusChange(unit)}
                                disabled={isBusy || isSubmitting}
                              >
                                {isBusy
                                  ? "Please wait..."
                                  : unit.status === UNIT_STATUSES.ACTIVE
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

export default Units;
