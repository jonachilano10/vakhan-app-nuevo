-- Debe devolver 0 filas. Si devuelve algo, todavia hay mas de una carga para la misma
-- combinacion de alumno, ejercicio asignado, microciclo y serie.
SELECT
  alumno_id,
  ejercicio_bloque_id,
  mc,
  serie,
  COUNT(*) AS cantidad
FROM public.cargas
GROUP BY alumno_id, ejercicio_bloque_id, mc, serie
HAVING COUNT(*) > 1;

-- Debe devolver 0 filas. Si devuelve algo, todavia hay ejercicios duplicados ignorando
-- mayusculas, minusculas y espacios exteriores.
SELECT
  LOWER(BTRIM(categoria)) AS categoria_normalizada,
  LOWER(BTRIM(nombre)) AS nombre_normalizado,
  COUNT(*) AS cantidad
FROM public.ejercicios
GROUP BY LOWER(BTRIM(categoria)), LOWER(BTRIM(nombre))
HAVING COUNT(*) > 1;

-- Debe devolver 0 filas. Si devuelve algo, ese alumno tiene rutinas pero no tiene
-- exactamente una rutina activa.
SELECT
  alumno_id,
  COUNT(*) FILTER (WHERE activa) AS rutinas_activas,
  COUNT(*) AS rutinas_totales
FROM public.rutinas
GROUP BY alumno_id
HAVING COUNT(*) FILTER (WHERE activa) <> 1;

-- Debe devolver 0 filas. Si devuelve una fila, falta la FK esperada o su accion de
-- borrado no es RESTRICT. La consulta identifica la relacion por tablas y columnas,
-- sin depender del nombre de la constraint.
SELECT
  'La FK cargas.ejercicio_bloque_id -> ejercicios_bloque.id no existe o no usa ON DELETE RESTRICT'
    AS problema
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_constraint AS constraint_info
  JOIN LATERAL UNNEST(constraint_info.conkey) WITH ORDINALITY
    AS source_key(attnum, position) ON TRUE
  JOIN pg_attribute AS source_column
    ON source_column.attrelid = constraint_info.conrelid
   AND source_column.attnum = source_key.attnum
  JOIN LATERAL UNNEST(constraint_info.confkey) WITH ORDINALITY
    AS target_key(attnum, position) ON target_key.position = source_key.position
  JOIN pg_attribute AS target_column
    ON target_column.attrelid = constraint_info.confrelid
   AND target_column.attnum = target_key.attnum
  WHERE constraint_info.contype = 'f'
    AND constraint_info.conrelid = 'public.cargas'::regclass
    AND constraint_info.confrelid = 'public.ejercicios_bloque'::regclass
    AND source_column.attname = 'ejercicio_bloque_id'
    AND target_column.attname = 'id'
    AND constraint_info.confdeltype = 'r'
);
