import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";

const stockMovementsCollection = collection(db, "stockMovements");

export function subscribeToSalesMovements(onSalesChanged, onError) {
  return onSnapshot(
    stockMovementsCollection,
    (snapshot) => {
      const movements = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter(
          (movement) =>
            String(movement.movementType).toUpperCase() === "OUT",
        )
        .sort(
          (first, second) =>
            getTimestamp(second.createdAt) - getTimestamp(first.createdAt),
        );

      onSalesChanged(movements);
    },
    (error) => {
      console.error("Unable to load dashboard sales:", error);
      onError?.(error);
    },
  );
}

function getTimestamp(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
