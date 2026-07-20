export const VISIT_OPTIONS = Object.freeze([
  { visitType: "clubAssembly", visitName: "Club Assembly" },
  { visitType: "dzrVisit", visitName: "DZR Visit" },
  { visitType: "drrVisit", visitName: "DRR Visit" },
]);

export const VISIT_TYPES = Object.freeze(VISIT_OPTIONS.map((visit) => visit.visitType));

const VISIT_NAMES = Object.freeze(
  Object.fromEntries(VISIT_OPTIONS.map((visit) => [visit.visitType, visit.visitName])),
);

function text(value, max = 1000) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function unique(values) {
  return [...new Set(values)];
}

export function normalizeVisitType(value, fallback = "clubAssembly") {
  return VISIT_TYPES.includes(value) ? value : fallback;
}

export function normalizeOfficialDisplayNames(value) {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const seen = new Set();
  const names = [];
  input.forEach((item) => {
    const name = text(item, 160);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names.slice(0, 12);
}

export function officialDisplayNamesText(value) {
  return normalizeOfficialDisplayNames(value).join("\n");
}

export function normalizeVisiblePositionKeys(value) {
  const input = Array.isArray(value) ? value : [];
  return unique(input.map((item) => text(item, 80)).filter(Boolean));
}

export function createDefaultVisitConfig(visitTypeInput = "clubAssembly") {
  const visitType = normalizeVisitType(visitTypeInput);
  return {
    visitType,
    visitName: VISIT_NAMES[visitType],
    enabled: false,
    signupOpen: false,
    dashboardVisible: false,
    allowDistrictOfficials: false,
    officialDisplayNames: [],
    visiblePositionKeys: [],
  };
}

export function normalizeVisitConfig(raw, fallbackVisitType = "clubAssembly") {
  const visitType = normalizeVisitType(raw?.visitType, fallbackVisitType);
  return {
    ...createDefaultVisitConfig(visitType),
    enabled: raw?.enabled === true,
    signupOpen: raw?.signupOpen === true,
    dashboardVisible: raw?.dashboardVisible === true,
    allowDistrictOfficials: raw?.allowDistrictOfficials === true,
    officialDisplayNames: normalizeOfficialDisplayNames(raw?.officialDisplayNames),
    visiblePositionKeys: normalizeVisiblePositionKeys(raw?.visiblePositionKeys),
  };
}

export function normalizeVisitConfigs(value) {
  const rawConfigs = Array.isArray(value) ? value : [];
  const byType = new Map(rawConfigs.map((config) => [config?.visitType, config]));
  return VISIT_TYPES.map((visitType) => normalizeVisitConfig(byType.get(visitType), visitType));
}

export function normalizeSignupAvailability(value) {
  const rawVisits = Array.isArray(value?.visits) ? value.visits : [];
  const visits = rawVisits
    .map((visit) => {
      const visitType = normalizeVisitType(visit?.visitType, "");
      if (!visitType) return null;
      return {
        visitType,
        visitName: text(visit?.visitName, 120) || VISIT_NAMES[visitType],
      };
    })
    .filter(Boolean);
  return {
    available: value?.available === true && visits.length > 0,
    visits,
  };
}

export function createVisitDraft(config) {
  const normalized = normalizeVisitConfig(config);
  return {
    ...normalized,
    officialDisplayNamesText: officialDisplayNamesText(normalized.officialDisplayNames),
  };
}

export function createVisitDrafts(configs) {
  return Object.fromEntries(
    normalizeVisitConfigs(configs).map((config) => [config.visitType, createVisitDraft(config)]),
  );
}

export function updateVisitDraftBoolean(draft, field, checked) {
  if (!["enabled", "signupOpen", "dashboardVisible", "allowDistrictOfficials"].includes(field)) {
    return draft;
  }
  return { ...draft, [field]: checked === true };
}

export function updateVisitDraftOfficialNames(draft, value) {
  return {
    ...draft,
    officialDisplayNamesText: typeof value === "string" ? value : "",
  };
}

export function toggleVisiblePositionKey(draft, positionKey, checked) {
  const key = text(positionKey, 80);
  if (!key) return draft;
  const current = new Set(normalizeVisiblePositionKeys(draft.visiblePositionKeys));
  if (checked === true) current.add(key);
  else current.delete(key);
  return { ...draft, visiblePositionKeys: [...current] };
}

export function buildVisitConfigPayload(draft) {
  const visitType = normalizeVisitType(draft?.visitType);
  return {
    visitType,
    enabled: draft?.enabled === true,
    signupOpen: draft?.signupOpen === true,
    dashboardVisible: draft?.dashboardVisible === true,
    allowDistrictOfficials: draft?.allowDistrictOfficials === true,
    officialDisplayNames: normalizeOfficialDisplayNames(draft?.officialDisplayNamesText ?? draft?.officialDisplayNames),
    visiblePositionKeys: normalizeVisiblePositionKeys(draft?.visiblePositionKeys),
  };
}

export function normalizeFolderOption(raw, fallbackVisitType = "") {
  if (!raw || typeof raw !== "object") return null;
  const visitType = normalizeVisitType(raw.visitType, fallbackVisitType || "clubAssembly");
  const positionKey = text(raw.positionKey, 80);
  if (!positionKey) return null;
  return {
    visitType,
    positionKey,
    positionTitle: text(raw.positionTitle, 180) || positionKey,
    avenueCode: text(raw.avenueCode, 40),
    enabled: raw.enabled !== false,
    submissionOpen: raw.submissionOpen !== false,
    locked: raw.locked === true,
    activeFileCount: Math.max(0, Number(raw.activeFileCount) || 0),
  };
}

export function normalizeFolderOptions(value, visitType) {
  const input = Array.isArray(value) ? value : [];
  return input
    .map((item) => normalizeFolderOption(item, visitType))
    .filter(Boolean)
    .filter((item) => item.visitType === normalizeVisitType(visitType))
    .sort((a, b) => a.positionTitle.localeCompare(b.positionTitle) || a.positionKey.localeCompare(b.positionKey));
}

export function buildFolderChecklistRows(draft, folderOptions) {
  const options = normalizeFolderOptions(folderOptions, draft?.visitType);
  const selected = normalizeVisiblePositionKeys(draft?.visiblePositionKeys);
  const optionKeys = new Set(options.map((option) => option.positionKey));
  const rows = options.map((option) => ({
    ...option,
    checked: selected.includes(option.positionKey),
    unavailable: false,
  }));
  selected
    .filter((positionKey) => !optionKeys.has(positionKey))
    .forEach((positionKey) => {
      rows.push({
        visitType: normalizeVisitType(draft?.visitType),
        positionKey,
        positionTitle: "Unavailable folder/key",
        avenueCode: positionKey,
        enabled: false,
        submissionOpen: false,
        locked: false,
        activeFileCount: 0,
        checked: true,
        unavailable: true,
      });
    });
  return rows;
}
