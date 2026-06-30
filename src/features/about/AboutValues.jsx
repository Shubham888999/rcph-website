import AboutReveal from "./AboutReveal";

const values = [
  {
    title: "Create",
    description:
      "This stands for innovation, leadership, and fresh ideas. As Rotaractors, we are creators of change—building impactful projects, nurturing team spirit, and shaping a better future through creativity and purpose.",
  },
  {
    title: "Connect",
    description:
      "At the heart of Rotaract lie strong connections: bonding with fellow club members, collaborating with other clubs, forming ties with our Rotary family, and engaging with the community. Every connection strengthens our impact.",
  },
  {
    title: "Contribute",
    description:
      "Our ultimate goal is to give back—to society, to our club, and to ourselves. Whether it is time, effort, knowledge, or service, every contribution matters. Together, we make a difference.",
  },
];

export default function AboutValues() {
  return (
    <AboutReveal className="about-section" labelledBy="about-theme-title">
      <div className="about-theme-header">
        <div className="about-theme-header__mark" aria-hidden="true">
          <img src="/images/logo3.webp" alt="" loading="lazy" decoding="async" />
        </div>
        <div>
          <p className="about-kicker">Create · Connect · Contribute</p>
          <h2 id="about-theme-title">About This Year’s Theme</h2>
        </div>
      </div>

      <div className="about-values-grid">
        {values.map((value, index) => (
          <article className="about-value-card" key={value.title}>
            <span aria-hidden="true">0{index + 1}</span>
            <h3>{value.title}</h3>
            <p>{value.description}</p>
          </article>
        ))}
      </div>
    </AboutReveal>
  );
}
