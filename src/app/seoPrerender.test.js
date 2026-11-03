import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { prerenderSeoPages, renderPageHead } from "../../scripts/prerender-seo.mjs";
import { PUBLIC_ROUTES, getRouteMetadata } from "./metadataModel.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const template = await read("../../index.html");
const config = JSON.parse(await read("../../firebase.json"));
const pkg = JSON.parse(await read("../../package.json"));
const head = (html, pattern) => html.match(pattern)?.[1];

test("each public page gets its own title, description, canonical, previews and breadcrumbs in the HTML", () => {
  const html = renderPageHead(template, "/join");
  const metadata = getRouteMetadata("/join");
  assert.equal(head(html, /<title>([^<]*)<\/title>/), "Join a Rotaract Club in Pune | RCPH");
  assert.equal(head(html, /<meta name="description" content="([^"]*)"/), metadata.description);
  assert.equal(head(html, /<link rel="canonical" href="([^"]*)"/), "https://rcph3131.org/join");
  assert.equal(head(html, /<meta property="og:title" content="([^"]*)"/), metadata.title);
  assert.equal(head(html, /<meta property="og:url" content="([^"]*)"/), "https://rcph3131.org/join");
  assert.equal(head(html, /<meta name="twitter:description" content="([^"]*)"/), metadata.description);
  assert.equal(head(html, /<meta name="robots" content="([^"]*)"/), "index, follow");
  assert.match(html, /<script type="application\/ld\+json" data-route-structured-data="true">\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"/);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.match(html, /<div id="root"><\/div>/, "the app shell is unchanged");
});

test("the home page HTML already matches its metadata, with no breadcrumb", () => {
  const metadata = getRouteMetadata("/");
  assert.equal(head(template, /<title>([^<]*)<\/title>/), metadata.title);
  assert.equal(head(template, /<meta name="description" content="([^"]*)"/), metadata.description);
  assert.equal(renderPageHead(template, "/"), template);
});

test("the build writes index.html plus one file per public page", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rcph-seo-"));
  await writeFile(join(dir, "index.html"), template);
  const written = await prerenderSeoPages({ distDir: pathToFileURL(`${dir}/`) });
  const expected = PUBLIC_ROUTES.map((path) => (path === "/" ? "index.html" : `${path.slice(1)}.html`));
  assert.deepEqual(written, expected);
  assert.deepEqual((await readdir(dir)).sort(), [...expected].sort());
  const about = await readFile(join(dir, "about.html"), "utf8");
  assert.equal(head(about, /<title>([^<]*)<\/title>/), "About Us | Rotaract Club of Pune Heritage, Pune");
  assert.match(pkg.scripts.build, /^vite build && node scripts\/prerender-seo\.mjs$/);
});

test("hosting serves /about from about.html, sends old pages to their new address permanently, and lets Google read private noindex headers", async () => {
  assert.equal(config.hosting.cleanUrls, true);
  assert.equal(config.hosting.trailingSlash, false, "/about/ redirects to /about, so each page has one address");
  assert.equal(config.hosting.redirects.some((item) => item.type === 302), false);
  const robots = await read("../../public/robots.txt");
  assert.doesNotMatch(robots, /Disallow/);
  assert.match(robots, /Sitemap: https:\/\/rcph3131\.org\/sitemap\.xml/);
});

test("organisation data names the founding year, area, sponsor, district and social profiles", () => {
  const data = JSON.parse(head(template, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
  const org = data["@graph"].find((item) => item["@id"] === "https://rcph3131.org/#organization");
  assert.deepEqual(org["@type"], ["Organization", "NGO"]);
  assert.equal(org.foundingDate, "2015");
  assert.equal(org.address.addressLocality, "Kothrud, Pune");
  assert.equal(org.sponsor.name, "Rotary Club of Pune Heritage");
  assert.equal(org.parentOrganization.name, "Rotaract District 3131");
  assert.deepEqual(org.sameAs, ["https://www.instagram.com/rc_pune_heritage/", "https://www.facebook.com/rotaractheritage3131", "https://www.linkedin.com/company/rcpuneheritage3131/"]);
  assert.match(org.description, /Rotaract club in Pune/);
});
