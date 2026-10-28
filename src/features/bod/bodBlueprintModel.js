// The gap is included so the port stays under the card centre in partial rows too.
export function getBlueprintConnectorPosition(columnIndex, columnCount) {
  const count = Number.isInteger(columnCount) && columnCount > 0 ? columnCount : 1;
  const index = Math.min(count - 1, Math.max(0, Number.isInteger(columnIndex) ? columnIndex : 0));
  return `calc((100% + var(--bod-grid-gap)) * ${(index + 0.5) / count} - var(--bod-grid-gap) / 2)`;
}
