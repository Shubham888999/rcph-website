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
      <h2 id="club-introduction-title">
        Rotaract Club of Pune Heritage
      </h2>

      <div className="home-introduction__copy">
        <p>
          <strong>Rotaract Club of Pune Heritage</strong>, or RCPH, is a
          community-based Rotaract club in Pune under{" "}
          <strong>Rotaract District 3131, Zone 4</strong>. We bring together
          students and young professionals who want to do more than just attend
          events - we plan projects, learn together, build friendships, and
          serve the community.
        </p>

        <p>
          From education drives and awareness sessions to fellowships, district
          events, professional development activities, and collaborations with
          Rotary, RCPH gives members a space to create, connect, and contribute
          in a meaningful way. If you are looking to volunteer, collaborate, or
          join a youth-led service club in Pune, start with our{" "}
          <Link to="/join">Join page</Link>, explore our{" "}
          <Link to="/projects">projects</Link>, or read the{" "}
          <Link to="/faq">RCPH FAQ</Link>.
        </p>
      </div>
    </motion.section>
  );
}