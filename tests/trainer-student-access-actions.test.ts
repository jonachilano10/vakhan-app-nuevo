import { describe, expect, it, vi } from "vitest";

import {
  createStudentAccess,
  getStudentAccessStatus,
  normalizeOptionalStudentEmail,
  revokeStudentAccess,
  type TrainerStudentAccessRepository,
} from "../lib/trainer-student-access-actions";

function repository(): TrainerStudentAccessRepository {
  return {
    revokeActive: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    findCurrent: vi.fn().mockResolvedValue(null),
  };
}

describe("trainer student access actions", () => {
  it("revoca el acceso anterior antes de crear uno nuevo", async () => {
    const repo = repository();
    const now = new Date("2026-10-21T12:00:00.000Z");
    const result = await createStudentAccess(repo, "student-1", "https://app.example.com", now);
    expect(repo.revokeActive).toHaveBeenCalledWith("student-1", now.toISOString());
    expect(repo.create).toHaveBeenCalledOnce();
    expect(vi.mocked(repo.revokeActive).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repo.create).mock.invocationCallOrder[0],
    );
    expect(result.url).toMatch(/^https:\/\/app\.example\.com\/acceso#[A-Za-z0-9_-]+$/);
  });

  it("anula el acceso vigente", async () => {
    const repo = repository();
    await expect(revokeStudentAccess(repo, "student-1")).resolves.toEqual({ ok: true });
    expect(repo.revokeActive).toHaveBeenCalledWith("student-1", expect.any(String));
  });

  it("el estado no expone token ni hash", async () => {
    const repo = repository();
    vi.mocked(repo.findCurrent).mockResolvedValue({
      id: "access-1",
      createdAt: "2026-10-21T12:00:00.000Z",
      expiresAt: "2027-01-19T12:00:00.000Z",
      lastUsedAt: null,
    });
    const status = await getStudentAccessStatus(
      repo,
      "student-1",
      new Date("2026-10-22T12:00:00.000Z"),
    );
    expect(status).toEqual({
      active: true,
      createdAt: "2026-10-21T12:00:00.000Z",
      expiresAt: "2027-01-19T12:00:00.000Z",
      lastUsedAt: null,
    });
    expect(JSON.stringify(status)).not.toMatch(/token|hash/i);
  });

  it("permite crear un alumno sin email", () => {
    expect(normalizeOptionalStudentEmail("")).toBeNull();
    expect(normalizeOptionalStudentEmail(undefined)).toBeNull();
  });
});
