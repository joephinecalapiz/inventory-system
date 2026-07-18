import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

function ProductBarcode({ value }) {
  const barcodeRef = useRef(null);

  const isValidFormat = /^\d{12}$/.test(value);

  useEffect(() => {
    if (!barcodeRef.current || !isValidFormat) {
      return;
    }

    try {
      JsBarcode(barcodeRef.current, value, {
        format: "UPC",
        width: 2,
        height: 70,
        displayValue: true,
        fontSize: 18,
        textMargin: 4,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (error) {
      console.error("Unable to generate barcode:", error);
    }
  }, [value, isValidFormat]);

  if (!isValidFormat) {
    return (
      <span className="invalid-barcode">
        Barcode must contain exactly 12 digits.
      </span>
    );
  }

  return (
    <div className="barcode-container">
      <svg
        ref={barcodeRef}
        aria-label={`UPC-A barcode ${value}`}
      />
    </div>
  );
}

export default ProductBarcode;