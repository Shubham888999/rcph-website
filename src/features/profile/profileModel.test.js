import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfileUpdatePayload,
  createProfileDraft,
  formatProfileHistoryValue,
  normalizeProfileDateOfBirth,
  updateProfileDraft,
  validateProfileDraft,
} from "./profileModel.js";

test("profile DOB normalization stays date-only and optional", () => {
  assert.equal(normalizeProfileDateOfBirth("", "2026-07-12"), "");
  assert.equal(normalizeProfileDateOfBirth("1998-02-28", "2026-07-12"), "1998-02-28");
  assert.equal(normalizeProfileDateOfBirth("1998-02-31", "2026-07-12"), "");
  assert.equal(normalizeProfileDateOfBirth("2027-01-01", "2026-07-12"), "");
});

test("member profile payload uses only editable fields", () => {
  const payload = buildProfileUpdatePayload({
    ...createProfileDraft({ role: "gbm", name: " Rtr. Asha ", email: "a@example.com" }),
    phone: "123",
    rotaryId: " RI-3131A ",
    dateOfBirth: "1998-02-28",
    gender: "woman",
    hobbies: "Reading",
    role: "admin",
    rid: "RID",
    active: false,
  }, { role: "gbm", today: "2026-07-12" });
  assert.deepEqual(payload, {
    name: "Asha",
    phone: "123",
    rotaryId: "RI-3131A",
    dateOfBirth: "1998-02-28",
    gender: "woman",
    genderSelfDescribe: "",
    hobbies: "Reading",
  });
  assert.equal(Object.hasOwn(payload, "email"), false);
  assert.equal(Object.hasOwn(payload, "rid"), false);
  assert.equal(Object.hasOwn(payload, "active"), false);
});

test("member profile optional Rotary ID can be empty", () => {
  const draft = {
    ...createProfileDraft({ role: "gbm", name: "Member" }),
    rotaryId: "",
  };
  const validation = validateProfileDraft(draft, { role: "gbm", today: "2026-07-12" });
  const payload = buildProfileUpdatePayload(draft, { role: "gbm", today: "2026-07-12" });

  assert.equal(validation.valid, true);
  assert.equal(validation.errors.rotaryId, undefined);
  assert.equal(payload.rotaryId, "");
});

test("member profile payload sends canonical rotaryId accepted by backend", () => {
  const draft = {
    ...createProfileDraft({ role: "gbm", name: "Member" }),
    rotaryId: " 11218198 ",
  };
  const validation = validateProfileDraft(draft, { role: "gbm", today: "2026-07-12" });
  const payload = buildProfileUpdatePayload(draft, { role: "gbm", today: "2026-07-12" });

  assert.equal(validation.valid, true);
  assert.equal(payload.rotaryId, "11218198");
  assert.equal(Object.hasOwn(payload, "rid"), false);
});

test("member profile Rotary ID reloads from profile data and trims before save", () => {
  const draft = createProfileDraft({
    role: "bod",
    name: "Board Member",
    rotaryId: " RID-3131A ",
  });
  const payload = buildProfileUpdatePayload(draft, { role: "bod", today: "2026-07-12" });

  assert.equal(draft.rotaryId, "RID-3131A");
  assert.equal(payload.rotaryId, "RID-3131A");
});

test("member profile Rotary ID accepts alphanumeric values without changing required fields", () => {
  const draft = {
    ...createProfileDraft({ role: "gbm", name: "" }),
    rotaryId: "A1B2C3",
  };
  const validation = validateProfileDraft(draft, { role: "gbm", today: "2026-07-12" });

  assert.equal(validation.valid, false);
  assert.equal(validation.errors.rotaryId, undefined);
  assert.equal(validation.errors.name, "Enter a full name.");
});

test("prospect dependent fields normalize when toggled off", () => {
  let draft = createProfileDraft({
    role: "prospect",
    name: "Prospect",
    previousRotaract: true,
    previousRotaractDetails: "College club",
    referred: true,
    referredBy: "Member",
  });
  draft = updateProfileDraft(draft, "previousRotaract", "no");
  draft = updateProfileDraft(draft, "referred", "no");
  const payload = buildProfileUpdatePayload(draft, { role: "prospect", today: "2026-07-12" });
  assert.equal(payload.previousRotaract, false);
  assert.equal(payload.previousRotaractDetails, "N/A");
  assert.equal(payload.referred, false);
  assert.equal(payload.referredBy, "N/A");
});

test("profile draft validation catches dependent required fields", () => {
  const draft = {
    ...createProfileDraft({ role: "prospect", name: "Prospect" }),
    previousRotaract: "yes",
    previousRotaractDetails: "",
    referred: "yes",
    referredBy: "",
  };
  const result = validateProfileDraft(draft, { role: "prospect", today: "2026-07-12" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.previousRotaractDetails);
  assert.ok(result.errors.referredBy);
});

test("history values show blank values as not recorded", () => {
  assert.equal(formatProfileHistoryValue(""), "Not recorded");
  assert.equal(formatProfileHistoryValue(true), "Yes");
  assert.equal(formatProfileHistoryValue(false), "No");
});
