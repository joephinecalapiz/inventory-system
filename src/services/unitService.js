import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  UNIT_LIMITS,
  UNIT_OPTIONS,

  UNIT_STATUSES,
  createUnitCode,
  isValidUnitAbbreviation,
  isValidUnitStatus,
  normalizeUnitAbbreviation,
  normalizeUnitName,
} from "../constants/units";

const unitsCollection = collection(
  db,
  "units",
);

/**
 * Returns the currently signed-in Firebase UID.
 */
function getCurrentUserId() {
  const currentUserId =
    auth.currentUser?.uid;

  if (!currentUserId) {
    throw new Error(
      "You must be signed in to manage units of measurement.",
    );
  }

  return currentUserId;
}

/**
 * Validates and cleans the unit name.
 */
function prepareUnitName(value) {
  const unitName =
    normalizeUnitName(value);

  if (
    unitName.length <
    UNIT_LIMITS.NAME_MIN_LENGTH
  ) {
    throw new Error(
      "The unit name must contain at least 2 characters.",
    );
  }

  if (
    unitName.length >
    UNIT_LIMITS.NAME_MAX_LENGTH
  ) {
    throw new Error(
      "The unit name cannot exceed 100 characters.",
    );
  }

  return unitName;
}

/**
 * Validates and cleans the unit abbreviation.
 */
function prepareUnitAbbreviation(value) {
  const abbreviation =
    normalizeUnitAbbreviation(value);

  if (
    !isValidUnitAbbreviation(
      abbreviation,
    )
  ) {
    throw new Error(
      "The abbreviation must contain 1 to 10 uppercase letters or numbers.",
    );
  }

  return abbreviation;
}

/**
 * Validates and cleans the optional description.
 */
function prepareUnitDescription(value) {
  const description = String(
    value ?? "",
  ).trim();

  if (
    description.length >
    UNIT_LIMITS.DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(
      "The unit description cannot exceed 500 characters.",
    );
  }

  return description;
}

/**
 * Listens for all Unit of Measurement records.
 */
export function subscribeToUnits(
  onUnitsChanged,
  onError,
) {
  const unitsQuery = query(
    unitsCollection,
    orderBy("name", "asc"),
  );

  return onSnapshot(
    unitsQuery,

    (snapshot) => {
      const units =
        snapshot.docs.map(
          (unitDocument) => ({
            id: unitDocument.id,
            ...unitDocument.data(),
          }),
        );

      onUnitsChanged(units);
    },

    (error) => {
      console.error(
        "Unable to load units of measurement:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}

/**
 * Listens only for ACTIVE units.
 *
 * The filtering is done in JavaScript so no
 * additional Firestore index is required.
 */
export function subscribeToActiveUnits(
  onUnitsChanged,
  onError,
) {
  return subscribeToUnits(
    (units) => {
      const activeUnits =
        units.filter(
          (unit) =>
            unit.status ===
            UNIT_STATUSES.ACTIVE,
        );

      onUnitsChanged(activeUnits);
    },

    onError,
  );
}

/**
 * Reads one unit using its permanent code.
 */
export async function getUnitByCode(
  unitCode,
) {
  const normalizedCode =
    createUnitCode(unitCode);

  if (!normalizedCode) {
    throw new Error(
      "A valid unit code is required.",
    );
  }

  const unitReference = doc(
    db,
    "units",
    normalizedCode,
  );

  const unitSnapshot =
    await getDoc(unitReference);

  if (!unitSnapshot.exists()) {
    return null;
  }

  return {
    id: unitSnapshot.id,
    ...unitSnapshot.data(),
  };
}

/**
 * Creates a Unit of Measurement and permanently
 * reserves its abbreviation.
 */
export async function createUnit(
  unitData,
) {
  const currentUserId =
    getCurrentUserId();

  const name = prepareUnitName(
    unitData?.name,
  );

  const code =
    createUnitCode(name);

  if (
    code.length <
    UNIT_LIMITS.CODE_MIN_LENGTH
  ) {
    throw new Error(
      "Unable to generate a valid unit code.",
    );
  }

  const abbreviation =
    prepareUnitAbbreviation(
      unitData?.abbreviation,
    );

  const description =
    prepareUnitDescription(
      unitData?.description,
    );

  const unitReference = doc(
    db,
    "units",
    code,
  );

  const abbreviationReference = doc(
    db,
    "unitAbbreviations",
    abbreviation,
  );

  await runTransaction(
    db,
    async (transaction) => {
      /*
       * All reads must happen before writes.
       */
      const unitSnapshot =
        await transaction.get(
          unitReference,
        );

      const abbreviationSnapshot =
        await transaction.get(
          abbreviationReference,
        );

      if (unitSnapshot.exists()) {
        throw new Error(
          `The unit "${name}" already exists.`,
        );
      }

      if (
        abbreviationSnapshot.exists()
      ) {
        const existingUnitCode =
          abbreviationSnapshot.data()
            .unitCode;

        throw new Error(
          `The abbreviation ${abbreviation} is already assigned to ${existingUnitCode}.`,
        );
      }

      transaction.set(
        unitReference,
        {
          name,
          code,
          abbreviation,
          description,

          status:
            UNIT_STATUSES.ACTIVE,

          createdBy:
            currentUserId,

          createdAt:
            serverTimestamp(),

          updatedBy:
            currentUserId,

          updatedAt:
            serverTimestamp(),
        },
      );

      transaction.set(
        abbreviationReference,
        {
          abbreviation,
          unitCode: code,

          createdBy:
            currentUserId,

          createdAt:
            serverTimestamp(),
        },
      );
    },
  );

  return {
    id: code,
    code,
    name,
    abbreviation,
    description,
    status:
      UNIT_STATUSES.ACTIVE,
  };
}

/**
 * Updates the editable Unit fields.
 *
 * Unit code and abbreviation remain permanent
 * and are intentionally excluded.
 */
export async function updateUnit(
  unitId,
  unitData,
) {
  const currentUserId =
    getCurrentUserId();

  const normalizedUnitId =
    createUnitCode(unitId);

  if (!normalizedUnitId) {
    throw new Error(
      "A valid unit ID is required.",
    );
  }

  const unitReference = doc(
    db,
    "units",
    normalizedUnitId,
  );

  const unitSnapshot =
    await getDoc(unitReference);

  if (!unitSnapshot.exists()) {
    throw new Error(
      "The selected unit no longer exists.",
    );
  }

  const existingUnit =
    unitSnapshot.data();

  const name = prepareUnitName(
    unitData?.name ??
      existingUnit.name,
  );

  const description =
    prepareUnitDescription(
      unitData?.description ??
        existingUnit.description,
    );

  const status =
    unitData?.status ??
    existingUnit.status;

  if (!isValidUnitStatus(status)) {
    throw new Error(
      "The unit status must be ACTIVE or INACTIVE.",
    );
  }

  await updateDoc(
    unitReference,
    {
      name,
      description,
      status,

      updatedBy:
        currentUserId,

      updatedAt:
        serverTimestamp(),
    },
  );

  return {
    id:
      normalizedUnitId,

    code:
      existingUnit.code,

    abbreviation:
      existingUnit.abbreviation,

    name,
    description,
    status,
  };
}

/**
 * Activates or deactivates a unit.
 */
export async function updateUnitStatus(
  unitId,
  status,
) {
  if (!isValidUnitStatus(status)) {
    throw new Error(
      "The unit status must be ACTIVE or INACTIVE.",
    );
  }

  return updateUnit(
    unitId,
    {
      status,
    },
  );
}

/**
 * Imports the approved default units.
 *
 * Existing unit records are skipped, making
 * this safe to run again after a partial import.
 */
export async function seedDefaultUnits() {
  const results = [];

  for (const unitData of UNIT_OPTIONS) {
    try {
      const existingUnit = await getUnitByCode(
        unitData.code,
      );

      if (existingUnit) {
        results.push({
          code: unitData.code,
          name: unitData.name,
          abbreviation: unitData.abbreviation,
          status: "SKIPPED",
          message: "Unit already exists.",
        });

        continue;
      }

      await createUnit({
        name: unitData.name,
        abbreviation: unitData.abbreviation,
        description: "",
      });

      results.push({
        code: unitData.code,
        name: unitData.name,
        abbreviation: unitData.abbreviation,
        status: "CREATED",
        message: "Unit imported successfully.",
      });
    } catch (error) {
      console.error(
        `Unable to import unit ${unitData.name}:`,
        error,
      );

      results.push({
        code: unitData.code,
        name: unitData.name,
        abbreviation: unitData.abbreviation,
        status: "FAILED",
        message:
          error?.message ||
          "Unable to import unit.",
      });
    }
  }

  return {
    totalCount: UNIT_OPTIONS.length,

    createdCount: results.filter(
      (result) =>
        result.status === "CREATED",
    ).length,

    skippedCount: results.filter(
      (result) =>
        result.status === "SKIPPED",
    ).length,

    failedCount: results.filter(
      (result) =>
        result.status === "FAILED",
    ).length,

    results,
  };
}

