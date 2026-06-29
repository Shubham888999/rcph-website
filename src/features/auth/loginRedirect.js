const FALLBACK_PATH = "/access";

export function getSafeLoginDestination(value, fallback = FALLBACK_PATH) {
  if (typeof value !== "string" || !value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  const hasControlCharacter = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (value.includes("\\") || hasControlCharacter) return fallback;

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;

  let parsed;
  try {
    parsed = new URL(value, "https://rcph.local");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "https://rcph.local") return fallback;
  if (parsed.pathname === "/login" || parsed.pathname === "/login/") return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
