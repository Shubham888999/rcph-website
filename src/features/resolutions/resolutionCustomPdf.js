import { normalizeResolutionSections, VOTES_TABLE_COLUMNS } from "./resolutionSectionsModel.js";
import { formatRotaractorName } from "../../utils/memberName.js";
import { isAuthenticatedFinalHybrid } from "./resolutionModel.js";

const BOUNDS = Object.freeze({ left: 54, right: 541, bottom: 260, top: 665 });
const WIDTH = BOUNDS.right - BOUNDS.left;
const START_Y = BOUNDS.top - 10;
const PAGE_HEIGHT = START_Y - BOUNDS.bottom;

function printable(value, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function display(value) {
  return printable(value).replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

function approximateTextWidth(text, size, family = "Helvetica", bold = false) {
  const factor = family === "Courier" ? 0.6 : family === "Times Roman" ? 0.48 : 0.52;
  return String(text).length * size * factor * (bold ? 1.04 : 1);
}

function wrap(value, width, style) {
  const size = style.fontSize;
  const lines = [];
  String(value || "").replace(/\r\n/g, "\n").split("\n").forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); return; }
    let current = "";
    words.forEach((word) => {
      if (!current) current = word;
      else if (approximateTextWidth(`${current} ${word}`, size, style.fontFamily, style.bold) <= width) current += ` ${word}`;
      else { lines.push(current); current = word; }
      while (approximateTextWidth(current, size, style.fontFamily, style.bold) > width && current.length > 1) {
        const ratio = Math.max(1, Math.floor(current.length * width / approximateTextWidth(current, size, style.fontFamily, style.bold)));
        lines.push(current.slice(0, ratio));
        current = current.slice(ratio);
      }
    });
    if (current) lines.push(current);
  });
  return lines;
}

function alignedX(text, style, width = WIDTH, left = BOUNDS.left) {
  const measured = Math.min(width, approximateTextWidth(text, style.fontSize, style.fontFamily, style.bold));
  if (style.alignment === "center") return left + (width - measured) / 2;
  if (style.alignment === "right") return left + width - measured;
  return left;
}

function createPaginator() {
  const pages = [[]];
  let y = START_Y;
  const current = () => pages.at(-1);
  const newPage = (force = false) => {
    if (current().length || force) pages.push([]);
    y = START_Y;
  };
  const ensure = (height) => {
    if (height > PAGE_HEIGHT) throw new Error("A PDF row is taller than the complete Resolution content area. Shorten the row before generating the PDF.");
    if (current().length && y - height < BOUNDS.bottom) newPage();
  };
  const space = (height) => {
    if (height <= 0) return;
    ensure(height);
    y -= height;
  };
  const addText = (text, style, options = {}) => {
    const lineHeight = style.fontSize * style.lineSpacing;
    ensure(lineHeight);
    const x = alignedX(text, style, options.width, options.left);
    current().push({ kind: "text", text, x, y, size: style.fontSize, fontFamily: style.fontFamily, bold: style.bold, italic: style.italic, underline: style.underline, width: approximateTextWidth(text, style.fontSize, style.fontFamily, style.bold) });
    y -= lineHeight;
  };
  const addLine = (x1, y1, x2, y2) => current().push({ kind: "line", x1, y1, x2, y2 });
  return { pages, current, newPage, ensure, space, addText, addLine, get y() { return y; }, set y(value) { y = value; } };
}

function renderTextSection(pager, section) {
  const style = section.style;
  const lines = wrap(section.text, WIDTH, style);
  const lineHeight = style.fontSize * style.lineSpacing;
  const keepHeight = section.type === "heading" ? style.spaceBefore + lineHeight + style.spaceAfter + (10 * 1.25 * 2) : style.spaceBefore + lineHeight;
  pager.ensure(keepHeight);
  pager.space(style.spaceBefore);
  if (section.type === "paragraph" && section.listStyle !== "none") {
    const items = String(section.text || "").split("\n").map((item) => item.trim()).filter(Boolean);
    items.forEach((item, index) => {
      const prefix = section.listStyle === "bullet" ? "• " : `${index + 1}. `;
      const indent = approximateTextWidth(prefix, style.fontSize, style.fontFamily, style.bold);
      const itemLines = wrap(item, WIDTH - indent, style);
      itemLines.forEach((line, lineIndex) => pager.addText(`${lineIndex ? "" : prefix}${line}`, { ...style, alignment: "left" }, { left: BOUNDS.left + (lineIndex ? indent : 0), width: WIDTH - (lineIndex ? indent : 0) }));
    });
  } else lines.forEach((line) => pager.addText(line, style));
  pager.space(style.spaceAfter);
}

function normalizedVoteColumns(columns) {
  const enabled = VOTES_TABLE_COLUMNS.filter((key) => columns[key]);
  const base = columns.signature
    ? { name: 26, position: 25, vote: 13, timestamp: 21, signature: 15 }
    : { name: 31, position: 29, vote: 15, timestamp: 25, signature: 15 };
  const total = enabled.reduce((sum, key) => sum + base[key], 0) || 1;
  return enabled.map((key) => ({ key, width: base[key] / total * 100, alignment: key === "vote" ? "center" : "left" }));
}

function safeVoter(voter, vote, canonical) {
  return {
    name: formatRotaractorName(printable(vote?.voterName) || printable(voter?.name) || printable(canonical?.name, "Not available"), true),
    position: printable(vote?.voterPosition) || printable(voter?.position) || printable(canonical?.position, "Not available"),
  };
}

export function buildCustomVotesRows(details, section) {
  const method = details?.resolution?.approvalMethod || "website";
  const authenticatedFinal = isAuthenticatedFinalHybrid(details?.resolution);
  const votes = (Array.isArray(details?.votes) ? details.votes : []).filter((vote) => {
    if (vote?.superseded) return false;
    if (["superseded", "invalidated_document_changed"].includes(vote?.emailConfirmationStatus)) return false;
    if (method === "hybrid_email" && !authenticatedFinal) return vote?.emailConfirmationStatus === "email_verified";
    return true;
  });
  const eligible = Array.isArray(details?.resolution?.eligibleVoters) ? details.resolution.eligibleVoters : [];
  const canonical = new Map((details?.canonicalVoters || []).map((voter) => [voter.uid, voter]));
  const voteByUid = new Map(votes.map((vote) => [vote.voterUid, vote]));
  if (section.options.voterScope === "submitted") return votes.map((vote) => {
    const voter = eligible.find((item) => item.uid === vote.voterUid);
    return { ...safeVoter(voter, vote, canonical.get(vote.voterUid)), vote: display(vote.choice), timestamp: dateTime(vote.submittedAt), signature: "" };
  });
  return eligible.map((voter) => {
    const vote = voteByUid.get(voter.uid);
    return { ...safeVoter(voter, vote, canonical.get(voter.uid)), vote: vote ? display(vote.choice) : "Did not vote", timestamp: vote ? dateTime(vote.submittedAt) : "—", signature: "" };
  });
}

function tableRowModel(values, columns, style, header = false, signature = false) {
  const fontSize = header && style.headerFontSize ? style.headerFontSize : style.fontSize;
  const rowStyle = { fontFamily: style.fontFamily, fontSize, bold: header ? (style.headerBold ?? style.boldHeader) : false, italic: false, underline: false, alignment: "left", lineSpacing: 1.2 };
  const cells = columns.map((column, index) => {
    const width = WIDTH * (column.widthPercent ?? column.width) / 100;
    return { width, alignment: column.alignment || "left", lines: wrap(values[index] || "", width - style.cellPadding * 2, rowStyle) };
  });
  const lineCount = Math.max(1, ...cells.map((cell) => cell.lines.length));
  const height = Math.max(signature ? 28 : 0, lineCount * fontSize * 1.2 + style.cellPadding * 2);
  return { cells, height, style: rowStyle };
}

function drawTableRow(pager, model, showBorders) {
  pager.ensure(model.height);
  const top = pager.y;
  const bottom = top - model.height;
  let x = BOUNDS.left;
  model.cells.forEach((cell) => {
    if (showBorders) {
      pager.addLine(x, top, x + cell.width, top);
      pager.addLine(x, bottom, x + cell.width, bottom);
      pager.addLine(x, top, x, bottom);
      pager.addLine(x + cell.width, top, x + cell.width, bottom);
    }
    cell.lines.forEach((line, index) => {
      const lineStyle = { ...model.style, alignment: cell.alignment };
      const y = top - model.style.fontSize - model.style.fontSize * 1.2 * index - 2;
      const textX = alignedX(line, lineStyle, cell.width - 8, x + 4);
      pager.current().push({ kind: "text", text: line, x: textX, y, size: model.style.fontSize, fontFamily: model.style.fontFamily, bold: model.style.bold, italic: false, underline: false, width: approximateTextWidth(line, model.style.fontSize, model.style.fontFamily, model.style.bold) });
    });
    x += cell.width;
  });
  pager.y = bottom;
}

function renderTable(pager, section, rows, columns, options = {}) {
  const style = section.style;
  pager.space(style.spaceBefore);
  const models = rows.map((row, index) => tableRowModel(row, columns, style, options.headerIndex === index, options.signature));
  const header = options.headerIndex === 0 ? models[0] : null;
  models.forEach((model, index) => {
    if (model.height > PAGE_HEIGHT) throw new Error(`Table row ${index + 1} is too tall for a Resolution PDF page.`);
    if (pager.current().length && pager.y - model.height < BOUNDS.bottom) {
      pager.newPage();
      if (header && options.repeatHeader && index !== 0) drawTableRow(pager, header, options.showBorders);
    }
    drawTableRow(pager, model, options.showBorders);
  });
  pager.space(style.spaceAfter);
}

function renderCustomTable(pager, section) {
  const rows = section.rows.map((row) => section.columns.map((column) => row.cells[column.id] || ""));
  renderTable(pager, section, rows, section.columns, {
    headerIndex: section.options.hasHeaderRow ? 0 : -1,
    repeatHeader: section.options.hasHeaderRow && section.options.repeatHeader,
    showBorders: section.options.showBorders,
  });
}

function renderVotesTable(pager, section, details) {
  if (section.options.showTitle) renderTextSection(pager, { id: `${section.id}_title`, type: "heading", text: section.title, style: { fontFamily: section.style.fontFamily, fontSize: Math.max(10, section.style.headerFontSize), bold: true, italic: false, underline: false, alignment: "left", lineSpacing: 1.2, spaceBefore: section.style.spaceBefore, spaceAfter: 5 } });
  const columns = normalizedVoteColumns(section.columns);
  const labels = { name: "Name", position: "Position", vote: "Vote", timestamp: "Timestamp", signature: "Signature" };
  const rows = [columns.map((column) => labels[column.key]), ...buildCustomVotesRows(details, section).map((row) => columns.map((column) => row[column.key]))];
  renderTable(pager, { ...section, style: { ...section.style, spaceBefore: 0 } }, rows, columns, { headerIndex: 0, repeatHeader: section.options.repeatHeader, showBorders: true, signature: section.columns.signature });
  if (section.options.showResultSummary) {
    const resolution = details.resolution;
    renderTextSection(pager, { id: `${section.id}_result`, type: "paragraph", text: `Approve count: ${resolution.approveCount}\nReject count: ${resolution.rejectCount}\nAbstain count: ${resolution.abstainCount}\nEligible voter count: ${resolution.eligibleVoterCount}\nFinal result: ${display(resolution.result || resolution.status)}`, listStyle: "none", style: { fontFamily: section.style.fontFamily, fontSize: section.style.fontSize, bold: false, italic: false, underline: false, alignment: "left", lineSpacing: 1.2, spaceBefore: 0, spaceAfter: 6 } });
  }
}

export function buildCustomResolutionPdfPages(details, sections) {
  const pager = createPaginator();
  normalizeResolutionSections(sections).forEach((section) => {
    if (section.type === "heading" || section.type === "paragraph") renderTextSection(pager, section);
    else if (section.type === "table") renderCustomTable(pager, section);
    else if (section.type === "votesTable") renderVotesTable(pager, section, details);
    else if (section.mode === "pageBreak") { if (pager.current().length) pager.newPage(); }
    else pager.space({ small: 6, medium: 12, large: 24 }[section.mode]);
  });
  if (pager.pages.length > 1 && !pager.pages.at(-1).length) pager.pages.pop();
  return pager.pages;
}

export function getResolutionRenderLayout(details, preview = false) {
  const resolution = details?.resolution || {};
  if (preview) return { mode: resolution.pdfLayoutMode === "custom" ? "custom" : "standard", sections: resolution.pdfSections || [] };
  if (resolution.finalizedPdfLayoutMode === "custom" && Array.isArray(resolution.finalizedPdfSectionsSnapshot)) return { mode: "custom", sections: resolution.finalizedPdfSectionsSnapshot };
  return { mode: "standard", sections: [] };
}
