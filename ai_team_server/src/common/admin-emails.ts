// src/common/admin-emails.ts

/**
 * Mirrors ADMIN_EMAILS in AI-Team-frontend/src/lib/adminAccess.ts. Set
 * ADMIN_EMAILS (comma-separated) in the environment to replace the list.
 */
const DEFAULT_ADMIN_EMAILS = [
  'digitalcoachai@gmail.com',
  'luca.papa.digital@gmail.com',
  'natali@digital-coach.com',
  'giuseppe@digital-coach.com',
  'giuseppe.grimaldi.digitalcoach@gmail.com',
];

function adminEmailSet(): Set<string> {
  const configured = process.env.ADMIN_EMAILS;
  const list =
    configured === undefined || configured.trim() === ''
      ? DEFAULT_ADMIN_EMAILS
      : configured.split(',');
  return new Set(
    list.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && adminEmailSet().has(email.trim().toLowerCase()));
}
