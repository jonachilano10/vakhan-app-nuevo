import { describe, expect, it } from "vitest";

import { latestLoadsBefore, previousLoadKey } from "../lib/load-history";

describe("referencias de cargas anteriores", () => {
  it("elige el ultimo microciclo anterior disponible por serie", () => {
    const loads = [
      { ejercicio_bloque_id: "asignacion", mc: 1, serie: 1, peso: 40 },
      { ejercicio_bloque_id: "asignacion", mc: 3, serie: 1, peso: 45 },
      { ejercicio_bloque_id: "asignacion", mc: 2, serie: 2, peso: 42 },
      { ejercicio_bloque_id: "asignacion", mc: 4, serie: 1, peso: 50 },
    ];

    const result = latestLoadsBefore(loads, 4);

    expect(result[previousLoadKey("asignacion", 1)]?.peso).toBe(45);
    expect(result[previousLoadKey("asignacion", 2)]?.peso).toBe(42);
  });

  it("no devuelve referencias para el primer microciclo", () => {
    expect(
      latestLoadsBefore(
        [{ ejercicio_bloque_id: "asignacion", mc: 1, serie: 1 }],
        1,
      ),
    ).toEqual({});
  });
});
