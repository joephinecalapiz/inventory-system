function ReorderError({ failedSources, onRetry }) {
  return (
    <section className="reorder-error-state" role="alert">
      <div>
        <strong>Some reorder data could not be loaded.</strong>
        <span>
          Failed source
          {failedSources.length === 1 ? "" : "s"}:{" "}
          {failedSources.join(", ") || "Unknown"}.
        </span>
      </div>

      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}

export default ReorderError;
