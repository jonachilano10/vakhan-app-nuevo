import { ApiError } from "./api-error";
import { isTrainerEmail, normalizeEmail } from "./auth-roles";

export type StudentIdentity =
  | { kind: "id"; alumnoId: string; accessId: string }
  | { kind: "email"; email: string };

interface AccessUserLike {
  email?: string | null;
  alumnoId?: string;
  accessId?: string;
}

export function requireAuthenticatedEmail(email: unknown) {
  if (typeof email !== "string" || !email.trim()) {
    throw new ApiError("Tu sesi\u00f3n venci\u00f3. Volv\u00e9 a iniciar sesi\u00f3n.", 401);
  }
  return normalizeEmail(email);
}

export function requireTrainerEmail(email: unknown, trainerEmails?: string) {
  const normalizedEmail = requireAuthenticatedEmail(email);
  if (!isTrainerEmail(normalizedEmail, trainerEmails)) {
    throw new ApiError("No ten\u00e9s permisos de entrenador.", 403);
  }
  return normalizedEmail;
}

export function requireStudentIdentity(token: {
  email?: unknown;
  alumnoId?: unknown;
  accessId?: unknown;
}): StudentIdentity {
  if (token.alumnoId !== undefined || token.accessId !== undefined) {
    if (
      typeof token.alumnoId !== "string" ||
      !token.alumnoId ||
      typeof token.accessId !== "string" ||
      !token.accessId
    ) {
      throw new ApiError("Tu sesión venció. Volvé a iniciar sesión.", 401);
    }
    return { kind: "id", alumnoId: token.alumnoId, accessId: token.accessId };
  }
  return { kind: "email", email: requireAuthenticatedEmail(token.email) };
}

export function signInClaims(provider: string | undefined, user: AccessUserLike) {
  if (provider === "acceso") {
    if (!user.alumnoId || !user.accessId) {
      throw new ApiError("El acceso no es válido o venció.", 401);
    }
    return {
      role: "student" as const,
      email: null,
      alumnoId: user.alumnoId,
      accessId: user.accessId,
    };
  }

  const email = requireAuthenticatedEmail(user.email);
  return {
    role: isTrainerEmail(email) ? ("trainer" as const) : ("student" as const),
    email,
    alumnoId: undefined,
    accessId: undefined,
  };
}
