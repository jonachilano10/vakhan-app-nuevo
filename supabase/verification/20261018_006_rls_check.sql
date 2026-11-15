-- Cada fila indica una tabla de public que todavía tiene RLS deshabilitado; debe devolver 0 filas.
SELECT
  namespace_info.nspname AS esquema,
  table_info.relname AS tabla
FROM pg_class AS table_info
JOIN pg_namespace AS namespace_info
  ON namespace_info.oid = table_info.relnamespace
WHERE namespace_info.nspname = 'public'
  AND table_info.relkind IN ('r', 'p')
  AND table_info.relrowsecurity = false
ORDER BY table_info.relname;
