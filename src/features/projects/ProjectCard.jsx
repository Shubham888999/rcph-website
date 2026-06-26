import { motion } from "framer-motion";

const projectCardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function ProjectCard({ project, reduceMotion }) {
  return (
    <motion.article
      className="projects-card"
      variants={reduceMotion ? undefined : projectCardVariants}
    >
      <div className="projects-card__image">
        <img
          src={project.image}
          alt={project.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="projects-card__content">
        <p className="projects-card__avenue">{project.avenue}</p>
        <h3>{project.title}</h3>
        <p>{project.description}</p>
      </div>
    </motion.article>
  );
}
