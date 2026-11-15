import { describe, expect, it } from "vitest";

import { activeMicrocycle, parseSeriesCount } from "../lib/training-progress";

const assignments = [{ id: "asignacion", dosis: { "1": "2x8", "2": "3x6" } }];

describe("microciclo activo", () => {
  it("extrae las series y limita valores extremos", () => {
    expect(parseSeriesCount("3x4-6 RIR3")).toBe(3);
    expect(parseSeriesCount("40\u00d71")).toBe(20);
    expect(parseSeriesCount("sin dosis")).toBe(0);
  });

  it("elige el primer microciclo incompleto", () => {
    const loads = [1, 2].map((serie) => ({
      ejercicio_bloque_id: "asignacion",
      mc: 1,
      serie,
    }));
    expect(activeMicrocycle({ total_mc: 2 }, assignments, loads)).toEqual({
      current: 2,
      complete: false,
    });
  });

  it("marca el programa completo cuando todas las series estan registradas", () => {
    const loads = [
      ...[1, 2].map((serie) => ({ ejercicio_bloque_id: "asignacion", mc: 1, serie })),
      ...[1, 2, 3].map((serie) => ({ ejercicio_bloque_id: "asignacion", mc: 2, serie })),
    ];
    expect(activeMicrocycle({ total_mc: 2 }, assignments, loads)).toEqual({
      current: 2,
      complete: true,
    });
  });

  it("no avanza por una serie autoguardada que todavia esta incompleta", () => {
    const loads = [
      { ejercicio_bloque_id: "asignacion", mc: 1, serie: 1, reps: 8, peso: 40 },
      { ejercicio_bloque_id: "asignacion", mc: 1, serie: 2, reps: 8, peso: null },
    ];

    expect(activeMicrocycle({ total_mc: 2 }, assignments, loads)).toEqual({
      current: 1,
      complete: false,
    });
  });
});
