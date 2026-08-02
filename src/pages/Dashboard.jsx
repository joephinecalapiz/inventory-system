import { useEffect, useMemo, useState } from "react";

import "../styles/Dashboard.css";

import {
  getEmptyDashboardPayload,
  subscribeToDashboardSummary,
} from "../services/dashboardService";

function Dashboard() {
  const [dashboard, setDashboard] = useState(getEmptyDashboardPayload());

  useEffect(() => {
    const unsubscribe = subscribeToDashboardSummary(
      setDashboard,
      (error, context) => {
        console.error(
          "Unable to load dashboard source:",
          context?.source,
          error,
        );
      },
    );

    return unsubscribe;
  }, []);

  const {
    summary,
    stockAlerts,
    valuation,
    trends,
    movementAnalytics,
    isLoading,
    isPartial,
    hasError,
    failedSources,
  } = dashboard;

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  if (isLoading) {
    return (
      <main className="inventory-dashboard">
        <div className="dashboard-state-panel">
          <div className="dashboard-loader" />
          <h2>Loading dashboard</h2>
          <p>Gathering inventory, purchasing, and stock movement data.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="inventory-dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">Inventory overview</p>
          <h1>Dashboard</h1>
          <span>
            Monitor stock levels, movement activity, purchasing, and inventory
            value.
          </span>
        </div>

        <div className="dashboard-date">
          <CalendarIcon />
          <span>{today}</span>
        </div>
      </section>

      {(isPartial || hasError) && (
        <section className="dashboard-notice" role="status">
          <div>
            <strong>Some dashboard data is temporarily unavailable.</strong>
            <span>
              Available sections are still shown. Failed source
              {failedSources.length === 1 ? "" : "s"}:{" "}
              {failedSources.join(", ") || "Unknown"}.
            </span>
          </div>
        </section>
      )}

      <section className="dashboard-summary-grid">
        <SummaryCard
          label="Active Products"
          value={formatNumber(summary.totalActiveProducts)}
          description="Products currently available for inventory use"
          icon={<CubeIcon />}
        />
        <SummaryCard
          label="Available Stock"
          value={formatNumber(summary.totalStockQuantity)}
          description="Combined quantity across active products"
          icon={<DatabaseIcon />}
        />
        <SummaryCard
          label="Low Stock"
          value={formatNumber(summary.lowStockProducts)}
          description="Products at or below reorder level"
          icon={<WarningIcon />}
          status="warning"
        />
        <SummaryCard
          label="Out of Stock"
          value={formatNumber(summary.outOfStockProducts)}
          description="Products with zero quantity"
          icon={<OutIcon />}
          status="danger"
        />
        <SummaryCard
          label="Inventory Value"
          value={formatCurrency(valuation.totalInventoryValue)}
          description={`${formatNumber(
            valuation.valuationCoveragePercent,
          )}% cost coverage`}
          icon={<MoneyIcon />}
          wide
        />
      </section>

      <section className="dashboard-operation-grid">
        <OperationCard
          label="Received This Month"
          value={summary.stockReceivedThisMonth}
          description="Inbound quantity posted"
          direction="in"
        />
        <OperationCard
          label="Released This Month"
          value={summary.stockReleasedThisMonth}
          description="Outbound quantity posted"
          direction="out"
        />
        <OperationCard
          label="Pending Purchase Orders"
          value={summary.pendingPurchaseOrders}
          description="Orders awaiting completion"
        />
        <OperationCard
          label="Pending Goods Receipts"
          value={summary.pendingGoodsReceipts}
          description="Receipts not yet finalized"
        />
        <OperationCard
          label="Pending Adjustments"
          value={summary.pendingStockAdjustments}
          description="Requests awaiting review"
        />
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel dashboard-panel-wide">
          <PanelHeading
            eyebrow="Movement trend"
            title="Stock In vs Stock Out"
            meta="Last 30 days"
          />

          <MovementChart
            labels={trends.last30Days.labels}
            stockIn={trends.last30Days.stockIn}
            stockOut={trends.last30Days.stockOut}
          />

          <div className="dashboard-chart-legend">
            <span>
              <i className="dashboard-legend-in" />
              Stock In
            </span>
            <span>
              <i className="dashboard-legend-out" />
              Stock Out
            </span>
          </div>
        </article>

        <article className="dashboard-panel">
          <PanelHeading
            eyebrow="Trend comparison"
            title="Movement Performance"
            meta="Current period"
          />

          <div className="dashboard-trend-stack">
            <TrendCard
              label="This Month"
              trend={trends.movementTrendThisMonth}
            />
            <TrendCard
              label="Last 7 Days"
              trend={trends.movementTrendLast7Days}
            />
          </div>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel">
          <PanelHeading
            eyebrow="Stock alerts"
            title="Reorder Attention"
            meta={`${stockAlerts.counts.totalAlerts} alerts`}
          />

          <StockAlertList
            lowStock={stockAlerts.lowStockPreview}
            outOfStock={stockAlerts.outOfStockPreview}
          />
        </article>

        <article className="dashboard-panel">
          <PanelHeading
            eyebrow="Inventory value"
            title="Value by Category"
            meta={`${valuation.categoryValuation.length} categories`}
          />

          <CategoryValueList
            items={valuation.categoryValuation.slice(0, 8)}
            total={valuation.totalInventoryValue}
          />
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel">
          <PanelHeading
            eyebrow="Product activity"
            title="Most Issued Products"
            meta="By quantity"
          />

          <MostIssuedList items={movementAnalytics.mostIssuedProducts} />
        </article>

        <article className="dashboard-panel dashboard-panel-wide">
          <PanelHeading
            eyebrow="Latest activity"
            title="Recent Stock Movements"
            meta={`${movementAnalytics.recentStockMovements.length} records`}
          />

          <RecentMovementTable items={movementAnalytics.recentStockMovements} />
        </article>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  status = "default",
  wide = false,
}) {
  return (
    <article
      className={[
        "dashboard-summary-card",
        `dashboard-summary-${status}`,
        wide ? "dashboard-summary-wide" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{description}</p>
      </div>
      <div className="dashboard-summary-icon">{icon}</div>
    </article>
  );
}

function OperationCard({ label, value, description, direction = "neutral" }) {
  return (
    <article className="dashboard-operation-card">
      <div className={`dashboard-operation-indicator ${direction}`} />
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <p>{description}</p>
    </article>
  );
}

function PanelHeading({ eyebrow, title, meta }) {
  return (
    <div className="dashboard-panel-heading">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span>{meta}</span>
    </div>
  );
}

function TrendCard({ label, trend }) {
  const direction = trend?.direction ?? "FLAT";

  return (
    <div className="dashboard-trend-card">
      <div>
        <span>{label}</span>
        <strong>{formatNumber(trend?.currentValue ?? 0)}</strong>
      </div>

      <div
        className={`dashboard-trend-badge dashboard-trend-${direction.toLowerCase()}`}
      >
        {direction === "UP" ? "↑" : direction === "DOWN" ? "↓" : "—"}
        {Math.abs(Number(trend?.percentage ?? 0)).toFixed(1)}%
      </div>

      <p>Previous period: {formatNumber(trend?.previousValue ?? 0)}</p>
    </div>
  );
}

function StockAlertList({ lowStock, outOfStock }) {
  const items = [
    ...outOfStock.map((item) => ({
      ...item,
      label: "Out of stock",
      tone: "danger",
    })),
    ...lowStock.map((item) => ({
      ...item,
      label: "Low stock",
      tone: "warning",
    })),
  ].slice(0, 8);

  if (items.length === 0) {
    return <EmptyState text="No products currently need reorder attention." />;
  }

  return (
    <div className="dashboard-list">
      {items.map((item) => (
        <div className="dashboard-list-row" key={item.id}>
          <div>
            <strong>{item.productName}</strong>
            <span>{item.sku || "No SKU"}</span>
          </div>
          <div className="dashboard-list-metrics">
            <span>
              {formatNumber(item.quantity)} / {formatNumber(item.reorderLevel)}
            </span>
            <small className={`dashboard-status-${item.tone}`}>
              {item.label}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryValueList({ items, total }) {
  if (items.length === 0) {
    return <EmptyState text="Category valuation will appear here." />;
  }

  return (
    <div className="dashboard-value-list">
      {items.map((item) => {
        const percentage = total > 0 ? (item.inventoryValue / total) * 100 : 0;

        return (
          <div className="dashboard-value-row" key={item.category}>
            <div>
              <strong>{item.category}</strong>
              <span>{formatNumber(item.productCount)} products</span>
            </div>
            <div>
              <strong>{formatCurrency(item.inventoryValue)}</strong>
              <span>{percentage.toFixed(1)}%</span>
            </div>
            <div className="dashboard-value-track">
              <span style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MostIssuedList({ items }) {
  if (!items?.length) {
    return <EmptyState text="Issued-product activity will appear here." />;
  }

  return (
    <div className="dashboard-list">
      {items.map((item, index) => (
        <div className="dashboard-list-row" key={item.productId}>
          <div className="dashboard-rank">{index + 1}</div>
          <div>
            <strong>{item.productName}</strong>
            <span>{item.sku || "No SKU"}</span>
          </div>
          <div className="dashboard-list-metrics">
            <span>{formatNumber(item.quantityIssued)} issued</span>
            <small>{formatNumber(item.transactionCount)} records</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentMovementTable({ items }) {
  if (!items?.length) {
    return <EmptyState text="Posted stock movements will appear here." />;
  }

  return (
    <div className="dashboard-table-wrapper">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Reference</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>User</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.productName}</strong>
                <span>{item.sku || "No SKU"}</span>
              </td>
              <td>{item.referenceNumber || "—"}</td>
              <td>
                <span
                  className={`dashboard-movement-badge dashboard-movement-${item.direction.toLowerCase()}`}
                >
                  {formatTransactionType(item.transactionType)}
                </span>
              </td>
              <td>
                {item.quantityChanged > 0 ? "+" : ""}
                {formatNumber(item.quantityChanged)}
              </td>
              <td>{item.performedByName}</td>
              <td>{formatDateTime(item.transactionDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementChart({ labels, stockIn, stockOut }) {
  const width = 900;
  const height = 280;
  const padding = {
    top: 18,
    right: 12,
    bottom: 42,
    left: 12,
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(...stockIn, ...stockOut, 1);
  const groupWidth = chartWidth / Math.max(labels.length, 1);
  const barWidth = Math.max(Math.min(groupWidth * 0.28, 10), 2);

  return (
    <svg
      className="dashboard-movement-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Stock In and Stock Out movement chart"
    >
      {[0, 1, 2, 3, 4].map((line) => {
        const y = padding.top + (chartHeight / 4) * line;

        return (
          <line
            key={line}
            className="dashboard-chart-grid"
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
          />
        );
      })}

      {labels.map((label, index) => {
        const groupX = padding.left + groupWidth * index + groupWidth / 2;
        const inHeight = (Number(stockIn[index] ?? 0) / maximum) * chartHeight;
        const outHeight =
          (Number(stockOut[index] ?? 0) / maximum) * chartHeight;

        return (
          <g key={`${label}-${index}`}>
            <rect
              className="dashboard-bar-in"
              x={groupX - barWidth - 1}
              y={padding.top + chartHeight - inHeight}
              width={barWidth}
              height={Math.max(inHeight, 1)}
              rx="2"
            />
            <rect
              className="dashboard-bar-out"
              x={groupX + 1}
              y={padding.top + chartHeight - outHeight}
              width={barWidth}
              height={Math.max(outHeight, 1)}
              rx="2"
            />
            {(labels.length <= 14 ||
              index === 0 ||
              index === labels.length - 1 ||
              index % 5 === 0) && (
              <text
                className="dashboard-chart-label"
                x={groupX}
                y={height - 12}
                textAnchor="middle"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function EmptyState({ text }) {
  return (
    <div className="dashboard-empty">
      <span>—</span>
      <p>{text}</p>
    </div>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function formatDateTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatTransactionType(value) {
  return String(value ?? "")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function CubeIcon() {
  return (
    <Icon>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </Icon>
  );
}

function DatabaseIcon() {
  return (
    <Icon>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </Icon>
  );
}

function WarningIcon() {
  return (
    <Icon>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </Icon>
  );
}

function OutIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  );
}

function MoneyIcon() {
  return (
    <Icon>
      <path d="M7 3h10l2 5-2 13H7L5 8l2-5Z" />
      <path d="M9 8h6M12 8v9M9.5 12h4a2 2 0 0 1 0 4h-4" />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </Icon>
  );
}

export default Dashboard;
