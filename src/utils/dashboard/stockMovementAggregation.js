import {
  DASHBOARD_CHART_LIMITS,
} from "../../constants/dashboard/index.js";

import {
  INVENTORY_TRANSACTION_TYPES,
} from "../../constants/reports/index.js";

const INBOUND_TYPES = Object.freeze([
  INVENTORY_TRANSACTION_TYPES.OPENING_STOCK,
  INVENTORY_TRANSACTION_TYPES.STOCK_IN,
  INVENTORY_TRANSACTION_TYPES.GOODS_RECEIPT,
  INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_INCREASE,
  INVENTORY_TRANSACTION_TYPES.RETURN_IN,
]);

const OUTBOUND_TYPES = Object.freeze([
  INVENTORY_TRANSACTION_TYPES.STOCK_OUT,
  INVENTORY_TRANSACTION_TYPES.ADJUSTMENT_DECREASE,
  INVENTORY_TRANSACTION_TYPES.RETURN_OUT,
]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUppercase(value) {
  return normalizeText(value).toUpperCase();
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getTransactionDate(transaction = {}) {
  return toDate(
    transaction.transactionDate ??
      transaction.createdAt ??
      transaction.updatedAt,
  );
}

function getQuantityChanged(transaction = {}) {
  const quantityChanged = toFiniteNumber(
    transaction.quantityChanged,
    Number.NaN,
  );

  if (Number.isFinite(quantityChanged)) {
    return quantityChanged;
  }

  const quantityIn = Math.abs(
    toFiniteNumber(transaction.quantityIn, 0),
  );

  const quantityOut = Math.abs(
    toFiniteNumber(transaction.quantityOut, 0),
  );

  return quantityIn - quantityOut;
}

function isInbound(transactionType) {
  return INBOUND_TYPES.includes(normalizeUppercase(transactionType));
}

function isOutbound(transactionType) {
  return OUTBOUND_TYPES.includes(normalizeUppercase(transactionType));
}

function getMonthStart(referenceDate) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
}

function getMonthEndExclusive(referenceDate) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    1,
  );
}

function getYearStart(referenceDate) {
  return new Date(referenceDate.getFullYear(), 0, 1);
}

function getYearEndExclusive(referenceDate) {
  return new Date(referenceDate.getFullYear() + 1, 0, 1);
}

function isWithinRange(date, startDate, endDateExclusive) {
  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date >= startDate &&
    date < endDateExclusive
  );
}

export function aggregateMonthlyStockInOut(
  transactions = [],
  referenceDate = new Date(),
) {
  const monthStart = getMonthStart(referenceDate);
  const monthEndExclusive = getMonthEndExclusive(referenceDate);

  const daysInMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  ).getDate();

  const labels = Array.from(
    { length: daysInMonth },
    (_, index) => String(index + 1),
  );

  const stockIn = Array(daysInMonth).fill(0);
  const stockOut = Array(daysInMonth).fill(0);

  for (const transaction of transactions) {
    const transactionDate = getTransactionDate(transaction);

    if (
      !isWithinRange(
        transactionDate,
        monthStart,
        monthEndExclusive,
      )
    ) {
      continue;
    }

    const dayIndex = transactionDate.getDate() - 1;
    const quantityChanged = getQuantityChanged(transaction);
    const transactionType = transaction.transactionType;

    if (isInbound(transactionType)) {
      stockIn[dayIndex] += Math.abs(quantityChanged);
    }

    if (isOutbound(transactionType)) {
      stockOut[dayIndex] += Math.abs(quantityChanged);
    }
  }

  return {
    labels,
    stockIn,
    stockOut,
    totals: {
      stockIn: stockIn.reduce((total, value) => total + value, 0),
      stockOut: stockOut.reduce((total, value) => total + value, 0),
    },
  };
}

export function aggregateYearlyStockInOut(
  transactions = [],
  referenceDate = new Date(),
) {
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

  const stockIn = Array(12).fill(0);
  const stockOut = Array(12).fill(0);

  const yearStart = getYearStart(referenceDate);
  const yearEndExclusive = getYearEndExclusive(referenceDate);

  for (const transaction of transactions) {
    const transactionDate = getTransactionDate(transaction);

    if (
      !isWithinRange(
        transactionDate,
        yearStart,
        yearEndExclusive,
      )
    ) {
      continue;
    }

    const monthIndex = transactionDate.getMonth();
    const quantityChanged = getQuantityChanged(transaction);

    if (isInbound(transaction.transactionType)) {
      stockIn[monthIndex] += Math.abs(quantityChanged);
    }

    if (isOutbound(transaction.transactionType)) {
      stockOut[monthIndex] += Math.abs(quantityChanged);
    }
  }

  return {
    labels,
    stockIn,
    stockOut,
    totals: {
      stockIn: stockIn.reduce((total, value) => total + value, 0),
      stockOut: stockOut.reduce((total, value) => total + value, 0),
    },
  };
}

export function aggregateInventoryValueByCategory(
  products = [],
  limit = DASHBOARD_CHART_LIMITS.CATEGORY_BREAKDOWN,
) {
  const categoryMap = new Map();

  for (const product of products) {
    const quantity = Math.max(
      toFiniteNumber(product.quantity, 0),
      0,
    );

    const unitCost = Math.max(
      toFiniteNumber(
        product.costPrice ?? product.unitCost,
        0,
      ),
      0,
    );

    const value = quantity * unitCost;

    const category =
      normalizeText(
        product.category ??
          product.categoryName ??
          product.categoryCode,
      ) || "Uncategorized";

    categoryMap.set(
      category,
      (categoryMap.get(category) ?? 0) + value,
    );
  }

  return [...categoryMap.entries()]
    .map(([name, value]) => ({
      name,
      value:
        Math.round((value + Number.EPSILON) * 100) / 100,
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, Math.max(Number(limit) || 0, 0));
}

export function aggregateMostIssuedProducts(
  transactions = [],
  limit = DASHBOARD_CHART_LIMITS.MOST_ISSUED_PRODUCTS,
) {
  const productMap = new Map();

  for (const transaction of transactions) {
    if (!isOutbound(transaction.transactionType)) {
      continue;
    }

    const productId =
      normalizeText(transaction.productId) ||
      normalizeText(transaction.sku) ||
      normalizeText(transaction.productName);

    if (!productId) {
      continue;
    }

    const quantity = Math.abs(getQuantityChanged(transaction));

    const current = productMap.get(productId) ?? {
      productId,
      productName:
        normalizeText(transaction.productName) ||
        "Unknown Product",
      sku: normalizeText(transaction.sku),
      quantityIssued: 0,
      transactionCount: 0,
    };

    current.quantityIssued += quantity;
    current.transactionCount += 1;

    productMap.set(productId, current);
  }

  return [...productMap.values()]
    .sort(
      (first, second) =>
        second.quantityIssued - first.quantityIssued ||
        second.transactionCount - first.transactionCount,
    )
    .slice(0, Math.max(Number(limit) || 0, 0));
}

export function buildRecentStockMovements(
  transactions = [],
  limit = DASHBOARD_CHART_LIMITS.RECENT_STOCK_MOVEMENTS,
) {
  return transactions
    .map((transaction) => {
      const date = getTransactionDate(transaction);
      const quantityChanged = getQuantityChanged(transaction);

      return {
        id: transaction.id,
        referenceNumber:
          normalizeText(transaction.referenceNumber) ||
          normalizeText(transaction.id),
        productId: normalizeText(transaction.productId),
        productName:
          normalizeText(transaction.productName) ||
          "Unknown Product",
        sku: normalizeText(transaction.sku),
        transactionType: normalizeUppercase(
          transaction.transactionType,
        ),
        quantityChanged,
        direction:
          quantityChanged > 0
            ? "IN"
            : quantityChanged < 0
              ? "OUT"
              : "NEUTRAL",
        performedByName:
          normalizeText(transaction.performedByName) ||
          "Unknown User",
        transactionDate: date,
      };
    })
    .filter(
      (movement) =>
        movement.transactionDate instanceof Date &&
        !Number.isNaN(movement.transactionDate.getTime()),
    )
    .sort(
      (first, second) =>
        second.transactionDate.getTime() -
        first.transactionDate.getTime(),
    )
    .slice(0, Math.max(Number(limit) || 0, 0));
}

export function buildDashboardMovementAnalytics({
  products = [],
  transactions = [],
  referenceDate = new Date(),
} = {}) {
  return {
    monthlyStockInOut: aggregateMonthlyStockInOut(
      transactions,
      referenceDate,
    ),

    yearlyStockInOut: aggregateYearlyStockInOut(
      transactions,
      referenceDate,
    ),

    inventoryValueByCategory:
      aggregateInventoryValueByCategory(products),

    mostIssuedProducts:
      aggregateMostIssuedProducts(transactions),

    recentStockMovements:
      buildRecentStockMovements(transactions),
  };
}
