function ReorderFilters({
  filters,
  categoryOptions,
  supplierOptions,
  onChange,
  onReset,
  stockFilters,
  supplierFilters,
  purchaseOrderFilters,
  sortFields,
  sortDirections,
}) {
  return (
    <section className="reorder-filter-panel">
      <div className="reorder-filter-heading">
        <div>
          <h2>Filters</h2>
          <p>Refine the products shown in the reorder list.</p>
        </div>

        <button
          type="button"
          className="reorder-reset-button"
          onClick={onReset}
        >
          Reset
        </button>
      </div>

      <div className="reorder-filter-grid">
        <label className="reorder-filter-field reorder-search-field">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) =>
              onChange("search", event.target.value)
            }
            placeholder="Product, SKU, barcode, supplier or PO"
          />
        </label>

        <label className="reorder-filter-field">
          <span>Category</span>
          <select
            value={filters.categoryCode}
            onChange={(event) =>
              onChange("categoryCode", event.target.value)
            }
          >
            <option value="">All categories</option>
            {categoryOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="reorder-filter-field">
          <span>Supplier</span>
          <select
            value={filters.supplierId}
            onChange={(event) =>
              onChange("supplierId", event.target.value)
            }
          >
            <option value="">All suppliers</option>
            {supplierOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="reorder-filter-field">
          <span>Stock status</span>
          <select
            value={filters.stockStatus}
            onChange={(event) =>
              onChange("stockStatus", event.target.value)
            }
          >
            <option value={stockFilters.ALL}>All</option>
            <option value={stockFilters.LOW_STOCK}>Low stock</option>
            <option value={stockFilters.OUT_OF_STOCK}>
              Out of stock
            </option>
          </select>
        </label>

        <label className="reorder-filter-field">
          <span>Supplier assignment</span>
          <select
            value={filters.supplierAssignment}
            onChange={(event) =>
              onChange("supplierAssignment", event.target.value)
            }
          >
            <option value={supplierFilters.ALL}>All</option>
            <option value={supplierFilters.ASSIGNED}>Assigned</option>
            <option value={supplierFilters.UNASSIGNED}>
              Unassigned
            </option>
          </select>
        </label>

        <label className="reorder-filter-field">
          <span>Purchase order</span>
          <select
            value={filters.purchaseOrderState}
            onChange={(event) =>
              onChange("purchaseOrderState", event.target.value)
            }
          >
            <option value={purchaseOrderFilters.ALL}>All</option>
            <option value={purchaseOrderFilters.WITH_PURCHASE_ORDER}>
              With open PO
            </option>
            <option value={purchaseOrderFilters.WITHOUT_PURCHASE_ORDER}>
              Without open PO
            </option>
          </select>
        </label>

        <label className="reorder-filter-field">
          <span>Sort by</span>
          <select
            value={filters.sortBy}
            onChange={(event) =>
              onChange("sortBy", event.target.value)
            }
          >
            <option value={sortFields.PRODUCT_NAME}>Product name</option>
            <option value={sortFields.CURRENT_QUANTITY}>
              Current quantity
            </option>
            <option value={sortFields.REORDER_LEVEL}>
              Reorder level
            </option>
            <option value={sortFields.SUGGESTED_QUANTITY}>
              Suggested quantity
            </option>
            <option value={sortFields.LAST_PURCHASE_COST}>
              Last purchase cost
            </option>
            <option value={sortFields.STATUS}>Status</option>
          </select>
        </label>

        <label className="reorder-filter-field">
          <span>Direction</span>
          <select
            value={filters.sortDirection}
            onChange={(event) =>
              onChange("sortDirection", event.target.value)
            }
          >
            <option value={sortDirections.ASC}>Ascending</option>
            <option value={sortDirections.DESC}>Descending</option>
          </select>
        </label>
      </div>
    </section>
  );
}

export default ReorderFilters;
