import { motion, useReducedMotion } from "framer-motion";
import { boardMembers } from "./bodData";

const heroMembers = boardMembers.slice(0, 5);

export default function BodHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bod-hero-react" aria-labelledby="bod-page-title">
      <motion.div
        className="bod-hero-react__content"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.6,
          ease: "easeOut",
        }}
      >
        <div className="bod-hero-react__copy">
          <p className="bod-kicker">Leadership · RIY 2025-26</p>

          <h1 id="bod-page-title">Meet the Board</h1>

          <p className="bod-hero-react__description">
            The people leading Rotaract Club of Pune Heritage through service,
            fellowship, growth, and meaningful impact.
          </p>



          <a className="bod-hero-react__explore" href="#club-leadership">
            Explore the board
            <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="bod-hero-react__portraits" aria-label="Featured board members">
          {heroMembers.map((member, index) => (
            <motion.figure
              className={`bod-hero-react__portrait bod-hero-react__portrait--${index + 1}`}
              key={`${member.name}-${member.role}`}
              initial={reduceMotion ? false : { opacity: 1, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.5,
                delay: reduceMotion ? 0 : index * 0.06,
                ease: "easeOut",
              }}
            >
              <img
                src={member.image}
                alt=""
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />

              <figcaption>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </motion.div>
    </section>
  );
}