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

export default function MemberAnnouncements({ announcements }) {
  if (!announcements.length) return null;
  return (
    <section className="member-dashboard-section dashboard-announcements" aria-labelledby="announcements-title">
      <div className="dashboard-section-heading">
        <div><p className="auth-access-kicker">Updates</p><h2 id="announcements-title">Announcements</h2></div>
        <span>{announcements.length} active</span>
      </div>
      <div className="announcement-list">
        {announcements.map((announcement) => (
          <article key={announcement.id} className={"announcement-card announcement-card--" + announcement.priority}>
            <div><span>{announcement.priority}</span><span>{announcement.read ? "Read" : "Unread"}</span></div>
            <h3>{announcement.title}</h3>
            <p>{announcement.body}</p>
            {announcement.publishedAt ? <small>Published {formatDateTime(announcement.publishedAt)}</small> : null}
            {announcement.actionUrl ? <a href={announcement.actionUrl} target="_blank" rel="noopener noreferrer">{announcement.actionText}</a> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
