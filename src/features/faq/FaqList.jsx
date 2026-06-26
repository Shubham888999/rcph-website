import { useState } from "react";
import FaqItem from "./FaqItem";
import { faqItems } from "./faqData";

export default function FaqList() {
  const [openItems, setOpenItems] = useState(
    () => new Set(faqItems.length > 0 ? [faqItems[0].id] : []),
  );

  const toggleItem = (id) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="faq-section" aria-labelledby="faq-list-title">
      <div className="faq-section__heading">
        <p className="faq-kicker">Everything in one place</p>
        <h2 id="faq-list-title">RCPH Questions and Answers</h2>
        <p>The first answer is open by default. Select any question to expand or collapse it.</p>
      </div>

      <div className="faq-list-react">
        {faqItems.map((item) => (
          <FaqItem
            key={item.id}
            item={item}
            isOpen={openItems.has(item.id)}
            onToggle={() => toggleItem(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
