import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { createTrustedAccessCache } from "./trustedAccessCache";

const googleProvider = new GoogleAuthProvider();
let googleRedirectResultPromise = null;

export function observeAuthState(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}

export async function signOutUser() {
  clearTrustedAccessCache();
  await signOut(auth);
}

export function signInWithEmailPassword(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (
      error?.code === "auth/popup-blocked"
      || error?.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

export function clearTrustedAccessCache(uid) {
  trustedAccessCache.clear(uid);
}

async function requestTrustedAccess(uid) {
  // This callable is the sole client authority source; never fall back to Firestore role reads.
  const getMyAccess = httpsCallable(functions, "getMyAccess");
  const result = await getMyAccess({});
  const data = result?.data;
  if (!data || data.uid !== uid) {
    throw new Error("Trusted access response did not match the authenticated user.");
  }
  return data;
}

const trustedAccessCache = createTrustedAccessCache(requestTrustedAccess);

export function getTrustedAccess(options = {}) {
  const uid = options.uid || auth.currentUser?.uid || "";
  const refresh = options.refresh === true;
  return trustedAccessCache.get({ uid, refresh });
}

export function completeGoogleRedirectResult() {
  if (!googleRedirectResultPromise) {
    googleRedirectResultPromise = getRedirectResult(auth);
  }
  return googleRedirectResultPromise;
}
