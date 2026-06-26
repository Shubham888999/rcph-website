import { Link } from "react-router-dom";
import AboutReveal from "./AboutReveal";

export default function AboutClubStory() {
  return (
    <AboutReveal className="about-section about-story" labelledBy="about-story-title">
      <div className="about-section__heading">
        <p className="about-kicker">Since 2015</p>
        <h2 id="about-story-title">A club built to serve, lead, and belong</h2>
      </div>

      <div className="about-story__copy">
        <p>
          Chartered in 2015, the Rotaract Club of Pune Heritage is sponsored by
          the Rotary Club of Pune Heritage under RID 3131. Since then, RCPH has
          grown as a space for young people in Pune to serve, lead, learn, and
          build lasting friendships.
        </p>
        <p>
          Our Charter President, Rtr. Parth Jaokar, went on to serve as the
          District Rotaract Representative (DRR) of RI District 3131 for Rotary
          Year 2021–22—a proud milestone in the club’s journey.
        </p>
        <p>
          Over the years, the club has built its identity through service
          projects, fellowship, leadership opportunities, and a strong
          connection with the Rotary family.
        </p>
        <nav className="about-inline-links" aria-label="Explore RCPH">
          <Link to="/bod">Meet the Board of Directors</Link>
          <Link to="/projects">Explore RCPH projects</Link>
          <Link to="/faq">Read the official FAQ</Link>
          <Link to="/contact">Collaborate with us</Link>
        </nav>
      </div>
    </AboutReveal>
  );
}
