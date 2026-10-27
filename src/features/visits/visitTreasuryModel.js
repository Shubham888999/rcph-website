import { buildTreasuryLedger } from "./visitDashboardModel.js";

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

function avenueCode(row) {
  const raw = row.avenueCode || row.avenueName || "";
  return AVENUE_ALIASES[raw.toLowerCase().replace(/[^a-z]/g, "")] || raw.toUpperCase();
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
  return {
    income,
    expense,
    avenues: VISIT_TREASURY_AVENUES.map((avenue) => {
      // A transaction's saved avenue owns its amount, even if the event has
      // several avenues. This prevents the same money being counted twice.
      const selected = allRows.filter((row) => avenueCode(row) === avenue.code);
      return { ...avenue, ledger: buildTreasuryLedger(selected), events: eventsFor(selected) };
    }),
    incomeMonths: income.groups.map((group) => ({ ...group, ledger: buildTreasuryLedger(group.rows) })),
    expenseMonths: expense.groups.map((group) => ({ ...group, ledger: buildTreasuryLedger(group.rows) })),
  };
}
