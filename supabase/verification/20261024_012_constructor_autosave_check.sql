-- Si devuelve filas, bloques.titulo falta, admite NULL o contiene nombres vacíos.
SELECT
  block_info.id,
  block_info.titulo
FROM public.bloques AS block_info
WHERE block_info.titulo IS NULL OR btrim(block_info.titulo) = '';

-- Si devuelve filas, alguna columna de cargas todavía exige completar toda la serie antes de autoguardar.
SELECT
  column_info.column_name,
  column_info.is_nullable
FROM information_schema.columns AS column_info
WHERE column_info.table_schema = 'public'
  AND column_info.table_name = 'cargas'
  AND column_info.column_name IN ('reps', 'peso', 'rir')
  AND column_info.is_nullable <> 'YES';
