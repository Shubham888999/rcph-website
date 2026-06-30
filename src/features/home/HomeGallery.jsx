import { motion, useReducedMotion } from "framer-motion";
import homeGalleryItems from "./homeGalleryData";
import { copyReveal, galleryItemReveal, headingReveal, staggerContainer } from "./homeMotion";

export default function HomeGallery() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-section home-gallery" aria-labelledby="home-gallery-title">
      <motion.div
        className="home-section__heading home-section__heading--split"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div variants={reduceMotion ? undefined : headingReveal}>
          <p className="home-kicker">Life at RCPH</p>
          <h2 id="home-gallery-title">Gallery</h2>
        </motion.div>
        <motion.p variants={reduceMotion ? undefined : copyReveal}>
          A glimpse of our projects, fellowships, learning, and club milestones.
        </motion.p>
      </motion.div>

      <motion.div
        className="home-gallery__grid"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.08 }}
      >
        {homeGalleryItems.map((item, index) => (
          <motion.figure
            className="home-gallery__item"
            variants={reduceMotion ? undefined : galleryItemReveal}
            custom={index}
            key={item.title}
          >
            <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
            <figcaption>{item.title}</figcaption>
          </motion.figure>
        ))}
      </motion.div>
    </section>
  );
}
