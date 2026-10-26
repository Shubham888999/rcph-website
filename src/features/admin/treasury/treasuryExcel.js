import {
  TREASURY_EXPORT_COLUMNS,
  treasuryExportFileName,
} from "./treasuryExportModel.js";

const COLORS = Object.freeze({
  ink: "2A1720",
  wine: "6B1839",
  gold: "E5C268",
  cream: "FFF8E8",
  pale: "F8F1E7",
  mint: "DFF2E4",
  rose: "F8D7DA",
  blue: "E4EEF9",
  border: "D8CDBD",
  white: "FFFFFF",
});

export const TREASURY_INR_FORMAT = '"INR" #,##,##0.00;[Red]-"INR" #,##,##0.00';

function styleTitle(sheet, title, subtitle, endColumn) {
  sheet.mergeCells(1, 1, 1, endColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.wine } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, endColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Aptos", size: 10, italic: true, color: { argb: COLORS.ink } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.cream } };
  subtitleCell.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(2).height = 28;
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.ink } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.gold } } };
  });
  row.height = 24;
}

function styleMetricRow(row, valueColumns = [2, 5]) {
  row.eachCell((cell, column) => {
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
    if (valueColumns.includes(column)) {
      cell.font = { name: "Aptos", bold: true, color: { argb: COLORS.wine } };
      cell.numFmt = TREASURY_INR_FORMAT;
    } else {
      cell.font = { name: "Aptos", color: { argb: COLORS.ink } };
    }
  });
}

function styleWorksheet(sheet, footerLabel) {
  sheet.showGridLines = false;
  sheet.properties.defaultRowHeight = 19;
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  sheet.headerFooter.oddFooter = `Rotaract Club of Pune Heritage | ${footerLabel}`;
  sheet.eachRow((row) => row.eachCell((cell) => {
    cell.font = { name: cell.font?.name || "Aptos", size: cell.font?.size || 10, ...cell.font };
    cell.alignment = { vertical: "middle", ...cell.alignment };
  }));
}

function addKeyValueRow(sheet, values) {
  const row = sheet.addRow(values);
  row.eachCell((cell, column) => {
    cell.alignment = { wrapText: true, vertical: "top" };
    if (column % 2 === 1) cell.font = { bold: true, color: { argb: COLORS.wine } };
  });
  return row;
}

function addTable(sheet, startRow, startColumn, headers, rows, options = {}) {
  const headerRow = sheet.getRow(startRow);
  headers.forEach((header, index) => { headerRow.getCell(startColumn + index).value = header; });
  styleHeader(headerRow);
  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(startRow + rowIndex + 1);
    values.forEach((value, columnIndex) => { row.getCell(startColumn + columnIndex).value = value; });
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
    if (rowIndex % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.pale } };
      });
    }
  });
  const amountColumns = options.amountColumns || [];
  for (let rowNumber = startRow + 1; rowNumber <= startRow + rows.length; rowNumber += 1) {
    for (const offset of amountColumns) sheet.getCell(rowNumber, startColumn + offset).numFmt = TREASURY_INR_FORMAT;
  }
  return startRow + rows.length;
}

// Bill and bank proof links, shown as clickable cells after each entry.
function linkValue(url, label) {
  return url ? { text: label, hyperlink: url } : "Not attached";
}

function bankProofColumnCount(rows) {
  return Math.max(1, ...rows.map((row) => (row.bankProofs || []).length));
}

function linkHeaders(proofColumns) {
  return ["Bill", ...Array.from({ length: proofColumns }, (_, index) => (proofColumns === 1 ? "Bank proof" : `Bank proof ${index + 1}`))];
}

function linkValues(row, proofColumns) {
  const proofs = row.bankProofs || [];
  return [
    linkValue(row.billUrl, row.billFileName || "Open bill"),
    ...Array.from({ length: proofColumns }, (_, index) => (proofs[index] ? linkValue(proofs[index].fileUrl, proofs[index].kind === "link" ? "Open link" : proofs[index].fileName || "Open proof") : (index === 0 ? "Not attached" : ""))),
  ];
}

function styleLinkCells(row, firstColumn, count) {
  for (let column = firstColumn; column < firstColumn + count; column += 1) {
    const cell = row.getCell(column);
    if (cell.value && typeof cell.value === "object" && cell.value.hyperlink) cell.font = { name: "Aptos", color: { argb: "0563C1" }, underline: true };
    else if (cell.value) cell.font = { name: "Aptos", italic: true, color: { argb: "8A7F72" } };
  }
}

function addDashboardSheet(workbook, report) {
  const sheet = workbook.addWorksheet("Dashboard", { views: [{ state: "frozen", ySplit: 7 }] });
  sheet.columns = [
    { width: 24 }, { width: 18 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 28 },
  ];
  styleTitle(sheet, report.title, `${report.clubName} | Period: ${report.reportPeriod} | Treasurer: ${report.treasurerName}`, 8);
  addKeyValueRow(sheet, ["Generated", report.generatedAtLabel, "Filters", report.filterSummary.join("; "), "Sort", report.sortLabel, "Transactions", report.transactionCount]);
  sheet.addRow([]);
  const summaryHeader = sheet.addRow(["Metric", "Value", "Detail", "Metric", "Value", "Detail"]);
  styleHeader(summaryHeader);

  const firstMetricRow = summaryHeader.number + 1;
  const metrics = [
    ["Total Income", { formula: 'SUMIF(Transactions!B:B,"Income",Transactions!E:E)', result: report.summary.income }, `${report.incomeCategories.length} income categories`, "Total Expenses", { formula: 'SUMIF(Transactions!B:B,"Expense",Transactions!E:E)+SUMIF(Transactions!B:B,"Reimbursement",Transactions!E:E)', result: report.summary.expenses }, `${report.expenseCategories.length} expense categories`],
    ["Reimbursements", { formula: 'SUMIF(Transactions!B:B,"Reimbursement",Transactions!E:E)', result: report.summary.reimbursements }, "Included in expenses", "Net Balance", { formula: `B${firstMetricRow}-E${firstMetricRow}`, result: report.summary.net }, "Income minus expenses"],
    ["Transaction Count", report.transactionCount, "Filtered export rows", "Report Period", report.reportPeriod, "Current export period"],
  ];
  metrics.forEach((values) => styleMetricRow(sheet.addRow(values), [2, 5]));
  sheet.getCell(firstMetricRow + 2, 2).numFmt = "0";
  sheet.getCell(firstMetricRow + 2, 5).numFmt = "@";

  sheet.addRow([]);
  const monthRows = report.monthlySummary.slice(-8).map((item) => [item.label, item.income, item.expenses, item.net, item.count]);
  const monthStart = sheet.rowCount + 1;
  addTable(sheet, monthStart, 1, ["Month", "Income", "Expenses", "Net", "Transactions"], monthRows.length ? monthRows : [["No matching months", 0, 0, 0, 0]], { amountColumns: [1, 2, 3] });

  const recentRows = report.transactions.slice(0, 8).map((item) => [item.dateLabel, item.type, item.description, item.amount]);
  const recentStart = sheet.rowCount + 3;
  addTable(sheet, recentStart, 1, ["Date", "Type", "Recent Transaction", "Amount"], recentRows.length ? recentRows : [["No date", "None", "No matching transactions", 0]], { amountColumns: [3] });
  styleWorksheet(sheet, "Treasury financial records dashboard");
}

function addTransactionsSheet(workbook, report) {
  const sheet = workbook.addWorksheet("Transactions");
  const proofColumns = bankProofColumnCount(report.transactions);
  const columns = [...TREASURY_EXPORT_COLUMNS, ...linkHeaders(proofColumns)];
  sheet.columns = [
    { width: 14 }, { width: 16 }, { width: 18 }, { width: 42 }, { width: 16 }, { width: 18 },
    { width: 26 }, { width: 26 }, { width: 44 }, { width: 22 }, { width: 22 }, { width: 24 },
    ...linkHeaders(proofColumns).map(() => ({ width: 22 })),
  ];
  styleTitle(sheet, `${report.title} | Transactions`, `${report.transactionCount} filtered transaction${report.transactionCount === 1 ? "" : "s"} | ${report.reportPeriod}`, columns.length);
  addKeyValueRow(sheet, ["Treasurer", report.treasurerName, "Generated", report.generatedAtLabel, "Filters", report.filterSummary.join("; ")]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(columns);
  styleHeader(headerRow);
  const firstDataRow = headerRow.number + 1;

  if (report.transactions.length) {
    report.transactions.forEach((transaction) => {
      const row = sheet.addRow([
        transaction.date || transaction.dateLabel,
        transaction.type,
        transaction.category,
        transaction.description,
        transaction.amount,
        transaction.paymentMethod,
        transaction.source,
        transaction.destination,
        transaction.linkedRecord,
        transaction.createdBy,
        transaction.createdAt || transaction.createdAtLabel,
        transaction.id,
        ...linkValues(transaction, proofColumns),
      ]);
      if (transaction.date) row.getCell(1).numFmt = "yyyy-mm-dd";
      row.getCell(5).numFmt = TREASURY_INR_FORMAT;
      if (transaction.createdAt) row.getCell(11).numFmt = "yyyy-mm-dd hh:mm";
      row.eachCell((cell, column) => {
        cell.alignment = { vertical: "top", wrapText: [4, 7, 8, 9].includes(column) };
        cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
      });
      const typeFill = transaction.type === "Income" ? COLORS.mint : transaction.type === "Reimbursement" ? COLORS.cream : COLORS.rose;
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: typeFill } };
      styleLinkCells(row, TREASURY_EXPORT_COLUMNS.length + 1, proofColumns + 1);
    });
  } else {
    const row = sheet.addRow(["", "", "", "No matching Treasury transactions for the active filters.", 0, "", "", "", "", "", "", ""]);
    row.getCell(5).numFmt = TREASURY_INR_FORMAT;
  }

  const lastDataRow = sheet.rowCount;
  sheet.addRow([]);
  const incomeRow = sheet.addRow(["", "", "", "Total Income", { formula: `SUMIF(B${firstDataRow}:B${lastDataRow},"Income",E${firstDataRow}:E${lastDataRow})`, result: report.summary.income }]);
  const expenseRow = sheet.addRow(["", "", "", "Total Expenses", { formula: `SUMIF(B${firstDataRow}:B${lastDataRow},"Expense",E${firstDataRow}:E${lastDataRow})+SUMIF(B${firstDataRow}:B${lastDataRow},"Reimbursement",E${firstDataRow}:E${lastDataRow})`, result: report.summary.expenses }]);
  const netRow = sheet.addRow(["", "", "", "Net Balance", { formula: `E${incomeRow.number}-E${expenseRow.number}`, result: report.summary.net }]);
  [incomeRow, expenseRow, netRow].forEach((row) => {
    row.getCell(4).font = { bold: true, color: { argb: COLORS.wine } };
    row.getCell(5).font = { bold: true, color: { argb: COLORS.ink } };
    row.getCell(5).numFmt = TREASURY_INR_FORMAT;
  });

  sheet.views = [{ state: "frozen", ySplit: headerRow.number }];
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: columns.length },
  };
  styleWorksheet(sheet, "Treasury transaction ledger");
}

function addAnalysisSheet(workbook, report) {
  const sheet = workbook.addWorksheet("Charts & Analysis", { views: [{ state: "frozen", ySplit: 7 }] });
  sheet.columns = Array.from({ length: 10 }, () => ({ width: 18 }));
  styleTitle(sheet, `${report.title} | Charts & Analysis`, "Formatted source tables for Excel charts and finance review.", 10);
  addKeyValueRow(sheet, ["Period", report.reportPeriod, "Treasurer", report.treasurerName, "Generated", report.generatedAtLabel]);
  sheet.addRow([]);

  addTable(
    sheet,
    sheet.rowCount + 1,
    1,
    ["Metric", "Amount"],
    report.chartTables.incomeVsExpenses.map((item) => [item.label, item.amount]),
    { amountColumns: [1] },
  );

  const monthlyStart = sheet.rowCount + 3;
  addTable(
    sheet,
    monthlyStart,
    1,
    ["Month", "Income", "Expenses", "Net", "Transactions"],
    report.monthlySummary.length
      ? report.monthlySummary.map((item) => [item.label, item.income, item.expenses, item.net, item.count])
      : [["No matching months", 0, 0, 0, 0]],
    { amountColumns: [1, 2, 3] },
  );

  const categoryStart = sheet.rowCount + 3;
  addTable(
    sheet,
    categoryStart,
    1,
    ["Income Category", "Amount", "Count", "Share"],
    report.incomeCategories.length
      ? report.incomeCategories.map((item) => [item.category, item.amount, item.count, item.share])
      : [["No income", 0, 0, 0]],
    { amountColumns: [1] },
  );
  addTable(
    sheet,
    categoryStart,
    6,
    ["Expense Category", "Amount", "Count", "Share"],
    report.expenseCategories.length
      ? report.expenseCategories.map((item) => [item.category, item.amount, item.count, item.share])
      : [["No expenses", 0, 0, 0]],
    { amountColumns: [1] },
  );
  for (let rowNumber = categoryStart + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    sheet.getCell(rowNumber, 4).numFmt = "0.0%";
    sheet.getCell(rowNumber, 9).numFmt = "0.0%";
  }
  styleWorksheet(sheet, "Treasury chart-ready analysis");
}

function addSectionHeading(sheet, label, endColumn) {
  sheet.addRow([]);
  const row = sheet.addRow([label]);
  sheet.mergeCells(row.number, 1, row.number, endColumn);
  row.getCell(1).font = { name: "Aptos Display", size: 13, bold: true, color: { argb: COLORS.wine } };
  row.getCell(1).border = { bottom: { style: "medium", color: { argb: COLORS.gold } } };
  row.height = 22;
  return row.number + 1;
}

function styleTotalRow(row, amountColumns) {
  row.eachCell((cell, column) => {
    cell.font = { name: "Aptos", bold: true, color: { argb: COLORS.ink } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.cream } };
    cell.border = { top: { style: "thin", color: { argb: COLORS.gold } } };
    if (amountColumns.includes(column)) cell.numFmt = TREASURY_INR_FORMAT;
  });
}

function shareRows(groups, emptyLabel) {
  return groups.length ? groups.map((group) => [group.label, group.amount, group.count, group.share]) : [[emptyLabel, 0, 0, 0]];
}

function addShareTable(sheet, heading, firstHeader, groups, emptyLabel, total) {
  const start = addSectionHeading(sheet, heading, 6);
  const last = addTable(sheet, start, 1, [firstHeader, "Amount", "Entries", "Share"], shareRows(groups, emptyLabel), { amountColumns: [1] });
  for (let rowNumber = start + 1; rowNumber <= last; rowNumber += 1) sheet.getCell(rowNumber, 4).numFmt = "0.0%";
  const totalRow = sheet.getRow(last + 1);
  totalRow.values = ["Total", total, groups.reduce((sum, group) => sum + group.count, 0), groups.length ? 1 : 0];
  styleTotalRow(totalRow, [2]);
  totalRow.getCell(4).numFmt = "0.0%";
}

// Income or Expenses: the entries, then month-wise, avenue-wise and event-wise totals.
function addFlowSheet(workbook, report, kind) {
  const income = kind === "income";
  const data = report.breakdown[kind];
  const word = income ? "Income" : "Expenses";
  const sheet = workbook.addWorksheet(word);
  const proofColumns = bankProofColumnCount(data.rows);
  sheet.columns = [{ width: 30 }, { width: 18 }, { width: 22 }, { width: 30 }, { width: 18 }, { width: 18 }, ...linkHeaders(proofColumns).map(() => ({ width: 22 }))];
  styleTitle(sheet, `${report.title} | ${word}`, `${data.count} ${income ? "income" : "expense"} entr${data.count === 1 ? "y" : "ies"} | ${report.reportPeriod}${income ? "" : " | Reimbursements are counted as expenses"}`, 6);
  sheet.addRow([]);
  const listStart = sheet.rowCount + 1;
  const entries = data.rows.length
    ? data.rows.map((row) => [row.description, row.date || row.dateLabel, row.category, row.event, row.amount, row.type, ...linkValues(row, proofColumns)])
    : [[`No ${income ? "income" : "expense"} entries for the active filters.`, "", "", "", 0, ""]];
  const listEnd = addTable(sheet, listStart, 1, ["Entry", "Date", "Avenue", "Event", "Amount", "Type", ...linkHeaders(proofColumns)], entries, { amountColumns: [4] });
  for (let rowNumber = listStart + 1; rowNumber <= listEnd; rowNumber += 1) {
    if (sheet.getCell(rowNumber, 2).value instanceof Date) sheet.getCell(rowNumber, 2).numFmt = "yyyy-mm-dd";
    styleLinkCells(sheet.getRow(rowNumber), 7, proofColumns + 1);
  }
  const totalRow = sheet.getRow(listEnd + 1);
  totalRow.values = [`Total ${income ? "income" : "expenses"}`, "", "", "", { formula: `SUM(E${listStart + 1}:E${listEnd})`, result: data.total }, ""];
  styleTotalRow(totalRow, [5]);
  sheet.views = [{ state: "frozen", ySplit: listStart }];

  addShareTable(sheet, `${word} by month`, "Month", data.byMonth, "No months", data.total);
  addShareTable(sheet, `${word} by avenue`, "Avenue", data.byAvenue, "No avenues", data.total);
  addShareTable(sheet, `${word} by event`, "Event", data.byEvent, "No events", data.total);
  styleWorksheet(sheet, `Treasury ${income ? "income" : "expenses"}`);
}

// Each avenue as a block, with its events under it and the avenue total.
function addAvenueEventSheet(workbook, report) {
  const { avenueEvents, totals } = report.breakdown;
  const sheet = workbook.addWorksheet("Avenue & Event");
  sheet.columns = [{ width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }];
  styleTitle(sheet, `${report.title} | Avenue & Event`, `Income, expenses and net for each event, grouped by avenue | ${report.reportPeriod}`, 5);
  if (!avenueEvents.length) {
    sheet.addRow([]);
    sheet.addRow(["No Treasury entries for the active filters."]);
  }
  avenueEvents.forEach((block) => {
    const start = addSectionHeading(sheet, block.avenue, 5);
    const last = addTable(sheet, start, 1, ["Event", "Income", "Expenses", "Net", "Entries"], block.events.map((event) => [event.name, event.income, event.expense, event.net, event.count]), { amountColumns: [1, 2, 3] });
    const totalRow = sheet.getRow(last + 1);
    totalRow.values = [`${block.avenue} total`, block.income, block.expense, block.net, block.count];
    styleTotalRow(totalRow, [2, 3, 4]);
  });
  sheet.addRow([]);
  const grand = sheet.addRow(["Grand total", totals.income, totals.expense, totals.net, totals.count]);
  styleTotalRow(grand, [2, 3, 4]);
  grand.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.gold } }; });
  styleWorksheet(sheet, "Treasury avenue and event matrix");
}

// Avenues down the side, months across: one grid for income and one for expenses.
function addAvenueMonthSheet(workbook, report) {
  const { months, income, expense } = report.breakdown.avenueMonths;
  const columns = months.length + 2;
  const sheet = workbook.addWorksheet("Avenue by Month");
  sheet.columns = [{ width: 26 }, ...months.map(() => ({ width: 16 })), { width: 18 }];
  styleTitle(sheet, `${report.title} | Avenue by Month`, `Month-wise totals for each avenue | ${report.reportPeriod}`, Math.max(columns, 2));
  [["Income", income], ["Expenses", expense]].forEach(([label, grid]) => {
    const start = addSectionHeading(sheet, `${label} by avenue and month`, Math.max(columns, 2));
    const rows = grid.rows.length ? grid.rows.map((line) => [line.avenue, ...line.cells, line.total]) : [[`No ${label.toLowerCase()}`, ...months.map(() => 0), 0]];
    const amountColumns = Array.from({ length: months.length + 1 }, (_, index) => index + 1);
    const last = addTable(sheet, start, 1, ["Avenue", ...months.map((month) => month.label), "Total"], rows, { amountColumns });
    const totalRow = sheet.getRow(last + 1);
    totalRow.values = ["Total", ...grid.monthTotals, grid.total];
    styleTotalRow(totalRow, amountColumns.map((offset) => offset + 1));
  });
  styleWorksheet(sheet, "Treasury avenue by month");
}

export function buildTreasuryWorkbook(ExcelJS, report, generatedAt = report?.generatedAt || new Date()) {
  if (!report?.summary || !Array.isArray(report.transactions)) throw new TypeError("A Treasury export report is required.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.lastModifiedBy = "RCPH Website";
  workbook.company = "Rotaract Club of Pune Heritage";
  workbook.title = report.title;
  workbook.subject = "Treasury Financial Records";
  workbook.category = "Treasury";
  workbook.keywords = "RCPH Treasury Financial Records";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  addDashboardSheet(workbook, report);
  addTransactionsSheet(workbook, report);
  if (report.breakdown) {
    addFlowSheet(workbook, report, "income");
    addFlowSheet(workbook, report, "expense");
    addAvenueEventSheet(workbook, report);
    addAvenueMonthSheet(workbook, report);
  }
  addAnalysisSheet(workbook, report);
  return workbook;
}

// Month-wise ledger: one sheet per chosen month, then an "All months" sheet with every entry.
const LEDGER_BASE_HEADERS = ["Date", "Entry", "Type", "Avenue", "Event", "Party", "Payment mode", "Receipts", "Payments"];

function addLedgerSheet(workbook, model, name, title, rows, totals) {
  const proofColumns = bankProofColumnCount(rows);
  const headers = [...LEDGER_BASE_HEADERS, ...linkHeaders(proofColumns)];
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = [{ width: 13 }, { width: 36 }, { width: 15 }, { width: 20 }, { width: 26 }, { width: 26 }, { width: 15 }, { width: 16 }, { width: 16 }, ...linkHeaders(proofColumns).map(() => ({ width: 22 }))];
  styleTitle(sheet, `${model.title} | ${title}`, `${model.clubName} | Treasurer: ${model.treasurerName} | ${totals.count} entr${totals.count === 1 ? "y" : "ies"} | Generated ${model.generatedAtLabel}`, headers.length);
  sheet.addRow([]);
  const start = sheet.rowCount + 1;
  const values = rows.length
    ? rows.map((row) => [row.date || row.dateLabel, row.description, row.type, row.category, row.event, row.type === "Income" ? row.source : row.destination, row.paymentMethod, row.type === "Income" ? row.amount : null, row.type === "Income" ? null : row.amount, ...linkValues(row, proofColumns)])
    : [["", "No entries in this period.", "", "", "", "", "", 0, 0]];
  const last = addTable(sheet, start, 1, headers, values, { amountColumns: [7, 8] });
  for (let rowNumber = start + 1; rowNumber <= last; rowNumber += 1) {
    if (sheet.getCell(rowNumber, 1).value instanceof Date) sheet.getCell(rowNumber, 1).numFmt = "yyyy-mm-dd";
    styleLinkCells(sheet.getRow(rowNumber), LEDGER_BASE_HEADERS.length + 1, proofColumns + 1);
  }
  const totalRow = sheet.getRow(last + 1);
  totalRow.values = ["", "Total", "", "", "", "", "", { formula: `SUM(H${start + 1}:H${last})`, result: totals.receipts }, { formula: `SUM(I${start + 1}:I${last})`, result: totals.payments }];
  styleTotalRow(totalRow, [8, 9]);
  const netRow = sheet.getRow(last + 2);
  netRow.values = ["", "Net (receipts minus payments)", "", "", "", "", "", { formula: `H${last + 1}-I${last + 1}`, result: totals.net }];
  styleTotalRow(netRow, [8]);
  sheet.views = [{ state: "frozen", ySplit: start }];
  sheet.autoFilter = { from: { row: start, column: 1 }, to: { row: start, column: headers.length } };
  styleWorksheet(sheet, `Treasury ledger | ${title}`);
  return sheet;
}

export function buildTreasuryMonthLedgerWorkbook(ExcelJS, model) {
  if (!Array.isArray(model?.months) || !model.months.length) throw new TypeError("Choose at least one month.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.company = "Rotaract Club of Pune Heritage";
  workbook.title = `${model.title} | Monthly Ledger`;
  workbook.created = model.generatedAt;
  workbook.modified = model.generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  model.months.forEach((month) => addLedgerSheet(workbook, model, month.label, month.label, month.rows, month));
  const all = addLedgerSheet(workbook, model, "All months", `All months | ${model.periodLabel}`, model.rows, model.totals);
  if (model.months.length > 1) {
    const start = all.rowCount + 2;
    const last = addTable(all, start, 1, ["Month", "Entries", "Receipts", "Payments", "Net"], model.months.map((month) => [month.label, month.count, month.receipts, month.payments, month.net]), { amountColumns: [2, 3, 4] });
    const totalRow = all.getRow(last + 1);
    totalRow.values = ["Total", model.totals.count, model.totals.receipts, model.totals.payments, model.totals.net];
    styleTotalRow(totalRow, [3, 4, 5]);
  }
  return workbook;
}

export async function downloadTreasuryMonthLedger(model) {
  const imported = await import("exceljs");
  const ExcelJS = imported.default || imported;
  const buffer = await buildTreasuryMonthLedgerWorkbook(ExcelJS, model).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = model.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function treasuryExcelFileName(report) {
  return treasuryExportFileName(report, "xlsx");
}

export async function downloadTreasuryWorkbook(report) {
  const imported = await import("exceljs");
  const ExcelJS = imported.default || imported;
  const workbook = buildTreasuryWorkbook(ExcelJS, report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = treasuryExcelFileName(report);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
