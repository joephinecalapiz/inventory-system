import { useEffect, useMemo, useState } from "react";
import "../styles/App.css";
import ProductBarcode from "../components/ProductBarcode";

import { USER_ROLES } from "../constants/roles";

import {
  adjustProductStock,
  deleteProduct,
  subscribeToProducts,
} from "../services/productService";

function Inventory({ currentUserRole }) {
  const canAdjustStock = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.INVENTORY_STAFF,
  ].includes(currentUserRole);

  const canDeleteProducts = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN].includes(
    currentUserRole,
  );

  const isReadOnly = currentUserRole === USER_ROLES.AUDITOR;

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState(null);
  const [firebaseError, setFirebaseError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (firebaseProducts) => {
        setProducts(firebaseProducts);
        setIsLoading(false);
        setFirebaseError("");
      },
      (error) => {
        console.error("Unable to load inventory:", error);

        setFirebaseError(
          error?.message || "Unable to load the inventory list from Firebase.",
        );

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const categories = useMemo(() => {
    return [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ].sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return products.filter((product) => {
      const name = String(product.name ?? "").toLowerCase();
      const sku = String(product.sku ?? "").toLowerCase();
      const barcode = String(product.barcode ?? "").toLowerCase();
      const category = String(product.category ?? "").toLowerCase();

      const matchesSearch =
        name.includes(normalizedSearch) ||
        sku.includes(normalizedSearch) ||
        barcode.includes(normalizedSearch) ||
        category.includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "ALL" || product.category === categoryFilter;

      const status = getStockStatus(product);

      const matchesStock = stockFilter === "ALL" || status.code === stockFilter;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, categoryFilter, stockFilter]);

  async function handleDelete(productId) {
    if (!canDeleteProducts) {
      setFirebaseError("Your role is not allowed to delete products.");

      return;
    }

    const product = products.find(
      (currentProduct) => currentProduct.id === productId,
    );

    if (!product) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete "${product.name}" from the inventory?`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setBusyProductId(productId);
      setFirebaseError("");

      await deleteProduct(productId);
    } catch (error) {
      console.error("Unable to delete product:", error);

      const message =
        error?.message || "Unable to delete the product. Please try again.";

      setFirebaseError(message);
      alert(message);
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleStockAdjustment(productId, movementType) {
    if (!canAdjustStock) {
      setFirebaseError(
        "Your role is not allowed to change inventory quantities.",
      );

      return;
    }

    const product = products.find(
      (currentProduct) => currentProduct.id === productId,
    );

    if (!product) {
      return;
    }

    const movementLabel = movementType === "IN" ? "stock in" : "stock out";

    const input = window.prompt(
      `Enter the quantity to ${movementLabel} for ${product.name}:`,
    );

    if (input === null) {
      return;
    }

    const amount = Number(input);

    if (!Number.isInteger(amount) || amount <= 0) {
      alert("Please enter a positive whole number.");
      return;
    }

    if (movementType === "OUT" && amount > Number(product.quantity ?? 0)) {
      alert(
        `Insufficient stock. Only ${product.quantity} item(s) are available.`,
      );

      return;
    }

    try {
      setBusyProductId(productId);
      setFirebaseError("");

      await adjustProductStock(productId, movementType, amount);
    } catch (error) {
      console.error("Unable to adjust stock:", error);

      const message = error?.message || "Unable to update the product stock.";

      setFirebaseError(message);
      alert(message);
    } finally {
      setBusyProductId(null);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("ALL");
    setStockFilter("ALL");
  }

  return (
    <main className="page inventory-list-page">
      {firebaseError && (
        <div className="firebase-error" role="alert">
          {firebaseError}
        </div>
      )}

      {isReadOnly && (
        <div className="inventory-readonly-notice">
          <div>
            <strong>Read-only inventory access</strong>

            <span>
              Your Auditor role can review product and stock information but
              cannot change or delete inventory records.
            </span>
          </div>
        </div>
      )}

      <section className="panel inventory-panel">
        <div className="inventory-header">
          <div>
            <p className="section-label">Product records</p>

            <h2>Inventory List</h2>
          </div>

          <span className="record-count">
            {filteredProducts.length} of {products.length} records
          </span>
        </div>

        <div className="filters">
          <label className="search-field">
            <span>Search products</span>

            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by SKU, barcode, name, or category"
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
            <span>Stock status</span>

            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="IN_STOCK">In stock</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
          </label>

          <button type="button" className="clear-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <h3>Loading products...</h3>
            <p>Fetching inventory records from Firebase.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>Add a product or change the selected filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Unit Price</th>
                  <th>Total Value</th>
                  {canAdjustStock && <th>Stock Actions</th>}

                  {canDeleteProducts && <th>Record Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product);

                  const isBusy = busyProductId === product.id;

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <strong>{product.name}</strong>

                          <span>{product.sku}</span>
                        </div>
                      </td>

                      <td>
                        <ProductBarcode value={product.barcode} />
                      </td>

                      <td>{product.category}</td>

                      <td>
                        <div className="stock-cell">
                          <strong>{Number(product.quantity ?? 0)}</strong>

                          <span>
                            Reorder at {Number(product.reorderLevel ?? 0)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className={`status-badge ${status.className}`}>
                          {status.label}
                        </span>
                      </td>

                      <td>{formatCurrency(product.price)}</td>

                      <td>
                        {formatCurrency(
                          Number(product.quantity ?? 0) *
                            Number(product.price ?? 0),
                        )}
                      </td>

                      {canAdjustStock && (
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="stock-in-button"
                              onClick={() =>
                                handleStockAdjustment(product.id, "IN")
                              }
                              disabled={isBusy}
                            >
                              {isBusy ? "Please wait..." : "Stock In"}
                            </button>

                            <button
                              type="button"
                              className="stock-out-button"
                              onClick={() =>
                                handleStockAdjustment(product.id, "OUT")
                              }
                              disabled={
                                isBusy || Number(product.quantity ?? 0) === 0
                              }
                            >
                              Stock Out
                            </button>
                          </div>
                        </td>
                      )}
                      {canDeleteProducts && (
                        <td>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => handleDelete(product.id)}
                            disabled={isBusy}
                          >
                            Delete
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
    </main>
  );
}

function getStockStatus(product) {
  const quantity = Number(product.quantity ?? 0);
  const reorderLevel = Number(product.reorderLevel ?? 0);

  if (quantity === 0) {
    return {
      code: "OUT_OF_STOCK",
      label: "Out of Stock",
      className: "status-out",
    };
  }

  if (quantity <= reorderLevel) {
    return {
      code: "LOW_STOCK",
      label: "Low Stock",
      className: "status-low",
    };
  }

  return {
    code: "IN_STOCK",
    label: "In Stock",
    className: "status-in",
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

export default Inventory;
