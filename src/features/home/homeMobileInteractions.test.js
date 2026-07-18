import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import homeGalleryItems from "./homeGalleryData.js";

test("featured projects keep two expandable cards and the projects CTA", async () => {
  const source = await readFile(new URL("./FeaturedProjects.jsx", import.meta.url), "utf8");

  assert.match(source, /projects\.slice\(0,\s*2\)/);
  assert.match(source, /aria-expanded=\{isExpanded\}/);
  assert.match(source, /handleProjectKeyDown/);
  assert.match(source, /home-project-card__toggle/);
  assert.match(source, /Explore more projects/);
});

test("home gallery albums support modal navigation and swipe gestures", async () => {
  const source = await readFile(new URL("./HomeGallery.jsx", import.meta.url), "utf8");

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /onTouchStart=\{handleTouchStart\}/);
  assert.match(source, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /Escape/);
  assert.match(source, /home-gallery-modal__nav--prev/);
  assert.match(source, /home-gallery-modal__nav--next/);
  assert.ok(homeGalleryItems.some((item) => Array.isArray(item.photos) && item.photos.length > 1));
});
