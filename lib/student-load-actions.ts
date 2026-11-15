import { ApiError } from "./api-error";

export interface SaveLoadInput {
  assignmentId: string;
  mc: number;
  serie: number;
  reps: number | null;
  peso: number | null;
  rir: number | null;
}

export interface SaveLoadContext {
  studentId: string;
  totalMicrocycles: number;
  assignmentIds: string[];
}

export interface StudentLoadRepository {
  findLoad(studentId: string, input: SaveLoadInput): Promise<{ id: string } | null>;
  updateLoad(
    loadId: string,
    studentId: string,
    input: SaveLoadInput,
    audit: { updatedBy: string | null },
  ): Promise<{ id: string }>;
  insertLoad(
    studentId: string,
    input: SaveLoadInput,
    audit: { updatedBy: string | null },
  ): Promise<{ id: string }>;
}

function isUniqueViolation(error: unknown): error is { code: "23505" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function saveStudentLoad(
  repository: StudentLoadRepository,
  context: SaveLoadContext,
  input: SaveLoadInput,
  audit: { updatedBy: string | null } = { updatedBy: null },
) {
  if (!Number.isInteger(input.mc) || input.mc < 1 || input.mc > context.totalMicrocycles) {
    throw new ApiError("El microciclo no es v\u00e1lido.");
  }
  if (!Number.isInteger(input.serie) || input.serie < 1 || input.serie > 20) {
    throw new ApiError("La serie no es v\u00e1lida.");
  }
  const ranges = [
    [input.reps, 1000, "Las repeticiones"],
    [input.peso, 5000, "El peso"],
    [input.rir, 10, "El RIR"],
  ] as const;
  for (const [value, maximum, label] of ranges) {
    if (value === null) continue;
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      throw new ApiError(`${label} no tienen un valor v\u00e1lido.`);
    }
  }
  if (input.reps === null && input.peso === null && input.rir === null) {
    throw new ApiError("Ingresá al menos un valor para guardar la serie.");
  }
  if (!context.assignmentIds.includes(input.assignmentId)) {
    throw new ApiError("El ejercicio no pertenece a tu rutina.", 403);
  }

  const existing = await repository.findLoad(context.studentId, input);
  if (existing) {
    return repository.updateLoad(existing.id, context.studentId, input, audit);
  }

  try {
    return await repository.insertLoad(context.studentId, input, audit);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const concurrentlyInserted = await repository.findLoad(context.studentId, input);
    if (!concurrentlyInserted) throw error;

    return repository.updateLoad(concurrentlyInserted.id, context.studentId, input, audit);
  }
}
