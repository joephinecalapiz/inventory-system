function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(Number(value ?? 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function ReorderSummaryCards({ counts, estimatedTotal }) {
  const cards = [
    {
      label: "Total Reorder Items",
      value: formatNumber(counts.total),
      description: "Products needing replenishment",
      tone: "default",
    },
    {
      label: "Low Stock",
      value: formatNumber(counts.lowStock),
      description: "At or below reorder level",
      tone: "warning",
    },
    {
      label: "Out of Stock",
      value: formatNumber(counts.outOfStock),
      description: "Products with zero quantity",
      tone: "danger",
    },
    {
      label: "With Open PO",
      value: formatNumber(counts.withPurchaseOrder),
      description: "Already linked to a purchase order",
      tone: "success",
    },
    {
      label: "Without Supplier",
      value: formatNumber(counts.withoutSupplier),
      description: "Supplier assignment is still required",
      tone: "muted",
    },
    {
      label: "Estimated Reorder Cost",
      value: formatCurrency(estimatedTotal),
      description: "Visible filtered recommendations",
      tone: "value",
    },
  ];

  return (
    <section className="reorder-summary-grid">
      {cards.map((card) => (
        <article
          className={`reorder-summary-card reorder-summary-${card.tone}`}
          key={card.label}
        >
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.description}</p>
        </article>
      ))}
    </section>
  );
}

export default ReorderSummaryCards;
