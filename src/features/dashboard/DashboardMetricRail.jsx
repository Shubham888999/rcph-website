import { motion, useReducedMotion } from "framer-motion";
import { formatDashboardMetric } from "./dashboardPresentationModel";

export default function DashboardMetricRail({ items, label = "Dashboard metrics" }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.dl
      className="dashboard-metric-rail"
      aria-label={label}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.3 }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
    >
      {items.map((item) => (
        <motion.div
          key={item.key}
          variants={reduceMotion ? undefined : {
            hidden: { opacity: 1, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
          }}
        >
          <dt>{item.label}</dt>
          <dd>{formatDashboardMetric(item.value, item.suffix)}</dd>
          {item.detail ? <small>{item.detail}</small> : null}
        </motion.div>
      ))}
    </motion.dl>
  );
}
