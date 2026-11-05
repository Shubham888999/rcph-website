import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROSPECT_WELCOME_COPY } from "./prospectWelcomeCopy.js";
import {
  PROSPECT_STEPS,
  SIGNUP_PATHS,
  applySignupAttribution,
  buildSignupPayload,
  clearProspectOptionalFields,
  createSignupForm,
  parseSignupPathParam,
  getProfileCompletionPath,
  prefillSignupIdentity,
  selectSignupPath,
  validateProspectStep,
  validateSignup,
} from "./signupModel.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function requiredProspect() {
  return {
    ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.PROSPECT),
    name: "Asha Member",
    phone: "+91 98765 43210",
    email: "asha@example.com",
    dateOfBirth: "1999-02-03",
    password: "secret",
    confirmPassword: "secret",
    legalAccepted: true,
  };
}

test("path param opens the matching signup path", () => {
  assert.equal(parseSignupPathParam("prospect"), SIGNUP_PATHS.PROSPECT);
  assert.equal(parseSignupPathParam("member"), SIGNUP_PATHS.EXISTING_MEMBER);
  assert.equal(parseSignupPathParam("district"), SIGNUP_PATHS.DISTRICT_OFFICIAL);
  for (const value of [null, "", "admin", "existing-member", "constructor", "__proto__"]) {
    assert.equal(parseSignupPathParam(value), SIGNUP_PATHS.CHOICE, `${value} falls back to the choice screen`);
  }
});

test("district path param waits for the availability check", async () => {
  const page = await read("../../pages/auth/SignupPage.jsx");
  assert.match(page, /requestedPath === SIGNUP_PATHS\.DISTRICT_OFFICIAL\) return createSignupForm\(\)/);
  assert.match(page, /result\?\.available === true && requestedPath === SIGNUP_PATHS\.DISTRICT_OFFICIAL/);
});

test("Prospect step 1 needs only the required fields", () => {
  const result = validateProspectStep(requiredProspect(), PROSPECT_STEPS.DETAILS);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

for (const [field, value] of [
  ["name", ""],
  ["phone", ""],
  ["email", ""],
  ["dateOfBirth", ""],
  ["password", ""],
  ["confirmPassword", ""],
  ["legalAccepted", false],
]) {
  test(`Prospect step 1 requires ${field}`, () => {
    const result = validateProspectStep({ ...requiredProspect(), [field]: value }, PROSPECT_STEPS.DETAILS);
    assert.equal(result.valid, false);
    assert.ok(result.errors[field]);
  });
}

test("Prospect step 1 skips the password for Google and profile completion", () => {
  const form = { ...requiredProspect(), password: "", confirmPassword: "" };
  const options = { requireCredentials: false, profileCompletion: true, identityEmail: "asha@example.com" };
  assert.equal(validateProspectStep(form, PROSPECT_STEPS.DETAILS, options).valid, true);
  assert.ok(validateProspectStep({ ...form, dateOfBirth: "" }, PROSPECT_STEPS.DETAILS, options).errors.dateOfBirth);
});

test("Prospect step 2 is entirely optional, including follow-up answers", () => {
  assert.equal(validateProspectStep(createSignupForm(), PROSPECT_STEPS.ABOUT).valid, true);
  const followUpsBlank = { ...requiredProspect(), gender: "self-describe", previousRotaract: "yes", referred: "yes" };
  assert.deepEqual(validateSignup(followUpsBlank).errors, {});
});

test("Existing Member validation is unchanged by the Prospect rules", () => {
  const member = {
    ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.EXISTING_MEMBER),
    name: "Ravi",
    phone: "1",
    email: "ravi@example.com",
    password: "secret",
    confirmPassword: "secret",
    legalAccepted: true,
  };
  assert.ok(validateSignup(member).errors.gender, "gender stays required");
  assert.equal(validateSignup({ ...member, gender: "man" }).valid, true, "date of birth stays optional");
  assert.ok(validateSignup(createSignupForm()).errors.path, "the chooser still has no valid path");
});

test("Skip discards optional answers but keeps an invite's referred flag", () => {
  const answered = { ...requiredProspect(), gender: "woman", hobbies: "Music", joinReason: "Service", referred: "yes", referredBy: "Ravi" };
  const skipped = clearProspectOptionalFields(answered, null);
  assert.equal(skipped.gender, "");
  assert.equal(skipped.hobbies, "");
  assert.equal(skipped.joinReason, "");
  assert.equal(skipped.referred, "");
  assert.equal(skipped.referredBy, "");
  assert.equal(skipped.phone, answered.phone, "required fields survive");
  assert.equal(clearProspectOptionalFields(answered, { ref: "abcd2345" }).referred, "yes");
});

test("An invite preselects Were you referred on the Prospect path only", () => {
  const prospect = selectSignupPath(createSignupForm(), SIGNUP_PATHS.PROSPECT);
  assert.equal(applySignupAttribution(prospect, { ref: "abcd2345" }).referred, "yes");
  assert.equal(applySignupAttribution(prospect, { ref: "", src: "insta" }).referred, "");
  assert.equal(applySignupAttribution({ ...prospect, referred: "no" }, { ref: "abcd2345" }).referred, "no");
  const member = selectSignupPath(createSignupForm(), SIGNUP_PATHS.EXISTING_MEMBER);
  assert.equal(applySignupAttribution(member, { ref: "abcd2345" }), member);
});

test("Google identity fills email and a blank name, then settles", () => {
  const user = { email: "asha@gmail.com", displayName: "Asha Google" };
  const prefilled = prefillSignupIdentity(requiredProspect(), user);
  assert.equal(prefilled.email, "asha@gmail.com");
  assert.equal(prefilled.name, "Asha Member", "a typed name is kept");
  assert.equal(prefillSignupIdentity({ ...requiredProspect(), name: "" }, user).name, "Asha Google");
  assert.equal(prefillSignupIdentity(prefilled, user), prefilled, "no change once applied, so rendering converges");
  const cleared = { ...prefilled, name: "" };
  assert.equal(prefillSignupIdentity(cleared, user), cleared, "clearing the name does not refill it");
});

test("An auth-only Google user resumes on the Prospect form; other sign-ins keep the chooser", () => {
  assert.equal(getProfileCompletionPath({ providerData: [{ providerId: "google.com" }] }), SIGNUP_PATHS.PROSPECT);
  assert.equal(getProfileCompletionPath({ providerData: [{ providerId: "password" }] }), SIGNUP_PATHS.CHOICE);
  assert.equal(getProfileCompletionPath({ providerData: [] }), SIGNUP_PATHS.CHOICE);
  assert.equal(getProfileCompletionPath(null), SIGNUP_PATHS.CHOICE);
});

test("Login sends a profile-missing account to signup instead of a dead end", async () => {
  const login = await read("../../pages/auth/LoginPage.jsx");
  const redirect = login.indexOf('if (accountState === "profile-missing") return <Navigate to="/signup" replace />;');
  assert.notEqual(redirect, -1);
  assert.ok(login.indexOf("if (isAuthenticated) {") < redirect, "only for a signed-in account");
  assert.ok(redirect < login.indexOf("<AuthStateScreen state={accountState}"), "before the generic account state screen");
});

test("Signup reopens an auth-only account once, and Back to account type still works", async () => {
  const page = await read("../../pages/auth/SignupPage.jsx");
  assert.match(page, /if \(profileCompletion && user && !completionPathResolved\) \{\s*setCompletionPathResolved\(true\);/);
  assert.match(page, /getProfileCompletionPath\(user\)/);
  assert.match(page, /form\.path === SIGNUP_PATHS\.CHOICE && requestedPath === SIGNUP_PATHS\.CHOICE/, "an explicit ?path= is respected");
});

test("Profile completion locks the email, hides the password and offers a way out", async () => {
  const page = await read("../../pages/auth/SignupPage.jsx");
  const form = await read("./ProspectSignupForm.jsx");
  assert.match(form, /emailLocked=\{profileCompletion\}/);
  assert.match(form, /showCredentials=\{!profileCompletion\}/);
  assert.match(page, /\{profileCompletion && user \? \(/);
  assert.match(page, /Not you\?/);
  assert.match(page, /onClick=\{handleSignOutOfCompletion\}/);
});

test("Required-only Prospect payload sends blank optional answers and attribution", () => {
  const payload = buildSignupPayload(requiredProspect(), {
    attribution: { ref: "abcd2345", src: "insta-bio", landingPath: "/join", firstSeenAt: "x" },
  });
  assert.equal(payload.dateOfBirth, "1999-02-03");
  assert.equal(payload.gender, "");
  assert.equal(payload.hobbies, "");
  assert.equal(payload.joinReason, "");
  assert.equal(payload.previousRotaract, false);
  assert.equal(payload.referred, false);
  assert.equal(payload.signupSource, "insta-bio");
  assert.equal(payload.referralCode, "abcd2345");
  assert.equal(payload.landingPath, "/join");
  assert.equal("firstSeenAt" in payload, false);
});

test("Member and District payloads also carry attribution", () => {
  const attribution = { src: "insta-bio", landingPath: "/join" };
  const member = { ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.EXISTING_MEMBER), name: "Ravi" };
  const district = { ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.DISTRICT_OFFICIAL), name: "DRR" };
  assert.equal(buildSignupPayload(member, { attribution }).signupSource, "insta-bio");
  assert.equal(buildSignupPayload(member, { attribution, profileCompletion: true }).signupSource, "insta-bio");
  assert.equal(buildSignupPayload(district, { attribution }).signupSource, "insta-bio");
});

test("Prospect form puts Google first and splits the questions across two steps", async () => {
  const form = await read("./ProspectSignupForm.jsx");
  const stepTwo = form.slice(form.indexOf("step === PROSPECT_STEPS.ABOUT"), form.indexOf("Step 1 of 2"));
  const stepOne = form.slice(form.indexOf("Step 1 of 2"));
  assert.ok(stepOne.indexOf("<GoogleSignupButton") < stepOne.indexOf("<form"), "Google sits above the form");
  assert.match(stepOne, /or sign up with email/);
  assert.match(stepOne, /You were invited by an RCPH member/);
  assert.match(stepOne, /hideGender/);
  assert.match(stepOne, /<SignupConsents/);
  assert.match(stepOne, />Next</);
  for (const id of ["SignupGenderFields", "signup-hobbies", "signup-previousRotaract", "signup-joinReason", "signup-referred"]) {
    assert.match(stepTwo, new RegExp(id), `${id} is on step 2`);
    assert.doesNotMatch(stepOne, new RegExp(id), `${id} is not on step 1`);
  }
  assert.match(stepTwo, /Create my account/);
  assert.match(stepTwo, /Skip and create account/);
  assert.match(form, /headingRef\.current\?\.focus\(\);\s*\}, \[step\]\)/, "focus moves to the heading on step change");
});

test("Member and District forms keep Google below the form", async () => {
  for (const file of ["./ExistingMemberSignupForm.jsx", "./DistrictOfficialSignupForm.jsx"]) {
    const form = await read(file);
    assert.ok(form.indexOf("</form>") < form.indexOf("<GoogleSignupButton"), `${file} is unchanged`);
  }
});

test("Prospect Google only creates the identity, and the signup call stays at the end", async () => {
  const page = await read("../../pages/auth/SignupPage.jsx");
  const google = page.slice(page.indexOf("const handleProspectGoogle"), page.indexOf("const handleSignup = "));
  assert.match(google, /signInOrCreateGoogleSignup\(\)/);
  assert.doesNotMatch(google, /createUserProfileAfterSignup|runSignupWorkflow/);
  assert.match(page, /onGoogle=\{handleProspectGoogle\}/);
  assert.match(page, /onSkip=\{\(\) => handleSignup\("password", \{ skipOptional: true \}\)\}/);
  assert.equal(page.match(/runSignupWorkflow\(/g).length, 1, "one submission path");
});

test("A new Prospect sees the welcome screen instead of the immediate redirect", async () => {
  const page = await read("../../pages/auth/SignupPage.jsx");
  assert.match(page, /accountState === "approved" && !prospectWelcome/);
  assert.match(page, /outcome\.role === "prospect" && !outcome\.existing\) \{\s*setProspectWelcome\(true\)/);
  assert.ok(page.indexOf("if (prospectWelcome) {") < page.indexOf("if (authLoading)"));
});

test("Prospect welcome copy lives in one constant and the event block can hide", async () => {
  assert.match(PROSPECT_WELCOME_COPY.title, /Welcome to RCPH!/);
  assert.equal(PROSPECT_WELCOME_COPY.body, "Your Prospect account is ready. Come to our next event, meet the team, and start your journey.");
  assert.doesNotMatch(JSON.stringify(PROSPECT_WELCOME_COPY), /review|within 2 days/i, "Prospects are auto-approved, so no copy promises a review");
  const welcome = await read("./ProspectWelcome.jsx");
  assert.match(welcome, /\{nextEvent \? \(/);
  assert.match(welcome, /to="\/events"/);
  assert.match(welcome, /to="\/contact"/);
  assert.doesNotMatch(welcome, /account is ready|Welcome to RCPH/, "no copy hardcoded in the component");
});

test("Pending paths keep their current success text", async () => {
  const success = await read("./SignupSuccess.jsx");
  assert.match(success, /Your \{role\} request is pending/);
});

test("Join CTAs apply and request access through signup and keep Contact and FAQ", async () => {
  const hero = await read("../join/JoinHero.jsx");
  const cta = await read("../join/JoinCallToAction.jsx");
  for (const source of [hero, cta]) {
    assert.match(source, /to=\{buildSignupHref\("prospect", attribution\)\}[\s\S]*Apply to join/);
    assert.match(source, /to=\{buildSignupHref\("member", attribution\)\}[\s\S]*Already a member\? Request access/);
    assert.match(source, /to="\/contact"/);
    assert.doesNotMatch(source, /Create Member Account/);
  }
  assert.match(cta, /to="\/faq"/);
});

test("Attribution is captured at the router root so every page is covered", async () => {
  const metadata = await read("../../app/RouteMetadata.jsx");
  assert.match(metadata, /captureAttribution\(\{ pathname, search \}\)/);
});
