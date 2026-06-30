import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

function getAccentCategory(role = "") {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole === "president") return "president";
  if (/vice president|secretary|treasurer|immediate past president/.test(normalizedRole)) return "executive";
  if (/website|editor|public relations/.test(normalizedRole)) return "digital";
  if (/service director|development director|diversity/.test(normalizedRole)) return "service";
  return "specialist";
}

export default function BodCard({ member, reduceMotion, council = false }) {
  const accentCategory = getAccentCategory(member.role);

  return (
    <motion.article
      className={`bod-card-react bod-card-react--${accentCategory} ${council ? "bod-card-react--council" : ""}`}
      variants={reduceMotion ? undefined : cardVariants}
    >
      <div className="bod-card-react__portrait">
        <img
          src={member.image}
          alt={`${member.name}, ${member.role} at Rotaract Club of Pune Heritage`}
          loading="lazy"
          decoding="async"
        />
        <span className="bod-card-react__portrait-shade" aria-hidden="true" />
      </div>
      <div className="bod-card-react__content">
        <p className="bod-card-react__role">{member.role}</p>
        <h3>{member.name}</h3>
        <span className="bod-card-react__accent" aria-hidden="true" />
        {member.context ? <p className="bod-card-react__context">{member.context}</p> : null}
        <div className="bod-card-react__details">
          <p className="bod-card-react__responsibility">{member.responsibility}</p>
          {member.bio ? <p className="bod-card-react__bio">{member.bio}</p> : null}
          {member.instagram ? (
            <div className="bod-card-react__profile-row">
              <span className="bod-card-react__profile-hint">Profile preview</span>
              <a href={member.instagram} target="_blank" rel="noreferrer">
                {member.handle}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
