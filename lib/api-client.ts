async function requestAction<T>(
  endpoint: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(result?.error || "No se pudo completar la operación.");
  }

  return result?.data as T;
}

export function apiAction<T>(
  action: string,
  payload: Record<string, unknown> = {},
) {
  return requestAction<T>("/api/trainer-data", action, payload);
}

export function studentAction<T>(
  action: string,
  payload: Record<string, unknown> = {},
) {
  return requestAction<T>("/api/student-data", action, payload);
}
