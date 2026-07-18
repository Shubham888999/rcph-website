import {
  buildPublicBodBoardEndpoint,
  buildPublicBodPhotoEndpoint,
  createDefaultPublicBodState,
  normalizePublicBodBoardResponse,
} from "./bodPublicModel.js";

function viteEnv() {
  return typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function getPublicBodPhotoEndpoint(options = {}) {
  return buildPublicBodPhotoEndpoint({
    env: options.env || viteEnv(),
    projectId: options.projectId || "",
  });
}

export async function fetchPublicBodBoard(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") return createDefaultPublicBodState();
  const endpoint = options.endpoint || buildPublicBodBoardEndpoint({
    env: options.env || viteEnv(),
    projectId: options.projectId || "",
  });
  if (!endpoint) return createDefaultPublicBodState();

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 6000;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      cache: "no-store",
      signal: controller?.signal,
    });
    if (!response?.ok) return createDefaultPublicBodState();
    return normalizePublicBodBoardResponse(await parseJson(response));
  } catch {
    return createDefaultPublicBodState();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
