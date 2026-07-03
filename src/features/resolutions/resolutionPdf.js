import { FINAL_RESOLUTION_STATUSES, getResolutionPdfFilename } from "./resolutionModel.js";

function formatDateTime(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function plainPdfText(value) {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function pdfText(value) {
  return plainPdfText(value).replace(/[\\()]/g, (character) => `\\${character}`);
}

function wrapText(value, width) {
  const paragraphs = plainPdfText(value).split(/\n/);
  const lines = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); return; }
    let current = "";
    words.forEach((word) => {
      if (word.length > width) {
        if (current) { lines.push(current); current = ""; }
        for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
      } else if (!current) current = word;
      else if (`${current} ${word}`.length <= width) current += ` ${word}`;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
  });
  return lines;
}

export function buildResolutionVoteRows(details) {
  const votes = new Map((details?.votes || []).map((vote) => [vote.voterUid, vote]));
  return (details?.resolution?.eligibleVoters || []).map((voter) => {
    const vote = votes.get(voter.uid);
    return {
      name: voter.name,
      position: voter.position,
      vote: vote ? label(vote.choice) : "Not submitted",
      submittedAt: vote ? formatDateTime(vote.submittedAt) : "-",
    };
  });
}

function buildDocumentLines(details) {
  const resolution = details.resolution;
  const lines = [];
  const add = (value, options = {}) => wrapText(value, options.width || (options.size >= 14 ? 58 : 92)).forEach((text) => lines.push({ text, size: options.size || 10, bold: options.bold === true, mono: options.mono === true, gap: options.gap || 0 }));
  const detail = (name, value) => add(`${name}: ${value || "-"}`, { size: 9, width: 105 });
  add("ROTARACT CLUB OF PUNE HERITAGE", { size: 16, bold: true, width: 50, gap: 2 });
  add("BOD RESOLUTION", { size: 14, bold: true, gap: 8 });
  detail("Resolution number", resolution.resolutionNumber);
  detail("Resolution title", resolution.title);
  detail("BOD meeting", resolution.meetingTitle);
  detail("Meeting date", resolution.meetingDate);
  detail("Proposed by", `${resolution.proposedByName} - ${resolution.proposedByPosition}`);
  detail("Seconded by", `${resolution.secondedByName} - ${resolution.secondedByPosition}`);
  detail("Voting opened", formatDateTime(resolution.openedAt));
  detail("Voting closed", formatDateTime(resolution.closedAt));
  detail("Final result", label(resolution.result || resolution.status));
  add("Resolution", { size: 12, bold: true, gap: 2 });
  add(resolution.body, { size: 10, width: 92, gap: 5 });
  if (resolution.notes) { add("Background / notes", { size: 12, bold: true, gap: 2 }); add(resolution.notes, { size: 10, width: 92, gap: 5 }); }
  add("Vote summary", { size: 12, bold: true, gap: 2 });
  detail("Eligible voters", resolution.eligibleVoterCount);
  detail("Votes received", resolution.votesReceivedCount);
  detail("Approvals", resolution.approveCount);
  detail("Rejections", resolution.rejectCount);
  detail("Abstentions", resolution.abstainCount);
  add("Final vote table", { size: 12, bold: true, gap: 2 });
  add("Name                     | Position                       | Vote         | Submitted at", { size: 8, bold: true, mono: true });
  add("-------------------------+--------------------------------+--------------+--------------------------", { size: 8, mono: true });
  buildResolutionVoteRows(details).forEach((row) => {
    const cells = [wrapText(row.name, 24), wrapText(row.position, 30), wrapText(row.vote, 12), wrapText(row.submittedAt, 24)];
    const height = Math.max(...cells.map((cell) => cell.length));
    for (let index = 0; index < height; index += 1) {
      const text = `${(cells[0][index] || "").padEnd(24)} | ${(cells[1][index] || "").padEnd(30)} | ${(cells[2][index] || "").padEnd(12)} | ${(cells[3][index] || "").padEnd(24)}`;
      lines.push({ text, size: 8, mono: true, gap: index === height - 1 ? 2 : 0 });
    }
  });
  add("System-generated resolution record", { size: 8, gap: 1 });
  add(`Generated at: ${formatDateTime(new Date().toISOString())}`, { size: 8 });
  return lines;
}

function paginate(lines) {
  const pages = [[]];
  let y = 800;
  lines.forEach((line) => {
    const height = line.size * 1.35 + line.gap;
    if (y - height < 42) { pages.push([]); y = 800; }
    pages.at(-1).push({ ...line, y });
    y -= height;
  });
  return pages;
}

export function buildResolutionPdfDocument(details) {
  const resolution = details?.resolution;
  if (!resolution || !FINAL_RESOLUTION_STATUSES.includes(resolution.status)) throw new Error("Only finalized resolutions can be downloaded as PDF.");
  const pages = paginate(buildDocumentLines(details));
  const objects = [];
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const stream = page.map((line) => `BT /${line.mono ? "F3" : line.bold ? "F2" : "F1"} ${line.size} Tf 45 ${line.y.toFixed(1)} Td (${pdfText(line.text)}) Tj ET`).join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 ${5 + pages.length * 2} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const courierId = 5 + pages.length * 2;
  objects[courierId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export async function generateResolutionPdf(details) {
  const pdf = buildResolutionPdfDocument(details);
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getResolutionPdfFilename(details.resolution.resolutionNumber);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
