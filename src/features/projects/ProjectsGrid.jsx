import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import ProjectCard from "./ProjectCard";
import { projects } from "./projectsData";

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function ProjectsGrid() {
  const reduceMotion = useReducedMotion();
  const useCompactCards = useCompactProjectCards();
  const [expandedProjectTitle, setExpandedProjectTitle] = useState("");

  useEffect(() => {
    if (!useCompactCards) setExpandedProjectTitle("");
  }, [useCompactCards]);

  function toggleProject(title) {
    setExpandedProjectTitle((currentTitle) => (currentTitle === title ? "" : title));
  }

  return (
    <section className="projects-section" aria-labelledby="project-stories-title">
      <motion.div
        className="projects-section__heading"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <p className="projects-kicker">Ideas made real</p>
        <h2 id="project-stories-title">Featured Project Stories</h2>
      </motion.div>

      <motion.div
        className="projects-grid"
        variants={reduceMotion ? undefined : gridVariants}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.08 }}
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.title}
            project={project}
            reduceMotion={reduceMotion}
            useCompactCards={useCompactCards}
            isExpanded={useCompactCards && expandedProjectTitle === project.title}
            onToggle={() => toggleProject(project.title)}
          />
        ))}
      </motion.div>
    </section>
  );
}

function useCompactProjectCards() {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 620px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const query = window.matchMedia("(max-width: 620px)");
    const handleChange = () => setMatches(query.matches);

    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return matches;
}
