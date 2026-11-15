import { describe, expect, it } from "vitest";

import { getTrainerEmails, isTrainerEmail } from "../lib/auth-roles";
import { requireAuthenticatedEmail, requireTrainerEmail } from "../lib/server-auth";

describe("roles de autenticacion", () => {
  it("normaliza la lista configurada y reconoce al entrenador", () => {
    const source = " ENTRENADOR@Ejemplo.com,segundo@ejemplo.com ";
    expect(getTrainerEmails(source)).toEqual(["entrenador@ejemplo.com", "segundo@ejemplo.com"]);
    expect(isTrainerEmail("Entrenador@ejemplo.com", source)).toBe(true);
  });

  it("no concede permisos de entrenador cuando falta la configuracion", () => {
    expect(getTrainerEmails(undefined)).toEqual([]);
    expect(isTrainerEmail("trainer@example.com", undefined)).toBe(false);
  });

  it("rechaza una sesion sin correo", () => {
    expect(() => requireAuthenticatedEmail(undefined)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("rechaza a un usuario autenticado sin rol de entrenador", () => {
    expect(() => requireTrainerEmail("alumno@ejemplo.com", "coach@ejemplo.com")).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
