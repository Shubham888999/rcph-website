import { sanitizeAttributionSource } from "../../auth/signupAttribution.js";

export const SIGNUP_FUNNEL_WINDOWS = [30, 90, 365];
const TAGGED_JOIN_LINK_BASE = "https://rcph3131.org/join?src=";
const FUNNEL_PATH_LABELS = { prospect: "Prospect", member: "Member access", district: "District Official" };

// Same authority the getSignupFunnel callable enforces.
export function canViewSignupFunnel(access) {
  return access?.canAccessAdminTools === true;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => typeof row?.key === "string" && row.key)
    .map((row) => ({ key: row.key, signups: count(row.signups), approved: count(row.approved), member: count(row.member) }));
}

export function normalizeSignupFunnel(raw) {
  return {
    signups: count(raw?.signups),
    approved: count(raw?.approved),
    member: count(raw?.member),
    bySource: normalizeRows(raw?.bySource),
    byPath: normalizeRows(raw?.byPath).map((row) => ({ ...row, label: FUNNEL_PATH_LABELS[row.key] || row.key })),
  };
}

export function buildTaggedJoinLink(name) {
  const slug = sanitizeAttributionSource(name);
  return slug ? `${TAGGED_JOIN_LINK_BASE}${slug}` : "";
}

export function formatSignupSource(user) {
  return user?.signupSource || "direct";
}

export function formatReferredBy(user) {
  return user?.referredByName || user?.referredBy || "None";
}
