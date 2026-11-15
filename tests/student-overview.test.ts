import { describe, expect, it } from "vitest";

import {
  getStudentOverviews,
  type OverviewAssignment,
  type OverviewLoad,
  type OverviewNote,
  type OverviewRoutine,
  type OverviewStudent,
  type StudentOverviewRepository,
} from "../lib/student-overview";

function repository(input: {
  students?: OverviewStudent[];
  routines?: OverviewRoutine[];
  assignments?: OverviewAssignment[];
  loads?: OverviewLoad[];
  notes?: OverviewNote[];
}): StudentOverviewRepository {
  return {
    async listActiveStudents() {
      return input.students ?? [];
    },
    async listRoutines() {
      return input.routines ?? [];
    },
    async listAssignments() {
      return input.assignments ?? [];
    },
    async listLoads() {
      return input.loads ?? [];
    },
    async listNotes() {
      return input.notes ?? [];
    },
  };
}

const student: OverviewStudent = {
  id: "student-1",
  nombre: "Ana",
  email: "ana@example.com",
  activo: true,
};

const routine: OverviewRoutine = {
  id: "routine-1",
  alumno_id: student.id,
  meso: 2,
  total_mc: 3,
  activa: true,
  created_at: "2026-10-01T00:00:00.000Z",
};

const assignments: OverviewAssignment[] = [
  { id: "a-1", rutina_id: routine.id, dosis: { "1": "2x5", "2": "3x5", "3": "3x6" } },
  { id: "a-2", rutina_id: routine.id, dosis: { "1": "1x8", "2": "1x9", "3": "1x10" } },
];

describe("resumen de actividad de alumnos", () => {
  it("calcula el avance y la ultima actividad del microciclo actual", async () => {
    const loads: OverviewLoad[] = [
      { alumno_id: student.id, ejercicio_bloque_id: "a-1", mc: 1, serie: 1, updated_at: "2026-10-10T10:00:00Z" },
      { alumno_id: student.id, ejercicio_bloque_id: "a-1", mc: 1, serie: 2, updated_at: "2026-10-10T10:05:00Z" },
      { alumno_id: student.id, ejercicio_bloque_id: "a-2", mc: 1, serie: 1, updated_at: "2026-10-10T10:10:00Z" },
      { alumno_id: student.id, ejercicio_bloque_id: "a-1", mc: 2, serie: 1, updated_at: "2026-10-12T12:00:00Z" },
      { alumno_id: student.id, ejercicio_bloque_id: "a-1", mc: 2, serie: 1, updated_at: "2026-10-12T12:00:00Z" },
    ];
    const [result] = await getStudentOverviews(
      repository({
        students: [student],
        routines: [routine],
        assignments,
        loads,
        notes: [{ alumno_id: student.id, ejercicio_bloque_id: "a-1", mc: 2 }],
      }),
    );

    expect(result.currentMicrocycle).toBe(2);
    expect(result.progress).toEqual({ completedSeries: 1, expectedSeries: 4, percentage: 25 });
    expect(result.lastActivity).toBe("2026-10-12T12:00:00Z");
    expect(result.noteCount).toBe(1);
  });

  it("devuelve el primer microciclo para una rutina sin cargas", async () => {
    const [result] = await getStudentOverviews(
      repository({ students: [student], routines: [routine], assignments }),
    );
    expect(result.currentMicrocycle).toBe(1);
    expect(result.progress).toEqual({ completedSeries: 0, expectedSeries: 3, percentage: 0 });
    expect(result.lastActivity).toBeNull();
  });

  it("mantiene al alumno activo aunque no tenga rutina", async () => {
    const [result] = await getStudentOverviews(repository({ students: [student] }));
    expect(result.activeRoutine).toBeNull();
    expect(result.currentMicrocycle).toBeNull();
  });

  it("ignora rutinas inactivas", async () => {
    const [result] = await getStudentOverviews(
      repository({ students: [student], routines: [{ ...routine, activa: false }] }),
    );
    expect(result.activeRoutine).toBeNull();
  });
});
