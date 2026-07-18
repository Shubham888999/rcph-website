import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { cardReveal, copyReveal, headingReveal, imageSettle, staggerContainer } from "./homeMotion";

const projects = [
  {
    title: "Pages of Hope",
    image: "/images/poh.jpg",
    alt: "RCPH members presenting donated books during Pages of Hope",
    description:
      "A book donation drive initiated by RC SSPU and collaborated with RC Pune Heritage. RCPH donated 20+ books to Ramabai Ranade Proudh High School and held a small interaction session.",
  },
  {
    title: "Inside Out",
    image: "/images/insideout-1.jpg",
    alt: "Inside Out mental health awareness session artwork",
    description:
      "An online Mental Health Awareness session hosted with Rotaract Club of Pune Metro and Rotaract Club of MGMIMSR Panvel, marking World Mental Health Day through conversations on empathy, wellness, and awareness.",
  },
  {
    title: "Project EduReach",
    image: "/images/Edureach1.jpg",
    alt: "Students receiving e-learning kits through Project EduReach",
    description:
      "RCPH distributed 50 exclusive e-learning kits to 10th Std SSC students, providing academic support, learning resources, and encouragement as they prepared for their board examinations.",
  },
];

export default function FeaturedProjects() {
  const reduceMotion = useReducedMotion();
  const descriptionBaseId = useId();
  const featuredProjects = projects.slice(0, 2);
  const [expandedProject, setExpandedProject] = useState("");

  function toggleProject(title) {
    setExpandedProject((current) => (current === title ? "" : title));
  }

  function handleProjectKeyDown(event, title) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleProject(title);
  }

  return (
    <section className="home-section home-projects" aria-labelledby="featured-projects-title">
      <motion.div
        className="home-section__heading home-section__heading--split"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div variants={reduceMotion ? undefined : headingReveal}>
          <p className="home-kicker">Service in action</p>
          <h2 id="featured-projects-title">Featured Projects</h2>
        </motion.div>
        <motion.p variants={reduceMotion ? undefined : copyReveal}>
          A glimpse of the learning, service, and collaboration that shape RCPH.
        </motion.p>
      </motion.div>

      <motion.div
        className="home-project-grid"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.15 }}
      >
        {featuredProjects.map((project, index) => {
          const isExpanded = expandedProject === project.title;
          const descriptionId = `${descriptionBaseId}-project-${index}`;

          return (
            <motion.article
              className={`home-project-card${isExpanded ? " home-project-card--expanded" : ""}`}
              key={project.title}
              variants={reduceMotion ? undefined : cardReveal}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-controls={descriptionId}
              onClick={() => toggleProject(project.title)}
              onKeyDown={(event) => handleProjectKeyDown(event, project.title)}
            >
              <motion.div className="home-project-card__image" variants={reduceMotion ? undefined : imageSettle}>
                <img src={project.image} alt={project.alt} loading="lazy" decoding="async" />
              </motion.div>
              <div className="home-project-card__copy">
                <h3>{project.title}</h3>
                <p id={descriptionId} className="home-project-card__description">
                  {project.description}
                </p>
              </div>
              <button
                className="home-project-card__toggle"
                type="button"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${project.title} description`}
                aria-expanded={isExpanded}
                aria-controls={descriptionId}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleProject(project.title);
                }}
              >
                <span aria-hidden="true" />
              </button>
            </motion.article>
          );
        })}
      </motion.div>

      <div className="home-projects__action">
        <Link className="button button-secondary" to="/projects">Explore more projects</Link>
      </div>
    </section>
  );
}
