import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gridSource = readFileSync(new URL("./ProjectsGrid.jsx", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("./ProjectCard.jsx", import.meta.url), "utf8");
const projectsCss = readFileSync(new URL("../../styles/components/projects.css", import.meta.url), "utf8");

test("projects page uses mobile-only expandable cards", () => {
  assert.match(gridSource, /useCompactProjectCards/);
  assert.match(gridSource, /matchMedia\("\(max-width: 620px\)"\)/);
  assert.match(gridSource, /expandedProjectTitle/);
  assert.match(gridSource, /setExpandedProjectTitle\(\(currentTitle\) => \(currentTitle === title \? "" : title\)\)/);

  assert.match(cardSource, /useId/);
  assert.match(cardSource, /role: "button"/);
  assert.match(cardSource, /"aria-expanded": isExpanded/);
  assert.match(cardSource, /"aria-controls": descriptionId/);
  assert.match(cardSource, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(cardSource, /projects-card__toggle/);
  assert.match(cardSource, /event\.stopPropagation\(\)/);

  assert.match(projectsCss, /@media \(max-width: 620px\)[\s\S]*\.projects-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(projectsCss, /\.projects-card--compact\.projects-card--expanded[\s\S]*grid-column: 1 \/ -1;/);
  assert.match(projectsCss, /\.projects-card--compact \.projects-card__description[\s\S]*max-height: 0;/);
  assert.match(projectsCss, /\.projects-card--compact\.projects-card--expanded \.projects-card__description[\s\S]*opacity: 1;/);
  assert.match(projectsCss, /@media \(max-width: 22\.5rem\)[\s\S]*\.projects-grid[\s\S]*grid-template-columns: 1fr;/);
});
