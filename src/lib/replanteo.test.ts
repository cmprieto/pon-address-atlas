import { describe, it, expect } from "vitest";
import { buildGroups, buildList, findConflicts, parsePages, ponKey, type PageResult } from "./replanteo";

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
});
