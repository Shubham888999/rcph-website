export function normalizeAuthEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidAuthEmail(value) {
  const email = normalizeAuthEmail(value);
  if (!email || Array.from(email).some((character) => character.trim() === "")) return false;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@") || atIndex >= email.length - 1) {
    return false;
  }

  const domain = email.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < domain.length - 1;
}

export function validateAuthEmail(value) {
  const email = normalizeAuthEmail(value);
  if (!email) return { email, error: "Enter your email address." };
  if (!isValidAuthEmail(email)) return { email, error: "Enter a valid email address." };
  return { email, error: "" };
}
