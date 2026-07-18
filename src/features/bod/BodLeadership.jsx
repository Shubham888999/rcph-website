import BodInteractiveGrid from "./BodInteractiveGrid";
import BodReveal from "./BodReveal";

export default function BodLeadership({
  members = [],
  kicker = "The team behind the year",
  title = "Club Leadership",
  statusLabel = "",
}) {
  return (
    <BodReveal
      className="bod-section-react"
      labelledBy="bod-leadership-title"
    >
      <div
        id="club-leadership"
        className="bod-section-react__anchor"
        aria-hidden="true"
      />

      <div className="bod-section-react__heading">
        <p className="bod-kicker">{kicker}</p>
        <div className="bod-section-react__heading-row">
          <h2 id="bod-leadership-title">{title}</h2>
          {statusLabel ? (
            <span className="bod-section-react__status">{statusLabel}</span>
          ) : null}
        </div>
      </div>

      <BodInteractiveGrid members={members} />
    </BodReveal>
  );
}
