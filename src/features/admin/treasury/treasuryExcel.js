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
  sheet.columns = [
    { width: 14 }, { width: 16 }, { width: 18 }, { width: 42 }, { width: 16 }, { width: 18 },
    { width: 26 }, { width: 26 }, { width: 44 }, { width: 22 }, { width: 22 }, { width: 24 },
  ];
  styleTitle(sheet, `${report.title} | Transactions`, `${report.transactionCount} filtered transaction${report.transactionCount === 1 ? "" : "s"} | ${report.reportPeriod}`, TREASURY_EXPORT_COLUMNS.length);
  addKeyValueRow(sheet, ["Treasurer", report.treasurerName, "Generated", report.generatedAtLabel, "Filters", report.filterSummary.join("; ")]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(TREASURY_EXPORT_COLUMNS);
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
    to: { row: headerRow.number, column: TREASURY_EXPORT_COLUMNS.length },
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
  addAnalysisSheet(workbook, report);
  return workbook;
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
