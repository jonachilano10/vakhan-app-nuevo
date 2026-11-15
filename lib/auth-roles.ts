export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getTrainerEmails(source = process.env.TRAINER_EMAILS) {
  const configured = source
    ?.split(",")
    .map(normalizeEmail)
    .filter(Boolean);

  return configured ?? [];
}

export function isTrainerEmail(email: string | null | undefined, source?: string) {
  if (!email) return false;
  return getTrainerEmails(source).includes(normalizeEmail(email));
}
