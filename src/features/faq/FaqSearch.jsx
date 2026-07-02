export default function FaqSearch({ query, onChange, resultCount }) {
  return (
    <section className="faq-search" aria-labelledby="faq-search-label">
      <label id="faq-search-label" htmlFor="faq-search-input">Search the guide</label>
      <div>
        <input
          id="faq-search-input"
          type="search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Try membership, events, dues…"
          autoComplete="off"
        />
        {query ? <button type="button" onClick={() => onChange("")} aria-label="Clear FAQ search">Clear</button> : null}
      </div>
    </section>
  );
}
