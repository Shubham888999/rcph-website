const INVITE_SHARE_MESSAGE = "Join me at Rotaract Club of Pune Heritage! Apply here:";

export function canShowInviteCard(access) {
  return access?.canAccessMemberDashboard === true;
}

export function normalizeInviteLink(raw) {
  const url = typeof raw?.url === "string" ? raw.url : "";
  if (!url.startsWith("https://rcph3131.org/join?ref=")) return null;
  const count = Number(raw.referredCount);
  return { url, referredCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0 };
}

export function buildInviteWhatsAppUrl(url) {
  return `https://wa.me/?text=${encodeURIComponent(`${INVITE_SHARE_MESSAGE} ${url}`)}`;
}

export function formatReferredCount(count) {
  return `${count} ${count === 1 ? "person" : "people"} joined with your link`;
}
