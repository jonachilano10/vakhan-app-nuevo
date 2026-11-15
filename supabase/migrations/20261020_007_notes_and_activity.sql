-- Resultado esperado: agrega soporte de notas y actividad sin borrar datos; puede ejecutarse nuevamente sin duplicar objetos ni modificar filas ya completas.
BEGIN;

ALTER TABLE public.ejercicios_bloque
  ADD COLUMN IF NOT EXISTS nota_profesor TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ejercicios_bloque'::regclass
      AND conname = 'ejercicios_bloque_nota_profesor_length_check'
  ) THEN
    ALTER TABLE public.ejercicios_bloque
      ADD CONSTRAINT ejercicios_bloque_nota_profesor_length_check
      CHECK (nota_profesor IS NULL OR char_length(nota_profesor) <= 500);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.notas_ejercicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE RESTRICT,
  ejercicio_bloque_id UUID NOT NULL REFERENCES public.ejercicios_bloque(id) ON DELETE RESTRICT,
  mc INTEGER NOT NULL,
  nota TEXT NOT NULL CHECK (char_length(nota) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, ejercicio_bloque_id, mc)
);

CREATE INDEX IF NOT EXISTS idx_notas_ejercicio_assignment
  ON public.notas_ejercicio(ejercicio_bloque_id);

ALTER TABLE public.notas_ejercicio ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cargas
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.cargas
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.cargas
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

COMMIT;
