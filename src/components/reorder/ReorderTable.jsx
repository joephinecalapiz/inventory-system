import ReorderTableRow from "./ReorderTableRow.jsx";

function ReorderTable({ items, currentUserRole }) {
  return (
    <section className="reorder-table-panel">
      <div className="reorder-table-heading">
        <div>
          <h2>Reorder Recommendations</h2>
          <p>{items.length} visible product(s)</p>
        </div>
      </div>

      <div className="reorder-table-wrapper">
        <table className="reorder-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Reorder Level</th>
              <th>Suggested Qty</th>
              <th>Preferred Supplier</th>
              <th>Last Cost</th>
              <th>Estimated Cost</th>
              <th>Status</th>
              <th>Purchase Order</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ReorderTableRow
                item={item}
                currentUserRole={currentUserRole}
                key={item.productId}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="reorder-mobile-list">
        {items.map((item) => (
          <ReorderTableRow
            mobile
            item={item}
            currentUserRole={currentUserRole}
            key={item.productId}
          />
        ))}
      </div>
    </section>
  );
}

export default ReorderTable;
