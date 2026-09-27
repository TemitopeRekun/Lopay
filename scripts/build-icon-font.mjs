/**
 * Regenerates the self-hosted, subsetted Material Symbols font.
 *
 *   npm run build:icon-font
 *
 * Asks the Google Fonts CSS API for a font containing ONLY the ligatures in
 * build/icon-names.mjs, then downloads that .woff2 into public/fonts/ so the
 * app can serve it from its own origin.
 *
 * Self-hosted rather than linked, because this ships as a Capacitor app: the
 * Android shell loads instantly from local assets, and a remote font means the
 * icons are gated on reaching fonts.googleapis.com — so a cold or offline start
 * would show every icon as its own name in words. A local file cannot fail that
 * way, and it also removes a render-blocking third-party request on web.
 *
 * Output is committed. This script only runs when the icon list changes, never
 * as part of `npm run build` — builds must not depend on a third-party fetch.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_AXES, ICON_FONT_PATH, ICON_NAMES } from '../build/icon-names.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public', ICON_FONT_PATH);

// Google serves .woff2 only to UAs it recognises as supporting it; the default
// Node fetch UA gets an ancient .ttf instead.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const cssUrl =
  'https://fonts.googleapis.com/css2' +
  `?family=Material+Symbols+Outlined:${ICON_AXES}` +
  `&icon_names=${ICON_NAMES.join(',')}` +
  '&display=block';

async function get(url, what) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${what} failed: ${res.status} ${res.statusText}`);
  return res;
}

const css = await (await get(cssUrl, 'Fetching subset CSS')).text();

const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
if (!fontUrl) {
  throw new Error(`No @font-face src in the CSS Google returned:\n${css.slice(0, 500)}`);
}

const font = Buffer.from(await (await get(fontUrl, 'Downloading .woff2')).arrayBuffer());

// A subset this small is the whole point; anything near the full 4 MB font means
// `icon_names` was dropped and we would be shipping the bloat we set out to cut.
if (font.length > 512 * 1024) {
  throw new Error(
    `Refusing to write ${(font.length / 1024 / 1024).toFixed(2)} MB — that is the ` +
      'unsubsetted font. Check that icon_names survived in the request URL.',
  );
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, font);

console.log(
  `Wrote public/${ICON_FONT_PATH} — ${ICON_NAMES.length} icons, ` +
    `${(font.length / 1024).toFixed(1)} KB (full font: 3908.0 KB)`,
);
