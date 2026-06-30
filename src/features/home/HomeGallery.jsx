import { motion, useReducedMotion } from "framer-motion";
import homeGalleryItems from "./homeGalleryData";

const galleryVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 1, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function HomeGallery() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-section home-gallery" aria-labelledby="home-gallery-title">
      <motion.div
        className="home-section__heading home-section__heading--split"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
      >
        <div>
          <p className="home-kicker">Life at RCPH</p>
          <h2 id="home-gallery-title">Gallery</h2>
        </div>
        <p>A glimpse of our projects, fellowships, learning, and club milestones.</p>
      </motion.div>

      <motion.div
        className="home-gallery__grid"
        variants={reduceMotion ? undefined : galleryVariants}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.08 }}
      >
        {homeGalleryItems.map((item) => (
          <motion.figure className="home-gallery__item" variants={reduceMotion ? undefined : itemVariants} key={item.title}>
            <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
            <figcaption>{item.title}</figcaption>
          </motion.figure>
        ))}
      </motion.div>
    </section>
  );
}
