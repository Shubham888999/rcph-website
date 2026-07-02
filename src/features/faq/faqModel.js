import { faqCategories, faqItems } from "./faqData.js";

export function faqAnswerText(item) {
  return Array.isArray(item?.answer)
    ? item.answer.map((part) => part?.type === "link" ? part.label : part?.value || "").join("")
    : "";
}

export function normalizeFaqQuery(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en") : "";
}

export function filterFaqItems(items, query) {
  const normalized = normalizeFaqQuery(query);
  if (!normalized) return [...items];
  return items.filter((item) => {
    const category = faqCategories.find(({ id }) => id === item.category)?.label || "";
    const searchable = [item.question, faqAnswerText(item), category, ...(item.keywords || [])]
      .join(" ")
      .toLocaleLowerCase("en");
    return searchable.includes(normalized);
  });
}

export function groupFaqByCategory(items) {
  return faqCategories.map((category) => ({
    ...category,
    items: items.filter((item) => item.category === category.id),
  })).filter(({ items: categoryItems }) => categoryItems.length);
}

export function getFeaturedFaqs(items = faqItems) {
  const seen = new Set();
  return items.filter((item) => item.featured === true && !seen.has(item.id) && seen.add(item.id)).slice(0, 4);
}
