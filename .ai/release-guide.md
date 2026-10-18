# Releasing Klive

The design is `.plans/RELEASE_AUTOMATION_PLAN.md`; changesets are `.changes/README.md` and
`changesets-guide.md`. A release is two steps: prepare a PR locally, then merge it.

## Public release

1. On an up-to-date, clean `master`: `npm run change:status` (what will ship, which version) and
   `npm run release:prepare -- --dry-run` (the CHANGELOG section and the PR body, nothing written).
2. `npm run release:prepare`. It creates `release/v<x.y.z>`, writes the dated CHANGELOG section,
   deletes the consumed changesets, bumps `package.json` and the lockfile, runs every gate
   (`build:check`, `lint:renderer`, `test:all`, `doc:build`, `doc:check`, `release:verify`),
   commits `Release v<x.y.z>`, pushes and opens the PR. `--version x.y.z` overrides the computed
   version; `--skip-tests` skips `test:all` (re-runs only); `--no-push` stops after the commit.
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
| workflow **build** | a kit failed to build; nothing is tagged or published | fix on master, then *Run workflow* on master, *dry_run* off |
| workflow **publish** | a draft may exist | re-run the job: an existing draft is reused, a published release ends green |
| workflow **docs** / **smoke** | the release is out; the site is stale or a link is broken | re-run the failed jobs; a master push also redeploys the site |

## Private builds

`.github/workflows/release-artifacts.yml` run by hand is the author's private build: six kits as
workflow artifacts, named after `package.json`'s version (the last release between releases), never
tagged, released or deployed. `release.yml` reuses its jobs; never add publishing to it.

## Where the website gets the release from

`scripts/build-doc-site-info.cjs` reads the newest `v*` tag and its assets (the asset list is
`scripts/release-assets.cjs`, shared with `release.cjs publish`). Docs pages never hard-code a
release: they write `@KLIVE_RELEASE@`, which `docs/remark-release-version.mjs` replaces on every
build; `doc:check:release-links` enforces it. `KLIVE_SITE_RELEASE_TAG=v<x.y.z>` builds the site as
if a release existed (the dry run).
