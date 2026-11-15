-- Resultado normal esperado: 0 filas de datos; reemplaza una sola FK y no toca cargas existentes.
-- Protege el historial de cargas ante borrados de ejercicios_bloque.
-- Esta migración no modifica ni elimina filas existentes.

BEGIN;

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name
    INTO fk_name
  FROM information_schema.key_column_usage
  WHERE table_schema = 'public'
    AND table_name = 'cargas'
    AND column_name = 'ejercicio_bloque_id'
    AND position_in_unique_constraint IS NOT NULL
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cargas DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.cargas
    ADD CONSTRAINT cargas_ejercicio_bloque_id_fkey
    FOREIGN KEY (ejercicio_bloque_id)
    REFERENCES public.ejercicios_bloque(id)
    ON DELETE RESTRICT;
END $$;

COMMIT;
