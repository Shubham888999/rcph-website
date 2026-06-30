export default function BodToolsSkeleton() {
  return <section className="bod-tools-skeleton" role="status" aria-live="polite" aria-label="Loading BOD submissions"><p>Loading BOD submissions…</p><div className="bod-event-grid">{[0, 1, 2].map((key) => <div className="bod-skeleton-card" key={key} />)}</div></section>;
}
