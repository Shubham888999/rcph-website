export const ADMIN_ROLES = ["gbm", "bod", "admin", "president"];
export const ATTENDANCE_VALUES = [true, false, "NA"];
export const AVENUES = ["ISD", "CMD", "CSD", "PDD", "RRRO", "PRO", "DEI", "GBM"];
export const LOCK_KEYS = ["attendance", "bodAttendance", "fines", "treasury"];

export function text(value, max = 5000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
export function timestampIso(value) {
  try { const d = value?.toDate?.() || (value instanceof Date ? value : null); return d && !Number.isNaN(d.getTime()) ? d.toISOString() : ""; } catch { return ""; }
}
export function safeUrl(value) {
  try { const url = new URL(text(value, 1000)); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
export function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; }
export function formatInr(value) { const amount = money(value); return amount === null ? "Unavailable" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount); }
export function cleanAvenues(value) { const values = Array.isArray(value) ? value : value ? [value] : []; return [...new Set(values.map((x) => text(x, 40).toUpperCase()).filter(Boolean))]; }
export function normalizeAttendance(value) { return value === true || value === false || value === "NA" ? value : "NA"; }
export function attendancePatch(eventId, value) { const id = text(eventId, 128); if (!id || id.includes("/")) throw new TypeError("Valid event ID required."); return { [id]: normalizeAttendance(value) }; }

export function normalizeAdminUser(id, raw) {
  if (!id || !raw || typeof raw !== "object") return null;
  const status = text(raw.status, 30).toLowerCase() || "pending";
  return { id, name: text(raw.name, 160) || "Unnamed account", email: text(raw.email, 320).toLowerCase(), phone: text(raw.phone, 40), role: text(raw.role, 30).toLowerCase(), requestedRole: text(raw.requestedRole, 30).toLowerCase(), status, provider: text(raw.provider, 40), positionKeys: Array.isArray(raw.positionKeys) ? [...new Set(raw.positionKeys.map((x) => text(x, 80)).filter(Boolean))] : [], clubPosition: text(raw.clubPosition, 180), rejectReason: text(raw.rejectReason, 500), createdAt: timestampIso(raw.createdAt), active: raw.active !== false };
}
export function normalizeMember(id, raw) { if (!id || !raw || typeof raw !== "object") return null; return { id, name: text(raw.name, 160) || "Unnamed member", email: text(raw.email, 320).toLowerCase(), role: text(raw.role, 30), position: text(raw.position || raw.clubPosition, 180), active: raw.active !== false }; }
export function normalizeEvent(id, raw, kind = "club") {
  if (!id || !raw || typeof raw !== "object") return null;
  const date = text(raw.date || raw.eventStart, 20); if (!text(raw.name, 180) || !validDate(date)) return null;
  const end = text(raw.endDate || raw.eventEnd, 20);
  return { id, name: text(raw.name, 180), date, endDate: validDate(end) && end >= date ? end : "", desc: text(raw.desc || raw.description, 2500), avenue: cleanAvenues(raw.avenue), visibility: text(raw.visibility, 20) || "public", archived: raw.archived === true, kind, rcphRole: text(raw.rcphRole, 30), hostClub: text(raw.hostClub, 180), collaborators: Array.isArray(raw.collaborators) ? raw.collaborators.map((x) => text(typeof x === "string" ? x : x?.name, 180)).filter(Boolean) : [], createdByName: text(raw.createdByName, 160) };
}
export function normalizeFine(id, raw) { const amount = money(raw?.amount); if (!id || !raw || amount === null || !validDate(text(raw.date, 20))) return null; return { id, memberId: text(raw.memberId, 128), memberName: text(raw.memberName, 160), reason: text(raw.reason, 120), eventName: text(raw.eventName, 180), date: text(raw.date, 20), amount }; }
export function normalizeTreasury(id, raw) { const amount = money(raw?.amount); const type = text(raw?.type, 20).toLowerCase(); if (!id || !raw || amount === null || amount <= 0 || !["income", "expense"].includes(type) || !validDate(text(raw.date, 20))) return null; return { id, title: text(raw.title || raw.name, 180), type, amount, date: text(raw.date, 20), avenue: text(raw.avenue, 40), purpose: text(raw.purpose || raw.linkedEventName, 500), paidBy: text(raw.paidBy, 180), paidByType: text(raw.paidByType, 20), paidByMemberId: text(raw.paidByMemberId, 128), paidTo: text(raw.paidTo, 180), paidToType: text(raw.paidToType, 20), paidToMemberId: text(raw.paidToMemberId, 128), paymentMode: text(raw.paymentMode, 80), referenceNumber: text(raw.referenceNumber || raw.cheque, 180), reimbursementStatus: text(raw.reimbursementStatus || raw.reimburse, 80), reimbursedTo: text(raw.reimbursedTo, 180), reimbursementDate: validDate(text(raw.reimbursementDate, 20)) ? text(raw.reimbursementDate, 20) : "", billUrl: safeUrl(raw.billUrl) }; }
export function canUseAdmin(access) { return access?.isApproved === true && access?.canAccessAdminTools === true; }
export function canUsePresidentControls(access) { return canUseAdmin(access) && access?.canAccessPresidentControls === true; }
export function buildAccessPayload({ targetUid, role, positionKeys = [], confirmJointPositionKeys = [], mode = "maintenance" }) { return { targetUid: text(targetUid, 128), role: ADMIN_ROLES.includes(role) ? role : "", positionKeys: [...new Set(positionKeys.map((x) => text(x, 80)).filter(Boolean))], confirmJointPositionKeys: [...new Set(confirmJointPositionKeys.map((x) => text(x, 80)).filter(Boolean))], operationSource: mode === "approval" ? "accountApproval" : "roleMaintenance" }; }
export function buildEventPayload(draft, id = "") { const payload = { name: text(draft.name, 180), date: text(draft.date, 20), endDate: text(draft.endDate, 20) || text(draft.date, 20), desc: text(draft.desc, 2500), avenue: cleanAvenues(draft.avenue) }; if (id) payload.eventId = text(id, 128); return payload; }
export function buildFinePayload(draft) { return { memberId: text(draft.memberId, 128), memberName: text(draft.memberName, 160), reason: text(draft.reason, 120), eventName: text(draft.eventName, 180), date: text(draft.date, 20), amount: money(draft.amount) }; }
export function buildAnnouncementPayload(draft) { return { title: text(draft.title, 160), body: text(draft.body, 5000), priority: ["normal", "important", "urgent"].includes(draft.priority) ? draft.priority : "normal", actionText: text(draft.actionText, 80), actionUrl: draft.actionUrl ? safeUrl(draft.actionUrl) : "", targetRoles: [...new Set((draft.targetRoles || []).filter((x) => ["all", "prospect", "gbm", "bod", "admin", "president"].includes(x)))], targetUserIds: [...new Set((draft.targetUserIds || []).map((x) => text(x, 128)).filter(Boolean))], expiresAt: draft.expiresAt || null, sendEmail: draft.sendEmail === true }; }
