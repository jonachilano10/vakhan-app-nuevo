import "server-only";

import { throwDatabaseError } from "./database-errors";
import type {
  StudentAccessRecord,
  StudentAccessRepository,
  StudentSessionAccessRepository,
} from "./student-access";
import { supabaseAdmin } from "./supabase-admin";

interface AccessRow {
  id: string;
  alumno_id: string;
  expires_at: string;
  revoked_at: string | null;
}

async function findAccess(field: "id" | "token_hash", value: string) {
  const { data, error } = await supabaseAdmin
    .from("alumno_accesos")
    .select("id,alumno_id,expires_at,revoked_at")
    .eq(field, value)
    .maybeSingle();
  throwDatabaseError(error, "No se pudo verificar el acceso");
  if (!data) return null;

  const access = data as AccessRow;
  const { data: student, error: studentError } = await supabaseAdmin
    .from("alumnos")
    .select("activo")
    .eq("id", access.alumno_id)
    .maybeSingle();
  throwDatabaseError(studentError, "No se pudo verificar el alumno");
  if (!student) return null;

  return {
    id: access.id,
    alumnoId: access.alumno_id,
    expiresAt: access.expires_at,
    revokedAt: access.revoked_at,
    studentActive: student.activo === true,
  } satisfies StudentAccessRecord;
}

export const studentAccessRepository: StudentAccessRepository & StudentSessionAccessRepository = {
  findByTokenHash(tokenHash) {
    return findAccess("token_hash", tokenHash);
  },
  findById(accessId) {
    return findAccess("id", accessId);
  },
  async updateLastUsed(accessId, usedAt) {
    const { error } = await supabaseAdmin
      .from("alumno_accesos")
      .update({ last_used_at: usedAt })
      .eq("id", accessId);
    throwDatabaseError(error, "No se pudo actualizar el acceso");
  },
};
