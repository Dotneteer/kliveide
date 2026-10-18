# Changesets And Release Automation Plan

Two things, built so that the second one consumes the first:

1. **Changesets** — every feature or fix PR carries a small Markdown file that says, in the
   CHANGELOG's own voice, what changed for users. Nobody edits `CHANGELOG.md` by hand during
   development any more.
2. **A release workflow** — one command opens a release PR (version computed, CHANGELOG assembled,
   changesets consumed, every check run); merging that PR builds all six install kits, tags,
   creates the GitHub release with notes and assets, verifies them, and redeploys the website so
   the landing page shows the new version and download links.

Status: **Phases 1-5 implemented** (2026-10-18). Phase 6 — the first release through the pipeline
— is the author's step. The answers to the open questions are folded into §2 as D9-D16.

> **As built.** Where the implementation settled a detail the plan left open:
> - Files: `scripts/changes-lib.cjs` (all pure logic: parsing, kinds, versions, assembly, the PR
>   gate, feature unlocks; tests in `test/changesets/`), `scripts/changes.cjs` (the `change*` commands
>   and `gate`), `scripts/release.cjs` (`prepare`, `verify`, `publish`, `smoke`, `notes`),
>   `scripts/release-assets.cjs` (the kit names, shared with `build-doc-site-info.cjs`).
>   Workflows: `changeset-check.yml`, `release.yml`; `release-artifacts.yml` and `deploy-doc.yml`
>   gained a `workflow_call` trigger and nothing else changed for their own triggers.
> - `key:` takes `true` (the entry moves into Key fixes) or a quoted summary (the summary goes to
>   Key fixes, the entry stays in Fixes). A body that starts with `- ` is a ready-made list.
> - The workflow's **verify** job runs only `release:verify` (dependency-free); `build:check`
>   runs inside each build job, as part of `build:app`.
> - Docs pages write the release version as `@KLIVE_RELEASE@`, replaced by
>   `docs/remark-release-version.mjs` (a remark plugin) and, in the raw page source behind Nextra's
>   "Copy page", by the page route. `doc:check:release-links` fails on a hard-coded release URL in
>   `docs/content/` and on a token left in the built pages.
> - The dry run sets `KLIVE_SITE_RELEASE_TAG` so the site builds as if the release existed.
> - `deploy-doc.yml` compares `inputs.deploy` as text: on a push it is null, and `null == false` is
>   true in Actions expressions, which would have skipped every master deploy.
> - `release:prepare` ignores `docs/next-env.d.ts` in its clean-tree check (every docs build
>   rewrites it).
> - The three entries of the old `## Unreleased` section became the first changesets.

---

## 1. How releases happen today (the facts this plan builds on)

| Concern | Today | Where |
|---|---|---|
| Version | `package.json` `version`, bumped by hand, sometimes inside a feature PR (v0.63.0 was bumped in #1419, an "OZVM/Klive parity" PR). Currently `0.64.0` while the latest tag is `v0.63.0`, i.e. it was pre-bumped for the next release. | `package.json`, `package-lock.json` |
| Version at run time | `app.getVersion()` — About dialog, `kliveVersion` in new project files, the automation protocol's `version`. | `src/main/menus/help-menu.ts`, `src/main/projects.ts` |
| Change log | Hand-written `## Unreleased` section, renamed to `## x.y.z` at release. Section headings vary over time (`Features` / `New features` / `Changes` / `Fix` / `Fixes` / `Key fixes` / `Highlights` / `Breaking changes` / `Known issues`). No dates. | `CHANGELOG.md` |
| Website "What's new" | Generated from `CHANGELOG.md` on every docs build, **including `## Unreleased`**. | `scripts/build-doc-changelog.cjs` |
| Landing page version + download links | Generated on every docs build from the newest `v*` tag (`git describe`) and that release's assets (GitHub API, or the asset naming pattern when offline). Features appear only once `since <= latestRelease`. | `scripts/build-doc-site-info.cjs`, `docs/landing/features.ts`, `docs/landing/DownloadButton.tsx` |
| Website deploy | Only on push to `master`. **A new release does not redeploy the site**, so the landing page keeps showing the previous version until the next unrelated push. | `.github/workflows/deploy-doc.yml` |
| Install kits | `workflow_dispatch` only; five jobs (win x64 + portable zip, linux x64, linux arm64, mac x64, mac arm64), each uploading a workflow artifact. CLI smoke tests on three of them. Assets are then attached to a release **by hand**. | `.github/workflows/release-artifacts.yml` |
| GitHub release | Created by hand; body = the CHANGELOG section (v0.63.0's body is exactly that). Older ones marked pre-release. | GitHub |
| Hard-coded release versions in docs | `guides/testing/unit-tests-cli.mdx` links `releases/download/v0.64.0/KliveIdeSetup-0.64.0-x86_64.AppImage` — **a dead link today**, since 0.64.0 is not released. | `docs/content/en/...` |

What this tells us:

- The landing page is already *derived* from the release tag. "Update the version and links on
  the landing page" therefore reduces to two things: **redeploy the site after the release
  exists**, and **stop hard-coding release versions in docs content**.
- The build matrix exists and works; it needs to become a reusable workflow, not be rewritten.
- The CHANGELOG has an established, curated prose style (bold lead-in, full sentences, issue
  numbers in parentheses). The changeset format must produce exactly that, which rules out
  tools that impose their own headings.

---

## 2. Decisions

- **D1 — A small home-grown changeset mechanism, not `@changesets/cli`.** Klive is a private
  Electron app, not an npm package: nothing is published to a registry, there is one package, and
  the changelog is curated prose under Klive's own headings. `@changesets/cli` brings
  `### Minor Changes` / `### Patch Changes` headings and commit-hash prefixes that would need a
  custom formatter to undo, plus a dependency for what is ~300 lines of script. The home-grown
  format is a Markdown file with front matter, so an AI agent can write one without running a tool.
- **D2 — `package.json` always holds the version of the *last release* between releases**, and the
  release PR is the only change that bumps it. The next version is computed from the pending
  changesets. Migration rule for today's pre-bumped state: if `package.json` is ahead of the newest
  tag, the next version is `max(computed, package.json)` — so 0.64.0 stays 0.64.0.
  Dev builds therefore report the last released version (author's decision, D11).
- **D3 — Release in two steps: prepare a PR, then merge it.** The release PR is where the author
  reviews the assembled CHANGELOG and writes the Highlights. Everything irreversible (tag, release,
  site deploy) happens only after merge, and only after all five builds succeed.
- **D4 — The release PR is prepared locally (`npm run release:prepare`), not by a workflow.** A PR
  opened by a workflow's `GITHUB_TOKEN` does not trigger other workflows, so `test.yml` would never
  run on it — the one PR that most needs its checks. Running locally (by the author, or Claude in
  this app) pushes with the author's credentials and the checks run normally. A workflow variant can
  come later with a GitHub App token (§7).
- **D5 — The release workflow is one workflow with dependent jobs**, triggered by the merge of a
  release PR. Tags pushed by `GITHUB_TOKEN` do not trigger workflows either, so "push tag → another
  workflow builds" cannot work without a PAT; chaining jobs inside one run avoids that entirely.
- **D6 — Versioning rules while Klive is 0.x:** `fix` → patch; `feature` → minor; `breaking` →
  minor (as 0.61.0 and 0.63.0 already did). After 1.0, `breaking` → major. A changeset may force
  a higher bump with `bump:`; `release:prepare --version x.y.z` overrides everything.
- **D7 — The website shows released versions only.** `## Unreleased` disappears from
  `CHANGELOG.md` (pending changes live in `.changes/`), which brings "What's new" in line with R6
  of the docs plan ("claim only what is released"). `npm run change:preview` shows what the next
  section will look like. No "Upcoming" block on the site (author's decision, D10).
- **D8 — No release version literal in `docs/content/`.** Links to install kits go through the
  generated `site-info.json` (a small MDX component or a build-time placeholder), and a check fails
  the docs build on a `releases/download/v` literal. Text like "Klive 0.64.0 and later" is a
  *minimum* version, not a release link, and stays.

Author's decisions on the former open questions (2026-10-18):

- **D9 — Release headings carry the release date:** `## 0.64.0 (2026-10-25)`. Older sections stay
  undated; nothing parses the heading beyond `## <version>`, so both forms are accepted.
- **D10 — The website shows released versions only** (confirms D7).
- **D11 — `package.json` holds the last released version between releases** (confirms D2).
- **D12 — The release workflow publishes automatically.** The release PR is the review; there is no
  manual "publish draft" click. The draft exists only for the seconds between upload and publish,
  so a half-uploaded release is never visible.
- **D13 — No more pre-releases.** Versions are plain `x.y.z`; `release:prepare` and
  `release:verify` reject a pre-release suffix, and the pipeline has no `prerelease` path. The
  end-to-end test of the pipeline is a dry run (Phase 6), not an rc release.
- **D14 — `release-artifacts.yml` stays the workflow for private, unpublished builds.** Its
  `workflow_dispatch` trigger, its jobs and its output (workflow artifacts only — never a tag, a
  release or a deploy) do not change. The public release reuses its jobs through `workflow_call`
  (§5); that is an added trigger, not a change to how the private build behaves.
- **D15 — AI assistants create changesets as part of committing** (rules in §4a).
- **D16 — Private builds keep today's names.** `release-artifacts.yml` gets no label input; a
  private kit is named after `package.json`'s version, which between releases is the last released
  one (D11). So a private kit can have the same file name as a public kit with different
  contents. That's accepted. Private kits stay workflow artifacts and are never uploaded to a
  release, so the two never meet on GitHub.

---

## 3. The changeset format

One file per user-visible change in `.changes/`, named `<short-slug>-<4 random chars>.md` so two
branches never collide:

```markdown
---
type: feature          # feature | fix | breaking | known-issue | internal
issues: [1417]         # optional; rendered as "(#1417)" at the end of the entry
bump: minor            # optional; only to force a higher bump than the type implies
highlight: "**Copper and DMA regions in `.NEX` annotations**, shown as `.copper`/`.dma` pragmas."
                       # optional; a one-line summary proposed for the release's Highlights
key: true              # optional, fixes only; proposes the entry for "Key fixes"
---

**Copper and DMA regions in `.NEX` annotations:** mark a range of a popped-out bank as a Copper
list or a zxnDMA program, and the listing shows it as `.copper` / `.dma` pragmas, with each
instruction's meaning in the comment column.
```

- The body is the CHANGELOG entry, verbatim, without the leading `- ` (the assembler adds it and
  wraps continuation lines). It may hold more than one paragraph; the first line should carry the
  bold lead-in for features.
- `internal` produces no CHANGELOG entry. It exists so a refactor/test/CI PR can satisfy the PR
  gate explicitly instead of via a label.
- Assembled section layout (fixed order, empty sections omitted), which normalizes the drift in
  today's headings:

  ```markdown
  ## 0.64.0 (2026-10-25)

  ### Highlights        <- from `highlight:` fields, then edited by hand in the release PR
  ### Key fixes         <- fixes with `key: true`
  ### Breaking changes
  ### Features
  ### Fixes
  ### Known issues
  ```

  Within a section, entries are ordered by the date the changeset was added (`git log
  --diff-filter=A`), oldest first, so the order follows the development history.

---

## 4. Commands

All in one script, `scripts/changes.cjs` (plain Node, no dependencies, like the other `scripts/`),
plus `scripts/release.cjs` for the release steps. Pure logic (parsing, version math, assembly)
lives in a module the tests import directly.

| Command | What it does |
|---|---|
| `npm run change` | Creates a changeset. Interactive when run in a terminal (type, issues, text, highlight?). Non-interactive with flags for agents and scripts: `npm run change -- --type fix --issue 1417 --text "..."`. Prints the path, the **kind** (`minor` or `patch`, from D6 and any `bump:`; `none` for `internal`) and the file's content, in the form agents show to the user (§4a). `npm run change -- --show <file>` prints the same for an existing (e.g. hand-edited) changeset. |
| `npm run change:check` | Validates every file in `.changes/`: front matter keys and values, non-empty body (unless `internal`), `key` only on fixes, body survives the MDX escaping in `build-doc-changelog.cjs`. **Added to `build:check`**, so it runs locally and in CI. |
| `npm run change:status` | Lists pending changesets by type, the computed next version and why (e.g. "minor: 6 features"). |
| `npm run change:preview` | Prints the CHANGELOG section the next release would get. Changes nothing. |
| `npm run release:prepare [-- --version x.y.z] [--dry-run]` | §5 step A. |
| `npm run release:verify` | The preflight checks of §5, runnable on their own. The release workflow calls it too. |

---

## 4a. AI assistants and changesets (D15)

Most changes in this repository are written with an AI assistant, so the mechanism only works if
assistants apply it without being reminded. The rules go into `AGENTS.md` (which `CLAUDE.md`
includes) in Phase 1, with the detail in `.ai/changesets-guide.md`. The text to add to
`AGENTS.md`:

> ## Changesets
>
> - User-visible changes are recorded as changesets in `.changes/`, never by editing
>   `CHANGELOG.md`. Read `.ai/changesets-guide.md` before writing one.
> - **Whenever the user asks for a commit, the commit includes a changeset** — create it with
>   `npm run change -- --type <type> [--issue <n>] --text "..."` before committing, written in the
>   CHANGELOG's voice (bold lead-in for a feature, a full sentence saying what was wrong for a fix).
> - **Exception: a commit that completes only some steps or phases of a longer plan gets no
>   changeset.** The changeset comes with the commit that completes the plan, and describes the
>   plan's result as a whole, not its last step. Say in one line that it is deferred and why.
> - **The same applies without being asked about it** when a plan is finished or a bug is fixed:
>   the commit that delivers it carries the changeset.
> - **If it is not clear whether a changeset is needed, ask the user before committing** — for
>   example: the change may not be user-visible (refactor, tests, build, CI, docs only), it is
>   unclear whether the work completes a plan or only a step of it, or it could be a `fix` or a
>   `feature`. Offer the choices, including an `internal` changeset (no CHANGELOG entry, no version
>   bump) and no changeset at all.
> - **One changeset per change, not per commit.** When a later commit on the same branch extends
>   or corrects the same change, edit the existing changeset instead of adding a second one.
> - **Every time a changeset is created or edited, show it to the user:** its path, its kind —
>   **minor** or **patch** (or *none* for `internal`) — and its full content in a fenced block.
>   `npm run change` prints exactly this; for a hand-edited file, use `npm run change -- --show <file>`.

Example of what the user sees:

````markdown
Changeset `.changes/nex-dma-copper-k3f9.md` — **minor** (feature, #1468)

```markdown
---
type: feature
issues: [1468]
---

**Copper and DMA regions in `.NEX` annotations:** mark a range of a popped-out bank as a Copper
list or a zxnDMA program, and the listing shows it as `.copper` / `.dma` pragmas.
```
````

The PR gate (Phase 2) is the backstop for anything this misses.

---

## 5. The release flow

### Step A — `npm run release:prepare` (local, on an up-to-date `master`)

Preflight (any failure stops with a message saying what to do):

1. Working tree clean, on `master`, level with `origin/master`.
2. At least one non-`internal` changeset is pending (or `--version` given).
3. `change:check` passes; the computed version is greater than the newest `v*` tag and has no tag
   or GitHub release yet.
4. `gh` is installed and authenticated (needed to open the PR).

Then:

5. Create branch `release/v<version>`.
6. Assemble the CHANGELOG section (§3) and insert it at the top of `CHANGELOG.md`; delete the
   consumed changeset files.
7. `npm version <version> --no-git-tag-version` (updates `package.json` and `package-lock.json`).
8. Run the gates: `npm run build:check`, `npm run lint:renderer`, `npm run test:all`,
   `npm run doc:build && npm run doc:check`. These are the same as CI's, run up front so a release
   PR is never the first place a failure shows up. (`--skip-tests` exists for re-runs, never for a
   first run.)
9. Commit `Release v<version>`, push, and open the PR with `gh pr create`. The PR body is
   generated and contains:
   - the assembled CHANGELOG section;
   - landing-page features this release unlocks (`since == <version>` in `docs/landing/features.ts`)
     and any whose `since` is *between* the last release and this one but never got released
     (a typo signal);
   - a checklist of the manual items: Highlights reviewed and edited; release status note in
     `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §4 updated to this version; README machine table
     and roadmap reviewed; screenshots refreshed if the UI changed (`npm run doc:shots`).

The author edits the PR (Highlights mostly) and merges it when the checks are green.

### Step B — `.github/workflows/release.yml` (on merge)

Trigger: `push` to `master` where the head commit's message starts with `Release v` **and**
`package.json`'s version has no tag. Both conditions, so neither a stray commit message nor a
re-run can release twice. `workflow_dispatch` is also offered, with an input for the version, to
resume a failed run.

Jobs:

1. **verify** — `release:verify` on the merge commit: version untagged; `CHANGELOG.md` has a
   `## <version>` section and no `## Unreleased`; `.changes/` holds no pending changesets; the version is plain `x.y.z` (D13). Outputs `version` and `tag`.
2. **build** — calls `release-artifacts.yml` through an added `workflow_call` trigger (with a
   `ref` input), so the five jobs and their CLI smoke tests run unchanged on the merge commit. The
   private-build use of that workflow is untouched (D14): run by hand, it still only uploads
   workflow artifacts. All publishing lives in `release.yml`, never in `release-artifacts.yml`.
3. **publish** (needs both):
   - download all workflow artifacts;
   - check the file set equals the expected asset names — **one shared list**, moved out of
     `build-doc-site-info.cjs` into `scripts/release-assets.cjs` so the website and the release
     can never disagree about names;
   - write `SHA256SUMS.txt` for the kits and add it as an asset;
   - create the tag on the merge commit and the GitHub release as a **draft**, with the
     CHANGELOG section as the body (extracted by the same module that assembled it), the assets
     uploaded, marked as the latest release;
   - then publish it at once (D12). Idempotent: an
     existing draft for the tag is reused, an existing published release ends the job green.
4. **docs** — calls `deploy-doc.yml`, converted to also accept `workflow_call`, so the site is
   rebuilt *after* the release exists: `site-info.json` sees the new tag and its assets, the
   landing page shows the new version, download links and any newly unlocked features, and
   "What's new" shows the new section.
5. **smoke** — fetch `https://kliveide.net/` (after a short retry loop for the Pages CDN) and assert
   the new version and a download link for each platform are on it; `HEAD` each download URL and
   expect 200/302. A failure here does not undo anything; it makes the run red so it gets looked at.

**Dry run.** `workflow_dispatch` with `dry_run: true`, started on a `release/v*` branch before its
PR is merged, runs **verify**, **build** and **publish** in a mode that does everything except
write: it checks the asset set, writes the checksums, extracts the release notes and prints the
`gh release create` call, uploading notes and checksums as a workflow artifact for inspection.
**docs** builds the site with the would-be site info but does not deploy; **smoke** is skipped.
Nothing is tagged or published. This replaces a test release (D13).

Nothing irreversible happens before all five builds succeed. A failure in **build** leaves no tag
and no release: fix on master in a normal PR, then re-run via `workflow_dispatch`.

```
release PR merged ──► verify ──► build (5 OS jobs, reusable) ──► publish (tag, release, assets)
                                                                    │
                                                                    ▼
                                                     docs (deploy-doc, reusable) ──► smoke
```

---

## 6. Phases

Each phase is one reviewable PR with tests.

### Phase 1 — Changesets
- `scripts/changes.cjs` + a pure module (`scripts/lib/changes.cjs`): parse, validate, version
  math, assemble. Unit tests in `test/changesets/changes-lib.test.ts` (parsing, every validation error,
  bump rules incl. the D2 migration rule, section assembly and ordering, line wrapping, MDX
  escaping round-trip with `build-doc-changelog.cjs`).
- `npm run change`, `change:check`, `change:status`, `change:preview`; `change:check` into
  `build:check`.
- Migrate the current `## Unreleased` entries in `CHANGELOG.md` into `.changes/` files and remove
  the section (D7). `change:preview` must reproduce them.
- `.changes/README.md` (the format, with examples), `.ai/changesets-guide.md` (the format, the
  CHANGELOG voice with good and bad examples, how to pick the type, when a plan counts as
  complete), and the **"Changesets" section of §4a in `AGENTS.md`**, verbatim. This is what makes
  the mechanism stick, since most changes here are written with an AI assistant.
- `npm run change` prints path, kind and content (§4a's display format); `--show <file>` does the
  same for an existing file. Tests cover the printed kind for every type and `bump:` combination.

### Phase 2 — The PR gate
- `.github/workflows/changeset-check.yml` on `pull_request`: fails when the PR touches anything
  outside the exempt paths and adds no `.changes/*.md`. Exempt: `docs/`, `.plans/`, `.ai/`,
  `.docs/`, `*.md` at the root, `.github/`, test-only changes; PRs from `dependabot[bot]`; PRs
  with the `no-changeset` label. The failure message prints the exact `npm run change -- ...`
  command to run.
- It reports, it does not write: no bot comments, no commits to the PR.

### Phase 3 — `release:prepare` and `release:verify`
- `scripts/release.cjs` implementing §5 step A and the verify checks, with `--dry-run` (does
  everything in a temp copy of the CHANGELOG and `package.json`, prints the diff and the PR body,
  pushes nothing).
- Tests for the pure parts (version selection, CHANGELOG insertion and section extraction, feature
  unlock detection, PR body). The git/gh parts are thin and are exercised by the Phase 6 dry run.
- `.ai/release-guide.md`: the end-to-end procedure, what each failure means, how to resume.

### Phase 4 — Decouple the docs from release versions
- `scripts/release-assets.cjs`: the single list of asset names and the platform mapping; used by
  `build-doc-site-info.cjs` and the release workflow.
- Replace the hard-coded `v0.64.0` download URLs in `guides/testing/unit-tests-cli.mdx` (and any
  others the check finds) with a component/placeholder fed by `site-info.json` (D8). This also
  fixes today's dead link.
- Add `doc:check:release-links` to `doc:check`: no `releases/download/v` literal in
  `docs/content/` outside the generated `whats-new.mdx`.

### Phase 5 — The release workflow
- Add a `workflow_call` trigger to `release-artifacts.yml` and `deploy-doc.yml`, keeping their
  current triggers and behaviour (D14: `release-artifacts.yml` remains the private-build workflow
  and gains no publishing step). `deploy-doc.yml` also gets a `deploy: false` input for the dry run. Make the docs `concurrency` group shared so a release deploy and a master
  push deploy queue instead of racing.
- Add `release.yml` (§5 step B), including the dry-run mode. Permissions: `contents: write` on **publish** and **docs** only;
  everything else read-only.

### Phase 6 — First release through the pipeline
- `npm run release:prepare` for 0.64.0 opens the release PR.
- Before merging it, start `release.yml` with `dry_run: true` on its `release/v0.64.0` branch and
  check the run: all five builds, the asset set, the checksums, the extracted notes, the would-be
  landing page (version, download links, unlocked features).
- Merge the PR; the real run releases 0.64.0. Check the release page, the downloads and
  kliveide.net.

---

## 7. Out of scope, noted for later

- **Code signing / notarization** of the macOS `.pkg` and the Windows installer. The publish job
  is where it would plug in (or electron-builder's own config in the build jobs), but it needs
  certificates and secrets and is its own plan.
- **Auto-update feeds** (`electron-updater`'s `latest*.yml`). Not used today; would be an asset
  added in the publish job.
- **Preparing the release PR from a workflow** with a GitHub App token, for releasing without a
  local checkout (D4).
- **Translating the CHANGELOG.** It is English-only today, like `reference/`.

---

## 8. Open questions for the author

None. Q1-Q5 became D9-D13; Q6 became D16.
