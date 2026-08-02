import {
  calculateEstimatedReorderCost,
  calculateSuggestedReorderQuantity,
  createDefaultReorderFilters,
  REORDER_PURCHASE_ORDER_FILTERS,
  REORDER_SORT_DIRECTIONS,
  REORDER_SORT_FIELDS,
  REORDER_STATUSES,
  REORDER_STOCK_FILTERS,
  REORDER_SUPPLIER_FILTERS,
  resolveReorderStatus,
  shouldCreateReorder,
} from "../../constants/reorder/index.js";

import {
  PRODUCT_STOCK_STATUSES,
  resolveProductStockStatus,
} from "../../constants/stockStatus.js";

import { PURCHASE_ORDER_STATUSES } from "../../constants/purchaseOrders.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUppercase(value) {
  return normalizeText(value).toUpperCase();
}

function toWholeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function toMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

const OPEN_PURCHASE_ORDER_STATUSES = new Set([
  PURCHASE_ORDER_STATUSES.DRAFT,
  PURCHASE_ORDER_STATUSES.SUBMITTED,
  PURCHASE_ORDER_STATUSES.APPROVED,
  PURCHASE_ORDER_STATUSES.PARTIALLY_RECEIVED,
]);

function isOpenPurchaseOrder(purchaseOrder = {}) {
  return OPEN_PURCHASE_ORDER_STATUSES.has(
    normalizeUppercase(purchaseOrder.status),
  );
}

function getPurchaseOrderProductIds(purchaseOrder = {}) {
  if (!Array.isArray(purchaseOrder.itemProductIds)) return [];
  return purchaseOrder.itemProductIds.map(normalizeText).filter(Boolean);
}

function buildSupplierMap(suppliers = []) {
  return new Map(
    suppliers.map((supplier) => [normalizeText(supplier.id), supplier]),
  );
}

function buildOpenPurchaseOrderMap(purchaseOrders = []) {
  const map = new Map();
  for (const purchaseOrder of purchaseOrders) {
    if (!isOpenPurchaseOrder(purchaseOrder)) continue;
    for (const productId of getPurchaseOrderProductIds(purchaseOrder)) {
      const current = map.get(productId);
      if (
        !current ||
        toMillis(purchaseOrder.updatedAt ?? purchaseOrder.createdAt) >
          toMillis(current.updatedAt ?? current.createdAt)
      ) {
        map.set(productId, purchaseOrder);
      }
    }
  }
  return map;
}

function resolveSupplier(product, supplierMap) {
  const supplierId = normalizeText(
    product.preferredSupplierId ?? product.supplierId,
  );
  const supplier = supplierId ? supplierMap.get(supplierId) : null;

  return {
    supplierId: (supplier?.id ?? supplierId) || null,
    supplierName:
      normalizeText(
        supplier?.name ??
          product.preferredSupplierName ??
          product.supplierName,
      ) || null,
    supplierCode: normalizeText(supplier?.supplierCode) || null,
    supplierStatus: normalizeUppercase(supplier?.status) || null,
  };
}

function resolveCost(product = {}) {
  return toMoney(product.lastPurchaseCost) ?? toMoney(product.costPrice) ?? null;
}

function normalizeRecommendation({ product, supplier, purchaseOrder }) {
  const currentQuantity = toWholeNumber(product.quantity, 0);
  const reorderLevel = toWholeNumber(product.reorderLevel, 0);
  const stockStatus = resolveProductStockStatus(product);
  const suggestedQuantity = calculateSuggestedReorderQuantity({
    currentQuantity,
    reorderLevel,
  });
  const unitCost = resolveCost(product);
  const reorderStatus = resolveReorderStatus({
    currentQuantity,
    reorderLevel,
    purchaseOrderStatus: purchaseOrder?.status,
    receivedQuantity: purchaseOrder?.totalReceivedQuantity ?? 0,
    orderedQuantity: purchaseOrder?.totalOrderedQuantity ?? 0,
  });

  return {
    id: normalizeText(product.id),
    productId: normalizeText(product.id),
    productName:
      normalizeText(product.name ?? product.productName) || "Unnamed Product",
    sku: normalizeUppercase(product.sku),
    barcode: normalizeText(product.barcode),
    category:
      normalizeText(
        product.category ?? product.categoryName ?? product.categoryCode,
      ) || "Uncategorized",
    categoryCode: normalizeUppercase(
      product.categoryCode ?? product.categoryId,
    ),
    unitCode: normalizeUppercase(product.unitCode ?? product.unitId),
    unitName: normalizeText(product.unitName),
    unitAbbreviation: normalizeUppercase(product.unitAbbreviation),
    currentQuantity,
    reorderLevel,
    stockStatus,
    reorderStatus,
    suggestedQuantity,
    lastPurchaseCost: unitCost,
    estimatedReorderCost: calculateEstimatedReorderCost({
      suggestedQuantity,
      unitCost,
    }),
    ...supplier,
    hasSupplier: Boolean(supplier.supplierId),
    purchaseOrderId: normalizeText(purchaseOrder?.id) || null,
    poNumber: normalizeText(purchaseOrder?.poNumber) || null,
    purchaseOrderStatus: normalizeUppercase(purchaseOrder?.status) || null,
    hasOpenPurchaseOrder: Boolean(purchaseOrder?.id),
    updatedAt:
      product.updatedAt ??
      product.lastStockMovementAt ??
      product.createdAt ??
      null,
  };
}

export function buildReorderRecommendations({
  products = [],
  suppliers = [],
  purchaseOrders = [],
} = {}) {
  const supplierMap = buildSupplierMap(suppliers);
  const openPurchaseOrderMap = buildOpenPurchaseOrderMap(purchaseOrders);

  return (Array.isArray(products) ? products : [])
    .filter((product) => {
      const status = normalizeUppercase(product.status);
      return (
        (!status || status === "ACTIVE") &&
        (shouldCreateReorder(product) ||
          openPurchaseOrderMap.has(normalizeText(product.id)))
      );
    })
    .map((product) => {
      const productId = normalizeText(product.id);
      return normalizeRecommendation({
        product,
        supplier: resolveSupplier(product, supplierMap),
        purchaseOrder: openPurchaseOrderMap.get(productId) ?? null,
      });
    });
}

function matchesSearch(item, search) {
  if (!search) return true;
  return [
    item.productName,
    item.sku,
    item.barcode,
    item.category,
    item.supplierName,
    item.poNumber,
  ]
    .join(" ")
    .toUpperCase()
    .includes(search.toUpperCase());
}

function compareValues(first, second, field) {
  const firstValue = first[field];
  const secondValue = second[field];
  if (typeof firstValue === "number" && typeof secondValue === "number") {
    return firstValue - secondValue;
  }
  return String(firstValue ?? "").localeCompare(String(secondValue ?? ""));
}

export function filterAndSortReorderRecommendations(
  recommendations = [],
  filters = {},
) {
  const resolved = createDefaultReorderFilters(filters);

  const filtered = recommendations.filter((item) => {
    if (!matchesSearch(item, normalizeText(resolved.search))) return false;
    if (
      resolved.categoryCode &&
      item.categoryCode !== normalizeUppercase(resolved.categoryCode)
    ) return false;
    if (
      resolved.unitCode &&
      item.unitCode !== normalizeUppercase(resolved.unitCode)
    ) return false;
    if (
      resolved.supplierId &&
      item.supplierId !== normalizeText(resolved.supplierId)
    ) return false;
    if (
      resolved.stockStatus !== REORDER_STOCK_FILTERS.ALL &&
      item.stockStatus !== resolved.stockStatus
    ) return false;
    if (
      resolved.reorderStatus &&
      item.reorderStatus !== resolved.reorderStatus
    ) return false;
    if (
      resolved.supplierAssignment === REORDER_SUPPLIER_FILTERS.ASSIGNED &&
      !item.hasSupplier
    ) return false;
    if (
      resolved.supplierAssignment === REORDER_SUPPLIER_FILTERS.UNASSIGNED &&
      item.hasSupplier
    ) return false;
    if (
      resolved.purchaseOrderState ===
        REORDER_PURCHASE_ORDER_FILTERS.WITH_PURCHASE_ORDER &&
      !item.hasOpenPurchaseOrder
    ) return false;
    if (
      resolved.purchaseOrderState ===
        REORDER_PURCHASE_ORDER_FILTERS.WITHOUT_PURCHASE_ORDER &&
      item.hasOpenPurchaseOrder
    ) return false;
    return true;
  });

  const field = Object.values(REORDER_SORT_FIELDS).includes(resolved.sortBy)
    ? resolved.sortBy
    : REORDER_SORT_FIELDS.PRODUCT_NAME;
  const direction =
    resolved.sortDirection === REORDER_SORT_DIRECTIONS.DESC ? -1 : 1;

  return [...filtered].sort((first, second) => {
    if (field === REORDER_SORT_FIELDS.STATUS) {
      const urgency = {
        [REORDER_STATUSES.OUT_OF_STOCK]: 0,
        [REORDER_STATUSES.LOW_STOCK]: 1,
        [REORDER_STATUSES.PURCHASE_ORDER_CREATED]: 2,
        [REORDER_STATUSES.ORDERED]: 3,
        [REORDER_STATUSES.PARTIALLY_RECEIVED]: 4,
        [REORDER_STATUSES.RECEIVED]: 5,
        [REORDER_STATUSES.NOT_REQUIRED]: 6,
        [REORDER_STATUSES.CANCELLED]: 7,
      };
      return (
        ((urgency[first.reorderStatus] ?? 99) -
          (urgency[second.reorderStatus] ?? 99)) *
        direction
      );
    }
    return compareValues(first, second, field) * direction;
  });
}

export function validateReorderQuantity(value) {
  const quantity = Number(value);
  return (
    Number.isInteger(quantity) && quantity >= 1 && quantity <= 999999999
  );
}

export function canCreatePurchaseOrderFromRecommendation(
  recommendation = {},
) {
  return (
    Boolean(recommendation.productId) &&
    Boolean(recommendation.supplierId) &&
    validateReorderQuantity(recommendation.suggestedQuantity) &&
    !recommendation.hasOpenPurchaseOrder &&
    [
      PRODUCT_STOCK_STATUSES.LOW_STOCK,
      PRODUCT_STOCK_STATUSES.OUT_OF_STOCK,
    ].includes(recommendation.stockStatus)
  );
}
