import { ApiError } from "./api-error";
import { defaultAccessExpiry, generateAccessToken, hashAccessToken } from "./student-access";

export interface TrainerAccessStatusRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export interface TrainerStudentAccessRepository {
  revokeActive(alumnoId: string, revokedAt: string): Promise<void>;
  create(input: {
    alumnoId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<void>;
  findCurrent(alumnoId: string): Promise<TrainerAccessStatusRow | null>;
}

export function normalizeOptionalStudentEmail(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError("El email no es válido.");
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError("El email no es válido.");
  }
  return email;
}

export async function createStudentAccess(
  repository: TrainerStudentAccessRepository,
  alumnoId: string,
  origin: string,
  now = new Date(),
) {
  const token = generateAccessToken();
  const createdAt = now.toISOString();
  const expiresAt = defaultAccessExpiry(now).toISOString();

  await repository.revokeActive(alumnoId, createdAt);
  await repository.create({
    alumnoId,
    tokenHash: hashAccessToken(token),
    createdAt,
    expiresAt,
  });

  return {
    url: `${origin.replace(/\/$/, "")}/acceso#${token}`,
    expiresAt,
  };
}

export async function revokeStudentAccess(
  repository: TrainerStudentAccessRepository,
  alumnoId: string,
  now = new Date(),
) {
  await repository.revokeActive(alumnoId, now.toISOString());
  return { ok: true };
}

export async function getStudentAccessStatus(
  repository: TrainerStudentAccessRepository,
  alumnoId: string,
  now = new Date(),
) {
  const access = await repository.findCurrent(alumnoId);
  if (!access) {
    return { active: false, createdAt: null, expiresAt: null, lastUsedAt: null };
  }
  return {
    active: new Date(access.expiresAt).getTime() > now.getTime(),
    createdAt: access.createdAt,
    expiresAt: access.expiresAt,
    lastUsedAt: access.lastUsedAt,
  };
}
