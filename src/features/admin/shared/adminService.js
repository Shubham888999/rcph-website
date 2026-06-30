import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../../../app/firebase";
import { createAdminCache } from "./adminCache";
import { registerAdminCacheClear } from "./adminCacheRegistry";
import { attendancePatch } from "./adminModel";

const QUERY_CONFIG = {
  users: ["users", "createdAt", "desc"], members: ["members", "name", "asc"], events: ["events", "date", "desc"], attendance: ["attendance"],
  bodMembers: ["bodMembers", "name", "asc"], bodMeetings: ["bodMeetings", "date", "desc"], bodAttendance: ["bodAttendance"],
  districtEvents: ["districtEvents", "date", "desc"], districtAttendance: ["districtAttendance"], fines: ["fines", "date", "desc"], treasury: ["treasury", "date", "desc"],
};

function requireUser(uid = "") { if (!auth.currentUser || (uid && auth.currentUser.uid !== uid)) throw new Error("Authenticated user required."); return auth.currentUser.uid; }
function refFor(config) { const base = collection(db, config[0]); return config[1] ? query(base, orderBy(config[1], config[2] || "asc")) : base; }

export function subscribeAdminCollection(uid, module, onData, onError) {
  requireUser(uid); const config = QUERY_CONFIG[module]; if (!config) throw new Error("Unknown Admin collection.");
  return onSnapshot(refFor(config), (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, data: item.data() }))), onError);
}
export function subscribeAdminLock(uid, key, onData, onError) {
  requireUser(uid); return onSnapshot(doc(db, "locks", key), (snapshot) => onData({ key, locked: snapshot.exists() && snapshot.data()?.locked === true }), onError);
}

async function callable(name, payload = {}) { requireUser(); const result = await httpsCallable(functions, name)(payload); return result?.data && typeof result.data === "object" ? result.data : {}; }
const callableCache = createAdminCache((uid, module) => { requireUser(uid); return callable(module, {}); });
export function loadAdminCallable(uid, name, refresh = false) { return callableCache.get({ uid, module: name, refresh }); }
export function clearAdminCaches(uid, modules) { callableCache.clear(uid, modules); }
registerAdminCacheClear((uid) => clearAdminCaches(uid));

export const adminCalls = {
  updateAccess: (payload) => callable("updateUserAccessAndPositions", payload), rejectAccess: (payload) => callable("rejectUserRoleRequest", payload),
  dashboard: () => callable("getMyDashboardStats", {}), updateRanking: (payload) => callable("updateClubRanking", payload),
  prospects: () => callable("getProspectManagementData", {}), recalcProspect: (uid) => callable("recalculateProspectProgress", { uid }), updateDues: (uid, duesPaid) => callable("updateProspectDues", { uid, duesPaid }), promoteProspect: (uid) => callable("promoteProspectToGbm", { uid }),
  announcementRecipients: () => callable("getAnnouncementRecipientOptions", {}), announcementHistory: (payload) => callable("getAnnouncementHistory", payload), publishAnnouncement: (payload) => callable("publishAnnouncement", payload),
  createClubEvent: (payload) => callable("createAdminClubEvent", payload), updateClubEvent: (payload) => callable("updateAdminClubEvent", payload), archiveClubEvent: (eventId) => callable("archiveAdminClubEvent", { eventId }),
  createBodMeeting: (payload) => callable("createBodMeetingSynced", payload), updateBodMeeting: (payload) => callable("updateBodMeetingSynced", payload), archiveBodMeeting: (meetingId) => callable("archiveBodMeetingSynced", { meetingId }),
  createDistrictEvent: (payload) => callable("createDistrictEventSynced", payload), updateDistrictEvent: (payload) => callable("updateDistrictEventSynced", payload), archiveDistrictEvent: (districtEventId) => callable("archiveDistrictEventSynced", { districtEventId }),
  treasuryTicket: (payload) => callable("createTreasuryUploadTicket", payload),
};

export async function setAttendanceCell(collectionName, recordId, eventId, value) { requireUser(); await setDoc(doc(db, collectionName, recordId), attendancePatch(eventId, value), { merge: true }); }
export async function setAttendanceBulk(collectionName, recordIds, eventId, value) { requireUser(); const batch = writeBatch(db); recordIds.forEach((id) => batch.set(doc(db, collectionName, id), attendancePatch(eventId, value), { merge: true })); await batch.commit(); }
export async function setAttendanceRow(collectionName, recordId, eventIds, value) { requireUser(); const patch = Object.assign({}, ...eventIds.map((eventId) => attendancePatch(eventId, value))); await setDoc(doc(db, collectionName, recordId), patch, { merge: true }); }
export async function addRosterMember(collectionName, payload) { requireUser(); return addDoc(collection(db, collectionName), payload); }
export async function updateRosterMember(collectionName, id, payload) { requireUser(); return updateDoc(doc(db, collectionName, id), payload); }
export async function deleteRosterMember(collectionName, attendanceCollection, id) { requireUser(); const batch = writeBatch(db); batch.delete(doc(db, collectionName, id)); batch.delete(doc(db, attendanceCollection, id)); await batch.commit(); }
export async function addFine(payload) { const uid = requireUser(); return addDoc(collection(db, "fines"), { ...payload, createdAt: serverTimestamp(), createdBy: uid }); }
export async function deleteFine(id) { requireUser(); return deleteDoc(doc(db, "fines", id)); }
export async function addTreasury(payload) { requireUser(); const target = doc(collection(db, "treasury")); await setDoc(target, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); return target.id; }
export function newTreasuryId() { requireUser(); return doc(collection(db, "treasury")).id; }
export async function setTreasuryById(id, payload) { requireUser(); await setDoc(doc(db, "treasury", id), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); return id; }
export async function updateTreasury(id, payload) { requireUser(); return updateDoc(doc(db, "treasury", id), { ...payload, updatedAt: serverTimestamp() }); }
export async function deleteTreasury(id) { requireUser(); return deleteDoc(doc(db, "treasury", id)); }
export async function setAdminLock(key, locked) { requireUser(); return setDoc(doc(db, "locks", key), { locked }, { merge: true }); }

export const visitCalls = {
  initialize: () => callable("initializeVisitSubmissionStructure", {}), dashboard: () => callable("getVisitSubmissionDashboard", {}), folders: (visitType) => callable("getVisitSubmissionFolders", { visitType }), folder: (visitType, positionKey) => callable("getVisitSubmissionFolder", { visitType, positionKey }),
  updateVisit: (payload) => callable("updateVisitSubmissionConfig", payload), updateFolder: (payload) => callable("updateVisitSubmissionFolder", payload),
  createSession: (payload) => callable("createVisitSubmissionUploadSession", payload), finalize: (payload) => callable("finalizeVisitSubmissionUpload", payload), cancelSession: (sessionId) => callable("cancelVisitSubmissionUploadSession", { sessionId }),
  withdraw: (submissionId) => callable("withdrawVisitSubmission", { submissionId }), remove: (submissionId, reason) => callable("removeVisitSubmission", { submissionId, reason }), replace: (submissionId, files) => callable("replaceVisitSubmission", { submissionId, files }),
  moderation: (payload) => callable("getVisitSubmissionModerationData", payload), reconcile: (visitType, positionKey) => callable("reconcileVisitSubmissionFolderCount", { visitType, positionKey }), cleanup: () => callable("cleanupExpiredVisitUploadSessions", { limit: 25 }),
};

export async function uploadVisitFile(file, session, approved) {
  const form = new FormData(); form.append("ticket", approved.ticket); form.append("sessionId", session.sessionId); form.append("clientFileId", approved.clientFileId); form.append("fileName", approved.fileName); form.append("mimeType", approved.mimeType); form.append("sizeBytes", String(approved.sizeBytes)); form.append("file", file, file.name);
  const response = await fetch("https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile", { method: "POST", body: form }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.completionProof) throw new Error("Visit file upload failed."); return data;
}

const TREASURY_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbyiB-ao2xmNH7aVe-ECfZnBDZLbq8i4sN-83p8r-GnHYz6-G1whNTyhC33ghb2gQhEheg/exec";
export async function uploadTreasuryBill(file, transaction, transactionId) {
  const ticket = await adminCalls.treasuryTicket({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, transactionId, transactionDate: transaction.date, transactionPurpose: transaction.purpose, transactionType: transaction.type, transactionAmount: transaction.amount });
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const response = await fetch(TREASURY_UPLOAD_URL, { method: "POST", body: JSON.stringify({ ticket: ticket.ticket, transactionId: ticket.transactionId, fileName: file.name, mimeType: file.type, fileData: btoa(binary) }) }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.fileUrl) throw new Error("Treasury bill upload failed."); return { billUrl: data.fileUrl, billFileName: data.fileName || file.name, billFileId: data.fileId || "", billFolderId: data.folderId || "", billFolderName: data.folderName || "", billUploadedAt: serverTimestamp() };
}
