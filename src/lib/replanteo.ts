export type Finca = { tipoVia?: string; nombreVia?: string; calle: string; numero: string };
export type Cto = { id: number; numero: string };
export type PageResult = { page: number; pon: string; poblacion: string; fincas: Finca[]; ctos?: string[] };
export type Conflict = { key: string; calle: string; numero: string; pages: number[]; pons: string[] };
export type PonGroup = { pon: string; poblacion: string; pages: number[]; fincas: Finca[]; ctos: Cto[] };

export const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

const VIA_RE =
  /^(C\/|CALLE|CL\.?|AVDA\.?|AV\.?|AVENIDA|PLAZA|PL\.?|PZA\.?|PASEO|P\.?º|TRAVES[IÍ]A|TRV\.?|CAMINO|CMNO\.?|RONDA|CARRETERA|CTRA\.?|URBANIZACI[OÓ]N|URB\.?|GLORIETA|GTA\.?|PASAJE|PSJE\.?|CALLEJ[OÓ]N|BULEVAR|BLVR\.?|PARQUE|VIA|V[IÍ]A)\s+(.+)$/i;

export function splitCalle(calle: string): { tipoVia: string; nombreVia: string } {
  const clean = calle.trim().replace(/\s+/g, " ");
  const m = clean.match(VIA_RE);
  if (m && m[1] && m[2]) return { tipoVia: m[1].replace(/\.$/, ""), nombreVia: m[2] };
  return { tipoVia: "", nombreVia: clean };
}

export function normalizeFinca(f: { tipoVia?: string; nombreVia?: string; calle?: string; numero: string }): Finca {
  const numero = f.numero.trim();
  const rawTipo = (f.tipoVia ?? "").trim();
  const rawNombre = (f.nombreVia ?? "").trim();
  if (rawTipo || rawNombre) {
    const calle = [rawTipo, rawNombre].filter(Boolean).join(" ");
    return { tipoVia: rawTipo, nombreVia: rawNombre, calle, numero };
  }
  const rawCalle = (f.calle ?? "").trim();
  const { tipoVia, nombreVia } = splitCalle(rawCalle);
  return { tipoVia, nombreVia, calle: rawCalle, numero };
}

export const fincaKey = (f: Finca) => `${norm(f.calle || [f.tipoVia, f.nombreVia].filter(Boolean).join(" "))}|${norm(f.numero)}`;
/** Clave de PON sin el "hoja X de Y". */
export const ponKey = (pon: string) =>
  norm(pon.replace(/\(?\s*hoja\s*\d+\s*(de|\/)\s*\d+\s*\)?/gi, "")).replace(/[\s\-_.]+$/, "") || "SIN PON";

export function assignCtoIds(rawCtos: string[]): Cto[] {
  const seen = new Set<string>();
  const out: Cto[] = [];
  for (const raw of rawCtos) {
    const clean = raw.trim().replace(/\s+/g, " ");
    if (!clean) continue;
    const k = norm(clean);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: out.length + 1, numero: clean });
  }
  return out;
}

/** Fincas que aparecen en páginas (hojas/planos) diferentes, aunque sean del mismo PON. */
export function findConflicts(results: PageResult[]): Conflict[] {
  const map = new Map<string, Conflict>();
  for (const r of results) {
    const p = ponKey(r.pon);
    for (const f of r.fincas) {
      const nf = normalizeFinca(f);
      const k = fincaKey(nf);
      const c = map.get(k) ?? { key: k, calle: nf.calle, numero: nf.numero, pages: [], pons: [] };
      if (!c.pages.includes(r.page)) c.pages.push(r.page);
      if (!c.pons.includes(p)) c.pons.push(p);
      map.set(k, c);
    }
  }
  return [...map.values()].filter((c) => c.pages.length > 1);
}

/** Una lista por PON. Si una finca ya salió en otra página, solo se añade si decisions[key] === true. */
export function buildGroups(results: PageResult[], decisions: Record<string, boolean>): PonGroup[] {
  const firstPage = new Map<string, number>();
  const groups = new Map<string, { pon: string; poblacion: string; pages: number[]; fincas: Finca[]; rawCtos: string[] }>();
  for (const r of [...results].sort((a, b) => a.page - b.page)) {
    const p = ponKey(r.pon);
    const g = groups.get(p) ?? { pon: p, poblacion: "", pages: [], fincas: [], rawCtos: [] };
    g.pages.push(r.page);
    if (!g.poblacion && r.poblacion) g.poblacion = r.poblacion;
    for (const f of r.fincas) {
      const nf = normalizeFinca(f);
      const k = fincaKey(nf);
      const first = firstPage.get(k);
      if (first === undefined) firstPage.set(k, r.page);
      if (first === undefined || first === r.page || decisions[k] === true) g.fincas.push(nf);
    }
    if (r.ctos) g.rawCtos.push(...r.ctos);
    groups.set(p, g);
  }
  return [...groups.values()].map(({ rawCtos, ...rest }) => ({ ...rest, ctos: assignCtoIds(rawCtos) }));
}

export const buildList = (results: PageResult[], decisions: Record<string, boolean>) =>
  buildGroups(results, decisions).flatMap((g) => g.fincas);

export function parsePages(input: string, max: number): number[] {
  const set = new Set<number>();
  for (const part of input.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= max) set.add(i);
  }
  return [...set].sort((x, y) => x - y);
}

export const groupText = (g: PonGroup) => {
  const lines = [
    `PON: ${g.pon}`,
    `Población: ${g.poblacion || "-"}`,
    "",
    ...g.fincas.map((f) => `${f.calle || [f.tipoVia, f.nombreVia].filter(Boolean).join(" ")} ${f.numero}`.trim()),
  ];
  if (g.ctos.length > 0) {
    lines.push("", "CTO:", ...g.ctos.map((c) => `${c.id} - ${c.numero}`));
  }
  return lines.join("\n");
};

export const toText = (results: PageResult[], decisions: Record<string, boolean>) =>
  buildGroups(results, decisions).map(groupText).join("\n\n");

/** Devuelve la fecha del día siguiente en formato DD/MM/AAAA. */
export function tomorrowDate(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
