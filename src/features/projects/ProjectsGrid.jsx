import { motion, useReducedMotion } from "framer-motion";
import ProjectCard from "./ProjectCard";
import { projects } from "./projectsData";

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function ProjectsGrid() {
  const reduceMotion = useReducedMotion();

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
          />
        ))}
      </motion.div>
    </section>
  );
}
