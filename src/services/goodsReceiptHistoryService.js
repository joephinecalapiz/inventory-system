import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "../firebase/firebase";

import { subscribeToGoodsReceipts } from "./goodsReceivingService";

function prepareGoodsReceiptId(value) {
  const goodsReceiptId = String(value ?? "").trim();

  if (!goodsReceiptId) {
    throw new Error("Goods Receipt ID is required.");
  }

  if (goodsReceiptId.includes("/")) {
    throw new Error("Goods Receipt ID is invalid.");
  }

  return goodsReceiptId;
}

function getReceiptSortTime(receipt) {
  if (typeof receipt.createdAt?.toMillis === "function") {
    return receipt.createdAt.toMillis();
  }

  if (typeof receipt.dateReceived?.toMillis === "function") {
    return receipt.dateReceived.toMillis();
  }

  return 0;
}

/**
 * Real-time Goods Receipt history subscription.
 *
 * This wraps the Phase 4G receipt subscription and
 * keeps the newest receipt first.
 */
export function subscribeToGoodsReceiptHistory(onData, onError) {
  return subscribeToGoodsReceipts(
    (receipts) => {
      const sortedReceipts = [...receipts].sort(
        (firstReceipt, secondReceipt) =>
          getReceiptSortTime(secondReceipt) - getReceiptSortTime(firstReceipt),
      );

      if (typeof onData === "function") {
        onData(sortedReceipts);
      }
    },

    onError,
  );
}

/**
 * Loads one permanent Goods Receipt and all of its
 * item documents.
 */
export async function getGoodsReceiptDetails(goodsReceiptId) {
  const normalizedGoodsReceiptId = prepareGoodsReceiptId(goodsReceiptId);

  const receiptReference = doc(db, "goodsReceipts", normalizedGoodsReceiptId);

  const itemsCollection = collection(
    db,
    "goodsReceipts",
    normalizedGoodsReceiptId,
    "items",
  );

  const [receiptSnapshot, itemsSnapshot] = await Promise.all([
    getDoc(receiptReference),
    getDocs(itemsCollection),
  ]);

  if (!receiptSnapshot.exists()) {
    throw new Error("The selected Goods Receipt could not be found.");
  }

  const items = itemsSnapshot.docs.map((itemDocument) => ({
    id: itemDocument.id,

    ...itemDocument.data(),
  }));

  items.sort((firstItem, secondItem) =>
    String(firstItem.productName ?? "").localeCompare(
      String(secondItem.productName ?? ""),
    ),
  );

  return {
    id: receiptSnapshot.id,

    ...receiptSnapshot.data(),

    items,
  };
}
