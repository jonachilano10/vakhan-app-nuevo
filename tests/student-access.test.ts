import { describe, expect, it, vi } from "vitest";

import {
  defaultAccessExpiry,
  generateAccessToken,
  hashAccessToken,
  type StudentAccessRecord,
  type StudentAccessRepository,
  verifyAccess,
  verifySessionAccess,
} from "../lib/student-access";

const NOW = new Date("2026-10-21T12:00:00.000Z");

function access(overrides: Partial<StudentAccessRecord> = {}): StudentAccessRecord {
  return {
    id: "access-1",
    alumnoId: "student-1",
    expiresAt: "2027-01-19T12:00:00.000Z",
    revokedAt: null,
    studentActive: true,
    ...overrides,
  };
}

function repository(record: StudentAccessRecord | null): StudentAccessRepository {
  return {
    findByTokenHash: vi.fn().mockResolvedValue(record),
    updateLastUsed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("student access", () => {
  it("genera un token aleatorio y guarda solo un hash distinto", () => {
    const token = generateAccessToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hashAccessToken(token)).not.toBe(token);
    expect(hashAccessToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("usa un vencimiento predeterminado de 90 dias", () => {
    expect(defaultAccessExpiry(NOW).toISOString()).toBe("2027-01-19T12:00:00.000Z");
  });

  it("acepta un token valido y actualiza el ultimo uso", async () => {
    const repo = repository(access());
    await expect(verifyAccess(repo, "token-valido", NOW)).resolves.toEqual({
      accessId: "access-1",
      alumnoId: "student-1",
    });
    expect(repo.findByTokenHash).toHaveBeenCalledWith(hashAccessToken("token-valido"));
    expect(repo.updateLastUsed).toHaveBeenCalledWith("access-1", NOW.toISOString());
  });

  it.each([
    ["revocado", access({ revokedAt: "2026-10-20T12:00:00.000Z" })],
    ["vencido", access({ expiresAt: "2026-10-21T11:59:59.000Z" })],
    ["alumno inactivo", access({ studentActive: false })],
    ["inexistente", null],
  ])("rechaza un acceso %s", async (_label, record) => {
    const repo = repository(record);
    await expect(verifyAccess(repo, "token", NOW)).rejects.toMatchObject({ status: 401 });
    expect(repo.updateLastUsed).not.toHaveBeenCalled();
  });

  it.each([
    ["revocado", access({ revokedAt: "2026-10-20T12:00:00.000Z" })],
    ["vencido", access({ expiresAt: "2026-10-21T11:59:59.000Z" })],
  ])("corta inmediatamente una sesion con acceso %s", async (_label, record) => {
    const sessionRepository = { findById: vi.fn().mockResolvedValue(record) };
    await expect(verifySessionAccess(sessionRepository, "access-1", NOW)).rejects.toMatchObject({
      status: 401,
      message: "Tu acceso venció. Pedile un QR nuevo al profe.",
    });
  });
});
