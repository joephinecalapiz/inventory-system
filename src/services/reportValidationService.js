import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  INVENTORY_TRANSACTION_COLLECTION,
} from "../constants/reports";

import {
  reconcileProductBalance,
  validateProductReportState,
  validateReportTransactionRecord,
} from "../utils/reports";

function getTransactionSortValue(transaction = {}) {
  return (
    transaction.transactionDate?.toMillis?.() ??
    transaction.createdAt?.toMillis?.() ??
    0
  );
}

export async function validateReportingFoundation() {
  const [
    productSnapshot,
    transactionSnapshot,
  ] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, INVENTORY_TRANSACTION_COLLECTION)),
  ]);

  const products = productSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  const transactions = transactionSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  const productResults = products.map((product) => ({
    productId: product.id,
    ...validateProductReportState(product),
  }));

  const transactionResults = transactions.map((transaction) => ({
    transactionId: transaction.id,
    ...validateReportTransactionRecord(transaction),
  }));

  const invalidProducts = productResults.filter(
    (result) => !result.isValid,
  );

  const invalidTransactions = transactionResults.filter(
    (result) => !result.isValid,
  );

  return {
    passed:
      invalidProducts.length === 0 &&
      invalidTransactions.length === 0,
    totals: {
      products: products.length,
      transactions: transactions.length,
      invalidProducts: invalidProducts.length,
      invalidTransactions: invalidTransactions.length,
    },
    invalidProducts,
    invalidTransactions,
  };
}

export async function reconcileSingleProduct(productId) {
  const normalizedProductId = String(productId ?? "").trim();

  if (!normalizedProductId) {
    throw new Error("Product ID is required.");
  }

  const productQuerySnapshot = await getDocs(
    query(
      collection(db, "products"),
      where("__name__", "==", normalizedProductId),
    ),
  );

  if (productQuerySnapshot.empty) {
    throw new Error("Product could not be found.");
  }

  const productSnapshot = productQuerySnapshot.docs[0];
  const product = {
    id: productSnapshot.id,
    ...productSnapshot.data(),
  };

  const transactionSnapshot = await getDocs(
    query(
      collection(db, INVENTORY_TRANSACTION_COLLECTION),
      where("productId", "==", normalizedProductId),
      orderBy("transactionDate", "asc"),
    ),
  );

  const transactions = transactionSnapshot.docs
    .map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }))
    .sort(
      (first, second) =>
        getTransactionSortValue(first) -
        getTransactionSortValue(second),
    );

  if (transactions.length === 0) {
    return {
      productId: normalizedProductId,
      productName: product.name ?? "",
      hasTransactions: false,
      isReconciled: Number(product.quantity ?? 0) === 0,
      currentQuantity: Number(product.quantity ?? 0),
      calculatedQuantity: 0,
      difference: Number(product.quantity ?? 0),
      transactions: [],
    };
  }

  const openingTransaction = transactions[0];

  const openingBalance = Number(
    openingTransaction.quantityBefore ?? 0,
  );

  const reconciliation = reconcileProductBalance({
    openingBalance,
    transactions,
    currentQuantity: Number(product.quantity ?? 0),
  });

  return {
    productId: normalizedProductId,
    productName: product.name ?? "",
    hasTransactions: true,
    transactionCount: transactions.length,
    ...reconciliation,
    transactions,
  };
}
