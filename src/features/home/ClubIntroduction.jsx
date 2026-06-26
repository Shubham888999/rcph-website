import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function ClubIntroduction() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-introduction"
      aria-labelledby="club-introduction-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div className="home-section__heading">
        <p className="home-kicker">Who we are</p>
        <h2 id="club-introduction-title">Rotaract Club of Pune Heritage in Pune</h2>
      </div>

      <div className="home-introduction__copy">
        <p>
          Rotaract Club of Pune Heritage, or RCPH, is a community-based Rotaract
          club in Pune under Rotaract District 3131, Zone 4. We bring together
          students and young professionals who want to do more than just attend
          events — we plan projects, learn together, build friendships, and
          serve the community.
        </p>
        <p>
          From education drives and awareness sessions to fellowships, district
          events, professional development activities, and collaborations with
          Rotary, RCPH gives members a space to create, connect, and contribute
          in a meaningful way.
        </p>
        <p className="home-inline-links">
          <Link to="/join">Join the club</Link>
          <Link to="/projects">Explore projects</Link>
          <Link to="/faq">Read the FAQ</Link>
        </p>
      </div>
    </motion.section>
  );
}
