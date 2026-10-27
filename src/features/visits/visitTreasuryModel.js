import { buildTreasuryLedger } from "./visitDashboardModel.js";
import { POSITION_CATALOG } from "../admin/shared/positionCatalog.js";

export const VISIT_TREASURY_AVENUES = Object.freeze([
  { code: "PDD", label: "Professional Development (PD)" },
  { code: "CSD", label: "Club Service (CS)" },
  { code: "ISD", label: "International Service (IS)" },
  { code: "CMD", label: "Community Service (CM)" },
]);

const AVENUE_ALIASES = Object.freeze({
  pd: "PDD", pdd: "PDD", professionaldevelopment: "PDD",
  cs: "CSD", csd: "CSD", clubservice: "CSD",
  is: "ISD", isd: "ISD", internationalservice: "ISD",
  cm: "CMD", cmd: "CMD", communityservice: "CMD",
});

const lookupKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const POSITION_AVENUES = new Map(POSITION_CATALOG.flatMap((position) =>
  [position.key, ...position.aliases].map((alias) => [lookupKey(alias), position])));

function avenueDetails(row) {
  const raw = String(row.avenueCode || row.avenueName || "Other").trim();
  const position = POSITION_AVENUES.get(lookupKey(raw));
  const code = AVENUE_ALIASES[lookupKey(raw)] || position?.avenueCode || raw.toUpperCase();
  const standard = VISIT_TREASURY_AVENUES.find((avenue) => avenue.code === code);
  const labels = { CLUB: "Club", OTHER: "Other", GBM: "General Body Meeting" };
  return { code, label: standard?.label || labels[code] || position?.displayTitle || row.avenueName || raw };
}

function eventGroup(row) {
  if (row.eventId) return { key: `${row.eventSource || "event"}:${row.eventId}`, label: row.eventName || "Linked event", date: row.eventDate || "" };
  if (row.eventName) return { key: `name:${row.eventName.toLowerCase()}`, label: row.eventName, date: row.eventDate || "" };
  return { key: "unlinked", label: "Not linked to an event", date: "" };
}

function eventsFor(rows) {
  const events = new Map();
  rows.forEach((row) => {
    const event = eventGroup(row);
    if (!events.has(event.key)) events.set(event.key, { ...event, rows: [] });
    events.get(event.key).rows.push(row);
  });
  return [...events.values()]
    .sort((a, b) => Number(a.key === "unlinked") - Number(b.key === "unlinked") || a.date.localeCompare(b.date) || a.label.localeCompare(b.label) || a.key.localeCompare(b.key))
    .map((event) => ({ ...event, ledger: buildTreasuryLedger(event.rows) }));
}

// Rebuild from the current normalized rows on every refresh. No copied reports or
// persisted group membership: old transactions move as soon as their fields change.
export function buildVisitTreasuryBreakdowns(rows = []) {
  const ledger = buildTreasuryLedger(rows);
  const allRows = ledger.groups.flatMap((group) => group.rows);
  const income = buildTreasuryLedger(allRows.filter((row) => row.type === "income"));
  const expense = buildTreasuryLedger(allRows.filter((row) => row.type === "expense"));
  // Fines are not avenue money: even when one is tagged to an avenue or an event it stays in
  // the ledgers, Income/Expense and Month wise, but is left out of Avenue wise.
  const avenueRows = allRows.filter((row) => !row.isFine);
  const avenues = new Map(VISIT_TREASURY_AVENUES.map((avenue) => [avenue.code, avenue]));
  avenueRows.forEach((row) => {
    const avenue = avenueDetails(row);
    if (!avenues.has(avenue.code)) avenues.set(avenue.code, avenue);
  });
  const additional = [...avenues.values()].filter((avenue) => !VISIT_TREASURY_AVENUES.some((base) => base.code === avenue.code))
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    income,
    expense,
    avenues: [...VISIT_TREASURY_AVENUES, ...additional].map((avenue) => {
      // A transaction's saved avenue owns its amount, even if the event has
      // several avenues. This prevents the same money being counted twice.
      const selected = avenueRows.filter((row) => avenueDetails(row).code === avenue.code);
      return { ...avenue, ledger: buildTreasuryLedger(selected), events: eventsFor(selected) };
    }),
    incomeMonths: income.groups.map((group) => ({ ...group, ledger: buildTreasuryLedger(group.rows) })),
    expenseMonths: expense.groups.map((group) => ({ ...group, ledger: buildTreasuryLedger(group.rows) })),
  };
}
