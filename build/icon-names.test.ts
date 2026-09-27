import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ICON_FONT_PATH, ICON_NAMES } from './icon-names.mjs';

const ROOT = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [rel] : [];
  });
}

const FILES = [...sourceFiles('pages'), ...sourceFiles('components')];

/** `<span className="material-symbols-outlined ...">SOME_LIGATURE</span>` */
const SPAN = /material-symbols-outlined[^>]*>([\s\S]{0,200}?)</g;

describe('Material Symbols subset', () => {
  it('covers every statically-written ligature in the app', () => {
    const missing = new Map<string, string>();

    for (const file of FILES) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      for (const [, body] of src.matchAll(SPAN)) {
        const name = body.trim();
        // Anything else is computed at runtime (`presentation.icon`,
        // `getStatusIcon(...)`). Those names live in this list by hand — the
        // header of icon-names.mjs explains why they cannot be scraped.
        if (!/^[a-z][a-z0-9_]*$/.test(name)) continue;
        if (!ICON_NAMES.includes(name)) missing.set(name, file);
      }
    }

    expect(
      [...missing].map(([name, file]) => `${name} (${file})`),
      'Icons used in source but absent from the font subset would render as ' +
        'their own name in words. Add them to build/icon-names.mjs and re-run ' +
        '`npm run build:icon-font`.',
    ).toEqual([]);
  });

  it('is sorted and free of duplicates, so diffs stay reviewable', () => {
    expect(ICON_NAMES).toEqual([...new Set(ICON_NAMES)].sort());
  });

  it('ships a subsetted font, not the full 4 MB variable font', () => {
    const bytes = statSync(join(ROOT, 'public', ICON_FONT_PATH)).size;
    expect(bytes).toBeGreaterThan(10 * 1024);
    expect(bytes).toBeLessThan(512 * 1024);
  });

  it('self-hosts the font instead of linking Google Fonts', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toMatch(/Material\+Symbols/);
    expect(html).toContain(`rel="preload"`);
    expect(html).toContain(ICON_FONT_PATH);
  });

  it('blocks rather than swaps, so icons never render as words', () => {
    const css = readFileSync(join(ROOT, 'index.css'), 'utf8');
    expect(css).toContain('font-display: block');
    expect(css).toMatch(/font-family:\s*"Material Symbols Outlined"/);
    expect(css).toContain(ICON_FONT_PATH);
  });
});
