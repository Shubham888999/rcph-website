import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { cardReveal, copyReveal, headingReveal, imageSettle, staggerContainer } from "./homeMotion";

const projects = [
  {
    title: "Project Edureach 2.0",
    image: "/images/edureach_2.0.jpeg",
    alt: "RCPH members presenting exclusive learning coupons with access to chapter explanations, question banks, and practice papers",
    description:
      "On the occasion of India’s 80th Independence Day, the Rotaract Club of Pune Heritage successfully completed Project EduReach 2.0. Conducted in collaboration with the Interact Club of Chandrakant Darode Secondary School, the initiative empowered SSC students by providing exclusive learning coupons with access to chapter explanations, question banks, and practice papers. This milestone reflects the club’s dedication to education, service, and nation‑building.",
  },
  {
    title: "Mega Tree Plantation Drive",
    image: "/images/MTPD.jpg",
    alt: "Participants planting trees during the Mega Tree Plantation Drive",
    description:
      "Rotary district 3131, in collaboration with Rotaract Club of pune heritage members and army officers, conducted a tree plantation drive at Dehu to promote environmental sustainability. The joint effort of Rotarians and defense personnel highlighted the spirit of service, discipline, and community partnership.",
  },
  {
    title: "Photowalk",
    image: "/images/Photowalk.jpeg",
    alt: "Students receiving e-learning kits through Project EduReach",
    description:
      "The Nature Photo Walk was an interactive learning experience designed to introduce participants to the fundamentals of photography through both theory and practical application. The session covered photography basics, the Rule of Thirds, the Golden Ratio, BITS composition, and camera handling and mounting techniques. The session was conducted by Tanay Kardile, a professional photographer with 8 years of experience in the field. He specialises in wildlife, studio, and street photography and has also assisted in the production of four music videos, bringing valuable industry insights to the session. Following the indoor learning session, participants received personalised guidance while using professional wildlife, street, and studio cameras. They were encouraged to apply the concepts they had learned in real-time, experiment with different photography styles, and enhance their creative vision. The event served as a walk-through of the world of photography, combining knowledge, hands-on learning, and creativity, making it an enjoyable and enriching experience for everyone involved.",
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
