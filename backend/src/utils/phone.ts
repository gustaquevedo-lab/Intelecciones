/**
 * Normalizes a phone number to standard Paraguayan format:
 * - Strips all non-digit characters.
 * - If empty, returns empty string.
 * - If starts with 595, returns as is.
 * - Otherwise, removes leading 0 (if present) and prefixes with 595.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  return clean.startsWith('595') ? clean : `595${clean.replace(/^0/, '')}`;
}
