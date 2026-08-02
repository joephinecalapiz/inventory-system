function ReorderEmptyState({
  hasUnfilteredItems,
  onReset,
}) {
  return (
    <section className="reorder-empty-state">
      <div className="reorder-empty-symbol">✓</div>
      <h2>
        {hasUnfilteredItems
          ? "No recommendations match the filters"
          : "Inventory is healthy"}
      </h2>
      <p>
        {hasUnfilteredItems
          ? "Reset the filters to view all current reorder recommendations."
          : "No active products currently require reordering."}
      </p>

      {hasUnfilteredItems && (
        <button type="button" onClick={onReset}>
          Reset Filters
        </button>
      )}
    </section>
  );
}

export default ReorderEmptyState;
