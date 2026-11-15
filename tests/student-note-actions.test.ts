import { describe, expect, it } from "vitest";

import {
  saveStudentNote,
  type StudentNoteRepository,
} from "../lib/student-note-actions";

const context = {
  studentId: "student-1",
  totalMicrocycles: 5,
  assignmentIds: ["assignment-1"],
};

function emptyRepository(overrides: Partial<StudentNoteRepository> = {}): StudentNoteRepository {
  return {
    async findNote() {
      return null;
    },
    async insertNote() {
      return { id: "note-1" };
    },
    async updateNote(noteId) {
      return { id: noteId };
    },
    async deleteNote() {},
    ...overrides,
  };
}

describe("notas del alumno", () => {
  it("rechaza un ejercicio ajeno a la rutina activa", async () => {
    await expect(
      saveStudentNote(emptyRepository(), context, {
        assignmentId: "assignment-otra",
        mc: 1,
        note: "Nota",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rechaza un microciclo fuera del rango de la rutina", async () => {
    await expect(
      saveStudentNote(emptyRepository(), context, {
        assignmentId: "assignment-1",
        mc: 6,
        note: "Nota",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("borra la nota cuando queda vacia", async () => {
    let deleted = "";
    const repository = emptyRepository({
      async findNote() {
        return { id: "note-existing" };
      },
      async deleteNote(noteId) {
        deleted = noteId;
      },
    });
    await expect(
      saveStudentNote(repository, context, {
        assignmentId: "assignment-1",
        mc: 2,
        note: "   ",
      }),
    ).resolves.toEqual({ id: null, note: "" });
    expect(deleted).toBe("note-existing");
  });

  it("reintenta como update ante una insercion concurrente", async () => {
    let searches = 0;
    let updated = "";
    const repository = emptyRepository({
      async findNote() {
        searches += 1;
        return searches === 1 ? null : { id: "note-concurrent" };
      },
      async insertNote() {
        throw { code: "23505" };
      },
      async updateNote(noteId, _studentId, note) {
        updated = note;
        return { id: noteId };
      },
    });
    await expect(
      saveStudentNote(repository, context, {
        assignmentId: "assignment-1",
        mc: 2,
        note: "  Me costo la ultima serie  ",
      }),
    ).resolves.toEqual({ id: "note-concurrent", note: "Me costo la ultima serie" });
    expect({ searches, updated }).toEqual({ searches: 2, updated: "Me costo la ultima serie" });
  });

  it("rechaza una nota de mas de 500 caracteres", async () => {
    await expect(
      saveStudentNote(emptyRepository(), context, {
        assignmentId: "assignment-1",
        mc: 1,
        note: "x".repeat(501),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
