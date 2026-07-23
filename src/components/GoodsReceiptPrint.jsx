function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value ?? 0));
}

function convertToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDisplayDate(value) {
  const date = convertToDate(value);

  if (!date) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(date);
}

function GoodsReceiptPrint({ receipt }) {
  if (!receipt) {
    return null;
  }

  return (
    <section className="goods-receipt-print-root" aria-hidden="true">
      <header className="goods-receipt-print-header">
        <div>
          <p className="goods-receipt-print-system-name">Inventory System</p>

          <h1>Goods Receipt Note</h1>

          <p>
            Permanent record of goods received against an approved Purchase
            Order
          </p>
        </div>

        <div className="goods-receipt-print-document-code">
          <span>GRN Number</span>

          <strong>{receipt.goodsReceiptNumber}</strong>

          <small>Status: {receipt.status}</small>
        </div>
      </header>

      <section className="goods-receipt-print-meta-grid">
        <div>
          <span>Purchase Order</span>

          <strong>{receipt.poNumber}</strong>
        </div>

        <div>
          <span>Date received</span>

          <strong>{formatDisplayDate(receipt.dateReceived)}</strong>
        </div>

        <div>
          <span>Supplier reference</span>

          <strong>{receipt.referenceNumber}</strong>
        </div>

        <div>
          <span>Supplier code</span>

          <strong>{receipt.supplierCode}</strong>
        </div>
      </section>

      <section className="goods-receipt-print-supplier">
        <span>Supplier</span>

        <strong>{receipt.supplierName}</strong>
      </section>

      <div className="goods-receipt-print-items-wrapper">
        <table className="goods-receipt-print-items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Ordered</th>
              <th>Previously Received</th>
              <th>Received on GRN</th>
              <th>Remaining</th>
              <th>Unit Cost</th>
              <th>Line Total</th>
            </tr>
          </thead>

          <tbody>
            {receipt.items.map((item, index) => (
              <tr key={item.id || item.productId}>
                <td>{index + 1}</td>

                <td>
                  <strong>{item.productName}</strong>

                  {item.category && <small>{item.category}</small>}
                </td>

                <td>{item.productSku}</td>

                <td>{item.unitAbbreviation || item.unitName || "—"}</td>

                <td>{Number(item.orderedQuantity ?? 0)}</td>

                <td>{Number(item.previouslyReceivedQuantity ?? 0)}</td>

                <td>
                  <strong>{Number(item.quantityReceived ?? 0)}</strong>
                </td>

                <td>{Number(item.remainingQuantity ?? 0)}</td>

                <td>{formatCurrency(item.unitCost)}</td>

                <td>
                  <strong>{formatCurrency(item.lineTotal)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="goods-receipt-print-totals">
        <div>
          <span>Receipt items</span>

          <strong>{receipt.itemCount}</strong>
        </div>

        <div>
          <span>Total quantity received</span>

          <strong>{receipt.totalReceivedQuantity}</strong>
        </div>

        <div>
          <span>Total receiving value</span>

          <strong>{formatCurrency(receipt.totalValue)}</strong>
        </div>
      </section>

      {receipt.remarks && (
        <section className="goods-receipt-print-remarks">
          <span>Remarks</span>

          <p>{receipt.remarks}</p>
        </section>
      )}

      <section className="goods-receipt-print-signatures">
        <div>
          <span>Received by</span>

          <strong>{receipt.receivedByName || receipt.receivedBy || ""}</strong>

          <small>Signature over printed name</small>
        </div>

        <div>
          <span>Checked by</span>

          <strong>&nbsp;</strong>

          <small>Signature over printed name</small>
        </div>

        <div>
          <span>Approved by</span>

          <strong>&nbsp;</strong>

          <small>Signature over printed name</small>
        </div>
      </section>

      <footer className="goods-receipt-print-footer">
        <span>Generated from the Inventory System</span>

        <span>{receipt.goodsReceiptNumber}</span>
      </footer>
    </section>
  );
}

export default GoodsReceiptPrint;
