import DashboardErrorState from "../../features/dashboard/DashboardErrorState";
import DashboardHeader from "../../features/dashboard/DashboardHeader";
import DashboardSkeleton from "../../features/dashboard/DashboardSkeleton";
import MemberAnnouncements from "../../features/dashboard/MemberAnnouncements";
import MemberOverview from "../../features/dashboard/MemberOverview";
import { canRequestDashboard } from "../../features/dashboard/accessHubModel";
import { clearDashboardDataCache } from "../../features/dashboard/dashboardService";
import useDashboardData from "../../features/dashboard/useDashboardData";
import ProspectProgress from "../../features/prospect/ProspectProgress";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/member-dashboard.css";

export default function DashboardPage() {
  const { access, user, signOut } = useAuth();
  const enabled = canRequestDashboard(user?.uid, access);
  const { status, data, reload } = useDashboardData({ uid: user?.uid || "", enabled });

  async function handleSignOut() {
    clearDashboardDataCache(user?.uid);
    await signOut();
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
          title={prospect ? "My Dashboard" : "My RCPH Dashboard"}
          subtitle={prospect ? "Your verified Prospect membership journey." : "Your server-authorized member overview."}
          onSignOut={handleSignOut}
        />
        <MemberAnnouncements announcements={data.announcements} />
        {prospect ? <ProspectProgress data={data} /> : <MemberOverview data={data} />}
      </div>
    </main>
  );
}
