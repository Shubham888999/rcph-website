import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DISTRICT_OFFICIAL_ROLE,
  DISTRICT_OFFICIAL_SIGNUP_TYPE,
  SIGNUP_PATHS,
  buildSignupPayload,
  classifySignupOutcome,
  clearSignupFieldError,
  clearSignupSensitiveFields,
  createSignupForm,
  normalizeSignupEmail,
  normalizeSignupDateOfBirth,
  normalizeSignupName,
  normalizeSignupPassword,
  normalizeSignupPhone,
  normalizeSignupRid,
  normalizeSignupRole,
  selectSignupPath,
  updateSignupField,
  validateSignup,
  validateSignupDateOfBirth,
  validateSignupRid,
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

function validDistrictOfficial() {
  return {
    ...selectSignupPath(createSignupForm(), SIGNUP_PATHS.DISTRICT_OFFICIAL),
    name: "PHF. DZR Example",
    email: "dzr@example.com",
    password: "secret",
    confirmPassword: "secret",
    districtOfficialPosition: "DZR",
    legalAccepted: true,
    communicationsOptIn: true,
  };
}

test("initial state starts at chooser", () => {
  assert.equal(createSignupForm().path, "choice");
  assert.equal(createSignupForm().legalAccepted, false);
  assert.equal(createSignupForm().communicationsOptIn, false);
});
test("signup page gates District Official choice on safe availability", async () => {
  const pageSource = await readFile(new URL("../../pages/auth/SignupPage.jsx", import.meta.url), "utf8");
  const choiceSource = await readFile(new URL("./SignupChoice.jsx", import.meta.url), "utf8");
  assert.match(pageSource, /getVisitSignupAvailability\(\)/);
  assert.match(pageSource, /setDistrictOfficialAvailable\(result\?\.available === true\)/);
  assert.match(pageSource, /catch\(\(\) => \{[\s\S]*setDistrictOfficialAvailable\(false\)/);
  assert.match(pageSource, /districtOfficialAvailable=\{districtOfficialAvailable\}/);
  assert.match(choiceSource, /districtOfficialAvailable \? \(/);
  assert.match(choiceSource, /Continue as District Official/);
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
test("selecting District Official clears club/prospect-only fields and forces role", () => {
  const next = selectSignupPath(validProspect(), "district-official");
  assert.equal(next.requestedRole, DISTRICT_OFFICIAL_ROLE);
  assert.equal(next.rid, "");
  assert.equal(next.phone, "");
  assert.equal(next.gender, "");
  assert.equal(next.hobbies, "");
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
test("date of birth is optional date-only profile data", () => {
  assert.equal(normalizeSignupDateOfBirth(""), "");
  assert.equal(normalizeSignupDateOfBirth("1998-02-28"), "1998-02-28");
  assert.equal(normalizeSignupDateOfBirth("1998-02-31"), "");
  assert.equal(validateSignupDateOfBirth(""), "");
  assert.match(validateSignupDateOfBirth("02/28/1998"), /YYYY-MM-DD/);
});
test("signup payload includes optional DOB only as a date string", () => {
  const payload = buildSignupPayload({ ...validMember(), dateOfBirth: " 1998-02-28 " });
  assert.equal(payload.dateOfBirth, "1998-02-28");
  assert.equal(String(payload.dateOfBirth).includes("T"), false);
});
test("RID normalization trims without changing case", () => {
  assert.equal(normalizeSignupRid("  rId-3131-A  "), "rId-3131-A");
});
test("optional existing-member RID validates length and control characters", () => {
  assert.equal(validateSignup(validMember()).errors.rid, undefined);
  assert.equal(validateSignup({ ...validMember(), rid: "RID-3131" }).errors.rid, undefined);
  assert.match(validateSignup({ ...validMember(), rid: "x".repeat(41) }).errors.rid, /40 characters/);
  assert.match(validateSignup({ ...validMember(), rid: "RID\u0001" }).errors.rid, /control characters/);
  assert.equal(validateSignupRid("RID-3131"), "");
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
test("district official role normalization preserves canonical camelCase", () => {
  assert.equal(normalizeSignupRole("districtOfficial"), DISTRICT_OFFICIAL_ROLE);
  assert.equal(normalizeSignupRole("district-official"), DISTRICT_OFFICIAL_ROLE);
  assert.equal(normalizeSignupRole("District Official"), DISTRICT_OFFICIAL_ROLE);
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
test("District Official signup requires position but not member profile fields", () => {
  const missing = validateSignup({ ...validDistrictOfficial(), districtOfficialPosition: "" });
  assert.equal(missing.errors.phone, undefined);
  assert.equal(missing.errors.gender, undefined);
  assert.ok(missing.errors.districtOfficialPosition);
  assert.equal(validateSignup(validDistrictOfficial()).valid, true);
});
test("District Official payload includes pending role shape, position, provider, and consents", () => {
  const payload = buildSignupPayload(validDistrictOfficial(), {
    provider: "google",
    identityEmail: "OFFICIAL@Example.COM",
  });
  assert.deepEqual({
    role: payload.role,
    requestedRole: payload.requestedRole,
    signupType: payload.signupType,
    email: payload.email,
    position: payload.position,
    districtOfficialPosition: payload.districtOfficialPosition,
    provider: payload.provider,
    termsAccepted: payload.termsAccepted,
    privacyAccepted: payload.privacyAccepted,
    communicationsOptIn: payload.communicationsOptIn,
    consentSource: payload.consentSource,
  }, {
    role: DISTRICT_OFFICIAL_ROLE,
    requestedRole: DISTRICT_OFFICIAL_ROLE,
    signupType: DISTRICT_OFFICIAL_SIGNUP_TYPE,
    email: "official@example.com",
    position: "DZR",
    districtOfficialPosition: "DZR",
    provider: "google",
    termsAccepted: true,
    privacyAccepted: true,
    communicationsOptIn: true,
    consentSource: "district-official-signup",
  });
  assert.equal("phone" in payload, false);
  assert.equal("gender" in payload, false);
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
test("existing-member payload includes optional RID only when supplied", () => {
  const empty = buildSignupPayload(validMember("bod"));
  const withRid = buildSignupPayload({ ...validMember("bod"), rid: "  rId-3131-A  " });
  assert.equal("rid" in empty, false);
  assert.equal(withRid.rid, "rId-3131-A");
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
test("Prospect payload never includes RID", () => {
  const payload = buildSignupPayload({ ...validProspect(), rid: "RID-3131" });
  assert.equal("rid" in payload, false);
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
test("existing-member profile completion includes RID only when supplied", () => {
  const payload = buildSignupPayload({ ...validMember("bod"), rid: " RID-NEW " }, {
    provider: "password",
    profileCompletion: true,
    identityEmail: "auth@example.com",
  });
  assert.equal(payload.rid, "RID-NEW");
  assert.equal(payload.email, undefined);
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
test("District Official pending outcome signs out without lowercasing the canonical role", () => {
  const outcome = classifySignupOutcome({ status: "pending", role: "districtOfficial", requestedRole: "district-official" });
  assert.equal(outcome.kind, "pending");
  assert.equal(outcome.requestedRole, DISTRICT_OFFICIAL_ROLE);
  assert.equal(outcome.signOut, true);
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
