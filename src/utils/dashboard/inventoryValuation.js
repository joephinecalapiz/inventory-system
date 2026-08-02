function normalizeText(value) {
  return String(value ?? "").trim();
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function roundCurrency(value) {
  return (
    Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100
  );
}

function isActiveProduct(product = {}) {
  if (typeof product.isActive === "boolean") {
    return product.isActive;
  }

  const status = normalizeText(product.status).toUpperCase();

  return !status || status === "ACTIVE";
}

function getQuantity(product = {}) {
  return Math.max(toFiniteNumber(product.quantity, 0), 0);
}

export function resolveInventoryUnitCost(product = {}) {
  const candidates = [
    product.costPrice,
    product.averageUnitCost,
    product.unitCost,
    product.lastPurchaseCost,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined &&
      Number.isFinite(Number(candidate))
    ) {
      return Math.max(Number(candidate), 0);
    }
  }

  return 0;
}

export function calculateProductInventoryValue(product = {}) {
  return roundCurrency(
    getQuantity(product) * resolveInventoryUnitCost(product),
  );
}

export function buildInventoryValuationSummary(products = []) {
  const activeProducts = (Array.isArray(products) ? products : [])
    .filter(isActiveProduct)
    .map((product) => {
      const quantity = getQuantity(product);
      const unitCost = resolveInventoryUnitCost(product);
      const inventoryValue = roundCurrency(quantity * unitCost);

      return {
        id: product.id,
        productName:
          normalizeText(product.name ?? product.productName) ||
          "Unnamed Product",
        sku: normalizeText(product.sku),
        category:
          normalizeText(
            product.category ??
              product.categoryName ??
              product.categoryCode,
          ) || "Uncategorized",
        quantity,
        unitCost,
        inventoryValue,
        hasCost: unitCost > 0,
      };
    });

  const valuedProducts = activeProducts.filter(
    (product) => product.hasCost,
  );

  const productsWithoutCost = activeProducts.filter(
    (product) => !product.hasCost,
  );

  const totalInventoryValue = roundCurrency(
    activeProducts.reduce(
      (total, product) => total + product.inventoryValue,
      0,
    ),
  );

  const totalStockQuantity = activeProducts.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  const categoryMap = new Map();

  for (const product of activeProducts) {
    const current = categoryMap.get(product.category) ?? {
      category: product.category,
      productCount: 0,
      totalQuantity: 0,
      inventoryValue: 0,
      productsWithoutCost: 0,
    };

    current.productCount += 1;
    current.totalQuantity += product.quantity;
    current.inventoryValue += product.inventoryValue;

    if (!product.hasCost) {
      current.productsWithoutCost += 1;
    }

    categoryMap.set(product.category, current);
  }

  const categoryValuation = [...categoryMap.values()]
    .map((category) => ({
      ...category,
      inventoryValue: roundCurrency(category.inventoryValue),
      valuePercentage:
        totalInventoryValue > 0
          ? roundCurrency(
              (category.inventoryValue / totalInventoryValue) * 100,
            )
          : 0,
    }))
    .sort(
      (first, second) =>
        second.inventoryValue - first.inventoryValue ||
        first.category.localeCompare(second.category),
    );

  const topValuedProducts = [...activeProducts]
    .sort(
      (first, second) =>
        second.inventoryValue - first.inventoryValue ||
        first.productName.localeCompare(second.productName),
    )
    .slice(0, 10);

  return {
    totalInventoryValue,
    totalStockQuantity,
    activeProductCount: activeProducts.length,
    valuedProductCount: valuedProducts.length,
    productsWithoutCostCount: productsWithoutCost.length,
    valuationCoveragePercent:
      activeProducts.length > 0
        ? roundCurrency(
            (valuedProducts.length / activeProducts.length) * 100,
          )
        : 0,
    averageValuePerProduct:
      activeProducts.length > 0
        ? roundCurrency(
            totalInventoryValue / activeProducts.length,
          )
        : 0,
    averageValuePerUnit:
      totalStockQuantity > 0
        ? roundCurrency(totalInventoryValue / totalStockQuantity)
        : 0,
    productsWithoutCost,
    categoryValuation,
    topValuedProducts,
  };
}

export function getValuationWarningMessage(summary = {}) {
  const missingCount = Number(summary.productsWithoutCostCount ?? 0);

  if (missingCount <= 0) {
    return "";
  }

  return `${missingCount} active product${
    missingCount === 1 ? "" : "s"
  } have no usable cost and are excluded from inventory value.`;
}
