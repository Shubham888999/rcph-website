import { useEffect, useMemo, useState } from "react";
import FaqCallToAction from "../../features/faq/FaqCallToAction";
import FaqFeatured from "../../features/faq/FaqFeatured";
import FaqHero from "../../features/faq/FaqHero";
import FaqList from "../../features/faq/FaqList";
import FaqSearch from "../../features/faq/FaqSearch";
import FaqTopicNav from "../../features/faq/FaqTopicNav";
import { faqCategories, faqItems } from "../../features/faq/faqData";
import { filterFaqItems, getFeaturedFaqs, groupFaqByCategory } from "../../features/faq/faqModel";
import "../../styles/components/faq.css";

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState(() => new Set(["what-is-rcph"]));
  const filteredItems = useMemo(() => filterFaqItems(faqItems, query), [query]);
  const groups = useMemo(() => groupFaqByCategory(filteredItems), [filteredItems]);
  const featuredItems = useMemo(() => getFeaturedFaqs(), []);

  useEffect(() => {
    const openHashQuestion = () => {
      const match = window.location.hash.match(/^#faq-(?!category-)(.+)$/);
      const id = match?.[1] || "";
      if (!faqItems.some((item) => item.id === id)) return;
      setQuery("");
      setOpenItems((current) => new Set(current).add(id));
    };
    openHashQuestion();
    window.addEventListener("hashchange", openHashQuestion);
    return () => window.removeEventListener("hashchange", openHashQuestion);
  }, []);

  const toggleItem = (id) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openItem = (id) => {
    setQuery("");
    setOpenItems((current) => new Set(current).add(id));
    requestAnimationFrame(() => {
      window.location.hash = `faq-${id}`;
    });
  };

  const selectTopic = (id) => {
    setQuery("");
    requestAnimationFrame(() => {
      window.location.hash = `faq-category-${id}`;
    });
  };

  const expandVisible = () => {
    setOpenItems((current) => new Set([...current, ...filteredItems.map(({ id }) => id)]));
  };

  const collapseVisible = () => {
    const visibleIds = new Set(filteredItems.map(({ id }) => id));
    setOpenItems((current) => new Set([...current].filter((id) => !visibleIds.has(id))));
  };

  return (
    <main className="faq-page">
      <FaqHero questionCount={faqItems.length} />
      <div className="faq-layout">
        <aside className="faq-guide" aria-label="FAQ guide">
          <FaqSearch query={query} onChange={setQuery} resultCount={filteredItems.length} />
          <FaqTopicNav categories={faqCategories} onSelect={selectTopic} />
          <FaqFeatured items={featuredItems} onSelect={openItem} />
        </aside>

        <FaqList
          groups={groups}
          query={query}
          openItems={openItems}
          onToggle={toggleItem}
          onExpandAll={expandVisible}
          onCollapseAll={collapseVisible}
          onClearSearch={() => setQuery("")}
        />
      </div>
      <FaqCallToAction />
    </main>
  );
}
