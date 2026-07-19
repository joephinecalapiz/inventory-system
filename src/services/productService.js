import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const productsCollection = collection(db, "products");



/**
 * Calculates the final check digit of a 12-digit UPC-A barcode.
 */
function calculateUpcCheckDigit(firstElevenDigits) {
  if (!/^\d{11}$/.test(firstElevenDigits)) {
    throw new Error(
      "The barcode base must contain exactly 11 digits.",
    );
  }

  const digits = firstElevenDigits.split("").map(Number);

  const oddPositionTotal =
    (
      digits[0] +
      digits[2] +
      digits[4] +
      digits[6] +
      digits[8] +
      digits[10]
    ) * 3;

  const evenPositionTotal =
    digits[1] +
    digits[3] +
    digits[5] +
    digits[7] +
    digits[9];

  return (
    10 - ((oddPositionTotal + evenPositionTotal) % 10)
  ) % 10;
}

/**
 * Loads products and listens for Firestore changes.
 */
export function subscribeToProducts(
  onProductsChanged,
  onError,
) {
  return onSnapshot(
    productsCollection,

    (snapshot) => {
      const products = snapshot.docs.map(
        (productDocument) => ({
          id: productDocument.id,
          ...productDocument.data(),
        }),
      );

      products.sort((firstProduct, secondProduct) => {
        const firstCreatedAt =
          firstProduct.createdAt?.toMillis?.() ?? 0;

        const secondCreatedAt =
          secondProduct.createdAt?.toMillis?.() ?? 0;

        return secondCreatedAt - firstCreatedAt;
      });

      console.log(
        "Products loaded from Firestore:",
        products,
      );

      onProductsChanged(products);
    },

    (error) => {
      console.error(
        "Unable to load Firestore products:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}

/**
 * Creates a product and generates its barcode
 * using active Firestore category and unit records.
 */
export async function createProduct(productData) {
  const categoryCode = String(
    productData?.categoryCode ?? "",
  )
    .trim()
    .toUpperCase();

  const unitCode = String(
    productData?.unitCode ?? "",
  )
    .trim()
    .toUpperCase();

  if (
    !/^[A-Z0-9_]{2,50}$/.test(
      categoryCode,
    )
  ) {
    throw new Error(
      "A valid Firestore category code is required.",
    );
  }

  if (
    !/^[A-Z0-9_]{1,50}$/.test(
      unitCode,
    )
  ) {
    throw new Error(
      "A valid unit of measurement is required.",
    );
  }

  const categoryReference = doc(
    db,
    "categories",
    categoryCode,
  );

  const unitReference = doc(
    db,
    "units",
    unitCode,
  );

  const productReference = doc(
    collection(db, "products"),
  );

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
        const categorySnapshot =
          await transaction.get(
            categoryReference,
          );

        if (!categorySnapshot.exists()) {
          throw new Error(
            "The selected category no longer exists.",
          );
        }

        const category =
          categorySnapshot.data();

        if (category.status !== "ACTIVE") {
          throw new Error(
            `The category "${category.name}" is not active.`,
          );
        }

        resolvedCategoryName = String(
          category.name ?? "",
        ).trim();

        resolvedBarcodePrefix = String(
          category.barcodePrefix ?? "",
        ).trim();

        if (!resolvedCategoryName) {
          throw new Error(
            "The selected category does not have a valid name.",
          );
        }

        if (
          !/^\d{2}$/.test(
            resolvedBarcodePrefix,
          )
        ) {
          throw new Error(
            "The selected category does not have a valid two-digit barcode prefix.",
          );
        }

        /*
         * Read the selected unit before performing
         * any transaction writes.
         */
        const unitSnapshot =
          await transaction.get(
            unitReference,
          );

        if (!unitSnapshot.exists()) {
          throw new Error(
            "The selected unit of measurement no longer exists.",
          );
        }

        const unit = unitSnapshot.data();

        if (unit.status !== "ACTIVE") {
          throw new Error(
            `The unit "${unit.name}" is not active.`,
          );
        }

        resolvedUnitName = String(
          unit.name ?? "",
        ).trim();

        resolvedUnitAbbreviation = String(
          unit.abbreviation ?? "",
        )
          .trim()
          .toUpperCase();

        if (!resolvedUnitName) {
          throw new Error(
            "The selected unit does not have a valid name.",
          );
        }

        if (
          !/^[A-Z0-9]{1,10}$/.test(
            resolvedUnitAbbreviation,
          )
        ) {
          throw new Error(
            "The selected unit does not have a valid abbreviation.",
          );
        }

        const counterReference = doc(
          db,
          "barcodeCounters",
          resolvedBarcodePrefix,
        );

        /*
         * This is the final transaction read.
         * All writes happen afterward.
         */
        const counterSnapshot =
          await transaction.get(
            counterReference,
          );

        const previousSequence =
          counterSnapshot.exists()
            ? Number(
                counterSnapshot.data()
                  .lastSequence ?? 0,
              )
            : 0;

        const nextSequence =
          previousSequence + 1;

        if (
          nextSequence > 999999999
        ) {
          throw new Error(
            "The barcode sequence for this category is full.",
          );
        }

        const sequenceText = String(
          nextSequence,
        ).padStart(9, "0");

        const firstElevenDigits =
          resolvedBarcodePrefix +
          sequenceText;

        const checkDigit =
          calculateUpcCheckDigit(
            firstElevenDigits,
          );

        generatedBarcode =
          firstElevenDigits +
          String(checkDigit);

        transaction.set(
          counterReference,
          {
            category:
              resolvedCategoryName,

            categoryCode,

            barcodePrefix:
              resolvedBarcodePrefix,

            lastSequence:
              nextSequence,

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          },
        );

        transaction.set(
          productReference,
          {
            name: String(
              productData.name,
            ).trim(),

            sku: String(
              productData.sku,
            )
              .trim()
              .toUpperCase(),

            /*
             * Category snapshot fields.
             */
            category:
              resolvedCategoryName,

            categoryName:
              resolvedCategoryName,

            categoryCode,

            categoryId:
              categoryCode,

            barcodePrefix:
              resolvedBarcodePrefix,

            /*
             * Unit snapshot fields.
             *
             * These allow product lists and reports
             * to display the unit without making a
             * separate Firestore request each time.
             */
            unitCode,

            unitId:
              unitCode,

            unitName:
              resolvedUnitName,

            unitAbbreviation:
              resolvedUnitAbbreviation,

            price: Number(
              productData.price,
            ),

            quantity: Number(
              productData.quantity,
            ),

            reorderLevel: Number(
              productData.reorderLevel,
            ),

            barcode:
              generatedBarcode,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );
      },
    );

    console.log(
      "Product successfully saved:",
      {
        id:
          productReference.id,

        name:
          productData.name,

        category:
          resolvedCategoryName,

        categoryCode,

        unit:
          resolvedUnitName,

        unitAbbreviation:
          resolvedUnitAbbreviation,

        barcode:
          generatedBarcode,
      },
    );

    return {
      id:
        productReference.id,

      barcode:
        generatedBarcode,

      category:
        resolvedCategoryName,

      categoryCode,

      unitCode,

      unitName:
        resolvedUnitName,

      unitAbbreviation:
        resolvedUnitAbbreviation,
    };
  } catch (error) {
    console.error(
      "Unable to create Firestore product:",
      error,
    );

    throw error;
  }
}


/**
 * Assigns an active Unit of Measurement to an
 * existing product without changing its barcode,
 * category, quantity, price, or other fields.
 */
export async function assignProductUnit(
  productId,
  unitCode,
) {
  if (!productId) {
    throw new Error(
      "A product ID is required.",
    );
  }

  const normalizedUnitCode = String(
    unitCode ?? "",
  )
    .trim()
    .toUpperCase();

  if (
    !/^[A-Z0-9_]{1,50}$/.test(
      normalizedUnitCode,
    )
  ) {
    throw new Error(
      "A valid unit of measurement is required.",
    );
  }

  const productReference = doc(
    db,
    "products",
    productId,
  );

  const unitReference = doc(
    db,
    "units",
    normalizedUnitCode,
  );

  let assignedUnit = null;

  try {
    await runTransaction(
      db,
      async (transaction) => {
        /*
         * Read the product first.
         */
        const productSnapshot =
          await transaction.get(
            productReference,
          );

        if (!productSnapshot.exists()) {
          throw new Error(
            "The selected product no longer exists.",
          );
        }

        const product =
          productSnapshot.data();

        /*
         * Read the Unit of Measurement before
         * performing any transaction writes.
         */
        const unitSnapshot =
          await transaction.get(
            unitReference,
          );

        if (!unitSnapshot.exists()) {
          throw new Error(
            "The selected unit of measurement no longer exists.",
          );
        }

        const unit =
          unitSnapshot.data();

        if (unit.status !== "ACTIVE") {
          throw new Error(
            `The unit "${unit.name}" is not active.`,
          );
        }

        const resolvedUnitName = String(
          unit.name ?? "",
        ).trim();

        const resolvedUnitAbbreviation =
          String(
            unit.abbreviation ?? "",
          )
            .trim()
            .toUpperCase();

        if (!resolvedUnitName) {
          throw new Error(
            "The selected unit does not have a valid name.",
          );
        }

        if (
          !/^[A-Z0-9]{1,10}$/.test(
            resolvedUnitAbbreviation,
          )
        ) {
          throw new Error(
            "The selected unit does not have a valid abbreviation.",
          );
        }

        const existingUnitCode = String(
          product.unitCode ??
            product.unitId ??
            "",
        )
          .trim()
          .toUpperCase();

        /*
         * Do not allow an existing product's unit
         * to be replaced with a different unit.
         *
         * The same unit code may be used to complete
         * partially migrated product records.
         */
        if (
          existingUnitCode &&
          existingUnitCode !==
            normalizedUnitCode
        ) {
          throw new Error(
            `This product is already assigned to unit ${existingUnitCode}.`,
          );
        }

        transaction.update(
          productReference,
          {
            unitCode:
              normalizedUnitCode,

            unitId:
              normalizedUnitCode,

            unitName:
              resolvedUnitName,

            unitAbbreviation:
              resolvedUnitAbbreviation,

            updatedAt:
              serverTimestamp(),
          },
        );

        assignedUnit = {
          unitCode:
            normalizedUnitCode,

          unitName:
            resolvedUnitName,

          unitAbbreviation:
            resolvedUnitAbbreviation,
        };
      },
    );

    console.log(
      "Product unit successfully assigned:",
      {
        productId,
        ...assignedUnit,
      },
    );

    return assignedUnit;
  } catch (error) {
    console.error(
      "Unable to assign product unit:",
      error,
    );

    throw error;
  }
}

export async function updateProduct(
  productId,
  productData,
) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  const productReference = doc(
    db,
    "products",
    productId,
  );

  try {
    await updateDoc(productReference, {
      name: String(productData.name).trim(),

      sku: String(productData.sku)
        .trim()
        .toUpperCase(),

      category: String(productData.category).trim(),

      price: Number(productData.price),

      quantity: Number(productData.quantity),

      reorderLevel: Number(
        productData.reorderLevel,
      ),

      updatedAt: serverTimestamp(),
    });

    console.log("Product successfully updated:", productId);
  } catch (error) {
    console.error(
      "Unable to update Firestore product:",
      error,
    );

    throw error;
  }
}

/**
 * Deletes an existing product.
 */
export async function deleteProduct(productId) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  const productReference = doc(
    db,
    "products",
    productId,
  );

  try {
    await deleteDoc(productReference);

    console.log("Product successfully deleted:", productId);
  } catch (error) {
    console.error(
      "Unable to delete Firestore product:",
      error,
    );

    throw error;
  }
}

/**
 * Performs Stock In or Stock Out and records the movement.
 */
export async function adjustProductStock(
  productId,
  movementType,
  amount,
) {
  if (!productId) {
    throw new Error("A product ID is required.");
  }

  if (
    movementType !== "IN" &&
    movementType !== "OUT"
  ) {
    throw new Error(
      "Movement type must be IN or OUT.",
    );
  }

  const adjustmentAmount = Number(amount);

  if (
    !Number.isInteger(adjustmentAmount) ||
    adjustmentAmount <= 0
  ) {
    throw new Error(
      "The stock quantity must be a positive whole number.",
    );
  }

  const productReference = doc(
    db,
    "products",
    productId,
  );

  const movementReference = doc(
    collection(db, "stockMovements"),
  );

  try {
    await runTransaction(db, async (transaction) => {
      const productSnapshot =
        await transaction.get(productReference);

      if (!productSnapshot.exists()) {
        throw new Error(
          "The selected product no longer exists.",
        );
      }

      const product = productSnapshot.data();

      const previousQuantity = Number(
        product.quantity ?? 0,
      );

      const newQuantity =
        movementType === "IN"
          ? previousQuantity + adjustmentAmount
          : previousQuantity - adjustmentAmount;

      if (newQuantity < 0) {
        throw new Error(
          `Insufficient stock. Only ${previousQuantity} item(s) are available.`,
        );
      }

      transaction.update(productReference, {
        quantity: newQuantity,
        updatedAt: serverTimestamp(),
      });

      transaction.set(movementReference, {
        productId,
        productName: product.name,
        productSku: product.sku,
        movementType,
        quantity: adjustmentAmount,
        previousQuantity,
        newQuantity,
        createdAt: serverTimestamp(),
      });
    });

    console.log("Stock successfully updated:", {
      productId,
      movementType,
      amount: adjustmentAmount,
    });
  } catch (error) {
    console.error(
      "Unable to adjust product stock:",
      error,
    );

    throw error;
  }
}