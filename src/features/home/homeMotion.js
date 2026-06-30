export const homeEase = [0.22, 1, 0.36, 1];

export const sectionReveal = {
  hidden: { opacity: 1, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.58, ease: homeEase } },
};

export const headingReveal = {
  hidden: { opacity: 1, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.52, ease: homeEase } },
};

export const copyReveal = {
  hidden: { opacity: 1, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: homeEase } },
};

export const copyRevealLeft = {
  hidden: { opacity: 1, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: homeEase } },
};

export const copyRevealRight = {
  hidden: { opacity: 1, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: homeEase } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

export const cardReveal = {
  hidden: { opacity: 1, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: homeEase } },
};

export const imageSettle = {
  hidden: { scale: 1.018 },
  visible: { scale: 1, transition: { duration: 0.7, ease: homeEase } },
};

export const lineReveal = {
  hidden: { scaleX: 0.25 },
  visible: { scaleX: 1, transition: { duration: 0.55, ease: homeEase } },
};

export const galleryItemReveal = {
  hidden: (index = 0) => ({ opacity: 1, y: index % 2 === 0 ? 12 : 18 }),
  visible: { opacity: 1, y: 0, transition: { duration: 0.46, ease: homeEase } },
};
