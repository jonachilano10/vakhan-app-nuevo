import { createHash, randomBytes } from "node:crypto";

import { ApiError } from "./api-error";

export const STUDENT_ACCESS_DAYS = 90;
export const STUDENT_ACCESS_MAX_AGE_SECONDS = STUDENT_ACCESS_DAYS * 24 * 60 * 60;
export const ACCESS_EXPIRED_MESSAGE = "Tu acceso venció. Pedile un QR nuevo al profe.";

export interface StudentAccessRecord {
  id: string;
  alumnoId: string;
  expiresAt: string;
  revokedAt: string | null;
  studentActive: boolean;
}

export interface StudentAccessRepository {
  findByTokenHash(tokenHash: string): Promise<StudentAccessRecord | null>;
  updateLastUsed(accessId: string, usedAt: string): Promise<void>;
}

export interface StudentSessionAccessRepository {
  findById(accessId: string): Promise<StudentAccessRecord | null>;
}

export function generateAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function defaultAccessExpiry(createdAt = new Date()) {
  return new Date(createdAt.getTime() + STUDENT_ACCESS_MAX_AGE_SECONDS * 1000);
}

export async function verifyAccess(
  repository: StudentAccessRepository,
  token: string,
  now = new Date(),
) {
  if (!token) {
    throw new ApiError("El acceso no es válido o venció.", 401);
  }

  const access = await repository.findByTokenHash(hashAccessToken(token));
  const expired = access ? new Date(access.expiresAt).getTime() <= now.getTime() : false;

  if (!access || access.revokedAt || expired || !access.studentActive) {
    throw new ApiError("El acceso no es válido o venció.", 401);
  }

  await repository.updateLastUsed(access.id, now.toISOString());

  return {
    accessId: access.id,
    alumnoId: access.alumnoId,
  };
}

export async function verifySessionAccess(
  repository: StudentSessionAccessRepository,
  accessId: string,
  now = new Date(),
) {
  const access = accessId ? await repository.findById(accessId) : null;
  const expired = access ? new Date(access.expiresAt).getTime() <= now.getTime() : false;

  if (!access || access.revokedAt || expired || !access.studentActive) {
    throw new ApiError(ACCESS_EXPIRED_MESSAGE, 401);
  }

  return {
    accessId: access.id,
    alumnoId: access.alumnoId,
  };
}
