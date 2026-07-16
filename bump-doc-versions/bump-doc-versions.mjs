#!/usr/bin/env node
// bump-doc-versions — anchored, scope-limited version-string bumper for ScalarDB
// and ScalarDL docs. See the version-bump-automation design doc for the full
// specification.
//
// Exit codes:
//   0  success — writes done (or dry-run rendered a non-empty report)
//   2  no changes needed (idempotent no-op)
//   3  validation error (bad flags, mismatched --from, etc.)
//   1  unexpected error

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { matchFile, buildScanners } from './lib/patterns.mjs';
import { getFileScope, loadIgnoreFile, walkScope } from './lib/scope.mjs';
import {
  getClassNameFor,
  getCurrentMinor,
  updateClassName,
} from './lib/docusaurus-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { values } = parseArgs({
    options: {
      product:       { type: 'string' },
      repo:          { type: 'string' },
      minor:         { type: 'string' },
      to:            { type: 'string' },
      from:          { type: 'string' },
      root:          { type: 'string', default: '.' },
      'dry-run':     { type: 'boolean', default: false },
      'json-report': { type: 'string' },
      help:          { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  // ── Validate required flags ───────────────────────────────────────────────
  const missing = ['product', 'repo', 'minor', 'to'].filter((k) => !values[k]);
  if (missing.length) {
    fail(3, `Missing required flag(s): ${missing.map((m) => `--${m}`).join(', ')}`);
  }
  if (!['scalardb', 'scalardl'].includes(values.product)) {
    fail(3, `--product must be scalardb or scalardl (got: ${values.product})`);
  }
  if (!['internal', 'public'].includes(values.repo)) {
    fail(3, `--repo must be internal or public (got: ${values.repo})`);
  }
  const toParts = values.to.split('.');
  if (toParts.length !== 3 || !toParts.every((p) => /^\d+$/.test(p))) {
    fail(3, `--to must be X.Y.Z (got: ${values.to})`);
  }

  const root = path.resolve(values.root);
  const cfgPath = path.join(__dirname, 'products', `${values.product}.json`);
  const config = JSON.parse(await fs.readFile(cfgPath, 'utf8'));

  // ── Resolve effectiveMinor (handles --minor current) ──────────────────────
  let effectiveMinor = values.minor;
  let publicCurrentMinor = null;
  let isCurrent = false;

  if (values.repo === 'public') {
    try {
      publicCurrentMinor = await getCurrentMinor(root);
    } catch (e) {
      fail(3, `Could not read docusaurus.config.js under ${root}: ${e.message}`);
    }
    if (!publicCurrentMinor) {
      fail(3, `Could not parse a 'current' className from docusaurus.config.js`);
    }
    if (values.minor === 'current') {
      effectiveMinor = publicCurrentMinor;
      isCurrent = true;
    } else {
      isCurrent = values.minor === publicCurrentMinor;
    }
  } else if (values.minor === 'current') {
    fail(3, `--minor current is only valid with --repo public`);
  }

  const toMinor = `${toParts[0]}.${toParts[1]}`;
  if (toMinor !== effectiveMinor) {
    fail(3, `--to ${values.to} has minor ${toMinor}, does not match --minor ${effectiveMinor}`);
  }

  // ── Derive --from if omitted ──────────────────────────────────────────────
  let fromVer = values.from;
  if (!fromVer) {
    if (values.repo === 'public') {
      fromVer = await getClassNameFor(root, values.minor);
      if (!fromVer) {
        fail(3, `Could not derive --from from className for entry ${values.minor}`);
      }
    } else {
      const derived = await deriveFromInternal(root, effectiveMinor, config);
      if (derived.error) fail(3, derived.error);
      fromVer = derived.version;
      if (!fromVer) {
        // Empty tree for this minor is a legitimate no-op — bail cleanly.
        console.log(
          `No anchored ${values.product} version references found under docs/en-us for minor ${effectiveMinor}; nothing to do.`,
        );
        await maybeWriteEmptyReport(values, effectiveMinor, null);
        process.exit(2);
      }
    }
  }

  const fromParts = fromVer.split('.');
  if (fromParts.length !== 3 || `${fromParts[0]}.${fromParts[1]}` !== effectiveMinor) {
    fail(3, `--from ${fromVer} does not belong to minor ${effectiveMinor}`);
  }
  if (fromVer === values.to) {
    console.log(`--from and --to are both ${fromVer}; nothing to do.`);
    await maybeWriteEmptyReport(values, effectiveMinor, fromVer);
    process.exit(2);
  }

  // ── Walk file scope ───────────────────────────────────────────────────────
  const scopePaths = getFileScope(values.repo, effectiveMinor, isCurrent);
  const ignoreMatcher = await loadIgnoreFile(root);

  const report = {
    product: values.product,
    repo: values.repo,
    minor: effectiveMinor,
    minorRequested: values.minor,
    from: fromVer,
    to: values.to,
    dryRun: values['dry-run'],
    scope: scopePaths,
    totals: { files: 0, replacements: 0 },
    byPattern: {},
    byFile: [],
    unknownArtifactsSeen: [], // reserved for a future pass
    skippedFiles: [],
    classNameUpdated: null,
  };

  for await (const abs of walkScope(root, scopePaths, ignoreMatcher)) {
    const content = await fs.readFile(abs, 'utf8');
    const { matches, skipped } = matchFile(content, effectiveMinor, config);
    const rel = path.relative(root, abs).split(path.sep).join('/');

    if (skipped) {
      report.skippedFiles.push({ path: rel, reason: skipped });
      continue;
    }
    if (matches.length === 0) continue;

    // Apply substitutions in reverse offset order so earlier offsets stay valid.
    let next = content;
    const patCounts = {};
    for (const m of matches.slice().reverse()) {
      const replacement = m.oldStr.replace(m.oldVer, values.to);
      next = next.slice(0, m.offset) + replacement + next.slice(m.offset + m.length);
      patCounts[m.pattern] = (patCounts[m.pattern] || 0) + 1;
    }

    for (const [p, c] of Object.entries(patCounts)) {
      report.byPattern[p] = (report.byPattern[p] || 0) + c;
      report.totals.replacements += c;
    }
    report.byFile.push({ path: rel, patterns: patCounts, replacements: matches.length });
    report.totals.files += 1;

    if (!values['dry-run'] && next !== content) {
      await fs.writeFile(abs, next, 'utf8');
    }
  }

  // ── Update className on the public repo, current-minor path ───────────────
  if (values.repo === 'public' && isCurrent) {
    // In the primary flow the human has already edited className. In the
    // safety-net / manual-dispatch path this may still need updating.
    const cnKey = values.minor === 'current' ? 'current' : effectiveMinor;
    const cn = await updateClassName(root, cnKey, values.to, values['dry-run']);
    report.classNameUpdated = cn;
    if (cn.changed) {
      report.byPattern.CLASSNAME = (report.byPattern.CLASSNAME || 0) + 1;
      report.byFile.push({
        path: 'docusaurus.config.js',
        patterns: { CLASSNAME: 1 },
        replacements: 1,
      });
      report.totals.files += 1;
      report.totals.replacements += 1;
    }
  }

  // ── Emit JSON report ─────────────────────────────────────────────────────
  if (values['json-report']) {
    await fs.writeFile(values['json-report'], JSON.stringify(report, null, 2), 'utf8');
  }

  // ── Console summary ──────────────────────────────────────────────────────
  const verb = values['dry-run'] ? 'Would bump' : 'Bumped';
  console.log(
    `${verb} ${fromVer} → ${values.to} in ${report.totals.files} file(s), ` +
      `${report.totals.replacements} replacement(s)`,
  );
  if (Object.keys(report.byPattern).length) {
    const brk = Object.entries(report.byPattern)
      .sort()
      .map(([p, c]) => `${p}=${c}`)
      .join(' ');
    console.log(`  by pattern: ${brk}`);
  }

  if (report.totals.replacements === 0) process.exit(2);
  process.exit(0);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function deriveFromInternal(root, minor, config) {
  const scanners = buildScanners(config);
  const seen = new Set();
  for await (const abs of walkScope(root, ['docs/en-us'], () => false)) {
    const content = await fs.readFile(abs, 'utf8');
    for (const s of scanners) {
      s.regex.lastIndex = 0;
      let m;
      while ((m = s.regex.exec(content)) !== null) {
        if (m[1] === minor) seen.add(`${m[1]}.${m[2]}`);
      }
    }
  }
  if (seen.size === 0) return { version: null };
  if (seen.size > 1) {
    return {
      error:
        `Ambiguous --from: multiple X.Y.Z values found under docs/en-us for minor ${minor}: ` +
        [...seen].sort().join(', ') +
        `. Pass --from explicitly.`,
    };
  }
  return { version: [...seen][0] };
}

async function maybeWriteEmptyReport(values, minor, fromVer) {
  if (!values['json-report']) return;
  const empty = {
    product: values.product,
    repo: values.repo,
    minor,
    minorRequested: values.minor,
    from: fromVer,
    to: values.to,
    dryRun: values['dry-run'],
    totals: { files: 0, replacements: 0 },
    byPattern: {},
    byFile: [],
    unknownArtifactsSeen: [],
    skippedFiles: [],
    classNameUpdated: null,
  };
  await fs.writeFile(values['json-report'], JSON.stringify(empty, null, 2), 'utf8');
}

function fail(code, msg) {
  console.error(`bump-doc-versions: ${msg}`);
  process.exit(code);
}

function printUsage() {
  process.stdout.write(`\
bump-doc-versions — bump anchored patch-version strings in ScalarDB / ScalarDL docs

Usage:
  bump-doc-versions \\
    --product scalardb|scalardl \\
    --repo    internal|public \\
    --minor   3.17|current \\
    --to      3.17.4 \\
    [--from   3.17.3] \\
    [--root   .] \\
    [--dry-run] \\
    [--json-report /tmp/report.json]

Exit codes:
  0  changes applied (or dry-run rendered a non-empty report)
  2  nothing to do (idempotent no-op)
  3  validation error
  1  unexpected error
`);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
