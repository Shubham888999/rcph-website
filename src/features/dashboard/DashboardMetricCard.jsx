export default function DashboardMetricCard({ label, value, detail }) {
  return (
    <article className="member-metric-card">
      <span>{label}</span>
      <strong>{value ?? "Unavailable"}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}
