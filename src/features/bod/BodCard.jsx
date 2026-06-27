import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function BodCard({ member, reduceMotion, council = false }) {
  return (
    <motion.article
      className={`bod-card-react ${council ? "bod-card-react--council" : ""}`}
      variants={reduceMotion ? undefined : cardVariants}
    >
      <div className="bod-card-react__portrait">
        <img
          src={member.image}
          alt={`${member.name}, ${member.role} at Rotaract Club of Pune Heritage`}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="bod-card-react__content">
        <p className="bod-card-react__role">{member.role}</p>
        <h3>{member.name}</h3>
        {member.context ? <p className="bod-card-react__context">{member.context}</p> : null}
        {member.bio ? <p className="bod-card-react__bio">{member.bio}</p> : null}
        {member.instagram ? (
          <a href={member.instagram} target="_blank" rel="noreferrer">
            {member.handle}
          </a>
        ) : null}
      </div>
    </motion.article>
  );
}
