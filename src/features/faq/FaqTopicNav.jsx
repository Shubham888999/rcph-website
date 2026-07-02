export default function FaqTopicNav({ categories, onSelect }) {
  return (
    <nav className="faq-topics" aria-label="FAQ topics">
      <p className="faq-kicker">Topics</p>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <a href={`#faq-category-${category.id}`} onClick={(event) => { event.preventDefault(); onSelect(category.id); }}>
              {category.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
