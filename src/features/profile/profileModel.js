import { stripRotaractorPrefix } from "../../utils/memberName.js";

export const PROFILE_GENDERS = [
  "woman",
  "man",
  "non-binary",
  "self-describe",
  "prefer-not-to-say",
];

export const PROFILE_FIELD_LABELS = {
  name: "Full name",
  phone: "Phone",
  rotaryId: "RID / Rotary ID",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  genderSelfDescribe: "Gender description",
  hobbies: "Hobbies",
  previousRotaract: "Previous Rotaract",
  previousRotaractDetails: "Rotaract experience",
  joinReason: "Reason for joining",
  referred: "Referred",
  referredBy: "Referred by",
};

function text(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hasControlChars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function todayDateString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, month) {
  if (month === 2) {
    if (year % 400 === 0) return 29;
    if (year % 100 === 0) return 28;
    return year % 4 === 0 ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function normalizeProfileDateOfBirth(value, today = todayDateString()) {
  const date = text(value, 20);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return "";
  if (date < "1900-01-01" || date > today) return "";
  return date;
}

export function getProfileDateOfBirthError(value, today = todayDateString()) {
  const date = text(value, 20);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Use YYYY-MM-DD.";
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return "Enter a valid date.";
  if (date < "1900-01-01") return "Use a date on or after 1900-01-01.";
  if (date > today) return "Date of birth cannot be in the future.";
  return "";
}

export function isProspectProfile(profileOrRole) {
  const role = typeof profileOrRole === "string" ? profileOrRole : profileOrRole?.role;
  return text(role, 40).toLowerCase() === "prospect";
}

export function createProfileDraft(profile = {}) {
  return {
    name: stripRotaractorPrefix(text(profile.name, 160)),
    email: text(profile.email, 320).toLowerCase(),
    role: text(profile.role, 40).toLowerCase(),
    phone: text(profile.phone, 40),
    rotaryId: text(profile.rotaryId || profile.rid || profile.requestedRid, 40),
    dateOfBirth: normalizeProfileDateOfBirth(profile.dateOfBirth),
    gender: PROFILE_GENDERS.includes(text(profile.gender, 40).toLowerCase())
      ? text(profile.gender, 40).toLowerCase()
      : "",
    genderSelfDescribe: text(profile.genderSelfDescribe, 160),
    hobbies: text(profile.hobbies, 600),
    previousRotaract: profile.previousRotaract === true ? "yes" : "no",
    previousRotaractDetails: text(profile.previousRotaractDetails === "N/A" ? "" : profile.previousRotaractDetails, 1200),
    joinReason: text(profile.joinReason, 1200),
    referred: profile.referred === true ? "yes" : "no",
    referredBy: text(profile.referredBy === "N/A" ? "" : profile.referredBy, 160),
  };
}

export function updateProfileDraft(draft, field, value) {
  if (!Object.hasOwn(draft, field)) return draft;
  const next = { ...draft, [field]: value };
  if (field === "gender" && value !== "self-describe") next.genderSelfDescribe = "";
  if (field === "previousRotaract" && value !== "yes") next.previousRotaractDetails = "";
  if (field === "referred" && value !== "yes") next.referredBy = "";
  return next;
}

function maxError(value, max, label) {
  return text(value).length > max ? `${label} must be ${max} characters or fewer.` : "";
}

export function validateProfileDraft(draft, options = {}) {
  const prospect = isProspectProfile(options.role || draft.role);
  const errors = {};
  const name = stripRotaractorPrefix(text(draft.name, 160));

  if (!name) errors.name = "Enter a full name.";
  errors.phone = maxError(draft.phone, 40, "Phone");
  errors.rotaryId = maxError(draft.rotaryId, 40, "RID / Rotary ID");
  if (!errors.rotaryId && hasControlChars(text(draft.rotaryId))) {
    errors.rotaryId = "RID / Rotary ID cannot include control characters.";
  }
  errors.dateOfBirth = getProfileDateOfBirthError(draft.dateOfBirth, options.today || todayDateString());
  if (draft.gender && !PROFILE_GENDERS.includes(draft.gender)) errors.gender = "Select a gender option.";
  if (draft.gender === "self-describe" && !text(draft.genderSelfDescribe, 160)) {
    errors.genderSelfDescribe = "Please describe your gender.";
  }
  errors.genderSelfDescribe ||= maxError(draft.genderSelfDescribe, 160, "Gender description");
  errors.hobbies = maxError(draft.hobbies, 600, "Hobbies");

  if (prospect) {
    if (!["yes", "no"].includes(draft.previousRotaract)) {
      errors.previousRotaract = "Select whether this person has been part of Rotaract before.";
    }
    if (draft.previousRotaract === "yes" && !text(draft.previousRotaractDetails, 1200)) {
      errors.previousRotaractDetails = "Enter previous Rotaract details.";
    }
    errors.previousRotaractDetails ||= maxError(draft.previousRotaractDetails, 1200, "Rotaract experience");
    errors.joinReason = maxError(draft.joinReason, 1200, "Reason for joining");
    if (!["yes", "no"].includes(draft.referred)) {
      errors.referred = "Select whether this person was referred.";
    }
    if (draft.referred === "yes" && !stripRotaractorPrefix(text(draft.referredBy, 160))) {
      errors.referredBy = "Enter the referrer name.";
    }
    errors.referredBy ||= maxError(draft.referredBy, 160, "Referrer");
  }

  Object.keys(errors).forEach((field) => {
    if (!errors[field]) delete errors[field];
  });
  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildProfileUpdatePayload(draft, options = {}) {
  const prospect = isProspectProfile(options.role || draft.role);
  const payload = {
    name: stripRotaractorPrefix(text(draft.name, 160)),
    phone: text(draft.phone, 40),
    dateOfBirth: normalizeProfileDateOfBirth(draft.dateOfBirth, options.today || todayDateString()),
    gender: PROFILE_GENDERS.includes(draft.gender) ? draft.gender : "",
    genderSelfDescribe: draft.gender === "self-describe" ? text(draft.genderSelfDescribe, 160) : "",
    hobbies: text(draft.hobbies, 600),
  };
  if (!prospect) return { ...payload, rotaryId: text(draft.rotaryId, 40) };
  return {
    ...payload,
    previousRotaract: draft.previousRotaract === "yes",
    previousRotaractDetails: draft.previousRotaract === "yes" ? text(draft.previousRotaractDetails, 1200) : "N/A",
    joinReason: text(draft.joinReason, 1200),
    referred: draft.referred === "yes",
    referredBy: draft.referred === "yes" ? stripRotaractorPrefix(text(draft.referredBy, 160)) : "N/A",
  };
}

export function getProfileFieldLabel(field) {
  return PROFILE_FIELD_LABELS[field] || field;
}

export function formatProfileHistoryValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  const normalized = text(value, 1200);
  return normalized || "Not recorded";
}
