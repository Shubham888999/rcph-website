import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { createTrustedAccessCache } from "./trustedAccessCache";
import {
  createPasswordResetPayload,
  normalizeRecoveryEmail,
} from "./passwordRecoveryModel";

const googleProvider = new GoogleAuthProvider();
let googleRedirectResultPromise = null;
const explicitlyConfiguredFunctionsRegion = null;

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

export async function createPasswordSignupAccount({ email, password, name }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(credential.user, { displayName: name });
  return credential;
}

export function signInOrCreateGoogleSignup() {
  // Signup questionnaires remain in memory, so signup intentionally does not redirect.
  return signInWithPopup(auth, googleProvider);
}

export async function createUserProfileAfterSignup(payload) {
  const callable = httpsCallable(functions, "createUserProfileAfterSignup");
  const result = await callable(payload);
  return result?.data;
}

export async function getVisitSignupAvailability() {
  const callable = httpsCallable(functions, "getVisitSignupAvailability");
  const result = await callable({});
  return result?.data;
}

export async function deleteCurrentAuthUserForFailedSignup(expectedUid) {
  const currentUser = auth.currentUser;
  if (!currentUser || (expectedUid && currentUser.uid !== expectedUid)) {
    throw new Error("The partial signup account is no longer current.");
  }
  await deleteUser(currentUser);
}

export async function requestPasswordOtp(email) {
  const callable = httpsCallable(functions, "requestPasswordOtp");
  const result = await callable({ email: normalizeRecoveryEmail(email) });
  return result?.data;
}

export async function resetPasswordWithOtp(email, otp, newPassword) {
  const callable = httpsCallable(functions, "resetPasswordWithOtp");
  const result = await callable(createPasswordResetPayload(email, otp, newPassword));
  return result?.data;
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
  const currentUid = auth.currentUser?.uid || "";
  const uid = options.uid || currentUid;
  const refresh = options.refresh === true;
  if (!currentUid || uid !== currentUid) {
    return Promise.reject(new Error("An authenticated user is required."));
  }
  return trustedAccessCache.get({ uid, refresh });
}

export function getTrustedAccessDiagnostic(error, phase) {
  const currentUid = auth.currentUser?.uid || "";
  const diagnostic = {
    code: typeof error?.code === "string" && error.code.trim()
      ? error.code.trim().toLowerCase()
      : "unknown",
    authCurrentUserExists: Boolean(auth.currentUser),
    uidSuffix: currentUid.length > 4
      ? `…${currentUid.slice(-4)}`
      : currentUid
        ? "…redacted"
        : null,
    phase: phase === "retry" ? "retry" : "initial",
  };
  if (explicitlyConfiguredFunctionsRegion) {
    diagnostic.functionsRegion = explicitlyConfiguredFunctionsRegion;
  }
  return diagnostic;
}

export function completeGoogleRedirectResult() {
  if (!googleRedirectResultPromise) {
    googleRedirectResultPromise = getRedirectResult(auth);
  }
  return googleRedirectResultPromise;
}
