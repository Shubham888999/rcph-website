import BodBookGrid from "./BodBookGrid.jsx";
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

      {editorial ? <BodBookGrid members={members} section="club" /> : <BodInteractiveGrid members={members} />}
    </BodReveal>
  );
}
