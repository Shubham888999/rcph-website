export const BOD_REVEAL_PLACEHOLDER_TITLE = "BOD reveal coming soon";
export const BOD_REVEAL_POSITIONS_REGION_ID = "bod-reveal-positions";
export const BOD_REVEAL_POSITIONS = Object.freeze([
  "President",
  "Secretary",
  "Treasurer",
  "Vice President",
  "IPP / RRRO",
  "Club Advisor",
  "PDD",
  "CMD",
  "CSD",
  "ISD",
  "SAA",
  "Editor",
  "Co-Editor",
  "Website Director",
  "",
  "",
]);

export function createBodRevealPlaceholderState() {
  return { expanded: false };
}

export function toggleBodRevealPlaceholder(current) {
  return { expanded: !current.expanded };
}

export function getBodRevealPlaceholderLabel(expanded) {
  return expanded ? "Hide mystery BOD cards" : "Show mystery BOD cards";
}

export function getBodRevealPositionsRegionLabel(showPositionLabels = false) {
  return showPositionLabels ? "Upcoming BOD positions" : "Mystery BOD cards";
}

export function getBodRevealPositionLabel(position, index, options = {}) {
  if (options.showPositionLabels === true) {
    return position || `Unannounced BOD position ${index + 1}`;
  }
  return `Mystery BOD card ${index + 1}`;
}

export function getBodRevealPositionText(position, options = {}) {
  return options.showPositionLabels === true ? position : "";
}
