// Anchored pattern matcher for bump-doc-versions.
//
// Implements P1–P10 from the version-bump-automation design doc §4.1.
// Each match carries { pattern, offset, length, oldStr, oldVer, line } so the caller can
// apply substitutions in reverse offset order.
//
// Scope guard: for every pattern except P10, only rewrites where matched X.Y === --minor.
// P10 gate: only rewrites bare X.Y.Z if the same file also contains a P1–P9 same-minor match
// (per design §6.1.4, which supersedes the tighter same-line wording in §4.1).

const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds anchored scanners P1, P3, P4, P5, P6, P7, P8 from a product config.
 * Each scanner is { name, regex } where the regex captures (X.Y) in group 1 and (Z) in group 2.
 * P2 and P10 are handled separately because they need context (proximity / file-level gate).
 */
export function buildScanners(config) {
  const mavenParts = [
    ...(config.mavenArtifacts || []).map(escRx),
    ...(config.mavenArtifactsRegex || []), // already regex
  ];
  const mavenGroup = mavenParts.length ? `(?:${mavenParts.join('|')})` : null;
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

/**
 * Match all patterns in a file's content for the given minor.
 * Returns { matches: [{pattern, offset, length, oldStr, oldVer, line}], skipped }
 * Applies file-level and per-line skip markers.
 */
export function matchFile(content, minor, config) {
  // File-level skip
  if (content.includes('<!-- version-bump: skip-file -->')) {
    return { matches: [], skipped: 'skip-file' };
  }

  // Collect P1–P9 matches (P2 handled separately)
  const scanners = buildScanners(config);
  const raw = [];
  for (const s of scanners) {
    s.regex.lastIndex = 0;
    let m;
    while ((m = s.regex.exec(content)) !== null) {
      const xy = m[1];
      const z = m[2];
      if (xy !== minor) continue;
      raw.push({
        pattern: s.name,
        offset: m.index,
        length: m[0].length,
        oldStr: m[0],
        oldVer: `${xy}.${z}`,
      });
    }
  }
  raw.push(...scanP2(content, minor));

  // Gate P10 on having at least one P1–P9 same-minor match in the file
  if (raw.length > 0) {
    const p10 = scanP10(content, minor);
    // Exclude P10 matches that overlap with any P1–P9 match (avoids double-counting
    // the bare X.Y.Z that lives inside an anchored URL / coordinate / etc.)
    const covered = intervals(raw);
    for (const m of p10) {
      if (!overlapsAny(m.offset, m.offset + m.length, covered)) {
        raw.push(m);
      }
    }
  }

  // Attach line numbers (1-based) and apply per-line skip markers.
  const lineStarts = computeLineStarts(content);
  const skipLines = collectSkipLines(content);

  const kept = [];
  for (const m of raw) {
    const line = binarySearchLine(lineStarts, m.offset);
    if (skipLines.has(line)) continue;
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
