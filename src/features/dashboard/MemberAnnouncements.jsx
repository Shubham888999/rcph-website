import { useEffect, useRef, useState } from "react";
import { fetchAnnouncementAttachment } from "./dashboardService";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatAttachmentSize(sizeBytes) {
  const value = Number(sizeBytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
}

function AnnouncementAttachment({ uid, announcement }) {
  const attachment = announcement.attachment;
  const [state, setState] = useState({ status: attachment?.kind === "image" ? "loading" : "idle", url: "", error: "" });

  useEffect(() => {
    if (!attachment || attachment.kind !== "image" || !uid) return undefined;
    let active = true;
    let objectUrl = "";
    fetchAnnouncementAttachment(uid, announcement.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", url: objectUrl, error: "" });
      })
      .catch(() => { if (active) setState({ status: "error", url: "", error: "Attachment unavailable" }); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [announcement.id, attachment, uid]);

  if (!attachment) return null;

  async function openAttachment(download = false) {
    try {
      const blob = await fetchAnnouncementAttachment(uid, announcement.id, { download });
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch {
      setState({ status: "error", url: "", error: "Attachment unavailable" });
    }
  }

  if (attachment.kind === "image") {
    return <div className="announcement-card__attachment">
      {state.status === "ready" ? <img src={state.url} alt={`${announcement.title} attachment`} loading="lazy" /> : <p>{state.error || "Loading attachment..."}</p>}
      <button type="button" disabled={!uid} onClick={() => openAttachment(false)}>View image</button>
    </div>;
  }

  return <div className="announcement-card__attachment announcement-card__attachment--pdf">
    <div><strong>Attached PDF</strong><span>{attachment.filename}</span><small>{formatAttachmentSize(attachment.sizeBytes)}</small></div>
    <div><button type="button" disabled={!uid} onClick={() => openAttachment(false)}>View PDF</button><button type="button" disabled={!uid} onClick={() => openAttachment(true)}>Download</button></div>
  </div>;
}

export default function MemberAnnouncements({ uid = "", announcements, busyId = "", onToggleRead, onDismiss }) {
  const [openId, setOpenId] = useState("");
  const menuRootRef = useRef(null);

  useEffect(() => {
    if (!openId) return undefined;
    function closeOnOutside(event) {
      if (!menuRootRef.current?.contains(event.target)) setOpenId("");
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpenId("");
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openId]);

  if (!announcements.length) return null;
  return (
    <section className="member-dashboard-section dashboard-announcements" aria-labelledby="announcements-title">
      <div className="dashboard-section-heading">
        <div><p className="auth-access-kicker">Updates</p><h2 id="announcements-title">Announcements</h2></div>
        <span>{announcements.length} active</span>
      </div>
      <div className="announcement-list">
        {announcements.map((announcement) => {
          const menuOpen = openId === announcement.id;
          const busy = busyId === announcement.id;
          return (
            <article key={announcement.id} className={`announcement-card announcement-card--${announcement.priority} ${announcement.read ? "is-read" : "is-unread"}`} aria-busy={busy}>
              <div className="announcement-card__topline">
                <div className="announcement-card__labels"><span>{announcement.priority}</span><span className="announcement-card__read-state">{announcement.read ? "Read" : "Unread"}</span></div>
                <div className="announcement-card__menu" ref={menuOpen ? menuRootRef : null}>
                  <button type="button" className="announcement-card__menu-trigger" aria-label="Announcement options" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={`announcement-menu-${announcement.id}`} disabled={busy} onClick={() => setOpenId(menuOpen ? "" : announcement.id)}>•••</button>
                  {menuOpen ? <div className="announcement-card__menu-panel" id={`announcement-menu-${announcement.id}`} role="menu">
                    <button type="button" role="menuitem" onClick={() => { setOpenId(""); onToggleRead?.(announcement); }}>{announcement.read ? "Mark as unread" : "Mark as read"}</button>
                    <button type="button" role="menuitem" onClick={() => { setOpenId(""); onDismiss?.(announcement); }}>Remove from dashboard</button>
                  </div> : null}
                </div>
              </div>
              <h3>{announcement.title}</h3>
              <p>{announcement.body}</p>
              <AnnouncementAttachment uid={uid} announcement={announcement} />
              <div className="announcement-card__footer">
                {announcement.publishedAt ? <small>Published {formatDateTime(announcement.publishedAt)}</small> : null}
                {announcement.actionUrl ? <a href={announcement.actionUrl} target="_blank" rel="noopener noreferrer">{announcement.actionText}</a> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
