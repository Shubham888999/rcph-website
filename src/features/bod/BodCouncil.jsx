import BodGrid from "./BodGrid";
import BodReveal from "./BodReveal";
import { councilGroups } from "./bodData";

export default function BodCouncil() {
  return (
    <BodReveal className="bod-section-react" labelledBy="bod-council-title">
      <div className="bod-section-react__heading">
        <p className="bod-kicker">Leadership beyond the club</p>
        <h2 id="bod-council-title">Council Members</h2>
      </div>

      <div className="bod-council-groups">
        {councilGroups.map((group) => (
          <section key={group.title} aria-labelledby={`bod-${group.title.toLowerCase().replaceAll(" ", "-")}`}>
            <h3 id={`bod-${group.title.toLowerCase().replaceAll(" ", "-")}`}>{group.title}</h3>
            <BodGrid members={group.members} council />
          </section>
        ))}
      </div>
    </BodReveal>
  );
}
