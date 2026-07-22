import { AVENUES } from "../calendar/avenues.js";
import { getEventDescriptionForAvenue, normalizeBodReportFinance } from "./bodEventModel.js";

export const BOD_AVENUE_REPORT_LIMIT = 100;
export const REPORTABLE_BOD_AVENUES = AVENUES;

export const BOD_AVENUE_REPORT_DEFAULT_APPEARANCE = Object.freeze({
  fontFamily: "default",
  bodySize: "default",
  density: "standard",
});

export const BOD_AVENUE_REPORT_APPEARANCE_OPTIONS = Object.freeze({
  fontFamilies: Object.freeze([
    Object.freeze({ value: "default", label: "Default" }),
    Object.freeze({ value: "helvetica", label: "Helvetica" }),
    Object.freeze({ value: "times", label: "Times" }),
  ]),
  bodySizes: Object.freeze([
    Object.freeze({ value: "compact", label: "Compact" }),
    Object.freeze({ value: "default", label: "Default" }),
    Object.freeze({ value: "comfortable", label: "Comfortable" }),
    Object.freeze({ value: "large", label: "Large" }),
  ]),
  densities: Object.freeze([
    Object.freeze({ value: "compact", label: "Compact" }),
    Object.freeze({ value: "standard", label: "Standard" }),
    Object.freeze({ value: "comfortable", label: "Comfortable" }),
  ]),
});

const avenueByCode = new Map(REPORTABLE_BOD_AVENUES.map((avenue) => [avenue.code, avenue]));
const validAppearance = {
  fontFamily: new Set(BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.fontFamilies.map((item) => item.value)),
  bodySize: new Set(BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.bodySizes.map((item) => item.value)),
  density: new Set(BOD_AVENUE_REPORT_APPEARANCE_OPTIONS.densities.map((item) => item.value)),
};
const ROLE_LABELS = Object.freeze({
  host: "Host",
  cohost: "Co-host",
  collaborator: "Collaborator",
  participant: "Participant",
});

function cleanText(value, max = 2500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function unique(values) {
  return [...new Set(values)];
}

function monthStart(value) {
  if (!isValidReportMonth(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthIndex(value) {
  const date = monthStart(value);
  return date ? date.getUTCFullYear() * 12 + date.getUTCMonth() : 0;
}

export function isValidReportMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

export function getBodAvenueLabel(code) {
  return avenueByCode.get(cleanText(code, 20).toUpperCase())?.label || "";
}

export function formatBodReportMonth(value) {
  const date = monthStart(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatBodReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Not available";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function normalizeBodReportMonths(value) {
  return unique((Array.isArray(value) ? value : [value]).map((item) => cleanText(item, 7)).filter(isValidReportMonth))
    .sort((left, right) => monthIndex(left) - monthIndex(right));
}

export function normalizeBodReportAvenueCodes(value) {
  const selected = new Set((Array.isArray(value) ? value : [value]).map((item) => cleanText(item, 20).toUpperCase()));
  return REPORTABLE_BOD_AVENUES.map((avenue) => avenue.code).filter((code) => selected.has(code));
}

export function normalizeBodReportAppearance(value = {}) {
  return {
    fontFamily: validAppearance.fontFamily.has(value.fontFamily) ? value.fontFamily : BOD_AVENUE_REPORT_DEFAULT_APPEARANCE.fontFamily,
    bodySize: validAppearance.bodySize.has(value.bodySize) ? value.bodySize : BOD_AVENUE_REPORT_DEFAULT_APPEARANCE.bodySize,
    density: validAppearance.density.has(value.density) ? value.density : BOD_AVENUE_REPORT_DEFAULT_APPEARANCE.density,
  };
}

function isReportableEvent(event) {
  return Boolean(
    event?.id
    && event.recordKind === "clubEvent"
    && event.isActive === true
    && event.archived !== true
    && /^\d{4}-\d{2}-\d{2}$/.test(event.startDate || "")
    && Array.isArray(event.avenues)
    && event.avenues.some((code) => avenueByCode.has(code)),
  );
}

function reportItemDate(event) {
  return cleanText(event?.startDate || event?.date || event?.eventStart, 20);
}

function reportItemName(event) {
  return cleanText(event?.name || event?.title, 180);
}

function isReportableBodMeeting(event) {
  const recordKind = cleanText(event?.recordKind || event?.type, 40);
  const date = reportItemDate(event);
  return Boolean(
    event?.id
    && recordKind === "bodMeeting"
    && event.isActive !== false
    && event.archived !== true
    && /^\d{4}-\d{2}-\d{2}$/.test(date),
  );
}

export function getBodAvenueReportMonthOptions(events, fallbackMonth = "") {
  const months = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (isReportableEvent(event)) months.add(event.startDate.slice(0, 7));
    else if (isReportableBodMeeting(event)) months.add(reportItemDate(event).slice(0, 7));
  }
  if (isValidReportMonth(fallbackMonth)) months.add(fallbackMonth);
  return normalizeBodReportMonths([...months]).map((value) => ({ value, label: formatBodReportMonth(value) }));
}

function selectionFromOptions(options, fallback) {
  const normalized = normalizeBodReportMonths(options.selectedMonths ?? options.month ?? fallback);
  return normalized.length ? normalized : [];
}

function avenuesFromOptions(options) {
  return normalizeBodReportAvenueCodes(options.selectedAvenueCodes ?? options.avenueCode);
}

export function filterBodAvenueReportEvents(events, options = {}) {
  const selectedMonths = selectionFromOptions(options, "");
  const selectedAvenueCodes = avenuesFromOptions(options);
  if (!selectedMonths.length || !selectedAvenueCodes.length) return [];
  const monthSet = new Set(selectedMonths);
  const avenueSet = new Set(selectedAvenueCodes);
  const byId = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!isReportableEvent(event) || byId.has(event.id)) continue;
    if (!monthSet.has(event.startDate.slice(0, 7))) continue;
    if (!event.avenues.some((code) => avenueSet.has(code))) continue;
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((left, right) => (
    left.startDate.localeCompare(right.startDate) || left.name.localeCompare(right.name)
  ));
}

export function filterBodAvenueReportMeetings(events, options = {}) {
  const selectedMonths = selectionFromOptions(options, "");
  if (!selectedMonths.length) return [];
  const monthSet = new Set(selectedMonths);
  const byId = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!isReportableBodMeeting(event) || byId.has(event.id)) continue;
    const date = reportItemDate(event);
    if (!monthSet.has(date.slice(0, 7))) continue;
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((left, right) => (
    reportItemDate(left).localeCompare(reportItemDate(right)) || reportItemName(left).localeCompare(reportItemName(right))
  ));
}

function normalizeDirectorEntries(items) {
  const seen = new Set();
  const directors = [];
  for (const item of Array.isArray(items) ? items : []) {
    const name = cleanText(item?.name, 160);
    const positionTitle = cleanText(item?.positionTitle, 160);
    const key = `${name.toLowerCase()}|${positionTitle.toLowerCase()}`;
    if (!name || !positionTitle || seen.has(key)) continue;
    seen.add(key);
    directors.push({ name, positionTitle });
  }
  return directors.sort((left, right) => left.name.localeCompare(right.name));
}

export function normalizeBodAvenueDirectors(payload, avenueCode) {
  const expectedAvenue = cleanText(avenueCode, 20).toUpperCase();
  if (!payload || payload.ok !== true || cleanText(payload.avenueCode, 20).toUpperCase() !== expectedAvenue) return [];
  return normalizeDirectorEntries(payload.directors);
}

function normalizeDirectorMap({ selectedAvenueCodes, directors, directorsByAvenue }) {
  const map = new Map();
  selectedAvenueCodes.forEach((code) => map.set(code, []));
  if (directorsByAvenue && typeof directorsByAvenue === "object") {
    selectedAvenueCodes.forEach((code) => map.set(code, normalizeDirectorEntries(directorsByAvenue[code])));
  } else if (selectedAvenueCodes.length === 1) {
    map.set(selectedAvenueCodes[0], normalizeDirectorEntries(directors));
  }
  return map;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sumEventMoney(events, key) {
  return roundMoney((Array.isArray(events) ? events : []).reduce((total, event) => total + (Number(event?.[key]) || 0), 0));
}

function reportFinanceTotals(event) {
  const finance = normalizeBodReportFinance(event?.reportFinance);
  return {
    financeEntries: finance.entries,
    expenseTotal: sumEventMoney(finance.entries.filter((entry) => entry.type === "expense"), "amount"),
    incomeTotal: sumEventMoney(finance.entries.filter((entry) => entry.type === "income"), "amount"),
  };
}

function directorLines(directors) {
  return (Array.isArray(directors) ? directors : []).map((item) => `${item.name} (${item.positionTitle})`);
}

function directorTextFromLines(lines) {
  return lines.length ? lines.join(", ") : "Not available";
}

function directorText(directors) {
  return directorTextFromLines(directorLines(directors));
}

function selectedIdsFromOptions(value) {
  if (Array.isArray(value)) return new Set(value);
  if (value instanceof Set) return new Set(value);
  if (value && typeof value[Symbol.iterator] === "function") return new Set(value);
  return new Set();
}

export function createBodAvenueSelection(events) {
  return new Set((Array.isArray(events) ? events : []).map((event) => event?.id).filter(Boolean));
}

export function toggleBodAvenueEvent(selectedIds, eventId, checked) {
  const next = new Set(selectedIds || []);
  if (checked) next.add(eventId);
  else next.delete(eventId);
  return next;
}

function safeCollaborators(event) {
  const names = (Array.isArray(event?.collaborators) ? event.collaborators : [])
    .map((item) => cleanText(typeof item === "string" ? item : item?.name, 180))
    .filter(Boolean);
  if (names.length) return unique(names).join(", ");
  return event?.collaboratorsKnown === false ? "Not available" : "None";
}

function presentationEvent(event, avenueCode = "") {
  const finance = reportFinanceTotals(event);
  return {
    date: event.startDate,
    month: event.startDate.slice(0, 7),
    monthLabel: formatBodReportMonth(event.startDate.slice(0, 7)),
    dateLabel: formatBodReportDate(event.startDate),
    name: cleanText(event.name, 180) || "Unnamed event",
    role: ROLE_LABELS[event.rcphRole] || "Not available",
    hostClub: cleanText(event.hostClub, 180) || "Not available",
    collaborators: safeCollaborators(event),
    description: cleanText(getEventDescriptionForAvenue(event, avenueCode), 2500) || "Not available",
    avenues: normalizeBodReportAvenueCodes(event.avenues),
    financeEntries: finance.financeEntries,
    expenseTotal: finance.expenseTotal,
    incomeTotal: finance.incomeTotal,
  };
}

function presentationBodMeeting(event) {
  const date = reportItemDate(event);
  const finance = reportFinanceTotals(event);
  return {
    date,
    month: date.slice(0, 7),
    monthLabel: formatBodReportMonth(date.slice(0, 7)),
    dateLabel: formatBodReportDate(date),
    name: reportItemName(event) || "Unnamed BOD meeting",
    role: "BOD Meeting",
    hostClub: "",
    collaborators: "None",
    description: cleanText(event?.description || event?.desc || event?.summary || event?.notes, 2500) || "Not available",
    avenues: [],
    recordKind: "bodMeeting",
    sectionType: "bodMeeting",
    financeEntries: finance.financeEntries,
    expenseTotal: finance.expenseTotal,
    incomeTotal: finance.incomeTotal,
  };
}

function monthTotalsForEvents(events, selectedMonths) {
  return selectedMonths
    .map((month) => {
      const monthEvents = events.filter((event) => event.month === month);
      return {
        month,
        monthLabel: formatBodReportMonth(month),
        eventCount: monthEvents.length,
        monthExpenseTotal: sumEventMoney(monthEvents, "expenseTotal"),
        monthIncomeTotal: sumEventMoney(monthEvents, "incomeTotal"),
      };
    })
    .filter((month) => month.eventCount);
}

function isContiguousMonthRange(months) {
  if (months.length < 2) return true;
  return months.every((month, index) => !index || monthIndex(month) === monthIndex(months[index - 1]) + 1);
}

export function formatBodReportPeriod(monthsInput) {
  const months = normalizeBodReportMonths(monthsInput);
  if (!months.length) return "";
  if (months.length === 1) return formatBodReportMonth(months[0]);
  if (isContiguousMonthRange(months)) {
    const first = months[0];
    const last = months.at(-1);
    const firstDate = monthStart(first);
    const lastDate = monthStart(last);
    const firstMonth = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(firstDate);
    const lastMonth = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(lastDate);
    const firstYear = firstDate.getUTCFullYear();
    const lastYear = lastDate.getUTCFullYear();
    return firstYear === lastYear
      ? `${firstMonth}-${lastMonth} ${firstYear}`
      : `${firstMonth} ${firstYear}-${lastMonth} ${lastYear}`;
  }
  return months.map(formatBodReportMonth).join(", ");
}

function formatAvenuesSummary(codes) {
  const labels = codes.map(getBodAvenueLabel).filter(Boolean);
  if (labels.length === 1) return labels[0];
  const joined = labels.join(", ");
  return joined.length <= 62 ? joined : `${labels.length} avenues selected`;
}

function formatReportScopeSummary(codes, includeBodMeetings) {
  const avenueSummary = formatAvenuesSummary(codes);
  if (includeBodMeetings && avenueSummary) return `${avenueSummary} + BOD Meetings`;
  return includeBodMeetings ? "BOD Meetings" : avenueSummary;
}

function reportTitleForSelection(codes, includeBodMeetings) {
  if (!includeBodMeetings) return "";
  return codes.length ? "BOD Monthly Report" : "BOD Meetings Report";
}

function slug(value, max = 120) {
  return cleanText(value, max)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function periodFilenamePart(months) {
  if (months.length === 1) return slug(formatBodReportMonth(months[0]), 40);
  if (isContiguousMonthRange(months)) {
    const first = formatBodReportMonth(months[0]).replace(" ", "-");
    const last = formatBodReportMonth(months.at(-1)).replace(" ", "-");
    return slug(`${first}-to-${last}`, 80);
  }
  return slug(months.map(formatBodReportMonth).join("-"), 90);
}

export function buildBodAvenueReportModel(options = {}) {
  const selectedMonths = normalizeBodReportMonths(options.selectedMonths ?? options.month);
  const selectedAvenueCodes = normalizeBodReportAvenueCodes(options.selectedAvenueCodes ?? options.avenueCode);
  const includeBodMeetings = options.includeBodMeetings === true;
  if (!selectedMonths.length) throw new TypeError("Select at least one valid report month.");
  if (!selectedAvenueCodes.length && !includeBodMeetings) throw new TypeError("Select at least one valid report avenue or include BOD meetings.");

  const matching = selectedAvenueCodes.length ? filterBodAvenueReportEvents(options.events, { selectedMonths, selectedAvenueCodes }) : [];
  const matchingMeetings = includeBodMeetings ? filterBodAvenueReportMeetings(options.events, { selectedMonths }) : [];
  const selected = selectedIdsFromOptions(options.selectedEventIds);
  const chosen = matching.filter((event) => selected.has(event.id));
  const chosenMeetings = matchingMeetings.filter((event) => selected.has(event.id));
  const selectedItemCount = chosen.length + chosenMeetings.length;
  if (!selectedItemCount) throw new TypeError(includeBodMeetings ? "Select at least one reportable event or BOD meeting." : "Select at least one reportable event.");
  if (selectedItemCount > BOD_AVENUE_REPORT_LIMIT) throw new RangeError(`Reports are limited to ${BOD_AVENUE_REPORT_LIMIT} unique events.`);

  const timestamp = new Date(options.generatedAt || Date.now());
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("Generated timestamp is invalid.");

  const directorMap = normalizeDirectorMap({ selectedAvenueCodes, directors: options.directors, directorsByAvenue: options.directorsByAvenue });
  const singleMonth = selectedMonths.length === 1;
  const singleAvenue = selectedAvenueCodes.length === 1;
  const primaryAvenueCode = selectedAvenueCodes[0];
  const primaryDirectors = directorMap.get(primaryAvenueCode) || [];
  const primaryDirectorLines = directorLines(primaryDirectors);
  const reportClubEvents = chosen.map((event) => presentationEvent(event, singleAvenue ? primaryAvenueCode : ""));
  const reportMeetingEvents = chosenMeetings.map(presentationBodMeeting);
  const reportEvents = [...reportClubEvents, ...reportMeetingEvents];
  const monthTotals = monthTotalsForEvents(reportEvents, selectedMonths);
  const firstMonthTotals = monthTotals.find((month) => month.month === selectedMonths[0]);
  const groups = [];
  const avenueGroups = [];
  for (const avenueCode of selectedAvenueCodes) {
    const avenueDirectors = directorMap.get(avenueCode) || [];
    const avenueDirectorLines = directorLines(avenueDirectors);
    const avenueDirectorText = directorTextFromLines(avenueDirectorLines);
    const avenueMonths = [];
    for (const month of selectedMonths) {
      const groupEvents = chosen
        .filter((event) => event.startDate.startsWith(`${month}-`) && event.avenues.includes(avenueCode))
        .map((event) => presentationEvent(event, avenueCode));
      if (!groupEvents.length) continue;
      const monthGroup = {
        avenueCode,
        avenueLabel: getBodAvenueLabel(avenueCode),
        month,
        monthLabel: formatBodReportMonth(month),
        directors: avenueDirectors,
        directorLines: avenueDirectorLines,
        directorText: avenueDirectorText,
        eventCount: groupEvents.length,
        monthExpenseTotal: sumEventMoney(groupEvents, "expenseTotal"),
        monthIncomeTotal: sumEventMoney(groupEvents, "incomeTotal"),
        events: groupEvents,
      };
      groups.push(monthGroup);
      avenueMonths.push(monthGroup);
    }
    if (avenueMonths.length) {
      avenueGroups.push({
        avenueCode,
        avenueLabel: getBodAvenueLabel(avenueCode),
        directors: avenueDirectors,
        directorLines: avenueDirectorLines,
        directorText: avenueDirectorText,
        eventCount: avenueMonths.reduce((total, month) => total + month.eventCount, 0),
        avenueExpenseTotal: sumEventMoney(avenueMonths, "monthExpenseTotal"),
        avenueIncomeTotal: sumEventMoney(avenueMonths, "monthIncomeTotal"),
        months: avenueMonths,
      });
    }
  }

  const meetingGroups = [];
  for (const month of selectedMonths) {
    const groupEvents = reportMeetingEvents.filter((event) => event.month === month);
    if (!groupEvents.length) continue;
    meetingGroups.push({
      avenueCode: "BOD",
      avenueLabel: "BOD Meetings",
      sectionType: "bodMeetings",
      month,
      monthLabel: formatBodReportMonth(month),
      directors: [],
      directorLines: [],
      directorText: "Not available",
      eventCount: groupEvents.length,
      monthExpenseTotal: sumEventMoney(groupEvents, "expenseTotal"),
      monthIncomeTotal: sumEventMoney(groupEvents, "incomeTotal"),
      events: groupEvents,
    });
  }
  const bodMeetingSection = meetingGroups.length ? {
    avenueCode: "BOD",
    avenueLabel: "BOD Meetings",
    sectionType: "bodMeetings",
    directors: [],
    directorLines: [],
    directorText: "Not available",
    eventCount: meetingGroups.reduce((total, month) => total + month.eventCount, 0),
    avenueExpenseTotal: sumEventMoney(meetingGroups, "monthExpenseTotal"),
    avenueIncomeTotal: sumEventMoney(meetingGroups, "monthIncomeTotal"),
    months: meetingGroups,
  } : null;
  const reportAvenueGroups = bodMeetingSection ? [...avenueGroups, bodMeetingSection] : avenueGroups;
  const appearance = normalizeBodReportAppearance(options.appearance);
  const periodLabel = formatBodReportPeriod(selectedMonths);
  const avenuesLabel = formatReportScopeSummary(selectedAvenueCodes, includeBodMeetings);
  const reportTitle = reportTitleForSelection(selectedAvenueCodes, includeBodMeetings);
  const grandExpenseTotal = sumEventMoney(reportEvents, "expenseTotal");
  const grandIncomeTotal = sumEventMoney(reportEvents, "incomeTotal");

  return {
    selectedMonths,
    selectedAvenueCodes,
    includeBodMeetings,
    month: selectedMonths[0],
    monthLabel: singleMonth ? formatBodReportMonth(selectedMonths[0]) : periodLabel,
    periodLabel,
    avenueCode: primaryAvenueCode,
    avenueLabel: singleAvenue && !includeBodMeetings ? getBodAvenueLabel(primaryAvenueCode) : avenuesLabel,
    avenuesLabel,
    title: reportTitle,
    directors: primaryDirectors,
    directorLines: singleAvenue ? primaryDirectorLines : [],
    directorText: singleAvenue ? directorTextFromLines(primaryDirectorLines) : (selectedAvenueCodes.length ? "Multiple avenue directors" : "Not available"),
    directorAssignmentBasis: "Current active BOD position assignment",
    eventCount: selectedItemCount,
    bodMeetingCount: reportMeetingEvents.length,
    groupCount: groups.length + meetingGroups.length,
    monthExpenseTotal: firstMonthTotals?.monthExpenseTotal || 0,
    monthIncomeTotal: firstMonthTotals?.monthIncomeTotal || 0,
    monthTotals,
    grandExpenseTotal,
    grandIncomeTotal,
    generatedAt: timestamp.toISOString(),
    appearance,
    isCombined: !singleMonth || !singleAvenue || includeBodMeetings,
    events: reportEvents,
    groups,
    meetingGroups,
    bodMeetingGroups: meetingGroups,
    avenueGroups: reportAvenueGroups,
  };
}

export function getBodAvenueReportFilename(report) {
  const months = normalizeBodReportMonths(report?.selectedMonths ?? report?.month);
  const codes = normalizeBodReportAvenueCodes(report?.selectedAvenueCodes ?? report?.avenueCode);
  if (months.length <= 1 && codes.length <= 1) {
    const avenue = cleanText(report?.avenueLabel || report?.avenueCode, 80) || "Avenue";
    const month = cleanText(report?.monthLabel, 40) || "Monthly";
    const stem = slug(`RCPH-${avenue}-${month}-Report`, 110);
    return `${stem || "RCPH-Avenue-Report"}.pdf`;
  }

  const yearPart = unique(months.map((month) => month.slice(0, 4))).join("-");
  const period = periodFilenamePart(months);
  const codePart = codes.join("-");
  const detailed = slug(`RCPH-BOD-Avenue-Report-${period}-${codePart}`, 150);
  if (months.length > 4 || codes.length > 4 || detailed.length > 115) {
    return `${slug(`RCPH-BOD-Avenue-Combined-Report-${yearPart}`, 90)}.pdf`;
  }
  return `${detailed}.pdf`;
}
