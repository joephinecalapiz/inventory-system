import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "../firebase/firebase";

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginAdmin(email, password) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );

  return userCredential.user;
}

export async function logoutAdmin() {
  await signOut(auth);
}