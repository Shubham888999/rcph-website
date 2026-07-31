const COLORS = Object.freeze({
  darkBlue: "1F4E78",
  blue: "2E75B6",
  lightBlue: "D9EAF7",
  paleYellow: "FFF2CC",
  white: "FFFFFF",
  black: "000000",
  border: "A6A6A6",
});

export const BALANCE_SHEET_CURRENCY_FORMAT = '₹#,##0.00;[Red]-₹#,##0.00';

const MONTH_NAMES = Object.freeze([
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
]);

function cleanText(value, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0;
}

function monthKeyFromDate(value) {
  const text = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : "";
}

function monthStart(monthKey) {
  return new Date(`${monthKey}-01T00:00:00`);
}

function monthEnd(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0);
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
}

export function treasuryBalanceSheetMonthLabel(monthKey) {
  const date = monthStart(monthKey);
  return Number.isNaN(date.getTime()) ? "" : MONTH_NAMES[date.getMonth()];
}

export function treasuryBalanceSheetRiyLabel(monthKey) {
  const date = monthStart(monthKey);
  if (Number.isNaN(date.getTime())) return "";
  const firstYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return `${firstYear}-${String(firstYear + 1).slice(-2)}`;
}

export function treasuryBalanceSheetMonthRange(startMonth, endMonth) {
  const start = monthStart(startMonth);
  const end = monthStart(endMonth);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const values = [];
  const cursor = new Date(start);
  while (cursor <= end && values.length < 24) {
    values.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return values;
}

function isCashTransaction(record) {
  return cleanText(record?.paymentMode, 80).toLowerCase() === "cash";
}

function transactionParticular(record) {
  const title = cleanText(record?.title, 180);
  const purpose = cleanText(record?.purpose, 240);
  const base = title || purpose || "Treasury transaction";
  return purpose && title && purpose.toLowerCase() !== title.toLowerCase()
    ? `${base} - ${purpose}`
    : base;
}

function groupedLines(records, type) {
  const groups = new Map();
  for (const record of records) {
    if (record?.type !== type) continue;
    const amount = safeAmount(record?.amount);
    if (!amount) continue;
    const cash = isCashTransaction(record);
    const particular = transactionParticular(record);
    const key = `${particular.toLowerCase()}|${cash ? "cash" : "bank"}`;
    const current = groups.get(key) || {
      particular: `${type === "income" ? "By" : "To"} ${particular}`,
      cash: 0,
      bank: 0,
    };
    if (cash) current.cash += amount;
    else current.bank += amount;
    groups.set(key, current);
  }
  return [...groups.values()].map((item) => ({
    ...item,
    total: item.cash + item.bank,
  }));
}

function transactionNetBefore(transactions, startMonth) {
  const boundary = `${startMonth}-01`;
  return transactions.reduce((total, record) => {
    const date = cleanText(record?.date, 10);
    if (!date || date >= boundary) return total;
    const amount = safeAmount(record?.amount);
    return total + (record?.type === "income" ? amount : record?.type === "expense" ? -amount : 0);
  }, 0);
}

export function buildTreasuryBalanceSheetModel({
  transactions = [],
  startMonth,
  endMonth,
  openingCashInHand = 0,
  cashInHandByMonth = {},
}) {
  const monthKeys = treasuryBalanceSheetMonthRange(startMonth, endMonth);
  if (!monthKeys.length) throw new Error("Choose a valid start and end month.");
  const openingTotal = transactionNetBefore(transactions, monthKeys[0]);
  let previousClosingTotal = openingTotal;
  let previousClosingCash = safeAmount(openingCashInHand);

  const months = monthKeys.map((key) => {
    const records = transactions.filter((record) => monthKeyFromDate(record?.date) === key);
    const incomeLines = groupedLines(records, "income");
    const expenseLines = groupedLines(records, "expense");
    const income = incomeLines.reduce((sum, line) => sum + line.total, 0);
    const expense = expenseLines.reduce((sum, line) => sum + line.total, 0);
    const normalCashNet =
      incomeLines.reduce((sum, line) => sum + line.cash, 0)
      - expenseLines.reduce((sum, line) => sum + line.cash, 0);
    const desiredClosingCash = safeAmount(cashInHandByMonth[key]);
    const contra = Math.round((desiredClosingCash - (previousClosingCash + normalCashNet)) * 100) / 100;

    if (contra > 0) {
      incomeLines.push({ particular: "By Cash Withdrawn from Bank (Contra)", cash: contra, bank: 0, total: contra });
      expenseLines.push({ particular: "To Cash Remitted to Hand (Contra)", cash: 0, bank: contra, total: contra });
    } else if (contra < 0) {
      const value = Math.abs(contra);
      incomeLines.push({ particular: "By Cash Remitted to Bank (Contra)", cash: 0, bank: value, total: value });
      expenseLines.push({ particular: "To Cash Deposited into Bank (Contra)", cash: value, bank: 0, total: value });
    }

    const closingTotal = Math.round((previousClosingTotal + income - expense) * 100) / 100;
    const closingBank = Math.round((closingTotal - desiredClosingCash) * 100) / 100;
    const result = {
      key,
      label: treasuryBalanceSheetMonthLabel(key),
      startDate: monthStart(key),
      endDate: monthEnd(key),
      openingCash: previousClosingCash,
      openingBank: Math.round((previousClosingTotal - previousClosingCash) * 100) / 100,
      openingTotal: previousClosingTotal,
      incomeLines,
      expenseLines,
      closingCash: desiredClosingCash,
      closingBank,
      closingTotal,
    };
    previousClosingCash = desiredClosingCash;
    previousClosingTotal = closingTotal;
    return result;
  });

  return {
    startMonth,
    endMonth,
    riyLabel: treasuryBalanceSheetRiyLabel(monthKeys[0]),
    months,
  };
}

function thinBorder() {
  return {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function fill(cell, argb) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleMonthlySheet(sheet, month, riyLabel) {
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  sheet.columns = [
    { width: 3 }, { width: 44 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 3 }, { width: 44 }, { width: 15 }, { width: 15 }, { width: 15 },
  ];

  for (let row = 1; row <= 5; row += 1) sheet.mergeCells(row, 2, row, 10);
  const headings = [
    "Rotaract Club of Pune Heritage",
    "RID 3131 | Zone 4",
    `RIY ${riyLabel}`,
    `Balance Sheet for the month of ${month.label}`,
    `From ${displayDate(month.startDate)} to ${displayDate(month.endDate)}`,
  ];
  headings.forEach((value, index) => {
    const cell = sheet.getCell(index + 1, 2);
    cell.value = value;
    cell.font = { name: "Arial", size: index === 0 ? 16 : 12, bold: index === 0 || index === 3, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    fill(cell, COLORS.darkBlue);
    sheet.getRow(index + 1).height = index === 0 ? 24 : 22;
  });

  sheet.mergeCells("B6:E6");
  sheet.mergeCells("G6:J6");
  for (const address of ["B6", "G6"]) {
    const cell = sheet.getCell(address);
    cell.value = address === "B6" ? "INCOME" : "EXPENSES";
    cell.font = { name: "Arial", size: 13, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: "center" };
    fill(cell, COLORS.blue);
  }
  sheet.mergeCells("C7:E7");
  sheet.mergeCells("H7:J7");
  sheet.getCell("C7").value = "Amount";
  sheet.getCell("H7").value = "Amount";
  for (let row = 7; row <= 8; row += 1) {
    for (const column of [2, 3, 4, 5, 7, 8, 9, 10]) {
      const cell = sheet.getCell(row, column);
      fill(cell, COLORS.lightBlue);
      cell.font = { name: "Arial", size: 11, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder();
    }
  }
  ["B8", "G8"].forEach((address) => { sheet.getCell(address).value = "Particulars"; });
  ["C8", "H8"].forEach((address) => { sheet.getCell(address).value = "Cash"; });
  ["D8", "I8"].forEach((address) => { sheet.getCell(address).value = "Bank"; });
  ["E8", "J8"].forEach((address) => { sheet.getCell(address).value = "Total"; });

  const bodyRows = Math.max(9, month.incomeLines.length + 4, month.expenseLines.length);
  const transactionStart = 13;
  const closingRow = transactionStart + bodyRows - 4;
  const totalRow = closingRow + 1;

  sheet.getCell("B9").value = "By Opening Balance b/d";
  sheet.getCell("B10").value = "    Cash in Hand";
  sheet.getCell("B11").value = "    Cash in Bank";
  sheet.getCell("C10").value = month.openingCash;
  sheet.getCell("D11").value = month.openingBank;
  sheet.getCell("E10").value = { formula: "=C10+D10", result: month.openingCash };
  sheet.getCell("E11").value = { formula: "=C11+D11", result: month.openingBank };
  sheet.getCell("E12").value = { formula: "=E10+E11", result: month.openingTotal };

  month.incomeLines.forEach((line, index) => {
    const row = transactionStart + index;
    sheet.getCell(row, 2).value = line.particular;
    sheet.getCell(row, 3).value = line.cash;
    sheet.getCell(row, 4).value = line.bank;
    sheet.getCell(row, 5).value = { formula: `=C${row}+D${row}`, result: line.total };
  });

  month.expenseLines.forEach((line, index) => {
    const row = 9 + index;
    sheet.getCell(row, 7).value = line.particular;
    sheet.getCell(row, 8).value = line.cash;
    sheet.getCell(row, 9).value = line.bank;
    sheet.getCell(row, 10).value = { formula: `=H${row}+I${row}`, result: line.total };
  });

  sheet.getCell(closingRow, 7).value = "To Closing Balance c/d";
  sheet.getCell(closingRow, 8).value = month.closingCash;
  sheet.getCell(closingRow, 9).value = month.closingBank;
  sheet.getCell(closingRow, 10).value = { formula: `=H${closingRow}+I${closingRow}`, result: month.closingTotal };

  sheet.getCell(totalRow, 2).value = "Total";
  sheet.getCell(totalRow, 3).value = { formula: `=C10+C11+SUM(C${transactionStart}:C${closingRow})` };
  sheet.getCell(totalRow, 4).value = { formula: `=D10+D11+SUM(D${transactionStart}:D${closingRow})` };
  sheet.getCell(totalRow, 5).value = { formula: `=C${totalRow}+D${totalRow}` };
  sheet.getCell(totalRow, 7).value = "Total";
  sheet.getCell(totalRow, 8).value = { formula: `=SUM(H9:H${closingRow})` };
  sheet.getCell(totalRow, 9).value = { formula: `=SUM(I9:I${closingRow})` };
  sheet.getCell(totalRow, 10).value = { formula: `=H${totalRow}+I${totalRow}` };

  for (let row = 9; row <= totalRow; row += 1) {
    for (const column of [2, 3, 4, 5, 7, 8, 9, 10]) {
      const cell = sheet.getCell(row, column);
      cell.border = thinBorder();
      cell.font = { name: "Arial", size: 10.5, bold: row === closingRow || row === totalRow };
      if ([3, 4, 5, 8, 9, 10].includes(column)) cell.numFmt = BALANCE_SHEET_CURRENCY_FORMAT;
    }
  }
  fill(sheet.getCell(closingRow, 7), COLORS.lightBlue);
  fill(sheet.getCell(closingRow, 8), COLORS.lightBlue);
  fill(sheet.getCell(closingRow, 9), COLORS.lightBlue);
  fill(sheet.getCell(closingRow, 10), COLORS.lightBlue);
  for (const column of [2, 3, 4, 5, 7, 8, 9, 10]) fill(sheet.getCell(totalRow, column), COLORS.paleYellow);

  return { closingRow };
}

function styleSummarySheet(sheet, model, closingRows) {
  sheet.views = [{ showGridLines: false }];
  sheet.columns = [{ width: 3 }, { width: 25 }, { width: 22 }, { width: 22 }, { width: 22 }];
  sheet.mergeCells("B1:E1");
  const title = sheet.getCell("B1");
  title.value = `Rotaract Club of Pune Heritage — Monthly Closing Balance Summary  RIY ${model.riyLabel}`;
  title.font = { name: "Arial", size: 15, bold: true, color: { argb: COLORS.white } };
  title.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  fill(title, COLORS.darkBlue);
  sheet.getRow(1).height = 40;

  ["Month", "Cash in Hand (₹)", "Cash in Bank (₹)", "Total Closing (₹)"].forEach((value, index) => {
    const cell = sheet.getCell(2, index + 2);
    cell.value = value;
    cell.font = { name: "Arial", size: 11, bold: true };
    cell.alignment = { horizontal: "center" };
    fill(cell, COLORS.lightBlue);
    cell.border = thinBorder();
  });

  model.months.forEach((month, index) => {
    const row = index + 3;
    const sheetName = month.label.replace(/'/g, "''");
    const closingRow = closingRows[month.key];
    sheet.getCell(row, 2).value = month.label;
    sheet.getCell(row, 3).value = { formula: `='${sheetName}'!H${closingRow}`, result: month.closingCash };
    sheet.getCell(row, 4).value = { formula: `='${sheetName}'!I${closingRow}`, result: month.closingBank };
    sheet.getCell(row, 5).value = { formula: `='${sheetName}'!J${closingRow}`, result: month.closingTotal };
    for (let column = 2; column <= 5; column += 1) {
      const cell = sheet.getCell(row, column);
      cell.border = thinBorder();
      cell.font = { name: "Arial", size: 10.5 };
      if (column >= 3) cell.numFmt = BALANCE_SHEET_CURRENCY_FORMAT;
    }
  });
}

export function buildTreasuryBalanceSheetWorkbook(ExcelJS, model) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.subject = "Monthly Balance Sheet";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("SUMMARY");
  const closingRows = {};
  model.months.forEach((month) => {
    const sheet = workbook.addWorksheet(month.label);
    closingRows[month.key] = styleMonthlySheet(sheet, month, model.riyLabel).closingRow;
  });
  styleSummarySheet(summary, model, closingRows);
  return workbook;
}

export function treasuryBalanceSheetFileName(model) {
  const first = model.months[0]?.label || "START";
  const last = model.months.at(-1)?.label || "END";
  return `RCPH BALANCE SHEET ${first}-${last}.xlsx`;
}

export async function downloadTreasuryBalanceSheet(model) {
  const imported = await import("exceljs");
  const ExcelJS = imported.default || imported;
  const workbook = buildTreasuryBalanceSheetWorkbook(ExcelJS, model);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = treasuryBalanceSheetFileName(model);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
