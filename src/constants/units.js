export const UNIT_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const UNIT_STATUS_LABELS = Object.freeze({
  ACTIVE: "Active",
  INACTIVE: "Inactive",
});

export const UNIT_OPTIONS = Object.freeze([
  Object.freeze({
    name: "Piece",
    code: "PIECE",
    abbreviation: "PCS",
  }),

  Object.freeze({
    name: "Box",
    code: "BOX",
    abbreviation: "BOX",
  }),

  Object.freeze({
    name: "Set",
    code: "SET",
    abbreviation: "SET",
  }),

  Object.freeze({
    name: "Meter",
    code: "METER",
    abbreviation: "M",
  }),

  Object.freeze({
    name: "Liter",
    code: "LITER",
    abbreviation: "L",
  }),

  Object.freeze({
    name: "Gallon",
    code: "GALLON",
    abbreviation: "GAL",
  }),

  Object.freeze({
    name: "Roll",
    code: "ROLL",
    abbreviation: "ROLL",
  }),

  Object.freeze({
    name: "Pack",
    code: "PACK",
    abbreviation: "PACK",
  }),
]);

export const UNIT_LIMITS = Object.freeze({
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,

  CODE_MIN_LENGTH: 2,
  CODE_MAX_LENGTH: 50,

  ABBREVIATION_MIN_LENGTH: 1,
  ABBREVIATION_MAX_LENGTH: 10,

  DESCRIPTION_MAX_LENGTH: 500,
});

/**
 * Cleans unnecessary spaces while preserving
 * the intended capitalization of the unit name.
 */
export function normalizeUnitName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Creates the permanent Firestore unit code.
 */
export function createUnitCode(value) {
  return normalizeUnitName(value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, UNIT_LIMITS.CODE_MAX_LENGTH);
}

/**
 * Normalizes unit abbreviations.
 */
export function normalizeUnitAbbreviation(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Validates abbreviations such as PCS, BOX, M,
 * L, GAL, and PACK.
 */
export function isValidUnitAbbreviation(value) {
  const abbreviation =
    normalizeUnitAbbreviation(value);

  return /^[A-Z0-9]{1,10}$/.test(
    abbreviation,
  );
}

export function isValidUnitStatus(status) {
  return Object.values(
    UNIT_STATUSES,
  ).includes(status);
}