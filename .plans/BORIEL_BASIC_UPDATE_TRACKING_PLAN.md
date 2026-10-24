# Boriel BASIC — tracking new versions and the `.dbg` format

Status: **proposed** (2026-10-17). Builds on `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` (Phases
B0-B6 done) and its handoff, `.plans/BORIEL_BASIC_HANDOFF.md`. Decisions B-L1, B-T1 and B-T2 there
stay binding. This plan adds no automatic upgrade: it finds changes and prepares the upgrade, and a
person (or an AI session started by one) makes it.

## 0. Goals, non-goals, decisions

**Goals**

1. **Detect** a new zxbc 2.x release on <https://files.boriel-basic.net/v2/> within a day, with no
   one checking by hand.
2. **Fetch and verify** the new kits for every platform Klive packages, and produce a ready
   `kit.json` change, so building them into Klive is one reviewed commit.
3. **Watch the `.dbg` format** from two sides: the published docs
   (<https://zxbasic.readthedocs.io/en/v2.0/debug_format/> and its subpages), and what the new zxbc
   actually writes. Turn any change into an **update brief**, a Markdown file an AI session can take
   as its task.

**Non-goals**

- No in-app "a new Boriel version is available" notice for users. Users get the kit bundled with
  their Klive build (B-T2). This could be added later on top of U1's checker.
- No unattended version bump. B-T2 says a version change is deliberate; the watcher proposes it.
- zxbc never runs in CI (B-T1). The scheduled job only reads the index, sends HEAD requests,
  downloads archives to hash them, and reads the docs.

**Proposed decisions (need the author's OK)**

| # | Decision | Proposal |
| --- | --- | --- |
| **U-D1** | Licence per version | B-L1's written permission covers "the current beta kit". Each new version needs the author to confirm that the permission still applies before the bump is merged. The upgrade checklist (§6) has this as a manual item that cannot be skipped. |
| **U-D2** | Trust in downloaded kits | Boriel publishes **no checksums**. Klive records the SHA-256 of its first download (trust on first download), checks it against the server's `Content-Length` and `ETag`, downloads it a second time from a separate connection to confirm, and then pins it. Ask Boriel to publish a `SHA256SUMS` file (add this to `.ai/boriel/boriel-issues.md`). Once one exists, U2 checks against it. |
| **U-D3** | Where an alert goes | A scheduled GitHub Actions workflow opens or updates **one GitHub issue per finding** (labelled `boriel-watch`), with the update brief as its body. A failing job alone is easy to miss. |
| **U-D4** | One source for the version | `vendor/boriel-basic/kit.json` becomes the only place the version is written (U0). Today it is also hard-coded in 9 files. |

## 1. What was found on 2026-10-17 (facts this plan builds on)

### 1.1 The release index

- `https://files.boriel-basic.net/v2/` is an nginx/PHP directory listing: one `<table>` with one
  `<a href="/v2/<file>">` row per file, a size **rounded to Kb**, and a date. It has no feed, no
  `latest` alias and no checksum files.
- **`2.0.0-beta26` is already published** (2026-10-14 22:41 UTC, seven kits, one day after beta25).
  Klive pins beta25. The first job for this plan's tooling is the beta25 → beta26 upgrade (U6).
- File names have **changed over time**:
  - beta14 used `aarch64_macos`, `win64` and `armv7-linux`;
  - beta15-beta19 used `armv7-linux`;
  - since beta21 they are `arm64-linux`, `arm64-macos`, `arm64-win`, `armv6-linux`,
    `x86_64-linux`, `x86_64-macos` and `x86_64-win`.

  The parser must map names through an explicit table and report a name it does not know. It must
  not guess.
- A HEAD request on a kit returns exact `Content-Length`, `Last-Modified` and `ETag` (nginx form
  `"<mtime hex>-<size hex>"`). beta26's sizes: arm64-macos 3069249, x86_64-macos 3374398,
  x86_64-linux 3391116, arm64-linux 3242090, armv6-linux 3696464, x86_64-win 13697225,
  arm64-win 13046679.
- All seven beta26 files were uploaded within 4 seconds. Even so, a check that runs during an
  upload could see only part of a version. §2.2 handles this.

### 1.2 The `.dbg` documentation

- The format has **six pages**, linked from the overview `debug_format/`: `schema/` ("Statements &
  Addresses"), `callables/`, `call_sites/`, `variables/` and `banking/`.
- The page source is in `boriel-basic/docs`, branch `v2.0` (from the Read the Docs API, `vcs`), but
  that repository is **not public** (GitHub returns 404). So the watcher has to fingerprint the
  rendered HTML. It cannot diff git blobs as `scripts/zxbasic-syntax-check.cjs` does.
- `Last-Modified` is the **docs build time**, the same for every page (2026-10-13 23:09). It changes
  on every rebuild, so it cannot be used to detect a content change. Only a hash of the normalized
  content can.
- The Read the Docs API (`https://readthedocs.org/api/v3/projects/zxbasic/versions/`) lists doc
  versions. `v2.0` is marked `hidden`. A new `v2.1` would most likely appear there first.
- The docs already **disagree with the observed output** in one place: the design note says zxbc's
  far calls have "no shadow call stack", but B5 found one (`.ai/boriel/dbg-observed.md`, "Far
  calls"). So a docs check alone is not enough, and §4.2 also checks what zxbc writes.

### 1.3 What already exists to build on

| Piece | Reuse |
| --- | --- |
| `scripts/boriel-kit.cjs` (`fetch`, `stage`, `ensureKit`, `verifyKitFile`) | U2 adds `candidate` and `apply` commands next to them |
| `scripts/zxbasic-syntax-check.cjs` | The model for the format check: a committed fingerprint, exit codes 0/1/2, `--json`, `--update`, and hashes rather than copied text |
| `src/main/boriel-integration/boriel-version.ts` (`compareBorielVersions`) | The version ordering. U1 needs the same ordering in a `.cjs` script |
| `src/main/tool-install-archive*` (Klive's tar/zip reader, no quarantine) | U2's structure checks and the version probe |
| `scripts/boriel-fixtures.cjs` | U4 regenerates the fixtures into a scratch folder to diff them |
| `dbg-adapter.ts` / `BorielCompiler.ts` check `format === "zx-source-debug" && version === 1` | The hard gate on the format version, kept as is |
| `scripts/boriel-ide-check.cjs` | The final in-app gate before a bump |

## 2. Phase U1 — release check

`scripts/boriel-release-check.cjs`, with `npm run boriel:release-check`.

### 2.1 What it does

1. GET the index and pull every `href` that matches
   `^/v2/boriel-basic-v(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)_(?<target>[^.]+)\.(?<ext>tar\.gz|zip)$`.
2. Map `target` to a `kit.json` key through a **`targets` table added to `kit.json`**:
   `{ "arm64-macos": "darwin-arm64", "x86_64-win": "win32-x64", ... }`. Old names (`aarch64_macos`,
   `win64`, `armv7-linux`) are listed as `retired`, so old versions are not reported as unknown. Any
   other name goes into the report as **unknown target**. A new platform, or a renamed one, needs a
   person to look at it.
3. Group the files by version and order the versions with the same ordering as
   `compareBorielVersions`. Put it in `scripts/boriel-version.cjs` with a `.d.cts`, as
   `boriel-kit.d.cts` already does, and make `boriel-version.ts` import from it, so the ordering
   exists only once. If that import trips the Vite or Electron build, keep both copies and add a
   test that runs both over one table.
4. Compare with `kit.json`:
   - **newer version:** report it, with each platform's file, `Content-Length`, `Last-Modified`
     and `ETag` (one HEAD request per file);
   - **pinned kit changed on the server:** a HEAD on each pinned file whose size differs from
     `kit.json`, or which is gone. Package builds would also fail on this, but later and with a less
     clear error;
   - **pinned kit removed:** the version is gone from the index, so a fresh clone could no longer
     build (`mirrors` exists for this case).
5. Output: a text report, or JSON with `--json`. **Exit codes as for the syntax check: 0 nothing
   new, 1 something found, 2 failure.**

### 2.2 "Complete" and "settled"

A version counts as **ready** only when:

- every `kit.json` key Klive packages has a file, so a partial upload does not count. A missing
  platform is reported as such ("beta27: no win32-x64 kit yet");
- its newest file's `Last-Modified` is at least **2 hours** old, so the upload has stopped.

Before that the version is reported as **pending**, with exit code 1 and a different label, so the
issue says "wait".

### 2.3 Tests (unit tier)

`test/main/boriel-release-check.test.ts`, run on **saved copies of the index**:

- `test/boriel/watch/index-2026-10-17.html` (the real listing, trimmed);
- one copy with a partial version;
- one with an unknown target;
- one with the pinned version missing.

`fetch` is injected, as it already is in `ensureKit`, so no test touches the network.

## 3. Phase U2 — fetch a candidate and check its structure

New `boriel-kit.cjs` commands:

```
node scripts/boriel-kit.cjs candidate --version 2.0.0-beta26   # download + verify + facts
node scripts/boriel-kit.cjs apply --version 2.0.0-beta26       # rewrite kit.json from the candidate
```

### 3.1 `candidate`

- Downloads each platform's kit into the git-ignored
  **`vendor/boriel-basic/candidates/<version>/`**. Each version gets a new, empty folder, and
  nothing in it is executed or unpacked in place.
- Checks each file against the size from HEAD, and downloads it twice to confirm the SHA-256
  (U-D2).
- Writes `candidate.json`: the `kit.json` that `apply` would write.
- **Checks the structure** with Klive's own archive reader. These are the B0 facts from
  `.ai/boriel/kit.md`, now checked by a script:
  - one top-level folder named `boriel-basic-v<version>_<target>`;
  - no symlinks, no absolute paths and no `..` paths;
  - the nine executables at their paths;
  - the file count, the longest path, and the unpacked size per kit;
  - a hash of the `lib/` tree, which **must be the same in every kit**;
  - the hash of each `lib/` file, used only to report which files changed. Nobody reads them
    (provenance rule);
  - whether `lib/NOTICE.md`, `lib/UNLICENSED_FILES.txt` or a `LICENSE` exists, and whether it
    changed. This feeds U-D1.
- Compares these facts with **`.ai/boriel/kit-facts.json`** (new, generated, committed: facts only,
  no content), and reports added or removed executables, a moved top folder, `lib/` differences
  between kits, and licence-file changes.

### 3.2 `apply`

- Rewrites `kit.json` from `candidate.json`, moves the archives into `kits/`, and updates
  `kit-facts.json`.
- It refuses to run unless `candidate` passed, or with `--force-facts` after a person has read the
  facts diff.

### 3.3 Tests

- **Unit:** `candidate` against small synthetic tarballs and zips, built in the test: a good kit, a
  kit with a symlink, a kit with a different `lib/` hash, and a kit with a missing executable.
- `apply` is checked to rewrite `kit.json` exactly (the key order is kept, so the diff stays
  small).

## 4. Phase U3 — `.dbg` format watch

The format is watched from two sides, because §1.2 shows that the docs and the compiler can
disagree.

### 4.1 The published format: `scripts/boriel-dbg-format-check.cjs`

`npm run boriel:dbg-format-check`. Same shape as `zxbasic-syntax-check.cjs`: committed fingerprint,
`--json`, `--update`, exit codes 0/1/2.

1. **Find the pages:** load the overview, then follow every relative link that stays inside
   `debug_format/`. Today that is six pages. A page added or removed is reported. The fingerprint
   also keeps the list, so a page that stops being linked is reported too.
2. **Normalize each page:**
   - take the `<article>` element;
   - drop `<script>`/`<style>`, the code blocks' line-number gutters (they render as runs of digits)
     and the "Table of contents" sidebar;
   - unescape entities and collapse whitespace.
3. **Fingerprint:** `.ai/boriel/dbg-format-fingerprint.json` (new). It holds **hashes and interface
   facts, no copied prose**, following the syntax checker's rule:
   - per page: the URL, the title and the hash of the normalized text;
   - **per section** (split at `h2`/`h3`): the heading and its hash. The report can then name the
     section that changed and link to its anchor, and the AI session reads that section on the
     live page;
   - **the field inventory:** every key path in the JSON examples (for example
     `sourceLevelDebug.extensions.callSites[].returnAddress`) and every name in the "Field |
     Meaning" tables' first column. Field names are interface facts. A field that was added,
     removed or renamed is the most useful thing the check can report;
   - the values the examples give for `format` and `version`. A change there means the adapter's
     hard gate will reject the new files;
   - **marker phrases** to watch: the "Current limitations" items (for example `callTargets` is
     always `[]`) and `kind` being always `"normal"`. When one of these goes away, upstream has
     added something the adapter may want to use. Only the heading and its hash are stored.
4. **Doc versions:** query the Read the Docs versions API and report any version newer than
   `v2.0` (`v2.1`, `latest` pointing at a newer branch), so the watcher can be pointed at it.

### 4.2 The observed format: what the new zxbc writes

The docs are second-hand. The fixtures are zxbc's real output, so U3 adds checks over them that
run in CI with no zxbc:

- **`.ai/boriel/dbg-shape.json`** (new, generated by `npm run boriel:dbg-shape`). For each key path
  in all fixtures' `.dbg` files, it records the JSON type(s), whether the key is always present,
  and the set of values for enum-like fields (`kind`, `convention`, `architecture`, `scope`, ...).
  A unit test regenerates it in memory and **fails when it differs**. Regenerating the fixtures
  with a new zxbc that adds a field, or a new `convention`, therefore fails CI until someone looks
  at the change and runs `--update`.
- **Quirk checks.** Each correction the adapter makes (`dbg-observed.md`, "What the adapter must
  correct", items 1-9 and onward) becomes a named test over the raw fixtures that asserts the quirk
  is **still present**. For example:
  - "statement indexes have gaps";
  - "`endAddress` runs past `epilogueStart`";
  - "`PRINT a; b` ends after the first item".

  When a new zxbc fixes one, its test fails with a message like *"quirk 5 (PRINT end column) is gone
  in 2.0.0-beta27: check whether `dbg-adapter.ts` still needs its correction, then mark the quirk
  as fixed in `dbg-observed.md`"*. The adapter must keep accepting **both** shapes while older kits
  are installed, so the fix is to make the correction conditional, not to delete it.
- **The semantic fixture diff:** U4 compares old and new fixtures:
  - `.dbg` as normalized JSON, with statements matched by source span, not by `index`;
  - `.map` label sets;
  - `.bin` and `.nex` sizes and checksums;
  - `.err` lines.

  This shows what the new compiler does differently on Klive's own programs.

### 4.3 Tests

- **Unit:** the normalizer and the field-inventory extractor on saved pages
  (`test/boriel/watch/dbg-*.html`, the six real pages saved on 2026-10-17, trimmed), plus one
  edited copy with a new field, one with a removed section, and one with `"version": 2`.
- **Unit:** the shape test and the quirk tests on the committed fixtures.

## 5. Phase U4 — the upgrade run and the update brief

`scripts/boriel-upgrade.cjs`, with `npm run boriel:upgrade -- <version>`. It runs on a developer
machine, never in CI. It goes as far as it can, then writes **`.boriel-upgrade/<version>/brief.md`**
(git-ignored): the task for an AI session, or for a person.

### 5.1 Steps

1. `boriel-release-check` must say the version is **ready** (§2.2).
2. `boriel-kit.cjs candidate --version <v>`, which gives the facts diff (§3).
3. Unpack this platform's kit with Klive's installer code into `.boriel-upgrade/<v>/zxbc/`
   (`xattr -dr com.apple.quarantine` on macOS before the first launch, per `kit.md`). Then run the
   version probe with its timeout, which must print `<v>`.
4. Regenerate every fixture into `.boriel-upgrade/<v>/fixtures/` with that zxbc. This needs
   `boriel-fixtures.cjs --out <folder>`, a small addition. Then run the semantic diff (§4.2).
5. Run the shape and quirk checks on the new fixtures, and the format check (§4.1).
6. Run the Boriel unit and core tests against the new fixtures. This needs a
   `BORIEL_FIXTURES_DIR` override in the fixture loader, the only test-code change this plan needs.
7. Write the brief.

### 5.2 The brief

Generated Markdown, laid out so that an AI session can work from it alone:

- **Header:** old → new version, the date, and the release-check, facts and format-check reports.
- **What changed**, by area, each with a severity:
  - **blocking:** the `format`/`version` gate, a removed field, failing tests;
  - **adapter:** a new field, a changed enum, a quirk that is gone;
  - **cosmetic:** a changed docs page with no field change, `.bin` size drift.
- **Links** to the changed doc sections (anchors on the live page), and the paths of the old and
  new fixture files to compare.
- **The rules, quoted from the repo, not paraphrased:** B-T1, B-T2, the provenance rule (the kit's
  `lib/` is never read; the docs and the observed output may be), and the "observed, not read"
  rule from `.ai/boriel/README.md`.
- **The checklist** from §6, with the steps already done ticked.
- **Files to read first:** `.ai/boriel/README.md`, `dbg-observed.md`, `dbg-adapter.ts`, and this
  plan.

### 5.3 The standing runbook

**`.ai/boriel/updating.md`** (new) is the runbook an AI session follows. It tells the session what
to do with each finding type:

- **a new field:** decide whether the adapter uses it, record it in `dbg-observed.md`, and
  regenerate the shape;
- **a quirk is gone:** make the correction conditional, and keep a fixture of the old shape;
- **`version` changed:** accept both versions in `dbg-adapter.ts` and `BorielCompiler.ts`, and
  keep the old fixtures as `test/boriel/fixtures-v1/` while any supported kit writes version 1;
- **a kit-structure change:** update `kit.md` and the installer's executable list.

`.ai/boriel/README.md` links to it from "How to re-check", and the handoff's "Next steps" names it.

## 6. The upgrade checklist (what a bump commit must contain)

The brief carries this list, and the bump PR template repeats it.

1. **U-D1:** the author confirms that redistribution permission covers this version. **Manual. It
   cannot be ticked by a script.**
2. `kit.json` comes from `apply`, with `kit-facts.json` updated in the same commit.
3. The fixtures are regenerated (`npm run boriel:fixtures`), `dbg-shape.json` is updated, and the
   quirk list matches what `dbg-observed.md` says.
4. Any adapter change has a unit test on the new fixture that shows it.
5. `.ai/boriel/*.md` re-checked by the "How to re-check" steps, and every version-specific sentence
   updated.
6. `npm test`, `npm run test:e2e` (the `e2e-kbasic` tier runs the Boriel core tests),
   `npm run build:check` and `npm run lint:renderer` all pass.
7. `npx electron-vite build --config build/electron.vite.config.ts`, then
   `node scripts/boriel-ide-check.cjs` with every part passing.
8. `.ai/boriel/dbg-format-fingerprint.json` is updated **only after** `dbg-observed.md` describes the
   new docs. The fingerprint claims that the notes are current, as with the syntax spec.
9. The docs page (`docs/content/working-with-ide/zxb.mdx`) states the new version through U0's
   single source, and `npm run doc:build && npm run doc:check` passes.

## 7. Phase U0 — one place for the version (do this first)

Today `2.0.0-beta25` is hard-coded outside `kit.json` in:

- `src/common/messaging/BorielIntegration.ts`;
- `src/common/i18n/locales/en/dialogs.json`;
- `src/main/boriel-integration/boriel-version.ts`;
- four tests (`test/main/tool-install-archive.test.ts`, `boriel-install-service.test.ts`,
  `boriel-compiler.test.ts`, `boriel-kit-script.test.ts`);
- `test/boriel/fixtures/README.md`;
- `docs/content/working-with-ide/zxb.mdx`.

The changes:

- **Code** reads the version from the manifest (`boriel-kit.ts` already loads it), or from a
  constant generated from `kit.json` at build time if the renderer needs it before IPC.
- **The i18n text** takes the version as a `{{version}}` parameter. This is a key change, so run
  `npm run i18n:keys`. Other locales come through the normal `i18n:todo` flow, never hand-written
  (AGENTS.md).
- **Tests** read `kit.json`. A test that needs to name a version as a literal (for example a parse
  test for `zxbc 2.0.0-beta25` output) keeps its literal, because that string is test data, not
  the pin.
- **The fixtures** get one `test/boriel/fixtures/zxbc-version.txt`, written by `boriel-fixtures.cjs`.
  A unit test fails when it differs from `kit.json`, so a bump without regenerated fixtures cannot
  pass CI.
- **The docs page** says "the version bundled with this Klive release" and, if it must name the
  version, reads it from `kit.json` when the docs are built.

When this is done, `grep -rn "beta25" src test docs/content` finds only test data, and a bump
touches `kit.json`, the fixtures and the `.ai/` notes.

## 8. Phase U5 — the scheduled watch

`.github/workflows/boriel-watch.yml`:

- **Triggers:** `schedule` (daily, 06:00 UTC) and `workflow_dispatch`. **Permissions:**
  `contents: read`, `issues: write`.
- **Steps:**
  1. checkout and Node 22;
  2. `npm run boriel:release-check -- --json`;
  3. `npm run boriel:dbg-format-check -- --json`;
  4. when a version is **ready**, `boriel-kit.cjs candidate --version <v> --no-probe` downloads,
     hashes and checks the structure. It runs nothing (B-T1), so the issue can carry a ready
     `candidate.json` diff.
- **Issue handling:** a small `scripts/boriel-watch-issue.cjs` turns the JSON into a partial brief
  (the steps that need zxbc are marked "run `npm run boriel:upgrade -- <v>` locally"). It then
  opens or updates an issue through `gh`, with a stable title per finding so the job does not open
  a duplicate every day:
  - `Boriel BASIC 2.0.0-beta26 is available`;
  - `Boriel .dbg docs changed: callables, banking`.

  A finding that disappears (a pending version that became ready) updates the issue in place.
- **Failure handling:** exit code 2 (network or parse failure) fails the job but opens no issue, so
  a site outage does not cause noise. Three failures in a row open a `boriel-watch: checker
  broken` issue, because the index or docs layout probably changed and the parser needs work.

Running it locally works too: the same two commands. A Claude Code scheduled task could run
`npm run boriel:release-check` instead of CI if the author prefers that (U-D3).

## 9. Phase U6 — first use: beta25 → beta26

> **Overtaken (2026-10-24):** the pin moved straight from beta25 to `2.0.0-beta29` by hand, before
> U0-U5 existed (`.ai/boriel/README.md`, "Version history"). That run is the first data point on how
> much a beta step changes: three `.dbg` quirks fixed, no schema change. U6 now applies to the next
> version after beta29.

This is the acceptance test for U0-U5, because beta26 is already published (§1.1):

1. The release check reports beta26 as **ready**, with the seven sizes from §1.1.
2. `boriel:upgrade -- 2.0.0-beta26` produces a brief. Its content is the first real data on how
   much one beta step changes. Record it in this plan's "As built" note.
3. Follow §6 to merge the bump, or leave beta25 pinned with the reason recorded if U-D1 is not
   confirmed or the brief shows something blocking.

## 10. Phases at a glance

| Phase | Delivers | Needs |
| --- | --- | --- |
| U0 | One source for the version; a fixture version stamp | — |
| U1 | `boriel-release-check.cjs`, the `targets` table in `kit.json`, the shared version ordering | U0 |
| U2 | `boriel-kit.cjs candidate` / `apply`, `kit-facts.json` | U1 |
| U3 | `boriel-dbg-format-check.cjs`, `dbg-format-fingerprint.json`, `dbg-shape.json`, quirk tests | — (parallel with U1/U2) |
| U4 | `boriel-upgrade.cjs`, the brief, `.ai/boriel/updating.md`, `--out` / `BORIEL_FIXTURES_DIR` | U2, U3 |
| U5 | `boriel-watch.yml`, `boriel-watch-issue.cjs` | U1, U3 (and U2 for the candidate diff) |
| U6 | The beta26 upgrade, done with all of the above | U4, U-D1 |

## 11. Risks

- **The index layout changes** (a new listing page, a CDN). U1 fails with exit 2, and after three
  failures U5 opens an issue (§8). The saved index in the tests makes the parser easy to fix.
- **The docs theme changes** (MkDocs Material update): every page hash changes at once with no field
  change. The report treats "all pages changed, field inventory unchanged" as **cosmetic** and says
  so. `--update` after a quick look clears it.
- **A file is replaced under the same name.** The pinned-kit HEAD check (§2.1) catches it. Package
  builds would also fail on the SHA-256. The fix is to re-run `candidate` for the same version and
  have a person review it, never to update the hash silently.
- **Trust on first download** (U-D2): one compromised download would be pinned. The second download
  and the `ETag`/size check make that less likely, but only a checksum published by Boriel removes
  the risk.
- **Provenance:** the watcher downloads kits, and the brief lists changed `lib/` files by hash. The
  brief and `updating.md` must state that these files are not opened. Only the docs and the
  observed output may be read.
