import { motion, useReducedMotion } from "framer-motion";

const benefits = [
  {
    title: "Community Service",
    description:
      "Work on meaningful projects with schools, communities, NGOs, and local partners in Pune.",
  },
  {
    title: "Professional Development",
    description:
      "Learn through sessions, team leadership, public speaking, project planning, and real responsibility.",
  },
  {
    title: "Events and Fellowship",
    description:
      "Attend Rotaract events, General Body Meetings, cultural exchanges, flagship experiences, and district activities in Pune.",
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

export default function MembershipBenefits() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="join-section" aria-labelledby="membership-benefits-title">
      <motion.div
        className="join-section__heading"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <p className="join-kicker">Learn · Serve · Belong</p>
        <h2 id="membership-benefits-title">Why Join RCPH?</h2>
      </motion.div>

      <motion.div
        className="join-benefits-grid"
        variants={reduceMotion ? undefined : gridVariants}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.12 }}
      >
        {benefits.map((benefit, index) => (
          <motion.article
            className="join-benefit-card"
            key={benefit.title}
            variants={reduceMotion ? undefined : cardVariants}
          >
            <span aria-hidden="true">0{index + 1}</span>
            <h3>{benefit.title}</h3>
            <p>{benefit.description}</p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
