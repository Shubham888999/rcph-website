// After `vite build`, writes one HTML file per public page (dist/about.html, dist/join.html, ...)
// with that page's title, description, canonical link, link-preview tags and breadcrumb data
// already in the HTML. Search engines and link previews read these before any JavaScript runs.
// Firebase Hosting serves /about from dist/about.html because cleanUrls is on.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PUBLIC_ROUTES, getRouteMetadata, serializeStructuredData } from "../src/app/metadataModel.js";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ESCAPES[character]);

function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, "g")) || [];
  if (matches.length !== 1) throw new Error(`Expected exactly one ${label} in index.html, found ${matches.length}.`);
  return html.replace(pattern, replacement);
}

function setMeta(html, attribute, name, value) {
  const pattern = new RegExp(`<meta ${attribute}="${name}" content="[^"]*" />`);
  return replaceOnce(html, pattern, () => `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`, `${name} tag`);
}

export function renderPageHead(template, pathname) {
  const metadata = getRouteMetadata(pathname);
  let html = replaceOnce(template, /<title>[^<]*<\/title>/, () => `<title>${escapeHtml(metadata.title)}</title>`, "title");
  html = setMeta(html, "name", "description", metadata.description);
  html = setMeta(html, "name", "robots", metadata.robots);
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, () => `<link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`, "canonical link");
  html = setMeta(html, "property", "og:title", metadata.title);
  html = setMeta(html, "property", "og:description", metadata.description);
  html = setMeta(html, "property", "og:url", metadata.canonical);
  html = setMeta(html, "name", "twitter:title", metadata.title);
  html = setMeta(html, "name", "twitter:description", metadata.description);
  if (metadata.structuredData) {
    const script = `<script type="application/ld+json" data-route-structured-data="true">${serializeStructuredData(metadata.structuredData)}</script>`;
    html = replaceOnce(html, /<\/head>/, () => `    ${script}\n  </head>`, "closing head tag");
  }
  return html;
}

export async function prerenderSeoPages({ distDir }) {
  const indexPath = new URL("index.html", distDir);
  const template = await readFile(indexPath, "utf8");
  const written = [];
  for (const pathname of PUBLIC_ROUTES) {
    const html = renderPageHead(template, pathname);
    const target = pathname === "/" ? indexPath : new URL(`${pathname.slice(1)}.html`, distDir);
    await writeFile(target, html);
    written.push(pathname === "/" ? "index.html" : `${pathname.slice(1)}.html`);
  }
  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const distDir = new URL("../dist/", import.meta.url);
  const written = await prerenderSeoPages({ distDir });
  console.log(`SEO: wrote ${written.length} page heads (${written.join(", ")}).`);
}
