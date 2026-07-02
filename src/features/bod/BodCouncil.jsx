import BodReveal from "./BodReveal";
import CouncilInteractiveGrid from "./CouncilInteractiveGrid";
import { councilGroups } from "./bodData";
import { getCouncilMembers } from "./councilGridModel";

const councilMembers = getCouncilMembers(councilGroups);

export default function BodCouncil() {
  return (
    <BodReveal className="bod-section-react" labelledBy="bod-council-title">
      <div className="bod-section-react__heading">
        <p className="bod-kicker">Leadership beyond the club</p>
        <h2 id="bod-council-title">Council Members</h2>
      </div>

      <CouncilInteractiveGrid members={councilMembers} />
    </BodReveal>
  );
}
