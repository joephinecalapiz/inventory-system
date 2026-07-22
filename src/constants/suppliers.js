export const SUPPLIER_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const SUPPLIER_STATUS_LABELS = Object.freeze({
  ACTIVE: "Active",
  INACTIVE: "Inactive",
});

export const SUPPLIER_PAYMENT_TERMS = Object.freeze({
  CASH_ON_DELIVERY: "CASH_ON_DELIVERY",
  PREPAID: "PREPAID",
  NET_7: "NET_7",
  NET_15: "NET_15",
  NET_30: "NET_30",
  NET_45: "NET_45",
  NET_60: "NET_60",
  CUSTOM: "CUSTOM",
});

export const SUPPLIER_PAYMENT_TERM_LABELS = Object.freeze({
  CASH_ON_DELIVERY: "Cash on Delivery",
  PREPAID: "Prepaid",
  NET_7: "Net 7 Days",
  NET_15: "Net 15 Days",
  NET_30: "Net 30 Days",
  NET_45: "Net 45 Days",
  NET_60: "Net 60 Days",
  CUSTOM: "Custom Terms",
});

export const SUPPLIER_PAYMENT_TERM_OPTIONS = Object.freeze(
  Object.values(SUPPLIER_PAYMENT_TERMS).map((value) =>
    Object.freeze({
      value,
      label: SUPPLIER_PAYMENT_TERM_LABELS[value],
    }),
  ),
);

export const SUPPLIER_LIMITS = Object.freeze({
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 150,

  CONTACT_PERSON_MAX_LENGTH: 100,
  CONTACT_NUMBER_MAX_LENGTH: 30,
  EMAIL_MAX_LENGTH: 150,

  ADDRESS_MAX_LENGTH: 300,
  TIN_MAX_LENGTH: 50,

  CUSTOM_PAYMENT_TERMS_MAX_LENGTH: 100,
  NOTES_MAX_LENGTH: 500,

  MAX_CODE_SEQUENCE: 999999,
});

/**
 * Removes leading, trailing, and repeated spaces.
 */
export function normalizeSupplierText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Used for consistent searching and comparisons.
 */
export function normalizeSupplierName(value) {
  return normalizeSupplierText(value).toUpperCase();
}

export function normalizeSupplierEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeSupplierContactNumber(value) {
  return normalizeSupplierText(value);
}

export function normalizeSupplierTin(value) {
  return normalizeSupplierText(value).toUpperCase();
}

export function isValidSupplierStatus(value) {
  return Object.values(SUPPLIER_STATUSES).includes(value);
}

export function isValidSupplierPaymentTerm(value) {
  return Object.values(SUPPLIER_PAYMENT_TERMS).includes(value);
}

export function isValidSupplierName(value) {
  const name = normalizeSupplierText(value);

  return (
    name.length >= SUPPLIER_LIMITS.NAME_MIN_LENGTH &&
    name.length <= SUPPLIER_LIMITS.NAME_MAX_LENGTH
  );
}

export function isValidSupplierContactPerson(value) {
  return (
    normalizeSupplierText(value).length <=
    SUPPLIER_LIMITS.CONTACT_PERSON_MAX_LENGTH
  );
}

export function isValidSupplierContactNumber(value) {
  const contactNumber = normalizeSupplierContactNumber(value);

  if (!contactNumber) {
    return true;
  }

  return (
    contactNumber.length <= SUPPLIER_LIMITS.CONTACT_NUMBER_MAX_LENGTH &&
    /^[0-9+().\-\s]+$/.test(contactNumber)
  );
}

export function isValidSupplierEmail(value) {
  const email = normalizeSupplierEmail(value);

  if (!email) {
    return true;
  }

  if (email.length > SUPPLIER_LIMITS.EMAIL_MAX_LENGTH) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidSupplierAddress(value) {
  return (
    normalizeSupplierText(value).length <=
    SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH
  );
}

export function isValidSupplierTin(value) {
  const tin = normalizeSupplierTin(value);

  if (!tin) {
    return true;
  }

  return (
    tin.length <= SUPPLIER_LIMITS.TIN_MAX_LENGTH &&
    /^[A-Z0-9\-\s]+$/.test(tin)
  );
}

export function isValidCustomPaymentTerms(value, paymentTerm) {
  const customPaymentTerms = normalizeSupplierText(value);

  if (paymentTerm !== SUPPLIER_PAYMENT_TERMS.CUSTOM) {
    return customPaymentTerms.length === 0;
  }

  return (
    customPaymentTerms.length >= 1 &&
    customPaymentTerms.length <=
      SUPPLIER_LIMITS.CUSTOM_PAYMENT_TERMS_MAX_LENGTH
  );
}

export function isValidSupplierNotes(value) {
  return (
    String(value ?? "").trim().length <= SUPPLIER_LIMITS.NOTES_MAX_LENGTH
  );
}

/**
 * Converts a numeric supplier sequence into:
 *
 * 1      -> SUP-000001
 * 25     -> SUP-000025
 * 1000   -> SUP-001000
 */
export function formatSupplierCode(sequence) {
  const numericSequence = Number(sequence);

  if (
    !Number.isInteger(numericSequence) ||
    numericSequence < 1 ||
    numericSequence > SUPPLIER_LIMITS.MAX_CODE_SEQUENCE
  ) {
    throw new Error("The supplier sequence is invalid.");
  }

  return `SUP-${String(numericSequence).padStart(6, "0")}`;
}

export function createEmptySupplierForm() {
  return {
    name: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    address: "",
    tin: "",

    paymentTerm: SUPPLIER_PAYMENT_TERMS.CASH_ON_DELIVERY,
    customPaymentTerms: "",

    notes: "",
  };
}