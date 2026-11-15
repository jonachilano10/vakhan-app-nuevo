-- Ejecutar antes de 20260921_002_unique_constraints.sql.
-- Es solo lectura: permite revisar exactamente las filas que resolvera la migracion.

SELECT
  alumno_id,
  ejercicio_bloque_id,
  mc,
  serie,
  COUNT(*) AS cantidad,
  ARRAY_AGG(id ORDER BY created_at, id) AS ids
FROM public.cargas
GROUP BY alumno_id, ejercicio_bloque_id, mc, serie
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

SELECT
  LOWER(BTRIM(categoria)) AS categoria_normalizada,
  LOWER(BTRIM(nombre)) AS nombre_normalizado,
  COUNT(*) AS cantidad,
  ARRAY_AGG(id ORDER BY created_at, id) AS ids,
  ARRAY_AGG(categoria || ' / ' || nombre ORDER BY created_at, id) AS variantes
FROM public.ejercicios
GROUP BY LOWER(BTRIM(categoria)), LOWER(BTRIM(nombre))
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;
