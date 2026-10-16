/**
 * An agency's name as it appears in its customers' address:
 * "Rossi Dental Clinic" → "rossi-dental-clinic", so customers sign in at
 * /rossi-dental-clinic and use /rossi-dental-clinic/dashboard. Derived from
 * the name (no column), so renaming an agency changes its address.
 */
export function agencySlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** First path segments the AI Team app itself uses; no agency may take them. */
const RESERVED = new Set([
  'agency-login',
  'api',
  'assets',
  'box',
  'dashboard',
  'favicon-ico',
  'sign-in',
  'sign-up',
  'trpc',
  'tv-hook',
]);

/** Why a name cannot become an address, or null when it can. */
export function slugProblem(name: string): string | null {
  const slug = agencySlug(name);
  if (!slug) return 'The name needs at least one letter or number';
  if (RESERVED.has(slug))
    return `"${name}" is used by AI Team itself; choose another name`;
  return null;
}
