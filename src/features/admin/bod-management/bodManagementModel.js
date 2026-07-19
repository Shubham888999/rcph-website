export const BOD_MANAGEMENT_BOARD_ID = "riy-2026-27";
export const BOD_MANAGEMENT_RIY_LABEL = "RIY 2026 - 27";
export const BOD_PROFILE_SECTION_KEY = "clubBoard";
export const LEADERSHIP_PROFILE_SECTION_KEY = "leadershipBeyondClub";
export const BOD_PROFILE_SECTION_KEYS = Object.freeze([
  BOD_PROFILE_SECTION_KEY,
  LEADERSHIP_PROFILE_SECTION_KEY,
]);
export const BOD_PHOTO_ACCEPTED_MIME_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
export const BOD_PHOTO_FILE_ACCEPT = BOD_PHOTO_ACCEPTED_MIME_TYPES.join(",");
export const BOD_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const BOD_PHOTO_RECOMMENDED_WIDTH = 800;
export const BOD_PHOTO_RECOMMENDED_HEIGHT = 1000;
export const BOD_PHOTO_RECOMMENDED_RATIO = 4 / 5;

export const BOD_MANAGEMENT_SECTIONS = Object.freeze([
  {
    key: BOD_PROFILE_SECTION_KEY,
    title: "Club Board of Directors",
    workspaceTitle: "Club BOD profiles",
    addLabel: "Add Profile",
    draftLabel: "Draft",
    publicLabel: "Public",
    draftExplanation: "Draft keeps the public BOD on the mystery reveal while preserving any previous published snapshot.",
    publicHelp: "A valid published profile snapshot is required before this section can be made public.",
    confirmTitle: "Return Club Board of Directors to Draft?",
    confirmMessage: "The public BOD will return to the mystery reveal. The previous published snapshot will be preserved.",
    workspaceHelp: "Manage working profile drafts. Changes do not affect the public page until a later Publish Changes workflow is used.",
  },
  {
    key: LEADERSHIP_PROFILE_SECTION_KEY,
    title: "Leadership Beyond Our Club",
    workspaceTitle: "Leadership Beyond Our Club",
    addLabel: "Add Leadership Profile",
    draftLabel: "Hidden",
    publicLabel: "Public",
    draftExplanation: "Hidden omits this section from the public page while preserving any previous published snapshot.",
    publicHelp: "A valid published profile snapshot is required before this section can be made public.",
    confirmTitle: "Hide Leadership Beyond Our Club?",
    confirmMessage: "The section will be hidden publicly. The previous published snapshot will be preserved.",
    workspaceHelp: "Manage independent external leadership appointments. These drafts do not change the public page until a later Publish Changes workflow is used.",
  },
]);

export const DEFAULT_BOD_POSITION_PRESETS = Object.freeze([
  { key: "president", label: "President" },
  { key: "secretary", label: "Secretary" },
  { key: "treasurer", label: "Treasurer" },
  { key: "vice-president", label: "Vice President" },
  { key: "ipp-rrro", label: "IPP / RRRO" },
  { key: "club-advisor", label: "Club Advisor" },
  { key: "pdd", label: "PDD" },
  { key: "cmd", label: "CMD" },
  { key: "csd", label: "CSD" },
  { key: "isd", label: "ISD" },
  { key: "saa", label: "SAA" },
  { key: "editor", label: "Editor" },
  { key: "co-editor", label: "Co-Editor" },
  { key: "cwd", label: "Website Director" },
  { key: "sports-director", label: "Sports Director" },
  { key: "pro", label: "PRO" },
  { key: "dei", label: "DEI" },
  { key: "wrwc", label: "WRWC" },
  { key: "custom", label: "Custom" },
]);

export const LEADERSHIP_LEVEL_OPTIONS = Object.freeze([
  { key: "district", label: "District" },
  { key: "zone", label: "Zone" },
  { key: "rotary", label: "Rotary" },
  { key: "multiDistrict", label: "Multi-District" },
  { key: "national", label: "National" },
  { key: "international", label: "International" },
  { key: "other", label: "Other" },
]);

const SECTION_KEYS = new Set(BOD_PROFILE_SECTION_KEYS);
const AVENUE_LABEL_MAX_LENGTH = 60;

function hasControlCharacter(value, { allowLineBreak = false } = {}) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    if (allowLineBreak && code === 10) return false;
    return (code >= 0 && code < 32) || code === 127;
  });
}

export function sectionConfig(sectionKey) {
  return BOD_MANAGEMENT_SECTIONS.find((section) => section.key === sectionKey) || null;
}

function normalizeSectionKey(value, fallback = BOD_PROFILE_SECTION_KEY) {
  return SECTION_KEYS.has(value) ? value : fallback;
}

export function cleanText(value, max = 500) {
  return typeof value === "string" && !hasControlCharacter(value)
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

function cleanTextUnbounded(value) {
  return typeof value === "string" && !hasControlCharacter(value)
    ? value.trim().replace(/\s+/g, " ")
    : "";
}

export function cleanLongText(value, max = 900) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => (hasControlCharacter(line) ? "" : line.trim().replace(/\s+/g, " ")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function safeRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function safeSortOrder(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000 ? value : fallback;
}

export function normalizePublicationStatus(value) {
  return value === "public" ? "public" : "draft";
}

export function normalizePublishedAt(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    const date = value?.toDate?.() || (value instanceof Date ? value : null);
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  } catch {
    return "";
  }
}

export function formatBodPhotoSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) return "Unknown size";
  if (size >= 1048576) {
    const mb = size / 1048576;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (size >= 1024) {
    const kb = size / 1024;
    return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
  }
  return `${size} bytes`;
}

export function safeBodPhotoFileName(value) {
  if (typeof value !== "string" || hasControlCharacter(value) || /[\\/]/.test(value)) return "";
  return value.trim().replace(/\s+/g, " ");
}

export function validateBodPhotoFile(file) {
  if (!file) return "Choose a JPEG, PNG, or WebP photo.";
  const fileName = safeBodPhotoFileName(file.name);
  if (!fileName) return "Choose a photo with a safe file name.";
  if (fileName.length > 180) return "Photo file name must be 180 characters or fewer.";
  if (!BOD_PHOTO_ACCEPTED_MIME_TYPES.includes(String(file.type || "").toLowerCase())) {
    return "Use a JPEG, PNG, or WebP image.";
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "Photo file is empty.";
  if (file.size > BOD_PHOTO_MAX_BYTES) return "Photo must be 5 MB or smaller.";
  return "";
}

export function normalizeBodProfilePhoto(raw) {
  if (!raw || typeof raw !== "object") return null;
  const status = ["ready", "removed"].includes(raw.status) ? raw.status : "";
  const mimeType = BOD_PHOTO_ACCEPTED_MIME_TYPES.includes(String(raw.mimeType || "").toLowerCase())
    ? String(raw.mimeType).toLowerCase()
    : "";
  const originalName = safeBodPhotoFileName(raw.originalName);
  const sizeBytes = Number(raw.sizeBytes);
  const version = Number(raw.version);
  if (!status || !mimeType || !originalName || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > BOD_PHOTO_MAX_BYTES || !Number.isSafeInteger(version) || version < 1) {
    return null;
  }
  const width = Number.isSafeInteger(raw.width) && raw.width > 0 ? raw.width : null;
  const height = Number.isSafeInteger(raw.height) && raw.height > 0 ? raw.height : null;
  return {
    status,
    mimeType,
    originalName,
    sizeBytes,
    width,
    height,
    version,
    uploadedAt: normalizePublishedAt(raw.uploadedAt),
  };
}

export function hasReadyPhoto(value) {
  const photo = value?.photo ? normalizeBodProfilePhoto(value.photo) : normalizeBodProfilePhoto(value);
  return photo?.status === "ready";
}

export function getBodPhotoBadge(profile) {
  const photo = normalizeBodProfilePhoto(profile?.photo);
  if (photo?.status === "ready") return { label: "Photo ready", className: "is-public" };
  if (photo?.status === "removed") return { label: "Photo removed", className: "is-draft" };
  return { label: "Photo missing", className: "is-draft" };
}

export function getBodPhotoDimensionWarnings({ width, height } = {}) {
  const warnings = [];
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const ratio = width / height;
    if (Math.abs(ratio - BOD_PHOTO_RECOMMENDED_RATIO) > 0.08) {
      warnings.push("A 4:5 portrait crop is recommended.");
    }
    if (width < BOD_PHOTO_RECOMMENDED_WIDTH || height < BOD_PHOTO_RECOMMENDED_HEIGHT) {
      warnings.push("A photo around 800 x 1000 pixels or larger is recommended.");
    }
  }
  return warnings;
}

export function normalizeBodSection(sectionKey, raw = {}) {
  const config = sectionConfig(sectionKey);
  if (!config) return null;
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    sectionKey,
    title: config.title,
    draftLabel: config.draftLabel,
    publicLabel: config.publicLabel,
    publicationStatus: normalizePublicationStatus(source.publicationStatus),
    draftRevision: safeRevision(source.draftRevision),
    publishedRevision: safeRevision(source.publishedRevision),
    publishedAt: normalizePublishedAt(source.publishedAt),
  };
}

function fallbackOptions() {
  return {
    positionPresets: DEFAULT_BOD_POSITION_PRESETS.map((preset) => ({ ...preset })),
    leadershipLevels: LEADERSHIP_LEVEL_OPTIONS.map((level) => ({ ...level })),
    bodMemberLinks: [],
    userLinks: [],
  };
}

function normalizePositionPresets(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const presets = source
    .map((item) => ({
      key: cleanText(item?.key, 80),
      label: cleanText(item?.label, 140),
    }))
    .filter((item) => item.key && item.label && !seen.has(item.key) && seen.add(item.key));
  const withFallback = presets.length ? presets : fallbackOptions().positionPresets;
  if (!withFallback.some((item) => item.key === "custom")) {
    withFallback.push({ key: "custom", label: "Custom" });
  }
  return withFallback;
}

function normalizeLeadershipLevels(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const fallback = fallbackOptions().leadershipLevels;
  const allowed = new Map(fallback.map((item) => [item.key, item.label]));
  const seen = new Set();
  const levels = source
    .map((item) => ({
      key: cleanText(item?.key, 80),
      label: cleanText(item?.label, 80),
    }))
    .filter((item) => allowed.has(item.key) && item.label && !seen.has(item.key) && seen.add(item.key));
  return levels.length === fallback.length ? levels : fallback;
}

function normalizeBodMemberLinks(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      id: cleanText(item?.id, 128),
      name: cleanText(item?.name, 120),
      positionLabel: cleanText(item?.positionLabel, 140),
    }))
    .filter((item) => item.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function normalizeUserLinks(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      uid: cleanText(item?.uid, 128),
      name: cleanText(item?.name, 120),
      role: cleanText(item?.role, 40).toLowerCase(),
    }))
    .filter((item) => item.uid && item.name)
    .sort((a, b) => a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));
}

export function normalizeBodOptions(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    positionPresets: normalizePositionPresets(source.positionPresets),
    leadershipLevels: normalizeLeadershipLevels(source.leadershipLevels),
    bodMemberLinks: normalizeBodMemberLinks(source.bodMemberLinks),
    userLinks: normalizeUserLinks(source.userLinks),
  };
}

export function normalizeAvenueLabels(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : [];
  const seen = new Set();
  const labels = [];
  for (const item of source) {
    const label = cleanTextUnbounded(item);
    if (!label) continue;
    const key = label.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function normalizeInstagramUsername(value) {
  if (value === null || value === undefined) return { username: null, error: "" };
  let text = typeof value === "string" ? value.trim() : "";
  if (!text) return { username: null, error: "" };
  if (hasControlCharacter(text) || /\s/.test(text)) {
    return { username: null, error: "Instagram username cannot contain spaces or control characters." };
  }
  if (text.startsWith("@")) text = text.slice(1);
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const host = url.hostname.toLowerCase();
      const parts = url.pathname.split("/").filter(Boolean);
      if (!["instagram.com", "www.instagram.com"].includes(host) || url.search || url.hash || parts.length !== 1) {
        return { username: null, error: "Use a direct Instagram profile URL or username." };
      }
      text = parts[0];
    } catch {
      return { username: null, error: "Instagram URL is invalid." };
    }
  }
  if (!/^[A-Za-z0-9._]{1,30}$/.test(text)) {
    return { username: null, error: "Instagram username may use letters, numbers, periods, and underscores only." };
  }
  return { username: text, error: "" };
}

function leadershipLevelLabel(level, options) {
  if (!level) return "";
  return normalizeBodOptions(options).leadershipLevels.find((item) => item.key === level)?.label
    || LEADERSHIP_LEVEL_OPTIONS.find((item) => item.key === level)?.label
    || "";
}

export function normalizeBodProfile(raw, fallbackIndex = 0, options = fallbackOptions()) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = cleanText(source.id || source.profileId, 128);
  if (!id) return null;
  const sectionKey = normalizeSectionKey(source.sectionKey, "");
  if (!sectionKey) return null;
  const instagram = normalizeInstagramUsername(source.instagramUsername);
  const status = source.status === "archived" ? "archived" : "active";
  const photo = normalizeBodProfilePhoto(source.photo);
  const leadershipLevel = sectionKey === LEADERSHIP_PROFILE_SECTION_KEY
    ? cleanText(source.leadershipLevel, 80) || null
    : null;
  return {
    id,
    sectionKey,
    name: cleanText(source.name, 120),
    positionKey: sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "custom" : cleanText(source.positionKey, 80) || null,
    positionLabel: cleanText(source.positionLabel, 140),
    summary: cleanText(source.summary, 240),
    bio: cleanLongText(source.bio, 900),
    avenueLabels: normalizeAvenueLabels(source.avenueLabels),
    leadershipLevel,
    leadershipLevelLabel: leadershipLevelLabel(leadershipLevel, options),
    organizationName: sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? cleanText(source.organizationName, 140) : "",
    termLabel: sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? cleanText(source.termLabel, 60) : "",
    instagramUsername: instagram.username,
    linkedBodMemberId: cleanText(source.linkedBodMemberId, 128) || null,
    linkedUserUid: cleanText(source.linkedUserUid, 128) || null,
    sortOrder: safeSortOrder(source.sortOrder, (fallbackIndex + 1) * 10),
    displayPublicly: source.displayPublicly === true,
    status,
    photo,
    hasPhoto: hasReadyPhoto(photo),
    createdAt: normalizePublishedAt(source.createdAt),
    createdBy: cleanText(source.createdBy, 128) || null,
    updatedAt: normalizePublishedAt(source.updatedAt),
    updatedBy: cleanText(source.updatedBy, 128) || null,
    archivedAt: normalizePublishedAt(source.archivedAt),
    archivedBy: cleanText(source.archivedBy, 128) || null,
  };
}

export function sortBodProfiles(profiles) {
  return (Array.isArray(profiles) ? profiles : []).slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const nameCompare = (a.name || "").localeCompare(b.name || "");
    if (nameCompare) return nameCompare;
    return a.id.localeCompare(b.id);
  });
}

function normalizeProfiles(raw, options) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(
    BOD_PROFILE_SECTION_KEYS.map((sectionKey) => [
      sectionKey,
      sortBodProfiles(
        (Array.isArray(source[sectionKey]) ? source[sectionKey] : [])
          .map((item, index) => normalizeBodProfile(item, index, options))
          .filter((profile) => profile && profile.sectionKey === sectionKey),
      ),
    ]),
  );
}

export function createDefaultBodManagementBoard() {
  const options = fallbackOptions();
  return {
    ok: true,
    initialized: false,
    boardId: BOD_MANAGEMENT_BOARD_ID,
    riyLabel: BOD_MANAGEMENT_RIY_LABEL,
    schemaVersion: 1,
    sections: Object.fromEntries(
      BOD_MANAGEMENT_SECTIONS.map((section) => [
        section.key,
        normalizeBodSection(section.key, {}),
      ]),
    ),
    profiles: {
      clubBoard: [],
      leadershipBeyondClub: [],
    },
    options,
  };
}

export function normalizeBodManagementBoard(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const defaults = createDefaultBodManagementBoard();
  const sections = { ...defaults.sections };
  const options = normalizeBodOptions(source.options);
  for (const section of BOD_MANAGEMENT_SECTIONS) {
    sections[section.key] = normalizeBodSection(
      section.key,
      source.sections?.[section.key],
    );
  }
  return {
    ...defaults,
    initialized: source.initialized === true,
    boardId: cleanText(source.boardId, 80) || defaults.boardId,
    riyLabel: cleanText(source.riyLabel, 40) || defaults.riyLabel,
    schemaVersion: source.schemaVersion === 1 ? 1 : defaults.schemaVersion,
    sections,
    profiles: normalizeProfiles(source.profiles, options),
    options,
  };
}

export function initialBodPublicationSelections(board) {
  const normalized = normalizeBodManagementBoard(board);
  return Object.fromEntries(
    BOD_MANAGEMENT_SECTIONS.map((section) => [
      section.key,
      normalized.sections[section.key].publicationStatus,
    ]),
  );
}

export function isBodSectionSaveEnabled(board, selections, sectionKey) {
  if (!SECTION_KEYS.has(sectionKey)) return false;
  const normalized = normalizeBodManagementBoard(board);
  const selected = normalizePublicationStatus(selections?.[sectionKey]);
  const current = normalized.sections[sectionKey].publicationStatus;
  if (selected !== "draft") return false;
  if (!normalized.initialized) return true;
  return current === "public" && selected === "draft";
}

export function needsDraftConfirmation(board, selections, sectionKey) {
  const normalized = normalizeBodManagementBoard(board);
  return normalized.initialized === true
    && normalized.sections[sectionKey]?.publicationStatus === "public"
    && normalizePublicationStatus(selections?.[sectionKey]) === "draft";
}

export function buildSaveBodSectionPublicationPayload(board, sectionKey) {
  const normalized = normalizeBodManagementBoard(board);
  const section = normalized.sections[sectionKey];
  if (!section) throw new TypeError("Valid BOD Management section required.");
  return {
    boardId: normalized.boardId,
    sectionKey,
    publicationStatus: "draft",
    expectedDraftRevision: section.draftRevision,
    expectedPublishedRevision: section.publishedRevision,
  };
}

export function buildPublishBodSectionPayload(board, sectionKey) {
  const normalized = normalizeBodManagementBoard(board);
  const section = normalized.sections[sectionKey];

  if (!normalized.initialized) {
    throw new TypeError("Initialize BOD Management before publishing.");
  }

  if (!section) {
    throw new TypeError("Valid BOD Management section required.");
  }

  return {
    boardId: normalized.boardId,
    sectionKey,
    expectedDraftRevision: section.draftRevision,
    expectedPublishedRevision: section.publishedRevision,
  };
}

export function applyBodSectionSaveResult(board, result) {
  const normalized = normalizeBodManagementBoard(board);
  const sectionKey = cleanText(result?.sectionKey, 80);
  const section = SECTION_KEYS.has(sectionKey)
    ? normalizeBodSection(sectionKey, result.section)
    : null;
  return {
    ...normalized,
    initialized: normalized.initialized || result?.initialized === true,
    sections: section
      ? { ...normalized.sections, [sectionKey]: section }
      : normalized.sections,
  };
}

export function applyBodSectionPublishResult(board, result) {
  const normalized = normalizeBodManagementBoard(board);
  const sectionKey = cleanText(result?.sectionKey, 80);
  const section = SECTION_KEYS.has(sectionKey)
    ? normalizeBodSection(sectionKey, result?.section)
    : null;

  if (!section) return normalized;

  return {
    ...normalized,
    initialized: true,
    sections: {
      ...normalized.sections,
      [sectionKey]: section,
    },
  };
}

export function profilesForSection(board, sectionKey) {
  const normalized = normalizeBodManagementBoard(board);
  return SECTION_KEYS.has(sectionKey) ? normalized.profiles[sectionKey] : [];
}

export function activeProfilesForSection(board, sectionKey) {
  return profilesForSection(board, sectionKey).filter((profile) => profile.status === "active");
}

export function archivedProfilesForSection(board, sectionKey) {
  return profilesForSection(board, sectionKey).filter((profile) => profile.status === "archived");
}

export function activeClubBodProfiles(board) {
  return activeProfilesForSection(board, BOD_PROFILE_SECTION_KEY);
}

export function archivedClubBodProfiles(board) {
  return archivedProfilesForSection(board, BOD_PROFILE_SECTION_KEY);
}

export function getProfileCountsForSection(board, sectionKey) {
  const active = activeProfilesForSection(board, sectionKey);
  const archived = archivedProfilesForSection(board, sectionKey);
  const included = active.filter((profile) => profile.displayPublicly).length;
  const textComplete = active.filter((profile) => profileDraftIndicators(profile).missingFields.length === 0).length;
  return {
    active: active.length,
    included,
    archived: archived.length,
    textComplete,
    needsAttention: active.length - textComplete,
  };
}

export function getBodProfileCounts(board) {
  return getProfileCountsForSection(board, BOD_PROFILE_SECTION_KEY);
}

export function profileDraftIndicators(profile) {
  const sectionKey = normalizeSectionKey(profile?.sectionKey, BOD_PROFILE_SECTION_KEY);
  const normalized = normalizeBodProfile({ ...profile, id: profile?.id || "draft", sectionKey }) || {};
  const missingFields = [];
  if (!normalized.name) missingFields.push("name");
  if (!normalized.positionLabel) missingFields.push(sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "external role" : "position");
  if (sectionKey === LEADERSHIP_PROFILE_SECTION_KEY && !normalized.leadershipLevel) missingFields.push("leadership level");
  if (sectionKey === LEADERSHIP_PROFILE_SECTION_KEY && !normalized.organizationName) missingFields.push("organization");
  if (!normalized.summary) missingFields.push("summary");
  return {
    missingFields,
    hasTextBasics: missingFields.length === 0,
    hasPhoto: hasReadyPhoto(normalized),
    label: missingFields.length ? "Needs profile content" : "Content complete",
  };
}

export function getBodPublicationMissingFields(profile) {
  const sectionKey = normalizeSectionKey(
    profile?.sectionKey,
    BOD_PROFILE_SECTION_KEY,
  );

  const normalized = normalizeBodProfile({
    ...profile,
    id: profile?.id || "publication-review",
    sectionKey,
  }) || {};

  const missingFields = [];

  if (!normalized.name) missingFields.push("name");

  if (!normalized.positionLabel) {
    missingFields.push(
      sectionKey === LEADERSHIP_PROFILE_SECTION_KEY
        ? "external role"
        : "position",
    );
  }

  if (!normalized.summary) missingFields.push("summary");

  const photo = normalizeBodProfilePhoto(normalized.photo);
  const validPhoto = photo?.status === "ready"
    && BOD_PHOTO_ACCEPTED_MIME_TYPES.includes(photo.mimeType)
    && Number.isSafeInteger(photo.version)
    && photo.version >= 1;

  if (!validPhoto) missingFields.push("photo");

  if (sectionKey === LEADERSHIP_PROFILE_SECTION_KEY) {
    const validLeadershipLevel = LEADERSHIP_LEVEL_OPTIONS.some(
      (option) => option.key === normalized.leadershipLevel,
    );

    if (!validLeadershipLevel) missingFields.push("leadership level");
    if (!normalized.organizationName) missingFields.push("organization");
  }

  return missingFields;
}

export function getBodSectionPublicationReview(board, sectionKey) {
  const normalized = normalizeBodManagementBoard(board);

  if (!SECTION_KEYS.has(sectionKey)) {
    return {
      sectionKey: "",
      includedProfiles: [],
      incompleteProfiles: [],
      includedCount: 0,
      incompleteCount: 0,
      canPublish: false,
    };
  }

  const includedProfiles = activeProfilesForSection(
    normalized,
    sectionKey,
  ).filter((profile) => profile.displayPublicly === true);

  const incompleteProfiles = includedProfiles
    .map((profile) => ({
      profileId: profile.id,
      name: profile.name || "Unnamed profile",
      missingFields: getBodPublicationMissingFields(profile),
    }))
    .filter((profile) => profile.missingFields.length > 0);

  return {
    sectionKey,
    includedProfiles,
    incompleteProfiles,
    includedCount: includedProfiles.length,
    incompleteCount: incompleteProfiles.length,
    canPublish: normalized.initialized
      && includedProfiles.length > 0
      && incompleteProfiles.length === 0,
  };
}

function getDraftPreviewPhotoLabel(profile) {
  const photo = normalizeBodProfilePhoto(profile?.photo);

  if (photo?.status === "ready") return "Protected draft photo";
  if (photo?.status === "removed") return "Photo removed";
  return "Photo not ready";
}

function getDraftPreviewInstagramFields(profile) {
  if (!profile?.instagramUsername) {
    return {
      instagram: "",
      handle: "",
    };
  }

  return {
    instagram: `https://www.instagram.com/${profile.instagramUsername}/`,
    handle: `@${profile.instagramUsername}`,
  };
}

export function getBodDraftPreviewMembers(board, sectionKey) {
  const normalized = normalizeBodManagementBoard(board);

  if (!SECTION_KEYS.has(sectionKey)) return [];

  return activeProfilesForSection(normalized, sectionKey)
    .filter((profile) => profile.displayPublicly === true)
    .map((profile) => {
      const base = {
        id: profile.id,
        profileId: profile.id,
        name: profile.name || "Unnamed profile",
        role: profile.positionLabel || "Role pending",
        responsibility: profile.summary,
        bio: profile.bio,
        image: "",
        photoLabel: getDraftPreviewPhotoLabel(profile),
        ...getDraftPreviewInstagramFields(profile),
      };

      if (sectionKey === LEADERSHIP_PROFILE_SECTION_KEY) {
        return {
          ...base,
          councilGroup: profile.leadershipLevelLabel || "External leadership",
          context: [
            profile.organizationName,
            profile.termLabel,
          ].filter(Boolean).join(" \u00b7 "),
        };
      }

      return {
        ...base,
        avenue: [...profile.avenueLabels],
      };
    });
}

export function getPositionLabel(positionKey, options, customLabel = "") {
  const presets = normalizeBodOptions(options).positionPresets;
  if (!positionKey) return "";
  if (positionKey === "custom") return cleanText(customLabel, 140);
  return presets.find((preset) => preset.key === positionKey)?.label
    || DEFAULT_BOD_POSITION_PRESETS.find((preset) => preset.key === positionKey)?.label
    || "";
}

export function nextSortOrderForSection(board, sectionKey) {
  const active = activeProfilesForSection(board, sectionKey);
  const max = active.reduce((value, profile) => Math.max(value, profile.sortOrder), 0);
  return max + 10;
}

export function nextBodProfileSortOrder(board) {
  return nextSortOrderForSection(board, BOD_PROFILE_SECTION_KEY);
}

export function createDefaultBodProfileForm(board, sectionKey = BOD_PROFILE_SECTION_KEY) {
  const normalizedSectionKey = normalizeSectionKey(sectionKey, BOD_PROFILE_SECTION_KEY);
  return {
    profileId: "",
    sectionKey: normalizedSectionKey,
    name: "",
    positionKey: normalizedSectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "custom" : "",
    positionLabel: "",
    summary: "",
    bio: "",
    avenueText: "",
    leadershipLevel: "",
    organizationName: "",
    termLabel: "",
    instagramUsername: "",
    linkedBodMemberId: "",
    linkedUserUid: "",
    sortOrder: nextSortOrderForSection(board, normalizedSectionKey),
    displayPublicly: false,
  };
}

export function bodProfileToForm(profile) {
  const sectionKey = normalizeSectionKey(profile?.sectionKey, BOD_PROFILE_SECTION_KEY);
  const normalized = normalizeBodProfile(profile) || createDefaultBodProfileForm(null, sectionKey);
  return {
    profileId: normalized.id || "",
    sectionKey,
    name: normalized.name || "",
    positionKey: sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "custom" : normalized.positionKey || "",
    positionLabel: normalized.positionLabel || "",
    summary: normalized.summary || "",
    bio: normalized.bio || "",
    avenueText: normalized.avenueLabels.join(", "),
    leadershipLevel: normalized.leadershipLevel || "",
    organizationName: normalized.organizationName || "",
    termLabel: normalized.termLabel || "",
    instagramUsername: normalized.instagramUsername ? `@${normalized.instagramUsername}` : "",
    linkedBodMemberId: normalized.linkedBodMemberId || "",
    linkedUserUid: normalized.linkedUserUid || "",
    sortOrder: normalized.sortOrder || 10,
    displayPublicly: normalized.displayPublicly === true,
  };
}

export function normalizeBodProfileForm(form, options) {
  const source = form && typeof form === "object" ? form : {};
  const sectionKey = normalizeSectionKey(source.sectionKey, BOD_PROFILE_SECTION_KEY);
  const positionKey = sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "custom" : cleanText(source.positionKey, 80);
  const positionLabel = sectionKey === LEADERSHIP_PROFILE_SECTION_KEY
    ? cleanTextUnbounded(source.positionLabel)
    : getPositionLabel(positionKey, options, source.positionLabel);
  const instagram = normalizeInstagramUsername(source.instagramUsername);
  const leadershipLevel = sectionKey === LEADERSHIP_PROFILE_SECTION_KEY
    ? cleanText(source.leadershipLevel, 80) || null
    : null;
  return {
    profileId: cleanText(source.profileId, 128),
    sectionKey,
    name: cleanTextUnbounded(source.name),
    positionKey: positionKey || null,
    positionLabel,
    summary: cleanTextUnbounded(source.summary),
    bio: cleanLongText(source.bio, 900),
    avenueLabels: normalizeAvenueLabels(source.avenueText ?? source.avenueLabels),
    leadershipLevel,
    leadershipLevelLabel: leadershipLevelLabel(leadershipLevel, options),
    organizationName: sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? cleanTextUnbounded(source.organizationName) : "",
    termLabel: sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? cleanTextUnbounded(source.termLabel) : "",
    instagramUsername: instagram.username,
    instagramError: instagram.error,
    linkedBodMemberId: cleanText(source.linkedBodMemberId, 128) || null,
    linkedUserUid: cleanText(source.linkedUserUid, 128) || null,
    sortOrder: safeSortOrder(Number(source.sortOrder), 10),
    displayPublicly: source.displayPublicly === true,
  };
}

export function validateBodProfileForm(form, options) {
  const normalized = normalizeBodProfileForm(form, options);
  const errors = [];
  if (normalized.instagramError) errors.push(normalized.instagramError);
  if (normalized.name.length > 120) errors.push("Name is too long.");
  if (normalized.positionLabel.length > 140) {
    errors.push(normalized.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "External role title is too long." : "Custom position is too long.");
  }
  if (normalized.summary.length > 240) errors.push("Summary is too long.");
  if (normalized.sectionKey === BOD_PROFILE_SECTION_KEY) {
    if (normalized.positionKey && !normalizeBodOptions(options).positionPresets.some((preset) => preset.key === normalized.positionKey)) {
      errors.push("Choose a valid position preset.");
    }
  } else {
    if (normalized.positionKey !== "custom") errors.push("External leadership profiles use a custom role title.");
    if (normalized.leadershipLevel && !normalizeBodOptions(options).leadershipLevels.some((level) => level.key === normalized.leadershipLevel)) {
      errors.push("Choose a valid leadership level.");
    }
    if (normalized.organizationName.length > 140) errors.push("Organization name is too long.");
    if (normalized.termLabel.length > 60) errors.push("Term label is too long.");
  }
  if (normalized.avenueLabels.some((label) => label.length > AVENUE_LABEL_MAX_LENGTH)) {
    errors.push("Each avenue label must be 60 characters or fewer.");
  }
  if (normalized.avenueLabels.length > 5) {
    errors.push("Use five avenue labels or fewer.");
  }
  return {
    ok: errors.length === 0,
    errors,
    profile: normalized,
  };
}

export const validateProfileForm = validateBodProfileForm;

export function buildUpsertBodProfilePayload(board, form) {
  const normalizedBoard = normalizeBodManagementBoard(board);
  const validation = validateBodProfileForm(form, normalizedBoard.options);
  if (!validation.ok) throw new TypeError(validation.errors[0]);
  const profile = validation.profile;
  const section = normalizedBoard.sections[profile.sectionKey];
  const payloadProfile = {
    sectionKey: profile.sectionKey,
    name: cleanText(profile.name, 120),
    positionKey: profile.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY ? "custom" : profile.positionKey,
    positionLabel: cleanText(profile.positionLabel, 140),
    summary: cleanText(profile.summary, 240),
    bio: profile.bio,
    avenueLabels: profile.avenueLabels,
    instagramUsername: profile.instagramUsername,
    linkedBodMemberId: profile.linkedBodMemberId,
    linkedUserUid: profile.linkedUserUid,
    sortOrder: profile.sortOrder,
    displayPublicly: profile.displayPublicly,
  };
  if (profile.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY) {
    payloadProfile.leadershipLevel = profile.leadershipLevel;
    payloadProfile.organizationName = cleanText(profile.organizationName, 140);
    payloadProfile.termLabel = cleanText(profile.termLabel, 60);
  }
  return {
    boardId: normalizedBoard.boardId,
    ...(profile.profileId ? { profileId: profile.profileId } : {}),
    expectedDraftRevision: section.draftRevision,
    profile: payloadProfile,
  };
}

function profileById(board, profileId) {
  const normalized = normalizeBodManagementBoard(board);
  return BOD_PROFILE_SECTION_KEYS
    .flatMap((sectionKey) => normalized.profiles[sectionKey])
    .find((profile) => profile.id === profileId) || null;
}

export function buildArchiveBodProfilePayload(board, profileId) {
  const normalized = normalizeBodManagementBoard(board);
  const id = cleanText(profileId, 128);
  const profile = profileById(normalized, id);
  const sectionKey = profile?.sectionKey || BOD_PROFILE_SECTION_KEY;
  return {
    boardId: normalized.boardId,
    profileId: id,
    expectedDraftRevision: normalized.sections[sectionKey].draftRevision,
  };
}

export function buildRestoreBodProfilePayload(board, profileId) {
  return buildArchiveBodProfilePayload(board, profileId);
}

export function buildReorderBodProfilesPayload(board, sectionKeyOrOrderedIds, maybeOrderedIds) {
  const normalized = normalizeBodManagementBoard(board);
  const sectionKey = Array.isArray(sectionKeyOrOrderedIds)
    ? BOD_PROFILE_SECTION_KEY
    : normalizeSectionKey(sectionKeyOrOrderedIds, BOD_PROFILE_SECTION_KEY);
  const orderedProfileIds = Array.isArray(sectionKeyOrOrderedIds)
    ? sectionKeyOrOrderedIds
    : maybeOrderedIds;
  return {
    boardId: normalized.boardId,
    sectionKey,
    orderedProfileIds: (Array.isArray(orderedProfileIds) ? orderedProfileIds : []).map((id) => cleanText(id, 128)).filter(Boolean),
    expectedDraftRevision: normalized.sections[sectionKey].draftRevision,
  };
}

export function buildCreateBodPhotoUploadSessionPayload(board, profile, file) {
  const normalizedBoard = normalizeBodManagementBoard(board);
  const normalizedProfile = normalizeBodProfile(profile, 0, normalizedBoard.options);
  const fileError = validateBodPhotoFile(file);
  if (fileError) throw new TypeError(fileError);
  if (!normalizedProfile?.id || normalizedProfile.status !== "active") {
    throw new TypeError("Save an active profile before adding a photo.");
  }
  return {
    boardId: normalizedBoard.boardId,
    profileId: normalizedProfile.id,
    sectionKey: normalizedProfile.sectionKey,
    fileName: safeBodPhotoFileName(file.name),
    mimeType: String(file.type || "").toLowerCase(),
    sizeBytes: file.size,
  };
}

export function buildFinalizeBodPhotoUploadPayload(board, profile, sessionId) {
  const normalizedBoard = normalizeBodManagementBoard(board);
  const normalizedProfile = normalizeBodProfile(profile, 0, normalizedBoard.options);
  const cleanSessionId = cleanText(sessionId, 160);
  if (!normalizedProfile?.id || !cleanSessionId) throw new TypeError("Photo upload session is incomplete.");
  return {
    boardId: normalizedBoard.boardId,
    profileId: normalizedProfile.id,
    sessionId: cleanSessionId,
    expectedDraftRevision: normalizedBoard.sections[normalizedProfile.sectionKey].draftRevision,
  };
}

export function buildRemoveBodProfilePhotoPayload(board, profileId) {
  const normalized = normalizeBodManagementBoard(board);
  const id = cleanText(profileId, 128);
  const profile = profileById(normalized, id);
  if (!profile) throw new TypeError("BOD profile was not found.");
  return {
    boardId: normalized.boardId,
    profileId: id,
    expectedDraftRevision: normalized.sections[profile.sectionKey].draftRevision,
  };
}

export function moveProfileOrder(board, sectionKey, profileId, direction) {
  const active = activeProfilesForSection(board, sectionKey);
  const ids = active.map((profile) => profile.id);
  const index = ids.indexOf(profileId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = ids.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function moveBodProfileOrder(board, profileId, direction) {
  return moveProfileOrder(board, BOD_PROFILE_SECTION_KEY, profileId, direction);
}

export function canMoveProfile(board, sectionKey, profileId, direction) {
  const ids = activeProfilesForSection(board, sectionKey).map((profile) => profile.id);
  const index = ids.indexOf(profileId);
  if (index < 0) return false;
  return direction === "up" ? index > 0 : direction === "down" ? index < ids.length - 1 : false;
}

export function canMoveBodProfile(board, profileId, direction) {
  return canMoveProfile(board, BOD_PROFILE_SECTION_KEY, profileId, direction);
}

export function applyBodProfileMutationResult(board, result) {
  const normalized = normalizeBodManagementBoard(board);
  const sectionKey = normalizeSectionKey(result?.sectionKey || result?.profile?.sectionKey, BOD_PROFILE_SECTION_KEY);
  const section = normalized.sections[sectionKey];
  const draftRevision = safeRevision(result?.draftRevision ?? section.draftRevision);
  let profiles = normalized.profiles[sectionKey];

  if (Array.isArray(result?.profiles)) {
    profiles = normalizeProfiles({ [sectionKey]: result.profiles }, normalized.options)[sectionKey];
  } else if (result?.profile) {
    const nextProfile = normalizeBodProfile(result.profile, 0, normalized.options);
    if (nextProfile && nextProfile.sectionKey === sectionKey) {
      const without = profiles.filter((profile) => profile.id !== nextProfile.id);
      profiles = sortBodProfiles([...without, nextProfile]);
    }
  }

  return {
    ...normalized,
    initialized: true,
    sections: {
      ...normalized.sections,
      [sectionKey]: {
        ...section,
        draftRevision,
      },
    },
    profiles: {
      ...normalized.profiles,
      [sectionKey]: profiles,
    },
  };
}

export function getBodProfileWarnings(profile, profiles) {
  const normalized = normalizeBodProfile(profile);
  if (!normalized || normalized.status !== "active") return [];
  const active = (Array.isArray(profiles) ? profiles : []).filter((item) => item.status === "active" && item.id !== normalized.id);
  const warnings = [];
  if (normalized.positionLabel && active.some((item) => item.positionLabel.toLocaleLowerCase("en-US") === normalized.positionLabel.toLocaleLowerCase("en-US"))) {
    warnings.push(normalized.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY
      ? "Another active external profile uses this role title."
      : "Another active profile uses this position.");
  }
  if (normalized.linkedBodMemberId && active.some((item) => item.linkedBodMemberId === normalized.linkedBodMemberId)) {
    warnings.push("Another active profile links to this BOD roster record.");
  }
  if (normalized.linkedUserUid && active.some((item) => item.linkedUserUid === normalized.linkedUserUid)) {
    warnings.push("Another active profile links to this portal account.");
  }
  if (normalized.sectionKey === LEADERSHIP_PROFILE_SECTION_KEY) {
    const appointmentKey = [
      normalized.positionLabel,
      normalized.organizationName,
      normalized.termLabel,
    ].map((value) => value.toLocaleLowerCase("en-US")).join("|");
    if (appointmentKey !== "||" && active.some((item) => [
      item.positionLabel,
      item.organizationName,
      item.termLabel,
    ].map((value) => (value || "").toLocaleLowerCase("en-US")).join("|") === appointmentKey)) {
      warnings.push("Another active external profile has the same role, organization, and term.");
    }
  }
  return warnings;
}

export function formatBodPublishedDate(value) {
  const iso = normalizePublishedAt(value);
  if (!iso) return "Not published yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not published yet";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isRevisionConflict(error) {
  const code = cleanText(error?.code || error?.name, 80).toLowerCase();
  return code === "aborted"
    || code === "functions/aborted";
}
