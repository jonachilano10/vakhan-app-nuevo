export interface MicrocycleRoutine {
  total_mc: number;
}

export interface MicrocycleAssignment {
  id: string;
  dosis: Record<string, unknown>;
}

export interface MicrocycleLoad {
  ejercicio_bloque_id: string;
  mc: number;
  serie: number;
  reps?: number | null;
  peso?: number | null;
}

export function parseSeriesCount(dose: string) {
  const match = dose.trim().match(/^(\d+)\s*[x\u00d7]/i);
  if (!match) return 0;
  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? Math.min(count, 20) : 0;
}

export function activeMicrocycle(
  routine: MicrocycleRoutine,
  assignments: MicrocycleAssignment[],
  loads: MicrocycleLoad[],
) {
  const expectedByMc = new Map<number, number>();
  for (let mc = 1; mc <= routine.total_mc; mc += 1) {
    expectedByMc.set(
      mc,
      assignments.reduce(
        (total, assignment) =>
          total + parseSeriesCount(String(assignment.dosis?.[String(mc)] ?? "")),
        0,
      ),
    );
  }

  const completedByMc = new Map<number, Set<string>>();
  for (const load of loads) {
    if (load.reps === null || load.peso === null) continue;
    const completed = completedByMc.get(load.mc) ?? new Set<string>();
    completed.add(`${load.ejercicio_bloque_id}:${load.serie}`);
    completedByMc.set(load.mc, completed);
  }

  const firstIncomplete = Array.from(
    { length: routine.total_mc },
    (_, index) => index + 1,
  ).find((mc) => {
    const expected = expectedByMc.get(mc) ?? 0;
    return expected === 0 || (completedByMc.get(mc)?.size ?? 0) < expected;
  });

  return {
    current: firstIncomplete ?? routine.total_mc,
    complete: firstIncomplete === undefined && routine.total_mc > 0,
  };
}
