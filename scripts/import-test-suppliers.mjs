import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
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

const dataPath = path.resolve(
  process.cwd(),
  "test-suppliers.json",
);

if (!fs.existsSync(dataPath)) {
  throw new Error(
    `Missing supplier data file: ${dataPath}`,
  );
}

const sourceSuppliers = JSON.parse(
  fs.readFileSync(
    dataPath,
    "utf8",
  ),
);

if (!Array.isArray(sourceSuppliers)) {
  throw new Error(
    "test-suppliers.json must contain an array.",
  );
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function formatSupplierCode(sequence) {
  return `SUP-${String(sequence).padStart(6, "0")}`;
}

function validateSupplierInput(
  supplier,
  rowNumber,
) {
  const name = String(
    supplier?.name ?? "",
  ).trim();

  if (name.length < 2) {
    throw new Error(
      `Supplier row ${rowNumber} requires a valid name.`,
    );
  }

  const paymentTerm = String(
    supplier?.paymentTerm ?? "",
  )
    .trim()
    .toUpperCase();

  const allowedPaymentTerms =
    new Set([
      "CASH_ON_DELIVERY",
      "PREPAID",
      "NET_7",
      "NET_15",
      "NET_30",
      "NET_45",
      "NET_60",
      "CUSTOM",
    ]);

  if (!allowedPaymentTerms.has(paymentTerm)) {
    throw new Error(
      `Supplier row ${rowNumber} has an invalid payment term.`,
    );
  }

  const customPaymentTerms = String(
    supplier?.customPaymentTerms ?? "",
  ).trim();

  if (
    paymentTerm === "CUSTOM" &&
    !customPaymentTerms
  ) {
    throw new Error(
      `Supplier row ${rowNumber} requires custom payment terms.`,
    );
  }

  return {
    name,
    nameNormalized:
      normalizeName(name),

    contactPerson:
      String(
        supplier?.contactPerson ?? "",
      ).trim(),

    contactNumber:
      String(
        supplier?.contactNumber ?? "",
      ).trim(),

    email:
      String(
        supplier?.email ?? "",
      ).trim(),

    address:
      String(
        supplier?.address ?? "",
      ).trim(),

    tin:
      String(
        supplier?.tin ?? "",
      ).trim(),

    paymentTerm,

    customPaymentTerms:
      paymentTerm === "CUSTOM"
        ? customPaymentTerms
        : "",

    notes:
      String(
        supplier?.notes ??
        "TEST DATA",
      ).trim(),
  };
}

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

      const counterReference =
        doc(
          db,
          "supplierCounters",
          "default",
        );

      const counterSnapshot =
        await getDoc(
          counterReference,
        );

      const currentSequence =
        counterSnapshot.exists()
          ? Number(
              counterSnapshot.data()
                .lastSequence ?? 0,
            )
          : 0;

      if (
        !Number.isInteger(
          currentSequence,
        ) ||
        currentSequence < 0
      ) {
        throw new Error(
          "The supplier counter contains an invalid sequence.",
        );
      }

      const supplierSnapshot =
        await getDocs(
          collection(
            db,
            "suppliers",
          ),
        );

      const existingNames =
        new Set(
          supplierSnapshot.docs.map(
            (supplierDocument) =>
              normalizeName(
                supplierDocument
                  .data()
                  .nameNormalized ||
                supplierDocument
                  .data()
                  .name,
              ),
          ),
        );

      const preparedSuppliers =
        sourceSuppliers
          .map(
            validateSupplierInput,
          )
          .filter(
            (supplier) =>
              !existingNames.has(
                supplier.nameNormalized,
              ),
          );

      if (
        preparedSuppliers.length === 0
      ) {
        console.log(
          "No suppliers were imported because all test supplier names already exist.",
        );
        return;
      }

      const batch =
        writeBatch(db);

      preparedSuppliers.forEach(
        (supplier, index) => {
          const sequence =
            currentSequence +
            index +
            1;

          const supplierCode =
            formatSupplierCode(
              sequence,
            );

          const supplierId =
            `test-${supplierCode.toLowerCase()}`;

          batch.set(
            doc(
              db,
              "suppliers",
              supplierId,
            ),
            {
              supplierCode,
              ...supplier,

              status:
                "ACTIVE",

              hasPurchaseHistory:
                false,

              purchaseOrderCount:
                0,

              createdBy:
                "TEST_SEED_LOCAL",

              createdAt:
                serverTimestamp(),

              updatedBy:
                "TEST_SEED_LOCAL",

              updatedAt:
                serverTimestamp(),
            },
          );
        },
      );

      const finalSequence =
        currentSequence +
        preparedSuppliers.length;

      batch.set(
        counterReference,
        {
          lastSequence:
            finalSequence,

          updatedBy:
            "TEST_SEED_LOCAL",

          updatedAt:
            serverTimestamp(),
        },
      );

      await batch.commit();

      console.log("");
      console.log(
        `Imported ${preparedSuppliers.length} test supplier(s).`,
      );

      console.log(
        `Supplier codes: ${formatSupplierCode(
          currentSequence + 1,
        )} to ${formatSupplierCode(
          finalSequence,
        )}`,
      );

      console.log(
        "Refresh the Supplier Management page.",
      );
    },
  );
} finally {
  await testEnv.cleanup();
}
