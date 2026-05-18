/**
 * Shared helpers for generating synthetic internal emails from a
 * student's class + Cyrillic name. Used by both the seed and migrate
 * scripts so the two stay in lock-step.
 */

export interface AccountEntry {
  class: string; // e.g. "КУ-1"
  firstname: string;
  lastname: string;
}

/**
 * Cyrillic → Latin transliteration table (Mongolian-leaning).
 * Distinguishes Ө/О and Ү/У via "oe"/"ue" so emails stay unique.
 */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "ye", ё: "yo",
  ж: "j", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", ө: "oe", п: "p", р: "r", с: "s", т: "t",
  у: "u", ү: "ue", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Convert Cyrillic + spaces/hyphens to a lowercase ASCII email-safe slug. */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .split("")
    .map((c) => {
      if (TRANSLIT[c] !== undefined) return TRANSLIT[c];
      if (/[a-z0-9]/.test(c)) return c;
      return ""; // drop everything else (spaces, hyphens, punctuation)
    })
    .join("");
}

/** Build the synthetic internal email for an account. */
export function syntheticEmail(entry: AccountEntry): string {
  const prefix = entry.class
    .replace("КУ-", "ku")
    .replace("КУ", "ku")
    .toLowerCase();
  // Readable form: ku1.saihanbileg.bayarsaihan@cs2026.internal
  return `${prefix}.${slugify(entry.firstname)}.${slugify(entry.lastname)}@cs2026.internal`;
}
