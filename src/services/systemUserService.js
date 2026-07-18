import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "../firebase/firebase";

/*
 * Creates a reference to the callable Cloud Function.
 *
 * The name must exactly match the exported function:
 *
 * exports.createSystemUser = onCall(...)
 */
const createSystemUserCallable =
  httpsCallable(
    functions,
    "createSystemUser",
  );

/**
 * Sends a secure Create User request to the
 * Firebase callable Cloud Function.
 */
export async function createSystemUserAccount({
  displayName,
  email,
  password,
  role,
  status,
}) {
  const normalizedInput = {
    displayName: String(
      displayName || "",
    ).trim(),

    email: String(email || "")
      .trim()
      .toLowerCase(),

    password: String(password || ""),

    role: String(role || "")
      .trim()
      .toUpperCase(),

    status: String(status || "ACTIVE")
      .trim()
      .toUpperCase(),
  };

  validateCreateUserInput(normalizedInput);

  try {
    const result =
      await createSystemUserCallable(
        normalizedInput,
      );

    return result.data;
  } catch (error) {
    console.error(
      "Unable to create system user:",
      error,
    );

    throw createFriendlyFunctionsError(error);
  }
}

/**
 * Performs basic browser-side validation.
 *
 * The Cloud Function performs the final secure
 * validation and permission checks.
 */
function validateCreateUserInput({
  displayName,
  email,
  password,
  role,
  status,
}) {
  if (displayName.length < 2) {
    throw new Error(
      "Display name must contain at least 2 characters.",
    );
  }

  if (displayName.length > 80) {
    throw new Error(
      "Display name cannot exceed 80 characters.",
    );
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error(
      "Enter a valid email address.",
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Temporary password must contain at least 8 characters.",
    );
  }

  if (password.length > 128) {
    throw new Error(
      "Temporary password cannot exceed 128 characters.",
    );
  }

  const validRoles = [
    "SUPERADMIN",
    "ADMIN",
    "INVENTORY_STAFF",
    "CASHIER",
    "AUDITOR",
  ];

  if (!validRoles.includes(role)) {
    throw new Error(
      "Select a valid user role.",
    );
  }

  const validStatuses = [
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error(
      "Select a valid account status.",
    );
  }
}

/**
 * Converts Firebase Functions errors into
 * messages suitable for the user interface.
 */
function createFriendlyFunctionsError(error) {
  const errorCode = String(
    error?.code || "",
  );

  const errorMessage = String(
    error?.message || "",
  );

  switch (errorCode) {
    case "functions/unauthenticated":
      return new Error(
        "Your login session is missing or expired. Please sign in again.",
      );

    case "functions/permission-denied":
      return new Error(
        errorMessage ||
          "Your account is not allowed to create system users.",
      );

    case "functions/already-exists":
      return new Error(
        "An account already uses this email address.",
      );

    case "functions/invalid-argument":
      return new Error(
        errorMessage ||
          "Some account information is invalid.",
      );

    case "functions/not-found":
      return new Error(
        "The Create User function could not be found. Check that the Functions emulator is running.",
      );

    case "functions/unavailable":
      return new Error(
        "The Create User service is currently unavailable. Check the Functions emulator and try again.",
      );

    case "functions/deadline-exceeded":
      return new Error(
        "The Create User request took too long. Please try again.",
      );

    case "functions/internal":
      return new Error(
        errorMessage ||
          "The account could not be created because of a server error.",
      );

    default:
      return new Error(
        errorMessage ||
          "The system user could not be created.",
      );
  }
}