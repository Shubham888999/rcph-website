import assert from "node:assert/strict";
import test from "node:test";
import { faqCategories, faqItems } from "./faqData.js";
import { filterFaqItems, getFeaturedFaqs, groupFaqByCategory, normalizeFaqQuery } from "./faqModel.js";

test("FAQ content have unique IDs", () => {
  assert.equal(faqItems.length, 17);
  assert.equal(new Set(faqItems.map(({ id }) => id)).size, faqItems.length);
  assert.equal(new Set(faqItems.map(({ question }) => question.toLowerCase())).size, faqItems.length);
});

test("search matches question, answer, category, and keywords case-insensitively", () => {
  assert.ok(filterFaqItems(faqItems, "WHO CAN JOIN").some(({ id }) => id === "who-can-join"));
  assert.ok(filterFaqItems(faqItems, "community-based Rotaract").some(({ id }) => id === "what-is-rcph"));
  assert.ok(filterFaqItems(faqItems, "Membership & Dues").some(({ id }) => id === "annual-dues"));
  assert.ok(filterFaqItems(faqItems, "eligibility").some(({ id }) => id === "who-can-join"));
});

test("whitespace-only search returns all items", () => {
  assert.equal(normalizeFaqQuery("  \n  "), "");
  assert.equal(filterFaqItems(faqItems, "   ").length, faqItems.length);
});

test("no-result search returns an empty collection", () => {
  assert.deepEqual(filterFaqItems(faqItems, "definitely-not-an-rcph-topic"), []);
});

test("grouping preserves declared category order and valid targets", () => {
  const groups = groupFaqByCategory(faqItems);
  assert.deepEqual(groups.map(({ id }) => id), faqCategories.map(({ id }) => id));
  assert.ok(groups.every(({ items }) => items.length > 0));
});

test("featured questions are unique and sourced from visible FAQ items", () => {
  const featured = getFeaturedFaqs();
  assert.equal(featured.length, 4);
  assert.equal(new Set(featured.map(({ id }) => id)).size, featured.length);
  assert.ok(featured.every((item) => faqItems.includes(item)));
});

test("membership dues use the current published amount", () => {
  const membershipDues = faqItems.filter(({ id }) => ["annual-dues", "dues-utilization"].includes(id));
  const serialized = JSON.stringify(membershipDues);

  assert.equal(membershipDues.length, 2);
  assert.match(serialized, /₹3,131/);
  assert.doesNotMatch(serialized, /₹3,000|3000/);
});
