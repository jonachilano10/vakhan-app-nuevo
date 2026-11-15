import { describe, expect, it } from "vitest";

import {
  createActiveRoutineWithRollback,
  type RoutineActivationRepository,
} from "../lib/routine-activation";

type Routine = { id: string; activa: boolean };

function repositoryWith(events: string[], failStructure = false) {
  const repository: RoutineActivationRepository<Routine> = {
    async findActiveRoutineIds() {
      return ["anterior"];
    },
    async setRoutinesActive(ids, active) {
      events.push(`activar:${ids.join(",")}:${active}`);
    },
    async insertActiveRoutine() {
      events.push("insertar:nueva");
      return { id: "nueva", activa: true };
    },
    async createInitialStructure() {
      events.push("crear:estructura");
      if (failStructure) throw new Error("fallo estructura");
    },
    async deleteRoutine(id) {
      events.push(`eliminar:${id}`);
    },
  };
  return repository;
}

const input = { alumnoId: "alumno", meso: 2, totalMc: 4, diasSemana: 3 };

describe("activacion de rutinas", () => {
  it("desactiva la rutina anterior antes de crear la nueva activa", async () => {
    const events: string[] = [];
    await createActiveRoutineWithRollback(repositoryWith(events), input);
    expect(events).toEqual([
      "activar:anterior:false",
      "insertar:nueva",
      "crear:estructura",
    ]);
  });

  it("elimina la rutina incompleta y restaura la anterior si algo falla", async () => {
    const events: string[] = [];
    await expect(
      createActiveRoutineWithRollback(repositoryWith(events, true), input),
    ).rejects.toThrow("fallo estructura");
    expect(events).toEqual([
      "activar:anterior:false",
      "insertar:nueva",
      "crear:estructura",
      "eliminar:nueva",
      "activar:anterior:true",
    ]);
  });
});
