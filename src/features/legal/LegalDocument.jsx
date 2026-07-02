import { LEGAL_EFFECTIVE_DATE_LABEL } from "./legalConstants";

function Paragraphs({ items = [] }) {
  return items.map((text) => <p key={text}>{text}</p>);
}

function List({ items = [] }) {
  return items.length ? <ul>{items.map((text) => <li key={text}>{text}</li>)}</ul> : null;
}

export default function LegalDocument({ title, version, intro, sections }) {
  return (
    <main className="legal-page">
      <header className="legal-hero">
        <p className="eyebrow">RCPH legal information</p>
        <h1>{title}</h1>
        <p className="legal-summary">{intro}</p>
        <dl className="legal-version">
          <div><dt>Effective date</dt><dd>{LEGAL_EFFECTIVE_DATE_LABEL}</dd></div>
          <div><dt>Version</dt><dd>{version}</dd></div>
        </dl>
      </header>

      <div className="legal-layout">
        <nav className="legal-toc" aria-label={`${title} contents`}>
          <h2>Contents</h2>
          <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, "")}</a></li>)}</ol>
        </nav>
        <article className="legal-document">
          {sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              <Paragraphs items={section.paragraphs} />
              <List items={section.list} />
              <Paragraphs items={section.after} />
              <List items={section.secondList} />
              <Paragraphs items={section.final} />
              {section.contact ? <p><a href="mailto:rcpuneheritage3131@gmail.com">rcpuneheritage3131@gmail.com</a></p> : null}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
