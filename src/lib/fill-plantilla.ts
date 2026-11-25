import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { splitCalle, type Cto, type Finca } from "./replanteo";

export type PlantillaData = {
  proyecto: string;
  pon: string;
  fecha: string;
  tecnico: string;
  fincas: Finca[];
  ctos: Cto[];
};

const PAGE_H = 595.276;
const ROW_H = 20.693;
const FINCAS_PER_PAGE = 17;
const CTOS_PER_PAGE = 9;
const TEXT_COLOR = rgb(0.08, 0.1, 0.14);

/** Convierte a mayúsculas y deja solo caracteres compatibles con WinAnsi (incluye acentos y Ñ). */
export function toPdfUpper(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function drawFit(page: PDFPage, font: PDFFont, raw: string, x: number, topBaseline: number, maxWidth: number, maxSize = 8.5, center = false) {
  const text = toPdfUpper(raw);
  if (!text) return;
  let size = maxSize;
  while (size > 5.5 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out, size) > maxWidth) out = out.slice(0, -1);
  const w = font.widthOfTextAtSize(out, size);
  const drawX = center ? x + Math.max(0, (maxWidth - w) / 2) : x;
  page.drawText(out, { x: drawX, y: PAGE_H - topBaseline, size, font, color: TEXT_COLOR });
}

function drawPage1Header(page: PDFPage, font: PDFFont, data: PlantillaData) {
  drawFit(page, font, data.proyecto, 71, 118.2, 448, 8.5);
  drawFit(page, font, data.pon, 571, 118.2, 126, 8.5);
  drawFit(page, font, data.fecha, 733, 118.2, 77, 8.5);
  drawFit(page, font, data.tecnico, 67, 138.0, 452, 8.5);
}

function drawPage2Header(page: PDFPage, font: PDFFont, data: PlantillaData) {
  drawFit(page, font, data.proyecto, 71, 41.9, 448, 8.5);
  drawFit(page, font, data.pon, 571, 41.9, 126, 8.5);
  drawFit(page, font, data.fecha, 733, 41.9, 77, 8.5);
}

export async function fillPlantillaPdf(templateBytes: ArrayBuffer | Uint8Array, data: PlantillaData): Promise<Uint8Array> {
  const src = await PDFDocument.load(templateBytes);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);

  const fincaPagesCount = Math.max(1, Math.ceil(data.fincas.length / FINCAS_PER_PAGE));
  for (let p = 0; p < fincaPagesCount; p++) {
    const [page] = await out.copyPages(src, [0]);
    if (!page) continue;
    out.addPage(page);
    drawPage1Header(page, font, data);
    const slice = data.fincas.slice(p * FINCAS_PER_PAGE, (p + 1) * FINCAS_PER_PAGE);
    slice.forEach((f, i) => {
      const parsed = f.tipoVia || f.nombreVia ? { tipoVia: f.tipoVia ?? "", nombreVia: f.nombreVia ?? "" } : splitCalle(f.calle);
      const baseline = 190.43 + i * ROW_H + 13.5;
      drawFit(page, font, parsed.tipoVia, 30.5, baseline, 48, 8);
      drawFit(page, font, parsed.nombreVia, 84.5, baseline, 190, 8.5);
      drawFit(page, font, f.numero, 280.5, baseline, 34, 8.5, true);
    });
  }

  const ctoPagesCount = Math.max(1, Math.ceil(data.ctos.length / CTOS_PER_PAGE));
  for (let p = 0; p < ctoPagesCount; p++) {
    const [page] = await out.copyPages(src, [1]);
    if (!page) continue;
    out.addPage(page);
    drawPage2Header(page, font, data);
    const slice = data.ctos.slice(p * CTOS_PER_PAGE, (p + 1) * CTOS_PER_PAGE);
    slice.forEach((c, i) => {
      const baseline = 95.81 + i * ROW_H + 13.5;
      drawFit(page, font, String(c.id), 29.5, baseline, 21, 8.5, true);
      drawFit(page, font, c.numero, 56.5, baseline, 108, 8.5);
    });
  }

  return out.save();
}