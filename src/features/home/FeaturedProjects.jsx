import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  hidden: { opacity: 1, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function FeaturedProjects() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-section home-projects" aria-labelledby="featured-projects-title">
      <motion.div
        className="home-section__heading home-section__heading--split"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
      >
        <div>
          <p className="home-kicker">Service in action</p>
          <h2 id="featured-projects-title">Featured Projects</h2>
        </div>
        <p>
          A glimpse of the learning, service, and collaboration that shape RCPH.
        </p>
      </motion.div>

      <motion.div
        className="home-project-grid"
        variants={reduceMotion ? undefined : containerVariants}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.15 }}
      >
        {projects.map((project) => (
          <motion.article
            className="home-project-card"
            key={project.title}
            variants={reduceMotion ? undefined : cardVariants}
          >
            <div className="home-project-card__image">
              <img src={project.image} alt={project.alt} />
            </div>
            <div className="home-project-card__copy">
              <h3>{project.title}</h3>
              <p>{project.description}</p>
            </div>
          </motion.article>
        ))}
      </motion.div>

      <div className="home-projects__action">
        <Link className="button button-secondary" to="/projects">View all projects</Link>
      </div>
    </section>
  );
}
