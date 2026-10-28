import BodInteractiveGrid from "./BodInteractiveGrid";
import BodReveal from "./BodReveal";

export default function BodLeadership({
  members = [],
  editorial = false,
}) {
  return (
    <BodReveal
      staticContent={editorial}
      className="bod-section-react bod-leadership-react"
      labelledBy="bod-page-title"
    >
      <div
        id="club-leadership"
        className="bod-section-react__anchor"
        aria-hidden="true"
      />

      <BodInteractiveGrid members={members} editorial={editorial} />
    </BodReveal>
  );
}
