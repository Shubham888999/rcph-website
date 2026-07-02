import { Link } from "react-router-dom";
import FaqItem from "./FaqItem";

export default function FaqList({ groups, query, openItems, onToggle, onExpandAll, onCollapseAll, onClearSearch }) {
  const visibleCount = groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <section className="faq-content" aria-labelledby="faq-list-title">
      <header className="faq-content__header">
        <div><p className="faq-kicker">Club guide</p><h2 id="faq-list-title">Questions and official answers</h2></div>
        {visibleCount ? (
          <div className="faq-content__controls" aria-label="FAQ disclosure controls">
            <button type="button" onClick={onExpandAll}>Expand all</button>
            <button type="button" onClick={onCollapseAll}>Collapse all</button>
          </div>
        ) : null}
      </header>

      {visibleCount ? groups.map((group) => (
        <section key={group.id} id={`faq-category-${group.id}`} className="faq-category" aria-labelledby={`faq-category-title-${group.id}`}>
          <header>
            <p className="faq-category__count">{String(group.items.length).padStart(2, "0")} answers</p>
            <h3 id={`faq-category-title-${group.id}`}>{group.label}</h3>
            <p>{group.description}</p>
          </header>
          <div className="faq-ledger">
            {group.items.map((item) => (
              <FaqItem key={item.id} item={item} isOpen={openItems.has(item.id)} onToggle={() => onToggle(item.id)} />
            ))}
          </div>
        </section>
      )) : (
        <div className="faq-empty" role="status">
          <p className="faq-kicker">No answers found</p>
          <h3>No answers matched your search.</h3>
          <p>Try another phrase, browse all topics, or contact RCPH directly.</p>
          <div>
            <button type="button" onClick={onClearSearch}>Clear search</button>
            <Link to="/contact">Contact RCPH</Link>
          </div>
        </div>
      )}
      {query && visibleCount ? <p className="faq-content__filtered-note">Showing answers that match “{query.trim()}”.</p> : null}
    </section>
  );
}
