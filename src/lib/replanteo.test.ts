import { describe, it, expect } from "vitest";
import { buildList, findConflicts, parsePages, type PageResult } from "./replanteo";

const res: PageResult[] = [
  { page: 1, pon: "P1", poblacion: "X", fincas: [{ calle: "Calle Mayor", numero: "3" }, { calle: "Calle Mayor", numero: "3" }] },
  { page: 2, pon: "P1", poblacion: "X", fincas: [{ calle: "calle mayor", numero: "3" }, { calle: "Sol", numero: "1" }] },
];

describe("replanteo", () => {
  it("mantiene repetidas en el mismo plano", () => {
    expect(buildList([res[0]!], {}).length).toBe(2);
  });
  it("detecta repetidas entre planos", () => {
    expect(findConflicts(res).map((c) => c.pages)).toEqual([[1, 2]]);
  });
  it("excluye repetida de otro plano si no se confirma", () => {
    expect(buildList(res, {}).length).toBe(3);
  });
  it("incluye repetida de otro plano si se confirma", () => {
    expect(buildList(res, { "CALLE MAYOR|3": true }).length).toBe(4);
  });
  it("interpreta rangos de páginas", () => {
    expect(parsePages("1-3, 5, 9", 6)).toEqual([1, 2, 3, 5]);
  });
});
