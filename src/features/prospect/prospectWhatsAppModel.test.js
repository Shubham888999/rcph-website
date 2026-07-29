import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prospect WhatsApp section uses manual-addition copy without external invite links", async () => {
  const source = await readFile(new URL("./ProspectWhatsAppGroup.jsx", import.meta.url), "utf8");

  assert.match(source, /Prospect WhatsApp Group/);
  assert.match(source, /You will soon be added to the official RCPH Prospect WhatsApp group/);
  assert.match(source, /Once added, please introduce yourself briefly/);
  assert.doesNotMatch(source, /href=/);
  assert.doesNotMatch(source, /target="_blank"/);
  assert.doesNotMatch(source, /Join WhatsApp Group/);
  assert.doesNotMatch(source, /Group link will be shared soon/);
});

test("WhatsApp section is owned by the prospect-only dashboard component", async () => {
  const progressSource = await readFile(new URL("./ProspectProgress.jsx", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");

  assert.match(progressSource, /<ProspectWhatsAppGroup \/>/);
  assert.match(dashboardSource, /prospect \? <ProspectProgress[^:]+: <MemberOverview/);
  assert.equal(dashboardSource.includes("ProspectWhatsAppGroup"), false);
});