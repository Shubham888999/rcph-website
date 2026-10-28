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
  function unavailable() {
    if (options.throwOnError === true) throw new Error("The published board could not be loaded.");
    return createDefaultPublicBodState();
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") return unavailable();
  const endpoint = options.endpoint || buildPublicBodBoardEndpoint({
    env: options.env || viteEnv(),
    projectId: options.projectId || "",
  });
  if (!endpoint) return unavailable();

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
    if (!response?.ok) return unavailable();
    const raw = await parseJson(response);
    const state = normalizePublicBodBoardResponse(raw);
    if (options.throwOnError === true && (
      raw?.ok !== true
      || !["draft", "public"].includes(raw.sections?.clubBoard?.state)
      || !["draft", "public"].includes(raw.sections?.leadershipBeyondClub?.state)
      || state.clubBoardState !== raw.sections.clubBoard.state
      || state.leadershipBeyondClubState !== raw.sections.leadershipBeyondClub.state
    )) return unavailable();
    return state;
  } catch {
    return unavailable();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
