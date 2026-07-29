// Anchored pattern matcher for bump-doc-versions.
//
// Implements P1–P11 from the version-bump-automation design doc §4.1.
// Each match carries { pattern, offset, length, oldStr, oldVer, line } so the caller can
// apply substitutions in reverse offset order.
//
// Scope guard: for every pattern except P11, only rewrites where matched X.Y === source-minor.
// P10 / P11 file-level gate: only rewrites a bare X.Y.Z / X.Y if the same file also contains
// a concrete P1–P9 same-minor match, a placeholder-style anchor, or has minor-density ≥ 3
// (per design §6.1.4, which supersedes the tighter same-line wording in §4.1).

const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds anchored scanners P1, P3–P9 from a product config.
 * Each scanner is { name, regex } where the regex captures (X.Y) in group 1 and (Z) in group 2.
 * P2, P10, and P11 are handled separately because they need context
 * (proximity / file-level gate / cross-minor guard).
 */
export function buildScanners(config) {
  const mavenGroup = (config.mavenArtifacts || []).length
    ? `(?:${config.mavenArtifacts.map(escRx).join('|')})`
    : null;
  const ghcrGroup = (config.ghcrImages || []).length
    ? `(?:${config.ghcrImages.map(escRx).join('|')})`
    : null;
  const releaseGroup = (config.releaseRepos || []).length
    ? `(?:${config.releaseRepos.map(escRx).join('|')})`
    : null;
  const jarGroup = (config.jarBases || []).length
    ? `(?:${config.jarBases.map(escRx).join('|')})`
    : null;
  const envGroup = (config.envVarPrefixes || []).length
    ? `(?:${config.envVarPrefixes.map(escRx).join('|')})`
    : null;

  const scanners = [];

  if (mavenGroup) {
    // P1: com.scalar-labs:ARTIFACT:X.Y.Z
    scanners.push({
      name: 'P1',
      regex: new RegExp(`com\\.scalar-labs:${mavenGroup}:(\\d+\\.\\d+)\\.(\\d+)`, 'g'),
    });
    // P6: javadoc.io/doc/com.scalar-labs/ARTIFACT/X.Y.Z/
    scanners.push({
      name: 'P6',
      regex: new RegExp(`javadoc\\.io/doc/com\\.scalar-labs/${mavenGroup}/(\\d+\\.\\d+)\\.(\\d+)/`, 'g'),
    });
  }
  if (ghcrGroup) {
    // P3: ghcr.io/scalar-labs/IMAGE:X.Y.Z
    scanners.push({
      name: 'P3',
      regex: new RegExp(`ghcr\\.io/scalar-labs/${ghcrGroup}:(\\d+\\.\\d+)\\.(\\d+)`, 'g'),
    });
  }
  if (releaseGroup) {
    // P4: github.com/scalar-labs/REPO/releases/tag/vX.Y.Z
    scanners.push({
      name: 'P4',
      regex: new RegExp(`github\\.com/scalar-labs/${releaseGroup}/releases/tag/v(\\d+\\.\\d+)\\.(\\d+)`, 'g'),
    });
    // P5: github.com/scalar-labs/REPO/releases/download/vX.Y.Z
    scanners.push({
      name: 'P5',
      regex: new RegExp(`github\\.com/scalar-labs/${releaseGroup}/releases/download/v(\\d+\\.\\d+)\\.(\\d+)`, 'g'),
    });
  }
  if (jarGroup) {
    // P7: JARBASE-X.Y.Z(-all)?.jar
    scanners.push({
      name: 'P7',
      regex: new RegExp(`${jarGroup}-(\\d+\\.\\d+)\\.(\\d+)(?:-all)?\\.jar`, 'g'),
    });
  }
  if (envGroup) {
    // P8: ENVVAR=X.Y.Z
    scanners.push({
      name: 'P8',
      regex: new RegExp(`${envGroup}=(\\d+\\.\\d+)\\.(\\d+)`, 'g'),
    });
  }

  // P9: analytics-spark trailing version. The `-{SPARK}_{SCALA}` segment
  // between the artifact and the trailing X.Y.Z is intentionally *not* captured
  // — only the coord's trailing version is a rewrite target. This is a static
  // scanner (like P2) because there's exactly one artifact family in this shape
  // (`scalardb-analytics-spark-all`); a new one would call for a config field.
  scanners.push({
    name: 'P9',
    regex: /com\.scalar-labs:scalardb-analytics-spark-all-\d+\.\d+_\d+\.\d+:(\d+\.\d+)\.(\d+)/g,
  });

  return scanners;
}

// P2: <version>X.Y.Z</version> gated by a <groupId>com.scalar-labs</groupId>
// occurring within `proximityLines` lines before the match.
const P2_REGEX = /<version>(\d+\.\d+)\.(\d+)<\/version>/g;
const P2_GROUP_ID_REGEX = /<groupId>\s*com\.scalar-labs\s*<\/groupId>/;

function hasNearbyScalarLabsGroupId(content, offset, proximityLines) {
  const before = content.slice(0, offset);
  const lines = before.split('\n');
  const start = Math.max(0, lines.length - proximityLines - 1);
  for (let i = start; i < lines.length; i++) {
    if (P2_GROUP_ID_REGEX.test(lines[i])) return true;
  }
  return false;
}

function scanP2(content, minor, proximityLines = 6) {
  const matches = [];
  P2_REGEX.lastIndex = 0;
  let m;
  while ((m = P2_REGEX.exec(content)) !== null) {
    const xy = m[1];
    const z = m[2];
    if (xy !== minor) continue;
    if (!hasNearbyScalarLabsGroupId(content, m.index, proximityLines)) continue;
    matches.push({
      pattern: 'P2',
      offset: m.index,
      length: m[0].length,
      oldStr: m[0],
      oldVer: `${xy}.${z}`,
    });
  }
  return matches;
}

function scanP10(content, minor) {
  // Bare X.Y.Z where X.Y === minor. Word-boundary–anchored so `3.17.30` doesn't collapse to `3.17.3`.
  const rx = new RegExp(`(?<![\\d.])${escRx(minor)}\\.(\\d+)(?![\\d.])`, 'g');
  const matches = [];
  let m;
  while ((m = rx.exec(content)) !== null) {
    matches.push({
      pattern: 'P10',
      offset: m.index,
      length: m[0].length,
      oldStr: m[0],
      oldVer: `${minor}.${m[1]}`,
    });
  }
  return matches;
}

// P11: bare X.Y (no patch component). Fires only on cross-minor bumps —
// on same-minor patch bumps the source and target X.Y are equal, so any
// rewrite would be a no-op. The replacement is the target X.Y (e.g. "3.19"),
// not the full X.Y.Z of --to, so we mark these matches with an explicit
// `newVerOverride` for the substitution step to use.
function scanP11(content, sourceMinor, targetMinor) {
  if (sourceMinor === targetMinor) return [];
  const rx = new RegExp(`(?<![\\d.])${escRx(sourceMinor)}(?![\\d.])`, 'g');
  const matches = [];
  let m;
  while ((m = rx.exec(content)) !== null) {
    matches.push({
      pattern: 'P11',
      offset: m.index,
      length: m[0].length,
      oldStr: m[0],
      oldVer: sourceMinor,
      newVerOverride: targetMinor,
    });
  }
  return matches;
}

// Detects Scalar-specific "placeholder-style" anchors — Maven coords, Docker
// tags, Javadoc URLs, etc. where the version segment is a `<UPPER_CASE_VAR>`
// placeholder instead of a concrete X.Y.Z. Used solely to gate P10 (prose
// enumeration) in tutorial / template files that use placeholders in code
// blocks and rely on prose like ``for example, `3.17.0` `` to convey the
// version. Never used to drive rewrites directly.
const PLACEHOLDER_ANCHOR_REGEXES = [
  // Maven coordinate: com.scalar-labs:<artifact>:<PLACEHOLDER>
  /com\.scalar-labs:[^:\s'"`)]+:<[A-Z][A-Z0-9_]*>/,
  // Docker image with placeholder tag: ghcr.io/scalar-labs/<image>:<PLACEHOLDER>
  /ghcr\.io\/scalar-labs\/[^:\s'"`)]+:<[A-Z][A-Z0-9_]*>/,
  // Javadoc URL with placeholder version: javadoc.io/doc/com.scalar-labs/<artifact>/<PLACEHOLDER>
  /javadoc\.io\/doc\/com\.scalar-labs\/[^/\s'"`)]+\/<[A-Z][A-Z0-9_]*>/,
  // JAR filename with placeholder version: scalardb-…-<PLACEHOLDER>[-all].jar
  /(?:scalardb|scalardl)-[^\s'"`)]*<[A-Z][A-Z0-9_]*>[^\s'"`)]*\.jar/,
  // GitHub release URL with placeholder version
  /github\.com\/scalar-labs\/[^/\s]+\/releases\/(?:tag|download)\/v?<[A-Z][A-Z0-9_]*>/,
  // Shell env-var assignment with placeholder value
  /SCALAR_(?:DB|DL)(?:_CLUSTER)?_VERSION=<[A-Z][A-Z0-9_]*>/,
];

function hasPlaceholderAnchor(content) {
  return PLACEHOLDER_ANCHOR_REGEXES.some((rx) => rx.test(content));
}

// Third gate branch: files that are clearly "about" a specific minor even
// though they contain no anchored (P1–P9) or placeholder patterns —
// e.g., compatibility matrices, requirements pages, migration guides.
// If the file mentions the source minor ≥ MIN_MINOR_DENSITY times (in any
// form — bare X.Y, X.Y.Z, or X.Y.Z-suffix), we consider it version-dense
// enough that P10 / P11 should examine it.
const MIN_MINOR_DENSITY = 3;

function hasMinorDensity(content, minor) {
  const rx = new RegExp(`(?<![\\d.])${escRx(minor)}(?:\\.\\d+)?(?![\\d.])`, 'g');
  let count = 0;
  let m;
  while ((m = rx.exec(content)) !== null) {
    if (++count >= MIN_MINOR_DENSITY) return true;
  }
  return false;
}

// Markdown table rows (start and end with `|`, allowing whitespace and
// optional leading indentation) are treated as structural and excluded
// from all pattern rewrites. Adding a new row for a new minor is a
// human/structural task; the tool must not rewrite the existing rows.
const TABLE_ROW_REGEX = /^\s*\|.*\|\s*$/;

function collectTableRowLines(content) {
  const table = new Set();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (TABLE_ROW_REGEX.test(lines[i])) table.add(i + 1); // 1-based
  }
  return table;
}

// Section-scoped skip: everything between `<!-- version-bump: skip-section -->`
// (inclusive) and the matching `<!-- version-bump: end-skip-section -->`
// (inclusive) is excluded from all pattern rewrites. Used as an escape hatch
// when the table-row heuristic gets the wrong verdict or when a stretch of
// non-table content must be left untouched.
function collectSkipSectionLines(content) {
  const skipped = new Set();
  const lines = content.split('\n');
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (!inSection && lines[i].includes('<!-- version-bump: skip-section -->')) {
      inSection = true;
    }
    if (inSection) skipped.add(i + 1); // 1-based
    if (inSection && lines[i].includes('<!-- version-bump: end-skip-section -->')) {
      inSection = false;
    }
  }
  return skipped;
}

/**
 * Match all patterns in a file's content for the given source/target minor pair.
 * Returns { matches: [{pattern, offset, length, oldStr, oldVer, line, newVerOverride?}], skipped }
 * Applies file-level, per-line, section, and table-row skip logic.
 *
 * For same-minor patch bumps, sourceMinor === targetMinor (P11 becomes a no-op).
 * For cross-minor (minor/major) bumps, sourceMinor !== targetMinor and P11
 * rewrites bare X.Y references from source to target.
 */
export function matchFile(content, sourceMinor, targetMinor, config) {
  // File-level skip
  if (content.includes('<!-- version-bump: skip-file -->')) {
    return { matches: [], skipped: 'skip-file' };
  }

  // Collect P1 and P3–P9 matches (P2 handled separately below)
  const scanners = buildScanners(config);
  const raw = [];
  for (const s of scanners) {
    s.regex.lastIndex = 0;
    let m;
    while ((m = s.regex.exec(content)) !== null) {
      const xy = m[1];
      const z = m[2];
      if (xy !== sourceMinor) continue;
      raw.push({
        pattern: s.name,
        offset: m.index,
        length: m[0].length,
        oldStr: m[0],
        oldVer: `${xy}.${z}`,
      });
    }
  }
  raw.push(...scanP2(content, sourceMinor));

  // Gate P10 (and P11) on the file being "about" the source minor. Three
  // sufficient signals; any one is enough:
  //   (a) at least one P1–P9 same-minor match (a concrete anchored ref), or
  //   (b) at least one placeholder-style anchor like `com.scalar-labs:foo:<VERSION>`
  //       (tutorial / template files that convey the version through prose only),
  //   (c) minor-density signal: source-minor mentioned in the file ≥ N times
  //       (matrix pages, requirements pages, migration guides — high-signal
  //       files that lack coordinates but are clearly version-specific).
  // The scope-guards on P10 (X.Y === source-minor) and P11 (bare X.Y ===
  // source-minor, cross-minor only) still restrict what actually gets rewritten,
  // so a lenient gate only affects _which files_ are examined.
  const gateOpen =
    raw.length > 0 ||
    hasPlaceholderAnchor(content) ||
    hasMinorDensity(content, sourceMinor);

  if (gateOpen) {
    const p10 = scanP10(content, sourceMinor);
    // Exclude P10 matches that overlap with any P1–P9 match (avoids double-counting
    // the bare X.Y.Z that lives inside an anchored URL / coordinate / etc.)
    const covered = intervals(raw);
    for (const m of p10) {
      if (!overlapsAny(m.offset, m.offset + m.length, covered)) {
        raw.push(m);
      }
    }
    // P11 (bare X.Y) — cross-minor bumps only. Exclude matches that overlap
    // any previously collected match (X.Y is a prefix of X.Y.Z, so we must
    // avoid double-counting the "3.17" that lives inside "3.17.2").
    const p11 = scanP11(content, sourceMinor, targetMinor);
    const coveredWithP10 = intervals(raw);
    for (const m of p11) {
      if (!overlapsAny(m.offset, m.offset + m.length, coveredWithP10)) {
        raw.push(m);
      }
    }
  }

  // Attach line numbers (1-based) and apply skip logic: per-line marker,
  // section markers, and the Markdown-table-row heuristic.
  const lineStarts = computeLineStarts(content);
  const skipLines = collectSkipLines(content);
  const skipSectionLines = collectSkipSectionLines(content);
  const tableRowLines = collectTableRowLines(content);

  const kept = [];
  for (const m of raw) {
    const line = binarySearchLine(lineStarts, m.offset);
    if (skipLines.has(line)) continue;
    if (skipSectionLines.has(line)) continue;
    if (tableRowLines.has(line)) continue;
    kept.push({ ...m, line });
  }

  kept.sort((a, b) => a.offset - b.offset);
  return { matches: kept, skipped: null };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function intervals(matches) {
  // Sorted [start, end) list, coalesced
  const sorted = matches.map((m) => [m.offset, m.offset + m.length]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    if (out.length && s <= out[out.length - 1][1]) {
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

function overlapsAny(start, end, intervalsList) {
  // Binary search first interval whose end > start
  let lo = 0;
  let hi = intervalsList.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (intervalsList[mid][1] <= start) lo = mid + 1;
    else hi = mid;
  }
  return lo < intervalsList.length && intervalsList[lo][0] < end;
}

function computeLineStarts(content) {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function binarySearchLine(starts, offset) {
  // 1-based line number
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function collectSkipLines(content) {
  // A `<!-- version-bump: skip -->` on line N skips matches on line N+1.
  const skip = new Set();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<!-- version-bump: skip -->')) {
      skip.add(i + 2); // 1-based line after
    }
  }
  return skip;
}
