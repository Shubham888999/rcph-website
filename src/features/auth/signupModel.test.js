import assert from "node:assert/strict";
import test from "node:test";
import {
  SIGNUP_PATHS,
  buildSignupPayload,
  classifySignupOutcome,
  clearSignupFieldError,
  clearSignupSensitiveFields,
  createSignupForm,
  normalizeSignupEmail,
  normalizeSignupName,
  normalizeSignupPassword,
  normalizeSignupPhone,
  selectSignupPath,
  updateSignupField,
  validateSignup,
  normalizeSignupText,
} from "./signupModel.js";
import { getSignupDiagnostic, getSignupError } from "./signupErrors.js";

function validProspect() {
  return {
    ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.PROSPECT),
    name: "  Asha Member  ",
    phone: " +91 98765 43210 ",
    email: " ASHA@Example.COM ",
    gender: "woman",
    password: "secret",
    confirmPassword: "secret",
    hobbies: "Reading",
    previousRotaract: "no",
    joinReason: "Community service",
    referred: "no",
    legalAccepted: true,
  };
}

function validMember(role = "gbm") {
  return {
    ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.EXISTING_MEMBER),
    name: "Ravi Member",
    phone: "+91 90000 00000",
    email: "ravi@example.com",
    gender: "man",
    password: "secret",
    confirmPassword: "secret",
    requestedRole: role,
    inviteCode: role === "admin" ? "invite-value" : "",
    legalAccepted: true,
  };
}

test("initial state starts at chooser", () => {
  assert.equal(createSignupForm().path, "choice");
  assert.equal(createSignupForm().legalAccepted, false);
  assert.equal(createSignupForm().communicationsOptIn, false);
});
test("selecting Prospect clears member credentials and forces role", () => {
  const next = selectSignupPath({ ...validMember("admin"), password: "x", inviteCode: "code" }, "prospect");
  assert.equal(next.requestedRole, "prospect");
  assert.equal(next.password, "");
  assert.equal(next.inviteCode, "");
});
test("selecting Existing Member clears Prospect-only fields", () => {
  const next = selectSignupPath(validProspect(), "existing-member");
  assert.equal(next.hobbies, "");
  assert.equal(next.joinReason, "");
  assert.equal(next.requestedRole, "gbm");
});
test("returning to chooser clears passwords and invite code", () => {
  const next = selectSignupPath(validMember("admin"), "choice");
  assert.equal(next.path, "choice");
  assert.equal(next.password, "");
  assert.equal(next.confirmPassword, "");
  assert.equal(next.inviteCode, "");
});
test("name normalization trims whitespace and strips manual Rtr prefixes", () => {
  assert.equal(normalizeSignupName("  Asha M.  "), "Asha M.");
  assert.equal(normalizeSignupName("Rtr. Rtr. Asha M."), "Asha M.");
});
test("email normalization trims and lowercases", () => {
  assert.equal(normalizeSignupEmail(" USER@Example.COM "), "user@example.com");
});
test("dshubham8788@gmail.com is a valid signup email", () => {
  assert.equal(validateSignup({ ...validMember(), email: "dshubham8788@gmail.com" }).errors.email, undefined);
});
test("signup email rejects missing address parts", () => {
  assert.ok(validateSignup({ ...validMember(), email: "dshubham8788.gmail.com" }).errors.email);
  assert.ok(validateSignup({ ...validMember(), email: "dshubham8788@" }).errors.email);
  assert.ok(validateSignup({ ...validMember(), email: "@gmail.com" }).errors.email);
});
test("editing email clears its previous field error", () => {
  const errors = { email: "Enter a valid email address.", phone: "Keep this error." };
  assert.deepEqual(clearSignupFieldError(errors, "email"), { phone: "Keep this error." });
});
test("signup validation uses the latest edited email value", () => {
  const invalid = { ...validMember(), email: "not-an-email" };
  const edited = updateSignupField(invalid, "email", "dshubham8788@gmail.com");
  const result = validateSignup(edited);
  assert.equal(result.valid, true);
  assert.equal(result.values.email, "dshubham8788@gmail.com");
});
test("phone normalization preserves practical formatting and plus", () => {
  assert.equal(normalizeSignupPhone(" +91 98765-43210 "), "+91 98765-43210");
});
test("required common fields are rejected", () => {
  const result = validateSignup(selectSignupPath(createSignupForm(), "existing-member"));
  assert.ok(result.errors.name && result.errors.phone && result.errors.email && result.errors.gender);
});
test("signup text normalization preserves Rtr-like ordinary text", () => {
  assert.equal(
    normalizeSignupText("Rtr. is commonly used in Rotaract"),
    "Rtr. is commonly used in Rotaract",
  );
});
test("mandatory legal acceptance blocks signup", () => {
  const result = validateSignup({ ...validMember(), legalAccepted: false });
  assert.match(result.errors.legalAccepted, /must accept/i);
});
test("optional communications choice never blocks signup", () => {
  assert.equal(validateSignup({ ...validMember(), communicationsOptIn: false }).valid, true);
  assert.equal(validateSignup({ ...validMember(), communicationsOptIn: true }).valid, true);
});
test("password normalization preserves exact text", () => {
  assert.equal(normalizeSignupPassword(" secret "), " secret ");
});
test("password confirmation must match exactly", () => {
  const result = validateSignup({ ...validMember(), password: "secret ", confirmPassword: "secret" });
  assert.ok(result.errors.confirmPassword);
});
test("password below Firebase minimum is rejected", () => {
  assert.ok(validateSignup({ ...validMember(), password: "12345", confirmPassword: "12345" }).errors.password);
});
test("gender self-description is required only for self-described option", () => {
  const invalid = validateSignup({ ...validMember(), gender: "self-describe" });
  const valid = validateSignup({ ...validMember(), gender: "woman" });
  assert.ok(invalid.errors.genderSelfDescribe);
  assert.equal(valid.errors.genderSelfDescribe, undefined);
});
test("changing gender clears self-description", () => {
  const next = updateSignupField({ ...validMember(), gender: "self-describe", genderSelfDescribe: "custom" }, "gender", "woman");
  assert.equal(next.genderSelfDescribe, "");
});
test("Prospect role and signup type are forced in payload", () => {
  const payload = buildSignupPayload({ ...validProspect(), requestedRole: "president" });
  assert.equal(payload.requestedRole, "prospect");
  assert.equal(payload.signupType, "prospect");
  assert.equal(payload.consentSource, "prospect-signup");
});
test("previous Rotaract details are conditionally required", () => {
  const result = validateSignup({ ...validProspect(), previousRotaract: "yes", previousRotaractDetails: "" });
  assert.ok(result.errors.previousRotaractDetails);
});
test("changing previous Rotaract to no clears details", () => {
  const next = updateSignupField({ ...validProspect(), previousRotaract: "yes", previousRotaractDetails: "Club" }, "previousRotaract", "no");
  assert.equal(next.previousRotaractDetails, "");
});
test("referrer is conditionally required", () => {
  const result = validateSignup({ ...validProspect(), referred: "yes", referredBy: "" });
  assert.ok(result.errors.referredBy);
});
test("changing referral to no clears referrer", () => {
  const next = updateSignupField({ ...validProspect(), referred: "yes", referredBy: "Member" }, "referred", "no");
  assert.equal(next.referredBy, "");
});
test("Prospect payload excludes confirmation and UI fields", () => {
  const payload = buildSignupPayload({ ...validProspect(), errors: { email: "x" }, busy: true });
  assert.equal("confirmPassword" in payload, false);
  assert.equal("errors" in payload, false);
  assert.equal("busy" in payload, false);
});
for (const role of ["gbm", "bod", "admin"]) {
  test(`existing-member role ${role} is accepted`, () => {
    assert.equal(validateSignup(validMember(role)).errors.requestedRole, undefined);
  });
}
test("President role is rejected", () => {
  assert.ok(validateSignup({ ...validMember(), requestedRole: "president" }).errors.requestedRole);
});
test("invite code is required only for Admin", () => {
  assert.ok(validateSignup({ ...validMember("admin"), inviteCode: "" }).errors.inviteCode);
  assert.equal(validateSignup(validMember("bod")).errors.inviteCode, undefined);
});
test("switching away from Admin clears invite code", () => {
  const next = updateSignupField(validMember("admin"), "requestedRole", "bod");
  assert.equal(next.inviteCode, "");
});
test("existing-member payload uses requested role exactly", () => {
  const payload = buildSignupPayload(validMember("bod"));
  assert.equal(payload.requestedRole, "bod");
  assert.equal(payload.consentSource, "member-signup");
});
test("versioned consent payload normalizes optional choice strictly", () => {
  const payload = buildSignupPayload({ ...validMember(), communicationsOptIn: "true" });
  assert.equal(payload.termsAccepted, true);
  assert.equal(payload.privacyAccepted, true);
  assert.equal(payload.termsVersion, "1.0");
  assert.equal(payload.privacyVersion, "1.0");
  assert.equal(payload.communicationsVersion, "1.0");
  assert.equal(payload.communicationsOptIn, false);
  assert.equal(payload.legalEffectiveDate, "2026-07-02");
  assert.equal("acceptedAt" in payload, false);
});
test("existing-member payload excludes Prospect fields", () => {
  const payload = buildSignupPayload({ ...validMember(), hobbies: "hidden", joinReason: "hidden" });
  assert.equal("hobbies" in payload, false);
  assert.equal("joinReason" in payload, false);
});
test("payload builders whitelist fields", () => {
  const payload = buildSignupPayload({ ...validMember(), arbitraryAuthority: true, role: "president" });
  assert.equal("arbitraryAuthority" in payload, false);
  assert.equal("role" in payload, false);
});
test("password is never included in callable profile payload", () => {
  const payload = buildSignupPayload(validMember());
  assert.equal("password" in payload, false);
  assert.equal("confirmPassword" in payload, false);
});
test("invite code appears only for Admin", () => {
  assert.equal("inviteCode" in buildSignupPayload(validMember("gbm")), false);
  assert.equal(buildSignupPayload(validMember("admin")).inviteCode, "invite-value");
});
test("arbitrary form role cannot override Prospect", () => {
  assert.equal(buildSignupPayload({ ...validProspect(), requestedRole: "admin" }).requestedRole, "prospect");
});
test("profile completion provider is derived from trusted option", () => {
  const payload = buildSignupPayload(validMember(), { provider: "google", identityEmail: "AUTH@Example.com" });
  assert.equal(payload.provider, "google");
  assert.equal(payload.email, "auth@example.com");
});
test("existing-member profile completion uses the legacy minimal callable payload", () => {
  const form = { ...validMember("bod"), phone: "", gender: "" };
  const validation = validateSignup(form, {
    requireCredentials: false,
    profileCompletion: true,
    identityEmail: "auth@example.com",
  });
  const payload = buildSignupPayload(form, {
    provider: "password",
    profileCompletion: true,
    identityEmail: "auth@example.com",
  });
  assert.equal(validation.valid, true);
  assert.deepEqual(payload, {
    name: "Ravi Member",
    requestedRole: "bod",
    provider: "password",
    termsAccepted: true,
    termsVersion: "1.0",
    privacyAccepted: true,
    privacyVersion: "1.0",
    communicationsOptIn: false,
    communicationsVersion: "1.0",
    consentSource: "member-signup",
    legalEffectiveDate: "2026-07-02",
  });
});
test("Prospect approved outcome requests trusted refresh", () => {
  assert.equal(classifySignupOutcome({ status: "approved", role: "prospect" }).refreshTrustedAccess, true);
});
test("GBM approved outcome requests trusted refresh", () => {
  assert.equal(classifySignupOutcome({ status: "approved", role: "gbm" }).refreshTrustedAccess, true);
});
test("BOD pending outcome signs out", () => {
  assert.equal(classifySignupOutcome({ status: "pending", requestedRole: "bod" }).signOut, true);
});
test("Admin pending outcome signs out", () => {
  assert.equal(classifySignupOutcome({ status: "pending", requestedRole: "admin" }).kind, "pending");
});
test("approved existing account remains approved", () => {
  const outcome = classifySignupOutcome({ status: "approved", role: "president", existing: true });
  assert.equal(outcome.kind, "approved");
  assert.equal(outcome.role, "president");
});
test("malformed callable result grants no outcome", () => {
  assert.equal(classifySignupOutcome({ status: "approved", role: "made-up" }).kind, "unresolved");
});
test("duplicate email gets sign-in guidance", () => {
  assert.match(getSignupError({ code: "auth/email-already-in-use" }), /signing in/i);
});
test("invalid Admin invite gets a safe specific message", () => {
  assert.equal(getSignupError({ code: "functions/permission-denied" }, { requestedRole: "admin" }), "The Admin invite code is invalid.");
});
test("raw callable text is never returned", () => {
  const raw = "Firestore users/secret stack details";
  assert.notEqual(getSignupError({ code: "functions/internal", message: raw }), raw);
});
test("development diagnostic contains no sensitive values", () => {
  const diagnostic = getSignupDiagnostic({ code: "functions/internal", message: "password=secret" }, "profile");
  assert.deepEqual(diagnostic, { code: "functions/internal", stage: "profile" });
});
test("Google popup result alone has no access classification", () => {
  assert.equal(classifySignupOutcome({ user: { uid: "mock" } }).kind, "unresolved");
});
test("missing-profile Google completion payload uses authenticated identity", () => {
  const payload = buildSignupPayload(validProspect(), { provider: "google", identityEmail: "identity@example.com" });
  assert.equal(payload.email, "identity@example.com");
  assert.equal(payload.provider, "google");
});
test("existing approved Google account requires trusted refresh", () => {
  assert.equal(classifySignupOutcome({ status: "approved", role: "admin", existing: true }).refreshTrustedAccess, true);
});
test("signup model contains no redirect persistence fields", () => {
  const form = createSignupForm();
  assert.equal("redirectState" in form, false);
  assert.equal("sessionPayload" in form, false);
});
test("clearing sensitive fields preserves non-sensitive form answers", () => {
  const next = clearSignupSensitiveFields(validMember("admin"));
  assert.equal(next.password, "");
  assert.equal(next.confirmPassword, "");
  assert.equal(next.inviteCode, "");
  assert.equal(next.name, "Ravi Member");
});
