import BodInteractiveGrid from "./BodInteractiveGrid";
import BodReveal from "./BodReveal";
import { boardMembers } from "./bodData";

export default function BodLeadership() {
  return (
    <BodReveal className="bod-section-react" labelledBy="bod-leadership-title">
      <div
        id="club-leadership"
        className="bod-section-react__anchor"
        aria-hidden="true"
      />

      <div className="bod-section-react__heading">
        <p className="bod-kicker">The team behind the year</p>
        <h2 id="bod-leadership-title">Club Leadership</h2>
      </div>

      <BodInteractiveGrid members={boardMembers} />
    </BodReveal>
  );
}
