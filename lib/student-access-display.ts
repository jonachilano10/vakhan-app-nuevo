export function whatsappAccessUrl(accessUrl: string) {
  return `https://wa.me/?text=${encodeURIComponent(`Tu acceso a Vakhán: ${accessUrl}`)}`;
}

export function accessDateLabel(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
