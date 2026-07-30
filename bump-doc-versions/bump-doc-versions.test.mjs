// Tests for bump-doc-versions.
//
// Focuses on `deriveFromInternal` — the auto-detect that scans docs/en-us for
// anchored X.Y.Z matches and either returns the single unique version, an
// ambiguity error, or null.
//
// Run with:  node --test bump-doc-versions/
// Zero-dep: uses `node:test` (Node 20+ built-in) and `node:assert`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { deriveFromInternal } from './bump-doc-versions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scalardbConfig = JSON.parse(
  await fs.readFile(path.join(__dirname, 'products/scalardb.json'), 'utf8'),
);

// Build a temp docs/en-us tree from a { relPath: contents } map. Auto-cleans
// via t.after() so tests don't leak fixtures under $TMPDIR.
async function makeTree(t, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bdv-test-'));
  const enUs = path.join(root, 'docs', 'en-us');
  await fs.mkdir(enUs, { recursive: true });
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(enUs, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents);
  }
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('single anchored version -> returns it', async (t) => {
  const root = await makeTree(t, {
    'guide.mdx': 'Use com.scalar-labs:scalardb:3.17.0 in your build.',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, '3.17.0');
  assert.equal(result.error, undefined);
});

test('same version repeated across files and patterns -> returns it (not ambiguous)', async (t) => {
  const root = await makeTree(t, {
    'maven.mdx': 'com.scalar-labs:scalardb:3.17.0',
    'docker.mdx': 'ghcr.io/scalar-labs/scalardb-cluster-schema-loader:3.17.0',
    'jar.mdx': 'scalardb-cluster-schema-loader-3.17.0-all.jar',
    'javadoc.mdx': 'https://javadoc.io/doc/com.scalar-labs/scalardb-sql/3.17.0/index.html',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, '3.17.0');
});

test('within-minor drift (3.17.1 + 3.17.2) -> ambiguous error', async (t) => {
  const root = await makeTree(t, {
    'a.mdx': 'com.scalar-labs:scalardb:3.17.1',
    'b.mdx': 'com.scalar-labs:scalardb:3.17.2',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, undefined);
  assert.ok(result.error);
  assert.match(result.error, /Ambiguous --from/);
  assert.match(result.error, /3\.17\.1/);
  assert.match(result.error, /3\.17\.2/);
  assert.match(result.error, /Pass --from explicitly/);
});

test('cross-minor drift (3.17.5 + 3.18.0) -> ambiguous error (new behavior)', async (t) => {
  const root = await makeTree(t, {
    'a.mdx': 'com.scalar-labs:scalardb:3.17.5',
    'b.mdx': 'ghcr.io/scalar-labs/scalardb-cluster-schema-loader:3.18.0',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, undefined);
  assert.ok(result.error);
  assert.match(result.error, /Ambiguous --from/);
  assert.match(result.error, /3\.17\.5/);
  assert.match(result.error, /3\.18\.0/);
});

test('empty tree (no anchored refs) -> version: null, no error', async (t) => {
  const root = await makeTree(t, {
    'README.md': 'Welcome to the docs. Nothing versioned here.',
    'sub/other.mdx': 'Some prose without any coordinates.',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, null);
  assert.equal(result.error, undefined);
});

test('bare X.Y.Z in prose is not picked up (only anchored patterns)', async (t) => {
  const root = await makeTree(t, {
    'prose.mdx': 'This example uses version 3.17.0 for illustration.',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, null);
});

test('nested subdirectories are walked', async (t) => {
  const root = await makeTree(t, {
    'top/a/b/c/deep.mdx': 'com.scalar-labs:scalardb:3.17.4',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, '3.17.4');
});

test('analytics-spark P9 coord counts as an anchored ref', async (t) => {
  const root = await makeTree(t, {
    'analytics.mdx': 'com.scalar-labs:scalardb-analytics-spark-all-3.5_2.12:3.17.0',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.equal(result.version, '3.17.0');
});

test('multiple minors across analytics + core coords -> ambiguous', async (t) => {
  const root = await makeTree(t, {
    'core.mdx': 'com.scalar-labs:scalardb:3.17.0',
    'analytics.mdx': 'com.scalar-labs:scalardb-analytics-spark-all-3.5_2.12:3.18.0',
  });
  const result = await deriveFromInternal(root, scalardbConfig);
  assert.ok(result.error);
  assert.match(result.error, /3\.17\.0/);
  assert.match(result.error, /3\.18\.0/);
});
