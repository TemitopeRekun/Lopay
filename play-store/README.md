# Play Console store-listing assets

Uploaded by hand in the Play Console under **Store presence → Main store
listing**. Nothing here is compiled into the app or bundled by Vite — these
files exist only so the listing artwork is versioned alongside the code instead
of living in someone's Downloads folder.

Regenerate the launcher/splash artwork with `npm run generate:assets`. That
command does **not** touch this directory; these two were produced once from the
same sources and only need redoing if the logo itself changes.

| File | Play Console field | Requirement |
| --- | --- | --- |
| `icon-512.png` | App icon | 512×512, 32-bit PNG **with** alpha, ≤1024 KB |
| `feature-graphic-1024x500.png` | Feature graphic | 1024×500, JPEG or 24-bit PNG, **no** alpha |

Both are generated to spec, including the alpha/no-alpha split — Play rejects a
feature graphic that carries an alpha channel, and an app icon that lacks one.

## Source artwork

Both derive from `lopay icon.jpg` (the cap mark) and `lopay display.jpg` (the
mark plus the LOPAY TECHNOLOGIES wordmark). The originals are 500×500 JPEGs, so
they were run through a threshold pass to strip the JPEG chroma noise off the
black field before scaling. That gets clean edges but cannot invent detail the
500 px source never had.

**If the logo is ever re-exported, export at 1024×1024 or larger — ideally
SVG.** The mark is flat two-colour geometry, so a vector export would let every
asset here be generated at full sharpness rather than reconstructed.

## Still needed before the listing can be published

Neither can be produced from the logo:

- **Phone screenshots** — 2–8 required, 16:9 or 9:16, each 320–3840 px per side.
- **Short description** (≤80 chars) and **full description** (≤4000 chars).
