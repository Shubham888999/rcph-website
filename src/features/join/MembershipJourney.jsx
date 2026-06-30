import JoinReveal from "./JoinReveal";

const steps = [
  {
    title: "Explore the club",
    description:
      "Learn about RCPH’s service projects, events, friendships, and leadership opportunities.",
  },
  {
    title: "Get your questions answered",
    description:
      "Use the Contact page or RCPH FAQ to ask about membership, volunteering, collaboration, and website access.",
  },
  {
    title: "Access your member account",
    description:
      "Club members can continue to the existing member account and login area.",
  },
];

export default function MembershipJourney() {
  return (
    <JoinReveal className="join-section" labelledBy="membership-journey-title">
      <div className="join-section__heading">
        <p className="join-kicker">Your next steps</p>
        <h2 id="membership-journey-title">How to Apply or Volunteer</h2>
      </div>

      <ol className="join-journey-list">
        {steps.map((step) => (
          <li key={step.title}>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </JoinReveal>
  );
}
