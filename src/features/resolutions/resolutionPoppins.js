import { POPPINS_METRICS } from "./resolutionPoppinsMetrics.js";

// Poppins for Resolution PDFs: embedded as a simple TrueType font with
// WinAnsi encoding, so text is written the same way as the built-in fonts.

export const POPPINS_FAMILY = "Poppins";

export const POPPINS_VARIANTS = Object.freeze({
  regular: Object.freeze({ resource: "P1", baseFont: "Poppins-Regular", file: "Poppins-Regular.ttf" }),
  bold: Object.freeze({ resource: "P2", baseFont: "Poppins-Bold", file: "Poppins-Bold.ttf" }),
  italic: Object.freeze({ resource: "P3", baseFont: "Poppins-Italic", file: "Poppins-Italic.ttf" }),
  boldItalic: Object.freeze({ resource: "P4", baseFont: "Poppins-BoldItalic", file: "Poppins-BoldItalic.ttf" }),
});

export const POPPINS_FONT_PATH = "/fonts/poppins/";

const WINANSI_HIGH = Object.freeze({
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
});

// WinAnsi byte for a character, or 0 when the encoding has no such character.
export function winAnsiCode(character) {
  const code = character.codePointAt(0);
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  return WINANSI_HIGH[code] || 0;
}

export function poppinsVariantKey(bold = false, italic = false) {
  if (bold && italic) return "boldItalic";
  if (bold) return "bold";
  return italic ? "italic" : "regular";
}

export function poppinsTextWidth(text, size, bold = false, italic = false) {
  const { widths } = POPPINS_METRICS[poppinsVariantKey(bold, italic)];
  let total = 0;
  for (const character of String(text)) {
    const code = winAnsiCode(character) || 0x3f;
    total += widths[code - 32] || widths[0x3f - 32];
  }
  return total * size / 1000;
}

// The Poppins styles a set of rendered pages actually uses.
export function poppinsVariantsUsed(pages) {
  const used = new Set();
  (Array.isArray(pages) ? pages : []).forEach((page) => {
    (Array.isArray(page) ? page : []).forEach((line) => {
      if (line?.kind !== "line" && line?.fontFamily === POPPINS_FAMILY && !line.mono) used.add(poppinsVariantKey(line.bold, line.italic));
    });
  });
  return Object.keys(POPPINS_VARIANTS).filter((key) => used.has(key));
}

export async function loadResolutionPoppinsFonts(variants, fetchImpl = globalThis.fetch) {
  const fonts = {};
  for (const key of variants) {
    const response = await fetchImpl(`${POPPINS_FONT_PATH}${POPPINS_VARIANTS[key].file}`);
    if (!response?.ok) throw new Error("The Poppins font could not be loaded for the Resolution PDF. Check your connection and try again.");
    fonts[key] = new Uint8Array(await response.arrayBuffer());
  }
  return fonts;
}
