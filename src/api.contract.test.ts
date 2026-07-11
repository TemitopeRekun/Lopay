import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

/**
 * API contract guard (Milestone 5).
 *
 * The committed typed client (`src/api.generated.ts`) must be exactly what
 * `openapi-typescript` produces from the committed spec (`openapi.json`). This
 * fails if either drifts — a hand-edit of the client, or a spec update (synced
 * from the backend via `npm run generate:swagger`) without re-running
 * `npm run generate:types`. Regenerating with the CLI here reproduces the npm
 * script byte-for-byte (verified: CLI stdout === the `-o` file output).
 *
 * See docs/adr/0005-openapi-contract-and-sync.md (backend repo).
 */
const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(repoRoot, 'openapi.json');
const clientPath = join(repoRoot, 'src', 'api.generated.ts');
// Resolve the CLI via the package root so it works regardless of npm hoisting.
const cli = join(
  dirname(require.resolve('openapi-typescript/package.json')),
  'bin',
  'cli.js',
);

describe('OpenAPI contract', () => {
  it('committed api.generated.ts matches the committed openapi.json', () => {
    const committed = readFileSync(clientPath, 'utf8');
    const regenerated = execFileSync(process.execPath, [cli, specPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(regenerated).toBe(committed);
  });
});
