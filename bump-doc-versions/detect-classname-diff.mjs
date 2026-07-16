#!/usr/bin/env node
// detect-classname-diff — parses docusaurus.config.js from two revisions and
// emits a JSON array of { minor, from, to } for every version entry whose
// `className` changed. Refuses to emit minor-spanning bumps.
//
// Used by the public-repo caller workflow to drive both the cross-repo
// dispatch into `docs-internal-<product>` and the local safety-net bump.
// See design §6.3.1.
//
// Usage:
//   node detect-classname-diff.mjs --before <file> --after <file>
//
// Prints the JSON array on stdout. Exit code:
//   0 — parsed successfully (may print `[]`)
//   3 — validation error (bad flags / cannot read files)

import { promises as fs } from 'node:fs';
import { parseArgs } from 'node:util';

// Matches either `current:` or `'3.17':` / `"3.17":` followed by a flat
// object literal containing a `className: 'X.Y.Z'` field. `[^{}]*?` restricts
// the search to a single non-nested block so unrelated braces further down
// the file cannot leak in. Ignores classNames that are not pure `[0-9.]+`
// (e.g. the commented-out `'X.X.X'` placeholder in the template).
const ENTRY_RX =
  /(current|['"](\d+\.\d+)['"])\s*:\s*\{[^{}]*?className\s*:\s*['"](\d+\.\d+\.\d+)['"]/g;

function parseVersions(text) {
  const out = {};
  ENTRY_RX.lastIndex = 0;
  let m;
  while ((m = ENTRY_RX.exec(text)) !== null) {
    const key = m[1] === 'current' ? 'current' : m[2];
    out[key] = m[3];
  }
  return out;
}

async function main() {
  const { values } = parseArgs({
    options: {
      before: { type: 'string' },
      after:  { type: 'string' },
    },
  });
  if (!values.before || !values.after) {
    console.error('Usage: detect-classname-diff.mjs --before <file> --after <file>');
    process.exit(3);
  }

  // `before` is allowed to be missing (initial commit): treat as no-entries.
  let beforeText = '';
  try {
    beforeText = await fs.readFile(values.before, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const afterText = await fs.readFile(values.after, 'utf8');

  const before = parseVersions(beforeText);
  const after = parseVersions(afterText);

  const bumps = [];
  for (const [key, to] of Object.entries(after)) {
    const from = before[key];
    if (!from || from === to) continue;
    const [fromMajor, fromMinor] = from.split('.');
    const [toMajor, toMinor] = to.split('.');
    if (`${fromMajor}.${fromMinor}` !== `${toMajor}.${toMinor}`) {
      console.error(
        `warning: skipping ${key}: ${from} -> ${to} (minor-spanning bump not supported by this workflow)`,
      );
      continue;
    }
    const minor = key === 'current' ? `${toMajor}.${toMinor}` : key;
    bumps.push({ minor, from, to });
  }
  process.stdout.write(JSON.stringify(bumps));
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
