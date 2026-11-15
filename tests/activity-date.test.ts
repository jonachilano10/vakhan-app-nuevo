import { describe, expect, it } from "vitest";

import { activityLabels } from "../lib/activity-date";

describe("fecha de ultima actividad", () => {
  it("muestra un estado vacio cuando no hay cargas", () => {
    expect(activityLabels(null)).toEqual({
      relative: "Sin actividad",
      absolute: "Todavía no registró cargas",
    });
  });

  it("muestra tiempo relativo y fecha absoluta", () => {
    const labels = activityLabels(
      "2026-10-20T10:00:00.000Z",
      new Date("2026-10-20T12:00:00.000Z").getTime(),
    );
    expect(labels.relative).toContain("2");
    expect(labels.absolute).toContain("20");
  });
});
