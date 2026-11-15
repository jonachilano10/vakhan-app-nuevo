-- Cada fila describe una condición pendiente de la migración 007; debe devolver 0 filas.
BEGIN;

CREATE TEMP TABLE migration_008_issues (
  issue TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  notes_table REGCLASS := to_regclass('public.notas_ejercicio');
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ejercicios_bloque'
      AND column_name = 'nota_profesor'
  ) THEN
    INSERT INTO migration_008_issues(issue)
    VALUES ('Falta public.ejercicios_bloque.nota_profesor');
  END IF;

  IF notes_table IS NULL THEN
    INSERT INTO migration_008_issues(issue)
    VALUES ('Falta la tabla public.notas_ejercicio');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = notes_table
      AND relrowsecurity = true
  ) THEN
    INSERT INTO migration_008_issues(issue)
    VALUES ('public.notas_ejercicio no tiene RLS habilitado');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cargas'
      AND column_name = 'updated_at'
  ) THEN
    INSERT INTO migration_008_issues(issue)
    VALUES ('Falta public.cargas.updated_at');
  ELSE
    EXECUTE $check_nulls$
      INSERT INTO migration_008_issues(issue)
      SELECT 'public.cargas.updated_at todavía contiene valores NULL'
      WHERE EXISTS (
        SELECT 1
        FROM public.cargas
        WHERE updated_at IS NULL
      )
    $check_nulls$;
  END IF;
END
$$;

SELECT issue
FROM migration_008_issues
ORDER BY issue;

ROLLBACK;
