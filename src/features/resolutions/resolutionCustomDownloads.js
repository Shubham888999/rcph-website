import { FINAL_RESOLUTION_STATUSES } from "./resolutionModel.js";

// These are excerpts for the two existing RIY 2026-27 resolution bundles.
const CUSTOM_DOWNLOADS = Object.freeze({
  1: Object.freeze({ number: 1, start: 15, total: 18 }),
  3: Object.freeze({ number: 3, start: 5, total: 8 }),
});

export function getResolutionCustomDownload(resolution = {}) {
  if (!FINAL_RESOLUTION_STATUSES.includes(resolution.status)) return null;
  const number = String(resolution.resolutionNumber || "").trim();
  const sequence = number.match(/(?:^|[\s/#-])0*([13])$/);
  if (!sequence) return null;
  const year = number.match(/\b(20\d{2})\s*[-/]\s*((?:20)?\d{2})\b/);
  const inYear = year
    ? year[1] === "2026" && ["27", "2027"].includes(year[2])
    : /^202[67]-\d{2}-\d{2}$/.test(resolution.meetingDate || "")
      && resolution.meetingDate >= "2026-07-01" && resolution.meetingDate < "2027-07-01";
  if (!inYear) return null;
  const profile = CUSTOM_DOWNLOADS[Number(sequence[1])];
  return {
    ...profile,
    label: `Download resolution pages only (${profile.start}\u2013${profile.total} of ${profile.total})`,
    filenameSuffix: `custom-pages-${profile.start}-${profile.total}-of-${profile.total}`,
  };
}

export function prepareCustomResolutionSummary(details) {
  const profile = getResolutionCustomDownload(details?.resolution);
  if (!profile) throw new Error("Custom page numbering is available only for completed RIY 2026-27 Resolutions 1 and 3.");
  const resolution = details.resolution;
  const pageConfig = resolution.finalizedResolutionPageConfigSnapshot || resolution.resolutionPageConfig;
  if (!pageConfig?.enabled) throw new Error("The Resolution Page must be enabled for this custom download.");
  return {
    profile,
    details: {
      ...details,
      resolution: {
        ...resolution,
        // Render the summary from its frozen records, with the main page first.
        pdfLayoutMode: "standard",
        finalizedPdfLayoutMode: "standard",
        generatedPageOrder: ["resolution_page", "vote_table"],
        finalizedGeneratedPageOrderSnapshot: ["resolution_page", "vote_table"],
      },
    },
  };
}
