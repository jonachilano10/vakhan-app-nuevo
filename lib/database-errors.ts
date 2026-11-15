import { ApiError } from "./api-error";

export interface DatabaseErrorLike {
  code?: string;
  message?: string;
}

export function throwDatabaseError(
  error: DatabaseErrorLike | null,
  context: string,
  uniqueMessage = "Ya existe un registro con esos datos.",
) {
  if (!error) return;

  if (error.code === "23505") {
    throw new ApiError(uniqueMessage, 409);
  }

  throw new ApiError(`${context}: ${error.message || "error de base de datos"}`, 500);
}
