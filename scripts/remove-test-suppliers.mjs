import process from "node:process";

import {
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
  collection,
  deleteDoc,
  getDocs,
} from "firebase/firestore";

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  "inventory-system-460a5";

const FIRESTORE_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ||
  "127.0.0.1:8080";

const [host, portText] =
  FIRESTORE_HOST.split(":");

const port = Number(portText || 8080);

const testEnv =
  await initializeTestEnvironment({
    projectId:
      PROJECT_ID,

    firestore: {
      host,
      port,
    },
  });

try {
  await testEnv.withSecurityRulesDisabled(
    async (context) => {
      const db =
        context.firestore();

      const snapshot =
        await getDocs(
          collection(
            db,
            "suppliers",
          ),
        );

      const testDocuments =
        snapshot.docs.filter(
          (supplierDocument) =>
            supplierDocument.id
              .startsWith(
                "test-sup-",
              ) ||
            String(
              supplierDocument
                .data()
                .createdBy ?? "",
            ) ===
              "TEST_SEED_LOCAL",
        );

      for (
        const supplierDocument of
        testDocuments
      ) {
        await deleteDoc(
          supplierDocument.ref,
        );
      }

      console.log(
        `Removed ${testDocuments.length} test supplier(s).`,
      );

      console.log(
        "The supplier counter was intentionally kept to avoid reusing supplier codes.",
      );
    },
  );
} finally {
  await testEnv.cleanup();
}
