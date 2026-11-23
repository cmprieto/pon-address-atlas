export type Finca = { calle: string; numero: string };
export type PageResult = { page: number; pon: string; poblacion: string; fincas: Finca[] };
export type Conflict = { key: string; calle: string; numero: string; pages: number[] };

export const fincaKey = (f: Finca) =>
  `${f.calle.trim().toUpperCase().replace(/\s+/g, " ")}|${f.numero.trim().toUpperCase()}`;

/** Fincas repetidas que aparecen en planos (páginas) diferentes. */
export function findConflicts(results: PageResult[]): Conflict[] {
  const map = new Map<string, Conflict>();
  for (const r of results) {
    for (const f of r.fincas) {
      const k = fincaKey(f);
      const c = map.get(k) ?? { key: k, calle: f.calle, numero: f.numero, pages: [] };
      if (!c.pages.includes(r.page)) c.pages.push(r.page);
      map.set(k, c);
    }
  }
  return [...map.values()].filter((c) => c.pages.length > 1);
}

/**
 * Lista final: repeticiones dentro del mismo plano se mantienen; si una finca ya
 * apareció en otro plano, solo se añade cuando decisions[key] === true.
 */
export function buildList(results: PageResult[], decisions: Record<string, boolean>): Finca[] {
  const seenPage = new Map<string, number>();
  const out: Finca[] = [];
  for (const r of [...results].sort((a, b) => a.page - b.page)) {
    for (const f of r.fincas) {
      const k = fincaKey(f);
      const first = seenPage.get(k);
      if (first === undefined) seenPage.set(k, r.page);
      if (first === undefined || first === r.page || decisions[k] === true) out.push(f);
    }
  }
  return out;
}

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

export function headerOf(results: PageResult[]) {
  const pons = [...new Set(results.map((r) => r.pon).filter(Boolean))];
  const pobs = [...new Set(results.map((r) => r.poblacion).filter(Boolean))];
  return { pon: pons.join(" / "), poblacion: pobs.join(" / ") };
}

export function toText(results: PageResult[], decisions: Record<string, boolean>) {
  const h = headerOf(results);
  const lines = buildList(results, decisions).map((f) => `${f.calle} ${f.numero}`);
  return [`PON: ${h.pon || "-"}`, `Población: ${h.poblacion || "-"}`, "", ...lines].join("\n");
}
