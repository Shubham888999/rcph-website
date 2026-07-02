import { motion } from "framer-motion";
import { getBodMemberAvenue, getBodMemberId, getInstagramProfile } from "./bodGridModel";

const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
};

const lineVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } },
};

export default function BodMemberDetails({ member, reduceMotion }) {
  const memberId = getBodMemberId(member);
  const detailId = `bod-member-details-${memberId}`;
  const titleId = `${detailId}-title`;
  const avenue = getBodMemberAvenue(member);
  const instagram = getInstagramProfile(member);

  return (
    <motion.section
      id={detailId}
      className="bod-member-details"
      aria-labelledby={titleId}
      aria-live="polite"
      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="bod-member-details__canvas"
        variants={reduceMotion ? undefined : contentVariants}
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "visible"}
      >
        <div className="bod-member-details__identity">
          <motion.p className="bod-member-details__eyebrow" variants={reduceMotion ? undefined : lineVariants}>Board profile</motion.p>
          <motion.h3 id={titleId} variants={reduceMotion ? undefined : lineVariants}>{member.name}</motion.h3>
          <motion.p className="bod-member-details__role" variants={reduceMotion ? undefined : lineVariants}>{member.role}</motion.p>
          {avenue ? <motion.p className="bod-member-details__avenue" variants={reduceMotion ? undefined : lineVariants}>{avenue}</motion.p> : null}
        </div>

        <div className="bod-member-details__story">
          <motion.p className="bod-member-details__responsibility" variants={reduceMotion ? undefined : lineVariants}>{member.responsibility}</motion.p>
          {member.bio ? <motion.p className="bod-member-details__bio" variants={reduceMotion ? undefined : lineVariants}>{member.bio}</motion.p> : null}
          {instagram ? (
            <motion.a
              className="bod-member-details__instagram"
              href={instagram.href}
              target="_blank"
              rel="noreferrer"
              variants={reduceMotion ? undefined : lineVariants}
            >
              Instagram · {instagram.label}
              <span aria-hidden="true">↗</span>
            </motion.a>
          ) : null}
        </div>
      </motion.div>
    </motion.section>
  );
}
