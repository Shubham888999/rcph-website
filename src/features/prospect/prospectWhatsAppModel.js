export const PROSPECT_WHATSAPP_GROUP_URL = null;

export function getProspectWhatsAppGroupState(value = PROSPECT_WHATSAPP_GROUP_URL) {
  if (typeof value !== "string" || !value.trim()) {
    return { available: false, url: "" };
  }

  try {
    const url = new URL(value.trim());
    const validInvite = url.protocol === "https:"
      && url.hostname === "chat.whatsapp.com"
      && url.pathname.length > 1;
    return validInvite
      ? { available: true, url: url.href }
      : { available: false, url: "" };
  } catch {
    return { available: false, url: "" };
  }
}
