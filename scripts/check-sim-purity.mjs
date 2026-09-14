#!/usr/bin/env node
/**
 * `src/sim/` and `src/content/` must never touch the DOM, canvas, or the
 * render/input/shell layers. Rules that are only written down get broken;
 * this one fails `npm test`.
 *
 * Relative imports are resolved, not pattern-matched, so `../render/` is
 * caught at any depth. Bare package imports are refused too (no three.js,
 * no DOM helpers) except `vitest` inside test files.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const PURE_DIRS = ['sim', 'content'];
const TEST_PACKAGES = ['vitest'];

const BROWSER_NAMES = [
  'document',
  'window',
  'navigator',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'HTMLElement',
  'HTMLCanvasElement',
  'CanvasRenderingContext2D',
  'OffscreenCanvas',
  'PointerEvent',
  'MouseEvent',
  'TouchEvent',
  'Image',
  'Path2D',
];
const BROWSER_PATTERN = new RegExp(`(^|[^.\\w$])(${BROWSER_NAMES.join('|')})\\b`);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip comments and string contents so a word in a comment or a label isn't flagged. */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => m[0] + ' '.repeat(Math.max(0, m.length - 2)) + m[0]);
}

function* specifiers(source) {
  const re = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(lines[i])) !== null) {
      yield { specifier: match[1], line: i + 1, text: trimmed };
    }
  }
}

const violations = [];

for (const dirName of PURE_DIRS) {
  const dir = join(SRC, dirName);
  let files;
  try {
    files = walk(dir);
  } catch {
    console.error(`sim purity: cannot read ${dir}`);
    process.exit(1);
  }

  for (const file of files) {
    const isTest = /\.test\.ts$/.test(file);
    const source = readFileSync(file, 'utf8');
    const where = relative(ROOT, file);

    for (const { specifier, line, text } of specifiers(source)) {
      if (!specifier.startsWith('.')) {
        if (isTest && TEST_PACKAGES.includes(specifier)) continue;
        violations.push({ where, line, why: `imports package "${specifier}"`, text });
        continue;
      }
      const target = resolve(dirname(file), specifier);
      const top = relative(SRC, target).split(sep)[0];
      if (!PURE_DIRS.includes(top)) {
        violations.push({ where, line, why: `imports from ${top} — outside sim/content`, text });
      }
    }

    const lines = codeOnly(source).split('\n');
    const original = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = BROWSER_PATTERN.exec(lines[i]);
      if (m) violations.push({ where, line: i + 1, why: `uses browser API "${m[2]}"`, text: original[i].trim() });
    }
  }
}

if (violations.length > 0) {
  console.error('\n  sim purity check FAILED\n');
  for (const v of violations) {
    console.error(`  ${v.where}:${v.line} — ${v.why}`);
    console.error(`    ${v.text}\n`);
  }
  console.error('  src/sim and src/content must stay pure: no DOM, no canvas, no render/input/shell.\n');
  process.exit(1);
}

console.log('sim purity OK — no DOM, canvas or renderer in src/sim or src/content');
