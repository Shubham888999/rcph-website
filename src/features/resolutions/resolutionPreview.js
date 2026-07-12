import { FINAL_RESOLUTION_STATUSES } from "./resolutionModel.js";
import { buildResolutionPdfDocument } from "./resolutionPdf.js";
import {
  buildGeneratedVotesTablePdfPages,
  buildResolutionPagePdfPages,
} from "./resolutionCustomPdf.js";
import {
  normalizeGeneratedPageOrder,
  normalizeResolutionPageConfig,
  normalizeUploadedVotesTableConfig,
} from "./resolutionSectionsModel.js";
import {
  getResolutionLetterheadJpeg,
  getResolutionOfficialLetterheadJpeg,
} from "./resolutionLetterhead.js";

export const GENERATED_PAGES_PREVIEW_MODES = Object.freeze({
  ALL: "all",
  RESOLUTION_PAGE: "resolution_page",
  VOTE_TABLE: "vote_table",
});

const PREVIEW_VOTERS = Object.freeze([
  { uid: "__preview_member_1", name: "Preview Member 1", position: "Board Member" },
  { uid: "__preview_member_2", name: "Preview Member 2", position: "Board Member" },
  { uid: "__preview_member_3", name: "Preview Member 3", position: "Board Member" },
]);

function isFinalizedResolution(resolution) {
  return FINAL_RESOLUTION_STATUSES.includes(resolution?.status);
}

export function normalizeGeneratedPagesPreviewMode(value) {
  return Object.values(GENERATED_PAGES_PREVIEW_MODES).includes(value)
    ? value
    : GENERATED_PAGES_PREVIEW_MODES.ALL;
}

export function getGeneratedPagesPreviewFilename(previewMode) {
  const mode = normalizeGeneratedPagesPreviewMode(previewMode);
  if (mode === GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE) return "resolution-page-preview.pdf";
  if (mode === GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE) return "resolution-voting-table-preview.pdf";
  return "resolution-generated-pages-preview.pdf";
}

function previewResolution(input) {
  const source = input?.resolution || {};
  const finalized = isFinalizedResolution(source);
  const resolutionPageConfig = finalized && source.finalizedResolutionPageConfigSnapshot
    ? source.finalizedResolutionPageConfigSnapshot
    : input.resolutionPageConfig || source.resolutionPageConfig;
  const generatedPageOrder = finalized && source.finalizedGeneratedPageOrderSnapshot
    ? source.finalizedGeneratedPageOrderSnapshot
    : input.generatedPageOrder || source.generatedPageOrder;

  return {
    ...source,
    status: source.status || "draft",
    resolutionPageConfig: normalizeResolutionPageConfig(resolutionPageConfig, source),
    uploadedVotesTableConfig: normalizeUploadedVotesTableConfig(
      input.uploadedVotesTableConfig || source.uploadedVotesTableConfig,
    ),
    generatedPageOrder: normalizeGeneratedPageOrder(generatedPageOrder),
  };
}

function hasRealVotes(votes) {
  return Array.isArray(votes) && votes.some((vote) => vote && !vote.superseded);
}

function withPreviewVoters(details) {
  const resolution = details.resolution || {};
  const eligibleVoters = Array.isArray(resolution.eligibleVoters)
    ? resolution.eligibleVoters
    : [];
  if (eligibleVoters.length) return details;
  return {
    ...details,
    resolution: {
      ...resolution,
      eligibleVoters: PREVIEW_VOTERS.map((voter) => ({ ...voter })),
      eligibleVoterCount: PREVIEW_VOTERS.length,
    },
  };
}

function previewVotesTableConfig(resolution, votes) {
  const config = normalizeUploadedVotesTableConfig(resolution.uploadedVotesTableConfig);
  if (!hasRealVotes(votes)) return { ...config, voterScope: "all" };
  return config;
}

export function getGeneratedPagesPreviewAvailability(input = {}) {
  const resolution = previewResolution(input);
  const resolutionPageEnabled = resolution.resolutionPageConfig.enabled === true;
  const votingTableEnabled = resolution.appendVoteTable !== false;
  const availableTypes = [
    ...(resolutionPageEnabled ? [GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE] : []),
    ...(votingTableEnabled ? [GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE] : []),
  ];
  const modes = {
    [GENERATED_PAGES_PREVIEW_MODES.ALL]: availableTypes.length > 0,
    [GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE]: resolutionPageEnabled,
    [GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE]: votingTableEnabled,
  };
  return {
    enabled: availableTypes.length > 0,
    availableTypes,
    modes,
    message: availableTypes.length
      ? ""
      : "Enable the Resolution Page or Voting Table before generating a preview.",
  };
}

function selectedPreviewTypes(resolution, previewMode) {
  const mode = normalizeGeneratedPagesPreviewMode(previewMode);
  const resolutionPageEnabled = resolution.resolutionPageConfig.enabled === true;
  const votingTableEnabled = resolution.appendVoteTable !== false;
  if (mode === GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE) {
    return resolutionPageEnabled ? [GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE] : [];
  }
  if (mode === GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE) {
    return votingTableEnabled ? [GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE] : [];
  }
  return normalizeGeneratedPageOrder(resolution.generatedPageOrder).filter((type) => (
    type === GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE
      ? resolutionPageEnabled
      : votingTableEnabled
  ));
}

export function buildGeneratedPagesPreviewDetails(input = {}) {
  const resolution = previewResolution(input);
  return {
    resolution,
    votes: Array.isArray(input.votes) ? input.votes.slice() : [],
    canonicalVoters: Array.isArray(input.canonicalVoters) ? input.canonicalVoters.slice() : [],
    audit: Array.isArray(input.audit) ? input.audit.slice() : [],
  };
}

export function buildGeneratedPagesPreviewPages(input = {}) {
  let details = buildGeneratedPagesPreviewDetails(input);
  const types = selectedPreviewTypes(details.resolution, input.previewMode);
  if (!types.length) {
    throw new Error("Enable the requested Resolution Page or Voting Table before generating a preview.");
  }

  if (types.includes(GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE)) {
    details = withPreviewVoters(details);
  }

  return types.flatMap((type) => {
    if (type === GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE) {
      return buildResolutionPagePdfPages(details, details.resolution.resolutionPageConfig);
    }
    const config = previewVotesTableConfig(details.resolution, details.votes);
    return buildGeneratedVotesTablePdfPages(
      {
        ...details,
        resolution: { ...details.resolution, uploadedVotesTableConfig: config },
      },
      config,
    );
  });
}

async function loadRequiredLetterheads({ loadLetterhead, loadOfficialLetterhead }) {
  let letterhead;
  try {
    letterhead = await loadLetterhead();
  } catch {
    throw new Error("Resolution letterhead could not be loaded for the preview.");
  }

  let officialLetterhead;
  try {
    officialLetterhead = await loadOfficialLetterhead();
  } catch {
    throw new Error("Official Resolution letterhead could not be loaded for the preview.");
  }

  return { letterhead, officialLetterhead };
}

export async function generateGeneratedPagesPreviewPdf(input = {}, options = {}) {
  const previewMode = normalizeGeneratedPagesPreviewMode(input.previewMode ?? options.previewMode);
  const details = buildGeneratedPagesPreviewDetails(input);
  const pages = buildGeneratedPagesPreviewPages({ ...input, previewMode });
  const { letterhead, officialLetterhead } = await loadRequiredLetterheads({
    loadLetterhead: options.loadLetterhead || getResolutionLetterheadJpeg,
    loadOfficialLetterhead: options.loadOfficialLetterhead || getResolutionOfficialLetterheadJpeg,
  });
  const pdf = buildResolutionPdfDocument(details, letterhead, {
    preview: true,
    previewLabel: false,
    officialLetterhead,
    pages,
  });
  return {
    pdf,
    pages,
    filename: getGeneratedPagesPreviewFilename(previewMode),
    previewMode,
  };
}

function downloadBlobUrl(url, filename, documentRef) {
  if (!documentRef?.createElement) throw new Error("Browser download support is unavailable.");
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  documentRef.body?.appendChild?.(link);
  link.click();
  link.remove?.();
}

export async function presentGeneratedPagesPreviewPdf(input = {}, options = {}) {
  const action = options.action === "download" ? "download" : "open";
  const result = await generateGeneratedPagesPreviewPdf(input, options);
  const BlobCtor = options.BlobCtor || globalThis.Blob;
  if (!BlobCtor) throw new Error("Browser PDF blob support is unavailable.");

  const urlApi = options.urlApi || globalThis.URL;
  const windowRef = options.windowRef || globalThis.window;
  const documentRef = options.documentRef || globalThis.document;
  if (!urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
    throw new Error("Browser preview URL support is unavailable.");
  }

  const url = urlApi.createObjectURL(new BlobCtor([result.pdf], { type: "application/pdf" }));
  let opened = false;
  let downloaded = false;
  let popupBlocked = false;

  if (action === "open") {
    const previewWindow = windowRef?.open?.(url, "_blank", "noopener,noreferrer");
    opened = Boolean(previewWindow);
    if (!opened) {
      popupBlocked = true;
      downloadBlobUrl(url, result.filename, documentRef);
      downloaded = true;
    }
  } else {
    downloadBlobUrl(url, result.filename, documentRef);
    downloaded = true;
  }

  const setTimer = windowRef?.setTimeout || globalThis.setTimeout;
  const revokeDelayMs = options.revokeDelayMs ?? (opened ? 60000 : 1000);
  setTimer?.(() => urlApi.revokeObjectURL(url), revokeDelayMs);

  return { ...result, url, opened, downloaded, popupBlocked };
}
