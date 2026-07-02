export default function FaqFeatured({ items, onSelect }) {
  return (
    <nav className="faq-featured" aria-label="Featured questions">
      <p className="faq-kicker">Start here</p>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#faq-${item.id}`} onClick={(event) => { event.preventDefault(); onSelect(item.id); }}>{item.question}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
