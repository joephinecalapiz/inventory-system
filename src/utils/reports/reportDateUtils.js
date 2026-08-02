import { Timestamp } from "firebase/firestore";

function normalizeDateInput(value, fieldName) {
  const normalized = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const [yearText, monthText, dayText] = normalized.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return date;
}

export function createReportDateRange(dateFrom, dateTo) {
  const startDate = normalizeDateInput(dateFrom, "Start date");

  const inclusiveEndDate = normalizeDateInput(dateTo, "End date");

  if (startDate.getTime() > inclusiveEndDate.getTime()) {
    throw new Error("Start date cannot be later than end date.");
  }

  const endDateExclusive = new Date(inclusiveEndDate);

  endDateExclusive.setDate(endDateExclusive.getDate() + 1);

  return {
    startDate: Timestamp.fromDate(startDate),
    endDateExclusive: Timestamp.fromDate(endDateExclusive),
  };
}

export function getLocalDateKey(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export function getCurrentMonthDateRange() {
  const currentDate = new Date();

  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );

  return {
    dateFrom: getLocalDateKey(firstDay),
    dateTo: getLocalDateKey(currentDate),
  };
}
