const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const logger = require(
  "firebase-functions/logger",
);

const {
  initializeApp,
} = require("firebase-admin/app");

const {
  getAuth,
} = require("firebase-admin/auth");

const {
  FieldValue,
  getFirestore,
} = require("firebase-admin/firestore");

initializeApp();

const auth = getAuth();
const db = getFirestore();

const USER_ROLES = Object.freeze({
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
  INVENTORY_STAFF: "INVENTORY_STAFF",
  CASHIER: "CASHIER",
  AUDITOR: "AUDITOR",
});

const USER_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
});

const ALL_ROLES = Object.values(USER_ROLES);

const OPERATIONAL_ROLES = [
  USER_ROLES.INVENTORY_STAFF,
  USER_ROLES.CASHIER,
  USER_ROLES.AUDITOR,
];

const ALL_STATUSES = Object.values(
  USER_STATUSES,
);

/**
 * Securely creates a Firebase Authentication
 * account and matching Firestore user profile.
 */
exports.createSystemUser = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 2,
    timeoutSeconds: 30,
  },

  async (request) => {
    /*
     * Step 1:
     * Require a signed-in Firebase user.
     */
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to create a user.",
      );
    }

    const callerUserId = request.auth.uid;

    /*
     * Step 2:
     * Read the caller's Firestore profile.
     */
    const callerReference = db
      .collection("users")
      .doc(callerUserId);

    const callerSnapshot =
      await callerReference.get();

    if (!callerSnapshot.exists) {
      throw new HttpsError(
        "permission-denied",
        "Your system user profile was not found.",
      );
    }

    const callerProfile =
      callerSnapshot.data();

    /*
     * Step 3:
     * Only ACTIVE accounts may create users.
     */
    if (
      callerProfile.status !==
      USER_STATUSES.ACTIVE
    ) {
      throw new HttpsError(
        "permission-denied",
        "Your account is not active.",
      );
    }

    /*
     * Step 4:
     * Only Superadmin and Admin may create users.
     */
    const allowedCreatorRoles = [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
    ];

    if (
      !allowedCreatorRoles.includes(
        callerProfile.role,
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "Your role cannot create system users.",
      );
    }

    /*
     * Step 5:
     * Validate and normalize request data.
     */
    const input = validateRequestData(
      request.data,
    );

    /*
     * Admin may only create operational users.
     *
     * Only Superadmin may create another
     * Admin or Superadmin account.
     */
    if (
      callerProfile.role ===
        USER_ROLES.ADMIN &&
      !OPERATIONAL_ROLES.includes(input.role)
    ) {
      throw new HttpsError(
        "permission-denied",
        "Administrators may only create Inventory Staff, Cashier, or Auditor accounts.",
      );
    }

    let createdAuthenticationUser = null;

    try {
      /*
       * Step 6:
       * Create the Firebase Authentication user.
       *
       * This happens through the Admin SDK, so the
       * current administrator stays signed in.
       */
      createdAuthenticationUser =
        await auth.createUser({
          displayName: input.displayName,
          email: input.email,
          password: input.password,
          emailVerified: false,
          disabled: false,
        });

      /*
       * Step 7:
       * Create the matching Firestore profile.
       *
       * The Firestore document ID must be the new
       * Authentication user's UID.
       */
      const newUserReference = db
        .collection("users")
        .doc(createdAuthenticationUser.uid);

      await newUserReference.set({
        displayName: input.displayName,
        email: input.email,
        role: input.role,
        status: input.status,

        createdBy: callerUserId,
        createdAt: FieldValue.serverTimestamp(),

        updatedBy: callerUserId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("System user created", {
        createdUserId:
          createdAuthenticationUser.uid,

        createdBy: callerUserId,
        assignedRole: input.role,
        assignedStatus: input.status,
      });

      /*
       * Never return the user's password.
       */
      return {
        success: true,

        message:
          "The system user was created successfully.",

        user: {
          uid: createdAuthenticationUser.uid,
          displayName: input.displayName,
          email: input.email,
          role: input.role,
          status: input.status,
        },
      };
    } catch (error) {
      /*
       * Roll back the Authentication account when
       * its Firestore profile could not be created.
       *
       * This prevents an Authentication account
       * without a matching users/{UID} profile.
       */
      if (createdAuthenticationUser?.uid) {
        try {
          await auth.deleteUser(
            createdAuthenticationUser.uid,
          );

          logger.warn(
            "Authentication user rolled back after profile creation failure.",
            {
              userId:
                createdAuthenticationUser.uid,
            },
          );
        } catch (rollbackError) {
          logger.error(
            "Unable to roll back Authentication user.",
            {
              userId:
                createdAuthenticationUser.uid,

              error:
                rollbackError?.message ||
                String(rollbackError),
            },
          );
        }
      }

      logger.error(
        "Unable to create system user.",
        {
          createdBy: callerUserId,

          errorCode:
            error?.code || "unknown",

          errorMessage:
            error?.message ||
            "Unknown account creation error",
        },
      );

      throw convertToHttpsError(error);
    }
  },
);

/**
 * Validates all values sent by the React form.
 */
function validateRequestData(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Valid user information is required.",
    );
  }

  const displayName = normalizeRequiredText({
    value: data.displayName,
    fieldLabel: "Display name",
    minimumLength: 2,
    maximumLength: 80,
  });

  const email = normalizeEmail(data.email);

  const password = validatePassword(
    data.password,
  );

  const role = String(data.role || "")
    .trim()
    .toUpperCase();

  const status = String(
    data.status || USER_STATUSES.ACTIVE,
  )
    .trim()
    .toUpperCase();

  if (!ALL_ROLES.includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "The selected user role is invalid.",
    );
  }

  if (!ALL_STATUSES.includes(status)) {
    throw new HttpsError(
      "invalid-argument",
      "The selected account status is invalid.",
    );
  }

  return {
    displayName,
    email,
    password,
    role,
    status,
  };
}

/**
 * Validates a required text value.
 */
function normalizeRequiredText({
  value,
  fieldLabel,
  minimumLength,
  maximumLength,
}) {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldLabel} is required.`,
    );
  }

  const normalizedValue = value
    .trim()
    .replace(/\s+/g, " ");

  if (
    normalizedValue.length < minimumLength
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldLabel} must contain at least ${minimumLength} characters.`,
    );
  }

  if (
    normalizedValue.length > maximumLength
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldLabel} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalizedValue;
}

/**
 * Validates and normalizes an email address.
 */
function normalizeEmail(value) {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Email address is required.",
    );
  }

  const normalizedEmail = value
    .trim()
    .toLowerCase();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    normalizedEmail.length > 254 ||
    !emailPattern.test(normalizedEmail)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid email address.",
    );
  }

  return normalizedEmail;
}

/**
 * Applies the system's password requirements.
 */
function validatePassword(value) {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "A temporary password is required.",
    );
  }

  if (value.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "The temporary password must contain at least 8 characters.",
    );
  }

  if (value.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      "The temporary password cannot exceed 128 characters.",
    );
  }

  return value;
}

/**
 * Converts Firebase Admin errors into safe errors
 * that may be displayed by the React application.
 */
function convertToHttpsError(error) {
  if (error instanceof HttpsError) {
    return error;
  }

  switch (error?.code) {
    case "auth/email-already-exists":
      return new HttpsError(
        "already-exists",
        "An account already uses this email address.",
      );

    case "auth/invalid-email":
      return new HttpsError(
        "invalid-argument",
        "The email address is invalid.",
      );

    case "auth/invalid-password":
      return new HttpsError(
        "invalid-argument",
        "The temporary password is invalid.",
      );

    case "auth/invalid-display-name":
      return new HttpsError(
        "invalid-argument",
        "The display name is invalid.",
      );

    default:
      return new HttpsError(
        "internal",
        "The user account could not be created. Please try again.",
      );
  }
}