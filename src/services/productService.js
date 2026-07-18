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

const CATEGORY_CODES = {
  "WATER METERS": "10",
  VALVES: "11",
  OTHERS: "12",
  "PE FITTINGS": "13",
  "GI FITTINGS": "14",
  "OIL & LUBRICANTS": "15",
  PARTS: "16",
  CONSUMABLES: "17",
  FLANGES: "18",
  "WATER QUALITY EQUIPMENTS": "19",
  "HDPE FITTINGS": "20",
  "PUMPS & MOTOR": "21",
  "FABRICATED FITTINGS": "22",
};

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
 * Creates a product and generates its barcode.
 */
export async function createProduct(productData) {
  const categoryCode =
    CATEGORY_CODES[productData.category];

  if (!categoryCode) {
    throw new Error(
      `No barcode code was found for category: ${productData.category}`,
    );
  }

  const counterReference = doc(
    db,
    "barcodeCounters",
    categoryCode,
  );

  const productReference = doc(
    collection(db, "products"),
  );

  let generatedBarcode = "";

  try {
    await runTransaction(db, async (transaction) => {
      const counterSnapshot =
        await transaction.get(counterReference);

      const previousSequence = counterSnapshot.exists()
        ? Number(
            counterSnapshot.data().lastSequence ?? 0,
          )
        : 0;

      const nextSequence = previousSequence + 1;

      if (nextSequence > 999999999) {
        throw new Error(
          "The barcode sequence for this category is full.",
        );
      }

      const sequenceText = String(nextSequence).padStart(
        9,
        "0",
      );

      const firstElevenDigits =
        categoryCode + sequenceText;

      const checkDigit =
        calculateUpcCheckDigit(firstElevenDigits);

      generatedBarcode =
        firstElevenDigits + String(checkDigit);

      transaction.set(
        counterReference,
        {
          category: productData.category,
          lastSequence: nextSequence,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      transaction.set(productReference, {
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

        barcode: generatedBarcode,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      });
    });

    console.log("Product successfully saved:", {
      id: productReference.id,
      name: productData.name,
      barcode: generatedBarcode,
    });

    return {
      id: productReference.id,
      barcode: generatedBarcode,
    };
  } catch (error) {
    console.error(
      "Unable to create Firestore product:",
      error,
    );

    // Send the error back to AddProduct.jsx.
    throw error;
  }
}

/**
 * Updates an existing product.
 *
 * The original barcode remains unchanged.
 */
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