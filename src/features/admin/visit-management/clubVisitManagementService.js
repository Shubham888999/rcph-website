import { visitDashboardCalls } from "../shared/adminService";
import {
  buildVisitConfigPayload,
  normalizeFolderOptions,
  normalizeSignupAvailability,
  normalizeVisitConfig,
  normalizeVisitConfigs,
} from "./clubVisitManagementModel";

export async function loadVisitDashboardConfigs() {
  const result = await visitDashboardCalls.configs();
  return normalizeVisitConfigs(result.configs);
}

export async function loadVisitSignupAvailability() {
  const result = await visitDashboardCalls.signupAvailability();
  return normalizeSignupAvailability(result);
}

export async function loadVisitDashboardFolderOptions(visitType) {
  const result = await visitDashboardCalls.folderOptions(visitType);
  return normalizeFolderOptions(result.folders, visitType);
}

export async function saveVisitDashboardConfig(draft) {
  const payload = buildVisitConfigPayload(draft);
  const result = await visitDashboardCalls.updateConfig(payload);
  return normalizeVisitConfig(result.config || payload, payload.visitType);
}
