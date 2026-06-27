import { motion, useReducedMotion } from "framer-motion";

const options = [
  {
    title: "NGOs and Community Partners",
    description:
      "Partner with us for education initiatives, awareness sessions, donation drives, sustainability work, public health activities, and local service projects.",
  },
  {
    title: "Colleges and Students",
    description:
      "Invite RCPH for Rotaract orientation, volunteering opportunities, leadership activities, skill-building sessions, or awareness programs for students.",
  },
  {
    title: "Sponsors and Rotary Clubs",
    description:
      "Support service initiatives, flagship projects, district activities, and learning experiences that help young people create real community impact.",
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

export default function CollaborationOptions() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="contact-section" aria-labelledby="collaboration-title">
      <motion.div
        className="contact-section__heading"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <p className="contact-kicker">Ways to work together</p>
        <h2 id="collaboration-title">Collaboration Enquiries</h2>
      </motion.div>

      <motion.div
        className="contact-options-grid"
        variants={reduceMotion ? undefined : gridVariants}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.12 }}
      >
        {options.map((option, index) => (
          <motion.article
            className="contact-option-card"
            key={option.title}
            variants={reduceMotion ? undefined : cardVariants}
          >
            <span aria-hidden="true">0{index + 1}</span>
            <h3>{option.title}</h3>
            <p>{option.description}</p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
