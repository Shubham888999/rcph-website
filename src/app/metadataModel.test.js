import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { absoluteSiteUrl, canonicalUrl, getRouteMetadata, getRouteStructuredData, PUBLIC_ROUTES, serializeStructuredData } from "./metadataModel.js";

test("every public route has complete unique metadata and an apex canonical", () => {
  const titles = new Set();
  for (const path of PUBLIC_ROUTES) {
    const metadata = getRouteMetadata(path);
    assert.equal(metadata.isPublic, true);
    assert.equal(metadata.robots, "index, follow");
    assert.equal(metadata.canonical, `https://rcph3131.org${path === "/" ? "/" : path}`);
    assert.ok(metadata.title);
    assert.ok(metadata.description);
    assert.ok(metadata.image.startsWith("https://rcph3131.org/"));
    assert.ok(metadata.imageAlt);
    assert.equal(titles.has(metadata.title), false, `Duplicate title: ${metadata.title}`);
    titles.add(metadata.title);
  }
});

test("canonical construction normalizes trailing and duplicate slashes", () => {
  assert.equal(canonicalUrl("/about/"), "https://rcph3131.org/about");
  assert.equal(canonicalUrl("//about///"), "https://rcph3131.org/about");
  assert.equal(canonicalUrl("invalid"), "https://rcph3131.org/");
});

test("absolute images resolve against the canonical apex", () => {
  assert.equal(absoluteSiteUrl("/images/rcph-lakshya-logo.webp"), "https://rcph3131.org/images/rcph-lakshya-logo.webp");
  assert.equal(absoluteSiteUrl("javascript:alert(1)"), "https://rcph3131.org/");
});

test("auth, protected, nested Admin, visit dashboards, and unknown routes are noindex", () => {
  for (const path of ["/login", "/signup", "/forgot-password", "/access", "/website-guide", "/dashboard", "/bod-tools", "/visits/club-assembly", "/visits/dzr-visit", "/visits/drr-visit", "/admin", "/admin/visit-management", "/missing"]) {
    const metadata = getRouteMetadata(path);
    assert.equal(metadata.robots, "noindex, nofollow");
    assert.equal(metadata.structuredData, null);
  }
  assert.equal(getRouteMetadata("/visits/club-assembly").title, "Club Assembly Dashboard | RCPH");
  assert.equal(getRouteMetadata("/missing").title, "Page Not Found | RCPH");
});

test("internal public routes receive canonical breadcrumb schema", () => {
  assert.equal(getRouteStructuredData("/"), null);
  const data = getRouteStructuredData("/projects");
  assert.equal(data["@type"], "BreadcrumbList");
  assert.equal(data.itemListElement[1].item, "https://rcph3131.org/projects");
  assert.doesNotThrow(() => JSON.parse(serializeStructuredData(data)));
});

test("sitemap exactly matches the public route inventory", async () => {
  const sitemap = await readFile(new URL("../../public/sitemap.xml", import.meta.url), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, PUBLIC_ROUTES.map((path) => `https://rcph3131.org${path === "/" ? "/" : path}`));
  assert.equal(sitemap.includes("changefreq"), false);
  assert.equal(sitemap.includes("priority"), false);
});
