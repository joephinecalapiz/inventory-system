import { PURCHASE_ORDER_STATUSES } from "../constants/purchaseOrders";

import { isPurchaseOrderEligibleForReceiving } from "../constants/goodsReceiving";

import {
  getPurchaseOrderDetails,
  subscribeToPurchaseOrders,
} from "./purchaseOrderService";

function preparePurchaseOrderId(value) {
  const purchaseOrderId = String(value ?? "").trim();

  if (!purchaseOrderId) {
    throw new Error("Purchase Order ID is required.");
  }

  if (purchaseOrderId.includes("/")) {
    throw new Error("Purchase Order ID is invalid.");
  }

  return purchaseOrderId;
}

function getPurchaseOrderSortTime(purchaseOrder) {
  if (typeof purchaseOrder.expectedDeliveryDate?.toMillis === "function") {
    return purchaseOrder.expectedDeliveryDate.toMillis();
  }

  if (typeof purchaseOrder.orderDate?.toMillis === "function") {
    return purchaseOrder.orderDate.toMillis();
  }

  return 0;
}

function getRemainingQuantity(purchaseOrder) {
  const totalOrderedQuantity = Number(purchaseOrder?.totalOrderedQuantity ?? 0);

  const totalReceivedQuantity = Number(
    purchaseOrder?.totalReceivedQuantity ?? 0,
  );

  if (
    !Number.isInteger(totalOrderedQuantity) ||
    !Number.isInteger(totalReceivedQuantity)
  ) {
    return 0;
  }

  return Math.max(totalOrderedQuantity - totalReceivedQuantity, 0);
}

/**
 * Real-time subscription containing only approved
 * or partially received Purchase Orders that still
 * have quantities available for receiving.
 */
export function subscribeToReceivablePurchaseOrders(onData, onError) {
  return subscribeToPurchaseOrders(
    (purchaseOrders) => {
      const receivablePurchaseOrders = purchaseOrders
        .filter(isPurchaseOrderEligibleForReceiving)
        .map((purchaseOrder) => ({
          ...purchaseOrder,

          remainingQuantity: getRemainingQuantity(purchaseOrder),
        }))
        .sort((firstPurchaseOrder, secondPurchaseOrder) => {
          const firstTime = getPurchaseOrderSortTime(firstPurchaseOrder);

          const secondTime = getPurchaseOrderSortTime(secondPurchaseOrder);

          if (firstTime !== secondTime) {
            return firstTime - secondTime;
          }

          return String(firstPurchaseOrder.poNumber ?? "").localeCompare(
            String(secondPurchaseOrder.poNumber ?? ""),
          );
        });

      if (typeof onData === "function") {
        onData(receivablePurchaseOrders);
      }
    },

    onError,
  );
}

/**
 * Loads one approved or partially received Purchase
 * Order and returns only items that still have a
 * remaining quantity.
 */
export async function getReceivablePurchaseOrderDetails(purchaseOrderId) {
  const normalizedPurchaseOrderId = preparePurchaseOrderId(purchaseOrderId);

  const purchaseOrder = await getPurchaseOrderDetails(
    normalizedPurchaseOrderId,
  );

  if (!isPurchaseOrderEligibleForReceiving(purchaseOrder)) {
    throw new Error(
      "Only Approved or Partially Received Purchase Orders with remaining quantities can be loaded.",
    );
  }

  const allowedStatuses = new Set([
    PURCHASE_ORDER_STATUSES.APPROVED,
    PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
  ]);

  const receivableItems = [];

  for (const item of purchaseOrder.items) {
    const orderedQuantity = Number(item.orderedQuantity ?? 0);

    const receivedQuantity = Number(item.receivedQuantity ?? 0);

    const remainingQuantity = Number(
      item.remainingQuantity ?? orderedQuantity - receivedQuantity,
    );

    if (
      !Number.isInteger(orderedQuantity) ||
      orderedQuantity < 1 ||
      !Number.isInteger(receivedQuantity) ||
      receivedQuantity < 0 ||
      !Number.isInteger(remainingQuantity) ||
      remainingQuantity < 0 ||
      receivedQuantity + remainingQuantity !== orderedQuantity
    ) {
      throw new Error(
        `The quantities for ${
          item.productName || item.productId
        } are inconsistent.`,
      );
    }

    if (item.poStatus && !allowedStatuses.has(item.poStatus)) {
      throw new Error(
        `The status for ${
          item.productName || item.productId
        } does not match a receivable Purchase Order.`,
      );
    }

    if (remainingQuantity === 0) {
      continue;
    }

    receivableItems.push({
      ...item,

      orderedQuantity,

      receivedQuantity,

      remainingQuantity,
    });
  }

  if (receivableItems.length === 0) {
    throw new Error(
      "This Purchase Order no longer has items available for receiving.",
    );
  }

  return {
    ...purchaseOrder,

    remainingQuantity: getRemainingQuantity(purchaseOrder),

    items: receivableItems,
  };
}
