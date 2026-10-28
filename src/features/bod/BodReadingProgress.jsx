import { motion, useScroll } from "framer-motion";

export default function BodReadingProgress() {
  const { scrollYProgress } = useScroll();
  return <motion.div className="bod-magazine-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />;
}
