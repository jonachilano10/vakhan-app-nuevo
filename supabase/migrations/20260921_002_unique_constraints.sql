-- Resultado normal esperado: termina sin error; archiva y resuelve los duplicados informados por 20260921_002_find_duplicates.sql antes de crear los dos indices unicos.

BEGIN;

-- Conservamos una copia auditable de cada duplicado antes de resolverlo.
CREATE TABLE IF NOT EXISTS public.cargas_duplicates_archive
(LIKE public.cargas INCLUDING ALL);
ALTER TABLE public.cargas_duplicates_archive
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY alumno_id, ejercicio_bloque_id, mc, serie
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_number
  FROM public.cargas
)
INSERT INTO public.cargas_duplicates_archive
SELECT c.*, NOW()
FROM public.cargas AS c
JOIN ranked AS r ON r.id = c.id
WHERE r.duplicate_number > 1
ON CONFLICT (id) DO NOTHING;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY alumno_id, ejercicio_bloque_id, mc, serie
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_number
  FROM public.cargas
)
DELETE FROM public.cargas AS c
USING ranked AS r
WHERE c.id = r.id
  AND r.duplicate_number > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cargas_alumno_assignment_mc_serie_key'
      AND conrelid = 'public.cargas'::regclass
  ) THEN
    ALTER TABLE public.cargas
      ADD CONSTRAINT cargas_alumno_assignment_mc_serie_key
      UNIQUE (alumno_id, ejercicio_bloque_id, mc, serie);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ejercicios_duplicates_archive
(LIKE public.ejercicios INCLUDING ALL);
ALTER TABLE public.ejercicios_duplicates_archive
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.ejercicios
SET
  nombre = BTRIM(nombre),
  categoria = BTRIM(categoria)
WHERE nombre IS DISTINCT FROM BTRIM(nombre)
   OR categoria IS DISTINCT FROM BTRIM(categoria);

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY LOWER(categoria), LOWER(nombre)
      ORDER BY created_at NULLS LAST, id
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(categoria), LOWER(nombre)
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_number
  FROM public.ejercicios
)
UPDATE public.ejercicios_bloque AS eb
SET ejercicio_id = r.canonical_id
FROM ranked AS r
WHERE eb.ejercicio_id = r.id
  AND r.duplicate_number > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(categoria), LOWER(nombre)
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_number
  FROM public.ejercicios
)
INSERT INTO public.ejercicios_duplicates_archive
SELECT e.*, NOW()
FROM public.ejercicios AS e
JOIN ranked AS r ON r.id = e.id
WHERE r.duplicate_number > 1
ON CONFLICT (id) DO NOTHING;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(categoria), LOWER(nombre)
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_number
  FROM public.ejercicios
)
DELETE FROM public.ejercicios AS e
USING ranked AS r
WHERE e.id = r.id
  AND r.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ejercicios_categoria_nombre_ci_key
  ON public.ejercicios (LOWER(categoria), LOWER(nombre));

COMMIT;
