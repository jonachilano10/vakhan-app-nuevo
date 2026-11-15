import { activeMicrocycle, parseSeriesCount } from "./training-progress";

export interface OverviewStudent {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
}

export interface OverviewRoutine {
  id: string;
  alumno_id: string;
  meso: number;
  total_mc: number;
  activa: boolean;
  created_at: string;
}

export interface OverviewAssignment {
  id: string;
  rutina_id: string;
  dosis: Record<string, unknown>;
}

export interface OverviewLoad {
  alumno_id: string;
  ejercicio_bloque_id: string;
  mc: number;
  serie: number;
  updated_at: string;
}

export interface OverviewNote {
  alumno_id: string;
  ejercicio_bloque_id: string;
  mc: number;
}

export interface StudentOverviewRepository {
  listActiveStudents(): Promise<OverviewStudent[]>;
  listRoutines(studentIds: string[]): Promise<OverviewRoutine[]>;
  listAssignments(routineIds: string[]): Promise<OverviewAssignment[]>;
  listLoads(assignmentIds: string[]): Promise<OverviewLoad[]>;
  listNotes(assignmentIds: string[]): Promise<OverviewNote[]>;
}

export interface StudentOverview {
  id: string;
  nombre: string;
  email: string | null;
  activeRoutine: {
    id: string;
    meso: number;
    total_mc: number;
  } | null;
  currentMicrocycle: number | null;
  progress: {
    completedSeries: number;
    expectedSeries: number;
    percentage: number;
  };
  lastActivity: string | null;
  noteCount: number;
}

function uniqueCompletedSeries(loads: OverviewLoad[], microcycle: number) {
  return new Set(
    loads
      .filter((load) => load.mc === microcycle)
      .map((load) => `${load.ejercicio_bloque_id}:${load.serie}`),
  ).size;
}

export async function getStudentOverviews(
  repository: StudentOverviewRepository,
): Promise<StudentOverview[]> {
  const students = await repository.listActiveStudents();
  const studentIds = students.map((student) => student.id);
  const routines = studentIds.length ? await repository.listRoutines(studentIds) : [];
  const activeRoutines = routines.filter((routine) => routine.activa);
  const assignments = activeRoutines.length
    ? await repository.listAssignments(activeRoutines.map((routine) => routine.id))
    : [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [loads, notes] = assignmentIds.length
    ? await Promise.all([
        repository.listLoads(assignmentIds),
        repository.listNotes(assignmentIds),
      ])
    : [[], []];

  return students.map((student) => {
    const routine = activeRoutines.find((item) => item.alumno_id === student.id) ?? null;
    if (!routine) {
      return {
        id: student.id,
        nombre: student.nombre,
        email: student.email,
        activeRoutine: null,
        currentMicrocycle: null,
        progress: { completedSeries: 0, expectedSeries: 0, percentage: 0 },
        lastActivity: null,
        noteCount: 0,
      };
    }

    const routineAssignments = assignments.filter(
      (assignment) => assignment.rutina_id === routine.id,
    );
    const routineAssignmentIds = new Set(routineAssignments.map((assignment) => assignment.id));
    const studentLoads = loads.filter(
      (load) =>
        load.alumno_id === student.id && routineAssignmentIds.has(load.ejercicio_bloque_id),
    );
    const microcycle = activeMicrocycle(routine, routineAssignments, studentLoads).current;
    const expectedSeries = routineAssignments.reduce(
      (total, assignment) =>
        total + parseSeriesCount(String(assignment.dosis[String(microcycle)] ?? "")),
      0,
    );
    const completedSeries = uniqueCompletedSeries(studentLoads, microcycle);
    const lastActivity = studentLoads.reduce<string | null>((latest, load) => {
      if (!latest || new Date(load.updated_at).getTime() > new Date(latest).getTime()) {
        return load.updated_at;
      }
      return latest;
    }, null);

    return {
      id: student.id,
      nombre: student.nombre,
      email: student.email,
      activeRoutine: { id: routine.id, meso: routine.meso, total_mc: routine.total_mc },
      currentMicrocycle: microcycle,
      progress: {
        completedSeries,
        expectedSeries,
        percentage:
          expectedSeries > 0
            ? Math.min(100, Math.round((completedSeries / expectedSeries) * 100))
            : 0,
      },
      lastActivity,
      noteCount: notes.filter(
        (note) =>
          note.alumno_id === student.id && routineAssignmentIds.has(note.ejercicio_bloque_id),
      ).length,
    };
  });
}
