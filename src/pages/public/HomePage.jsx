import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <p className="eyebrow">Rotaract Club of Pune Heritage</p>
          <h1>The new RCPH experience starts here.</h1>
          <p className="hero-copy">
            This is the first React foundation for the existing RCPH public
            website and internal member platform.
          </p>

          <div className="button-row">
            <Link className="button button-primary" to="/login">
              Open login
            </Link>
            <a
              className="button button-secondary"
              href="https://rcph3131.org/"
              target="_blank"
              rel="noreferrer"
            >
              View current website
            </a>
          </div>
        </motion.div>

        <motion.div
          className="milestone-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.12 }}
        >
          <p className="eyebrow">Foundation milestone</p>
          <h2>React shell active</h2>
          <ul>
            <li>Vite and React installed</li>
            <li>React Router configured</li>
            <li>Firebase SDK installed</li>
            <li>Protected routes prepared</li>
          </ul>
        </motion.div>
      </section>
    </main>
  );
}
