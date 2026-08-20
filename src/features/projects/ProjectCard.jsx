import { useId } from "react";
import { motion } from "framer-motion";

const projectCardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45 },
  },
};

export default function ProjectCard({
  project,
  reduceMotion,
  isExpanded,
  onToggle,
}) {
  const descriptionId = useId();

  return (
    <motion.article
      className={`projects-card${
        isExpanded ? " projects-card--expanded" : ""
      }`}
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

        <p
          id={descriptionId}
          className="projects-card__description"
        >
          {project.description}
        </p>
      </div>

      <button
        className="projects-card__toggle"
        type="button"
        aria-label={`${
          isExpanded ? "Collapse" : "Read more about"
        } ${project.title}`}
        aria-expanded={isExpanded}
        aria-controls={descriptionId}
        onClick={onToggle}
      >
        <span aria-hidden="true" />
      </button>
    </motion.article>
  );
}