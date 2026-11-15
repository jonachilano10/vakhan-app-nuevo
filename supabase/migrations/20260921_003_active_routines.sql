-- Resultado normal esperado: como maximo desactiva todas las rutinas salvo la mas reciente de cada alumno; al repetirla, no deberia modificar filas ni devolver errores.

BEGIN;

ALTER TABLE public.rutinas
  ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT TRUE;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY alumno_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS routine_number
  FROM public.rutinas
)
UPDATE public.rutinas AS r
SET activa = (ranked.routine_number = 1)
FROM ranked
WHERE r.id = ranked.id
  AND r.activa IS DISTINCT FROM (ranked.routine_number = 1);

CREATE UNIQUE INDEX IF NOT EXISTS rutinas_una_activa_por_alumno_key
  ON public.rutinas (alumno_id)
  WHERE activa;

COMMIT;
