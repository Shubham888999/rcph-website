import { motion, useReducedMotion } from "framer-motion";

const avenues = [
  {
    title: "Community Service",
    description: "Service projects and collaborations that address local needs in Pune.",
  },
  {
    title: "Professional Development",
    description: "Skill-building sessions, leadership training, and career-focused learning for young adults.",
  },
  {
    title: "Club Service and Fellowship",
    description: "Meetups, General Body Meetings, cultural exchanges, and member-bonding experiences.",
  },
];

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function EventAvenues() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="events-section-react" aria-labelledby="event-avenues-title">
      <div className="events-section-react__heading">
        <p className="events-kicker">The avenues we serve</p>
        <h2 id="event-avenues-title">Avenue-wise Events</h2>
        <p>RCPH events span service, learning, fellowship, and district participation.</p>
      </div>
      <motion.div
        className="event-avenues-grid"
        variants={reduceMotion ? undefined : gridVariants}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.12 }}
      >
        {avenues.map((avenue) => (
          <motion.article
            className="event-avenue-card"
            key={avenue.title}
            variants={reduceMotion ? undefined : cardVariants}
          >
            <h3>{avenue.title}</h3>
            <p>{avenue.description}</p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
