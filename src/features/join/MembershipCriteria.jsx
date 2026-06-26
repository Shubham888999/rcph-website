import JoinReveal from "./JoinReveal";

export default function MembershipCriteria() {
  return (
    <JoinReveal className="join-section join-criteria" labelledBy="join-criteria-title">
      <div className="join-section__heading">
        <p className="join-kicker">Membership at RCPH</p>
        <h2 id="join-criteria-title">Who Can Join?</h2>
      </div>
      <div className="join-criteria__copy">
        <p>
          If you are a student or young professional in Pune and want to be part
          of service projects, events, friendships, and leadership opportunities,
          you can explore membership with RCPH.
        </p>
        <p>
          Rotaract is for people who want to learn outside the classroom and
          contribute beyond their routine.
        </p>
      </div>
    </JoinReveal>
  );
}
