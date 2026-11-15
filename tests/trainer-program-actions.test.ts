import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/api-error";
import {
  type ProgramRemovalRepository,
  removeBlockWithHistoryProtection,
  removeExerciseWithHistoryProtection,
  saveTeacherNote,
} from "../lib/trainer-program-actions";

function repository(loadCount: number, assignmentIds = ["assignment-1"]) {
  return {
    assignmentIdsForBlock: vi.fn().mockResolvedValue(assignmentIds),
    countLoadsForAssignments: vi.fn().mockResolvedValue(loadCount),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    deleteAssignment: vi.fn().mockResolvedValue(undefined),
  } satisfies ProgramRemovalRepository;
}

describe("protección del historial de cargas", () => {
  it("rechaza con 409 eliminar un bloque con cargas", async () => {
    const repo = repository(2);

    await expect(removeBlockWithHistoryProtection(repo, "block-1")).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<ApiError>);
    expect(repo.deleteBlock).not.toHaveBeenCalled();
  });

  it("elimina un bloque sin cargas", async () => {
    const repo = repository(0);

    await removeBlockWithHistoryProtection(repo, "block-1");
    expect(repo.deleteBlock).toHaveBeenCalledWith("block-1");
  });

  it("rechaza con 409 quitar un ejercicio con cargas", async () => {
    const repo = repository(1);

    await expect(
      removeExerciseWithHistoryProtection(repo, "assignment-1"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<ApiError>);
    expect(repo.deleteAssignment).not.toHaveBeenCalled();
  });

  it("quita un ejercicio sin cargas", async () => {
    const repo = repository(0);

    await removeExerciseWithHistoryProtection(repo, "assignment-1");
    expect(repo.deleteAssignment).toHaveBeenCalledWith("assignment-1");
  });
});

describe("nota del profesor", () => {
  it("recorta y guarda una nota", async () => {
    const updateTeacherNote = vi.fn().mockResolvedValue(undefined);
    await expect(
      saveTeacherNote({ updateTeacherNote }, "assignment-1", "  Cuidar la tecnica  "),
    ).resolves.toBe("Cuidar la tecnica");
    expect(updateTeacherNote).toHaveBeenCalledWith("assignment-1", "Cuidar la tecnica");
  });

  it("convierte una nota vacia en null", async () => {
    const updateTeacherNote = vi.fn().mockResolvedValue(undefined);
    await saveTeacherNote({ updateTeacherNote }, "assignment-1", "   ");
    expect(updateTeacherNote).toHaveBeenCalledWith("assignment-1", null);
  });

  it("rechaza notas de mas de 500 caracteres", async () => {
    const updateTeacherNote = vi.fn().mockResolvedValue(undefined);
    await expect(
      saveTeacherNote({ updateTeacherNote }, "assignment-1", "x".repeat(501)),
    ).rejects.toMatchObject({ status: 400 });
    expect(updateTeacherNote).not.toHaveBeenCalled();
  });
});
