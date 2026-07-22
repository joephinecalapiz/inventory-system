import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

import {
  PRODUCT_LIMITS,
  PRODUCT_STATUSES,
  isValidMoneyValue,
  isValidProductSku,
  isValidProductStatus,
  isValidSourceProductId,
  isValidWholeNumber,
  normalizeProductName,
  normalizeProductSku,
  normalizeSourceProductId,
} from "../constants/products";

const productsCollection = collection(db, "products");

const PRODUCT_MIGRATION_BATCH_SIZE = 400;

const PRODUCT_MIGRATION_ROLES = new Set(["SUPERADMIN", "ADMIN"]);

function hasOwnField(record, fieldName) {
  return Object.prototype.hasOwnProperty.call(record, fieldName);
}

/**
 * Confirms that the currently authenticated user
 * is an active Superadmin or Admin.
 */
async function getCurrentMigrationAdmin() {
  const currentUserId = getCurrentUserId();

  const userReference = doc(db, "users", currentUserId);

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    throw new Error("Your Firestore user profile was not found.");
  }

  const userProfile = userSnapshot.data();

  if (userProfile.status !== "ACTIVE") {
    throw new Error("Only active accounts can migrate product records.");
  }

  if (!PRODUCT_MIGRATION_ROLES.has(userProfile.role)) {
    throw new Error("Only a Superadmin or Admin can migrate legacy products.");
  }

  return {
    currentUserId,
    role: userProfile.role,
  };
}

/**
 * Inspects one product without changing it.
 *
 * Source identity is intentionally excluded because
 * it must be assigned manually.
 */
export function inspectProductSafeMigration(product) {
  const issues = [];
  const blockers = [];

  if (!product?.id) {
    blockers.push("The product does not have a valid Firestore document ID.");
  }

  if (!hasOwnField(product, "status")) {
    issues.push("Missing product status.");
  } else if (!isValidProductStatus(product.status)) {
    blockers.push("The existing product status is invalid.");
  }

  if (!hasOwnField(product, "description")) {
    issues.push("Missing product description field.");
  } else if (typeof product.description !== "string") {
    blockers.push("The existing description is not text.");
  } else if (
    product.description.length > PRODUCT_LIMITS.DESCRIPTION_MAX_LENGTH
  ) {
    blockers.push("The existing description exceeds 500 characters.");
  }

  if (!hasOwnField(product, "costPrice")) {
    issues.push("Missing cost price field.");
  } else if (
    product.costPrice !== null &&
    !isValidMoneyValue(product.costPrice)
  ) {
    blockers.push("The existing cost price is invalid.");
  }

  const hasValidSellingPrice = isValidMoneyValue(product.sellingPrice);

  const hasValidLegacyPrice = isValidMoneyValue(product.price);

  if (!hasValidSellingPrice) {
    if (hasValidLegacyPrice) {
      issues.push("Selling price must be copied from the legacy price.");
    } else {
      blockers.push("No valid selling price or legacy price is available.");
    }
  }

  const resolvedSellingPrice = hasValidSellingPrice
    ? product.sellingPrice
    : hasValidLegacyPrice
      ? product.price
      : null;

  if (
    resolvedSellingPrice !== null &&
    (!hasValidLegacyPrice || product.price !== resolvedSellingPrice)
  ) {
    issues.push(
      "The legacy price field must be synchronized with the selling price.",
    );
  }

  if (typeof product.hasStockHistory !== "boolean") {
    issues.push("Missing reliable stock-history flag.");
  }

  if (
    !Number.isInteger(product.stockMovementCount) ||
    product.stockMovementCount < 0
  ) {
    issues.push("Missing reliable stock-movement count.");
  }

  if (!String(product.updatedBy ?? "").trim()) {
    issues.push("Missing updated-by audit field.");
  }

  if (!product.updatedAt) {
    issues.push("Missing updated-at audit field.");
  }

  return {
    needsMigration: issues.length > 0,

    canMigrate: blockers.length === 0,

    issues,
    blockers,
  };
}

/**
 * Returns the currently signed-in Firebase user ID.
 */
function getCurrentUserId() {
  const currentUserId = auth.currentUser?.uid;

  if (!currentUserId) {
    throw new Error("You must be signed in to manage products.");
  }

  return currentUserId;
}

function prepareProductName(value) {
  const name = normalizeProductName(value);

  if (name.length < PRODUCT_LIMITS.NAME_MIN_LENGTH) {
    throw new Error("The product name must contain at least 2 characters.");
  }

  if (name.length > PRODUCT_LIMITS.NAME_MAX_LENGTH) {
    throw new Error("The product name cannot exceed 150 characters.");
  }

  return name;
}

function prepareProductSku(value) {
  const sku = normalizeProductSku(value);

  if (!isValidProductSku(sku)) {
    throw new Error("The SKU must contain 2 to 50 supported characters.");
  }

  return sku;
}

function prepareDescription(value) {
  const description = String(value ?? "").trim();

  if (description.length > PRODUCT_LIMITS.DESCRIPTION_MAX_LENGTH) {
    throw new Error("The product description cannot exceed 500 characters.");
  }

  return description;
}

function prepareMoneyValue(value, fieldLabel) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldLabel} is required.`);
  }

  const amount = Number(value);

  if (!isValidMoneyValue(amount)) {
    throw new Error(`${fieldLabel} must be a valid non-negative amount.`);
  }

  return amount;
}

function prepareOptionalCostPrice(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return prepareMoneyValue(value, "Cost price");
}

function prepareWholeNumber(value, fieldLabel) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldLabel} is required.`);
  }

  const amount = Number(value);

  if (!isValidWholeNumber(amount)) {
    throw new Error(`${fieldLabel} must be a non-negative whole number.`);
  }

  return amount;
}

function prepareProductStatus(value) {
  const status = String(value ?? PRODUCT_STATUSES.ACTIVE)
    .trim()
    .toUpperCase();

  if (!isValidProductStatus(status)) {
    throw new Error("The product status must be ACTIVE or INACTIVE.");
  }

  return status;
}

function prepareOptionalSourceProductId(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const sourceProductId = normalizeSourceProductId(value);

  if (!isValidSourceProductId(sourceProductId)) {
    throw new Error("The product master source ID is invalid.");
  }

  return sourceProductId;
}

function prepareCategoryCode(value) {
  const categoryCode = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9_]{2,50}$/.test(categoryCode)) {
    throw new Error("A valid Firestore category code is required.");
  }

  return categoryCode;
}

function prepareUnitCode(value) {
  const unitCode = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9_]{1,50}$/.test(unitCode)) {
    throw new Error("A valid unit of measurement is required.");
  }

  return unitCode;
}

/**
 * Calculates the final check digit of a
 * 12-digit UPC-A barcode.
 */
function calculateUpcCheckDigit(firstElevenDigits) {
  if (!/^\d{11}$/.test(firstElevenDigits)) {
    throw new Error("The barcode base must contain exactly 11 digits.");
  }

  const digits = firstElevenDigits.split("").map(Number);

  const oddPositionTotal =
    (digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10]) *
    3;

  const evenPositionTotal =
    digits[1] + digits[3] + digits[5] + digits[7] + digits[9];

  return (10 - ((oddPositionTotal + evenPositionTotal) % 10)) % 10;
}

/**
 * Loads all products and listens for changes.
 */
export function subscribeToProducts(onProductsChanged, onError) {
  return onSnapshot(
    productsCollection,

    (snapshot) => {
      const products = snapshot.docs.map((productDocument) => ({
        id: productDocument.id,

        ...productDocument.data(),
      }));

      products.sort((firstProduct, secondProduct) => {
        const firstCreatedAt = firstProduct.createdAt?.toMillis?.() ?? 0;

        const secondCreatedAt = secondProduct.createdAt?.toMillis?.() ?? 0;

        return secondCreatedAt - firstCreatedAt;
      });

      onProductsChanged(products);
    },

    (error) => {
      console.error("Unable to load Firestore products:", error);

      onError?.(error);
    },
  );
}

export function subscribeToActiveProducts(onProductsChanged, onError) {
  return subscribeToProducts(
    (products) => {
      onProductsChanged(
        products.filter(
          (product) =>
            (product.status ?? PRODUCT_STATUSES.ACTIVE) ===
            PRODUCT_STATUSES.ACTIVE,
        ),
      );
    },

    onError,
  );
}

/**
 * Safely migrates legacy product fields.
 *
 * It does not automatically assign sourceProductId.
 * Stock-history fields are calculated from the
 * permanent stockMovements collection.
 */
export async function migrateLegacyProductSafeFields(products) {
  if (!Array.isArray(products)) {
    throw new Error("A product list is required for migration.");
  }

  const { currentUserId } = await getCurrentMigrationAdmin();

  const migrationCandidates = products
    .map((product) => ({
      product,
      inspection: inspectProductSafeMigration(product),
    }))
    .filter(({ inspection }) => inspection.needsMigration);

  if (migrationCandidates.length === 0) {
    return {
      requested: 0,
      migrated: 0,
      skipped: 0,
      errors: [],
    };
  }

  /*
   * Read stock movement history once and calculate
   * the real number of movements for each product.
   */
  const movementSnapshot = await getDocs(collection(db, "stockMovements"));

  const movementCounts = new Map();

  for (const movementDocument of movementSnapshot.docs) {
    const movement = movementDocument.data();

    const productId = String(movement.productId ?? "").trim();

    if (!productId) {
      continue;
    }

    movementCounts.set(productId, (movementCounts.get(productId) ?? 0) + 1);
  }

  const preparedUpdates = [];
  const errors = [];

  for (const { product, inspection } of migrationCandidates) {
    if (!inspection.canMigrate) {
      errors.push({
        productId: product.id,

        productName: product.name || product.id,

        reasons: inspection.blockers,
      });

      continue;
    }

    const sellingPrice = isValidMoneyValue(product.sellingPrice)
      ? product.sellingPrice
      : product.price;

    const status = hasOwnField(product, "status")
      ? product.status
      : PRODUCT_STATUSES.ACTIVE;

    const description =
      typeof product.description === "string" ? product.description.trim() : "";

    const costPrice = hasOwnField(product, "costPrice")
      ? product.costPrice
      : null;

    const stockMovementCount = movementCounts.get(product.id) ?? 0;

    preparedUpdates.push({
      productId: product.id,

      data: {
        status,

        description,

        costPrice,

        sellingPrice,

        /*
         * Keep the old price field synchronized
         * until all pages use sellingPrice.
         */
        price: sellingPrice,

        hasStockHistory: stockMovementCount > 0,

        stockMovementCount,

        legacyMigrationVersion: 1,

        legacyMigratedBy: currentUserId,

        legacyMigratedAt: serverTimestamp(),

        updatedBy: currentUserId,

        updatedAt: serverTimestamp(),
      },
    });
  }

  let migratedCount = 0;

  for (
    let index = 0;
    index < preparedUpdates.length;
    index += PRODUCT_MIGRATION_BATCH_SIZE
  ) {
    const updateGroup = preparedUpdates.slice(
      index,
      index + PRODUCT_MIGRATION_BATCH_SIZE,
    );

    const batch = writeBatch(db);

    for (const update of updateGroup) {
      batch.update(doc(db, "products", update.productId), update.data);
    }

    await batch.commit();

    migratedCount += updateGroup.length;
  }

  return {
    requested: migrationCandidates.length,

    migrated: migratedCount,

    skipped: errors.length,

    errors,
  };
}

/**
 * Creates a new product and reserves its exact
 * product-master source record.
 */
export async function createProduct(productData) {
  const currentUserId = getCurrentUserId();

  const name = prepareProductName(productData?.name);

  const sku = prepareProductSku(productData?.sku);

  const description = prepareDescription(productData?.description);

  const categoryCode = prepareCategoryCode(productData?.categoryCode);

  const unitCode = prepareUnitCode(productData?.unitCode);

  const sellingPrice = prepareMoneyValue(
    productData?.sellingPrice ?? productData?.price,

    "Selling price",
  );

  const costPrice = prepareOptionalCostPrice(productData?.costPrice);

  const quantity = prepareWholeNumber(
    productData?.quantity,
    "Initial quantity",
  );

  const reorderLevel = prepareWholeNumber(
    productData?.reorderLevel,
    "Reorder level",
  );

  const sourceProductId = prepareOptionalSourceProductId(
    productData?.sourceProductId ?? productData?.selectedProductId,
  );

  const categoryReference = doc(db, "categories", categoryCode);

  const unitReference = doc(db, "units", unitCode);

  const productReference = doc(collection(db, "products"));

  const reservationReference = sourceProductId
    ? doc(db, "productMasterReservations", sourceProductId)
    : null;

  let generatedBarcode = "";

  let resolvedCategoryName = "";

  let resolvedBarcodePrefix = "";

  let resolvedUnitName = "";

  let resolvedUnitAbbreviation = "";

  try {
    await runTransaction(
      db,

      async (transaction) => {
        /*
         * Read the selected category.
         */
        const categorySnapshot = await transaction.get(categoryReference);

        if (!categorySnapshot.exists()) {
          throw new Error("The selected category no longer exists.");
        }

        const category = categorySnapshot.data();

        if (category.status !== PRODUCT_STATUSES.ACTIVE) {
          throw new Error(`The category "${category.name}" is not active.`);
        }

        resolvedCategoryName = String(category.name ?? "").trim();

        resolvedBarcodePrefix = String(category.barcodePrefix ?? "").trim();

        if (!resolvedCategoryName) {
          throw new Error("The selected category does not have a valid name.");
        }

        if (!/^\d{2}$/.test(resolvedBarcodePrefix)) {
          throw new Error(
            "The selected category does not have a valid two-digit barcode prefix.",
          );
        }

        /*
         * Read the selected unit.
         */
        const unitSnapshot = await transaction.get(unitReference);

        if (!unitSnapshot.exists()) {
          throw new Error("The selected unit of measurement no longer exists.");
        }

        const unit = unitSnapshot.data();

        if (unit.status !== PRODUCT_STATUSES.ACTIVE) {
          throw new Error(`The unit "${unit.name}" is not active.`);
        }

        resolvedUnitName = String(unit.name ?? "").trim();

        resolvedUnitAbbreviation = String(unit.abbreviation ?? "")
          .trim()
          .toUpperCase();

        if (!resolvedUnitName) {
          throw new Error("The selected unit does not have a valid name.");
        }

        if (!/^[A-Z0-9]{1,10}$/.test(resolvedUnitAbbreviation)) {
          throw new Error(
            "The selected unit does not have a valid abbreviation.",
          );
        }

        /*
         * Check whether the exact product-master
         * record was already added.
         */
        if (reservationReference) {
          const reservationSnapshot =
            await transaction.get(reservationReference);

          if (reservationSnapshot.exists()) {
            throw new Error(
              "This product master record has already been added.",
            );
          }
        }

        /*
         * Read the barcode sequence before starting
         * transaction writes.
         */
        const counterReference = doc(
          db,
          "barcodeCounters",
          resolvedBarcodePrefix,
        );

        const counterSnapshot = await transaction.get(counterReference);

        const previousSequence = counterSnapshot.exists()
          ? Number(counterSnapshot.data().lastSequence ?? 0)
          : 0;

        if (!Number.isInteger(previousSequence) || previousSequence < 0) {
          throw new Error("The barcode counter contains an invalid sequence.");
        }

        const nextSequence = previousSequence + 1;

        if (nextSequence > 999999999) {
          throw new Error("The barcode sequence for this category is full.");
        }

        const sequenceText = String(nextSequence).padStart(9, "0");

        const firstElevenDigits = resolvedBarcodePrefix + sequenceText;

        const checkDigit = calculateUpcCheckDigit(firstElevenDigits);

        generatedBarcode = firstElevenDigits + String(checkDigit);

        /*
         * Update barcode counter.
         */
        transaction.set(
          counterReference,

          {
            category: resolvedCategoryName,

            categoryCode,

            barcodePrefix: resolvedBarcodePrefix,

            lastSequence: nextSequence,

            updatedAt: serverTimestamp(),
          },

          {
            merge: true,
          },
        );

        /*
         * Create the product.
         */
        transaction.set(
          productReference,

          {
            ...(sourceProductId
              ? {
                  sourceProductId,
                }
              : {}),

            name,

            sku,

            description,

            status: PRODUCT_STATUSES.ACTIVE,

            category: resolvedCategoryName,

            categoryName: resolvedCategoryName,

            categoryCode,

            categoryId: categoryCode,

            barcodePrefix: resolvedBarcodePrefix,

            unitCode,

            unitId: unitCode,

            unitName: resolvedUnitName,

            unitAbbreviation: resolvedUnitAbbreviation,

            costPrice,

            sellingPrice,

            /*
             * Keep the existing price field until
             * all pages use sellingPrice.
             */
            price: sellingPrice,

            quantity,

            reorderLevel,

            barcode: generatedBarcode,

            hasStockHistory: false,

            stockMovementCount: 0,

            createdBy: currentUserId,

            createdAt: serverTimestamp(),

            updatedBy: currentUserId,

            updatedAt: serverTimestamp(),
          },
        );

        /*
         * Reserve the exact master-list row.
         */
        if (reservationReference) {
          transaction.set(
            reservationReference,

            {
              sourceProductId,

              productId: productReference.id,

              sku,

              createdBy: currentUserId,

              createdAt: serverTimestamp(),
            },
          );
        }
      },
    );

    return {
      id: productReference.id,

      sourceProductId: sourceProductId || null,

      barcode: generatedBarcode,

      category: resolvedCategoryName,

      categoryCode,

      unitCode,

      unitName: resolvedUnitName,

      unitAbbreviation: resolvedUnitAbbreviation,

      costPrice,

      sellingPrice,

      status: PRODUCT_STATUSES.ACTIVE,
    };
  } catch (error) {
    console.error("Unable to create Firestore product:", error);

    throw error;
  }
}

/**
 * Assigns an active unit to an older product.
 */
export async function assignProductUnit(productId, unitCode) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  const currentUserId = getCurrentUserId();

  const normalizedUnitCode = prepareUnitCode(unitCode);

  const productReference = doc(db, "products", productId);

  const unitReference = doc(db, "units", normalizedUnitCode);

  let assignedUnit = null;

  try {
    await runTransaction(
      db,

      async (transaction) => {
        const productSnapshot = await transaction.get(productReference);

        if (!productSnapshot.exists()) {
          throw new Error("The selected product no longer exists.");
        }

        const unitSnapshot = await transaction.get(unitReference);

        if (!unitSnapshot.exists()) {
          throw new Error("The selected unit of measurement no longer exists.");
        }

        const product = productSnapshot.data();

        const unit = unitSnapshot.data();

        if (unit.status !== PRODUCT_STATUSES.ACTIVE) {
          throw new Error(`The unit "${unit.name}" is not active.`);
        }

        const resolvedUnitName = String(unit.name ?? "").trim();

        const resolvedUnitAbbreviation = String(unit.abbreviation ?? "")
          .trim()
          .toUpperCase();

        if (!resolvedUnitName) {
          throw new Error("The selected unit does not have a valid name.");
        }

        if (!/^[A-Z0-9]{1,10}$/.test(resolvedUnitAbbreviation)) {
          throw new Error(
            "The selected unit does not have a valid abbreviation.",
          );
        }

        const existingUnitCode = String(
          product.unitCode ?? product.unitId ?? "",
        )
          .trim()
          .toUpperCase();

        if (existingUnitCode && existingUnitCode !== normalizedUnitCode) {
          throw new Error(
            `This product is already assigned to unit ${existingUnitCode}.`,
          );
        }

        transaction.update(
          productReference,

          {
            unitCode: normalizedUnitCode,

            unitId: normalizedUnitCode,

            unitName: resolvedUnitName,

            unitAbbreviation: resolvedUnitAbbreviation,

            updatedBy: currentUserId,

            updatedAt: serverTimestamp(),
          },
        );

        assignedUnit = {
          unitCode: normalizedUnitCode,

          unitName: resolvedUnitName,

          unitAbbreviation: resolvedUnitAbbreviation,
        };
      },
    );

    return assignedUnit;
  } catch (error) {
    console.error("Unable to assign product unit:", error);

    throw error;
  }
}

/**
 * Assigns a permanent source-row identity to a
 * migrated legacy product and creates its reservation.
 *
 * Only Superadmin and Admin may perform this action.
 */
export async function assignProductSourceIdentity(productId, sourceProductId) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  /*
   * Verifies that the signed-in account is an
   * active Superadmin or Admin and returns its UID.
   */
  const { currentUserId } = await getCurrentMigrationAdmin();

  const normalizedSourceProductId =
    prepareOptionalSourceProductId(sourceProductId);

  if (!normalizedSourceProductId) {
    throw new Error("A product master source ID is required.");
  }

  const productReference = doc(db, "products", productId);

  const reservationReference = doc(
    db,
    "productMasterReservations",
    normalizedSourceProductId,
  );

  let result = null;

  try {
    await runTransaction(db, async (transaction) => {
      const productSnapshot = await transaction.get(productReference);

      if (!productSnapshot.exists()) {
        throw new Error("The selected product no longer exists.");
      }

      const reservationSnapshot = await transaction.get(reservationReference);

      const product = productSnapshot.data();

      const existingSourceProductId = String(
        product.sourceProductId ?? "",
      ).trim();

      if (
        existingSourceProductId &&
        existingSourceProductId !== normalizedSourceProductId
      ) {
        throw new Error(
          `This product is already linked to ${existingSourceProductId}.`,
        );
      }

      /*
       * Require safe-field migration before
       * assigning the permanent source identity.
       */
      const migrationInspection = inspectProductSafeMigration({
        id: productId,
        ...product,
      });

      if (migrationInspection.needsMigration) {
        throw new Error(
          "Migrate this product's safe legacy fields before assigning its source identity.",
        );
      }

      if (
        reservationSnapshot.exists() &&
        reservationSnapshot.data().productId !== productId
      ) {
        throw new Error(
          "This product master record is already linked to another product.",
        );
      }

      const sku = prepareProductSku(product.sku);

      /*
       * Permanently link the product to the
       * selected Product Master source row.
       */
      if (!existingSourceProductId) {
        transaction.update(productReference, {
          sourceProductId: normalizedSourceProductId,

          sourceIdentityAssignedBy: currentUserId,

          sourceIdentityAssignedAt: serverTimestamp(),

          updatedBy: currentUserId,

          updatedAt: serverTimestamp(),
        });
      }

      /*
       * Permanently reserve the source row so it
       * cannot be assigned or added again.
       */
      if (!reservationSnapshot.exists()) {
        transaction.set(reservationReference, {
          sourceProductId: normalizedSourceProductId,

          productId,

          sku,

          createdBy: currentUserId,

          createdAt: serverTimestamp(),
        });
      }

      result = {
        productId,

        sourceProductId: normalizedSourceProductId,

        sku,
      };
    });

    return result;
  } catch (error) {
    console.error("Unable to assign product source identity:", error);

    throw error;
  }
}

/**
 * Updates editable Product Master fields.
 *
 * SKU, category, unit, barcode, and quantity are
 * intentionally excluded.
 */
export async function updateProductMasterData(productId, productData) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  const currentUserId = getCurrentUserId();

  const productReference = doc(db, "products", productId);

  let updatedProduct = null;

  try {
    await runTransaction(
      db,

      async (transaction) => {
        const productSnapshot = await transaction.get(productReference);

        if (!productSnapshot.exists()) {
          throw new Error("The selected product no longer exists.");
        }

        const existingProduct = productSnapshot.data();

        /*
         * SKU cannot change.
         */
        if (
          productData?.sku !== undefined &&
          normalizeProductSku(productData.sku) !==
            normalizeProductSku(existingProduct.sku)
        ) {
          throw new Error("The SKU is permanent and cannot be changed.");
        }

        /*
         * Category cannot change because it controls
         * the product's barcode prefix.
         */
        if (
          productData?.category !== undefined &&
          String(productData.category).trim() !==
            String(existingProduct.category ?? "").trim()
        ) {
          throw new Error(
            "The product category is permanent because it is linked to the barcode.",
          );
        }

        /*
         * Quantity must only be changed using stock
         * movements.
         */
        if (
          productData?.quantity !== undefined &&
          Number(productData.quantity) !== Number(existingProduct.quantity ?? 0)
        ) {
          throw new Error(
            "Use Stock In or Stock Out to change the product quantity.",
          );
        }

        const name = prepareProductName(
          productData?.name ?? existingProduct.name,
        );

        const description = prepareDescription(
          productData?.description ?? existingProduct.description ?? "",
        );

        const costPrice =
          productData?.costPrice !== undefined
            ? prepareOptionalCostPrice(productData.costPrice)
            : prepareOptionalCostPrice(existingProduct.costPrice);

        const sellingPrice = prepareMoneyValue(
          productData?.sellingPrice ??
            productData?.price ??
            existingProduct.sellingPrice ??
            existingProduct.price,

          "Selling price",
        );

        const reorderLevel = prepareWholeNumber(
          productData?.reorderLevel ?? existingProduct.reorderLevel,

          "Reorder level",
        );

        const status = prepareProductStatus(
          productData?.status ??
            existingProduct.status ??
            PRODUCT_STATUSES.ACTIVE,
        );

        transaction.update(
          productReference,

          {
            name,

            description,

            costPrice,

            sellingPrice,

            price: sellingPrice,

            reorderLevel,

            status,

            updatedBy: currentUserId,

            updatedAt: serverTimestamp(),
          },
        );

        updatedProduct = {
          id: productId,

          name,

          description,

          costPrice,

          sellingPrice,

          reorderLevel,

          status,
        };
      },
    );

    return updatedProduct;
  } catch (error) {
    console.error("Unable to update product master data:", error);

    throw error;
  }
}

/**
 * Backward-compatible function for existing pages.
 */
export async function updateProduct(productId, productData) {
  return updateProductMasterData(productId, productData);
}

/**
 * Activates or deactivates a product.
 */
export async function updateProductStatus(productId, status) {
  return updateProductMasterData(
    productId,

    {
      status,
    },
  );
}

/**
 * Deletes only a new product that has no remaining
 * stock and no stock movement history.
 */
export async function deleteProduct(productId) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  getCurrentUserId();

  const productReference = doc(db, "products", productId);

  try {
    await runTransaction(
      db,

      async (transaction) => {
        const productSnapshot = await transaction.get(productReference);

        if (!productSnapshot.exists()) {
          throw new Error("The selected product no longer exists.");
        }

        const product = productSnapshot.data();

        const hasReliableHistoryFlags =
          typeof product.hasStockHistory === "boolean" &&
          Number.isInteger(product.stockMovementCount);

        if (!hasReliableHistoryFlags) {
          throw new Error(
            "This legacy product must be migrated before deletion can be evaluated safely.",
          );
        }

        if (product.hasStockHistory || product.stockMovementCount > 0) {
          throw new Error(
            "This product cannot be deleted because it already has stock history. Deactivate it instead.",
          );
        }

        if (Number(product.quantity ?? 0) !== 0) {
          throw new Error("A product with remaining stock cannot be deleted.");
        }

        transaction.delete(productReference);
      },
    );
  } catch (error) {
    console.error("Unable to delete Firestore product:", error);

    throw error;
  }
}

/**
 * Performs Stock In or Stock Out and records a
 * permanent movement document.
 */
export async function adjustProductStock(productId, movementType, amount) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  if (movementType !== "OUT") {
    throw new Error(
      "Use the Stock-In receipt page to receive inventory. This function only supports Stock Out.",
    );
  }

  const currentUserId = getCurrentUserId();

  const adjustmentAmount = prepareWholeNumber(amount, "Stock quantity");

  if (adjustmentAmount === 0) {
    throw new Error("The stock quantity must be greater than zero.");
  }

  const productReference = doc(db, "products", productId);

  const movementReference = doc(collection(db, "stockMovements"));

  try {
    await runTransaction(
      db,

      async (transaction) => {
        const productSnapshot = await transaction.get(productReference);

        if (!productSnapshot.exists()) {
          throw new Error("The selected product no longer exists.");
        }

        const product = productSnapshot.data();

        const productStatus = product.status ?? PRODUCT_STATUSES.ACTIVE;

        if (productStatus !== PRODUCT_STATUSES.ACTIVE) {
          throw new Error("Inactive products cannot receive stock movements.");
        }

        const previousQuantity = Number(product.quantity ?? 0);

        if (!Number.isInteger(previousQuantity) || previousQuantity < 0) {
          throw new Error("The product contains an invalid stock quantity.");
        }

        const newQuantity = previousQuantity - adjustmentAmount;

        if (newQuantity < 0) {
          throw new Error(
            `Insufficient stock. Only ${previousQuantity} item(s) are available.`,
          );
        }

        const storedMovementCount = Number(product.stockMovementCount ?? 0);

        const previousMovementCount =
          Number.isInteger(storedMovementCount) && storedMovementCount >= 0
            ? storedMovementCount
            : 0;

        const movementData = {
          productId,

          productName: product.name,

          productSku: product.sku,

          movementType,
          
          reason: "MANUAL_STOCK_OUT",

          quantity: adjustmentAmount,

          previousQuantity,

          newQuantity,

          createdBy: currentUserId,

          createdAt: serverTimestamp(),
        };

        if (product.categoryCode) {
          movementData.categoryCode = product.categoryCode;
        }

        if (product.unitCode) {
          movementData.unitCode = product.unitCode;
        }

        if (product.unitAbbreviation) {
          movementData.unitAbbreviation = product.unitAbbreviation;
        }

        transaction.update(
          productReference,

          {
            quantity: newQuantity,

            hasStockHistory: true,

            stockMovementCount: previousMovementCount + 1,

            updatedBy: currentUserId,

            updatedAt: serverTimestamp(),
          },
        );

        transaction.set(movementReference, movementData);
      },
    );
  } catch (error) {
    console.error("Unable to adjust product stock:", error);

    throw error;
  }
}
