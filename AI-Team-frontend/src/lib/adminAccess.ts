export const ADMIN_EMAILS = [
  "digitalcoachai@gmail.com",
  "luca.papa.digital@gmail.com",
  "natali@digital-coach.com",
  "giuseppe@digital-coach.com",
  "giuseppe.grimaldi.digitalcoach@gmail.com",
] as const;

const ADMIN_EMAIL_SET = new Set<string>(ADMIN_EMAILS);

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAIL_SET.has(email.trim().toLowerCase()));
}
