import { useCallback, useEffect, useState } from "react";
import DashboardErrorState from "../../features/dashboard/DashboardErrorState";
import DashboardHeader from "../../features/dashboard/DashboardHeader";
import DashboardSkeleton from "../../features/dashboard/DashboardSkeleton";
import MemberAnnouncements from "../../features/dashboard/MemberAnnouncements";
import MemberResolutions from "../../features/dashboard/MemberResolutions";
import MemberOverview from "../../features/dashboard/MemberOverview";
import { canRequestDashboard } from "../../features/dashboard/accessHubModel";
import {
  clearDashboardDataCache,
  dismissDashboardAnnouncement,
  getAnnouncementMutationErrorMessage,
  markDashboardAnnouncementRead,
  markDashboardAnnouncementUnread,
} from "../../features/dashboard/dashboardService";
import useDashboardData from "../../features/dashboard/useDashboardData";
import { getResolutionErrorMessage, loadMyOpenResolutions, submitResolutionVote } from "../../features/resolutions/resolutionService";
import ProspectProgress from "../../features/prospect/ProspectProgress";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/member-dashboard.css";

export default function DashboardPage() {
  const { access, user, signOut } = useAuth();
  const enabled = canRequestDashboard(user?.uid, access);
  const { status, data, reload, updateAnnouncements, updateOpenResolutions } = useDashboardData({ uid: user?.uid || "", enabled });
  const [announcementBusyId, setAnnouncementBusyId] = useState("");
  const [resolutionBusyId, setResolutionBusyId] = useState("");
  const [dashboardNotice, setDashboardNotice] = useState(null);

  const refreshOpenResolutions = useCallback(async () => {
    if (!user?.uid || !enabled) return;
    try { updateOpenResolutions(await loadMyOpenResolutions(user.uid)); } catch { /* The full dashboard remains usable; the next controlled refresh retries. */ }
  }, [enabled, updateOpenResolutions, user]);

  useEffect(() => {
    if (!enabled || !user?.uid) return undefined;
    const timer = window.setInterval(refreshOpenResolutions, 20000);
    return () => window.clearInterval(timer);
  }, [enabled, refreshOpenResolutions, user?.uid]);

  async function handleSignOut() {
    clearDashboardDataCache(user?.uid);
    await signOut();
  }

  async function updateReadState(announcement) {
    if (!user?.uid || announcementBusyId) return;
    const previous = data.announcements;
    const nextRead = !announcement.read;
    setAnnouncementBusyId(announcement.id);
    setDashboardNotice(null);
    updateAnnouncements((current) => current.map((item) => item.id === announcement.id ? { ...item, read: nextRead } : item));
    try {
      if (nextRead) await markDashboardAnnouncementRead(user.uid, announcement.id);
      else await markDashboardAnnouncementUnread(user.uid, announcement.id);
    } catch {
      updateAnnouncements(previous);
      setDashboardNotice({ type: "error", message: getAnnouncementMutationErrorMessage() });
    } finally {
      setAnnouncementBusyId("");
    }
  }

  async function dismissAnnouncement(announcement) {
    if (!user?.uid || announcementBusyId) return;
    const previous = data.announcements;
    setAnnouncementBusyId(announcement.id);
    setDashboardNotice(null);
    updateAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
    try {
      await dismissDashboardAnnouncement(user.uid, announcement.id);
      setDashboardNotice({ type: "success", message: "Announcement removed from your dashboard." });
    } catch {
      updateAnnouncements(previous);
      setDashboardNotice({ type: "error", message: getAnnouncementMutationErrorMessage() });
    } finally {
      setAnnouncementBusyId("");
    }
  }

  async function voteOnResolution(resolution, choice) {
    if (!user?.uid || resolutionBusyId) return;
    const previous = data.openResolutions;
    const optimisticTime = new Date().toISOString();
    setResolutionBusyId(resolution.id);
    setDashboardNotice(null);
    updateOpenResolutions((current) => current.map((item) => item.id === resolution.id ? { ...item, currentVote: choice, submittedAt: item.submittedAt || optimisticTime, voteUpdatedAt: optimisticTime } : item));
    try {
      const vote = await submitResolutionVote(user.uid, resolution.id, choice);
      updateOpenResolutions((current) => current.map((item) => item.id === resolution.id ? { ...item, currentVote: vote.choice, submittedAt: vote.submittedAt, voteUpdatedAt: vote.updatedAt } : item));
      setDashboardNotice({ type: "success", message: `Your ${choice} vote was recorded.` });
    } catch (error) {
      updateOpenResolutions(previous);
      setDashboardNotice({ type: "error", message: getResolutionErrorMessage(error) });
      refreshOpenResolutions();
    } finally {
      setResolutionBusyId("");
    }
  }

  if (status === "loading" || status === "idle") {
    return <main className="member-dashboard-page"><DashboardSkeleton /></main>;
  }
  if (status === "error") {
    return <main className="member-dashboard-page"><DashboardErrorState onRetry={reload} onSignOut={handleSignOut} /></main>;
  }

  const prospect = data.mode === "prospect";
  return (
    <main className="member-dashboard-page">
      <div className="member-dashboard-shell">
        <DashboardHeader
          profile={data.profile}
          mode={data.mode}
          access={access}
          onSignOut={handleSignOut}
        />
        {dashboardNotice ? <div className={`dashboard-announcement-notice dashboard-announcement-notice--${dashboardNotice.type}`} role={dashboardNotice.type === "error" ? "alert" : "status"} aria-live="polite"><span>{dashboardNotice.message}</span><button type="button" onClick={() => setDashboardNotice(null)} aria-label="Dismiss dashboard notice">×</button></div> : null}
        <MemberAnnouncements announcements={data.announcements} busyId={announcementBusyId} onToggleRead={updateReadState} onDismiss={dismissAnnouncement} />
        <MemberResolutions resolutions={data.openResolutions} busyId={resolutionBusyId} onVote={voteOnResolution} onRefresh={refreshOpenResolutions} />
        {prospect ? <ProspectProgress data={data} /> : <MemberOverview data={data} />}
      </div>
    </main>
  );
}
