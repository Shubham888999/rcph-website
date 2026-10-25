import { validDate } from "../shared/adminModel.js";
import {
  formatTreasuryDate,
  isReimbursementRecord,
  normalizeReimbursementStatus,
  normalizeTreasuryAvenue,
} from "./treasuryModel.js";

// Month-wise expense sheet in the treasurer's format: one tab per month
// (Expense details | Category | Cost | Transaction date | Paid by | Notes, with a
// total row) and a "Grand Total Expense" tab. Unlike the Balance Sheet, which
// follows the bank statement, every expense here sits on the day the money was
// spent: a reimbursement goes by its original payment date, not the repayment.

const MONTH_NAMES = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);
export const EXPENSE_SHEET_COLUMNS = Object.freeze(["Expense details", "Category", "Cost", "Transaction date", "Paid by", "Notes"]);
export const EXPENSE_SHEET_GRAND_TOTAL_TITLE = "Grand Total Expense";
export const EXPENSE_SHEET_CURRENCY_FORMAT = '[$₹]#,##0.00';
const COLORS = Object.freeze({
  header: "5B3A8C",
  headerText: "FFFFFF",
  total: "D9D2E9",
  stripe: "F3F0F8",
  summaryHeader: "1E6B3A",
  border: "BFBFBF",
});

function text(value, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
}

function monthKeyOf(isoDate) {
  return validDate(text(isoDate, 20)) ? isoDate.slice(0, 7) : "";
}

export function expenseSheetMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return MONTH_NAMES[month - 1] ? `${MONTH_NAMES[month - 1]} ${year}` : "";
}

// Tab names like last year's file: "July-25", "August-25".
export function expenseSheetTabName(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return `${MONTH_NAMES[month - 1]}-${String(year).slice(-2)}`;
}

export function expenseSheetMonthRange(startMonth, endMonth) {
  if (!/^\d{4}-\d{2}$/.test(startMonth || "") || !/^\d{4}-\d{2}$/.test(endMonth || "") || startMonth > endMonth) return [];
  const months = [];
  let [year, month] = startMonth.split("-").map(Number);
  while (months.length < 24) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key === endMonth) break;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months.at(-1) === endMonth ? months : [];
}

// Months the picker offers: from the earliest expense to the current month, continuous.
export function expenseSheetMonthOptions(transactions = [], now = new Date()) {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const keys = (Array.isArray(transactions) ? transactions : [])
    .filter((item) => item?.type === "expense")
    .map((item) => monthKeyOf(item.date))
    .filter(Boolean);
  const first = keys.length ? keys.reduce((min, key) => (key < min ? key : min)) : current;
  const last = keys.reduce((max, key) => (key > max ? key : max), current);
  return expenseSheetMonthRange(first, last).map((value) => ({ value, label: expenseSheetMonthLabel(value) }));
}

// Default range: this Rotaract year (July) to the current month.
export function defaultExpenseSheetRange(options = [], now = new Date()) {
  const values = options.map((option) => option.value);
  if (!values.length) return { startMonth: "", endMonth: "" };
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const july = `${year}-07`;
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    startMonth: values.find((value) => value >= july) || values[0],
    endMonth: values.includes(current) ? current : values.at(-1),
  };
}

function isCash(record) {
  return text(record?.paymentMode, 80).toLowerCase() === "cash";
}

function paidByFor(record) {
  if (isReimbursementRecord(record)) return text(record.paidBy, 180) || text(record.reimbursedTo, 180) || "Member";
  return text(record.paidBy, 180) || "Club";
}

function notesFor(record) {
  const mode = text(record.paymentMode, 80);
  const parts = [mode ? (isCash(record) ? "Paid (Cash)" : mode) : "Paid"];
  if (isReimbursementRecord(record)) {
    const status = normalizeReimbursementStatus(record.reimbursementStatus || record.reimburse);
    if (status === "Done") {
      const repaid = text(record.reimbursementDate, 20);
      parts.push(validDate(repaid) ? `Reimbursed on ${formatTreasuryDate(repaid)}` : "Reimbursed");
    } else if (status === "Pending") {
      parts.push("Reimbursement pending");
    }
  }
  return parts.join(" · ");
}

function categoryFor(record) {
  const avenue = normalizeTreasuryAvenue(record.avenue);
  return !avenue || ["club", "other"].includes(avenue.toLowerCase()) ? "OTHERS" : avenue.toUpperCase();
}

export function buildTreasuryExpenseSheetModel({ transactions = [], startMonth, endMonth } = {}) {
  const monthKeys = expenseSheetMonthRange(startMonth, endMonth);
  if (!monthKeys.length) throw new Error("Choose a valid start and end month.");
  const expenses = (Array.isArray(transactions) ? transactions : [])
    .filter((item) => item?.type === "expense" && amount(item.amount) > 0 && validDate(text(item.date, 20)));

  const months = monthKeys.map((key) => {
    const rows = expenses
      .filter((item) => item.date.startsWith(key))
      .sort((left, right) => left.date.localeCompare(right.date) || text(left.title).localeCompare(text(right.title)))
      .map((item) => ({
        id: item.id,
        details: text(item.title, 180) || text(item.purpose, 180) || "Expense",
        category: categoryFor(item),
        cost: amount(item.amount),
        date: item.date,
        paidBy: paidByFor(item),
        notes: notesFor(item),
        cash: isCash(item),
      }));
    const total = Math.round(rows.reduce((sum, row) => sum + row.cost, 0) * 100) / 100;
    const cashTotal = Math.round(rows.filter((row) => row.cash).reduce((sum, row) => sum + row.cost, 0) * 100) / 100;
    return { key, label: expenseSheetMonthLabel(key), tabName: expenseSheetTabName(key), rows, total, cashTotal };
  });

  return {
    startMonth: monthKeys[0],
    endMonth: monthKeys.at(-1),
    months,
    grandTotal: Math.round(months.reduce((sum, month) => sum + month.total, 0) * 100) / 100,
    cashGrandTotal: Math.round(months.reduce((sum, month) => sum + month.cashTotal, 0) * 100) / 100,
  };
}

function cashLabel(value) {
  return value > 0 ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} cash` : "";
}

function border(cell) {
  const side = { style: "thin", color: { argb: `FF${COLORS.border}` } };
  cell.border = { top: side, left: side, bottom: side, right: side };
}

function fill(cell, rgb) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${rgb}` } };
}

function dateCellValue(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonthSheet(workbook, month) {
  const sheet = workbook.addWorksheet(month.tabName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [27.6, 20.1, 22.6, 15.1, 25.1, 30].map((width) => ({ width }));

  const header = sheet.addRow(EXPENSE_SHEET_COLUMNS);
  header.height = 20;
  header.eachCell((cell) => {
    fill(cell, COLORS.header);
    cell.font = { bold: true, color: { argb: `FF${COLORS.headerText}` } };
    cell.alignment = { vertical: "middle" };
    border(cell);
  });

  month.rows.forEach((row, index) => {
    const added = sheet.addRow([row.details, row.category, row.cost, dateCellValue(row.date), row.paidBy, row.notes]);
    added.getCell(3).numFmt = EXPENSE_SHEET_CURRENCY_FORMAT;
    added.getCell(4).numFmt = "dd/mm/yyyy";
    added.eachCell({ includeEmpty: true }, (cell) => {
      if (index % 2 === 1) fill(cell, COLORS.stripe);
      border(cell);
    });
  });

  const lastDataRow = month.rows.length + 1;
  const totalRow = sheet.addRow([
    "Total",
    "",
    month.rows.length ? { formula: `SUM(C2:C${lastDataRow})`, result: month.total } : 0,
    cashLabel(month.cashTotal),
    "",
    "",
  ]);
  totalRow.getCell(3).numFmt = EXPENSE_SHEET_CURRENCY_FORMAT;
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    fill(cell, COLORS.total);
    cell.font = { bold: true };
    border(cell);
  });
  return { sheet, totalCell: `C${totalRow.number}` };
}

function addGrandTotalSheet(workbook, model, totalCells) {
  const sheet = workbook.addWorksheet(EXPENSE_SHEET_GRAND_TOTAL_TITLE, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [10, 22, 20, 18].map((width) => ({ width }));

  const header = sheet.addRow(["Sr no", "Month", "Total expense", "Cash"]);
  header.eachCell((cell) => {
    fill(cell, COLORS.summaryHeader);
    cell.font = { bold: true, color: { argb: `FF${COLORS.headerText}` } };
    border(cell);
  });

  model.months.forEach((month, index) => {
    const row = sheet.addRow([
      index + 1,
      month.label,
      { formula: `'${month.tabName}'!${totalCells[month.key]}`, result: month.total },
      cashLabel(month.cashTotal),
    ]);
    row.getCell(3).numFmt = EXPENSE_SHEET_CURRENCY_FORMAT;
    row.eachCell({ includeEmpty: true }, (cell) => border(cell));
  });

  const lastRow = model.months.length + 1;
  const total = sheet.addRow([
    "",
    "Grand total expense",
    { formula: `SUM(C2:C${lastRow})`, result: model.grandTotal },
    cashLabel(model.cashGrandTotal),
  ]);
  total.getCell(3).numFmt = EXPENSE_SHEET_CURRENCY_FORMAT;
  total.eachCell({ includeEmpty: true }, (cell) => {
    fill(cell, COLORS.total);
    cell.font = { bold: true };
    border(cell);
  });
}

export function buildTreasuryExpenseSheetWorkbook(ExcelJS, model) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.subject = "Expense Sheet";
  workbook.created = new Date();
  const totalCells = {};
  model.months.forEach((month) => {
    totalCells[month.key] = addMonthSheet(workbook, month).totalCell;
  });
  addGrandTotalSheet(workbook, model, totalCells);
  return workbook;
}

export function treasuryExpenseSheetFileName(model) {
  const first = model.months[0]?.tabName || "start";
  const last = model.months.at(-1)?.tabName || "end";
  return first === last ? `RCPH Expense Sheet ${first}.xlsx` : `RCPH Expense Sheet ${first} to ${last}.xlsx`;
}

export async function downloadTreasuryExpenseSheet(model) {
  const imported = await import("exceljs");
  const ExcelJS = imported.default || imported;
  const workbook = buildTreasuryExpenseSheetWorkbook(ExcelJS, model);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = treasuryExpenseSheetFileName(model);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
