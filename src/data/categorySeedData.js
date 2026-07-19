/*
 * One-time migration data for the categories
 * previously hardcoded in productService.js.
 *
 * After importing, Firestore becomes the source
 * of truth for Category Management.
 */
export const CATEGORY_SEED_DATA =
  Object.freeze([
    {
      name: "WATER METERS",
      barcodePrefix: "10",
      description: "",
    },
    {
      name: "VALVES",
      barcodePrefix: "11",
      description: "",
    },
    {
      name: "OTHERS",
      barcodePrefix: "12",
      description: "",
    },
    {
      name: "PE FITTINGS",
      barcodePrefix: "13",
      description: "",
    },
    {
      name: "GI FITTINGS",
      barcodePrefix: "14",
      description: "",
    },
    {
      name: "OIL & LUBRICANTS",
      barcodePrefix: "15",
      description: "",
    },
    {
      name: "PARTS",
      barcodePrefix: "16",
      description: "",
    },
    {
      name: "CONSUMABLES",
      barcodePrefix: "17",
      description: "",
    },
    {
      name: "FLANGES",
      barcodePrefix: "18",
      description: "",
    },
    {
      name: "WATER QUALITY EQUIPMENTS",
      barcodePrefix: "19",
      description: "",
    },
    {
      name: "HDPE FITTINGS",
      barcodePrefix: "20",
      description: "",
    },
    {
      name: "PUMPS & MOTOR",
      barcodePrefix: "21",
      description: "",
    },
    {
      name: "FABRICATED FITTINGS",
      barcodePrefix: "22",
      description: "",
    },
  ]);