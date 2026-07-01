import { POSITION_CATALOG, POSITION_GROUPS } from "./positionCatalog.js";

const BY_KEY = new Map(POSITION_CATALOG.map((position) => [position.key, position]));

function lookupText(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/['.]/g, "").replace(/&/g, " and ").replace(/[-_]+/g, " ").replace(/\s+/g, " ")
    : "";
}

const ALIASES = new Map();
POSITION_CATALOG.forEach((position) => {
  [position.key, position.displayTitle, ...position.aliases].forEach((value) => ALIASES.set(lookupText(value), position.key));
});

export function canonicalPositionKey(value) {
  return ALIASES.get(lookupText(value)) || null;
}

export function normalizePositionSelection(values) {
  const selected = new Set();
  const unknownValues = [];
  (Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : []).forEach((value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return;
    const key = canonicalPositionKey(raw);
    if (key) selected.add(key); else if (!unknownValues.includes(raw)) unknownValues.push(raw);
  });
  return {
    selectedKeys: POSITION_CATALOG.map((position) => position.key).filter((key) => selected.has(key)),
    unknownValues,
  };
}

export function initializePositionSelection(user) {
  const explicit = user?.hasExplicitPositionKeys === true || (Array.isArray(user?.positionKeys) && user.positionKeys.length > 0);
  return normalizePositionSelection(explicit ? user.positionKeys : user?.clubPosition || "");
}

export function filterPositionCatalog(query = "") {
  const term = lookupText(query);
  if (!term) return POSITION_CATALOG.slice();
  return POSITION_CATALOG.filter((position) => lookupText(`${position.displayTitle} ${position.avenueCode} ${position.key}`).includes(term));
}

export function groupedPositionOptions(options) {
  return POSITION_GROUPS.map((group) => ({
    ...group,
    options: options.filter((position) => position.group === group.key),
  })).filter((group) => group.options.length > 0);
}

export function applyPositionRole(role, selectedKeys) {
  return role === "gbm" ? [] : normalizePositionSelection(selectedKeys).selectedKeys;
}

export function validatePositionRole(role, selectedKeys, unknownValues = []) {
  const keys = applyPositionRole(role, selectedKeys);
  if (role === "bod" && keys.length === 0) return { ok: false, message: "BOD access requires at least one club position.", positionKeys: keys };
  if (role !== "gbm" && unknownValues.length > 0 && keys.length === 0) return { ok: false, message: "Select the correct positions before replacing unresolved legacy position data.", positionKeys: keys };
  return { ok: true, message: "", positionKeys: keys };
}

function errorDetails(error) {
  return error?.details || error?.customData?.details || error?.customData || error?.data || null;
}

export function extractJointPositionConflict(error) {
  const details = errorDetails(error);
  const conflicts = Array.isArray(details?.conflicts) ? details.conflicts : [];
  const code = String(error?.code || "").toLowerCase();
  if (!code.includes("failed-precondition") || (details?.code !== "joint-assignment-conflict" && conflicts.length === 0)) return null;
  const normalized = conflicts.map((conflict) => {
    const key = canonicalPositionKey(conflict?.positionKey);
    if (!key) return null;
    const definition = BY_KEY.get(key);
    const holders = Array.isArray(conflict?.existingHolders) ? conflict.existingHolders : [];
    return {
      positionKey: key,
      displayTitle: definition.displayTitle,
      existingHolders: holders.map((holder) => ({
        name: typeof holder?.name === "string" ? holder.name.trim() : "",
        email: typeof holder?.email === "string" ? holder.email.trim().toLowerCase() : "",
      })),
    };
  }).filter(Boolean);
  return normalized.length ? normalized : null;
}

export function buildJointConfirmationPayload(payload, conflicts) {
  const selected = new Set(normalizePositionSelection(payload?.positionKeys).selectedKeys);
  const confirmed = normalizePositionSelection((conflicts || []).map((conflict) => conflict.positionKey)).selectedKeys.filter((key) => selected.has(key));
  return { ...payload, positionKeys: [...selected], confirmJointPositionKeys: confirmed };
}
