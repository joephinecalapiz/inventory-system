import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

import { USER_ROLES } from "../constants/roles";

import {
  SUPPLIER_LIMITS,
  SUPPLIER_PAYMENT_TERMS,
  SUPPLIER_STATUSES,
  formatSupplierCode,
  isValidCustomPaymentTerms,
  isValidSupplierAddress,
  isValidSupplierContactNumber,
  isValidSupplierContactPerson,
  isValidSupplierEmail,
  isValidSupplierName,
  isValidSupplierNotes,
  isValidSupplierPaymentTerm,
  isValidSupplierStatus,
  isValidSupplierTin,
  normalizeSupplierContactNumber,
  normalizeSupplierEmail,
  normalizeSupplierName,
  normalizeSupplierText,
  normalizeSupplierTin,
} from "../constants/suppliers";

const suppliersCollection = collection(db, "suppliers");

const SUPPLIER_MANAGEMENT_ROLES = new Set([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
]);

function getSupplierPermissionError() {
  return new Error(
    "Only an active Superadmin or Admin can manage supplier records.",
  );
}

/**
 * Confirms that the current user may create or
 * update supplier records.
 */
async function getCurrentSupplierManager() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("You must be signed in to manage suppliers.");
  }

  const userReference = doc(db, "users", currentUser.uid);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (userProfile.status !== "ACTIVE") {
    throw getSupplierPermissionError();
  }

  if (!SUPPLIER_MANAGEMENT_ROLES.has(userProfile.role)) {
    throw getSupplierPermissionError();
  }

  return {
    userId: currentUser.uid,
    role: userProfile.role,
  };
}

function prepareSupplierName(value) {
  const name = normalizeSupplierText(value);

  if (!isValidSupplierName(name)) {
    throw new Error(
      `Supplier name must contain ${SUPPLIER_LIMITS.NAME_MIN_LENGTH} to ${SUPPLIER_LIMITS.NAME_MAX_LENGTH} characters.`,
    );
  }

  return name;
}

function prepareContactPerson(value) {
  const contactPerson = normalizeSupplierText(value);

  if (!isValidSupplierContactPerson(contactPerson)) {
    throw new Error(
      `Contact person cannot exceed ${SUPPLIER_LIMITS.CONTACT_PERSON_MAX_LENGTH} characters.`,
    );
  }

  return contactPerson;
}

function prepareContactNumber(value) {
  const contactNumber = normalizeSupplierContactNumber(value);

  if (!isValidSupplierContactNumber(contactNumber)) {
    throw new Error(
      "Enter a valid contact number using numbers, spaces, parentheses, periods, plus signs, or hyphens.",
    );
  }

  return contactNumber;
}

function prepareEmail(value) {
  const email = normalizeSupplierEmail(value);

  if (!isValidSupplierEmail(email)) {
    throw new Error("Enter a valid supplier email address.");
  }

  return email;
}

function prepareAddress(value) {
  const address = normalizeSupplierText(value);

  if (!isValidSupplierAddress(address)) {
    throw new Error(
      `Supplier address cannot exceed ${SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH} characters.`,
    );
  }

  return address;
}

function prepareTin(value) {
  const tin = normalizeSupplierTin(value);

  if (!isValidSupplierTin(tin)) {
    throw new Error(
      "Enter a valid TIN using letters, numbers, spaces, or hyphens.",
    );
  }

  return tin;
}

function preparePaymentTerm(value) {
  const paymentTerm = String(value ?? SUPPLIER_PAYMENT_TERMS.CASH_ON_DELIVERY)
    .trim()
    .toUpperCase();

  if (!isValidSupplierPaymentTerm(paymentTerm)) {
    throw new Error("Select a valid supplier payment term.");
  }

  return paymentTerm;
}

function prepareCustomPaymentTerms(value, paymentTerm) {
  const customPaymentTerms = normalizeSupplierText(value);

  if (!isValidCustomPaymentTerms(customPaymentTerms, paymentTerm)) {
    if (paymentTerm === SUPPLIER_PAYMENT_TERMS.CUSTOM) {
      throw new Error(
        `Custom payment terms are required and cannot exceed ${SUPPLIER_LIMITS.CUSTOM_PAYMENT_TERMS_MAX_LENGTH} characters.`,
      );
    }

    return "";
  }

  return customPaymentTerms;
}

function prepareNotes(value) {
  const notes = String(value ?? "").trim();

  if (!isValidSupplierNotes(notes)) {
    throw new Error(
      `Supplier notes cannot exceed ${SUPPLIER_LIMITS.NOTES_MAX_LENGTH} characters.`,
    );
  }

  return notes;
}

function prepareSupplierData(supplierData) {
  const name = prepareSupplierName(supplierData?.name);

  const paymentTerm = preparePaymentTerm(supplierData?.paymentTerm);

  return {
    name,
    nameNormalized: normalizeSupplierName(name),

    contactPerson: prepareContactPerson(supplierData?.contactPerson),

    contactNumber: prepareContactNumber(supplierData?.contactNumber),

    email: prepareEmail(supplierData?.email),

    address: prepareAddress(supplierData?.address),

    tin: prepareTin(supplierData?.tin),

    paymentTerm,

    customPaymentTerms: prepareCustomPaymentTerms(
      supplierData?.customPaymentTerms,
      paymentTerm,
    ),

    notes: prepareNotes(supplierData?.notes),
  };
}

/**
 * Real-time subscription to every supplier record.
 */
export function subscribeToSuppliers(onData, onError) {
  return onSnapshot(
    suppliersCollection,

    (snapshot) => {
      const suppliers = snapshot.docs.map((supplierDocument) => ({
        id: supplierDocument.id,
        ...supplierDocument.data(),
      }));

      suppliers.sort((firstSupplier, secondSupplier) => {
        const firstStatus =
          firstSupplier.status === SUPPLIER_STATUSES.INACTIVE ? 1 : 0;

        const secondStatus =
          secondSupplier.status === SUPPLIER_STATUSES.INACTIVE ? 1 : 0;

        if (firstStatus !== secondStatus) {
          return firstStatus - secondStatus;
        }

        return String(firstSupplier.name ?? "").localeCompare(
          String(secondSupplier.name ?? ""),
        );
      });

      if (typeof onData === "function") {
        onData(suppliers);
      }
    },

    (error) => {
      console.error("Unable to load suppliers:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}

/**
 * Real-time subscription containing only active
 * suppliers for Purchase Order forms.
 */
export function subscribeToActiveSuppliers(onData, onError) {
  return subscribeToSuppliers(
    (suppliers) => {
      const activeSuppliers = suppliers.filter(
        (supplier) =>
          (supplier.status ?? SUPPLIER_STATUSES.ACTIVE) ===
          SUPPLIER_STATUSES.ACTIVE,
      );

      if (typeof onData === "function") {
        onData(activeSuppliers);
      }
    },

    onError,
  );
}

/**
 * Reads one supplier document.
 */
export async function getSupplierById(supplierId) {
  const normalizedSupplierId = String(supplierId ?? "").trim();

  if (!normalizedSupplierId) {
    throw new Error("A supplier ID is required.");
  }

  const supplierReference = doc(db, "suppliers", normalizedSupplierId);

  const supplierSnapshot = await getDoc(supplierReference);

  if (!supplierSnapshot.exists()) {
    throw new Error("The selected supplier could not be found.");
  }

  return {
    id: supplierSnapshot.id,
    ...supplierSnapshot.data(),
  };
}

/**
 * Creates a supplier and generates its permanent
 * supplier code inside one transaction.
 */
export async function createSupplier(supplierData) {
  const currentUser = await getCurrentSupplierManager();

  const preparedData = prepareSupplierData(supplierData);

  const supplierReference = doc(collection(db, "suppliers"));

  const counterReference = doc(db, "supplierCounters", "default");

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      const counterSnapshot = await transaction.get(counterReference);

      const previousSequence = counterSnapshot.exists()
        ? Number(counterSnapshot.data().lastSequence ?? 0)
        : 0;

      if (!Number.isInteger(previousSequence) || previousSequence < 0) {
        throw new Error("The supplier counter contains an invalid sequence.");
      }

      const nextSequence = previousSequence + 1;

      if (nextSequence > SUPPLIER_LIMITS.MAX_CODE_SEQUENCE) {
        throw new Error("The supplier code sequence is already full.");
      }

      const supplierCode = formatSupplierCode(nextSequence);

      transaction.set(
        counterReference,
        {
          lastSequence: nextSequence,

          updatedBy: currentUser.userId,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      transaction.set(supplierReference, {
        supplierCode,

        ...preparedData,

        status: SUPPLIER_STATUSES.ACTIVE,

        hasPurchaseHistory: false,
        purchaseOrderCount: 0,

        createdBy: currentUser.userId,
        createdAt: serverTimestamp(),

        updatedBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      });

      result = {
        id: supplierReference.id,
        supplierCode,
        ...preparedData,
        status: SUPPLIER_STATUSES.ACTIVE,
      };
    });

    return result;
  } catch (error) {
    console.error("Unable to create supplier:", error);

    throw error;
  }
}

/**
 * Updates editable supplier information.
 *
 * Supplier code, status, history fields, and creation
 * audit fields are intentionally excluded.
 */
export async function updateSupplierMasterData(supplierId, supplierData) {
  const normalizedSupplierId = String(supplierId ?? "").trim();

  if (!normalizedSupplierId) {
    throw new Error("A supplier ID is required.");
  }

  const currentUser = await getCurrentSupplierManager();

  const preparedData = prepareSupplierData(supplierData);

  const supplierReference = doc(db, "suppliers", normalizedSupplierId);

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      const supplierSnapshot = await transaction.get(supplierReference);

      if (!supplierSnapshot.exists()) {
        throw new Error("The selected supplier no longer exists.");
      }

      const existingSupplier = supplierSnapshot.data();

      if (!String(existingSupplier.supplierCode ?? "").trim()) {
        throw new Error("The supplier record does not have a valid code.");
      }

      transaction.update(supplierReference, {
        ...preparedData,

        updatedBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      });

      result = {
        id: normalizedSupplierId,

        supplierCode: existingSupplier.supplierCode,

        status: existingSupplier.status ?? SUPPLIER_STATUSES.ACTIVE,

        ...preparedData,
      };
    });

    return result;
  } catch (error) {
    console.error("Unable to update supplier:", error);

    throw error;
  }
}

/**
 * Activates or deactivates a supplier.
 *
 * Supplier records are not deleted because Purchase
 * Orders and Goods Receipts will reference them.
 */
export async function updateSupplierStatus(supplierId, nextStatus) {
  const normalizedSupplierId = String(supplierId ?? "").trim();

  if (!normalizedSupplierId) {
    throw new Error("A supplier ID is required.");
  }

  const normalizedStatus = String(nextStatus ?? "")
    .trim()
    .toUpperCase();

  if (!isValidSupplierStatus(normalizedStatus)) {
    throw new Error("Supplier status must be ACTIVE or INACTIVE.");
  }

  const currentUser = await getCurrentSupplierManager();

  const supplierReference = doc(db, "suppliers", normalizedSupplierId);

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      const supplierSnapshot = await transaction.get(supplierReference);

      if (!supplierSnapshot.exists()) {
        throw new Error("The selected supplier no longer exists.");
      }

      const existingSupplier = supplierSnapshot.data();

      const currentStatus = existingSupplier.status ?? SUPPLIER_STATUSES.ACTIVE;

      if (currentStatus === normalizedStatus) {
        result = {
          id: normalizedSupplierId,
          status: normalizedStatus,
        };

        return;
      }

      transaction.update(supplierReference, {
        status: normalizedStatus,

        statusChangedBy: currentUser.userId,
        statusChangedAt: serverTimestamp(),

        updatedBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      });

      result = {
        id: normalizedSupplierId,
        status: normalizedStatus,
      };
    });

    return result;
  } catch (error) {
    console.error("Unable to update supplier status:", error);

    throw error;
  }
}
