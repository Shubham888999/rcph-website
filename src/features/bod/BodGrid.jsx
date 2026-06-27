import { motion, useReducedMotion } from "framer-motion";
import BodCard from "./BodCard";

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

export default function BodGrid({ members, council = false }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`bod-grid-react ${council ? "bod-grid-react--council" : ""}`}
      variants={reduceMotion ? undefined : gridVariants}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.04 }}
    >
      {members.map((member) => (
        <BodCard
          key={`${member.name}-${member.role}`}
          member={member}
          reduceMotion={reduceMotion}
          council={council}
        />
      ))}
    </motion.div>
  );
}
