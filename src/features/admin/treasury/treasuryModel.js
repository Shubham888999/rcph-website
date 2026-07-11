import { AVENUES, formatInr, money, safeUrl, text, validDate } from "../shared/adminModel.js";

export const TREASURY_WORKFLOW_TYPES = Object.freeze([
  { id: "income", label: "Income", description: "Money received by the club", storedType: "income", accent: "income" },
  { id: "expense", label: "Expense", description: "Money paid by the club", storedType: "expense", accent: "expense" },
  { id: "reimbursement", label: "Reimbursement", description: "Member-paid expense reimbursed by the club", storedType: "expense", accent: "reimbursement" },
]);

export const TREASURY_PAYMENT_MODES = Object.freeze(["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"]);
export const TREASURY_REIMBURSEMENT_STATUSES = Object.freeze(["Not Applicable", "Pending", "Done"]);
export const TREASURY_SORT_OPTIONS = Object.freeze(["newest", "oldest", "amount-desc", "amount-asc"]);
export const TREASURY_AVENUE_OPTIONS = Object.freeze(["Club", ...AVENUES, "Other"]);

export const DEFAULT_TREASURY_FILTERS = Object.freeze({
  search: "",
  type: "all",
  month: "",
  avenue: "",
  paymentMode: "",
  reimbursementStatus: "",
  hasFile: "",
  sort: "newest",
});

export function localToday(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function createEmptyTreasuryDraft(defaults = {}) {
  const workflowType = normalizeWorkflowType(defaults.workflowType || defaults.type || "income");
  return {
    workflowType,
    title: "",
    type: storedTypeForWorkflow(workflowType),
    amount: "",
    date: defaults.date || localToday(),
    avenue: defaults.avenue || "",
    purpose: "",
    paidBy: "",
    paidByType: "other",
    paidByMemberId: "",
    paidTo: "",
    paidToType: "other",
    paidToMemberId: "",
    paymentMode: defaults.paymentMode || "",
    referenceNumber: "",
    reimbursementStatus: workflowType === "income" ? "Not Applicable" : defaults.reimbursementStatus || "Not Applicable",
    reimbursedTo: "",
    reimbursementDate: "",
    billUrl: "",
  };
}

export function normalizeWorkflowType(value) {
  const candidate = text(value, 40).toLowerCase();
  return TREASURY_WORKFLOW_TYPES.some((item) => item.id === candidate) ? candidate : "income";
}

export function storedTypeForWorkflow(workflowType) {
  return workflowType === "reimbursement" ? "expense" : normalizeStoredType(workflowType);
}

export function normalizeStoredType(value) {
  const candidate = text(value, 20).toLowerCase();
  return candidate === "expense" ? "expense" : "income";
}

export function normalizeReimbursementStatus(value) {
  const candidate = text(value, 80).toLowerCase();
  if (["pending", "pending reimbursement"].includes(candidate)) return "Pending";
  if (["done", "reimbursed", "fully reimbursed", "complete", "completed"].includes(candidate)) return "Done";
  if (["not applicable", "not_applicable", "na", "n/a", "none", "no", ""].includes(candidate)) return "Not Applicable";
  return "Not Applicable";
}

export function isReimbursementRecord(record) {
  if (!record || normalizeStoredType(record.type) !== "expense") return false;
  const status = normalizeReimbursementStatus(record.reimbursementStatus || record.reimburse);
  return status !== "Not Applicable" || Boolean(text(record.reimbursedTo, 180) || validDate(text(record.reimbursementDate, 20)));
}

export function workflowFromRecord(record) {
  if (!record) return "income";
  if (normalizeStoredType(record.type) === "income") return "income";
  return isReimbursementRecord(record) && normalizeReimbursementStatus(record.reimbursementStatus) === "Done"
    ? "reimbursement"
    : "expense";
}

export function prepareTreasuryDraft(record = {}, defaults = {}) {
  if (!record?.id) return createEmptyTreasuryDraft(defaults);
  const workflowType = record.workflowType || workflowFromRecord(record);
  return {
    ...createEmptyTreasuryDraft({ ...defaults, workflowType }),
    ...record,
    workflowType,
    type: storedTypeForWorkflow(workflowType),
    amount: record.amount === undefined || record.amount === null ? "" : String(record.amount),
    reimbursementStatus: normalizeReimbursementStatus(record.reimbursementStatus),
  };
}

export function applyTreasuryWorkflow(draft, workflowType) {
  const nextWorkflow = normalizeWorkflowType(workflowType);
  const next = {
    ...draft,
    workflowType: nextWorkflow,
    type: storedTypeForWorkflow(nextWorkflow),
  };

  if (nextWorkflow === "income") {
    return {
      ...next,
      paidTo: "",
      reimbursementStatus: "Not Applicable",
      reimbursedTo: "",
      reimbursementDate: "",
    };
  }

  if (nextWorkflow === "reimbursement") {
    return {
      ...next,
      paidTo: next.paidTo || next.reimbursedTo,
      reimbursementStatus: "Done",
    };
  }

  return {
    ...next,
    reimbursementStatus: next.reimbursementStatus === "Done" && !next.reimbursedTo ? "Not Applicable" : normalizeReimbursementStatus(next.reimbursementStatus),
  };
}

export function sanitizeAmountInput(value) {
  const raw = String(value ?? "").replace(/[^\d.]/g, "");
  const [wholePart, ...decimalParts] = raw.split(".");
  const whole = wholePart.replace(/^0+(?=\d)/, "");
  if (!decimalParts.length) return whole;
  const decimals = decimalParts.join("").slice(0, 2);
  return `${whole || "0"}.${decimals}`;
}

export function parseTreasuryAmount(value) {
  const amount = money(value);
  return amount !== null && amount > 0 ? amount : null;
}

export function normalizeTreasuryAvenue(value) {
  const avenue = text(value, 40);
  if (!avenue) return "";
  const lower = avenue.toLowerCase();
  const match = TREASURY_AVENUE_OPTIONS.find((item) => item.toLowerCase() === lower);
  return match || avenue;
}

export function getTreasuryFieldPlan(draft = {}) {
  const workflowType = normalizeWorkflowType(draft.workflowType || workflowFromRecord(draft));
  const status = workflowType === "income" ? "Not Applicable" : normalizeReimbursementStatus(draft.reimbursementStatus);
  const reimbursementActive = workflowType === "reimbursement" || status !== "Not Applicable";
  return {
    workflowType,
    storedType: storedTypeForWorkflow(workflowType),
    accent: TREASURY_WORKFLOW_TYPES.find((item) => item.id === workflowType)?.accent || "income",
    isIncome: workflowType === "income",
    isExpense: workflowType === "expense",
    isReimbursement: workflowType === "reimbursement",
    reimbursementActive,
    status,
    labels: {
      amount: "Amount *",
      date: workflowType === "reimbursement" ? "Expense date *" : "Date *",
      paidBy: workflowType === "income" ? "Received from *" : workflowType === "reimbursement" ? "Original payer" : "Paid by",
      paidTo: "Paid to *",
      purpose: workflowType === "income" ? "Purpose / description" : "Purpose / notes",
      reference: "Payment reference",
      externalLink: "External supporting link",
    },
    show: {
      paidBy: true,
      paidTo: workflowType === "expense",
      reimbursementStatus: workflowType === "expense",
      reimbursementDetails: reimbursementActive,
      externalLink: true,
    },
    required: {
      title: true,
      amount: true,
      date: true,
      paidBy: workflowType === "income",
      paidTo: workflowType === "expense",
      reimbursedTo: workflowType === "reimbursement" || status !== "Not Applicable",
      reimbursementDate: workflowType === "reimbursement" || status === "Done",
    },
  };
}

export function validateTreasuryDraft(draft = {}) {
  const plan = getTreasuryFieldPlan(draft);
  const errors = {};
  if (!text(draft.title, 180)) errors.title = "Title is required.";
  if (parseTreasuryAmount(draft.amount) === null) errors.amount = "Enter an amount greater than zero.";
  if (!validDate(text(draft.date, 20))) errors.date = "Choose a valid date.";
  if (plan.required.paidBy && !text(draft.paidBy, 180)) errors.paidBy = "Received from is required for income.";
  if (plan.required.paidTo && !text(draft.paidTo, 180)) errors.paidTo = "Paid to is required for expenses.";
  if (plan.required.reimbursedTo && !text(draft.reimbursedTo, 180)) errors.reimbursedTo = "Reimbursed to is required.";
  if (plan.required.reimbursementDate && !validDate(text(draft.reimbursementDate, 20))) errors.reimbursementDate = "Choose a valid reimbursement date.";
  return { valid: Object.keys(errors).length === 0, errors, plan };
}

export function buildTreasuryPayload(source = {}) {
  const plan = getTreasuryFieldPlan(source);
  const amount = parseTreasuryAmount(source.amount);
  const purpose = text(source.purpose, 500);
  const referenceNumber = text(source.referenceNumber, 180);
  const reimbursedTo = plan.reimbursementActive ? text(source.reimbursedTo, 180) : "";
  const paidTo = plan.isReimbursement ? reimbursedTo : text(source.paidTo, 180);
  const reimbursementDate = plan.reimbursementActive && validDate(text(source.reimbursementDate, 20)) ? text(source.reimbursementDate, 20) : "";
  const reimbursementStatus = plan.isIncome ? "Not Applicable" : plan.status;

  return {
    title: text(source.title, 180),
    name: text(source.title, 180),
    type: plan.storedType,
    amount,
    date: text(source.date, 20),
    avenue: normalizeTreasuryAvenue(source.avenue),
    purpose,
    linkedEventName: purpose,
    paidBy: text(source.paidBy, 180),
    paidByType: text(source.paidByType, 20) || "other",
    paidByMemberId: text(source.paidByMemberId, 128),
    paidTo,
    paidToType: text(source.paidToType, 20) || "other",
    paidToMemberId: text(source.paidToMemberId, 128),
    paymentMode: text(source.paymentMode, 80),
    referenceNumber,
    cheque: referenceNumber,
    reimbursementStatus,
    reimburse: reimbursementStatus,
    reimbursedTo,
    reimbursementDate,
    billUrl: source.billUrl ? safeUrl(source.billUrl) : "",
  };
}

export function isTreasuryUploadWorking(upload = {}) {
  return ["requesting", "uploading", "processing"].includes(upload.status);
}

export function treasuryHasSupportingFile(record = {}) {
  return Boolean(text(record.billUrl, 1000));
}

export function buildTreasurySummary(transactions = [], now = new Date()) {
  const monthKey = localToday(now).slice(0, 7);
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const pending = transactions.filter((item) => normalizeReimbursementStatus(item.reimbursementStatus) === "Pending");
  const monthItems = transactions.filter((item) => text(item.date, 20).startsWith(monthKey));
  const monthIncome = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const monthExpense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return {
    income,
    expense,
    net: income - expense,
    pendingReimbursementAmount: pending.reduce((sum, item) => sum + item.amount, 0),
    pendingReimbursementCount: pending.length,
    monthKey,
    monthTransactionCount: monthItems.length,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
  };
}

export function formatTreasuryDate(value) {
  if (!validDate(text(value, 20))) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

export function formatTreasuryMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return "Undated";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function transactionPartyLabel(record = {}) {
  if (record.type === "income") return record.paidBy ? `Received from ${record.paidBy}` : "Received from not recorded";
  if (isReimbursementRecord(record)) return record.reimbursedTo ? `Reimbursed to ${record.reimbursedTo}` : "Reimbursement party not recorded";
  return record.paidTo ? `Paid to ${record.paidTo}` : "Paid to not recorded";
}

export function buildTreasuryReview(draft = {}, upload = {}) {
  const plan = getTreasuryFieldPlan(draft);
  const amount = parseTreasuryAmount(draft.amount);
  const title = text(draft.title, 180) || "Untitled transaction";
  const party = plan.isIncome
    ? (text(draft.paidBy, 180) ? `Received from: ${text(draft.paidBy, 180)}` : "Received from: required")
    : plan.isReimbursement
      ? (text(draft.reimbursedTo, 180) ? `Reimbursed to: ${text(draft.reimbursedTo, 180)}` : "Reimbursed to: required")
      : (text(draft.paidTo, 180) ? `Paid to: ${text(draft.paidTo, 180)}` : "Paid to: required");
  return {
    label: TREASURY_WORKFLOW_TYPES.find((item) => item.id === plan.workflowType)?.label || "Transaction",
    accent: plan.accent,
    title,
    amountLabel: amount === null ? "INR 0" : formatInr(amount),
    party,
    date: validDate(text(draft.date, 20)) ? formatTreasuryDate(draft.date) : "Date required",
    mode: text(draft.paymentMode, 80) || "Payment mode optional",
    reference: text(draft.referenceNumber, 180) || "No reference",
    evidence: upload?.file ? `${upload.file.name} selected` : treasuryHasSupportingFile(draft) ? "Existing document linked" : "No supporting file selected",
  };
}

function searchText(record = {}) {
  return [record.title, record.purpose, record.paidBy, record.paidTo, record.reimbursedTo, record.referenceNumber]
    .map((item) => text(item, 500).toLowerCase())
    .join(" ");
}

export function filterAndSortTreasury(transactions = [], filters = DEFAULT_TREASURY_FILTERS) {
  const query = text(filters.search, 120).toLowerCase();
  const sort = TREASURY_SORT_OPTIONS.includes(filters.sort) ? filters.sort : "newest";
  const rows = transactions.filter((item) => {
    if (query && !searchText(item).includes(query)) return false;
    if (filters.type === "income" && item.type !== "income") return false;
    if (filters.type === "expense" && (item.type !== "expense" || isReimbursementRecord(item))) return false;
    if (filters.type === "reimbursement" && !isReimbursementRecord(item)) return false;
    if (filters.month && !text(item.date, 20).startsWith(filters.month)) return false;
    if (filters.avenue && normalizeTreasuryAvenue(item.avenue) !== normalizeTreasuryAvenue(filters.avenue)) return false;
    if (filters.paymentMode && item.paymentMode !== filters.paymentMode) return false;
    if (filters.reimbursementStatus && normalizeReimbursementStatus(item.reimbursementStatus) !== filters.reimbursementStatus) return false;
    if (filters.hasFile === "yes" && !treasuryHasSupportingFile(item)) return false;
    if (filters.hasFile === "no" && treasuryHasSupportingFile(item)) return false;
    return true;
  });

  return [...rows].sort((a, b) => {
    if (sort === "amount-desc" || sort === "amount-asc") {
      const diff = (b.amount || 0) - (a.amount || 0);
      return sort === "amount-desc" ? diff : -diff;
    }
    const diff = text(b.date, 20).localeCompare(text(a.date, 20));
    return sort === "newest" ? diff : -diff;
  });
}

export function groupTreasuryByMonth(transactions = []) {
  const groups = new Map();
  transactions.forEach((item) => {
    const key = validDate(text(item.date, 20)) ? item.date.slice(0, 7) : "undated";
    const current = groups.get(key) || { key, label: key === "undated" ? "Undated" : formatTreasuryMonth(key), income: 0, expense: 0, net: 0, items: [] };
    if (item.type === "income") current.income += item.amount;
    if (item.type === "expense") current.expense += item.amount;
    current.net = current.income - current.expense;
    current.items.push(item);
    groups.set(key, current);
  });
  return [...groups.values()];
}

export function getTreasuryMonthOptions(transactions = []) {
  return [...new Set(transactions.map((item) => text(item.date, 20).slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)))]
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: formatTreasuryMonth(value) }));
}

export function getTreasuryAvenueOptions(transactions = []) {
  const known = new Set(TREASURY_AVENUE_OPTIONS);
  transactions.forEach((item) => {
    const avenue = normalizeTreasuryAvenue(item.avenue);
    if (avenue) known.add(avenue);
  });
  return [...known];
}
