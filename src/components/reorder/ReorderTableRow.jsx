import { Link } from "react-router-dom";

import {
  canCreatePurchaseOrderFromRecommendation,
} from "../../utils/reorder/index.js";

import {
  canPerformReorderAction,
  REORDER_ACTIONS,
  getReorderStatusLabel,
} from "../../constants/reorder/index.js";

function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(Number(value ?? 0));
}

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "No cost";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value));
}

function StatusBadge({ value }) {
  const tone = String(value ?? "").toLowerCase();

  return (
    <span className={`reorder-status-badge reorder-status-${tone}`}>
      {getReorderStatusLabel(value)}
    </span>
  );
}

function RowActions({ item, currentUserRole }) {
  const mayCreate = canPerformReorderAction(
    currentUserRole,
    REORDER_ACTIONS.CREATE_PURCHASE_ORDER,
  );

  const mayAssign = canPerformReorderAction(
    currentUserRole,
    REORDER_ACTIONS.ASSIGN_SUPPLIER,
  );

  if (item.hasOpenPurchaseOrder) {
    return (
      <Link
        className="reorder-action-link"
        to="/purchase-orders"
        title={item.poNumber || "Open Purchase Order"}
      >
        View PO
      </Link>
    );
  }

  if (!item.hasSupplier) {
    return (
      <Link
        className={`reorder-action-link ${
          mayAssign ? "" : "reorder-action-disabled"
        }`}
        to={mayAssign ? "/suppliers" : "#"}
        aria-disabled={!mayAssign}
        onClick={(event) => {
          if (!mayAssign) event.preventDefault();
        }}
      >
        Assign Supplier
      </Link>
    );
  }

  const canCreate =
    mayCreate &&
    canCreatePurchaseOrderFromRecommendation(item);

  return (
    <Link
      className={`reorder-action-link ${
        canCreate ? "" : "reorder-action-disabled"
      }`}
      to={canCreate ? "/purchase-orders" : "#"}
      state={
        canCreate
          ? {
              reorderRecommendation: {
                productId: item.productId,
                suggestedQuantity: item.suggestedQuantity,
                supplierId: item.supplierId,
                unitCost: item.lastPurchaseCost,
              },
            }
          : undefined
      }
      aria-disabled={!canCreate}
      onClick={(event) => {
        if (!canCreate) event.preventDefault();
      }}
    >
      Create PO
    </Link>
  );
}

function ReorderTableRow({
  item,
  currentUserRole,
  mobile = false,
}) {
  if (mobile) {
    return (
      <article className="reorder-mobile-card">
        <div className="reorder-mobile-heading">
          <div>
            <strong>{item.productName}</strong>
            <span>{item.sku || "No SKU"}</span>
          </div>
          <StatusBadge value={item.reorderStatus} />
        </div>

        <dl>
          <div>
            <dt>Current stock</dt>
            <dd>
              {formatNumber(item.currentQuantity)}{" "}
              {item.unitAbbreviation}
            </dd>
          </div>
          <div>
            <dt>Reorder level</dt>
            <dd>{formatNumber(item.reorderLevel)}</dd>
          </div>
          <div>
            <dt>Suggested</dt>
            <dd>{formatNumber(item.suggestedQuantity)}</dd>
          </div>
          <div>
            <dt>Supplier</dt>
            <dd>{item.supplierName || "Not assigned"}</dd>
          </div>
          <div>
            <dt>Estimated cost</dt>
            <dd>{formatCurrency(item.estimatedReorderCost)}</dd>
          </div>
          <div>
            <dt>Purchase order</dt>
            <dd>{item.poNumber || "None"}</dd>
          </div>
        </dl>

        <RowActions
          item={item}
          currentUserRole={currentUserRole}
        />
      </article>
    );
  }

  return (
    <tr>
      <td>
        <strong>{item.productName}</strong>
        <span>{item.sku || "No SKU"}</span>
      </td>
      <td>{item.category}</td>
      <td>
        {formatNumber(item.currentQuantity)}{" "}
        {item.unitAbbreviation}
      </td>
      <td>{formatNumber(item.reorderLevel)}</td>
      <td className="reorder-emphasis">
        {formatNumber(item.suggestedQuantity)}
      </td>
      <td>{item.supplierName || "Not assigned"}</td>
      <td>{formatCurrency(item.lastPurchaseCost)}</td>
      <td>{formatCurrency(item.estimatedReorderCost)}</td>
      <td>
        <StatusBadge value={item.reorderStatus} />
      </td>
      <td>
        {item.poNumber ? (
          <div className="reorder-po-cell">
            <strong>{item.poNumber}</strong>
            <span>{item.purchaseOrderStatus}</span>
          </div>
        ) : (
          "None"
        )}
      </td>
      <td>
        <RowActions
          item={item}
          currentUserRole={currentUserRole}
        />
      </td>
    </tr>
  );
}

export default ReorderTableRow;
