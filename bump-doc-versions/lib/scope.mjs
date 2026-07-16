// File-scope walker, baked-in path exclusions, and .version-bump-ignore support.

import { promises as fs } from 'node:fs';
import path from 'node:path';

// Extensions we consider text-like enough to scan for version strings.
// Binary media (images, fonts) and lockfiles are skipped implicitly.
const SCANNABLE_EXTENSIONS = new Set([
  '.md', '.mdx',
  '.yaml', '.yml',
  '.json', '.jsonc',
  '.js', '.mjs', '.cjs', '.ts', '.tsx',
  '.html', '.xml',
  '.sh', '.env',
  '.txt', '.properties',
  '.gradle', '.groovy', '.kts',
  '.tf', '.toml',
]);

// Directory names that are excluded regardless of scope. From design §4.3.
const EXCLUDED_DIRS = new Set([
  'helm-charts',
  'scalar-kubernetes',
  'node_modules',
  '.git',
  'build',
  'dist',
]);

/**
 * Returns the list of scope base directories (relative to repo root) to walk,
 * per design §6.1.3.
 *
 * @param {'internal'|'public'} repoKind
 * @param {string} minor            The concrete "X.Y" being bumped (e.g. "3.17").
 * @param {boolean} isCurrent       True if this minor is the public repo's current minor
 *                                  (or if --minor === "current").
 */
export function getFileScope(repoKind, minor, isCurrent) {
  if (repoKind === 'internal') {
    return ['docs/en-us', 'docs/ja-jp'];
  }
  // public
  if (isCurrent) {
    return [
      'docs',
      'i18n/versioned_docs/ja-jp/docusaurus-plugin-content-docs/current',
    ];
  }
  return [
    `versioned_docs/version-${minor}`,
    `i18n/versioned_docs/ja-jp/docusaurus-plugin-content-docs/version-${minor}`,
  ];
}

/**
 * Loads `.version-bump-ignore` (gitignore-lite) from the repo root, if present.
 * Returns a predicate `(relPath) => boolean` — true means "ignore this path".
 *
 * Supported syntax:
 *   - Lines starting with `#` are comments.
 *   - Blank lines are ignored.
 *   - `*` matches any characters except `/`.
 *   - `**` matches any characters including `/`.
 *   - Trailing `/` marks directory patterns.
 *   - Leading `!` negates (un-ignores) a prior match.
 */
export async function loadIgnoreFile(root) {
  const p = path.join(root, '.version-bump-ignore');
  let text;
  try {
    text = await fs.readFile(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return () => false;
    throw e;
  }
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    const body = negate ? line.slice(1) : line;
    rules.push({ regex: globToRegex(body), negate });
  }
  return (rel) => {
    let ignored = false;
    for (const r of rules) {
      if (r.regex.test(rel)) ignored = !r.negate;
    }
    return ignored;
  };
}

function globToRegex(glob) {
  const isDir = glob.endsWith('/');
  let g = isDir ? glob.slice(0, -1) : glob;
  // Anchor: patterns starting with `/` are repo-root-relative; otherwise match anywhere.
  const anchored = g.startsWith('/');
  if (anchored) g = g.slice(1);

  let rx = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        rx += '.*';
        i++;
        // Consume trailing slash of `**/`
        if (g[i + 1] === '/') i++;
      } else {
        rx += '[^/]*';
      }
    } else if (c === '?') {
      rx += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      rx += '\\' + c;
    } else {
      rx += c;
    }
  }
  const prefix = anchored ? '^' : '(?:^|/)';
  const suffix = isDir ? '(?:/.*)?$' : '(?:/.*)?$';
  return new RegExp(prefix + rx + suffix);
}

/**
 * Walk all files under the given scope paths, honoring baked-in exclusions
 * and the caller-provided ignore predicate. Yields absolute file paths.
 */
export async function* walkScope(root, scopePaths, ignoreMatcher) {
  for (const rel of scopePaths) {
    const abs = path.join(root, rel);
    yield* walkDir(root, abs, ignoreMatcher);
  }
}

async function* walkDir(root, dir, ignoreMatcher) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');

    if (EXCLUDED_DIRS.has(entry.name)) continue;
    if (ignoreMatcher(rel)) continue;

    if (entry.isDirectory()) {
      yield* walkDir(root, abs, ignoreMatcher);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
      yield abs;
    }
  }
}
