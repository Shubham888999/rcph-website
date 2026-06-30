export async function runSignupWorkflow({
  mode,
  currentUser,
  authDetails,
  buildPayload,
  services,
  onIdentity,
}) {
  let user = currentUser || null;
  let createdPasswordUser = null;

  if (mode === "password") {
    const credential = await services.createPasswordAccount(authDetails);
    user = credential?.user || null;
    createdPasswordUser = user;
  } else if (mode === "google") {
    const credential = await services.openGoogleSignup();
    user = credential?.user || null;
  } else if (mode !== "completion") {
    throw new TypeError("Unsupported signup mode.");
  }

  if (!user) throw new Error("Authenticated signup identity is unavailable.");
  onIdentity?.({ user, createdPasswordUser });
  const payload = buildPayload(user);
  const profileResult = await services.createProfile(payload);
  return { user, createdPasswordUser, profileResult };
}

export async function applySignupOutcome(outcome, services) {
  if (outcome.kind === "approved") {
    await services.refreshTrustedAccess();
    return "approved";
  }
  if (outcome.kind === "pending") {
    await services.signOut();
    return "pending";
  }
  return "unresolved";
}

export async function cleanupFailedAdminPasswordSignup({
  shouldCleanup,
  uid,
  deleteCurrentUser,
  signOut,
}) {
  if (!shouldCleanup) return { attempted: false, cleanupFailed: false };
  let cleanupFailed = false;
  try {
    await deleteCurrentUser(uid);
  } catch {
    cleanupFailed = true;
  }
  try {
    await signOut();
  } catch {
    // Deleting the current Firebase user can already end the session.
  }
  return { attempted: true, cleanupFailed };
}
