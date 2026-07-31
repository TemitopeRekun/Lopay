/**
 * Input sanitizing for the auth form.
 *
 * ## What this is and isn't
 *
 * These functions NORMALISE input — they decide what the value really is before
 * it is validated, compared, or sent. They do NOT escape for output: React
 * escapes everything it renders, so escaping here would double-encode and show a
 * parent `Ada &amp; Co` on their own profile. There is no HTML-stripping either,
 * because nothing in this app renders user input as HTML.
 *
 * And none of it is a security boundary. The browser calls Better Auth directly,
 * so every rule here is also enforced server-side in
 * `lopay-backend/src/auth/signup-guard.ts`. This layer exists so that an honest
 * parent's trailing space, pasted-in phone number, or capitalised email just
 * works instead of producing an error.
 *
 * ## Why invisible characters matter
 *
 * A zero-width space pasted from a website looks like nothing but makes
 * `"ada@gmail.com"` a different string from `"ada@gmail.com"` — different
 * account, silently. Stripping them is what makes "this email is already used"
 * reliable rather than occasionally wrong in a way nobody can see.
 */

/** ZWSP, ZWNJ, ZWJ, word-joiner, BOM — built from codepoints because a literal
 * one in this source line would be invisible to a reviewer. */
const ZERO_WIDTH = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff];

/** Control characters that ARE whitespace, kept so they collapse to a space
 * rather than joining two words together. */
const WHITESPACE_CONTROLS = [0x09, 0x0a, 0x0b, 0x0c, 0x0d];

/**
 * Drop characters that carry no legible meaning.
 *
 * Zero-width characters and non-whitespace control characters are deleted.
 * Whitespace controls (tab, newline, CR) are preserved so a later collapse turns
 * them into a single space — deleting them would turn a name pasted across a line
 * break into one run-together word.
 */
function stripInvisible(value: string): string {
  return value
    .split('')
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (ZERO_WIDTH.includes(code)) return false;
      if (WHITESPACE_CONTROLS.includes(code)) return true;
      return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
    })
    .join('');
}

/**
 * General text: strip invisibles, collapse whitespace runs, trim.
 *
 * @example sanitizeText('  Ada   Lovelace \n') // 'Ada Lovelace'
 */
export function sanitizeText(value: string): string {
  return stripInvisible(value).replace(/\s+/g, ' ').trim();
}

/**
 * A person's display name. Same as `sanitizeText` — named separately because the
 * rule for names is likely to diverge (title-casing, punctuation policy) and call
 * sites should not have to change when it does.
 *
 * @example sanitizeName('chiamaka  obi-nwosu') // 'chiamaka obi-nwosu'
 */
export function sanitizeName(value: string): string {
  return sanitizeText(value);
}

/**
 * An email address: strip invisibles, remove ALL whitespace (an email never
 * legitimately contains any, and a trailing space from autofill is common), and
 * lowercase.
 *
 * Lowercasing matters for the duplicate check: `Ada@Gmail.com` and
 * `ada@gmail.com` are the same mailbox, and the server stores addresses
 * lowercased — so comparing the raw input would let the UI claim an address is
 * free when it isn't.
 *
 * @example sanitizeEmail('  Ada@Gmail.COM ') // 'ada@gmail.com'
 */
export function sanitizeEmail(value: string): string {
  return stripInvisible(value).replace(/\s/g, '').toLowerCase();
}

/**
 * A phone number: strip invisibles and the punctuation people type for
 * legibility, leaving digits and a possible leading `+`.
 *
 * @example sanitizePhone('(0801) 234-5678') // '08012345678'
 * @example sanitizePhone('+234 801 234 5678') // '+2348012345678'
 */
export function sanitizePhone(value: string): string {
  return stripInvisible(value).replace(/[\s\-.()]/g, '');
}

/**
 * A password is NOT sanitized — it is returned exactly as typed.
 *
 * This function exists to make that deliberate rather than an omission someone
 * later "fixes". Trimming a password silently changes the user's secret: they
 * would set `"hunter2 "`, we would store `"hunter2"`, and a login typing the
 * original would fail with no explanation. Whitespace is legitimate password
 * material.
 */
export function sanitizePassword(value: string): string {
  return value;
}
