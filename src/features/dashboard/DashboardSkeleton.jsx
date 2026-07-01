export default function DashboardSkeleton() {
  return (
    <section className="dashboard-loading" role="status" aria-live="polite">
      <p>Loading your dashboard...</p>
      <div className="dashboard-skeleton-grid" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
    </section>
  );
}
