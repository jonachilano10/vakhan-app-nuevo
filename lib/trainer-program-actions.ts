import { ApiError } from "./api-error";

export interface ProgramRemovalRepository {
  assignmentIdsForBlock(blockId: string): Promise<string[]>;
  countLoadsForAssignments(assignmentIds: string[]): Promise<number>;
  deleteBlock(blockId: string): Promise<void>;
  deleteAssignment(assignmentId: string): Promise<void>;
}

export interface TeacherNoteRepository {
  updateTeacherNote(assignmentId: string, note: string | null): Promise<void>;
}

const HISTORY_MESSAGE =
  "Este elemento tiene cargas registradas de un alumno. Para modificarlo sin perder el historial, conservá el bloque y ajustá la rutina en un bloque nuevo.";

export async function removeBlockWithHistoryProtection(
  repository: ProgramRemovalRepository,
  blockId: string,
) {
  const assignmentIds = await repository.assignmentIdsForBlock(blockId);
  const loadCount = assignmentIds.length
    ? await repository.countLoadsForAssignments(assignmentIds)
    : 0;

  if (loadCount > 0) throw new ApiError(HISTORY_MESSAGE, 409);
  await repository.deleteBlock(blockId);
}

export async function removeExerciseWithHistoryProtection(
  repository: ProgramRemovalRepository,
  assignmentId: string,
) {
  const loadCount = await repository.countLoadsForAssignments([assignmentId]);
  if (loadCount > 0) throw new ApiError(HISTORY_MESSAGE, 409);
  await repository.deleteAssignment(assignmentId);
}

export async function saveTeacherNote(
  repository: TeacherNoteRepository,
  assignmentId: string,
  rawNote: string,
) {
  const note = rawNote.trim();
  if (note.length > 500) {
    throw new ApiError("La nota para el alumno no puede superar los 500 caracteres.");
  }
  await repository.updateTeacherNote(assignmentId, note || null);
  return note || null;
}
