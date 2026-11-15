import { describe, expect, it } from "vitest";

import { requireStudentIdentity, signInClaims } from "../lib/server-auth";

describe("student session identity", () => {
  it("una sesion por enlace siempre queda como alumno", () => {
    expect(
      signInClaims("acceso", {
        email: "entrenador@example.com",
        alumnoId: "student-1",
        accessId: "access-1",
      }),
    ).toEqual({
      role: "student",
      email: null,
      alumnoId: "student-1",
      accessId: "access-1",
    });
  });

  it("identifica al alumno por id para una sesion por enlace", () => {
    expect(requireStudentIdentity({ alumnoId: "student-1", accessId: "access-1" })).toEqual({
      kind: "id",
      alumnoId: "student-1",
      accessId: "access-1",
    });
  });

  it("identifica al alumno por email para una sesion Google", () => {
    expect(requireStudentIdentity({ email: " Alumno@Example.com " })).toEqual({
      kind: "email",
      email: "alumno@example.com",
    });
  });
});
