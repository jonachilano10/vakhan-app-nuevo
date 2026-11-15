export interface ActiveRoutineInput {
  alumnoId: string;
  meso: number;
  totalMc: number;
  diasSemana: number;
}

export interface ActiveRoutine {
  id: string;
  [key: string]: unknown;
}

export interface RoutineActivationRepository<TRoutine extends ActiveRoutine> {
  findActiveRoutineIds(alumnoId: string): Promise<string[]>;
  setRoutinesActive(routineIds: string[], active: boolean): Promise<void>;
  insertActiveRoutine(input: ActiveRoutineInput): Promise<TRoutine>;
  createInitialStructure(routineId: string, daysPerWeek: number): Promise<void>;
  deleteRoutine(routineId: string): Promise<void>;
}

export async function createActiveRoutineWithRollback<TRoutine extends ActiveRoutine>(
  repository: RoutineActivationRepository<TRoutine>,
  input: ActiveRoutineInput,
) {
  const previousActiveIds = await repository.findActiveRoutineIds(input.alumnoId);
  let routine: TRoutine | null = null;

  try {
    if (previousActiveIds.length) {
      await repository.setRoutinesActive(previousActiveIds, false);
    }
    routine = await repository.insertActiveRoutine(input);
    await repository.createInitialStructure(routine.id, input.diasSemana);
    return routine;
  } catch (error) {
    if (routine) {
      await repository.deleteRoutine(routine.id).catch(() => undefined);
    }
    if (previousActiveIds.length) {
      await repository.setRoutinesActive(previousActiveIds, true).catch(() => undefined);
    }
    throw error;
  }
}
