export const PUBLIC_BOD_BOARD_ID = "riy-2026-27";
export const PUBLIC_BOD_RIY_LABEL = "RIY 2026\u201327";
export const PUBLIC_BOD_FUNCTION_NAME = "getPublicBodBoard";
export const PUBLIC_BOD_PHOTO_FUNCTION_NAME =
  "downloadPublishedBodPhoto";
export const PUBLIC_BOD_FUNCTION_REGION = "us-central1";

export const PUBLIC_BOD_CLUB_SECTION = "clubBoard";
export const PUBLIC_BOD_LEADERSHIP_SECTION =
  "leadershipBeyondClub";

const PUBLIC_SECTION_KEYS = new Set([
  PUBLIC_BOD_CLUB_SECTION,
  PUBLIC_BOD_LEADERSHIP_SECTION,
]);

const PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const LEADERSHIP_LEVELS = new Set([
  "district",
  "zone",
  "rotary",
  "multiDistrict",
  "national",
  "international",
  "other",
]);

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

function cleanText(value, max = 500) {
  if (typeof value !== "string") return "";

  const text = value.trim();

  if (
    !text
    || text.length > max
    || CONTROL_CHAR_PATTERN.test(text)
  ) {
    return "";
  }

  return text;
}

function cleanLongText(value, max = 900) {
  if (typeof value !== "string") return "";

  const text = value
    .replace(/\r\n?/g, "\n")
    .trim();

  if (
    text.length > max
    || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(text)
  ) {
    return "";
  }

  return text;
}

function cleanIdentifier(value, max = 128) {
  const identifier = cleanText(value, max);

  if (!identifier || identifier.includes("/")) {
    return "";
  }

  return identifier;
}

function safeFallback(overrides = {}) {
  return {
    boardId:
      cleanIdentifier(overrides.boardId, 80)
      || PUBLIC_BOD_BOARD_ID,
    riyLabel:
      cleanText(overrides.riyLabel, 40)
      || PUBLIC_BOD_RIY_LABEL,
    clubBoardState: "draft",
    leadershipBeyondClubState: "draft",
  };
}

export function createDefaultPublicBodState() {
  return safeFallback();
}

function normalizeAvenueLabels(value) {
  if (!Array.isArray(value) || value.length > 5) {
    return null;
  }

  const labels = [];
  const seen = new Set();

  for (const rawLabel of value) {
    const label = cleanText(rawLabel, 60);

    if (!label) return null;

    const key = label.toLocaleLowerCase("en-US");

    if (seen.has(key)) continue;

    seen.add(key);
    labels.push(label);
  }

  return labels;
}

function normalizeInstagram(raw) {
  if (
    raw.instagramUsername === null
    && raw.instagramUrl === null
  ) {
    return {
      instagramUsername: null,
      instagramUrl: null,
    };
  }

  const username = cleanText(
    raw.instagramUsername,
    30,
  );

  if (
    !username
    || !/^[A-Za-z0-9._]{1,30}$/.test(username)
  ) {
    return null;
  }

  const expectedUrl =
    `https://www.instagram.com/${username}/`;

  if (raw.instagramUrl !== expectedUrl) {
    return null;
  }

  return {
    instagramUsername: username,
    instagramUrl: expectedUrl,
  };
}

function normalizePublicProfile(raw, sectionKey) {
  if (
    !raw
    || typeof raw !== "object"
    || Array.isArray(raw)
  ) {
    return null;
  }

  const profileId = cleanIdentifier(
    raw.profileId || raw.id,
    128,
  );

  const name = cleanText(raw.name, 120);
  const positionLabel = cleanText(
    raw.positionLabel,
    140,
  );
  const summary = cleanText(raw.summary, 240);
  const bio = cleanLongText(raw.bio, 900);

  if (
    !profileId
    || raw.sectionKey !== sectionKey
    || !name
    || !positionLabel
    || !summary
  ) {
    return null;
  }

  const avenueLabels = normalizeAvenueLabels(
    raw.avenueLabels,
  );

  const instagram = normalizeInstagram(raw);

  if (!avenueLabels || !instagram) {
    return null;
  }

  if (
    !Number.isSafeInteger(raw.sortOrder)
    || raw.sortOrder < 0
    || raw.sortOrder > 100000
    || !Number.isSafeInteger(raw.photoVersion)
    || raw.photoVersion < 1
    || !PHOTO_MIME_TYPES.has(raw.photoMimeType)
  ) {
    return null;
  }

  const profile = {
    profileId,
    sectionKey,
    name,
    positionLabel,
    summary,
    bio,
    avenueLabels,
    instagramUsername:
      instagram.instagramUsername,
    instagramUrl: instagram.instagramUrl,
    sortOrder: raw.sortOrder,
    photoVersion: raw.photoVersion,
    photoMimeType: raw.photoMimeType,
  };

  if (
    sectionKey
    === PUBLIC_BOD_LEADERSHIP_SECTION
  ) {
    const leadershipLevel = cleanText(
      raw.leadershipLevel,
      40,
    );

    const leadershipLevelLabel = cleanText(
      raw.leadershipLevelLabel,
      80,
    );

    const organizationName = cleanText(
      raw.organizationName,
      140,
    );

    const termLabel = raw.termLabel === ""
      ? ""
      : cleanText(raw.termLabel, 60);

    if (
      !LEADERSHIP_LEVELS.has(leadershipLevel)
      || !leadershipLevelLabel
      || !organizationName
      || (
        raw.termLabel !== ""
        && !termLabel
      )
    ) {
      return null;
    }

    profile.leadershipLevel = leadershipLevel;
    profile.leadershipLevelLabel =
      leadershipLevelLabel;
    profile.organizationName = organizationName;
    profile.termLabel = termLabel;
  }

  return profile;
}

function draftSection() {
  return {
    state: "draft",
    profiles: [],
  };
}

function normalizePublicSection(
  rawSection,
  sectionKey,
) {
  if (
    !rawSection
    || typeof rawSection !== "object"
    || Array.isArray(rawSection)
  ) {
    return draftSection();
  }

  if (rawSection.state === "draft") {
    if (
      !Array.isArray(rawSection.profiles)
      || rawSection.profiles.length !== 0
    ) {
      return draftSection();
    }

    return draftSection();
  }

  if (
    rawSection.state !== "public"
    || !Number.isSafeInteger(
      rawSection.publishedRevision,
    )
    || rawSection.publishedRevision < 1
    || !cleanText(rawSection.publishedAt, 80)
    || !Number.isSafeInteger(
      rawSection.profileCount,
    )
    || !Array.isArray(rawSection.profiles)
    || rawSection.profiles.length < 1
    || rawSection.profiles.length > 100
    || rawSection.profileCount
      !== rawSection.profiles.length
  ) {
    return draftSection();
  }

  const profiles = rawSection.profiles.map(
    (profile) =>
      normalizePublicProfile(
        profile,
        sectionKey,
      ),
  );

  if (profiles.some((profile) => !profile)) {
    return draftSection();
  }

  const profileIds = new Set();

  for (const profile of profiles) {
    if (profileIds.has(profile.profileId)) {
      return draftSection();
    }

    profileIds.add(profile.profileId);
  }

  profiles.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder
      || left.name.localeCompare(right.name),
  );

  return {
    state: "public",
    publishedRevision:
      rawSection.publishedRevision,
    publishedAt: rawSection.publishedAt,
    profileCount: profiles.length,
    profiles,
  };
}

export function normalizePublicBodBoardResponse(raw) {
  if (
    !raw
    || typeof raw !== "object"
    || Array.isArray(raw)
    || raw.ok !== true
  ) {
    return safeFallback();
  }

  const sections = (
    raw.sections
    && typeof raw.sections === "object"
    && !Array.isArray(raw.sections)
  )
    ? raw.sections
    : {};

  const base = safeFallback({
    boardId: raw.boardId,
    riyLabel: raw.riyLabel,
  });

  const clubBoard = normalizePublicSection(
    sections.clubBoard,
    PUBLIC_BOD_CLUB_SECTION,
  );

  const leadershipBeyondClub =
    normalizePublicSection(
      sections.leadershipBeyondClub,
      PUBLIC_BOD_LEADERSHIP_SECTION,
    );

  const result = {
    ...base,
    clubBoardState: clubBoard.state,
    leadershipBeyondClubState:
      leadershipBeyondClub.state,
  };

  if (clubBoard.state === "public") {
    result.clubBoardProfiles =
      clubBoard.profiles;
    result.clubBoardPublishedRevision =
      clubBoard.publishedRevision;
    result.clubBoardPublishedAt =
      clubBoard.publishedAt;
  }

  if (
    leadershipBeyondClub.state === "public"
  ) {
    result.leadershipBeyondClubProfiles =
      leadershipBeyondClub.profiles;
    result.leadershipBeyondClubPublishedRevision =
      leadershipBeyondClub.publishedRevision;
    result.leadershipBeyondClubPublishedAt =
      leadershipBeyondClub.publishedAt;
  }

  return result;
}

export function publicProfilesForSection(
  state,
  sectionKey,
) {
  if (!PUBLIC_SECTION_KEYS.has(sectionKey)) {
    return [];
  }

  const profiles = sectionKey
    === PUBLIC_BOD_CLUB_SECTION
    ? state?.clubBoardProfiles
    : state?.leadershipBeyondClubProfiles;

  return Array.isArray(profiles)
    ? profiles
    : [];
}

function buildRendererPhotoUrl({
  state,
  photoEndpoint,
  profile,
}) {
  return buildPublishedBodPhotoUrl({
    endpoint: photoEndpoint,
    boardId: state?.boardId,
    sectionKey: profile.sectionKey,
    profileId: profile.profileId,
    photoVersion: profile.photoVersion,
  });
}

function rendererInstagramFields(profile) {
  return {
    instagram: profile.instagramUrl || "",
    handle: profile.instagramUsername
      ? `@${profile.instagramUsername}`
      : "",
  };
}

export function mapPublicClubProfilesToMembers({
  state,
  photoEndpoint,
} = {}) {
  const profiles = publicProfilesForSection(
    state,
    PUBLIC_BOD_CLUB_SECTION,
  );

  const members = profiles.map((profile) => ({
    id: profile.profileId,
    profileId: profile.profileId,
    name: profile.name,
    role: profile.positionLabel,
    responsibility: profile.summary,
    bio: profile.bio,
    avenue: [...profile.avenueLabels],
    image: buildRendererPhotoUrl({
      state,
      photoEndpoint,
      profile,
    }),
    ...rendererInstagramFields(profile),
  }));

  if (
    members.length !== profiles.length
    || members.some((member) => !member.image)
  ) {
    return [];
  }

  return members;
}

export function mapPublicLeadershipProfilesToMembers({
  state,
  photoEndpoint,
} = {}) {
  const profiles = publicProfilesForSection(
    state,
    PUBLIC_BOD_LEADERSHIP_SECTION,
  );

  const members = profiles.map((profile) => ({
    id: profile.profileId,
    profileId: profile.profileId,
    name: profile.name,
    role: profile.positionLabel,
    responsibility: profile.summary,
    bio: profile.bio,
    councilGroup: profile.leadershipLevelLabel,
    context: [
      profile.organizationName,
      profile.termLabel,
    ].filter(Boolean).join(" \u00b7 "),
    image: buildRendererPhotoUrl({
      state,
      photoEndpoint,
      profile,
    }),
    ...rendererInstagramFields(profile),
  }));

  if (
    members.length !== profiles.length
    || members.some((member) => !member.image)
  ) {
    return [];
  }

  return members;
}

export function shouldRenderBodRevealFallback(
  state,
) {
  return (
    state?.clubBoardState !== "public"
    || publicProfilesForSection(
      state,
      PUBLIC_BOD_CLUB_SECTION,
    ).length === 0
  );
}

function buildFunctionEndpoint({
  functionName,
  explicitEndpoint,
  env = {},
  projectId = "",
}) {
  const explicit = cleanText(
    explicitEndpoint,
    1000,
  );

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const emulatorOrigin = cleanText(
    env.VITE_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN
      || env.VITE_FUNCTIONS_EMULATOR_ORIGIN,
    1000,
  ).replace(/\/$/, "");

  const resolvedProjectId = cleanIdentifier(
    projectId || env.VITE_FIREBASE_PROJECT_ID,
    120,
  );

  if (!resolvedProjectId) return "";

  if (emulatorOrigin) {
    return `${emulatorOrigin}/${resolvedProjectId}/${PUBLIC_BOD_FUNCTION_REGION}/${functionName}`;
  }

  return `https://${PUBLIC_BOD_FUNCTION_REGION}-${resolvedProjectId}.cloudfunctions.net/${functionName}`;
}

export function buildPublicBodBoardEndpoint({
  env = {},
  projectId = "",
} = {}) {
  return buildFunctionEndpoint({
    functionName: PUBLIC_BOD_FUNCTION_NAME,
    explicitEndpoint:
      env.VITE_PUBLIC_BOD_BOARD_ENDPOINT,
    env,
    projectId,
  });
}

export function buildPublicBodPhotoEndpoint({
  env = {},
  projectId = "",
} = {}) {
  return buildFunctionEndpoint({
    functionName:
      PUBLIC_BOD_PHOTO_FUNCTION_NAME,
    explicitEndpoint:
      env.VITE_PUBLIC_BOD_PHOTO_ENDPOINT,
    env,
    projectId,
  });
}

export function buildPublishedBodPhotoUrl({
  endpoint,
  boardId,
  sectionKey,
  profileId,
  photoVersion,
}) {
  const safeEndpoint = cleanText(endpoint, 1000);
  const safeBoardId = cleanIdentifier(
    boardId,
    80,
  );
  const safeProfileId = cleanIdentifier(
    profileId,
    128,
  );

  if (
    !safeEndpoint
    || !safeBoardId
    || !PUBLIC_SECTION_KEYS.has(sectionKey)
    || !safeProfileId
    || !Number.isSafeInteger(photoVersion)
    || photoVersion < 1
  ) {
    return "";
  }

  try {
    const url = new URL(safeEndpoint);

    url.searchParams.set(
      "boardId",
      safeBoardId,
    );

    url.searchParams.set(
      "sectionKey",
      sectionKey,
    );

    url.searchParams.set(
      "profileId",
      safeProfileId,
    );

    url.searchParams.set(
      "version",
      String(photoVersion),
    );

    return url.toString();
  } catch {
    return "";
  }
}
