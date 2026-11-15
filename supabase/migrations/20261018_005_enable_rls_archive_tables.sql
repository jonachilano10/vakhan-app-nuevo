-- Resultado esperado: completa sin modificar filas y habilita RLS solo en las tablas auxiliares existentes.
DO $$
DECLARE
  archive_table REGCLASS;
BEGIN
  archive_table := to_regclass('public.cargas_duplicates_archive');
  IF archive_table IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_class
       WHERE oid = archive_table
         AND relkind IN ('r', 'p')
     ) THEN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', archive_table);
  END IF;

  archive_table := to_regclass('public.ejercicios_duplicates_archive');
  IF archive_table IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_class
       WHERE oid = archive_table
         AND relkind IN ('r', 'p')
     ) THEN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', archive_table);
  END IF;

  archive_table := to_regclass('public.migration_backup_20261018');
  IF archive_table IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_class
       WHERE oid = archive_table
         AND relkind IN ('r', 'p')
     ) THEN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', archive_table);
  END IF;
END
$$;
