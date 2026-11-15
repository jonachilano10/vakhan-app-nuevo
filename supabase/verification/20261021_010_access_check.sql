-- Cada fila describe una condicion pendiente de la migracion 009; debe devolver 0 filas.
BEGIN;

CREATE TEMP TABLE migration_010_issues (
  issue TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  access_table REGCLASS := to_regclass('public.alumno_accesos');
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alumnos'
      AND column_name = 'email'
      AND is_nullable = 'YES'
  ) THEN
    INSERT INTO migration_010_issues(issue)
    VALUES ('public.alumnos.email todavia exige un valor');
  END IF;

  IF access_table IS NULL THEN
    INSERT INTO migration_010_issues(issue)
    VALUES ('Falta la tabla public.alumno_accesos');
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = access_table
        AND relrowsecurity = true
    ) THEN
      INSERT INTO migration_010_issues(issue)
      VALUES ('public.alumno_accesos no tiene RLS habilitado');
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_index
      WHERE indrelid = access_table
        AND indisunique = true
        AND pg_get_indexdef(indexrelid) ILIKE '%(alumno_id)%'
        AND pg_get_indexdef(indexrelid) ILIKE '%WHERE (revoked_at IS NULL)%'
    ) THEN
      INSERT INTO migration_010_issues(issue)
      VALUES ('Falta el indice unico parcial para un acceso vigente por alumno');
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cargas'
      AND column_name = 'updated_by'
  ) THEN
    INSERT INTO migration_010_issues(issue)
    VALUES ('Falta public.cargas.updated_by');
  END IF;
END
$$;

SELECT issue
FROM migration_010_issues
ORDER BY issue;

ROLLBACK;
