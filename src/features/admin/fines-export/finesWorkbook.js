import {
  createSheet,
  finishSheet,
  styleHeaderCell,
  thinBorder,
  solid,
  COLORS,
  writeFineRows,
  writeNote,
  writeSectionTitle,
  writeTitleRow,
  writeTotalRow,
} from "../attendance-export/attendanceWorkbook.js";

const FINE_COLUMN_WIDTHS = Object.freeze([32, 12, 24, 36, 14]);
const MEMBER_HEADERS = Object.freeze(["Name", "Fines", "Total (Rs)"]);

function setFineColumnWidths(sheet) {
  FINE_COLUMN_WIDTHS.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
}

function freezeHeader(sheet, headerRow) {
  sheet.views = [{ state: "frozen", ySplit: headerRow, showGridLines: false }];
}

function titleText(info, period) {
  return `Club ID: ${info.clubId}   |   Fines: ${period}   |   Zone: ${info.zone}`;
}

function writeFineList(sheet, rows, total, periodLabel) {
  if (!rows.length) {
    writeNote(sheet, 2, `No fines recorded for ${periodLabel}.`);
    return 3;
  }
  return writeFineRows(sheet, 2, rows, total);
}

function writeMemberCell(sheet, rowNumber, column, value) {
  const cell = sheet.getCell(rowNumber, column);
  cell.value = value;
  cell.font = { name: "Aptos", size: 10 };
  cell.fill = solid(column === 1 ? COLORS.pale : COLORS.white);
  cell.alignment = { vertical: "middle", horizontal: column === 1 ? "left" : "right", wrapText: true };
  cell.border = thinBorder();
  if (column === 3) cell.numFmt = "#,##0";
}

function writeMemberSummary(sheet, startRow, byMember) {
  const titleRow = startRow;
  writeSectionTitle(sheet, titleRow, "Fines by member");
  const headerRow = titleRow + 1;
  MEMBER_HEADERS.forEach((value, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = value;
    styleHeaderCell(cell, index + 1);
  });
  sheet.getRow(headerRow).height = 22;
  let rowNumber = headerRow + 1;
  for (const member of byMember) {
    writeMemberCell(sheet, rowNumber, 1, member.name);
    writeMemberCell(sheet, rowNumber, 2, member.count);
    writeMemberCell(sheet, rowNumber, 3, member.total);
    rowNumber += 1;
  }
  const count = byMember.reduce((sum, member) => sum + member.count, 0);
  const total = byMember.reduce((sum, member) => sum + member.total, 0);
  writeTotalRow(sheet, rowNumber, [
    "Total",
    { formula: `SUM(B${headerRow + 1}:B${rowNumber - 1})`, result: count },
    { formula: `SUM(C${headerRow + 1}:C${rowNumber - 1})`, result: total },
  ]);
}

function buildMonthSheet(workbook, report, month) {
  const sheet = createSheet(workbook, month.shortLabel);
  writeTitleRow(sheet, titleText(report.info, month.label), FINE_COLUMN_WIDTHS.length);
  writeFineList(sheet, month.rows, month.total, month.label);
  setFineColumnWidths(sheet);
  freezeHeader(sheet, 2);
  finishSheet(sheet);
}

function buildAllMonthsSheet(workbook, report) {
  const sheet = createSheet(workbook, "All Months");
  const periodLabel = `${report.months[0].label} – ${report.months.at(-1).label}`;
  writeTitleRow(sheet, titleText(report.info, periodLabel), FINE_COLUMN_WIDTHS.length);
  const { rows, total, byMember } = report.allMonths;
  const nextRow = writeFineList(sheet, rows, total, periodLabel);
  if (byMember.length) writeMemberSummary(sheet, nextRow + 2, byMember);
  setFineColumnWidths(sheet);
  freezeHeader(sheet, 2);
  finishSheet(sheet);
}

export function buildFinesWorkbook(ExcelJS, report, generatedAt = new Date()) {
  if (!report?.months?.length) throw new Error("Select at least one month to export.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.subject = "Fines export";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  for (const month of report.months) buildMonthSheet(workbook, report, month);
  if (report.months.length >= 2 && report.allMonths) buildAllMonthsSheet(workbook, report);
  return workbook;
}

export function finesExportFileName(report) {
  const months = Array.isArray(report?.months) ? report.months : [];
  const part = (month) => String(month?.shortLabel || "").replace(/\s+/g, "_");
  if (!months.length) return "RCPH_Fines.xlsx";
  if (months.length === 1) return `RCPH_Fines_${part(months[0])}.xlsx`;
  return `RCPH_Fines_${part(months[0])}-${part(months.at(-1))}.xlsx`;
}

export async function downloadFinesWorkbook(report) {
  const imported = await import("exceljs");
  const ExcelJS = imported.default || imported;
  const workbook = buildFinesWorkbook(ExcelJS, report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = finesExportFileName(report);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
