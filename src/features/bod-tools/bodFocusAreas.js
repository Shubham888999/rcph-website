export const BOD_FOCUS_AREA_CATEGORY_ROTARY = "rotary";
export const BOD_FOCUS_AREA_CATEGORY_ASCEND = "ascend";
export const BOD_FOCUS_AREA_CATEGORY_OTHER = "other";
export const BOD_FOCUS_AREA_CUSTOM_MAX_LENGTH = 180;
export const BOD_FOCUS_AREA_MAX_ITEMS = 20;

export const BOD_FOCUS_AREA_GROUPS = Object.freeze([
  Object.freeze({
    category: BOD_FOCUS_AREA_CATEGORY_ROTARY,
    label: "Rotary Focus",
    options: Object.freeze([
      "Peacebuilding and conflict prevention",
      "Disease prevention and treatment",
      "Water, sanitation, and hygiene",
      "Maternal and child health",
      "Basic education and literacy",
      "Community economic development",
      "Environment",
    ]),
  }),
  Object.freeze({
    category: BOD_FOCUS_AREA_CATEGORY_ASCEND,
    label: "Ascend Chapters",
    options: Object.freeze([
      "Harvesting Innovation",
      "Media",
      "Rescue Operation",
      "Finance",
      "Blue Careers - Future jobs beneath the surface",
      "Product Lab",
      "Hospitality",
      "Renewable Energy",
      "Art and Theatre",
      "A.I Tech",
    ]),
  }),
  Object.freeze({
    category: BOD_FOCUS_AREA_CATEGORY_OTHER,
    label: "Other",
    options: Object.freeze(["Other"]),
  }),
]);

const KNOWN_FOCUS_AREAS = new Map(
  BOD_FOCUS_AREA_GROUPS
    .filter((group) => group.category !== BOD_FOCUS_AREA_CATEGORY_OTHER)
    .map((group) => [group.category, new Set(group.options)]),
);

const FOCUS_AREA_CATEGORIES = new Set(BOD_FOCUS_AREA_GROUPS.map((group) => group.category));

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanText(value, max = BOD_FOCUS_AREA_CUSTOM_MAX_LENGTH) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function cleanStrictText(value, max, fieldName) {
  if (typeof value !== "string") return { value: "", error: `${fieldName} must be text.` };
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return { value: "", error: `${fieldName} is required.` };
  if (trimmed.length > max) return { value: "", error: `${fieldName} must be ${max} characters or fewer.` };
  return { value: trimmed, error: "" };
}

function normalizedKnownFocusArea(category, value) {
  const normalizedValue = cleanText(value);
  return KNOWN_FOCUS_AREAS.get(category)?.has(normalizedValue) ? normalizedValue : "";
}

function pushUnique(output, seen, area) {
  const key = `${area.category}|${area.value.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  output.push(area);
}

export function validateAndNormalizeBodFocusAreas(value, options = {}) {
  const enabled = options.enabled === true;
  const source = value === undefined || value === null ? [] : value;
  if (!enabled) return { ok: true, focusAreas: [], error: "" };
  if (!Array.isArray(source)) return { ok: false, focusAreas: [], error: "Focus Areas must be selected from the supported list." };
  if (source.length > BOD_FOCUS_AREA_MAX_ITEMS) {
    return { ok: false, focusAreas: [], error: `Select no more than ${BOD_FOCUS_AREA_MAX_ITEMS} Focus Areas.` };
  }

  const output = [];
  const seen = new Set();
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (!isPlainObject(item)) return { ok: false, focusAreas: [], error: "Focus Areas must use supported values." };
    const category = cleanText(item.category, 24).toLowerCase();
    if (!FOCUS_AREA_CATEGORIES.has(category)) return { ok: false, focusAreas: [], error: "Focus Areas include an unsupported category." };

    if (category === BOD_FOCUS_AREA_CATEGORY_OTHER) {
      const custom = cleanStrictText(item.value, BOD_FOCUS_AREA_CUSTOM_MAX_LENGTH, "Custom Focus Area");
      if (custom.error) return { ok: false, focusAreas: [], error: custom.error };
      if (custom.value.toLowerCase() === "other") {
        return { ok: false, focusAreas: [], error: "Enter the custom Focus Area name instead of Other." };
      }
      pushUnique(output, seen, { category, value: custom.value });
      continue;
    }

    const knownValue = normalizedKnownFocusArea(category, item.value);
    if (!knownValue) return { ok: false, focusAreas: [], error: "Focus Areas include an unsupported option." };
    pushUnique(output, seen, { category, value: knownValue });
  }

  if (enabled && !output.length) return { ok: false, focusAreas: [], error: "Select at least one Focus Area or uncheck Add a Focus Area." };
  return { ok: true, focusAreas: output, error: "" };
}

export function normalizeBodFocusAreas(value) {
  return validateAndNormalizeBodFocusAreas(value, { enabled: Array.isArray(value) && value.length > 0 }).focusAreas;
}

export function focusAreaKey(area) {
  return `${cleanText(area?.category, 24).toLowerCase()}|${cleanText(area?.value).toLowerCase()}`;
}

export function formatBodFocusAreasForReport(value) {
  return normalizeBodFocusAreas(value).map((area) => area.value).join(", ");
}

export function groupBodFocusAreasForReport(value) {
  const normalized = normalizeBodFocusAreas(value);

  const focusAreas = normalized
    .filter((area) => (
      area.category === BOD_FOCUS_AREA_CATEGORY_ROTARY
      || area.category === BOD_FOCUS_AREA_CATEGORY_OTHER
    ))
    .map((area) => area.value);

  const chapters = normalized
    .filter((area) => area.category === BOD_FOCUS_AREA_CATEGORY_ASCEND)
    .map((area) => area.value);

  return {
    focusAreas,
    chapters,
    focusAreasText: focusAreas.join(", "),
    chaptersText: chapters.join(", "),
  };
}