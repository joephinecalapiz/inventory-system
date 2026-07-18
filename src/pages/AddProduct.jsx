import { useState } from "react";

import "../App.css";

import {
  USER_ROLES,
} from "../constants/roles";

import {
  PRODUCT_OPTIONS,
} from "../data/productOptions";

import {
  createProduct,
} from "../services/productService";

const EMPTY_FORM = {
  selectedProductId: "",
  name: "",
  sku: "",
  category: "",
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

  function handleProductChange(event) {
    const selectedProductId =
      event.target.value;

    const selectedProduct =
      PRODUCT_OPTIONS.find(
        (product) =>
          product.id === selectedProductId,
      );

    if (!selectedProduct) {
      setForm({
        ...EMPTY_FORM,
      });

      setMessage({
        type: "",
        text: "",
      });

      return;
    }

    setForm((currentForm) => ({
      ...currentForm,

      selectedProductId:
        selectedProduct.id,

      name: selectedProduct.name,
      sku: selectedProduct.sku,
      category: selectedProduct.category,
      price: String(selectedProduct.price),
    }));

    setMessage({
      type: "",
      text: "",
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (message.text) {
      setMessage({
        type: "",
        text: "",
      });
    }
  }

  function validateForm() {
    if (!form.selectedProductId) {
      return "Please select a product.";
    }

    if (
      !form.name ||
      !form.sku ||
      !form.category ||
      form.price === ""
    ) {
      return "The selected product is missing master-list information.";
    }

    if (
      form.quantity === "" ||
      form.reorderLevel === ""
    ) {
      return "Please enter the quantity and reorder level.";
    }

    const quantity = Number(form.quantity);

    const reorderLevel = Number(
      form.reorderLevel,
    );

    const price = Number(form.price);

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
      sku: form.sku.trim().toUpperCase(),
      category: form.category.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
      reorderLevel: Number(
        form.reorderLevel,
      ),
    };

    try {
      setIsSubmitting(true);

      setMessage({
        type: "",
        text: "",
      });

      await createProduct(productData);

      setForm({
        ...EMPTY_FORM,
      });

      setMessage({
        type: "success",
        text: `${productData.name} was added successfully. Its barcode was generated automatically.`,
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

  /*
   * Keep this after all React hooks.
   */
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
          <p>Product management</p>

          <h2>Add Product</h2>

          <span>
            Select a product from the master list.
            Its SKU, category, and unit price will
            be filled automatically.
          </span>
        </div>
      </header>

      <section className="add-product-card">
        <div className="add-product-card-header">
          <p>New inventory record</p>

          <h3>Product Information</h3>
        </div>

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
              disabled={isSubmitting}
              required
            >
              <option value="">
                Select a product
              </option>

              {PRODUCT_OPTIONS.map(
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
              Automatic barcode
            </strong>

            <span>
              Firebase will generate a unique
              12-digit barcode when this product
              is saved.
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
                value={form.reorderLevel}
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
                !form.selectedProductId
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