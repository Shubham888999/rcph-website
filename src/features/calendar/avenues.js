export const UNKNOWN_AVENUE = Object.freeze({ code: "Unknown", label: "Unknown avenue", color: "#666666" });

export const AVENUES = Object.freeze([
  { code: "ISD", label: "International Service Avenue", color: "#1abc9c" },
  { code: "CMD", label: "Community Service Avenue", color: "#3498db" },
  { code: "CSD", label: "Club Service Avenue", color: "#9b59b6" },
  { code: "PDD", label: "Professional Development Avenue", color: "#e74c3c" },
  { code: "RRRO", label: "Rotary Rotaract Relations Avenue", color: "#27ae60" },
  { code: "PRO", label: "Public Relations Avenue", color: "#f1c40f" },
  { code: "DEI", label: "Diversity, Equity & Inclusion Avenue", color: "#95a5a6" },
  { code: "GBM", label: "General Body Meeting", color: "#d35400" },
]);

const avenueByCode = new Map(AVENUES.map((avenue) => [avenue.code, avenue]));

export function getAvenue(code) {
  return avenueByCode.get(code) || { ...UNKNOWN_AVENUE, code: code || UNKNOWN_AVENUE.code };
}

export function getAvenueGradient(codes) {
  const orderedCodes = codes.length ? codes : [UNKNOWN_AVENUE.code];
  const width = 100 / orderedCodes.length;
  const stops = orderedCodes.flatMap((code, index) => {
    const color = getAvenue(code).color;
    return [`${color} ${index * width}%`, `${color} ${(index + 1) * width}%`];
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
