import { ApiError } from "./api-error";

export interface SaveStudentNoteInput {
  assignmentId: string;
  mc: number;
  note: string;
}

export interface SaveStudentNoteContext {
  studentId: string;
  totalMicrocycles: number;
  assignmentIds: string[];
}

export interface StudentNoteRepository {
  findNote(
    studentId: string,
    assignmentId: string,
    microcycle: number,
  ): Promise<{ id: string } | null>;
  insertNote(
    studentId: string,
    input: SaveStudentNoteInput & { note: string },
  ): Promise<{ id: string }>;
  updateNote(noteId: string, studentId: string, note: string): Promise<{ id: string }>;
  deleteNote(noteId: string, studentId: string): Promise<void>;
}

function isUniqueViolation(error: unknown): error is { code: "23505" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function saveStudentNote(
  repository: StudentNoteRepository,
  context: SaveStudentNoteContext,
  input: SaveStudentNoteInput,
) {
  if (!context.assignmentIds.includes(input.assignmentId)) {
    throw new ApiError("El ejercicio no pertenece a tu rutina activa.", 403);
  }
  if (input.mc < 1 || input.mc > context.totalMicrocycles) {
    throw new ApiError("El microciclo no es válido.");
  }

  const note = input.note.trim();
  if (note.length > 500) {
    throw new ApiError("La nota no puede superar los 500 caracteres.");
  }

  const existing = await repository.findNote(
    context.studentId,
    input.assignmentId,
    input.mc,
  );

  if (!note) {
    if (existing) await repository.deleteNote(existing.id, context.studentId);
    return { id: null, note: "" };
  }
  if (existing) {
    const updated = await repository.updateNote(existing.id, context.studentId, note);
    return { id: updated.id, note };
  }

  try {
    const inserted = await repository.insertNote(context.studentId, { ...input, note });
    return { id: inserted.id, note };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const concurrentlyInserted = await repository.findNote(
      context.studentId,
      input.assignmentId,
      input.mc,
    );
    if (!concurrentlyInserted) throw error;
    const updated = await repository.updateNote(
      concurrentlyInserted.id,
      context.studentId,
      note,
    );
    return { id: updated.id, note };
  }
}
