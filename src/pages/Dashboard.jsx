import { useEffect, useMemo, useState } from "react";
import "../styles/Dashboard.css";
import { subscribeToProducts } from "../services/productService";
import { subscribeToSalesMovements } from "../services/dashboardService";

const COLORS = [
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#f59e0b",
  "#f97316",
  "#0891b2",
];

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts(
      (items) => {
        setProducts(items);
        setLoadingProducts(false);
      },
      (error) => {
        console.error(error);
        setErrorMessage(error?.message || "Unable to load products.");
        setLoadingProducts(false);
      },
    );

    const unsubscribeSales = subscribeToSalesMovements(
      (items) => {
        setSales(items);
        setLoadingSales(false);
      },
      (error) => {
        console.error(error);
        setErrorMessage(error?.message || "Unable to load sales.");
        setLoadingSales(false);
      },
    );

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
    };
  }, []);

  const data = useMemo(
    () => buildDashboardData(products, sales),
    [products, sales],
  );

  const today = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  if (loadingProducts || loadingSales) {
    return (
      <main className="enhanced-dashboard">
        <div className="dashboard-loading">
          <div className="dashboard-loader" />
          <h3>Loading dashboard...</h3>
          <p>Fetching inventory and stock movement data from Firebase.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="enhanced-dashboard">
      <section className="dashboard-welcome">
        <div>
          <p className="dashboard-eyebrow">Inventory overview</p>

          <span>
            Welcome back! Here is what is happening with your inventory today.
          </span>
        </div>

        <div className="dashboard-date">
          <CalendarIcon />
          <span>{today}</span>
        </div>
      </section>

      {errorMessage && (
        <div className="dashboard-error" role="alert">
          {errorMessage}
        </div>
      )}

      <section className="dashboard-metric-grid">
        <MetricCard
          label="Total Products"
          value={data.totalProducts}
          description="All products in inventory"
          tone="green"
          icon={<CubeIcon />}
        />
        <MetricCard
          label="Available Stock"
          value={data.totalStock}
          description="Items currently in stock"
          tone="blue"
          icon={<DatabaseIcon />}
        />
        <MetricCard
          label="Low Stock"
          value={data.lowStockCount}
          description="Items running low"
          tone="orange"
          icon={<WarningIcon />}
        />
        <MetricCard
          label="Out of Stock"
          value={data.outOfStockCount}
          description="Items unavailable"
          tone="red"
          icon={<OutIcon />}
        />
        <MetricCard
          label="Inventory Value"
          value={formatCurrency(data.inventoryValue)}
          description="Total inventory value"
          tone="purple"
          icon={<MoneyIcon />}
        />
      </section>

      <section className="dashboard-sales-grid">
        <SalesCard
          title="Daily Sales"
          amount={data.dailyTotal}
          subtitle="Today"
          tone="green"
        >
          <BarChart
            labels={data.daily.labels}
            values={data.daily.values}
            tone="green"
          />
        </SalesCard>

        <SalesCard
          title="Monthly Sales"
          amount={data.monthlyTotal}
          subtitle="This month"
          tone="blue"
        >
          <LineChart
            labels={data.monthly.labels}
            values={data.monthly.values}
            tone="blue"
          />
        </SalesCard>

        <SalesCard
          title="Yearly Sales"
          amount={data.yearlyTotal}
          subtitle="This year"
          tone="purple"
        >
          <BarChart
            labels={data.yearly.labels}
            values={data.yearly.values}
            tone="purple"
          />
        </SalesCard>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-eyebrow">Sales overview</p>
              <h3>Sales by Category</h3>
            </div>
            <span>This Year</span>
          </div>

          <div className="dashboard-category-content">
            <DonutChart items={data.categorySales} total={data.yearlyTotal} />

            <div className="dashboard-category-list">
              {data.categorySales.length === 0 ? (
                <EmptyState text="No Stock Out transactions recorded yet." />
              ) : (
                data.categorySales.slice(0, 6).map((item, index) => (
                  <div className="dashboard-category-row" key={item.name}>
                    <span
                      className="dashboard-category-dot"
                      style={{ background: COLORS[index % COLORS.length] }}
                    />
                    <strong>{item.name}</strong>
                    <span>{formatCurrency(item.amount)}</span>
                    <small>
                      {data.yearlyTotal > 0
                        ? `${Math.round((item.amount / data.yearlyTotal) * 100)}%`
                        : "0%"}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-eyebrow">Latest activity</p>
              <h3>Recent Sales</h3>
            </div>
            <span>{data.recent.length} records</span>
          </div>

          {data.recent.length === 0 ? (
            <EmptyState text="Stock Out transactions will appear here." />
          ) : (
            <div className="dashboard-recent-table-wrapper">
              <table className="dashboard-recent-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <strong>{sale.productName}</strong>
                        <span>{sale.productSku || "No SKU"}</span>
                      </td>
                      <td>
                        <span className="dashboard-sale-badge">Sale</span>
                      </td>
                      <td>{sale.quantity}</td>
                      <td>{formatCurrency(sale.amount)}</td>
                      <td>{formatTime(sale.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <p className="dashboard-sales-note">
        For now, every Stock Out movement is treated as a sale. You can replace
        this with a dedicated Sales module later.
      </p>
    </main>
  );
}

function MetricCard({ label, value, description, tone, icon }) {
  return (
    <article className={`dashboard-metric-card dashboard-theme-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{description}</p>
      </div>
      <div className="dashboard-metric-icon">{icon}</div>
    </article>
  );
}

function SalesCard({ title, amount, subtitle, tone, children }) {
  return (
    <article className={`dashboard-sales-card dashboard-theme-${tone}`}>
      <div className="dashboard-sales-heading">
        <div>
          <span>{title}</span>
          <strong>{formatCurrency(amount)}</strong>
          <p>{subtitle}</p>
        </div>
        <div className="dashboard-sales-icon">
          <CalendarIcon />
        </div>
      </div>
      <div className="dashboard-sales-pill">Stock Out value</div>
      <div className="dashboard-chart-container">{children}</div>
    </article>
  );
}

function BarChart({ values, labels, tone }) {
  const width = 620;
  const height = 220;
  const chartTop = 14;
  const chartBottom = 36;
  const chartHeight = height - chartTop - chartBottom;
  const max = Math.max(...values, 1);
  const gap = 5;
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg
      className={`dashboard-chart dashboard-chart-${tone}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 1, 2, 3].map((line) => {
        const y = chartTop + (chartHeight / 3) * line;
        return (
          <line
            key={line}
            className="dashboard-chart-grid-line"
            x1="0"
            x2={width}
            y1={y}
            y2={y}
          />
        );
      })}

      {values.map((value, index) => {
        const barHeight = (value / max) * chartHeight;
        return (
          <rect
            key={`${labels[index]}-${index}`}
            className="dashboard-chart-bar"
            x={index * (barWidth + gap)}
            y={chartTop + chartHeight - barHeight}
            width={Math.max(barWidth, 3)}
            height={Math.max(barHeight, 2)}
            rx="3"
          />
        );
      })}

      {labels.map((label, index) => {
        const show =
          labels.length <= 12 ||
          index === 0 ||
          index === labels.length - 1 ||
          index % 5 === 0;
        if (!show) return null;
        const x = index * (barWidth + gap) + barWidth / 2;
        return (
          <text
            key={`${label}-label`}
            className="dashboard-chart-label"
            x={x}
            y={height - 8}
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function LineChart({ values, labels, tone }) {
  const width = 620;
  const height = 220;
  const chartTop = 14;
  const chartBottom = 36;
  const chartHeight = height - chartTop - chartBottom;
  const max = Math.max(...values, 1);

  const points = values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: chartTop + chartHeight - (value / max) * chartHeight,
  }));

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    `0,${chartTop + chartHeight}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${width},${chartTop + chartHeight}`,
  ].join(" ");

  return (
    <svg
      className={`dashboard-chart dashboard-chart-${tone}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 1, 2, 3].map((line) => {
        const y = chartTop + (chartHeight / 3) * line;
        return (
          <line
            key={line}
            className="dashboard-chart-grid-line"
            x1="0"
            x2={width}
            y1={y}
            y2={y}
          />
        );
      })}
      <polygon className="dashboard-chart-area" points={areaPoints} />
      <polyline className="dashboard-chart-line" points={linePoints} />
      {points.map((point, index) => (
        <circle
          key={index}
          className="dashboard-chart-point"
          cx={point.x}
          cy={point.y}
          r="4"
        />
      ))}
      {labels.map((label, index) => {
        const show =
          index === 0 || index === labels.length - 1 || index % 5 === 0;
        if (!show) return null;
        return (
          <text
            key={`${label}-label`}
            className="dashboard-chart-label"
            x={points[index].x}
            y={height - 8}
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function DonutChart({ items, total }) {
  let start = 0;
  const stops = items.slice(0, 6).map((item, index) => {
    const portion = total > 0 ? (item.amount / total) * 100 : 0;
    const stop = `${COLORS[index % COLORS.length]} ${start}% ${start + portion}%`;
    start += portion;
    return stop;
  });

  return (
    <div
      className="dashboard-donut"
      style={{
        background: stops.length
          ? `conic-gradient(${stops.join(", ")})`
          : "conic-gradient(#e5e7eb 0 100%)",
      }}
    >
      <div>
        <strong>{formatCurrency(total)}</strong>
        <span>Total Sales</span>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="dashboard-small-empty">
      <span>—</span>
      <p>{text}</p>
    </div>
  );
}

function buildDashboardData(products, movements) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  const normalized = movements.map((movement) => {
    const product = productMap.get(movement.productId);
    const quantity = Number(movement.quantity ?? 0);
    const unitPrice = Number(
      movement.unitPrice ?? movement.price ?? product?.price ?? 0,
    );

    return {
      ...movement,
      quantity,
      amount: Number(
        movement.totalAmount ?? movement.amount ?? quantity * unitPrice,
      ),
      category: movement.category ?? product?.category ?? "OTHERS",
      productName: movement.productName ?? product?.name ?? "Unknown Product",
      productSku: movement.productSku ?? product?.sku ?? "",
      date: toDate(movement.createdAt),
    };
  });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const dailySales = normalized.filter((item) => item.date >= todayStart);
  const monthlySales = normalized.filter((item) => item.date >= monthStart);
  const yearlySales = normalized.filter((item) => item.date >= yearStart);

  const categoryMap = new Map();
  yearlySales.forEach((item) =>
    categoryMap.set(
      item.category,
      (categoryMap.get(item.category) ?? 0) + item.amount,
    ),
  );

  return {
    totalProducts: products.length,
    totalStock: products.reduce(
      (total, product) => total + Number(product.quantity ?? 0),
      0,
    ),
    inventoryValue: products.reduce(
      (total, product) =>
        total + Number(product.quantity ?? 0) * Number(product.price ?? 0),
      0,
    ),
    lowStockCount: products.filter(
      (product) =>
        Number(product.quantity ?? 0) > 0 &&
        Number(product.quantity ?? 0) <= Number(product.reorderLevel ?? 0),
    ).length,
    outOfStockCount: products.filter(
      (product) => Number(product.quantity ?? 0) === 0,
    ).length,
    dailyTotal: sumAmounts(dailySales),
    monthlyTotal: sumAmounts(monthlySales),
    yearlyTotal: sumAmounts(yearlySales),
    daily: createDailySeries(dailySales, now),
    monthly: createMonthlySeries(monthlySales, now),
    yearly: createYearlySeries(yearlySales, now),
    categorySales: [...categoryMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    recent: normalized.filter((item) => item.date.getTime() > 0).slice(0, 6),
  };
}

function createDailySeries(items, now) {
  const labels = [
    "12 AM",
    "3 AM",
    "6 AM",
    "9 AM",
    "12 PM",
    "3 PM",
    "6 PM",
    "9 PM",
  ];
  const values = Array(8).fill(0);
  items.forEach((item) => {
    if (sameDay(item.date, now))
      values[Math.min(Math.floor(item.date.getHours() / 3), 7)] += item.amount;
  });
  return { labels, values };
}

function createMonthlySeries(items, now) {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const labels = Array.from({ length: days }, (_, index) => String(index + 1));
  const values = Array(days).fill(0);
  items.forEach((item) => {
    if (
      item.date.getFullYear() === now.getFullYear() &&
      item.date.getMonth() === now.getMonth()
    ) {
      values[item.date.getDate() - 1] += item.amount;
    }
  });
  return { labels, values };
}

function createYearlySeries(items, now) {
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const values = Array(12).fill(0);
  items.forEach((item) => {
    if (item.date.getFullYear() === now.getFullYear())
      values[item.date.getMonth()] += item.amount;
  });
  return { labels, values };
}

function sumAmounts(items) {
  return items.reduce((total, item) => total + Number(item.amount ?? 0), 0);
}

function sameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function toDate(value) {
  if (!value) return new Date(0);
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function formatTime(value) {
  const date = toDate(value);
  return date.getTime() === 0
    ? "No date"
    : new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
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
