import {
  DASHBOARD_TIME_RANGES,
} from "../../constants/dashboard/index.js";

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function roundNumber(value, decimals = 2) {
  const multiplier = 10 ** decimals;

  return (
    Math.round(
      (toFiniteNumber(value, 0) + Number.EPSILON) * multiplier,
    ) / multiplier
  );
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

function startOfDay(value) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
}

function addDays(value, numberOfDays) {
  const nextDate = new Date(value);

  nextDate.setDate(nextDate.getDate() + numberOfDays);

  return nextDate;
}

function startOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value, numberOfMonths) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + numberOfMonths,
    1,
  );
}

function startOfYear(value) {
  return new Date(value.getFullYear(), 0, 1);
}

function addYears(value, numberOfYears) {
  return new Date(value.getFullYear() + numberOfYears, 0, 1);
}

function isWithinRange(date, startDate, endDateExclusive) {
  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date >= startDate &&
    date < endDateExclusive
  );
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function resolveRange(
  range = DASHBOARD_TIME_RANGES.THIS_MONTH,
  referenceDate = new Date(),
) {
  switch (range) {
    case DASHBOARD_TIME_RANGES.TODAY: {
      const currentStart = startOfDay(referenceDate);
      const currentEnd = addDays(currentStart, 1);
      const previousStart = addDays(currentStart, -1);

      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd: currentStart,
      };
    }

    case DASHBOARD_TIME_RANGES.LAST_7_DAYS: {
      const currentEnd = addDays(startOfDay(referenceDate), 1);
      const currentStart = addDays(currentEnd, -7);
      const previousStart = addDays(currentStart, -7);

      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd: currentStart,
      };
    }

    case DASHBOARD_TIME_RANGES.LAST_30_DAYS: {
      const currentEnd = addDays(startOfDay(referenceDate), 1);
      const currentStart = addDays(currentEnd, -30);
      const previousStart = addDays(currentStart, -30);

      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd: currentStart,
      };
    }

    case DASHBOARD_TIME_RANGES.THIS_YEAR: {
      const currentStart = startOfYear(referenceDate);
      const currentEnd = addYears(currentStart, 1);
      const previousStart = addYears(currentStart, -1);

      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd: currentStart,
      };
    }

    case DASHBOARD_TIME_RANGES.THIS_MONTH:
    default: {
      const currentStart = startOfMonth(referenceDate);
      const currentEnd = addMonths(currentStart, 1);
      const previousStart = addMonths(currentStart, -1);

      return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd: currentStart,
      };
    }
  }
}

function sumByDateRange(
  records,
  valueSelector,
  dateSelector,
  startDate,
  endDateExclusive,
) {
  return records.reduce((total, record) => {
    const date = toDate(dateSelector(record));

    if (!isWithinRange(date, startDate, endDateExclusive)) {
      return total;
    }

    return total + toFiniteNumber(valueSelector(record), 0);
  }, 0);
}

export function calculateTrend({
  currentValue,
  previousValue,
  decimals = 2,
}) {
  const current = toFiniteNumber(currentValue, 0);
  const previous = toFiniteNumber(previousValue, 0);
  const difference = current - previous;

  if (previous === 0) {
    return {
      currentValue: roundNumber(current, decimals),
      previousValue: roundNumber(previous, decimals),
      difference: roundNumber(difference, decimals),
      percentage: current === 0 ? 0 : 100,
      direction:
        current > 0
          ? "UP"
          : current < 0
            ? "DOWN"
            : "FLAT",
      hasComparablePreviousValue: false,
    };
  }

  const percentage = (difference / Math.abs(previous)) * 100;

  return {
    currentValue: roundNumber(current, decimals),
    previousValue: roundNumber(previous, decimals),
    difference: roundNumber(difference, decimals),
    percentage: roundNumber(percentage, decimals),
    direction:
      difference > 0
        ? "UP"
        : difference < 0
          ? "DOWN"
          : "FLAT",
    hasComparablePreviousValue: true,
  };
}

export function calculateRecordTrend({
  records = [],
  range = DASHBOARD_TIME_RANGES.THIS_MONTH,
  referenceDate = new Date(),
  valueSelector = () => 1,
  dateSelector = (record) =>
    record.transactionDate ??
    record.createdAt ??
    record.updatedAt,
}) {
  const {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  } = resolveRange(range, referenceDate);

  const currentValue = sumByDateRange(
    records,
    valueSelector,
    dateSelector,
    currentStart,
    currentEnd,
  );

  const previousValue = sumByDateRange(
    records,
    valueSelector,
    dateSelector,
    previousStart,
    previousEnd,
  );

  return {
    range,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    ...calculateTrend({
      currentValue,
      previousValue,
    }),
  };
}

export function buildDailyMovementSeries({
  transactions = [],
  days = 30,
  referenceDate = new Date(),
}) {
  const normalizedDays = Math.max(
    Math.trunc(toFiniteNumber(days, 30)),
    1,
  );

  const endDateExclusive = addDays(
    startOfDay(referenceDate),
    1,
  );

  const startDate = addDays(
    endDateExclusive,
    -normalizedDays,
  );

  const points = Array.from(
    { length: normalizedDays },
    (_, index) => {
      const date = addDays(startDate, index);

      return {
        key: date.toISOString().slice(0, 10),
        label: formatDateLabel(date),
        date,
        stockIn: 0,
        stockOut: 0,
        netMovement: 0,
      };
    },
  );

  const pointMap = new Map(
    points.map((point) => [point.key, point]),
  );

  for (const transaction of transactions) {
    const transactionDate = toDate(
      transaction.transactionDate ??
        transaction.createdAt ??
        transaction.updatedAt,
    );

    if (
      !isWithinRange(
        transactionDate,
        startDate,
        endDateExclusive,
      )
    ) {
      continue;
    }

    const key = transactionDate.toISOString().slice(0, 10);
    const point = pointMap.get(key);

    if (!point) {
      continue;
    }

    const quantityChanged = toFiniteNumber(
      transaction.quantityChanged,
      toFiniteNumber(transaction.quantityIn, 0) -
        toFiniteNumber(transaction.quantityOut, 0),
    );

    if (quantityChanged > 0) {
      point.stockIn += quantityChanged;
    }

    if (quantityChanged < 0) {
      point.stockOut += Math.abs(quantityChanged);
    }

    point.netMovement += quantityChanged;
  }

  return {
    labels: points.map((point) => point.label),
    stockIn: points.map((point) => point.stockIn),
    stockOut: points.map((point) => point.stockOut),
    netMovement: points.map((point) => point.netMovement),
    points,
  };
}

export function calculateMovingAverage(
  values = [],
  windowSize = 7,
) {
  const normalizedWindowSize = Math.max(
    Math.trunc(toFiniteNumber(windowSize, 7)),
    1,
  );

  return values.map((_, index) => {
    const startIndex = Math.max(
      0,
      index - normalizedWindowSize + 1,
    );

    const windowValues = values.slice(
      startIndex,
      index + 1,
    );

    const average =
      windowValues.reduce(
        (total, value) =>
          total + toFiniteNumber(value, 0),
        0,
      ) / windowValues.length;

    return roundNumber(average, 2);
  });
}

export function buildDashboardTrendAnalytics({
  transactions = [],
  referenceDate = new Date(),
} = {}) {
  const quantitySelector = (transaction) =>
    Math.abs(
      toFiniteNumber(
        transaction.quantityChanged,
        toFiniteNumber(transaction.quantityIn, 0) -
          toFiniteNumber(transaction.quantityOut, 0),
      ),
    );

  const dateSelector = (transaction) =>
    transaction.transactionDate ??
    transaction.createdAt ??
    transaction.updatedAt;

  const last30Days = buildDailyMovementSeries({
    transactions,
    days: 30,
    referenceDate,
  });

  return {
    movementTrendThisMonth: calculateRecordTrend({
      records: transactions,
      range: DASHBOARD_TIME_RANGES.THIS_MONTH,
      referenceDate,
      valueSelector: quantitySelector,
      dateSelector,
    }),

    movementTrendLast7Days: calculateRecordTrend({
      records: transactions,
      range: DASHBOARD_TIME_RANGES.LAST_7_DAYS,
      referenceDate,
      valueSelector: quantitySelector,
      dateSelector,
    }),

    last30Days: {
      ...last30Days,
      stockInMovingAverage: calculateMovingAverage(
        last30Days.stockIn,
        7,
      ),
      stockOutMovingAverage: calculateMovingAverage(
        last30Days.stockOut,
        7,
      ),
    },
  };
}
