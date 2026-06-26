import AboutReveal from "./AboutReveal";

export default function AboutMessages() {
  return (
    <>
      <AboutReveal className="about-section" labelledBy="about-rotary-title">
        <div className="about-network-grid">
          <article className="about-network-card">
            <p className="about-kicker">A global family</p>
            <h2 id="about-rotary-title">About Rotary</h2>
            <p>
              Rotary is a global network of <strong>1.4 million passionate individuals</strong>
              {" "}from over 200 countries committed to creating lasting change in their
              communities and around the world. Founded in 1905, Rotary focuses on
              key areas like <strong>peacebuilding, disease prevention, clean water,
              education</strong>, and <strong>community development</strong>.
            </p>
          </article>

          <article className="about-network-card">
            <p className="about-kicker">Young leaders in action</p>
            <h2>About Rotaract</h2>
            <p>
              Rotaract is the youth wing of Rotary for individuals aged 18 and
              above. It empowers young leaders to take action through service,
              professional development, and fellowship. Rotaract clubs are either
              community or university-based and work closely with local Rotary clubs.
            </p>
          </article>
        </div>
      </AboutReveal>

      <AboutReveal className="about-section" labelledBy="about-contact-title">
        <div className="about-contact-card">
          <div>
            <p className="about-kicker">Start a conversation</p>
            <h2 id="about-contact-title">Contact Us</h2>
            <p>Connect with the club to join, volunteer, or collaborate.</p>
          </div>

          <div className="about-leadership">
            <div>
              <h3>Rtr. Aneesh Ladkat</h3>
              <p>President</p>
            </div>
            <div>
              <h3>Rtr. Avani Joshi</h3>
              <p>Club Service Director</p>
            </div>
          </div>

          <address className="about-contact-links">
            <a href="tel:+919175935956">+91 91759 35956</a>
            <a href="mailto:rcpuneheritage3131@gmail.com">
              rcpuneheritage3131@gmail.com
            </a>
            <a
              href="https://instagram.com/rc_pune_heritage/"
              target="_blank"
              rel="noreferrer"
            >
              @rc_pune_heritage
            </a>
          </address>
        </div>
      </AboutReveal>
    </>
  );
}
