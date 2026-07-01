export default function DashboardSkeleton() {
  return (
    <section className="dashboard-loading" role="status" aria-live="polite">
      <p>Loading your protected club dashboard…</p>
      <div className="dashboard-skeleton" aria-hidden="true">
        <div className="dashboard-skeleton__masthead"><span /><span /><span /></div>
        <div className="dashboard-skeleton__feature"><span /><span /></div>
        <div className="dashboard-skeleton__rail"><span /><span /><span /><span /></div>
        <div className="dashboard-skeleton__ledger"><span /><span /><span /></div>
      </div>
    </section>
  );
}
