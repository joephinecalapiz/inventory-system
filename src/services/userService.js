import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import {
  isValidUserRole,
  USER_STATUSES,
} from "../constants/roles";

/**
 * Reads one user profile from Firestore.
 */
export async function getUserProfile(userId) {
  if (!userId) {
    throw new Error("A Firebase user ID is required.");
  }

  const userReference = doc(
    db,
    "users",
    userId,
  );

  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    return null;
  }

  return {
    id: userSnapshot.id,
    ...userSnapshot.data(),
  };
}

/**
 * Listens for changes to a user's Firestore profile.
 */
export function subscribeToUserProfile(
  userId,
  onProfileChanged,
  onError,
) {
  if (!userId) {
    throw new Error("A Firebase user ID is required.");
  }

  const userReference = doc(
    db,
    "users",
    userId,
  );

  return onSnapshot(
    userReference,

    (snapshot) => {
      if (!snapshot.exists()) {
        onProfileChanged(null);
        return;
      }

      onProfileChanged({
        id: snapshot.id,
        ...snapshot.data(),
      });
    },

    (error) => {
      console.error(
        "Unable to load the user profile:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}
/**
 * Listens to all system user profiles.
 *
 * Only Superadmin and Admin accounts are allowed
 * to perform this query based on Firestore Rules.
 */
export function subscribeToUsers(
  onUsersChanged,
  onError,
) {
  const usersCollection = collection(
    db,
    "users",
  );

  return onSnapshot(
    usersCollection,

    (snapshot) => {
      const users = snapshot.docs
        .map((userDocument) => ({
          id: userDocument.id,
          ...userDocument.data(),
        }))
        .sort((firstUser, secondUser) => {
          const firstName =
            firstUser.displayName ||
            firstUser.email ||
            "";

          const secondName =
            secondUser.displayName ||
            secondUser.email ||
            "";

          return firstName.localeCompare(
            secondName,
          );
        });

      onUsersChanged(users);
    },

    (error) => {
      console.error(
        "Unable to load system users:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}

/**
 * Updates the assigned role and account status of
 * an existing system user.
 *
 * Firestore Security Rules still make the final
 * permission decision.
 */
export async function updateUserAccess({
  userId,
  role,
  status,
  updatedBy,
}) {
  if (!userId) {
    throw new Error("The user ID is required.");
  }

  if (!updatedBy) {
    throw new Error(
      "The administrator ID is required.",
    );
  }

  if (userId === updatedBy) {
    throw new Error(
      "You cannot change your own role or account status.",
    );
  }

  if (!isValidUserRole(role)) {
    throw new Error(
      "The selected user role is invalid.",
    );
  }

  const validStatuses = Object.values(
    USER_STATUSES,
  );

  if (!validStatuses.includes(status)) {
    throw new Error(
      "The selected account status is invalid.",
    );
  }

  const userReference = doc(
    db,
    "users",
    userId,
  );

  await updateDoc(userReference, {
    role,
    status,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}