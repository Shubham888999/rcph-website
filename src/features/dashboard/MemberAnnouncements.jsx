import { useEffect, useRef, useState } from "react";

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

export default function MemberAnnouncements({ announcements, busyId = "", onToggleRead, onDismiss }) {
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
