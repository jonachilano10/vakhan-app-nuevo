export interface HistoricalLoad {
  ejercicio_bloque_id: string;
  mc: number;
  serie: number;
}

export function previousLoadKey(assignmentId: string, series: number) {
  return `${assignmentId}:${series}`;
}

export function latestLoadsBefore<T extends HistoricalLoad>(loads: T[], microcycle: number) {
  const latest: Record<string, T> = {};

  for (const load of loads) {
    if (load.mc >= microcycle) continue;
    const key = previousLoadKey(load.ejercicio_bloque_id, load.serie);
    if (!latest[key] || latest[key].mc < load.mc) latest[key] = load;
  }

  return latest;
}
