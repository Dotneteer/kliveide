# Releasing Klive

Changesets are `dev/changes/README.md` and `changesets-guide.md`. A release is two steps: prepare a PR
locally, then merge it. The pipeline was built from a plan closed on 2026-11-04 (git history:
`dev/plans/RELEASE_AUTOMATION_PLAN.md`); every release since v0.64.0 went through it. Its decisions,
which the scripts and workflows cite by number, are at the end of this file.

## Public release

1. On an up-to-date, clean `master`: `npm run change:status` (what will ship, which version) and
   `npm run release:prepare -- --dry-run` (the CHANGELOG section and the PR body, nothing written).
2. `npm run release:prepare`. It creates `release/v<x.y.z>`, writes the dated CHANGELOG section,
   deletes the consumed changesets, bumps `package.json` and the lockfile, runs every gate
   (`build:check`, `lint:renderer`, `test:fast`, `doc:build`, `doc:check`, `release:verify`),
   commits `Release v<x.y.z>`, pushes and opens the PR. `--version x.y.z` overrides the computed
   version; `--skip-tests` skips `test:fast` (re-runs only); `--no-push` stops after the commit.
   The slow test tier is **not** a gate: run `npm run test:slow` (or the manual "Slow tests"
   workflow) beforehand; `release:prepare` only warns when it has not passed on these sources.
   It runs locally on purpose: a PR opened by a workflow token would not trigger `test.yml`.
3. In the PR: edit **Highlights** in `CHANGELOG.md`, tick the checklist (competitive-analysis
   release note, README, screenshots). Optionally run **Release** (`release.yml`) with
   *dry_run* on the release branch: it builds the kits, checks the set and the notes, builds the
   would-be site, and publishes nothing (notes and checksums are kept as a workflow artifact).
4. Merge (squash keeps the title `Release v<x.y.z> (#n)`, which the workflow looks for). The
   **Release** workflow then runs verify -> build -> publish -> docs -> smoke: the tag and the
   published GitHub release (notes = the CHANGELOG section, six kits + `SHA256SUMS.txt`), a
   redeploy of kliveide.net, and a check that the live landing page links every kit.

Versions: `feature` -> minor, `fix` -> patch, `breaking` -> minor while 0.x. `package.json` holds
the last released version between releases (a pre-bumped version above the last tag is kept).
There are no pre-releases; `release:verify` rejects anything but `x.y.z`.

## When something fails

| Where | What it means | What to do |
|---|---|---|
| `release:prepare` preflight | dirty tree, not on master, behind origin, invalid changeset, tag exists | fix and re-run; nothing was written |
| a `release:prepare` gate | the release changes are on `release/v…`, uncommitted | fix on master in a normal PR; `git switch master && git branch -D release/v… && git checkout -- .`, re-run |
| workflow **verify** | the merged commit is not releasable (message lists why) | fix on master; re-run with *Run workflow* on master, *dry_run* off |
| workflow **build** | a kit failed to build; nothing is tagged or published | fix on master, then *Run workflow* on master, *dry_run* off. The fix carries **no changeset** (use the `no-changeset` label): verify rejects a pending one |
| workflow **publish** | a draft may exist | re-run the job: an existing draft is reused, a published release ends green |
| workflow **docs** / **smoke** | the release is out; the site is stale or a link is broken | re-run the failed jobs; a master push also redeploys the site |

## Private builds

`.github/workflows/release-artifacts.yml` run by hand is the author's private build: six kits as
workflow artifacts, named after `package.json`'s version (the last release between releases), never
tagged, released or deployed. `release.yml` reuses its jobs; never add publishing to it.

## Where the website gets the release from

`dev/scripts/build-doc-site-info.cjs` reads the newest `v*` tag and its assets (the asset list is
`dev/scripts/release-assets.cjs`, shared with `release.cjs publish`). Docs pages never hard-code a
release: they write `@KLIVE_RELEASE@`, which `docs/remark-release-version.mjs` replaces on every
build; `doc:check:release-links` enforces it. `KLIVE_SITE_RELEASE_TAG=v<x.y.z>` builds the site as
if a release existed (the dry run).

## Decisions (cited as D1-D16)

| # | Decision |
| --- | --- |
| D1 | **A home-grown changeset mechanism, not `@changesets/cli`.** Klive is one private app with a curated, prose CHANGELOG; the npm tool's headings and hash prefixes would need undoing. A changeset is a Markdown file with front matter, so an AI can write one without a tool. |
| D2, D11 | **`package.json` holds the version of the last release** between releases; only the release PR bumps it. The next version is computed from the pending changesets (`max(computed, package.json)` if `package.json` is ahead of the newest tag). Dev builds report the last released version. |
| D3 | **Two steps:** prepare a PR (the review, where the author writes the Highlights), then merge. Everything irreversible happens after the merge, and only after every build succeeds. |
| D4 | **The PR is prepared locally**, because a PR opened by a workflow's `GITHUB_TOKEN` triggers no other workflow, so `test.yml` would not run on it. |
| D5 | **One release workflow with dependent jobs**, because a tag pushed by `GITHUB_TOKEN` triggers nothing either. Trigger: a push to `master` whose head commit starts with `Release v` **and** whose `package.json` version has no tag, so neither a stray message nor a re-run releases twice. |
| D6 | `fix` → patch, `feature` → minor, `breaking` → minor while 0.x (major after 1.0). `bump:` forces a higher bump; `--version` overrides everything. |
| D7, D10 | **The website shows released versions only.** No `## Unreleased` in `CHANGELOG.md`; `npm run change:preview` shows the next section. |
| D8 | **No release version literal in `docs/content/`** (`@KLIVE_RELEASE@`, `doc:check:release-links`). "Klive 0.64.0 and later" is a minimum version, not a release link, and stays. |
| D9 | Release headings carry the date: `## 0.64.0 (2026-10-25)`. Older sections stay undated; only `## <version>` is parsed. |
| D12 | **The workflow publishes automatically.** The draft exists only between the upload and the publish, so a half-uploaded release is never visible. |
| D13 | **No pre-releases.** Plain `x.y.z` only; the pipeline's end-to-end test is the dry run. |
| D14 | `release-artifacts.yml` stays the private build: run by hand, workflow artifacts only. The release reuses its jobs through an added `workflow_call` trigger. |
| D15 | **AI assistants create the changeset as part of a commit** (`AGENTS.md`, `changesets-guide.md`). |
| D16 | Private builds keep their names (after `package.json`), so a private kit may share a file name with a public one. Accepted: private kits never reach a release. |

## Not done, noted for later

- **Code signing and notarization** of the macOS `.pkg` and the Windows installer: it plugs into the
  publish job (or electron-builder's config in the build jobs), needs certificates and secrets, and
  is its own plan.
- **Auto-update feeds** (`electron-updater`'s `latest*.yml`): an asset the publish job would add.
- **Preparing the release PR from a workflow**, with a GitHub App token instead of `GITHUB_TOKEN`
  (D4), for releasing without a local checkout.
- **Translating the CHANGELOG**: English only, like `reference/`.
- A named risk: the smoke job checks the live landing page after a short retry loop for the Pages
  CDN; a red smoke undoes nothing, and a master push redeploys the site.
