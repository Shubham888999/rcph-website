import { ascii, assemblePdf, imageObject, pdfText, poppinsFontObjects, streamObject } from "../../resolutions/resolutionPdf.js";
import { loadResolutionPoppinsFonts, poppinsTextWidth } from "../../resolutions/resolutionPoppins.js";
import { formatOutwardDate, outwardPdfFilenames } from "./outwardLetterModel.js";

// The Canva letter, bundled with the site. Positions below are measured on this image.
export const OUTWARD_TEMPLATE_URL = "/letters/rcph-outward-letter.jpg";
export const OUTWARD_TEMPLATE_SIZE = Object.freeze({ width: 1414, height: 2000 });

const PAGE = Object.freeze({ width: 595, height: 842 });
const toX = (px) => Number((px * PAGE.width / OUTWARD_TEMPLATE_SIZE.width).toFixed(2));
const toY = (px) => Number((PAGE.height - px * PAGE.height / OUTWARD_TEMPLATE_SIZE.height).toFixed(2));
const toW = (px) => Number((px * PAGE.width / OUTWARD_TEMPLATE_SIZE.width).toFixed(2));
const toH = (px) => Number((px * PAGE.height / OUTWARD_TEMPLATE_SIZE.height).toFixed(2));

// x and baselineY are template pixels. The blank covers the underscores printed in the template.
export const OUTWARD_FIELDS = Object.freeze({
  date: Object.freeze({ x: 90, baselineY: 285, maxWidth: 360, size: 10.5, bold: false }),
  clubName: Object.freeze({ x: 374, baselineY: 447, maxWidth: 890, size: 11.8, bold: true, blank: { x: 368, top: 420, width: 580, height: 36 } }),
  rid: Object.freeze({ x: 196, baselineY: 482, maxWidth: 400, size: 11.8, bold: true, blank: { x: 190, top: 456, width: 350, height: 36 } }),
});
const MIN_SIZE = 7;

// Shrinks long text down to a readable minimum, then shortens it with "..." rather than run off the line.
function fitText(value, field) {
  const maxWidth = toW(field.maxWidth);
  let text = pdfText(value);
  let size = field.size;
  while (size - 0.2 >= MIN_SIZE && poppinsTextWidth(text, size, field.bold) > maxWidth) size -= 0.2;
  size = Number(size.toFixed(1));
  if (poppinsTextWidth(text, size, field.bold) > maxWidth) {
    while (text.length > 1 && poppinsTextWidth(`${text}...`, size, field.bold) > maxWidth) text = text.slice(0, -1).trimEnd();
    text = `${text}...`;
  }
  return { text, size };
}

function fieldCommands(value, field) {
  if (!pdfText(value)) return [];
  const font = field.bold ? "P2" : "P1";
  const { text, size } = fitText(value, field);
  const commands = [];
  if (field.blank) {
    const { x, top, width, height } = field.blank;
    commands.push(`q 1 1 1 rg ${toX(x)} ${toY(top + height)} ${toW(width)} ${toH(height)} re f Q`);
  }
  commands.push(`BT /${font} ${size} Tf 0 g ${toX(field.x)} ${toY(field.baselineY)} Td (${text}) Tj ET`);
  return commands;
}

// The clean-up for the template's printed underscores comes first, so it is drawn before any text.
function pageCommands(row) {
  const fields = OUTWARD_FIELDS;
  const covers = [fields.clubName, fields.rid].map((field) => `q 1 1 1 rg ${toX(field.blank.x)} ${toY(field.blank.top + field.blank.height)} ${toW(field.blank.width)} ${toH(field.blank.height)} re f Q`);
  return [
    `q\n${PAGE.width} 0 0 ${PAGE.height} 0 0 cm\n/BG Do\nQ`,
    ...covers,
    ...fieldCommands(formatOutwardDate(row.date), fields.date),
    ...[fieldCommands(row.clubName, { ...fields.clubName, blank: null }), fieldCommands(row.rid, { ...fields.rid, blank: null })].flat(),
  ];
}

// One PDF with one page per row. Every page shares one copy of the template and the two fonts.
export function buildOutwardLettersPdf(rows, { template, fonts }) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("There are no letters to build.");
  if (!(template?.bytes instanceof Uint8Array) || !template.bytes.length) throw new TypeError("The letter template is required.");
  if (!(fonts?.regular instanceof Uint8Array) || !(fonts?.bold instanceof Uint8Array)) throw new TypeError("The Poppins fonts are required.");
  const objects = [];
  const regularId = 4;
  const boldId = 7;
  const pageStart = 10;
  const pageIds = rows.map((_, index) => pageStart + index * 2);
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${rows.length} >>`);
  objects[3] = imageObject({ bytes: template.bytes, width: template.width, height: template.height });
  poppinsFontObjects("regular", fonts.regular, regularId).forEach((object, offset) => { objects[regularId + offset] = object; });
  poppinsFontObjects("bold", fonts.bold, boldId).forEach((object, offset) => { objects[boldId + offset] = object; });
  rows.forEach((row, index) => {
    const pageId = pageIds[index];
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /P1 ${regularId} 0 R /P2 ${boldId} 0 R >> /XObject << /BG 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    objects[pageId + 1] = streamObject(ascii(pageCommands(row).join("\n")));
  });
  return assemblePdf(objects);
}

export async function loadOutwardAssets({ fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(OUTWARD_TEMPLATE_URL);
  if (!response?.ok) throw new Error("The letter template could not be loaded. Check your connection and try again.");
  const template = { bytes: new Uint8Array(await response.arrayBuffer()), ...OUTWARD_TEMPLATE_SIZE };
  const fonts = await loadResolutionPoppinsFonts(["regular", "bold"], fetchImpl);
  return { template, fonts: { regular: fonts.regular, bold: fonts.bold } };
}

// A ZIP with one PDF per club.
export async function buildOutwardLettersZip(rows, assets) {
  const { zipSync } = await import("fflate");
  const names = outwardPdfFilenames(rows);
  const files = {};
  rows.forEach((row, index) => { files[names[index]] = buildOutwardLettersPdf([row], assets); });
  return zipSync(files, { level: 0 });
}
