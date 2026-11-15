import { describe, expect, it } from "vitest";

import {
  saveStudentLoad,
  type SaveLoadInput,
  type StudentLoadRepository,
} from "../lib/student-load-actions";

const context = {
  studentId: "alumno-1",
  totalMicrocycles: 4,
  assignmentIds: ["asignacion-propia"],
};
const baseInput = {
  assignmentId: "asignacion-propia",
  mc: 1,
  serie: 1,
  reps: 8,
  peso: 50,
  rir: 2,
};

describe("guardado de cargas", () => {
  it("rechaza una asignacion que no pertenece al alumno", async () => {
    let consulted = false;
    const repository: StudentLoadRepository = {
      async findLoad() {
        consulted = true;
        return null;
      },
      async updateLoad() {
        throw new Error("No deberia actualizar");
      },
      async insertLoad() {
        throw new Error("No deberia insertar");
      },
    };

    await expect(
      saveStudentLoad(repository, context, { ...baseInput, assignmentId: "ajena" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(consulted).toBe(false);
  });

  it("inserta la primera vez y actualiza el mismo registro la segunda", async () => {
    const stored = new Map<string, { id: string }>();
    let inserts = 0;
    let updates = 0;
    const keyFor = (input: SaveLoadInput) => `${input.assignmentId}:${input.mc}:${input.serie}`;
    const repository: StudentLoadRepository = {
      async findLoad(_studentId, input) {
        return stored.get(keyFor(input)) ?? null;
      },
      async updateLoad(id) {
        updates += 1;
        return { id };
      },
      async insertLoad(_studentId, input) {
        inserts += 1;
        const row = { id: "carga-1" };
        stored.set(keyFor(input), row);
        return row;
      },
    };

    await saveStudentLoad(repository, context, baseInput);
    await saveStudentLoad(repository, context, { ...baseInput, peso: 52.5 });
    expect({ inserts, updates }).toEqual({ inserts: 1, updates: 1 });
  });

  it("permite autoguardar una carga parcial", async () => {
    let received: SaveLoadInput | undefined;
    const repository: StudentLoadRepository = {
      async findLoad() {
        return null;
      },
      async updateLoad() {
        throw new Error("No deberia actualizar");
      },
      async insertLoad(_studentId, input) {
        received = input;
        return { id: "carga-parcial" };
      },
    };

    await saveStudentLoad(repository, context, {
      ...baseInput,
      peso: null,
      rir: null,
    });
    expect(received).toMatchObject({ reps: 8, peso: null, rir: null });
  });

  it("rechaza una serie completamente vacia", async () => {
    const repository: StudentLoadRepository = {
      async findLoad() {
        throw new Error("No deberia consultar");
      },
      async updateLoad() {
        throw new Error("No deberia actualizar");
      },
      async insertLoad() {
        throw new Error("No deberia insertar");
      },
    };

    await expect(
      saveStudentLoad(repository, context, {
        ...baseInput,
        reps: null,
        peso: null,
        rir: null,
      }),
    ).rejects.toThrow("al menos un valor");
  });

  it("reintenta como update si otro guardado inserta la misma serie", async () => {
    let searches = 0;
    let inserts = 0;
    let updates = 0;
    const repository: StudentLoadRepository = {
      async findLoad() {
        searches += 1;
        return searches === 1 ? null : { id: "carga-concurrente" };
      },
      async updateLoad(id) {
        updates += 1;
        return { id };
      },
      async insertLoad() {
        inserts += 1;
        throw { code: "23505", message: "duplicate key" };
      },
    };

    await expect(saveStudentLoad(repository, context, baseInput)).resolves.toEqual({
      id: "carga-concurrente",
    });
    expect({ searches, inserts, updates }).toEqual({ searches: 2, inserts: 1, updates: 1 });
  });

  it("no reintenta errores que no son una violacion unica", async () => {
    let searches = 0;
    const failure = { code: "08006", message: "connection failure" };
    const repository: StudentLoadRepository = {
      async findLoad() {
        searches += 1;
        return null;
      },
      async updateLoad() {
        throw new Error("No deberia actualizar");
      },
      async insertLoad() {
        throw failure;
      },
    };

    await expect(saveStudentLoad(repository, context, baseInput)).rejects.toBe(failure);
    expect(searches).toBe(1);
  });

  it("limpia la marca del profesor cuando guarda el alumno", async () => {
    let updatedBy: string | null | undefined;
    const repository: StudentLoadRepository = {
      async findLoad() {
        return { id: "carga-1" };
      },
      async updateLoad(_id, _studentId, _input, audit) {
        updatedBy = audit.updatedBy;
        return { id: "carga-1" };
      },
      async insertLoad() {
        throw new Error("No deberia insertar");
      },
    };
    await saveStudentLoad(repository, context, baseInput);
    expect(updatedBy).toBeNull();
  });
});
