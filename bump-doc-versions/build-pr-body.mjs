#!/usr/bin/env node
// Build a Markdown PR body from a bump-doc-versions JSON report.
// Emits the design §8 body verbatim for internal-repo PRs and a shorter one
// for public-repo safety-net PRs.

import { promises as fs } from 'node:fs';
import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({
    options: {
      report: { type: 'string' },
      out:    { type: 'string' },
      style:  { type: 'string', default: 'internal' }, // internal | public-safety-net
    },
  });
  if (!values.report || !values.out) {
    console.error('Usage: build-pr-body.mjs --report <json> --out <md> [--style internal|public-safety-net]');
    process.exit(2);
  }

  const report = JSON.parse(await fs.readFile(values.report, 'utf8'));
  const body =
    values.style === 'public-safety-net'
      ? renderSafetyNet(report)
      : renderInternal(report);
  await fs.writeFile(values.out, body, 'utf8');
}

function renderInternal(r) {
  return `## Description

This PR updates documentation references throughout the ${r.product === 'scalardb' ? 'ScalarDB' : 'ScalarDL'} \`${r.minor}\` docs to use version \`${r.to}\` instead of \`${r.from}\`. The changes ensure that all code snippets, dependency instructions, download links, Docker image tags, and Javadoc URLs point to the latest release.

## Related issues and/or PRs

N/A

## Changes made

- Changed the patch version to the latest version (\`${r.from}\` → \`${r.to}\`).

## Checklist

- [x] I have updated the Japanese version of this documentation.
- [x] I have updated all applicable versions of the documentation.
- [ ] I have checked that my documentation looks as expected on a locally built version of the docs site.
- [x] Any remaining open issues linked to this PR are documented and up-to-date.
- [x] Any dependent changes in other PRs have been merged and published.

## Additional notes

Opened automatically by [\`bump-doc-versions\`](https://github.com/josh-wong/actions/tree/main/bump-doc-versions) in response to a \`className\` update on \`main\` of the public docs repo.

${renderVerification(r)}
`;
}

function renderSafetyNet(r) {
  return `## Description

Safety-net patch-version bump opened automatically after a \`className\` change on \`main\`. This covers files in the public repo that don't sync from the internal repo. If the internal-repo sync PR arrives first, this bot will notice the no-op and skip re-opening.

## Changes made

- Changed the patch version to the latest version (\`${r.from}\` → \`${r.to}\`).

${renderVerification(r)}
`;
}

function renderVerification(r) {
  const lines = [];
  lines.push('## Verification report');
  lines.push('');
  lines.push(`- **Product:** \`${r.product}\``);
  lines.push(`- **Repo scope:** \`${r.repo}\``);
  lines.push(`- **Minor:** \`${r.minor}\`${r.minorRequested && r.minorRequested !== r.minor ? ` (requested: \`${r.minorRequested}\`)` : ''}`);
  lines.push(`- **From → To:** \`${r.from}\` → \`${r.to}\``);
  lines.push(`- **Dry run:** ${r.dryRun ? 'yes' : 'no'}`);
  lines.push(`- **Files changed:** ${r.totals.files}`);
  lines.push(`- **Total replacements:** ${r.totals.replacements}`);
  if (r.classNameUpdated?.changed) {
    lines.push(`- **\`className\` updated:** \`${r.classNameUpdated.from}\` → \`${r.classNameUpdated.to}\``);
  }
  lines.push('');
  if (Object.keys(r.byPattern || {}).length) {
    lines.push('### By pattern');
    lines.push('');
    lines.push('| Pattern | Count |');
    lines.push('|---|---|');
    for (const [p, c] of Object.entries(r.byPattern).sort()) {
      lines.push(`| \`${p}\` | ${c} |`);
    }
    lines.push('');
  }
  if ((r.byFile || []).length) {
    lines.push('<details>');
    lines.push('<summary>Files changed (' + r.byFile.length + ')</summary>');
    lines.push('');
    lines.push('| File | Replacements | Patterns |');
    lines.push('|---|---|---|');
    for (const f of r.byFile) {
      const pats = Object.entries(f.patterns).sort().map(([p, c]) => `${p}×${c}`).join(', ');
      lines.push(`| \`${f.path}\` | ${f.replacements} | ${pats} |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  if ((r.skippedFiles || []).length) {
    lines.push('<details>');
    lines.push('<summary>Skipped files (' + r.skippedFiles.length + ')</summary>');
    lines.push('');
    for (const s of r.skippedFiles) {
      lines.push(`- \`${s.path}\` — ${s.reason}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  if ((r.unknownArtifactsSeen || []).length) {
    lines.push('> :warning: Unknown artifacts observed (add to the product config if legitimate): ' + r.unknownArtifactsSeen.map((a) => `\`${a}\``).join(', '));
    lines.push('');
  }
  return lines.join('\n');
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
