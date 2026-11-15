import { describe, expect, it } from "vitest";

import { type StudentLoadRepository } from "../lib/student-load-actions";
import { saveTrainerLoad, type TrainerLoadContextRepository } from "../lib/trainer-load-actions";

const baseInput = {
  alumnoId: "student-1",
  assignmentId: "assignment-1",
  mc: 2,
  serie: 1,
  reps: 8,
  peso: 50,
  rir: 2,
};

function context(owner = "student-1", totalMicrocycles = 5): TrainerLoadContextRepository {
  return {
    async findAssignmentOwner() {
      return { alumnoId: owner, totalMicrocycles };
    },
  };
}

function memoryLoads() {
  const rows = new Map<string, { id: string; updatedBy: string | null }>();
  const repository: StudentLoadRepository = {
    async findLoad(studentId, input) {
      return rows.get(`${studentId}:${input.assignmentId}:${input.mc}:${input.serie}`) ?? null;
    },
    async updateLoad(id, studentId, input, audit) {
      rows.set(`${studentId}:${input.assignmentId}:${input.mc}:${input.serie}`, {
        id,
        updatedBy: audit.updatedBy,
      });
      return { id };
    },
    async insertLoad(studentId, input, audit) {
      const row = { id: "load-1", updatedBy: audit.updatedBy };
      rows.set(`${studentId}:${input.assignmentId}:${input.mc}:${input.serie}`, row);
      return row;
    },
  };
  return { repository, rows };
}

describe("trainer load actions", () => {
  it("rechaza un assignment de otro alumno", async () => {
    const loads = memoryLoads();
    await expect(
      saveTrainerLoad(context("student-2"), loads.repository, "trainer@example.com", baseInput),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rechaza un microciclo fuera de la rutina", async () => {
    const loads = memoryLoads();
    await expect(
      saveTrainerLoad(context("student-1", 3), loads.repository, "trainer@example.com", {
        ...baseInput,
        mc: 4,
      }),
    ).rejects.toThrow("microciclo");
  });

  it.each([
    { reps: -1 },
    { peso: 5001 },
    { rir: 11 },
    { serie: 21 },
  ])("rechaza rangos invalidos: %j", async (invalid) => {
    const loads = memoryLoads();
    await expect(
      saveTrainerLoad(context(), loads.repository, "trainer@example.com", {
        ...baseInput,
        ...invalid,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("hace upsert idempotente y marca al profesor", async () => {
    const loads = memoryLoads();
    await saveTrainerLoad(context(), loads.repository, "trainer@example.com", baseInput);
    await saveTrainerLoad(context(), loads.repository, "trainer@example.com", {
      ...baseInput,
      peso: 55,
    });
    expect(loads.rows.size).toBe(1);
    expect([...loads.rows.values()][0].updatedBy).toBe("trainer@example.com");
  });
});
