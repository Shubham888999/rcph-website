import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function FaqItem({ item, isOpen, onToggle }) {
  const reduceMotion = useReducedMotion();
  const buttonId = `faq-button-${item.id}`;
  const panelId = `faq-panel-${item.id}`;

  return (
    <article className={`faq-item-react ${isOpen ? "is-open" : ""}`}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{item.question}</span>
          <span className="faq-item-react__icon" aria-hidden="true">+</span>
        </button>
      </h3>

      <motion.div
        id={panelId}
        className="faq-item-react__panel"
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!isOpen}
        inert={!isOpen}
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
      >
        <p>
          {item.answer.map((part, index) =>
            part.type === "link" ? (
              <Link key={`${item.id}-${index}`} to={part.to}>{part.label}</Link>
            ) : (
              <span key={`${item.id}-${index}`}>{part.value}</span>
            ),
          )}
        </p>
      </motion.div>
    </article>
  );
}
