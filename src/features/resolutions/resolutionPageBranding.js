import { resolutionMajorityPercent } from "./resolutionSectionsModel.js";

const PAGE_SEAL = Object.freeze({ x: 312, y: 40, width: 72, height: 72 * 744 / 695 });
const BRANDING_VERSION = 1;
// One extra line beneath the letterhead; move the body by the same amount.
const WATERMARK_TOP_GAP = 12;

function headerWrap(value, size, width = 487) {
  const limit = Math.max(1, Math.floor(width / (size * 0.62)));
  const lines = [];
  let line = '';
  for (const word of String(value || '').replace(/\s+/g, ' ').trim().split(' ')) {
    if (line && (line + ' ' + word).length > limit) { lines.push(line); line = ''; }
    let remaining = word;
    while (remaining.length > limit) {
      if (line) { lines.push(line); line = ''; }
      lines.push(remaining.slice(0, limit)); remaining = remaining.slice(limit);
    }
    if (remaining) line = line ? line + ' ' + remaining : remaining;
  }
  if (line) lines.push(line);
  return lines;
}

function resolutionPageBranding(details = {}) {
  const resolution = details.resolution || details;
  const tally = details.majority || resolution;
  const pageConfig = resolution.finalizedResolutionPageConfigSnapshot || details.resolutionPageConfig || resolution.resolutionPageConfig || {};
  const percent = resolutionMajorityPercent({ approveCount: tally.approveCount, votesReceivedCount: tally.votesReceivedCount, boardMembersPresent: pageConfig.details?.boardMembersPresent });
  const status = tally.status || resolution.status || String(details.resultLabel || '').toLowerCase();
  let statement;
  if (tally.approvalMethod === 'record_only') statement = 'This page forms part of the recorded resolution of the Board Members of Rotaract Club of Pune Heritage.';
  else if (status === 'passed') statement = 'We, the Board Members of Rotaract Club of Pune Heritage, hereby confirm that the above resolution was duly voted upon and passed' + (percent ? ' by a majority of ' + percent : ' (approval percentage unavailable)') + ' at the scheduled Board Meeting.';
  else if (status === 'rejected') statement = 'We, the Board Members of Rotaract Club of Pune Heritage, hereby confirm that the above resolution was duly voted upon and was not passed at the scheduled Board Meeting.' + (percent ? ' Approval: ' + percent + '.' : '');
  else if (status === 'closed_without_decision') statement = 'The Board Members of Rotaract Club of Pune Heritage voted upon the above resolution. Voting closed without a decision.' + (percent ? ' Approval: ' + percent + '.' : '');
  else statement = 'This page forms part of the resolution voting record of the Board Members of Rotaract Club of Pune Heritage. The final result is recorded after voting closes.';
  const lines = [];
  let y = 690 - WATERMARK_TOP_GAP;
  for (const text of headerWrap('Resolution: ' + (resolution.title || details.title || 'Resolution'), 8.5, 460)) {
    lines.push({ text, size: 8.5, bold: true, x: 54, y }); y -= 11;
  }
  y -= 3;
  for (const text of headerWrap(statement, 8)) {
    lines.push({ text, size: 8, bold: false, x: 54, y }); y -= 10.5;
  }
  return { lines, bodyTop: Math.min(630 - WATERMARK_TOP_GAP, y - 14), percent, statement };
}

export { BRANDING_VERSION, PAGE_SEAL, resolutionPageBranding };
