import { ApiError } from "./api-error";
import {
  saveStudentLoad,
  type SaveLoadInput,
  type StudentLoadRepository,
} from "./student-load-actions";

export interface TrainerLoadInput extends SaveLoadInput {
  alumnoId: string;
}

export interface AssignmentOwner {
  alumnoId: string;
  totalMicrocycles: number;
}

export interface TrainerLoadContextRepository {
  findAssignmentOwner(assignmentId: string): Promise<AssignmentOwner | null>;
}

export async function saveTrainerLoad(
  contextRepository: TrainerLoadContextRepository,
  loadRepository: StudentLoadRepository,
  trainerEmail: string,
  input: TrainerLoadInput,
) {
  const owner = await contextRepository.findAssignmentOwner(input.assignmentId);
  if (!owner || owner.alumnoId !== input.alumnoId) {
    throw new ApiError("El ejercicio no pertenece a una rutina de este alumno.", 403);
  }

  return saveStudentLoad(
    loadRepository,
    {
      studentId: input.alumnoId,
      totalMicrocycles: owner.totalMicrocycles,
      assignmentIds: [input.assignmentId],
    },
    input,
    { updatedBy: trainerEmail },
  );
}
