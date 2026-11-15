import { describe, expect, it, vi } from "vitest";

import { getTrainerStats, type TrainerStatsRepository } from "../lib/trainer-stats";

describe("estadisticas del entrenador", () => {
  it("usa el contador de programas activos", async () => {
    const repository: TrainerStatsRepository = {
      countStudents: vi.fn().mockResolvedValue(3),
      countActivePrograms: vi.fn().mockResolvedValue(2),
      countExercises: vi.fn().mockResolvedValue(919),
    };

    await expect(getTrainerStats(repository)).resolves.toEqual({
      totalStudents: 3,
      activePrograms: 2,
      totalExercises: 919,
    });
    expect(repository.countActivePrograms).toHaveBeenCalledOnce();
  });
});
