# 🔢 Bump doc versions

Anchored, scope-limited version-string bumper for the ScalarDB and ScalarDL docs. Rewrites Maven/Gradle coordinates, Docker image tags, Javadoc URLs, GitHub release-tag URLs, JAR filenames, and shell env vars — never a bare `X.Y.Z` search.

Ships as a **Node script** (runnable locally) and a **reusable workflow** callable from either the internal source-of-truth repo (`docs-internal-*`) or the public docs-site repo (`docs-*`).

## 📁 Layout

```
bump-doc-versions/
├── bump-doc-versions.mjs         # main CLI
├── build-pr-body.mjs             # renders a PR body from the JSON report
├── detect-classname-diff.mjs     # parses className diffs (used by the public caller)
├── lib/
│   ├── patterns.mjs              # P1–P10 anchored pattern engine
│   ├── scope.mjs                 # file walker + .version-bump-ignore
│   └── docusaurus-config.mjs     # className read/write for docusaurus.config.js
├── products/
│   ├── scalardb.json             # ScalarDB artifact allowlists
│   └── scalardl.json             # ScalarDL artifact allowlists
├── sample-usage.yaml             # example caller workflows for each repo
└── README.md
```

## 🧰 Local usage

Requires Node.js 20+. No `npm install` needed — the script is zero-dependency.

```bash
node bump-doc-versions/bump-doc-versions.mjs \
  --product scalardb \
  --repo    internal \
  --minor   3.17 \
  --to      3.17.4 \
  [--from   3.17.3] \
  [--root   /path/to/docs-internal-scalardb] \
  [--dry-run] \
  [--json-report /tmp/report.json]
```

### Flags

| Flag | Required | Description |
|---|---|---|
| `--product` | yes | `scalardb` or `scalardl`. Selects the product config file under `products/`. |
| `--repo` | yes | `internal` or `public`. Selects the file-scope map (see below). |
| `--minor` | yes | `3.17`, `3.18`, …, or `current` (only valid with `--repo public`). |
| `--to` | yes | New patch version to bump to (e.g., `3.18.2`). Must satisfy `X.Y === --minor` (or `X.Y === current-minor` when `--minor current`). |
| `--from` | no | Current patch version to bump from (e.g., `3.18.1`). Auto-detected from `className` (in the docs site config) or the first anchored match under `docs/en-us/**` (in the internal repo) when omitted. Errors out if the auto-detection is ambiguous. |
| `--root` | no | Root of the target repo. Defaults to `.`. |
| `--dry-run` | no | Do not write files or update `className`. Report only. |
| `--json-report <path>` | no | Write a machine-readable report to `<path>`. |
| `--help` | no | Print usage. |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. Files were written (or a dry-run rendered a non-empty report). |
| `2` | No changes needed (idempotent no-op). |
| `3` | Validation error — bad flags, mismatched `--from`, ambiguous derivation, etc. |
| `1` | Unexpected error. |

### File-scope map

`--repo` selects which side of the ScalarDB/ScalarDL docs pipeline the script is targeting:

- **`internal`** — the source-of-truth repo (`docs-internal-scalardb`, `docs-internal-scalardl`). One branch per minor version (`3.14`, `3.15`, …, `3.18`). Both English and Japanese docs live side-by-side under `docs/en-us/**` and `docs/ja-jp/**` on the same branch. Bump PRs are opened against the version branch itself.
- **`public`** — the Docusaurus docs-site repo (`docs-scalardb`, `docs-scalardl`). Single `main` branch containing every version. The `current` minor lives under `docs/**`; older minors live under `versioned_docs/version-<minor>/**`. Japanese translations are mirrored under `i18n/versioned_docs/ja-jp/**`. The `className` field in `docusaurus.config.js` is the source of truth for "current patch of each minor".

| `--repo` | `--minor` | Scope walked |
|---|---|---|
| `internal` | `3.17` | `docs/en-us/**`, `docs/ja-jp/**` |
| `public` | `3.17` (non-current) | `versioned_docs/version-3.17/**`, `i18n/versioned_docs/ja-jp/docusaurus-plugin-content-docs/version-3.17/**` |
| `public` | `current` | `docs/**`, `i18n/versioned_docs/ja-jp/docusaurus-plugin-content-docs/current/**`, plus the `className` field of the `current` entry in `docusaurus.config.js` |

### Anchored patterns

All ten patterns are enumerated in the design doc. In short:

| ID | What it matches | Example |
|---|---|---|
| `P1` | Maven/Gradle coordinate | `com.scalar-labs:scalardb-cluster-java-client-sdk:3.17.2` |
| `P2` | `<version>X.Y.Z</version>` (with `com.scalar-labs` nearby) | inside a `<dependency>` block |
| `P3` | Docker image tag | `ghcr.io/scalar-labs/scalardb-cluster-schema-loader:3.17.2` |
| `P4` | Release tag URL | `github.com/scalar-labs/scalardb/releases/tag/v3.17.2` |
| `P5` | Release download URL | `github.com/scalar-labs/scalardb/releases/download/v3.17.2/…` |
| `P6` | Javadoc URL | `javadoc.io/doc/com.scalar-labs/scalardb-sql/3.17.2/…` |
| `P7` | JAR filename | `scalardb-cluster-schema-loader-3.17.2-all.jar` |
| `P8` | Shell env-var assignment | `SCALAR_DB_CLUSTER_VERSION=3.17.2` |
| `P9` | Analytics Spark trailing version | `com.scalar-labs:scalardb-analytics-spark-all-3.5_2.12:3.17.2` (via `mavenArtifactsRegex`) |
| `P10` | Bare `X.Y.Z` in prose | `"ScalarDB 3.16.5, 3.17.3, or 3.18.0"` — gated on the file having at least one P1–P9 same-minor match |

**Scope guard:** for every pattern except P10, only occurrences where `X.Y === --minor` are rewritten. On the `3.17` branch, `3.16.5` and `3.18.0` in a prose line are left alone.

### Ignore markers

Three mechanisms, applied in this order:

1. **Baked-in path exclusions** — `helm-charts/**`, `scalar-kubernetes/**`, `node_modules/**`, `.git/**`, `build/**`, `dist/**`.
2. **Repo-level `.version-bump-ignore`** — gitignore-syntax glob list at the repo root.
3. **In-file markers:**
   - `<!-- version-bump: skip-file -->` anywhere in a file → the whole file is skipped.
   - `<!-- version-bump: skip -->` on a line → the following line is skipped.

### Product configuration

The set of Maven artifacts, Docker images, release repos, JAR bases, and env-var prefixes that count as "ScalarDB" or "ScalarDL" is defined in `products/<product>.json`. Adding a new artifact requires a PR to this repo — this is deliberate: the tool should never silently rewrite something it doesn't understand.

## 🤖 GitHub Actions usage

The reusable workflow lives at [`.github/workflows/bump-doc-versions-reusable.yaml`](../.github/workflows/bump-doc-versions-reusable.yaml).

See [`sample-usage.yaml`](./sample-usage.yaml) for ready-to-copy caller workflows:

- **Internal repo caller** — `docs-internal-scalardb/.github/workflows/bump-doc-versions.yml`. Accepts a `repository_dispatch` from the public repo, or a manual `workflow_dispatch`, and runs the reusable workflow against the matching version branch.
- **Public repo caller** — `docs-scalardb/.github/workflows/trigger-version-bump.yml`. Detects a `className` change in `docusaurus.config.js` on push to `main`, extracts `(minor, from, to)`, `repository_dispatch`es into the internal repo, and runs a safety-net bump on the public repo itself.

### Tokens

The reusable workflow accepts one secret, `github_token`, with the following required permissions on the caller repo:

- `contents: write` — to push the bump commit.
- `pull-requests: write` — to open or update the PR.

For **same-repo operations** (the internal caller pushing a bump PR to its own repo), the built-in `GITHUB_TOKEN` is sufficient — pass it via `secrets: inherit` or `github_token: ${{ secrets.GITHUB_TOKEN }}`.

For the **cross-repo `repository_dispatch`** in the public-repo caller, a personal access token (or GitHub App installation token) with `contents: write` on the target internal repo is required. Store it as `BUMP_DISPATCH_PAT` in the public repo's secrets. See `sample-usage.yaml` for the exact usage.

## 🧪 Testing

A safe way to test against a branch of `docs-internal-scalardb` without committing to it:

```bash
# Set up an isolated worktree for the 3.17 branch
git -C /path/to/docs-internal-scalardb worktree add /tmp/dis-3.17 origin/3.17

# Dry-run against it
node bump-doc-versions/bump-doc-versions.mjs \
  --product scalardb \
  --repo    internal \
  --minor   3.17 \
  --from    3.17.2 \
  --to      3.17.99 \
  --dry-run \
  --root    /tmp/dis-3.17 \
  --json-report /tmp/dis-3.17-report.json

# Inspect the report
jq '.totals, .byPattern' /tmp/dis-3.17-report.json

# Clean up
git -C /path/to/docs-internal-scalardb worktree remove /tmp/dis-3.17
```
