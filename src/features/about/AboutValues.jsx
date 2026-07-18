import AboutReveal from "./AboutReveal";

const values = [
  {
    title: "Aim",
    description:
      "Lakshya begins with clarity. Members learn to set direction, focus their energy, and turn shared intent into purposeful club action.",
  },
  {
    title: "Experience",
    description:
      "The theme is shaped through participation: planning, leading, collaborating, serving, and growing through real Rotaract experiences.",
  },
  {
    title: "Impact",
    description:
      "Every project, meeting, and fellowship moment should move toward meaningful service, stronger friendships, and a more capable club.",
  },
];

export default function AboutValues() {
  return (
    <AboutReveal className="about-section" labelledBy="about-theme-title">
      <div className="about-theme-header">
        <div className="about-theme-header__mark" aria-hidden="true">
          <img src="/images/rcph-lakshya-logo.webp" alt="" loading="lazy" decoding="async" />
        </div>
        <div>
          <p className="about-kicker">Lakshya · RIY 2026–27</p>
          <h2 id="about-theme-title">Shaping Aim Through Experience</h2>
        </div>
      </div>

      <div className="about-values-grid">
        {values.map((value) => (
          <article className="about-value-card" key={value.title}>
            <h3>{value.title}</h3>
            <p>{value.description}</p>
          </article>
        ))}
      </div>
    </AboutReveal>
  );
}
