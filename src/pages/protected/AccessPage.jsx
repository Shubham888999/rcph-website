import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import MemberAnnouncements from "../../features/dashboard/MemberAnnouncements";
import {
  canRequestDashboard,
  getAccessHubViewModel,
} from "../../features/dashboard/accessHubModel";
import {
  clearDashboardDataCache,
  dismissDashboardAnnouncement,
  getAnnouncementMutationErrorMessage,
  markDashboardAnnouncementRead,
  markDashboardAnnouncementUnread,
} from "../../features/dashboard/dashboardService";
import useDashboardData from "../../features/dashboard/useDashboardData";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/auth-access.css";
import "../../styles/components/access-hub.css";
import ProspectWhatsAppGroup from "../../features/prospect/ProspectWhatsAppGroup";
import { formatRotaractorName } from "../../utils/memberName";
import "../../styles/components/member-dashboard.css";

const revealItem = {
  hidden: { opacity: 1, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.46, ease: [0.22, 1, 0.36, 1] } },
};

export default function AccessPage() {
  const { access, user, signOut } = useAuth();
  const reduceMotion = useReducedMotion();
  const profile = access?.user || {};
  const displayName = formatRotaractorName(profile.name || user?.displayName || user?.email || "RCPH Member", profile);
  const email = profile.email || user?.email || "";
  const hub = getAccessHubViewModel(access);
  const isProspect = access?.canAccessProspectDashboard === true;
const announcementsEnabled = canRequestDashboard(
  user?.uid,
  access,
);

const {
  status: dashboardStatus,
  data: dashboardData,
  updateAnnouncements,
} = useDashboardData({
  uid: user?.uid || "",
  enabled: announcementsEnabled,
});

const [announcementBusyId, setAnnouncementBusyId] =
  useState("");

const [announcementNotice, setAnnouncementNotice] =
  useState(null);

const accessAnnouncements =
  dashboardStatus === "success"
    ? dashboardData?.announcements || []
    : [];
  async function handleSignOut() {
    clearDashboardDataCache(user?.uid);
    await signOut();
  }
async function updateAnnouncementReadState(announcement) {
  if (announcement?.dismissible === false) return;

  if (
    !user?.uid
    || announcementBusyId
    || dashboardStatus !== "success"
  ) {
    return;
  }

  const previous = accessAnnouncements;
  const nextRead = !announcement.read;

  setAnnouncementBusyId(announcement.id);
  setAnnouncementNotice(null);

  updateAnnouncements((current) =>
    current.map((item) =>
      item.id === announcement.id
        ? { ...item, read: nextRead }
        : item
    )
  );

  try {
    if (nextRead) {
      await markDashboardAnnouncementRead(
        user.uid,
        announcement.id,
      );
    } else {
      await markDashboardAnnouncementUnread(
        user.uid,
        announcement.id,
      );
    }
  } catch {
    updateAnnouncements(previous);

    setAnnouncementNotice({
      type: "error",
      message: getAnnouncementMutationErrorMessage(),
    });
  } finally {
    setAnnouncementBusyId("");
  }
}

async function dismissAccessAnnouncement(announcement) {
  if (announcement?.dismissible === false) return;

  if (
    !user?.uid
    || announcementBusyId
    || dashboardStatus !== "success"
  ) {
    return;
  }

  const previous = accessAnnouncements;

  setAnnouncementBusyId(announcement.id);
  setAnnouncementNotice(null);

  updateAnnouncements((current) =>
    current.filter(
      (item) => item.id !== announcement.id
    )
  );

  try {
    await dismissDashboardAnnouncement(
      user.uid,
      announcement.id,
    );

    setAnnouncementNotice({
      type: "success",
      message:
        "Announcement removed from your Dashboard and Access Hub.",
    });
  } catch {
    updateAnnouncements(previous);

    setAnnouncementNotice({
      type: "error",
      message: getAnnouncementMutationErrorMessage(),
    });
  } finally {
    setAnnouncementBusyId("");
  }
}
  return (
    <main className="auth-access-page access-command-page">
      <motion.section
        className="access-hub"
        aria-labelledby="access-hub-title"
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      >
        <header className="access-hub__masthead">
          <div className="access-hub__identity">
            <motion.p className="access-hub__eyebrow" variants={reduceMotion ? undefined : revealItem}>Rotaract Club of Pune Heritage</motion.p>
            <motion.h1 id="access-hub-title" variants={reduceMotion ? undefined : revealItem}>
              <span className="access-hub__welcome-line">Welcome,</span>
              <span className="access-hub__member-name">{displayName}</span>
            </motion.h1>
            {email ? <motion.p className="access-hub__email" variants={reduceMotion ? undefined : revealItem}>{email}</motion.p> : null}
            <motion.p className="access-hub__intro" variants={reduceMotion ? undefined : revealItem}>Choose where you want to continue.</motion.p>
          </div>
          <motion.div className="access-hub__actions" variants={reduceMotion ? undefined : revealItem}>
            <button className="auth-signout-button" type="button" onClick={handleSignOut}>Sign out</button>
          </motion.div>
          <motion.span className="access-hub__rule" aria-hidden="true" variants={reduceMotion ? undefined : { hidden: { scaleX: 0.12 }, visible: { scaleX: 1, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } } }} />
        </header>

        <motion.dl className="access-hub__summary" aria-label="Trusted account access summary" variants={reduceMotion ? undefined : revealItem}>
          <div><dt>Role</dt><dd>{hub.role}</dd></div>
          <div><dt>Approved positions</dt><dd>{hub.positionSummary}</dd></div>
          <div><dt>Account access</dt><dd>{hub.capabilitySummary}</dd></div>
        </motion.dl>

        {hub.hasDelegatedWebsiteAuthority ? (
          <motion.p className="access-hub__authority" variants={reduceMotion ? undefined : revealItem}>
            Administrative access is available through server-verified Website Director authority. Your approved role remains {hub.role}.
          </motion.p>
        ) : null}

        {hub.hasSergeantAdminAuthority ? (
          <motion.p className="access-hub__authority" variants={reduceMotion ? undefined : revealItem}>
            Administrative access is available through your active Sergeant-at-Arms assignment. Your approved role remains {hub.role}.
          </motion.p>
        ) : null}

        {hub.destinations.length ? null : (
          <motion.section className="access-hub__unavailable" variants={reduceMotion ? undefined : revealItem}>
            <h2>No dashboard destination available</h2>
            <p>Your trusted account is approved, but no personal dashboard capability is currently available.</p>
          </motion.section>
        )}

{isProspect ? (
  <motion.div
    className="access-hub__prospect-whatsapp"
    variants={reduceMotion ? undefined : revealItem}
  >
    <ProspectWhatsAppGroup />
  </motion.div>
) : null}

{announcementNotice || accessAnnouncements.length ? (
  <motion.div
    className="access-hub__announcements"
    variants={reduceMotion ? undefined : revealItem}
  >
    {announcementNotice ? (
      <div
        className={`dashboard-announcement-notice dashboard-announcement-notice--${announcementNotice.type}`}
        role={
          announcementNotice.type === "error"
            ? "alert"
            : "status"
        }
        aria-live="polite"
      >
        <span>{announcementNotice.message}</span>

        <button
          type="button"
          onClick={() => setAnnouncementNotice(null)}
          aria-label="Dismiss announcement notice"
        >
          ×
        </button>
      </div>
    ) : null}

    <MemberAnnouncements
      uid={user?.uid || ""}
      announcements={accessAnnouncements}
      busyId={announcementBusyId}
      onToggleRead={updateAnnouncementReadState}
      onDismiss={dismissAccessAnnouncement}
    />
  </motion.div>
) : null}

<nav
  className="access-hub__destinations"
  aria-labelledby="access-destinations-title"
>
          <motion.header variants={reduceMotion ? undefined : revealItem}>
            <p className="access-hub__eyebrow">Available areas</p>
            <h2 id="access-destinations-title">Continue through RCPH</h2>
          </motion.header>
          <motion.ul variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
            {hub.destinations.map((destination) => (
              <motion.li
                key={destination.key}
                className={destination.fullWidth ? "access-hub__destination--full" : undefined}
                variants={reduceMotion ? undefined : revealItem}
              >
                <Link to={destination.href}>
                  <span className="access-hub__destination-meta">{destination.category}</span>
                  <span className="access-hub__destination-copy">
                    <strong>{destination.title}</strong>
                    <span>{destination.description}</span>
                  </span>
                  <span className="access-hub__destination-action" aria-hidden="true">→</span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </nav>

        <motion.footer className="access-hub__footer" variants={reduceMotion ? undefined : revealItem}>
          <p>Only areas granted by your trusted RCPH access are shown here.</p>
          <Link to="/contact">Questions about access? Contact RCPH</Link>
        </motion.footer>
      </motion.section>
    </main>
  );
}
