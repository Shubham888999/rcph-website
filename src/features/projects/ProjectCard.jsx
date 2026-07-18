import { useId } from "react";
import { motion } from "framer-motion";

const projectCardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function ProjectCard({ project, reduceMotion, useCompactCards, isExpanded, onToggle }) {
  const descriptionId = useId();

  function handleKeyDown(event) {
    if (!useCompactCards || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onToggle();
  }

  const compactCardProps = useCompactCards
    ? {
        role: "button",
        tabIndex: 0,
        "aria-expanded": isExpanded,
        "aria-controls": descriptionId,
        onClick: onToggle,
        onKeyDown: handleKeyDown,
      }
    : {};

  return (
    <motion.article
      className={`projects-card${useCompactCards ? " projects-card--compact" : ""}${isExpanded ? " projects-card--expanded" : ""}`}
      variants={reduceMotion ? undefined : projectCardVariants}
      {...compactCardProps}
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
        <p id={descriptionId} className="projects-card__description">{project.description}</p>
      </div>
      {useCompactCards ? (
        <button
          className="projects-card__toggle"
          type="button"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${project.title} description`}
          aria-expanded={isExpanded}
          aria-controls={descriptionId}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
    </motion.article>
  );
}
