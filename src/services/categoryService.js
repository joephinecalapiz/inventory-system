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
  CATEGORY_SEED_DATA,
} from "../data/categorySeedData";

import {
  CATEGORY_LIMITS,
  CATEGORY_STATUSES,
  createCategoryCode,
  isValidBarcodePrefix,
  isValidCategoryStatus,
  normalizeBarcodePrefix,
  normalizeCategoryName,
} from "../constants/categories";

const categoriesCollection = collection(
  db,
  "categories",
);

/**
 * Returns the current Firebase Authentication UID.
 */
function getCurrentUserId() {
  const currentUserId =
    auth.currentUser?.uid;

  if (!currentUserId) {
    throw new Error(
      "You must be signed in to manage categories.",
    );
  }

  return currentUserId;
}

/**
 * Validates and normalizes a category name.
 */
function prepareCategoryName(value) {
  const categoryName =
    normalizeCategoryName(value);

  if (
    categoryName.length <
    CATEGORY_LIMITS.NAME_MIN_LENGTH
  ) {
    throw new Error(
      "The category name must contain at least 2 characters.",
    );
  }

  if (
    categoryName.length >
    CATEGORY_LIMITS.NAME_MAX_LENGTH
  ) {
    throw new Error(
      "The category name cannot exceed 100 characters.",
    );
  }

  return categoryName;
}

/**
 * Validates and normalizes the description.
 */
function prepareCategoryDescription(
  value,
) {
  const description = String(
    value ?? "",
  ).trim();

  if (
    description.length >
    CATEGORY_LIMITS.DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(
      "The category description cannot exceed 500 characters.",
    );
  }

  return description;
}

/**
 * Validates a two-digit barcode prefix.
 */
function prepareBarcodePrefix(value) {
  const barcodePrefix =
    normalizeBarcodePrefix(value);

  if (
    !isValidBarcodePrefix(
      barcodePrefix,
    )
  ) {
    throw new Error(
      "The barcode prefix must contain exactly two digits.",
    );
  }

  return barcodePrefix;
}

/**
 * Listens for Category collection changes.
 */
export function subscribeToCategories(
  onCategoriesChanged,
  onError,
) {
  const categoriesQuery = query(
    categoriesCollection,
    orderBy("name", "asc"),
  );

  return onSnapshot(
    categoriesQuery,

    (snapshot) => {
      const categories =
        snapshot.docs.map(
          (categoryDocument) => ({
            id: categoryDocument.id,
            ...categoryDocument.data(),
          }),
        );

      onCategoriesChanged(categories);
    },

    (error) => {
      console.error(
        "Unable to load categories:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}

/**
 * Listens only for ACTIVE categories.
 *
 * Filtering is performed in React so no
 * additional Firestore composite index is needed.
 */
export function subscribeToActiveCategories(
  onCategoriesChanged,
  onError,
) {
  return subscribeToCategories(
    (categories) => {
      const activeCategories =
        categories.filter(
          (category) =>
            category.status ===
            CATEGORY_STATUSES.ACTIVE,
        );

      onCategoriesChanged(
        activeCategories,
      );
    },

    onError,
  );
}

/**
 * Reads one category using its permanent code.
 */
export async function getCategoryByCode(
  categoryCode,
) {
  const normalizedCode =
    createCategoryCode(categoryCode);

  if (!normalizedCode) {
    throw new Error(
      "A valid category code is required.",
    );
  }

  const categoryReference = doc(
    db,
    "categories",
    normalizedCode,
  );

  const categorySnapshot =
    await getDoc(categoryReference);

  if (!categorySnapshot.exists()) {
    return null;
  }

  return {
    id: categorySnapshot.id,
    ...categorySnapshot.data(),
  };
}

/**
 * Creates a category and permanently reserves
 * its barcode prefix.
 */
export async function createCategory(
  categoryData,
) {
  const currentUserId =
    getCurrentUserId();

  const name = prepareCategoryName(
    categoryData?.name,
  );

  const code =
    createCategoryCode(name);

  if (
    code.length <
    CATEGORY_LIMITS.CODE_MIN_LENGTH
  ) {
    throw new Error(
      "Unable to generate a valid category code.",
    );
  }

  const barcodePrefix =
    prepareBarcodePrefix(
      categoryData?.barcodePrefix,
    );

  const description =
    prepareCategoryDescription(
      categoryData?.description,
    );

  const categoryReference = doc(
    db,
    "categories",
    code,
  );

  const prefixReference = doc(
    db,
    "categoryBarcodePrefixes",
    barcodePrefix,
  );

  await runTransaction(
    db,
    async (transaction) => {
      /*
       * All reads must happen before writes.
       */
      const categorySnapshot =
        await transaction.get(
          categoryReference,
        );

      const prefixSnapshot =
        await transaction.get(
          prefixReference,
        );

      if (categorySnapshot.exists()) {
        throw new Error(
          `The category "${name}" already exists.`,
        );
      }

      if (prefixSnapshot.exists()) {
        const existingCategoryCode =
          prefixSnapshot.data()
            .categoryCode;

        throw new Error(
          `Barcode prefix ${barcodePrefix} is already assigned to ${existingCategoryCode}.`,
        );
      }

      transaction.set(
        categoryReference,
        {
          name,
          code,
          barcodePrefix,
          description,
          status:
            CATEGORY_STATUSES.ACTIVE,

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
        prefixReference,
        {
          barcodePrefix,
          categoryCode: code,

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
    barcodePrefix,
    description,
    status:
      CATEGORY_STATUSES.ACTIVE,
  };
}

/**
 * Updates editable Category fields.
 *
 * Category code and barcode prefix are permanent
 * and are intentionally excluded.
 */
export async function updateCategory(
  categoryId,
  categoryData,
) {
  const currentUserId =
    getCurrentUserId();

  const normalizedCategoryId =
    createCategoryCode(categoryId);

  if (!normalizedCategoryId) {
    throw new Error(
      "A valid category ID is required.",
    );
  }

  const categoryReference = doc(
    db,
    "categories",
    normalizedCategoryId,
  );

  const categorySnapshot =
    await getDoc(categoryReference);

  if (!categorySnapshot.exists()) {
    throw new Error(
      "The selected category no longer exists.",
    );
  }

  const existingCategory =
    categorySnapshot.data();

  const name = prepareCategoryName(
    categoryData?.name ??
      existingCategory.name,
  );

  const description =
    prepareCategoryDescription(
      categoryData?.description ??
        existingCategory.description,
    );

  const status =
    categoryData?.status ??
    existingCategory.status;

  if (!isValidCategoryStatus(status)) {
    throw new Error(
      "The category status must be ACTIVE or INACTIVE.",
    );
  }

  await updateDoc(
    categoryReference,
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
    id: normalizedCategoryId,
    code:
      existingCategory.code,
    barcodePrefix:
      existingCategory.barcodePrefix,
    name,
    description,
    status,
  };
}

/**
 * Activates or deactivates a category.
 */
export async function updateCategoryStatus(
  categoryId,
  status,
) {
  if (!isValidCategoryStatus(status)) {
    throw new Error(
      "The category status must be ACTIVE or INACTIVE.",
    );
  }

  return updateCategory(
    categoryId,
    {
      status,
    },
  );
}

/**
 * Imports the categories that were previously
 * hardcoded in productService.js.
 *
 * Existing categories are skipped, making this
 * safe to run again after a partial import.
 */
export async function seedDefaultCategories() {
  const results = [];

  for (
    const categoryData of CATEGORY_SEED_DATA
  ) {
    const categoryCode =
      createCategoryCode(
        categoryData.name,
      );

    try {
      const existingCategory =
        await getCategoryByCode(
          categoryCode,
        );

      if (existingCategory) {
        results.push({
          code: categoryCode,
          name: categoryData.name,
          status: "SKIPPED",
          message:
            "Category already exists.",
        });

        continue;
      }

      await createCategory(
        categoryData,
      );

      results.push({
        code: categoryCode,
        name: categoryData.name,
        status: "CREATED",
        message:
          "Category imported successfully.",
      });
    } catch (error) {
      console.error(
        `Unable to import category ${categoryData.name}:`,
        error,
      );

      results.push({
        code: categoryCode,
        name: categoryData.name,
        status: "FAILED",
        message:
          error?.message ||
          "Unable to import category.",
      });
    }
  }

  return {
    totalCount:
      CATEGORY_SEED_DATA.length,

    createdCount:
      results.filter(
        (result) =>
          result.status === "CREATED",
      ).length,

    skippedCount:
      results.filter(
        (result) =>
          result.status === "SKIPPED",
      ).length,

    failedCount:
      results.filter(
        (result) =>
          result.status === "FAILED",
      ).length,

    results,
  };
}