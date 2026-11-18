// STARFALL DEFENDER — best-game-01 entrypoint (Node 22, standard library only).
//
// The game is the static files in this directory's game/ folder: game/index.html
// plus its ES modules, vanilla JavaScript and Canvas, no libraries and no network
// requests. This program hands the entry in. It checks the payload first (every
// file under game/ present, non-empty and inside the path cap; every screenshot
// inside the 256 KiB cap), copies game/ and screenshots/ from beside this file
// into /output, writes /output/dossier.json with the vendored make.fun library,
// then reads the dossier back and prints a build summary.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps for best-game-01: at most 4 screenshots of at most 256 KiB
// each, at most 993 entries in game/ totalling 48 MiB, no game path over 1000
// bytes, and 160 KiB of dossier text. buildDossier enforces these itself; the
// checks below fail first, naming the offending file.
const SCREENSHOT_MAX_BYTES = 262_144;
const SCREENSHOT_MAX_COUNT = 4;
const GAME_PATH_MAX_BYTES = 1000;

const DOSSIER_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: SCREENSHOT_MAX_COUNT, max_bytes: SCREENSHOT_MAX_BYTES },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: GAME_PATH_MAX_BYTES,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

function fail(message: string): never {
  throw new Error(`handover: ${message}`);
}

// Every file below a directory, recursively, in sorted path order.
function collectFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      const info = statSync(path);
      if (info.isDirectory()) walk(path);
      else if (info.isFile()) found.push(path);
      else fail(`not a plain file or directory: ${relative(here, path)}`);
    }
  };
  walk(dir);
  return found;
}

// --- 1. Verify the game payload before anything is copied. ---
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  fail('game/ is missing: the entry is a directory of static files');
}
const gameFiles = collectFiles(gameDir);
if (gameFiles.length === 0) fail('game/ is empty');
let gameBytes = 0;
for (const file of gameFiles) {
  const rel = relative(gameDir, file);
  const bytes = statSync(file).size;
  if (bytes === 0) fail(`game file is empty: game/${rel}`);
  if (Buffer.byteLength(rel, 'utf8') > GAME_PATH_MAX_BYTES) {
    fail(`game path over the ${GAME_PATH_MAX_BYTES}-byte cap: game/${rel}`);
  }
  gameBytes += bytes;
}
if (!gameFiles.includes(join(gameDir, 'index.html'))) {
  fail('game/index.html is missing: the page must sit at the root of game/');
}

// --- 2. Validate every screenshot against the count and size caps. ---
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
  fail('screenshots/ is missing: the entry needs 3 or 4 screenshots');
}
const shotFiles = collectFiles(shotsDir);
if (shotFiles.length === 0) fail('screenshots/ is empty');
if (shotFiles.length > SCREENSHOT_MAX_COUNT) {
  fail(`${shotFiles.length} screenshots found, the cap is ${SCREENSHOT_MAX_COUNT}`);
}
const shotSizes: Array<[string, number]> = shotFiles.map((file) => {
  const bytes = statSync(file).size;
  const rel = relative(shotsDir, file);
  if (bytes > SCREENSHOT_MAX_BYTES) {
    fail(`screenshot over the ${SCREENSHOT_MAX_BYTES}-byte cap: ${rel} (${bytes} bytes)`);
  }
  return [rel, bytes];
});
const shotBytes = shotSizes.reduce((total, [, bytes]) => total + bytes, 0);

// --- 3. Copy the payload into /output and write the dossier. ---
// Clear the previous handover's artifacts first: without this, files removed
// from the repo since the last run would linger in the output and could ship
// in the entry or trip the dossier caps.
for (const artifact of ['game', 'screenshots', 'dossier.json']) {
  rmSync(join(outDir, artifact), { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossierBytes = buildDossier(outDir, DOSSIER_CAPS);
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossierBytes);

// --- 4. Read the dossier back and print a build summary. ---
const dossierText = readFileSync(dossierPath, 'utf8');
const dossier = JSON.parse(dossierText) as {
  schema?: unknown;
  cover?: unknown;
  images?: unknown[];
};
if (dossier.schema !== 'makefun/dossier/v1') {
  fail(`dossier.json came back with an unexpected schema: ${String(dossier.schema)}`);
}
const imageCount = Array.isArray(dossier.images) ? dossier.images.length : 0;
if (imageCount !== shotFiles.length) {
  fail(`dossier lists ${imageCount} images but ${shotFiles.length} screenshots were copied`);
}

console.log(`handover ok -> ${outDir}`);
console.log(`  game: ${gameFiles.length} files, ${gameBytes} bytes`);
console.log(`  screenshots: ${shotSizes.map(([name, bytes]) => `${name} (${bytes} bytes)`).join(', ')}`);
console.log(`  screenshots total: ${shotBytes} bytes across ${shotFiles.length} files`);
console.log(`  dossier.json: ${Buffer.byteLength(dossierText, 'utf8')} bytes, schema ${String(dossier.schema)}, cover image ${String(dossier.cover)}, ${imageCount} images`);
