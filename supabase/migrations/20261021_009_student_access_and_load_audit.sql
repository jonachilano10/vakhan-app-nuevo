-- Resultado esperado: habilita accesos personales y auditoria de cargas sin borrar datos; no devuelve filas.
BEGIN;

ALTER TABLE public.alumnos
  ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.alumno_accesos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS alumno_accesos_uno_vigente_por_alumno_key
  ON public.alumno_accesos(alumno_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.alumno_accesos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cargas
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

COMMIT;
