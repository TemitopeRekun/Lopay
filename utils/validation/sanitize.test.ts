import { describe, it, expect } from 'vitest';
import {
  sanitizeEmail,
  sanitizeName,
  sanitizePassword,
  sanitizePhone,
  sanitizeText,
} from './sanitize';

const ZWSP = String.fromCharCode(0x200b);
const ZWNJ = String.fromCharCode(0x200c);
const BOM = String.fromCharCode(0xfeff);
const LF = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);

describe('sanitizeText', () => {
  it('trims and collapses whitespace runs', () => {
    expect(sanitizeText('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });

  it('strips zero-width characters', () => {
    expect(sanitizeText(`Ada${ZWSP}${ZWNJ}Lovelace${BOM}`)).toBe('AdaLovelace');
  });

  it('deletes non-whitespace control characters', () => {
    expect(sanitizeText(`Ada${NUL}Lovelace`)).toBe('AdaLovelace');
  });

  // Deleting the newline instead of collapsing it would store "AdaLovelace" —
  // a different name from the one the parent typed.
  it('collapses whitespace control characters to a single space', () => {
    expect(sanitizeText(`Ada${LF}Lovelace`)).toBe('Ada Lovelace');
    expect(sanitizeText(`Ada${TAB}Lovelace`)).toBe('Ada Lovelace');
  });

  it('returns an empty string for input that is entirely invisible', () => {
    expect(sanitizeText(`${ZWSP}  ${BOM}`)).toBe('');
  });
});

describe('sanitizeName', () => {
  it('preserves accents, hyphens and apostrophes', () => {
    expect(sanitizeName('Chiamaka Obi-Nwosu')).toBe('Chiamaka Obi-Nwosu');
    expect(sanitizeName("Zoë N'Diaye")).toBe("Zoë N'Diaye");
  });

  it('does not change case — a name is the parent\'s to capitalise', () => {
    expect(sanitizeName('adaEZE oKAFOR')).toBe('adaEZE oKAFOR');
  });

  // React escapes on render; escaping here too would show the parent
  // "Ada &amp; Co" on their own profile.
  it('does not escape markup', () => {
    expect(sanitizeName('Ada & Co <b>')).toBe('Ada & Co <b>');
  });
});

describe('sanitizeEmail', () => {
  it('lowercases and trims', () => {
    expect(sanitizeEmail('  Ada@Gmail.COM ')).toBe('ada@gmail.com');
  });

  // The duplicate check compares against a lowercased stored address, so
  // skipping this would let the UI claim a taken address is free.
  it('makes differently-cased spellings of one mailbox identical', () => {
    expect(sanitizeEmail('Ada@Gmail.com')).toBe(sanitizeEmail('ada@gmail.com'));
  });

  it('removes internal whitespace, which an email never legitimately contains', () => {
    expect(sanitizeEmail('ada @gmail. com')).toBe('ada@gmail.com');
  });

  it('strips a zero-width character that would silently make a different address', () => {
    expect(sanitizeEmail(`ada${ZWSP}@gmail.com`)).toBe('ada@gmail.com');
  });

  it('preserves plus-addressing and dots', () => {
    expect(sanitizeEmail('ada.lovelace+lopay@gmail.com')).toBe(
      'ada.lovelace+lopay@gmail.com',
    );
  });
});

describe('sanitizePhone', () => {
  it('strips the punctuation people type for legibility', () => {
    expect(sanitizePhone('(0801) 234-5678')).toBe('08012345678');
    expect(sanitizePhone('0801.234.5678')).toBe('08012345678');
  });

  it('keeps a leading plus', () => {
    expect(sanitizePhone('+234 801 234 5678')).toBe('+2348012345678');
  });

  it('strips zero-width characters', () => {
    expect(sanitizePhone(`0801${ZWSP}2345678`)).toBe('08012345678');
  });
});

describe('sanitizePassword', () => {
  // Trimming a password silently changes the user's secret: they would set
  // "hunter2 ", we would store "hunter2", and their next login would fail with
  // no explanation.
  it('returns the password exactly as typed, including whitespace', () => {
    expect(sanitizePassword('  hunter2  ')).toBe('  hunter2  ');
    expect(sanitizePassword('pass word')).toBe('pass word');
  });

  it('does not strip characters that look invisible but are legitimate secret material', () => {
    expect(sanitizePassword(`hunter${ZWSP}2`)).toBe(`hunter${ZWSP}2`);
  });
});
