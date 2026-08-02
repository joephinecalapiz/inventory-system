function ReorderLoading() {
  return (
    <section
      className="reorder-loading"
      aria-label="Loading reorder recommendations"
    >
      <div className="reorder-loading-header" />
      {Array.from({ length: 7 }, (_, index) => (
        <div className="reorder-loading-row" key={index}>
          {Array.from({ length: 6 }, (_, cellIndex) => (
            <span key={cellIndex} />
          ))}
        </div>
      ))}
    </section>
  );
}

export default ReorderLoading;
