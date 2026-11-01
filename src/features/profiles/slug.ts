/** Longest page address the database accepts (profiles.slug). */
export const SLUG_MAX = 100;

/**
 * Turns a name (or a typed address) into a page address: "SCORE Greater Phoenix"
 * becomes "score-greater-phoenix". Lowercase letters, numbers and single hyphens only,
 * which is what the database's check on profiles.slug allows.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // é → e
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "") // "Founder's" → "founders"
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, "");
}
