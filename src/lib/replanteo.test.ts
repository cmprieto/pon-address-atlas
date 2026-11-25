import { describe, it, expect } from "vitest";
import { assignCtoIds, buildGroups, buildList, findConflicts, parsePages, ponKey, splitCalle, tomorrowDate, type PageResult } from "./replanteo";

const res: PageResult[] = [
  { page: 1, pon: "P1", poblacion: "X", fincas: [{ calle: "Calle Mayor", numero: "3" }, { calle: "Calle Mayor", numero: "3" }] },
  { page: 2, pon: "P2", poblacion: "X", fincas: [{ calle: "calle mayor", numero: "3" }, { calle: "Sol", numero: "1" }] },
];

describe("replanteo", () => {
  it("mantiene repetidas en el mismo plano", () => {
    expect(buildList([res[0]!], {}).length).toBe(2);
  });
  it("detecta repetidas entre PONs distintos", () => {
    expect(findConflicts(res).map((c) => c.pages)).toEqual([[1, 2]]);
  });
  it("excluye repetida de otro PON si no se confirma", () => {
    expect(buildList(res, {}).length).toBe(3);
  });
  it("incluye repetida de otro PON si se confirma", () => {
    expect(buildList(res, { "CALLE MAYOR|3": true }).length).toBe(4);
  });
  it("hace una lista por PON", () => {
    expect(buildGroups(res, {}).map((g) => g.pon)).toEqual(["P1", "P2"]);
  });
  it("une las hojas de un mismo PON en una lista pero pregunta por repetidas entre hojas", () => {
    const h: PageResult[] = [
      { page: 1, pon: "PON-7 Hoja 1 de 2", poblacion: "X", fincas: [{ calle: "Sol", numero: "1" }] },
      { page: 2, pon: "PON-7 hoja 2 de 2", poblacion: "X", fincas: [{ calle: "Sol", numero: "1" }] },
    ];
    expect(ponKey(h[0]!.pon)).toBe("PON-7");
    expect(findConflicts(h).length).toBe(1);
    const g = buildGroups(h, {});
    expect(g.length).toBe(1);
    expect(g[0]!.fincas.length).toBe(1);
    expect(buildGroups(h, { "SOL|1": true })[0]!.fincas.length).toBe(2);
  });
  it("interpreta rangos de páginas", () => {
    expect(parsePages("1-3, 5, 9", 6)).toEqual([1, 2, 3, 5]);
  });
  it("separa tipo de vía y nombre de vía", () => {
    expect(splitCalle("Calle Mayor")).toEqual({ tipoVia: "Calle", nombreVia: "Mayor" });
    expect(splitCalle("Avda. de España")).toEqual({ tipoVia: "Avda", nombreVia: "de España" });
    expect(splitCalle("Sol")).toEqual({ tipoVia: "", nombreVia: "Sol" });
  });
  it("asigna ID correlativo desde 1 a las CTO por PON sin duplicar entre hojas", () => {
    const pages: PageResult[] = [
      { page: 1, pon: "PON-1 Hoja 1 de 2", poblacion: "Getafe", fincas: [], ctos: ["CTO-10", "CTO-11"] },
      { page: 2, pon: "PON-1 Hoja 2 de 2", poblacion: "Getafe", fincas: [], ctos: ["cto-11", "CTO-12"] },
      { page: 3, pon: "PON-2", poblacion: "Getafe", fincas: [], ctos: ["CTO-20", "CTO-21"] },
    ];
    const groups = buildGroups(pages, {});
    expect(groups[0]!.ctos).toEqual([
      { id: 1, numero: "CTO-10" },
      { id: 2, numero: "CTO-11" },
      { id: 3, numero: "CTO-12" },
    ]);
    expect(groups[1]!.ctos).toEqual([
      { id: 1, numero: "CTO-20" },
      { id: 2, numero: "CTO-21" },
    ]);
    expect(assignCtoIds(["  001 ", "002", "001"])).toEqual([
      { id: 1, numero: "001" },
      { id: 2, numero: "002" },
    ]);
  });
  it("calcula siempre la fecha del día siguiente", () => {
    expect(tomorrowDate(new Date(2026, 10, 25))).toBe("26/11/2026");
    expect(tomorrowDate(new Date(2026, 11, 31))).toBe("01/01/2027");
  });
});
