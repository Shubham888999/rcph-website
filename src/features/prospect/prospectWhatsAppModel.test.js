import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROSPECT_WHATSAPP_GROUP_URL,
  getProspectWhatsAppGroupState,
} from "./prospectWhatsAppModel.js";

test("missing configured link produces the safe unavailable state", () => {
  assert.equal(PROSPECT_WHATSAPP_GROUP_URL, null);
  assert.deepEqual(getProspectWhatsAppGroupState(), { available: false, url: "" });
});

test("a verified WhatsApp group invite becomes an external URL", () => {
  assert.deepEqual(
    getProspectWhatsAppGroupState("https://chat.whatsapp.com/VerifiedInvite123"),
    { available: true, url: "https://chat.whatsapp.com/VerifiedInvite123" },
  );
});

test("fake, non-group, and insecure fallbacks are rejected", () => {
  for (const value of ["#", "https://wa.me/123", "http://chat.whatsapp.com/invite", "javascript:void(0)"]) {
    assert.equal(getProspectWhatsAppGroupState(value).available, false);
  }
});

test("component contains approved copy and accessible active-link attributes", async () => {
  const source = await readFile(new URL("./ProspectWhatsAppGroup.jsx", import.meta.url), "utf8");
  assert.match(source, /Join the Prospect WhatsApp Group/);
  assert.match(source, /After joining, please introduce yourself briefly/);
  assert.match(source, /Group link will be shared soon/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noreferrer"/);
  assert.equal(source.includes('href="#"'), false);
});

test("WhatsApp section is owned by the prospect-only dashboard component", async () => {
  const progressSource = await readFile(new URL("./ProspectProgress.jsx", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");
  assert.match(progressSource, /<ProspectWhatsAppGroup \/>/);
  assert.match(dashboardSource, /prospect \? <ProspectProgress[^:]+: <MemberOverview/);
  assert.equal(dashboardSource.includes("ProspectWhatsAppGroup"), false);
});
