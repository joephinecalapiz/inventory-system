import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "../styles/App.css";

import {
  USER_ROLES,
} from "../constants/roles";

import {
  PRODUCT_OPTIONS,
} from "../data/productOptions";

import {
  subscribeToActiveCategories,
} from "../services/categoryService";

import {
  createProduct,
} from "../services/productService";

const EMPTY_FORM = {
  selectedProductId: "",
  name: "",
  sku: "",
  category: "",
  categoryCode: "",
  price: "",
  quantity: "",
  reorderLevel: "",
};

function AddProduct({
  currentUserRole,
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [activeCategories, setActiveCategories] =
    useState([]);

  const [
    isLoadingCategories,
    setIsLoadingCategories,
  ] = useState(true);

  const [
    categoryLoadError,
    setCategoryLoadError,
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

  const activeCategoryNames =
    useMemo(() => {
      return new Set(
        activeCategories.map(
          (category) =>
            category.name,
        ),
      );
    }, [activeCategories]);

  /*
   * Products belonging to inactive or missing
   * categories are not shown in the dropdown.
   */
  const availableProductOptions =
    useMemo(() => {
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
          product.id ===
          selectedProductId,
      );

    if (!selectedProduct) {
      setForm({
        ...EMPTY_FORM,
      });

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
      setForm({
        ...EMPTY_FORM,
      });

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
    const {
      name,
      value,
    } = event.target;

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

    if (
      !form.name ||
      !form.sku ||
      !form.category
    ) {
      return "The selected product is missing master-list information.";
    }

    const price =
      Number(form.price);

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

    const quantity =
      Number(form.quantity);

    const reorderLevel =
      Number(form.reorderLevel);

    if (!Number.isInteger(quantity)) {
      return "Quantity must be a whole number.";
    }

    if (
      !Number.isInteger(
        reorderLevel,
      )
    ) {
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
      name:
        form.name.trim(),

      sku:
        form.sku
          .trim()
          .toUpperCase(),

      category:
        form.category.trim(),

      categoryCode:
        form.categoryCode
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

      const result =
        await createProduct(
          productData,
        );

      setForm({
        ...EMPTY_FORM,
      });

      setMessage({
        type: "success",
        text: `${productData.name} was added successfully. Barcode ${result.barcode} was generated using the ${productData.category} category prefix.`,
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
            Select a product whose category is
            currently active in Firestore.
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
              Firestore category barcode
            </strong>

            <span>
              The system will read the permanent
              barcode prefix from the selected
              Firestore category.
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
                isLoadingCategories ||
                !form.selectedProductId ||
                !form.categoryCode ||
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