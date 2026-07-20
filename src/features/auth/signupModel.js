import {
  isValidAuthEmail,
  normalizeAuthEmail,
} from "./emailModel.js";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSIONS,
} from "../legal/legalConstants.js";
import { stripRotaractorPrefix } from "../../utils/memberName.js";

export const SIGNUP_PATHS = {
  CHOICE: "choice",
  PROSPECT: "prospect",
  EXISTING_MEMBER: "existing-member",
  DISTRICT_OFFICIAL: "district-official",
};

export const DISTRICT_OFFICIAL_ROLE = "districtOfficial";
export const DISTRICT_OFFICIAL_SIGNUP_TYPE = "district-official";
export const SIGNUP_ROLES = ["gbm", "bod", "admin"];
export const DISTRICT_OFFICIAL_POSITIONS = [
  "DRR",
  "DZR",
  "District Secretary",
  "District Council Member",
  "District Official",
  "Other",
];
export const SIGNUP_GENDERS = [
  "woman",
  "man",
  "non-binary",
  "self-describe",
  "prefer-not-to-say",
];
export const SIGNUP_PASSWORD_MIN_LENGTH = 6;

export function createSignupForm() {
  return {
    path: SIGNUP_PATHS.CHOICE,
    name: "",
    phone: "",
    dateOfBirth: "",
    email: "",
    rid: "",
    gender: "",
    genderSelfDescribe: "",
    password: "",
    confirmPassword: "",
    requestedRole: "gbm",
    inviteCode: "",
    districtOfficialPosition: "",
    hobbies: "",
    previousRotaract: "",
    previousRotaractDetails: "",
    joinReason: "",
    referred: "",
    referredBy: "",
    legalAccepted: false,
    communicationsOptIn: false,
  };
}

export function normalizeSignupName(value) {
  return stripRotaractorPrefix(value);
}

export function normalizeSignupText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSignupRole(value) {
  const role = normalizeSignupText(value);
  const normalized = role.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "districtofficial") return DISTRICT_OFFICIAL_ROLE;
  return role.toLowerCase();
}

export function normalizeSignupPhone(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSignupDateOfBirth(value) {
  const date = typeof value === "string" ? value.trim() : "";
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const monthDays = month === 2
    ? year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0) ? 29 : 28
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > monthDays) return "";
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (date > today) return "";
  return date;
}

export function validateSignupDateOfBirth(value) {
  const date = typeof value === "string" ? value.trim() : "";
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Use YYYY-MM-DD.";
  if (!normalizeSignupDateOfBirth(date)) return "Enter a valid date of birth.";
  return "";
}

export function normalizeSignupRid(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasSignupRidControlChars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function validateSignupRid(value) {
  const rid = normalizeSignupRid(value);
  if (!rid) return "";
  if (rid.length > 40) return "RID must be 40 characters or fewer.";
  if (hasSignupRidControlChars(rid)) return "RID cannot include control characters.";
  return "";
}

export function normalizeSignupEmail(value) {
  return normalizeAuthEmail(value);
}

export function normalizeSignupPassword(value) {
  return typeof value === "string" ? value : "";
}

export function selectSignupPath(form, path) {
  const selectedPath = [
    SIGNUP_PATHS.PROSPECT,
    SIGNUP_PATHS.EXISTING_MEMBER,
    SIGNUP_PATHS.DISTRICT_OFFICIAL,
  ].includes(path)
    ? path
    : SIGNUP_PATHS.CHOICE;
  const base = {
    ...form,
    path: selectedPath,
    password: "",
    confirmPassword: "",
    inviteCode: "",
  };
  if (base.path === SIGNUP_PATHS.PROSPECT) {
    return { ...base, requestedRole: "prospect", rid: "" };
  }
  if (base.path === SIGNUP_PATHS.EXISTING_MEMBER) {
    return {
      ...base,
      requestedRole: SIGNUP_ROLES.includes(form.requestedRole) ? form.requestedRole : "gbm",
      rid: normalizeSignupRid(form.rid),
      hobbies: "",
      previousRotaract: "",
      previousRotaractDetails: "",
      joinReason: "",
      referred: "",
      referredBy: "",
      districtOfficialPosition: "",
    };
  }
  if (base.path === SIGNUP_PATHS.DISTRICT_OFFICIAL) {
    return {
      ...base,
      phone: "",
      dateOfBirth: "",
      rid: "",
      gender: "",
      genderSelfDescribe: "",
      requestedRole: DISTRICT_OFFICIAL_ROLE,
      hobbies: "",
      previousRotaract: "",
      previousRotaractDetails: "",
      joinReason: "",
      referred: "",
      referredBy: "",
      districtOfficialPosition: normalizeSignupText(form.districtOfficialPosition),
    };
  }
  return createSignupForm();
}

export function updateSignupField(form, field, value) {
  if (!Object.hasOwn(form, field) || field === "path") return form;
  const next = { ...form, [field]: value };
  if (field === "gender" && value !== "self-describe") next.genderSelfDescribe = "";
  if (field === "previousRotaract" && value !== "yes") next.previousRotaractDetails = "";
  if (field === "referred" && value !== "yes") next.referredBy = "";
  if (field === "requestedRole" && value !== "admin") next.inviteCode = "";
  return next;
}

export function validateSignup(form, options = {}) {
  const errors = {};
  const requireCredentials = options.requireCredentials !== false;
  const minimalProfileCompletion = options.profileCompletion === true
    && form.path === SIGNUP_PATHS.EXISTING_MEMBER;
  const districtOfficialSignup = form.path === SIGNUP_PATHS.DISTRICT_OFFICIAL;
  const requireClubProfileDetails = !minimalProfileCompletion && !districtOfficialSignup;
  const name = normalizeSignupName(form.name);
  const phone = normalizeSignupPhone(form.phone);
  const rid = normalizeSignupRid(form.rid);
  const dateOfBirthError = validateSignupDateOfBirth(form.dateOfBirth);
  const email = normalizeSignupEmail(options.identityEmail || form.email);
  const password = normalizeSignupPassword(form.password);
  const confirmation = normalizeSignupPassword(form.confirmPassword);

  if (!name) errors.name = "Enter your full name.";
  if (requireClubProfileDetails && !phone) errors.phone = "Enter your phone number.";
  if (requireClubProfileDetails && dateOfBirthError) errors.dateOfBirth = dateOfBirthError;
  if (!email) errors.email = "Enter your email address.";
  else if (!isValidAuthEmail(email)) errors.email = "Enter a valid email address.";
  if (requireClubProfileDetails && !SIGNUP_GENDERS.includes(form.gender)) {
    errors.gender = "Select a gender option.";
  }
  if (requireClubProfileDetails && form.gender === "self-describe" && !normalizeSignupText(form.genderSelfDescribe)) {
    errors.genderSelfDescribe = "Please describe your gender.";
  }

  if (form.path === SIGNUP_PATHS.PROSPECT) {
    if (!normalizeSignupText(form.hobbies)) errors.hobbies = "Tell us about your hobbies or interests.";
    if (!["yes", "no"].includes(form.previousRotaract)) {
      errors.previousRotaract = "Select whether you have been part of Rotaract before.";
    }
    if (form.previousRotaract === "yes" && !normalizeSignupText(form.previousRotaractDetails)) {
      errors.previousRotaractDetails = "Describe your previous Rotaract experience.";
    }
    if (!normalizeSignupText(form.joinReason)) errors.joinReason = "Tell us why you want to join RCPH.";
    if (!["yes", "no"].includes(form.referred)) {
      errors.referred = "Select whether someone referred you.";
    }
    if (form.referred === "yes" && !normalizeSignupName(form.referredBy)) {
      errors.referredBy = "Enter the name of the person who referred you.";
    }
  } else if (form.path === SIGNUP_PATHS.EXISTING_MEMBER) {
    if (!SIGNUP_ROLES.includes(form.requestedRole)) errors.requestedRole = "Choose GBM, BOD, or Admin.";
    const ridError = validateSignupRid(rid);
    if (ridError) errors.rid = ridError;
    if (form.requestedRole === "admin" && !normalizeSignupText(form.inviteCode)) {
      errors.inviteCode = "Enter the Admin invite code.";
    }
  } else if (districtOfficialSignup) {
    if (!DISTRICT_OFFICIAL_POSITIONS.includes(normalizeSignupText(form.districtOfficialPosition))) {
      errors.districtOfficialPosition = "Choose your District position.";
    }
  } else {
    errors.path = "Choose an account type.";
  }

  if (requireCredentials) {
    if (!password) errors.password = "Enter a password.";
    else if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
      errors.password = `Use at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters.`;
    }
    if (!confirmation) errors.confirmPassword = "Confirm your password.";
    else if (password !== confirmation) errors.confirmPassword = "Passwords do not match.";
  }

  if (form.legalAccepted !== true) {
    errors.legalAccepted = "You must accept the Terms and Conditions and Privacy Notice to create an account.";
  }

  return {
    errors,
    values: { name, phone, email, password },
    valid: Object.keys(errors).length === 0,
  };
}

export function buildSignupPayload(form, options = {}) {
  const provider = options.provider === "google" ? "google" : "password";
  const consentSource = form.path === SIGNUP_PATHS.PROSPECT
    ? "prospect-signup"
    : form.path === SIGNUP_PATHS.DISTRICT_OFFICIAL
      ? "district-official-signup"
    : "member-signup";
  const consent = {
    termsAccepted: form.legalAccepted === true,
    termsVersion: LEGAL_VERSIONS.terms,
    privacyAccepted: form.legalAccepted === true,
    privacyVersion: LEGAL_VERSIONS.privacy,
    communicationsOptIn: form.communicationsOptIn === true,
    communicationsVersion: LEGAL_VERSIONS.communications,
    consentSource,
    legalEffectiveDate: LEGAL_EFFECTIVE_DATE,
  };
  if (form.path === SIGNUP_PATHS.DISTRICT_OFFICIAL) {
    const position = normalizeSignupText(form.districtOfficialPosition);
    return {
      name: normalizeSignupName(form.name),
      email: normalizeSignupEmail(options.identityEmail || form.email),
      role: DISTRICT_OFFICIAL_ROLE,
      requestedRole: DISTRICT_OFFICIAL_ROLE,
      signupType: DISTRICT_OFFICIAL_SIGNUP_TYPE,
      position,
      districtOfficialPosition: position,
      provider,
      ...consent,
    };
  }
  if (options.profileCompletion === true && form.path === SIGNUP_PATHS.EXISTING_MEMBER) {
    const rid = normalizeSignupRid(form.rid);
    return {
      name: normalizeSignupName(form.name),
      requestedRole: form.requestedRole,
      provider,
      ...(rid ? { rid } : {}),
      ...consent,
      ...(form.requestedRole === "admin"
        ? { inviteCode: normalizeSignupText(form.inviteCode) }
        : {}),
    };
  }
  const base = {
    name: normalizeSignupName(form.name),
    phone: normalizeSignupPhone(form.phone),
    dateOfBirth: normalizeSignupDateOfBirth(form.dateOfBirth),
    email: normalizeSignupEmail(options.identityEmail || form.email),
    requestedRole: form.path === SIGNUP_PATHS.PROSPECT ? "prospect" : form.requestedRole,
    provider,
    gender: SIGNUP_GENDERS.includes(form.gender) ? form.gender : "",
genderSelfDescribe: form.gender === "self-describe"
  ? normalizeSignupText(form.genderSelfDescribe)
  : "",
    ...consent,
  };

  if (form.path === SIGNUP_PATHS.PROSPECT) {
    return {
      ...base,
      signupType: "prospect",
      requestedRole: "prospect",
      hobbies: normalizeSignupText(form.hobbies),
      previousRotaract: form.previousRotaract === "yes",
previousRotaractDetails: form.previousRotaract === "yes"
  ? normalizeSignupText(form.previousRotaractDetails)
  : "N/A",
      joinReason: normalizeSignupText(form.joinReason),
      referred: form.referred === "yes",
      referredBy: form.referred === "yes" ? normalizeSignupName(form.referredBy) : "N/A",
    };
  }

  return {
    ...base,
    ...(normalizeSignupRid(form.rid) ? { rid: normalizeSignupRid(form.rid) } : {}),
    ...(form.requestedRole === "admin"
      ? { inviteCode: normalizeSignupText(form.inviteCode) }
      : {}),
  };
}

export function classifySignupOutcome(result) {
  const status = typeof result?.status === "string" ? result.status.trim().toLowerCase() : "";
  const role = normalizeSignupRole(result?.role);
  if (status === "approved" && ["prospect", "gbm", "bod", "admin", "president", DISTRICT_OFFICIAL_ROLE].includes(role)) {
    return { kind: "approved", role, existing: result?.existing === true, refreshTrustedAccess: true };
  }
  if (status === "pending") {
    return {
      kind: "pending",
      role: "pending",
      requestedRole: typeof result?.requestedRole === "string"
        ? normalizeSignupRole(result.requestedRole)
        : "",
      signOut: true,
    };
  }
  return { kind: "unresolved", refreshTrustedAccess: false };
}

export function clearSignupSensitiveFields(form) {
  return { ...form, password: "", confirmPassword: "", inviteCode: "" };
}

export function clearSignupFieldError(errors, field) {
  if (!errors?.[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
