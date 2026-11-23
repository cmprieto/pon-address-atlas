export type Finca = { calle: string; numero: string };
export type PageResult = { page: number; pon: string; poblacion: string; fincas: Finca[] };
export type Conflict = { key: string; calle: string; numero: string; pages: number[]; pons: string[] };
export type PonGroup = { pon: string; poblacion: string; pages: number[]; fincas: Finca[] };

export const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");
export const fincaKey = (f: Finca) => `${norm(f.calle)}|${norm(f.numero)}`;
/** Clave de PON sin el "hoja X de Y". */
export const ponKey = (pon: string) =>
  norm(pon.replace(/\(?\s*hoja\s*\d+\s*(de|\/)\s*\d+\s*\)?/gi, "")).replace(/[\s\-_.]+$/, "") || "SIN PON";

/** Fincas que aparecen en páginas (hojas/planos) diferentes, aunque sean del mismo PON. */
export function findConflicts(results: PageResult[]): Conflict[] {
  const map = new Map<string, Conflict>();
  for (const r of results) {
    const p = ponKey(r.pon);
    for (const f of r.fincas) {
      const k = fincaKey(f);
      const c = map.get(k) ?? { key: k, calle: f.calle, numero: f.numero, pages: [], pons: [] };
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
  const groups = new Map<string, PonGroup>();
  for (const r of [...results].sort((a, b) => a.page - b.page)) {
    const p = ponKey(r.pon);
    const g = groups.get(p) ?? { pon: p, poblacion: "", pages: [], fincas: [] };
    g.pages.push(r.page);
    if (!g.poblacion && r.poblacion) g.poblacion = r.poblacion;
    for (const f of r.fincas) {
      const k = fincaKey(f);
      const first = firstPage.get(k);
      if (first === undefined) firstPage.set(k, r.page);
      if (first === undefined || first === r.page || decisions[k] === true) g.fincas.push(f);
    }
    groups.set(p, g);
  }
  return [...groups.values()];
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

export const groupText = (g: PonGroup) =>
  [`PON: ${g.pon}`, `Población: ${g.poblacion || "-"}`, "", ...g.fincas.map((f) => `${f.calle} ${f.numero}`)].join("\n");

export const toText = (results: PageResult[], decisions: Record<string, boolean>) =>
  buildGroups(results, decisions).map(groupText).join("\n\n");
