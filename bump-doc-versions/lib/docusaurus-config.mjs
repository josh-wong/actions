// Minimal reader/updater for the `versions:` block in a Docusaurus config.
//
// We deliberately avoid a full JS parser. The `versions` object literal in
// docusaurus.config.js is stable enough that a targeted regex is both simpler
// and more robust to unrelated file changes. Each entry looks like:
//
//   current: { label: '...', className: '3.18.0', ... }
//   '3.17':  { label: '3.17',  className: '3.17.3', ... }
//
// Only the `className` field is read/written — this is the single source of
// truth for "current patch of each minor" per design §1d.

import { promises as fs } from 'node:fs';
import path from 'node:path';

function keyPattern(minorKey) {
  if (minorKey === 'current') return 'current';
  return `['"]${minorKey.replace(/\./g, '\\.')}['"]`;
}

function entryRegex(minorKey) {
  // `[^{}]*?` restricts the search to a single flat object literal (no nested
  // braces). Docusaurus version entries are flat objects, so this is safe.
  return new RegExp(
    `(${keyPattern(minorKey)}\\s*:\\s*\\{[^{}]*?className\\s*:\\s*['"])([\\d.]+)(['"])`
  );
}

export async function getClassNameFor(root, minorKey) {
  const cfgPath = path.join(root, 'docusaurus.config.js');
  const text = await fs.readFile(cfgPath, 'utf8');
  const m = text.match(entryRegex(minorKey));
  return m ? m[2] : null;
}

/**
 * Returns the "X.Y" of the current entry's className, or null if not found.
 */
export async function getCurrentMinor(root) {
  const cn = await getClassNameFor(root, 'current');
  if (!cn) return null;
  const parts = cn.split('.');
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Rewrites the className field for the given entry to `newVer`. Returns
 * `{ changed, from, to }`.
 */
export async function updateClassName(root, minorKey, newVer, dryRun) {
  const cfgPath = path.join(root, 'docusaurus.config.js');
  const text = await fs.readFile(cfgPath, 'utf8');
  const rx = entryRegex(minorKey);
  const m = text.match(rx);
  if (!m) return { changed: false, from: null, to: newVer };
  if (m[2] === newVer) return { changed: false, from: m[2], to: newVer };
  const next = text.replace(rx, `$1${newVer}$3`);
  if (!dryRun) await fs.writeFile(cfgPath, next, 'utf8');
  return { changed: true, from: m[2], to: newVer };
}
