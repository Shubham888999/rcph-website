export const COLORS = Object.freeze({
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

const NAME_COLUMN_WIDTH = 38;
const EVENT_COLUMN_WIDTH = 13;
const PERC_COLUMN_WIDTH = 9;
const FOOTER = "Rotaract Club of Pune Heritage · Attendance export";

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

export function solid(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function thinBorder(bottomColor = COLORS.border) {
  const side = { style: "thin", color: { argb: COLORS.border } };
  return { top: side, left: side, right: side, bottom: { style: "thin", color: { argb: bottomColor } } };
}

function markFill(mark) {
  return mark === "A" ? COLORS.absent : mark === "N/A" ? COLORS.na : COLORS.white;
}

function percFormula(range) {
  return `IF(COUNTIF(${range},"P")+COUNTIF(${range},"A")=0,"N/A",ROUND(COUNTIF(${range},"P")/(COUNTIF(${range},"P")+COUNTIF(${range},"A"))*100,1))`;
}

function percResult(marks) {
  const present = marks.filter((mark) => mark === "P").length;
  const absent = marks.filter((mark) => mark === "A").length;
  return present + absent === 0 ? "N/A" : Math.round((present / (present + absent)) * 1000) / 10;
}

function rowRange(rowNumber, firstColumn, lastColumn) {
  return `${excelColumn(firstColumn)}${rowNumber}:${excelColumn(lastColumn)}${rowNumber}`;
}

export function writeTitleRow(sheet, text, endColumn) {
  sheet.mergeCells(1, 1, 1, Math.max(endColumn, 2));
  const cell = sheet.getCell(1, 1);
  cell.value = text;
  cell.font = { name: "Aptos", size: 14, bold: true, color: { argb: COLORS.white } };
  cell.fill = solid(COLORS.wine);
  cell.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 26;
}

export function writeSectionTitle(sheet, rowNumber, title) {
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = title;
  cell.font = { name: "Aptos", size: 13, bold: true, color: { argb: COLORS.wine } };
}

export function styleHeaderCell(cell, column) {
  cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.white } };
  cell.fill = solid(COLORS.ink);
  cell.alignment = { vertical: "middle", horizontal: column === 1 ? "left" : "center", wrapText: true };
  cell.border = thinBorder(COLORS.gold);
}

export function writeHeaderRow(sheet, rowNumber, values) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = value;
    styleHeaderCell(cell, index + 1);
  });
  sheet.getRow(rowNumber).height = 48;
}

export function writeNote(sheet, rowNumber, text) {
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = { name: "Aptos", size: 10, italic: true, color: { argb: COLORS.ink } };
}

export function writeNameCell(sheet, rowNumber, label) {
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = label;
  cell.font = { name: "Aptos", size: 10 };
  cell.fill = solid(COLORS.pale);
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.border = thinBorder();
}

function writeMarkCell(sheet, rowNumber, column, mark) {
  const cell = sheet.getCell(rowNumber, column);
  cell.value = mark;
  cell.font = { name: "Aptos", size: 10 };
  cell.fill = solid(markFill(mark));
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.border = thinBorder();
}

function writePercCell(sheet, rowNumber, column, range, marks) {
  const cell = sheet.getCell(rowNumber, column);
  cell.value = { formula: percFormula(range), result: percResult(marks) };
  cell.numFmt = "General";
  cell.font = { name: "Aptos", size: 10, bold: true };
  cell.fill = solid(COLORS.cream);
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.border = thinBorder();
}

export const FINE_HEADERS = Object.freeze(["Name", "Date", "Reason", "Event", "Amount (Rs)"]);
const FINE_MIN_COLUMN_WIDTH = 13;
const AMOUNT_FORMAT = "#,##0";

function writeFineCell(sheet, rowNumber, column, value, options = {}) {
  const cell = sheet.getCell(rowNumber, column);
  cell.value = value;
  cell.font = { name: "Aptos", size: 10, bold: options.bold === true };
  cell.fill = solid(column === 1 ? COLORS.pale : options.fill || COLORS.white);
  cell.alignment = { vertical: "middle", horizontal: column === 1 ? "left" : options.horizontal || "left", wrapText: true };
  cell.border = thinBorder();
  if (options.numFmt) cell.numFmt = options.numFmt;
  return cell;
}

export function writeTotalRow(sheet, rowNumber, values) {
  values.forEach((value, index) => {
    const isFormula = value && typeof value === "object";
    writeFineCell(sheet, rowNumber, index + 1, value, {
      bold: true,
      fill: COLORS.cream,
      horizontal: isFormula ? "right" : "left",
      numFmt: isFormula ? AMOUNT_FORMAT : undefined,
    });
  });
}

export function writeFineRows(sheet, headerRow, rows, total) {
  writeHeaderRow(sheet, headerRow, FINE_HEADERS);
  sheet.getRow(headerRow).height = 22;
  let rowNumber = headerRow + 1;
  for (const row of rows) {
    writeFineCell(sheet, rowNumber, 1, row.name);
    writeFineCell(sheet, rowNumber, 2, row.date, { horizontal: "center" });
    writeFineCell(sheet, rowNumber, 3, row.reason);
    writeFineCell(sheet, rowNumber, 4, row.event);
    writeFineCell(sheet, rowNumber, 5, row.amount, { horizontal: "right", numFmt: AMOUNT_FORMAT });
    rowNumber += 1;
  }
  writeTotalRow(sheet, rowNumber, ["Total", "", "", "", { formula: `SUM(E${headerRow + 1}:E${rowNumber - 1})`, result: total }]);
  return rowNumber + 1;
}

export function writeFinesTable(sheet, startRow, { title, rows, total, emptyText }) {
  const titleRow = startRow + 2;
  writeSectionTitle(sheet, titleRow, title);
  if (!rows?.length) {
    writeNote(sheet, titleRow + 1, emptyText);
    return titleRow + 2;
  }
  return writeFineRows(sheet, titleRow + 1, rows, total);
}

export function widenFineColumns(sheet) {
  for (let column = 2; column <= FINE_HEADERS.length; column += 1) {
    const current = sheet.getColumn(column).width || 0;
    sheet.getColumn(column).width = Math.max(current, FINE_MIN_COLUMN_WIDTH);
  }
}

function emptySectionNote(section, periodLabel) {
  return `No ${section.title ? "BOD meetings" : "events"} recorded for ${periodLabel}.`;
}

function setColumnWidths(sheet, eventColumns, percColumns, lastColumn) {
  sheet.getColumn(1).width = NAME_COLUMN_WIDTH;
  for (let column = 2; column <= lastColumn; column += 1) {
    sheet.getColumn(column).width = eventColumns.has(column) ? EVENT_COLUMN_WIDTH : percColumns.has(column) ? PERC_COLUMN_WIDTH : EVENT_COLUMN_WIDTH;
  }
}

export function finishSheet(sheet) {
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  sheet.headerFooter.oddFooter = FOOTER;
}

export function createSheet(workbook, name) {
  return workbook.addWorksheet(name, { views: [{ showGridLines: false }] });
}

function freezeAt(sheet, headerRow) {
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: headerRow, showGridLines: false }];
}

function buildMonthSheet(workbook, report, month) {
  const sheet = createSheet(workbook, month.shortLabel);
  const lastColumn = Math.max(2, ...month.sections.map((section) => section.events.length + 2));
  writeTitleRow(sheet, `Club ID: ${report.info.clubId}   |   Month: ${month.label}   |   Zone: ${report.info.zone}`, lastColumn);

  const eventColumns = new Set();
  const percColumns = new Set();
  let rowNumber = 2;
  let firstHeaderRow = 0;
  for (const section of month.sections) {
    if (section.title) {
      rowNumber += 1;
      writeSectionTitle(sheet, rowNumber, section.title);
      rowNumber += 1;
    }
    const percColumn = section.events.length + 2;
    writeHeaderRow(sheet, rowNumber, [section.headerLabel, ...section.events.map((event) => event.label), "PERC"]);
    if (!firstHeaderRow) firstHeaderRow = rowNumber;
    section.events.forEach((_, index) => eventColumns.add(index + 2));
    percColumns.add(percColumn);
    rowNumber += 1;

    if (!section.events.length) {
      writeNote(sheet, rowNumber, emptySectionNote(section, month.label));
      rowNumber += 1;
      continue;
    }

    for (const row of section.rows) {
      writeNameCell(sheet, rowNumber, row.label);
      row.marks.forEach((mark, index) => writeMarkCell(sheet, rowNumber, index + 2, mark));
      writePercCell(sheet, rowNumber, percColumn, rowRange(rowNumber, 2, percColumn - 1), row.marks);
      rowNumber += 1;
    }
  }

  if (month.fines) {
    writeFinesTable(sheet, rowNumber - 1, { title: "Fines", ...month.fines, emptyText: `No fines recorded for ${month.label}.` });
  }

  setColumnWidths(sheet, eventColumns, percColumns, lastColumn);
  if (month.fines) widenFineColumns(sheet);
  freezeAt(sheet, firstHeaderRow || 2);
  finishSheet(sheet);
}

function buildAllMonthsSheet(workbook, report) {
  const sheet = createSheet(workbook, "All Months");
  const first = report.months[0];
  const last = report.months.at(-1);
  const periodLabel = `${first.label} – ${last.label}`;
  const sectionCount = Math.max(...report.months.map((month) => month.sections.length));

  const layouts = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const parts = report.months
      .map((month) => ({ month, section: month.sections[index] }))
      .filter((part) => part.section);
    const template = parts[0].section;
    const withEvents = parts.filter((part) => part.section.events.length);
    const eventCount = withEvents.reduce((total, part) => total + part.section.events.length, 0);
    layouts.push({ template, withEvents, eventCount, lastColumn: eventCount ? 1 + eventCount + withEvents.length + 1 : 2 });
  }
  const lastColumn = Math.max(2, ...layouts.map((layout) => layout.lastColumn));
  writeTitleRow(sheet, `Club ID: ${report.info.clubId}   |   Months: ${periodLabel}   |   Zone: ${report.info.zone}`, lastColumn);

  const eventColumns = new Set();
  const percColumns = new Set();
  let rowNumber = 2;
  let firstHeaderRow = 0;
  for (const layout of layouts) {
    const { template, withEvents, eventCount } = layout;
    if (template.title) {
      rowNumber += 1;
      writeSectionTitle(sheet, rowNumber, template.title);
      rowNumber += 1;
    }

    if (!eventCount) {
      writeNote(sheet, rowNumber, emptySectionNote(template, periodLabel));
      rowNumber += 1;
      continue;
    }

    const bandRow = rowNumber;
    const labelRow = rowNumber + 1;
    sheet.mergeCells(bandRow, 1, labelRow, 1);
    const nameHeader = sheet.getCell(bandRow, 1);
    nameHeader.value = template.headerLabel;
    styleHeaderCell(nameHeader, 1);
    styleHeaderCell(sheet.getCell(labelRow, 1), 1);

    let column = 2;
    const monthRanges = [];
    for (const { month, section } of withEvents) {
      const start = column;
      const end = column + section.events.length - 1;
      if (end > start) sheet.mergeCells(bandRow, start, bandRow, end);
      const band = sheet.getCell(bandRow, start);
      band.value = month.shortLabel;
      for (let bandColumn = start; bandColumn <= end; bandColumn += 1) styleHeaderCell(sheet.getCell(bandRow, bandColumn), bandColumn);
      section.events.forEach((event, index) => {
        const cell = sheet.getCell(labelRow, start + index);
        cell.value = event.label;
        styleHeaderCell(cell, start + index);
        eventColumns.add(start + index);
      });
      monthRanges.push({ month, section, start, end });
      column = end + 1;
    }
    const lastEventColumn = column - 1;
    const percStart = column;
    const percEnd = percStart + withEvents.length;
    sheet.mergeCells(bandRow, percStart, bandRow, percEnd);
    sheet.getCell(bandRow, percStart).value = "PERC";
    for (let percColumn = percStart; percColumn <= percEnd; percColumn += 1) {
      styleHeaderCell(sheet.getCell(bandRow, percColumn), percColumn);
      percColumns.add(percColumn);
    }
    monthRanges.forEach(({ month }, index) => {
      const cell = sheet.getCell(labelRow, percStart + index);
      cell.value = month.shortLabel;
      styleHeaderCell(cell, percStart + index);
    });
    const overallHeader = sheet.getCell(labelRow, percEnd);
    overallHeader.value = "Overall";
    styleHeaderCell(overallHeader, percEnd);
    sheet.getRow(bandRow).height = 22;
    sheet.getRow(labelRow).height = 48;
    if (!firstHeaderRow) firstHeaderRow = labelRow;
    rowNumber = labelRow + 1;

    for (const rosterRow of template.rows) {
      writeNameCell(sheet, rowNumber, rosterRow.label);
      const allMarks = [];
      monthRanges.forEach(({ section, start, end }, index) => {
        const marks = section.rows.find((row) => row.id === rosterRow.id)?.marks || section.events.map(() => "N/A");
        marks.forEach((mark, offset) => writeMarkCell(sheet, rowNumber, start + offset, mark));
        writePercCell(sheet, rowNumber, percStart + index, rowRange(rowNumber, start, end), marks);
        allMarks.push(...marks);
      });
      writePercCell(sheet, rowNumber, percEnd, rowRange(rowNumber, 2, lastEventColumn), allMarks);
      rowNumber += 1;
    }
  }

  if (report.allFines) {
    writeFinesTable(sheet, rowNumber - 1, { title: "Fines", ...report.allFines, emptyText: `No fines recorded for ${periodLabel}.` });
  }

  setColumnWidths(sheet, eventColumns, percColumns, lastColumn);
  if (report.allFines) widenFineColumns(sheet);
  freezeAt(sheet, firstHeaderRow || 2);
  finishSheet(sheet);
}

export function buildAttendanceWorkbook(ExcelJS, report, generatedAt = new Date()) {
  if (!report?.months?.length) throw new Error("Select at least one event to export.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rotaract Club of Pune Heritage";
  workbook.subject = "Attendance export";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  for (const month of report.months) buildMonthSheet(workbook, report, month);
  if (report.months.length >= 2) buildAllMonthsSheet(workbook, report);
  return workbook;
}

export function attendanceExportFileName(report) {
  const prefix = report?.panelKey === "bod"
    ? "RCPH_BOD_Attendance"
    : report?.panelKey === "district" ? "RCPH_District_Attendance" : "RCPH_Attendance";
  const months = Array.isArray(report?.months) ? report.months : [];
  const part = (month) => String(month?.shortLabel || "").replace(/\s+/g, "_");
  if (!months.length) return `${prefix}.xlsx`;
  if (months.length === 1) return `${prefix}_${part(months[0])}.xlsx`;
  return `${prefix}_${part(months[0])}-${part(months.at(-1))}.xlsx`;
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
