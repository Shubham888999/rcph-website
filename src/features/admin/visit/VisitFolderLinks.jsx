import { useRef, useState } from "react";
import AdminDialog from "../shared/AdminDialog.jsx";
import { safeAdminError } from "../shared/adminErrors.js";
import { visitCalls } from "../shared/adminService.js";
import { visitFolderCategories } from "./visitModel.js";
import { MAX_VISIT_LINKS, visitLinkTarget } from "../../visits/visitLinks.js";

function linkError(error) {
  return ["invalid-argument", "failed-precondition", "not-found", "resource-exhausted"].some(code => String(error?.code || "").endsWith(code))
    ? error.message : safeAdminError(error);
}

function LinkDialog({ folder, link, removing, onClose, onSaved }) {
  const [title, setTitle] = useState(link?.title || "");
  const [url, setUrl] = useState(link?.url || "");
  const [category, setCategory] = useState(link?.documentCategory || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const target = visitLinkTarget(url);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      if (removing) await visitCalls.removeLink(folder.visitType, folder.positionKey, link.linkId);
      else await visitCalls.saveLink({ visitType: folder.visitType, positionKey: folder.positionKey, ...(link ? { linkId: link.linkId } : {}), title: title.trim(), url: url.trim(), documentCategory: category });
      onClose();
      await onSaved();
    } catch (failure) { setError(linkError(failure)); }
    finally { lock.current = false; setPending(false); }
  }
  return <AdminDialog title={removing ? `Remove ${link.title}?` : link ? "Edit link" : "Add link"} busy={pending} onClose={onClose}>
    <form className="admin-form" onSubmit={submit}>
      {removing ? <p>This removes the link from Club Visits and the visit dashboard. The original document stays in Google.</p> : <>
        <label>Title<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Inward register" /></label>
        <label>Link<input required type="url" maxLength={2000} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
        <label>Folder<select value={category} onChange={event => setCategory(event.target.value)}>{visitFolderCategories(folder).map(choice => <option key={choice.key} value={choice.key}>{choice.fullLabel || choice.label}</option>)}</select></label>
        <p className="visit-subtle-note">{target?.previewUrl ? "A live Google preview will appear in your visit dashboard section." : "Google Sheets, Docs, Slides and Drive files support previews. Other HTTPS links open in a new tab."} Google sharing permissions still apply. Open the original document to edit it.</p>
      </>}
      {error ? <p role="alert">{error}</p> : null}
      <div className="admin-actions"><button type="button" disabled={pending} onClick={onClose}>Cancel</button><button className={removing ? "danger" : undefined} disabled={pending || (!removing && (!title.trim() || !target))}>{pending ? "Saving..." : removing ? "Remove link" : "Save link"}</button></div>
    </form>
  </AdminDialog>;
}

export default function VisitFolderLinks({ folder, busy = false, reload }) {
  const [dialog, setDialog] = useState(null);
  const links = folder.documentLinks || [];
  const categories = visitFolderCategories(folder);
  return <section className="visit-workspace-panel visit-live-links" aria-labelledby="visit-live-links-title">
    <div className="visit-section-heading"><div><p className="visit-eyebrow">Connected documents</p><h3 id="visit-live-links-title">Live links</h3></div>{folder.canManageLinks ? <button type="button" disabled={busy || links.length >= MAX_VISIT_LINKS} onClick={() => setDialog({ link: null })}>Add link</button> : null}</div>
    {links.length ? <ul className="visit-live-links__list">{links.map(link => <li key={link.linkId}>
      <div><strong>{link.title}</strong><span>{categories.find(choice => choice.key === link.documentCategory)?.fullLabel || categories.find(choice => choice.key === link.documentCategory)?.label || "Supporting files"}</span><a href={link.url} target="_blank" rel="noopener noreferrer">Open original</a></div>
      {folder.canManageLinks ? <div className="visit-card-actions"><button type="button" disabled={busy} onClick={() => setDialog({ link })}>Edit link</button><button type="button" disabled={busy} onClick={() => setDialog({ link, removing: true })}>Remove link</button></div> : null}
    </li>)}</ul> : <p className="visit-subtle-note">No saved links in this folder yet.</p>}
    {dialog ? <LinkDialog key={dialog.link?.linkId || "new"} folder={folder} {...dialog} onClose={() => setDialog(null)} onSaved={reload} /> : null}
  </section>;
}
