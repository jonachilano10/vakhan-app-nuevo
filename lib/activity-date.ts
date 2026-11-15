export function activityLabels(value: string | null, now = Date.now()) {
  if (!value) return { relative: "Sin actividad", absolute: "Todavía no registró cargas" };
  const date = new Date(value);
  const elapsed = date.getTime() - now;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const [unit, divisor] = units.find(([, milliseconds]) => Math.abs(elapsed) >= milliseconds) ?? [
    "minute" as const,
    60_000,
  ];
  return {
    relative: new Intl.RelativeTimeFormat("es", { numeric: "auto" }).format(
      Math.round(elapsed / divisor),
      unit,
    ),
    absolute: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date),
  };
}
