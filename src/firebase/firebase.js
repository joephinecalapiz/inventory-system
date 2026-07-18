import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";

import {
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";

import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";

const firebaseConfig = {
  apiKey:
    "AIzaSyB9a40QhYVfDEKRmRCkX3RTKKW3oXmNMaQ",
  authDomain:
    "inventory-system-460a5.firebaseapp.com",
  projectId:
    "inventory-system-460a5",
  storageBucket:
    "inventory-system-460a5.firebasestorage.app",
  messagingSenderId:
    "38461628862",
  appId:
    "1:38461628862:web:e9b533359453e23b7519ef",
  measurementId:
    "G-ZCXS1S3DCV",
};

/*
 * Prevent Firebase from being initialized more than once
 * during Vite development reloads.
 */
const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

/*
 * Firebase services.
 */
export const auth = getAuth(app);

export const db = getFirestore(app);

export const functions = getFunctions(
  app,
  "asia-southeast1",
);

/*
 * Environment flags.
 */
const emulatorModeRequested =
  import.meta.env
    .VITE_USE_FIREBASE_EMULATORS === "true";

const productionFirebaseAllowedInDevelopment =
  import.meta.env
    .VITE_ALLOW_PRODUCTION_FIREBASE_IN_DEV ===
  "true";

const productionCreateUserFunctionEnabled =
  import.meta.env
    .VITE_ENABLE_CREATE_USER_FUNCTION ===
  "true";

/*
 * Emulator mode is only allowed while running
 * the Vite development server.
 */
export const isUsingFirebaseEmulators =
  import.meta.env.DEV &&
  emulatorModeRequested;

/*
 * The Create User callable function is available:
 *
 * 1. While using the local Functions emulator, or
 * 2. When the production callable function has been
 *    deployed and explicitly enabled.
 */
export const isCreateUserFunctionEnabled =
  isUsingFirebaseEmulators ||
  productionCreateUserFunctionEnabled;

/*
 * Development safety protection.
 *
 * Stop the local development application when the
 * emulators are disabled accidentally. This prevents
 * test users, products, and inventory movements from
 * being written to production Firebase.
 */
if (
  import.meta.env.DEV &&
  !isUsingFirebaseEmulators &&
  !productionFirebaseAllowedInDevelopment
) {
  throw new Error(
    [
      "Firebase safety protection stopped the application.",
      "",
      "Local development is not connected to the Firebase emulators.",
      "",
      "Open .env.local and set:",
      "VITE_USE_FIREBASE_EMULATORS=true",
      "",
      "Then restart the Vite development server.",
    ].join("\n"),
  );
}

/*
 * Connect Firebase services to their local emulators
 * only once during development.
 */
if (
  isUsingFirebaseEmulators &&
  !globalThis
    .__inventoryFirebaseEmulatorsConnected
) {
  connectAuthEmulator(
    auth,
    "http://127.0.0.1:9099",
    {
      disableWarnings: true,
    },
  );

  connectFirestoreEmulator(
    db,
    "127.0.0.1",
    8080,
  );

  connectFunctionsEmulator(
    functions,
    "127.0.0.1",
    5001,
  );

  globalThis
    .__inventoryFirebaseEmulatorsConnected =
    true;

  console.info(
    "Firebase emulator mode is active.",
  );
}

export default app;