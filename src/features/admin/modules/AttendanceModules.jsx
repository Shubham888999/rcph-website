import { useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty } from "../shared/AdminStates";
import { AVENUES, buildEventPayload, normalizeAttendance } from "../shared/adminModel";
import { adminCalls, addRosterMember, deleteRosterMember, setAttendanceBulk, setAttendanceCell, setAttendanceRow, updateRosterMember } from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";

function nextAttendance(value) { return value === true ? false : value === false ? "NA" : true; }

function AttendanceGrid({ members, events, attendance, collectionName, locked, uid, onNotice }) {
  const { busy, run } = useAdminMutation({ uid, module: collectionName, onNotice });
  if (!members.length || !events.length) return <AdminEmpty message="Add roster members and events before recording attendance." />;
  const options = [["", "Bulk…"], ["present", "All present"], ["absent", "All absent"], ["na", "All N/A"]];
  const toValue = (value) => value === "present" ? true : value === "absent" ? false : "NA";
  const prospectIds = members.filter((member) => member.role?.toLowerCase() === "prospect").map((member) => member.id);
  async function syncProspects(ids) { if (collectionName !== "attendance") return; try { await Promise.all(ids.filter((id) => prospectIds.includes(id)).map((id) => adminCalls.recalcProspect(id))); } catch { onNotice({ type: "error", message: "Attendance was saved, but Prospect progress could not be refreshed." }); } }
  function bulkEvent(eventId, selected) { if (!selected) return; run("bulk-event-attendance", () => setAttendanceBulk(collectionName, members.map((member) => member.id), eventId, toValue(selected)), "Event attendance updated.").then((result) => { if (result !== null) syncProspects(prospectIds); }); }
  function bulkMember(memberId, selected) { if (!selected) return; run("bulk-member-attendance", () => setAttendanceRow(collectionName, memberId, events.map((event) => event.id), toValue(selected)), "Member attendance updated.").then((result) => { if (result !== null) syncProspects([memberId]); }); }
  return <div className="admin-table-wrap admin-attendance-grid"><table><caption>Attendance: buttons cycle Present, Absent, and Not applicable; bulk controls update a full event or member row.</caption><thead><tr><th>Member</th>{events.map((event) => <th key={event.id}>{event.name}<small>{event.date}</small><select aria-label={`Bulk attendance for ${event.name}`} disabled={locked || busy} defaultValue="" onChange={(change) => { bulkEvent(event.id, change.target.value); change.target.value = ""; }}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></th>)}</tr></thead><tbody>{members.map((member) => <tr key={member.id}><th>{member.name}<select aria-label={`Bulk attendance for ${member.name}`} disabled={locked || busy} defaultValue="" onChange={(change) => { bulkMember(member.id, change.target.value); change.target.value = ""; }}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></th>{events.map((event) => { const value = normalizeAttendance(attendance[member.id]?.[event.id]); const label = value === true ? "Present" : value === false ? "Absent" : "Not applicable"; return <td key={event.id}><button className={`attendance-cell attendance-cell--${value === true ? "present" : value === false ? "absent" : "na"}`} type="button" disabled={locked || busy} aria-label={`${member.name}, ${event.name}: ${label}`} onClick={() => run("set-attendance", () => setAttendanceCell(collectionName, member.id, event.id, nextAttendance(value)), "Attendance updated.").then((result) => { if (result !== null) syncProspects([member.id]); })}>{value === true ? "P" : value === false ? "A" : "NA"}</button></td>; })}</tr>)}</tbody></table></div>;
}

function MailDraftTool({ members, title }) {
  const [draft, setDraft] = useState({ to: "", from: "", subject: "", body: "" });
  function open(event) { event.preventDefault(); const query = new URLSearchParams({ subject: draft.subject, body: `${draft.body}\n\nFrom: ${draft.from}` }); window.location.href = `mailto:${encodeURIComponent(draft.to)}?${query.toString()}`; }
  return <details className="admin-panel"><summary>{title} warning/termination mail drafts</summary><form className="admin-form admin-form--inline" onSubmit={open}><label>Recipient<select value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} required><option value="">Choose member</option>{members.filter((member) => member.email).map((member) => <option key={member.id} value={member.email}>{member.name}</option>)}</select></label><label>From<input type="email" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} required /></label><label>Subject<input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} required /></label><label>Message<textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} required /></label><button>Open mail draft</button></form><p>This opens the default mail application; React does not send the message.</p></details>;
}

const emptyEvent = { name: "", date: "", endDate: "", desc: "", avenue: [] };
function ClubEventForm({ initial = emptyEvent, onSave, busy, submitLabel }) {
  const [draft, setDraft] = useState({ ...emptyEvent, ...initial });
  function submit(event) { event.preventDefault(); const payload = buildEventPayload(draft); if (!payload.name || !payload.date || (payload.endDate && payload.endDate < payload.date) || !payload.avenue.length) return; onSave(payload); }
  return <form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label><label>Start date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></label><label>End date<input type="date" min={draft.date} value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label><label>Description<textarea value={draft.desc} onChange={(event) => setDraft({ ...draft, desc: event.target.value })} /></label></div><fieldset><legend>Avenues</legend><div className="admin-check-grid">{AVENUES.map((avenue) => <label key={avenue}><input type="checkbox" checked={draft.avenue.includes(avenue)} onChange={(event) => setDraft({ ...draft, avenue: event.target.checked ? [...draft.avenue, avenue] : draft.avenue.filter((item) => item !== avenue) })} /> {avenue}</label>)}</div></fieldset><button disabled={busy}>{submitLabel}</button></form>;
}

export function ClubAttendanceModule({ data, lock, uid, onNotice }) {
  const [editing, setEditing] = useState(null);
  const [archive, setArchive] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "club-attendance", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const events = data.events.filter((event) => !event.archived);
  return <>
    <AdminModuleHeader title="Club Events & Attendance" />
    <div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>{lock.status === "error" ? "Lock status unavailable; changes disabled." : locked ? "Attendance Manager is locked." : "Attendance Manager is open."}</div>
    <section className="admin-panel"><h3>Create club event</h3><ClubEventForm busy={busy || locked} submitLabel="Create synchronized club event" onSave={(payload) => run("create-event", () => adminCalls.createClubEvent(payload), "Club event created and attendance initialized.")} /></section>
    <section className="admin-panel"><h3>Active club events</h3><div className="admin-card-grid">{events.map((event) => <article className="admin-record-card" key={event.id}><h4>{event.name}</h4><p>{event.date}{event.endDate ? ` – ${event.endDate}` : ""}</p><p>{event.avenue.join(", ") || "No avenue"}</p><div className="admin-actions"><button disabled={locked || busy} onClick={() => setEditing(event)}>Edit</button><button className="danger" disabled={locked || busy} onClick={() => setArchive(event)}>Archive</button></div></article>)}</div></section>
    <AttendanceGrid members={data.members} events={events} attendance={data.attendance} collectionName="attendance" locked={locked} uid={uid} onNotice={onNotice} />
    <MailDraftTool members={data.members} title="GBM" />
    {editing ? <AdminDialog title={`Edit ${editing.name}`} busy={busy} onClose={() => setEditing(null)}><ClubEventForm initial={editing} busy={busy} submitLabel="Save event" onSave={(payload) => run("update-event", () => adminCalls.updateClubEvent({ ...payload, eventId: editing.id }), "Club event updated.").then((result) => { if (result) setEditing(null); })} /></AdminDialog> : null}
    {archive ? <AdminDialog title={`Archive ${archive.name}?`} busy={busy} onClose={() => setArchive(null)}><p>This soft-archives synchronized event records and preserves attendance history.</p><div className="admin-actions"><button onClick={() => setArchive(null)}>Cancel</button><button className="danger" onClick={() => run("archive-event", () => adminCalls.archiveClubEvent(archive.id), "Club event archived.").then((result) => { if (result) setArchive(null); })}>Archive</button></div></AdminDialog> : null}
  </>;
}

export function BodOperationsModule({ data, lock, uid, onNotice }) {
  const [member, setMember] = useState({ name: "", position: "" });
  const [meeting, setMeeting] = useState({ name: "", date: "" });
  const [editMember, setEditMember] = useState(null);
  const [editMeeting, setEditMeeting] = useState(null);
  const [archiveMeeting, setArchiveMeeting] = useState(null);
  const [remove, setRemove] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "bod-operations", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const meetings = data.bodMeetings.filter((item) => !item.archived);
  function saveMember(event) { event.preventDefault(); run("edit-bod-member", () => updateRosterMember("bodMembers", editMember.id, { name: editMember.name.trim(), position: editMember.position.trim() }), "BOD member updated.").then((result) => { if (result !== null) setEditMember(null); }); }
  function saveMeeting(event) { event.preventDefault(); run("edit-bod-meeting", () => adminCalls.updateBodMeeting({ meetingId: editMeeting.id, name: editMeeting.name.trim(), date: editMeeting.date }), "BOD meeting updated.").then((result) => { if (result) setEditMeeting(null); }); }
  return <>
    <AdminModuleHeader title="BOD Roster, Meetings & Attendance" />
    <div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>{locked ? "BOD Attendance is locked or unavailable." : "BOD Attendance is open."}</div>
    <section className="admin-panel admin-two-column"><form className="admin-form" onSubmit={(event) => { event.preventDefault(); run("add-bod-member", () => addRosterMember("bodMembers", member), "BOD member added.").then((result) => { if (result) setMember({ name: "", position: "" }); }); }}><h3>Add BOD member</h3><label>Name<input value={member.name} onChange={(event) => setMember({ ...member, name: event.target.value })} required /></label><label>Position<input value={member.position} onChange={(event) => setMember({ ...member, position: event.target.value })} /></label><button disabled={locked || busy}>Add BOD member</button></form><form className="admin-form" onSubmit={(event) => { event.preventDefault(); run("add-bod-meeting", () => adminCalls.createBodMeeting(meeting), "BOD meeting created and attendance initialized.").then((result) => { if (result) setMeeting({ name: "", date: "" }); }); }}><h3>Add BOD meeting</h3><label>Name<input value={meeting.name} onChange={(event) => setMeeting({ ...meeting, name: event.target.value })} required /></label><label>Date<input type="date" value={meeting.date} onChange={(event) => setMeeting({ ...meeting, date: event.target.value })} required /></label><button disabled={locked || busy}>Add meeting</button></form></section>
    <section className="admin-panel"><h3>BOD roster</h3><div className="admin-card-grid">{data.bodMembers.map((item) => <article className="admin-record-card" key={item.id}><h4>{item.name}</h4><p>{item.position || "Position unavailable"}</p><div className="admin-actions"><button disabled={locked} onClick={() => setEditMember({ ...item })}>Edit</button><button className="danger" disabled={locked} onClick={() => setRemove(item)}>Remove</button></div></article>)}</div></section>
    <section className="admin-panel"><h3>BOD meetings</h3><div className="admin-card-grid">{meetings.map((item) => <article className="admin-record-card" key={item.id}><h4>{item.name}</h4><p>{item.date}</p><div className="admin-actions"><button disabled={locked} onClick={() => setEditMeeting({ ...item })}>Edit</button><button className="danger" disabled={locked} onClick={() => setArchiveMeeting(item)}>Archive</button></div></article>)}</div></section>
    <AttendanceGrid members={data.bodMembers} events={meetings} attendance={data.bodAttendance} collectionName="bodAttendance" locked={locked} uid={uid} onNotice={onNotice} />
    <MailDraftTool members={data.bodMembers} title="BOD" />
    {editMember ? <AdminDialog title={`Edit ${editMember.name}`} busy={busy} onClose={() => setEditMember(null)}><form className="admin-form" onSubmit={saveMember}><label>Name<input value={editMember.name} onChange={(event) => setEditMember({ ...editMember, name: event.target.value })} required /></label><label>Position<input value={editMember.position} onChange={(event) => setEditMember({ ...editMember, position: event.target.value })} /></label><button disabled={busy}>Save BOD member</button></form></AdminDialog> : null}
    {editMeeting ? <AdminDialog title={`Edit ${editMeeting.name}`} busy={busy} onClose={() => setEditMeeting(null)}><form className="admin-form" onSubmit={saveMeeting}><label>Name<input value={editMeeting.name} onChange={(event) => setEditMeeting({ ...editMeeting, name: event.target.value })} required /></label><label>Date<input type="date" value={editMeeting.date} onChange={(event) => setEditMeeting({ ...editMeeting, date: event.target.value })} required /></label><button disabled={busy}>Save meeting</button></form></AdminDialog> : null}
    {archiveMeeting ? <AdminDialog title={`Archive ${archiveMeeting.name}?`} busy={busy} onClose={() => setArchiveMeeting(null)}><p>This soft-archives the synchronized meeting while preserving historical attendance.</p><div className="admin-actions"><button onClick={() => setArchiveMeeting(null)}>Cancel</button><button className="danger" onClick={() => run("archive-bod-meeting", () => adminCalls.archiveBodMeeting(archiveMeeting.id), "BOD meeting archived.").then((result) => { if (result) setArchiveMeeting(null); })}>Archive</button></div></AdminDialog> : null}
    {remove ? <AdminDialog title={`Remove ${remove.name}?`} busy={busy} onClose={() => setRemove(null)}><p>This permanently removes the BOD roster and attendance documents, matching production.</p><div className="admin-actions"><button onClick={() => setRemove(null)}>Cancel</button><button className="danger" onClick={() => run("remove-bod-member", () => deleteRosterMember("bodMembers", "bodAttendance", remove.id), "BOD member removed.").then((result) => { if (result !== null) setRemove(null); })}>Remove</button></div></AdminDialog> : null}
  </>;
}

export function DistrictModule({ data, lock, uid, onNotice }) {
  const empty = { name: "", date: "", endDate: "", desc: "", public: false };
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [archive, setArchive] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "district", onNotice });
  const locked = lock.status !== "success" || lock.locked;
  const events = data.districtEvents.filter((item) => !item.archived);
  const payload = (value) => ({ name: value.name.trim(), date: value.date, endDate: value.endDate, desc: value.desc.trim(), visibility: value.public ? "public" : "internal", showOnHomepage: value.public });
  function submit(event) { event.preventDefault(); run("create-district", () => adminCalls.createDistrictEvent(payload(draft)), "District event synchronized and attendance initialized.").then((result) => { if (result) setDraft(empty); }); }
  function save(event) { event.preventDefault(); run("update-district", () => adminCalls.updateDistrictEvent({ ...payload(editing), districtEventId: editing.id }), "District event updated.").then((result) => { if (result) setEditing(null); }); }
  const form = (value, setValue, onSubmit, label) => <form className="admin-form admin-form--inline" onSubmit={onSubmit}><label>Name<input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} required /></label><label>Start<input type="date" value={value.date} onChange={(event) => setValue({ ...value, date: event.target.value })} required /></label><label>End<input type="date" min={value.date} value={value.endDate} onChange={(event) => setValue({ ...value, endDate: event.target.value })} /></label><label>Description<input value={value.desc} onChange={(event) => setValue({ ...value, desc: event.target.value })} /></label><label><input type="checkbox" checked={value.public} onChange={(event) => setValue({ ...value, public: event.target.checked })} /> Show on public calendar</label><button disabled={locked || busy}>{label}</button></form>;
  return <>
    <AdminModuleHeader title="District Events & Attendance" />
    <div className={`admin-lock-banner ${locked ? "is-locked" : ""}`}>{locked ? "District changes are locked or unavailable." : "District changes are open."}</div>
    <section className="admin-panel">{form(draft, setDraft, submit, "Add district event")}</section>
    <div className="admin-card-grid">{events.map((event) => <article className="admin-record-card" key={event.id}><h3>{event.name}</h3><p>{event.date} · {event.visibility}</p><div className="admin-actions"><button disabled={locked} onClick={() => setEditing({ ...event, public: event.visibility === "public" })}>Edit</button><button className="danger" disabled={locked} onClick={() => setArchive(event)}>Archive</button></div></article>)}</div>
    <AttendanceGrid members={data.members} events={events} attendance={data.districtAttendance} collectionName="districtAttendance" locked={locked} uid={uid} onNotice={onNotice} />
    {editing ? <AdminDialog title={`Edit ${editing.name}`} busy={busy} onClose={() => setEditing(null)}>{form(editing, setEditing, save, "Save district event")}</AdminDialog> : null}
    {archive ? <AdminDialog title={`Archive ${archive.name}?`} busy={busy} onClose={() => setArchive(null)}><p>This archives district, mirrored BOD, and conditional public records while preserving attendance.</p><div className="admin-actions"><button onClick={() => setArchive(null)}>Cancel</button><button className="danger" onClick={() => run("archive-district", () => adminCalls.archiveDistrictEvent(archive.id), "District event archived.").then((result) => { if (result) setArchive(null); })}>Archive</button></div></AdminDialog> : null}
  </>;
}
