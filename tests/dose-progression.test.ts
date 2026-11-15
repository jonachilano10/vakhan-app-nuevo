import { describe, expect, it } from "vitest";

import { buildDoseProgression } from "../lib/dose-progression";

describe("progresiones de dosis", () => {
  it("genera MC1 a MC5 con incremento de una repeticion", () => {
    expect(
      buildDoseProgression(5, {
        startMinReps: 4,
        startMaxReps: 6,
        increment: 1,
        effortScale: "RIR",
        effortValue: 3,
      }),
    ).toEqual({
      "1": "3x4-6 RIR3",
      "2": "3x5-7 RIR3",
      "3": "3x6-8 RIR3",
      "4": "4x6-8 RIR3",
      "5": "2x7-9 RIR3",
    });
  });

  it("admite incrementos mayores y escala RPE", () => {
    expect(
      buildDoseProgression(5, {
        startMinReps: 4,
        startMaxReps: 6,
        increment: 2,
        effortScale: "RPE",
        effortValue: 8,
      }),
    ).toEqual({
      "1": "3x4-6 RPE8",
      "2": "3x6-8 RPE8",
      "3": "3x8-10 RPE8",
      "4": "4x8-10 RPE8",
      "5": "2x10-12 RPE8",
    });
  });

  it("continua la progresion si la rutina tiene mas de cinco microciclos", () => {
    const result = buildDoseProgression(6, {
      startMinReps: 3,
      startMaxReps: 4,
      increment: 3,
      effortScale: "RIR",
      effortValue: 2,
    });

    expect(result["4"]).toBe("4x9-10 RIR2");
    expect(result["5"]).toBe("2x12-13 RIR2");
    expect(result["6"]).toBe("2x15-16 RIR2");
  });

  it("permite generar la progresion sin RIR ni RPE", () => {
    const result = buildDoseProgression(2, {
      startMinReps: 10,
      startMaxReps: 12,
      increment: 1,
      effortScale: "NONE",
      effortValue: 0,
    });

    expect(result).toEqual({ "1": "3x10-12", "2": "3x11-13" });
  });
});
