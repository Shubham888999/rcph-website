import BodReveal from "./BodReveal";
import CouncilInteractiveGrid from "./CouncilInteractiveGrid";

export default function BodCouncil({
  members = [],
  title = "Leadership Beyond Our Club",
  statusLabel = "",
  editorial = false,
}) {
  return (
    <BodReveal
      className="bod-section-react"
      labelledBy="bod-council-title"
    >
      <div className="bod-section-react__heading">
        <div className="bod-section-react__heading-row">
          <h2 id="bod-council-title">
            {title}
          </h2>
          {statusLabel ? (
            <span className="bod-section-react__status">{statusLabel}</span>
          ) : null}
        </div>
      </div>

      <CouncilInteractiveGrid members={members} editorial={editorial} />
    </BodReveal>
  );
}
