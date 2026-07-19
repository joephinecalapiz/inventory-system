import { useEffect, useMemo, useState } from "react";

import "../styles/App.css";

import { USER_ROLES } from "../constants/roles";

import { PRODUCT_OPTIONS } from "../data/productOptions";

import {
  subscribeToActiveCategories,
} from "../services/categoryService";

import {
  subscribeToActiveUnits,
} from "../services/unitService";

import {
  createProduct,
} from "../services/productService";

const EMPTY_FORM = {
  selectedProductId: "",
  name: "",
  sku: "",
  category: "",
  categoryCode: "",
  unitCode: "",
  price: "",
  quantity: "",
  reorderLevel: "",
};

function AddProduct({ currentUserRole }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [activeCategories, setActiveCategories] =
    useState([]);

  const [activeUnits, setActiveUnits] =
    useState([]);

  const [
    isLoadingCategories,
    setIsLoadingCategories,
  ] = useState(true);

  const [
    isLoadingUnits,
    setIsLoadingUnits,
  ] = useState(true);

  const [
    categoryLoadError,
    setCategoryLoadError,
  ] = useState("");

  const [
    unitLoadError,
    setUnitLoadError,
  ] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const canCreateProducts = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  useEffect(() => {
    const unsubscribe =
      subscribeToActiveCategories(
        (categories) => {
          setActiveCategories(categories);
          setIsLoadingCategories(false);
          setCategoryLoadError("");
        },

        (error) => {
          console.error(
            "Unable to load active categories:",
            error,
          );

          setCategoryLoadError(
            error?.message ||
              "Unable to load active categories.",
          );

          setIsLoadingCategories(false);
        },
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe =
      subscribeToActiveUnits(
        (units) => {
          setActiveUnits(units);
          setIsLoadingUnits(false);
          setUnitLoadError("");

          /*
           * Clear a selected unit if an administrator
           * deactivates it while this form is open.
           */
          setForm((currentForm) => {
            if (!currentForm.unitCode) {
              return currentForm;
            }

            const unitStillActive = units.some(
              (unit) =>
                (unit.code ?? unit.id) ===
                currentForm.unitCode,
            );

            if (unitStillActive) {
              return currentForm;
            }

            return {
              ...currentForm,
              unitCode: "",
            };
          });
        },

        (error) => {
          console.error(
            "Unable to load active units:",
            error,
          );

          setUnitLoadError(
            error?.message ||
              "Unable to load active units of measurement.",
          );

          setIsLoadingUnits(false);
        },
      );

    return unsubscribe;
  }, []);

  const activeCategoryNames = useMemo(() => {
    return new Set(
      activeCategories.map(
        (category) => category.name,
      ),
    );
  }, [activeCategories]);

  const availableProductOptions = useMemo(() => {
    return PRODUCT_OPTIONS.filter(
      (product) =>
        activeCategoryNames.has(
          product.category,
        ),
    );
  }, [activeCategoryNames]);

  function clearMessage() {
    if (message.text) {
      setMessage({
        type: "",
        text: "",
      });
    }
  }

  function handleProductChange(event) {
    const selectedProductId =
      event.target.value;

    const selectedProduct =
      availableProductOptions.find(
        (product) =>
          product.id === selectedProductId,
      );

    if (!selectedProduct) {
      setForm((currentForm) => ({
        ...EMPTY_FORM,
        unitCode: currentForm.unitCode,
      }));

      clearMessage();
      return;
    }

    const selectedCategory =
      activeCategories.find(
        (category) =>
          category.name ===
          selectedProduct.category,
      );

    if (!selectedCategory) {
      setForm((currentForm) => ({
        ...EMPTY_FORM,
        unitCode: currentForm.unitCode,
      }));

      setMessage({
        type: "error",
        text: "The selected product does not have an active Firestore category.",
      });

      return;
    }

    const numericPrice = Number(
      selectedProduct.price,
    );

    const hasValidPrice =
      selectedProduct.price !== null &&
      selectedProduct.price !== "" &&
      Number.isFinite(numericPrice) &&
      numericPrice >= 0;

    setForm((currentForm) => ({
      ...currentForm,

      selectedProductId:
        selectedProduct.id,

      name:
        selectedProduct.name,

      sku:
        selectedProduct.sku,

      category:
        selectedCategory.name,

      categoryCode:
        selectedCategory.code ??
        selectedCategory.id,

      price:
        hasValidPrice
          ? String(selectedProduct.price)
          : "",
    }));

    if (!hasValidPrice) {
      setMessage({
        type: "error",
        text: `${selectedProduct.name} does not have a valid unit price in the product master list.`,
      });

      return;
    }

    clearMessage();
  }

  function handleChange(event) {
    const { name, value } =
      event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    clearMessage();
  }

  function validateForm() {
    if (!form.selectedProductId) {
      return "Please select a product.";
    }

    if (!form.categoryCode) {
      return "The selected product does not have a valid Firestore category.";
    }

    if (!form.unitCode) {
      return "Please select a unit of measurement.";
    }

    const selectedUnit = activeUnits.find(
      (unit) =>
        (unit.code ?? unit.id) ===
        form.unitCode,
    );

    if (!selectedUnit) {
      return "The selected unit of measurement is no longer active.";
    }

    if (
      !form.name ||
      !form.sku ||
      !form.category
    ) {
      return "The selected product is missing master-list information.";
    }

    const price = Number(form.price);

    if (
      form.price === "" ||
      !Number.isFinite(price)
    ) {
      return "The selected product must have a valid unit price.";
    }

    if (
      form.quantity === "" ||
      form.reorderLevel === ""
    ) {
      return "Please enter the quantity and reorder level.";
    }

    const quantity = Number(
      form.quantity,
    );

    const reorderLevel = Number(
      form.reorderLevel,
    );

    if (!Number.isInteger(quantity)) {
      return "Quantity must be a whole number.";
    }

    if (!Number.isInteger(reorderLevel)) {
      return "Reorder level must be a whole number.";
    }

    if (
      quantity < 0 ||
      reorderLevel < 0 ||
      price < 0
    ) {
      return "Quantity, reorder level, and unit price cannot be negative.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canCreateProducts) {
      setMessage({
        type: "error",
        text: "Your role is not allowed to create products.",
      });

      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });

      return;
    }

    const productData = {
      name: form.name.trim(),

      sku: form.sku
        .trim()
        .toUpperCase(),

      category:
        form.category.trim(),

      categoryCode:
        form.categoryCode
          .trim()
          .toUpperCase(),

      unitCode:
        form.unitCode
          .trim()
          .toUpperCase(),

      price:
        Number(form.price),

      quantity:
        Number(form.quantity),

      reorderLevel:
        Number(form.reorderLevel),
    };

    try {
      setIsSubmitting(true);

      setMessage({
        type: "",
        text: "",
      });

      const result = await createProduct(
        productData,
      );

      setForm({
        ...EMPTY_FORM,
      });

      setMessage({
        type: "success",
        text: `${productData.name} was added successfully using ${result.unitName} (${result.unitAbbreviation}). Barcode ${result.barcode} was generated using the ${result.category} category prefix.`,
      });
    } catch (error) {
      console.error(
        "Unable to create product:",
        error,
      );

      setMessage({
        type: "error",
        text:
          error?.message ||
          "Unable to add the product. Please check Firebase and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canCreateProducts) {
    return (
      <main className="page">
        <section className="product-access-denied">
          <div className="product-access-denied-icon">
            !
          </div>

          <p>Access denied</p>

          <h2>
            You cannot add products
          </h2>

          <span>
            Your current role does not have
            permission to create inventory
            products.
          </span>
        </section>
      </main>
    );
  }

  const isLoadingMasterData =
    isLoadingCategories ||
    isLoadingUnits;

  const hasMasterDataError =
    Boolean(categoryLoadError) ||
    Boolean(unitLoadError);

  return (
    <main className="add-product-page">
      <header className="add-product-heading">
        <div>
          <p>
            Product management
          </p>

          <h2>
            Add Product
          </h2>

          <span>
            Select a product, category-linked
            barcode, and active unit of
            measurement.
          </span>
        </div>
      </header>

      <section className="add-product-card">
        <div className="add-product-card-header">
          <p>
            New inventory record
          </p>

          <h3>
            Product Information
          </h3>
        </div>

        {categoryLoadError && (
          <div
            className="add-product-message add-product-message-error"
            role="alert"
          >
            {categoryLoadError}
          </div>
        )}

        {unitLoadError && (
          <div
            className="add-product-message add-product-message-error"
            role="alert"
          >
            {unitLoadError}
          </div>
        )}

        {message.text && (
          <div
            className={`add-product-message add-product-message-${message.type}`}
            role={
              message.type === "error"
                ? "alert"
                : "status"
            }
          >
            {message.text}
          </div>
        )}

        <form
          className="add-product-form"
          onSubmit={handleSubmit}
        >
          <label>
            Product name

            <select
              name="selectedProductId"
              value={
                form.selectedProductId
              }
              onChange={
                handleProductChange
              }
              disabled={
                isSubmitting ||
                isLoadingCategories ||
                Boolean(
                  categoryLoadError,
                )
              }
              required
            >
              <option value="">
                {isLoadingCategories
                  ? "Loading active categories..."
                  : availableProductOptions.length === 0
                    ? "No available products"
                    : "Select a product"}
              </option>

              {availableProductOptions.map(
                (product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            SKU

            <input
              type="text"
              value={form.sku}
              placeholder="Automatically selected"
              readOnly
            />
          </label>

          <label>
            Category

            <input
              type="text"
              value={form.category}
              placeholder="Automatically selected"
              readOnly
            />
          </label>

          <label>
            Category code

            <input
              type="text"
              value={
                form.categoryCode
              }
              placeholder="Automatically selected"
              readOnly
            />
          </label>

          <label>
            Unit of measurement

            <select
              name="unitCode"
              value={form.unitCode}
              onChange={handleChange}
              disabled={
                isSubmitting ||
                isLoadingUnits ||
                Boolean(unitLoadError)
              }
              required
            >
              <option value="">
                {isLoadingUnits
                  ? "Loading active units..."
                  : activeUnits.length === 0
                    ? "No active units available"
                    : "Select a unit"}
              </option>

              {activeUnits.map((unit) => (
                <option
                  key={unit.id}
                  value={
                    unit.code ??
                    unit.id
                  }
                >
                  {unit.name} (
                  {unit.abbreviation})
                </option>
              ))}
            </select>
          </label>

          <label>
            Unit price

            <input
              type="number"
              value={form.price}
              placeholder="Automatically selected"
              readOnly
            />
          </label>

          <div className="add-product-barcode-note">
            <strong>
              Firestore master data
            </strong>

            <span>
              The system verifies both the
              selected category and unit before
              saving the product.
            </span>
          </div>

          <div className="add-product-form-row">
            <label>
              Initial quantity

              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                min="0"
                step="1"
                placeholder="0"
                disabled={isSubmitting}
                required
              />
            </label>

            <label>
              Reorder level

              <input
                type="number"
                name="reorderLevel"
                value={
                  form.reorderLevel
                }
                onChange={handleChange}
                min="0"
                step="1"
                placeholder="5"
                disabled={isSubmitting}
                required
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="add-product-submit"
              disabled={
                isSubmitting ||
                isLoadingMasterData ||
                hasMasterDataError ||
                !form.selectedProductId ||
                !form.categoryCode ||
                !form.unitCode ||
                form.price === ""
              }
            >
              {isSubmitting
                ? "Saving Product..."
                : "Add Product"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setForm({
                  ...EMPTY_FORM,
                });

                setMessage({
                  type: "",
                  text: "",
                });
              }}
              disabled={isSubmitting}
            >
              Clear Form
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default AddProduct;