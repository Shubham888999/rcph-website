import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = JSON.parse(await readFile(new URL("../../firebase.json", import.meta.url), "utf8"));

test("Hosting serves the Vite build with an SPA fallback", () => {
  assert.equal(config.hosting.public, "dist");
  assert.deepEqual(config.hosting.rewrites.at(-1), { source: "**", destination: "/index.html" });
});

test("legacy public routes redirect to React routes", () => {
  const redirects = new Map(config.hosting.redirects.map((item) => [item.source, item.destination]));
  assert.equal(redirects.get("/about.html"), "/about");
  assert.equal(redirects.get("/events.html"), "/events");
  assert.equal(redirects.get("/admin.html"), "/admin");
  assert.equal(redirects.get("/dzrvisit.html"), "/admin/dzr-visit");
});
