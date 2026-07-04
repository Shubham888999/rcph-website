export const A4_PDF_SIZE = Object.freeze({ width: 595, height: 842 });

export function normalizePdfText(value) {
  return String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function escapePdfText(value) {
  return normalizePdfText(value).replace(/[\\()]/g, (character) => `\\${character}`);
}

export function wrapPdfText(value, maxWidth, fontSize = 9) {
  const averageCharacterWidth = fontSize * 0.52;
  const maxCharacters = Math.max(1, Math.floor(maxWidth / averageCharacterWidth));
  const lines = [];
  for (const paragraph of normalizePdfText(value).split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      if (word.length > maxCharacters) {
        if (current) { lines.push(current); current = ""; }
        for (let index = 0; index < word.length; index += maxCharacters) lines.push(word.slice(index, index + maxCharacters));
      } else if (!current) current = word;
      else if (`${current} ${word}`.length <= maxCharacters) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function pdfTextCommand({ x, y, text, size = 9, bold = false, gray = 0 }) {
  const shade = Math.max(0, Math.min(1, Number(gray) || 0));
  return `BT ${shade} g /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdfText(text)}) Tj ET`;
}

export function pdfLineCommand({ x1, y1, x2, y2, width = 0.5, gray = 0.7 }) {
  return `${Math.max(0, Math.min(1, gray))} G ${width} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`;
}

export function pdfFillRectCommand({ x, y, width, height, gray = 0.93 }) {
  return `${Math.max(0, Math.min(1, gray))} g ${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re f`;
}

export function buildSimpleA4Pdf(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new TypeError("At least one PDF page is required.");
  const objects = [];
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((commands, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = commands.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PDF_SIZE.width} ${A4_PDF_SIZE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
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
