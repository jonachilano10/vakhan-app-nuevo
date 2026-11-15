import { describe, expect, it } from "vitest";

import { ApiError } from "../lib/api-error";
import { throwDatabaseError } from "../lib/database-errors";

describe("throwDatabaseError", () => {
  it("convierte una violacion de unicidad en conflicto HTTP 409", () => {
    try {
      throwDatabaseError(
        { code: "23505", message: "duplicate key" },
        "No se pudo guardar",
        "El registro ya existe.",
      );
      throw new Error("Se esperaba un ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, message: "El registro ya existe." });
    }
  });

  it("mantiene los demas errores de base de datos como HTTP 500", () => {
    expect(() =>
      throwDatabaseError({ code: "08006", message: "sin conexion" }, "No se pudo consultar"),
    ).toThrow("No se pudo consultar: sin conexion");
  });
});
