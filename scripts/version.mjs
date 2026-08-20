#!/usr/bin/env node
/**
 * The version tool. `version.json` at the repo root is the ONE place the app
 * version lives; this script bumps it and proves nothing has drifted from it.
 *
 * Why a script at all: the version used to be copied by hand into five places
 * and every one of them disagreed — build.gradle said 1.0.2/code 3, package.json
 * said 1.0.0, the settings screen said "1.0.2 (Build 45)" (a build number that
 * never existed) and the profile footer said v1.0.2. A user reporting a bug from
 * "v1.0.2" could have been on any of three builds.
 *
 * The fix is that only ONE consumer copies anything at all:
 *   - android/app/build.gradle  parses version.json at configure time
 *   - utils/version.ts          imports version.json into the bundle
 *   - package.json              is a copy, synced + verified here (npm demands
 *                               a literal string; it cannot read another file)
 *
 * Usage:
 *   node scripts/version.mjs print              current version, as a label
 *   node scripts/version.mjs bump [patch|minor|major]
 *   node scripts/version.mjs sync               rewrite the derived copies
 *   node scripts/version.mjs check              exit 1 on any drift (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_FILE = join(ROOT, "version.json");
const PACKAGE_FILE = join(ROOT, "package.json");
const LOCK_FILE = join(ROOT, "package-lock.json");
const GRADLE_FILE = join(ROOT, "android", "app", "build.gradle");

/** Exactly three dotted numbers and no more, so an IP (127.0.0.1, 10.0.2.2) or
 * a formatted phone number (0801.234.5678) does not read as a version. */
const VERSION_LITERAL = /(?<![.\d])v?\d+\.\d+\.\d+(?![.\d])/;
/** Escape hatch for a UI line that legitimately holds a dotted triple. */
const OPT_OUT = "not-a-version";

const read = (p) => readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));

/**
 * The two places npm records the project's own version in the lockfile: the
 * root object and the "" entry of `packages`.
 */
const lockVersions = (lock) => [
  ["version", lock.version],
  ['packages[""].version', lock.packages?.[""]?.version],
];

/** Read + validate version.json. A malformed version is a release-stopper. */
function loadVersion() {
  const raw = readJson(VERSION_FILE);
  if (!/^\d+\.\d+\.\d+$/.test(raw.name ?? "")) {
    fail(`version.json "name" must be MAJOR.MINOR.PATCH, got ${JSON.stringify(raw.name)}`);
  }
  if (!Number.isInteger(raw.code) || raw.code < 1) {
    fail(`version.json "code" must be a positive integer, got ${JSON.stringify(raw.code)}`);
  }
  return { name: raw.name, code: raw.code, raw };
}

function fail(message) {
  console.error(`\n  version: ${message}\n`);
  process.exit(1);
}

const label = ({ name, code }) => `${name} (build ${code})`;

// --- print -----------------------------------------------------------------

function print() {
  const v = loadVersion();
  console.log(label(v));
}

// --- bump ------------------------------------------------------------------

function bump(kind = "patch") {
  if (!["patch", "minor", "major"].includes(kind)) {
    fail(`unknown bump "${kind}" — expected patch, minor or major`);
  }
  const v = loadVersion();
  const [major, minor, patch] = v.name.split(".").map(Number);
  const next =
    kind === "major"
      ? `${major + 1}.0.0`
      : kind === "minor"
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;
  // versionCode is what Google Play orders uploads by. It only ever goes up,
  // by one, per release — independent of which semver segment moved.
  const nextCode = v.code + 1;
  const updated = { ...v.raw, name: next, code: nextCode };
  writeFileSync(VERSION_FILE, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`  ${label(v)}  ->  ${label({ name: next, code: nextCode })}`);
  sync();
}

// --- sync ------------------------------------------------------------------

function sync() {
  const v = loadVersion();

  const pkg = readJson(PACKAGE_FILE);
  if (pkg.version === v.name) {
    console.log(`  package.json already at ${v.name}`);
  } else {
    // Rewrite the one line rather than re-serialising the whole file, so a sync
    // never reformats package.json or reorders its keys.
    const before = read(PACKAGE_FILE);
    const patched = before.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${v.name}"`);
    if (patched === before) fail('could not find a "version" field in package.json');
    writeFileSync(PACKAGE_FILE, patched);
    console.log(`  package.json  ${pkg.version}  ->  ${v.name}`);
  }

  // The lockfile records the project's own version twice. Left behind, npm
  // rewrites them during some later unrelated install and the diff lands in
  // whichever PR that happens to be. Only those two are touched — the whole
  // file is deliberately not re-serialised.
  const lockBefore = read(LOCK_FILE);
  const lock = JSON.parse(lockBefore);
  const stale = lockVersions(lock).filter(([, found]) => found !== v.name);
  if (!stale.length) {
    console.log(`  package-lock.json already at ${v.name}`);
    return;
  }
  // Edited structurally, NOT by search-and-replace: a dependency pinned at the
  // same version as the app would be caught by any textual match on
  // `"version": "1.0.3"`. JSON.parse/stringify preserves key order, and npm
  // writes this file as 2-space JSON with a trailing newline, so re-serialising
  // is byte-identical apart from the two fields below — asserted right after.
  if (lock.version !== undefined) lock.version = v.name;
  if (lock.packages?.[""]?.version !== undefined) lock.packages[""].version = v.name;
  // Match the working copy's line endings — git checks this file out with CRLF
  // on Windows, and JSON.stringify only ever emits LF. No value in a lockfile
  // contains a newline, so a blanket substitution is safe; the byte-identity
  // assertion below catches it if that ever stops being true.
  const eol = lockBefore.includes("\r\n") ? "\r\n" : "\n";
  const lockAfter = `${JSON.stringify(lock, null, 2)}\n`.replaceAll("\n", eol);
  const expected = stale.reduce(
    (text, [, found]) => text.replace(`"version": "${found}"`, `"version": "${v.name}"`),
    lockBefore,
  );
  if (lockAfter !== expected) {
    fail(
      "re-serialising package-lock.json would change more than the app version" +
        " — run `npm install` to let npm rewrite it, then commit the lockfile",
    );
  }
  writeFileSync(LOCK_FILE, lockAfter);
  console.log(`  package-lock.json  ${stale.map(([w]) => w).join(", ")}  ->  ${v.name}`);
}

// --- check -----------------------------------------------------------------

/**
 * Every way the version could have drifted back out of version.json. Run in CI
 * on every push and PR.
 */
function check() {
  const v = loadVersion();
  const problems = [];

  const pkg = readJson(PACKAGE_FILE);
  if (pkg.version !== v.name) {
    problems.push(
      `package.json version is ${pkg.version}, version.json says ${v.name}` +
        ` — run \`npm run version:sync\``,
    );
  }

  // package-lock.json carries the version twice. npm rewrites both on the next
  // install, so leaving them stale means unrelated version churn lands in
  // whichever PR next touches a dependency.
  const lock = readJson(LOCK_FILE);
  for (const [where, found] of lockVersions(lock)) {
    if (found !== v.name) {
      problems.push(
        `package-lock.json ${where} is ${found}, version.json says ${v.name}` +
          ` — run \`npm run version:sync\``,
      );
    }
  }

  // Android Studio's UI and some Capacitor guides write a literal back into
  // build.gradle, silently un-doing the single source of truth. Assert the
  // derivation is still present rather than blacklisting one spelling of a
  // literal: AGP accepts both `versionCode 3` and `versionCode = 3`, and a
  // mere mention of "version.json" is satisfied by the comment above it.
  const gradle = read(GRADLE_FILE);
  if (!/JsonSlurper\(\)\s*\.parse\(\s*rootProject\.file\(\s*'\.\.\/version\.json'/.test(gradle)) {
    problems.push(
      `android/app/build.gradle no longer parses version.json —` +
        ` restore the appVersion line at the top of the file`,
    );
  }
  for (const [field, source] of [
    ["versionCode", "appVersion\\.code"],
    ["versionName", "appVersion\\.name"],
  ]) {
    if (!new RegExp(`${field}\\s*=?\\s*${source}\\b`).test(gradle)) {
      problems.push(
        `android/app/build.gradle does not set ${field} from` +
          ` ${source.replace("\\", "")} — it has been hardcoded again`,
      );
    }
  }

  // The screens are where the last drift lived. Anything that looks like a
  // version literal in the UI layer is a copy waiting to go stale.
  const uiFiles = execFileSync(
    "git",
    ["ls-files", "pages", "components", "App.tsx", "index.html"],
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter((f) => f && !/\.(test|spec)\.[jt]sx?$/.test(f));
  for (const file of uiFiles) {
    const lines = read(join(ROOT, file)).split("\n");
    lines.forEach((line, i) => {
      if (line.includes(OPT_OUT)) return;
      const hit = line.match(VERSION_LITERAL);
      if (hit) {
        problems.push(
          `${file}:${i + 1} hardcodes the version "${hit[0]}" — import` +
            ` { APP_VERSION_LABEL } from "@/utils/version" instead, or put a` +
            ` "${OPT_OUT}" comment on that line if it is not a version`,
        );
      }
    });
  }

  if (problems.length) {
    console.error(`\n  Version drift (source of truth: version.json = ${label(v)}):\n`);
    for (const p of problems) console.error(`   - ${p}`);
    console.error("");
    process.exit(1);
  }
  console.log(`  version ${label(v)} — consistent everywhere`);
}

const [command = "print", arg] = process.argv.slice(2);
const commands = { print, bump, sync, check };
if (!Object.hasOwn(commands, command)) {
  fail(`unknown command "${command}" — expected print, bump, sync or check`);
}
commands[command](arg);
