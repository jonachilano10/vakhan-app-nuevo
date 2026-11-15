-- Resultado esperado: completa los nombres de bloques existentes y permite autoguardar cargas parciales sin eliminar datos.
ALTER TABLE public.bloques
  ADD COLUMN IF NOT EXISTS titulo TEXT;

UPDATE public.bloques
SET titulo = CASE
  WHEN numero = 1 THEN 'Entrada en calor'
  ELSE 'Bloque ' || numero::text
END
WHERE titulo IS NULL OR btrim(titulo) = '';

ALTER TABLE public.bloques
  ALTER COLUMN titulo SET NOT NULL;

ALTER TABLE public.cargas
  ALTER COLUMN reps DROP NOT NULL,
  ALTER COLUMN peso DROP NOT NULL,
  ALTER COLUMN rir DROP NOT NULL;
