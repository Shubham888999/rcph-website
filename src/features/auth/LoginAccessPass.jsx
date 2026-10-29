import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

const clubMoments = [
  { src: "/images/Edureach3.jpg", alt: "RCPH members and students during Project EduReach", label: "Service" },
  { src: "/images/potluck.jpg", alt: "RCPH members gathered for the PotLuck fellowship", label: "Fellowship" },
  { src: "/images/vox26.jpeg", alt: "Rotaract Club of Pune Heritage gathered for its installation ceremony", label: "Leadership" },
];

export default function LoginAccessPass({ children }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 150, damping: 28 });
  const smoothY = useSpring(pointerY, { stiffness: 150, damping: 28 });
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-2, 2]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [2, -2]);
  const lightX = useTransform(smoothX, [-0.5, 0.5], ["10%", "90%"]);
  const lightY = useTransform(smoothY, [-0.5, 0.5], ["10%", "90%"]);

  function moveLight(event) {
    if (reduceMotion || event.pointerType !== "mouse" || !window.matchMedia("(min-width: 851px) and (hover: hover) and (pointer: fine)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX.set(Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5)));
    pointerY.set(Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5)));
  }
  return <motion.section className="login-brand-panel login-access-pass" aria-labelledby="login-brand-title" initial={reduceMotion ? false : { opacity: 0, x: -20, y: 12 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }} style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 1200 }} onPointerMove={moveLight} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}>
    <motion.span className="login-access-pass__light" aria-hidden="true" style={{ "--pass-light-x": lightX, "--pass-light-y": lightY }} />
    <span className="login-access-pass__spine" aria-hidden="true" />
    <header className="login-access-pass__identity">{children}</header>
    <div className="login-access-pass__body">
      <div className="login-access-pass__edition"><p>Heritage / Account Access</p><div className="login-access-pass__stamp"><span>RIY</span><strong>2026–27</strong></div></div>
      <h1 id="login-brand-title"><span>Step into the</span><span>heart of</span><em>Heritage.</em></h1>
      <p className="login-access-pass__audience">Members <span aria-hidden="true">·</span> Board <span aria-hidden="true">·</span> District Officials</p>
    </div>
    <footer className="login-access-pass__footer">
      <div className="login-access-pass__footer-heading"><span>A glimpse of club life</span><svg className="login-access-pass__seal" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="29" /><circle cx="32" cy="32" r="25" /><path d="M15 22h34M15 42h34" /><text x="32" y="36" textAnchor="middle">RCPH</text><text className="login-access-pass__seal-district" x="32" y="50" textAnchor="middle">3131</text></svg></div>
      <div className="login-access-pass__moments">{clubMoments.map(moment => <figure key={moment.label}><img src={moment.src} alt={moment.alt} loading="lazy" decoding="async" /><figcaption>{moment.label}</figcaption></figure>)}</div>
    </footer>
  </motion.section>;
}
