import { parseAttendanceDate } from "./attendanceExportModel.js";

const COLORS = Object.freeze({
  ink: "2A1720",
  wine: "6B1839",
  gold: "E5C268",
  cream: "FFF8E8",
  pale: "F8F1E7",
  border: "D8CDBD",
  present: "DFF2E4",
  absent: "F8D7DA",
  na: "ECEFF3",
  white: "FFFFFF",
});

function excelColumn(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function statusFill(status) {
  return status === "Present" ? COLORS.present : status === "Absent" ? COLORS.absent : COLORS.na;
}

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
  subtitleCell.alignment = { wrapText: true };
  sheet.getRow(2).height = 26;
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.ink } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.gold } } };
  });
  row.height = 24;
}

function applyStatusStyles(sheet, columnNumber, startRow, endRow) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const cell = sheet.getCell(rowNumber, columnNumber);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill(cell.value) } };
  }
}

export function buildAttendanceWorkbook(ExcelJS, report, generatedAt = new Date()) {
  if (!report?.events?.length) throw new Error("Select at least one event to export.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.subject = report.panel.title;
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const totals = report.rows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  const present = totals.Present || 0;
  const absent = totals.Absent || 0;
  const na = totals["Not applicable"] || 0;
  const counted = present + absent;

  const overview = workbook.addWorksheet("Overview", { views: [{ state: "frozen", ySplit: 7 }] });
  overview.properties.defaultRowHeight = 18;
  overview.showGridLines = false;
  overview.columns = [
    { width: 14 }, { width: 34 }, { width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 },
  ];
  styleTitle(overview, report.panel.title, "Exported from the authorized Admin attendance view. N/A includes the panel’s existing Not applicable / unrecorded state.", 7);
  const summary = [
    ["Events selected", report.events.length, "Roster rows", report.members.length],
    ["Present", present, "Absent", absent],
    ["Not applicable", na, "Attendance rate", counted ? present / counted : 0],
  ];
  summary.forEach((values) => overview.addRow(values));
  overview.getCell("D5").numFmt = "0.0%";
  for (let rowNumber = 3; rowNumber <= 5; rowNumber += 1) {
    overview.getCell(rowNumber, 1).font = { bold: true, color: { argb: COLORS.wine } };
    overview.getCell(rowNumber, 3).font = { bold: true, color: { argb: COLORS.wine } };
  }
  overview.addRow([]);
  const overviewHeader = overview.addRow(["Date", "Event", report.panel.categoryLabel, "Present", "Absent", "N/A", "Attendance rate"]);
  styleHeader(overviewHeader);
  for (const event of report.events) {
    const eventRows = report.rows.filter((row) => row.eventId === event.id);
    const eventPresent = eventRows.filter((row) => row.status === "Present").length;
    const eventAbsent = eventRows.filter((row) => row.status === "Absent").length;
    const eventNa = eventRows.length - eventPresent - eventAbsent;
    const row = overview.addRow([
      parseAttendanceDate(event.date), event.name, event.category, eventPresent, eventAbsent, eventNa,
      eventPresent + eventAbsent ? eventPresent / (eventPresent + eventAbsent) : 0,
    ]);
    row.getCell(1).numFmt = "yyyy-mm-dd";
    row.getCell(7).numFmt = "0.0%";
  }
  overview.autoFilter = { from: { row: overviewHeader.number, column: 1 }, to: { row: overviewHeader.number, column: 7 } };

  const detail = workbook.addWorksheet("Attendance", { views: [{ state: "frozen", ySplit: 4 }] });
  detail.showGridLines = false;
  detail.columns = [
    { width: 14 }, { width: 34 }, { width: 22 }, { width: 28 }, { width: 24 }, { width: 18 },
  ];
  styleTitle(detail, `${report.panel.title} · Detail`, `${report.events.length} selected event${report.events.length === 1 ? "" : "s"}; ${report.rows.length} attendance rows.`, 6);
  detail.addRow([]);
  const detailHeader = detail.addRow(["Event date", "Event", report.panel.categoryLabel, "Member", "Role / position", "Attendance status"]);
  styleHeader(detailHeader);
  for (const source of report.rows) {
    const row = detail.addRow([
      parseAttendanceDate(source.eventDate), source.eventName, source.category, source.memberName, source.roleOrPosition, source.status,
    ]);
    row.getCell(1).numFmt = "yyyy-mm-dd";
  }
  detail.autoFilter = { from: { row: detailHeader.number, column: 1 }, to: { row: detailHeader.number, column: 6 } };
  applyStatusStyles(detail, 6, detailHeader.number + 1, detail.rowCount);

  const matrixEventStart = 3;
  const matrixEventEnd = matrixEventStart + report.events.length - 1;
  const totalsStart = matrixEventEnd + 1;
  const matrixColumnCount = totalsStart + 3;
  const matrix = workbook.addWorksheet("Matrix", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
  matrix.showGridLines = false;
  styleTitle(matrix, `${report.panel.title} · Matrix`, "Attendance status by member and selected event. Attendance rate excludes N/A.", matrixColumnCount);
  matrix.addRow([]);
  const matrixHeader = matrix.addRow([
    "Member", "Role / position",
    ...report.events.map((event) => `${event.name} (${event.date})`),
    "Present", "Absent", "N/A", "Attendance rate",
  ]);
  styleHeader(matrixHeader);
  matrix.getColumn(1).width = 28;
  matrix.getColumn(2).width = 24;
  for (let column = matrixEventStart; column <= matrixEventEnd; column += 1) matrix.getColumn(column).width = 18;
  for (let column = totalsStart; column <= matrixColumnCount; column += 1) matrix.getColumn(column).width = 14;
  for (const member of report.members) {
    const statuses = report.events.map((event) => report.rows.find((row) => row.memberId === member.id && row.eventId === event.id)?.status || "Not applicable");
    const presentCount = statuses.filter((status) => status === "Present").length;
    const absentCount = statuses.filter((status) => status === "Absent").length;
    const naCount = statuses.length - presentCount - absentCount;
    const row = matrix.addRow([member.name, member.roleOrPosition, ...statuses]);
    const rowNumber = row.number;
    const range = `${excelColumn(matrixEventStart)}${rowNumber}:${excelColumn(matrixEventEnd)}${rowNumber}`;
    row.getCell(totalsStart).value = { formula: `COUNTIF(${range},"Present")`, result: presentCount };
    row.getCell(totalsStart + 1).value = { formula: `COUNTIF(${range},"Absent")`, result: absentCount };
    row.getCell(totalsStart + 2).value = { formula: `COUNTIF(${range},"Not applicable")`, result: naCount };
    row.getCell(totalsStart + 3).value = {
      formula: `IF(SUM(${excelColumn(totalsStart)}${rowNumber}:${excelColumn(totalsStart + 1)}${rowNumber})=0,0,${excelColumn(totalsStart)}${rowNumber}/SUM(${excelColumn(totalsStart)}${rowNumber}:${excelColumn(totalsStart + 1)}${rowNumber}))`,
      result: presentCount + absentCount ? presentCount / (presentCount + absentCount) : 0,
    };
    row.getCell(totalsStart + 3).numFmt = "0.0%";
    for (let column = matrixEventStart; column <= matrixEventEnd; column += 1) {
      row.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill(row.getCell(column).value) } };
    }
  }
  matrix.autoFilter = { from: { row: matrixHeader.number, column: 1 }, to: { row: matrixHeader.number, column: matrixColumnCount } };

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => row.eachCell((cell) => {
      cell.font = { name: cell.font?.name || "Aptos", size: cell.font?.size || 10, ...cell.font };
      cell.alignment = { vertical: "middle", ...cell.alignment };
    }));
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.headerFooter.oddFooter = "Rotaract Club of Pune Heritage · Attendance export";
  }
  return workbook;
}

export function attendanceExportFileName(report) {
  const dates = report.events.map((event) => event.date).sort();
  const scope = dates.length === 1 ? dates[0] : `${dates[0]}_to_${dates.at(-1)}`;
  return `RCPH_${report.panel.key}_attendance_${scope}.xlsx`;
}

export async function downloadAttendanceWorkbook(report) {
  const imported = await import("exceljs");
  const ExcelJS = imported.default || imported;
  const workbook = buildAttendanceWorkbook(ExcelJS, report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attendanceExportFileName(report);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
