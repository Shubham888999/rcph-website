import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { clearDashboardDataCache } from "../dashboard/dashboardService";
import { normalizeDashboardResolutions, normalizeResolutionAdminData, normalizeResolutionDetails } from "./resolutionModel";

function requireUser(uid = "") {
  if (!auth.currentUser || (uid && auth.currentUser.uid !== uid)) throw new Error("Authenticated user required.");
  return auth.currentUser.uid;
}

async function call(name, payload = {}) {
  requireUser();
  const result = await httpsCallable(functions, name)(payload);
  return result?.data && typeof result.data === "object" ? result.data : {};
}

export async function loadAdminResolutions(uid) {
  requireUser(uid);
  return normalizeResolutionAdminData(await call("getAdminResolutions"));
}

export async function loadResolutionDetails(uid, resolutionId) {
  requireUser(uid);
  return normalizeResolutionDetails(await call("getResolutionDetails", { resolutionId }));
}

export async function createResolutionDraft(payload) {
  return call("createResolutionDraft", payload);
}

export async function updateResolutionDraft(resolutionId, payload) {
  return call("updateResolutionDraft", { resolutionId, ...payload });
}

export async function openResolutionVoting(resolutionId) {
  const result = await call("openResolutionVoting", { resolutionId });
  clearDashboardDataCache();
  return result;
}

export async function closeResolutionVoting(resolutionId) {
  const result = await call("closeResolutionVoting", { resolutionId });
  clearDashboardDataCache();
  return result;
}

export async function cancelResolution(resolutionId) {
  const result = await call("cancelResolution", { resolutionId });
  clearDashboardDataCache();
  return result;
}

export async function submitResolutionVote(uid, resolutionId, choice) {
  requireUser(uid);
  const result = await call("submitResolutionVote", { resolutionId, choice });
  if (result.ok !== true || !result.vote) throw new Error("Resolution vote failed.");
  clearDashboardDataCache(uid);
  return result.vote;
}

export async function loadMyOpenResolutions(uid) {
  requireUser(uid);
  const result = await call("getMyOpenResolutions");
  if (result.ok !== true) throw new Error("Resolution refresh failed.");
  return normalizeDashboardResolutions(result.openResolutions);
}

export function getResolutionErrorMessage(error) {
  const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
  if (code.includes("permission-denied")) return "You do not have permission to perform this resolution action.";
  if (code.includes("failed-precondition")) return "The resolution state changed. Refresh and try again.";
  if (code.includes("already-exists")) return "That resolution number is already in use.";
  if (code.includes("not-found")) return "The resolution or linked meeting is no longer available.";
  if (code.includes("unauthenticated")) return "Your session expired. Sign in again.";
  if (code.includes("invalid-argument")) return "The resolution details were rejected. Review the form and retry.";
  return "The resolution action could not be completed. Please retry.";
}
