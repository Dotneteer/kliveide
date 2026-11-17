# ZX Spectrum Next SD cards: one bundled, the rest downloaded and checked

Status: **open** (written 2026-11-17). Phases 0-3 are implemented (2026-11-17); phases 4-6 are not started. Read `dev/ai/zxnext-models.md` first: this
plan changes its D7 (SD card per model) and D9.4 (base images committed) and its "Adding a model"
steps. Its D1 (model ids never change; a model-less reference means `ks2-30201`) stays binding.

## Goal

1. **The installer stops growing by a 50-100 MB card for every new Next model.** It carries one card.
2. **The default Next model is the KS3 with the newest core** (`ks3-30303` today): the model Klive
   offers when the user picks the ZX Spectrum Next machine type, and the one a new project starts on.
   Its card is part of the installer.
3. **Any other model's card is downloaded from kliveide.net** in a dialog when the user picks that
   model. Only after a successful download can that model be instantiated and started.
4. **Whenever Klive starts on a Next, or a Next is selected, it checks that the model's SD card files
   exist and are intact**, and says what is wrong and offers a way out when they are not.

## What is known, and from where

- **No release has ever shipped an SD base image.** `src/public/mmc/` is not in `extraResources` in
  `package.json` (`roms`, `wasm/*`, `keymappings`, `project-templates`, `images`, `boriel` and `cli`
  are), and `files` is `out/**/*`. The installed v0.64.0 app has no `mmc` folder and no `.cim` in
  `app.asar`; the v0.68.1 installers are 151-196 MB, smaller than the three cards together.
  `initializeZxSpectrumNext` (`src/main/machine-menus/zx-next-menus.ts`) finds no base image, skips the
  copy without a word, and the Next boots with no card. Development runs read `src/public/mmc/` and
  work, which is why this was not seen. A user's report (2026-11-17, a MacBook, the Boriel "banked"
  example on a Next) is exactly this.
- **What "Drive C: not found" means** (checked 2026-11-17 by booting each model in the harness with
  the app's own `CimHandler`, reading the text NextZXOS copies to `$E090` before it stops at `$1ED9`):
  - a missing or unreadable card -> "Drive C: not found" (2.10 and 2.10a; the 2.08 ROM has no such
    message);
  - a card of another NextZXOS release -> it stops on `c:/machines/next/enAltZX.rom` (version
    mismatch);
  - every `ks2-base.cim` ever committed (4 versions, Feb 2025 - Jan 2026) boots `ks2-30201`.
- **Sizes.** A model's WASM core is ~0.45 MB and its ROM set with sidecars ~4 MB; only the card is big:

  | ROM set | Models | Card | Raw | gzip -9 |
  |---|---|---|---|---|
  | `nextzxos-2.08` | `ks2-30201` | `ks2-base.cim` (hand-built) | 77 MB | 37 MB |
  | `nextzxos-2.10` | `ks2-30204` | `nextzxos-2.10-base.cim` | 96 MB | 58 MB |
  | `nextzxos-26.11` | `ks2-30303`, `ks3-30303` | `nextzxos-26.11-base.cim` | 52 MB | 24 MB |

  `src/public/mmc/ks2.cim` (77 MB) is byte-identical to `ks2-base.cim` and read by nothing.
- **A card belongs to a ROM set, not to a model**: both 3.03.03 models boot the same base image. The
  working copies are per model (`~/Klive/<sdWorkingCopy>`).
- **The 2.10 and 26.11 cards are built deterministically** by `npm run next-sd:build` from the
  distribution at the set's commit; the 2.08 card is hand-built and cannot be rebuilt by the script.
  Every set's manifest entry (`src/common/zxnext/nextRomSets.json`) pins the raw card's sha256 and
  the sha256 of each ROM, `enAltZX.rom` included. The build script checks that the ROMs on the card
  are the set's ROMs, so **the card's `machines/next/enAltZX.rom` identifies its release.**
- **The site is deployed by committing `docs/out` to `gh-pages`** (`deploy-doc.yml`,
  `JamesIves/github-pages-deploy-action`, `clean-exclude: preview/**`; previews go to
  `preview/<branch>/`). GitHub refuses a file over 100 MB and warns over 50 MB; Pages publishes at
  most 1 GB. Every file committed to `gh-pages` stays in its history.
- **Other ways a card goes wrong today:**
  - `setupZxSpectrumNext` stores the card's full path in `media.sdCard` and keeps any stored path
    that is not another model's default card, **without checking that the file exists.** A moved or
    deleted image, a renamed home folder, migrated settings or a portable-mode switch leaves a dead path.
  - **The DivMMC uses the same `MEDIA_SD_CARD` slot** (`divmmc-menus.ts`), so a DivMMC `.img`/`.hdf`
    chosen on a Spectrum becomes the Next's card.
  - `initializeZxSpectrumNext` only checks that the working copy exists; a copy cut short (disk full)
    is never repaired.
  - At startup `initializeMachineTypes` (`src/main/index.ts`) runs every machine's initializer, so the
    implicit model's card is copied even for a user who never runs a Next.
  - A failing `getSdCardInfo` is only a `console.warn` in `ZxNextWasmV2Machine.ensureSdCardInfo`.
- **Tests that need real cards**: `test/zxnext-hw/rom/nextzxos-boot.test.ts` (every model, from its
  card), `test/main/next-sd-card-file.test.ts`, `test/main/fw-cards.test.ts`, the NextZXOS screen cases
  under `test/visual/`, `dev/scripts/doc-shots/` and `dev/scripts/boriel-ide-check.cjs` (`next`,
  `banked`).

## Decisions

- **D-1 - The download unit is a ROM set's base card.** Models that share a set share a download:
  installing `nextzxos-26.11` makes both `ks2-30303` and `ks3-30303` ready.
- **D-2 - The installer bundles exactly one card: the default model's.** One constant,
  `DEFAULT_NEXT_PROFILE_ID` (`ks3-30303`), is the new-project model (`NEW_PROJECT_NEXT_PROFILE_ID`
  becomes it), the model `defaultModelOf` offers for the machine type, and the model whose set's card
  is bundled. When a newer core becomes the default, the bundled card changes with it. The *implicit*
  model of a model-less reference stays `ks2-30201` (D1 of the models doc), so an old project opens on
  it and asks for its card.
- **D-3 - Only cards are downloaded.** Every model's WASM core and ROM set stay in the installer: they
  are built and tested with that Klive version, so a download never has to match an app version.
- **D-4 - Cards are hosted on kliveide.net, gzipped**, at `https://kliveide.net/next-sd/<setId>.cim.gz`,
  in the `gh-pages` branch but outside `docs/out`: the production deploy gets `clean-exclude:
  next-sd/**`, previews never carry cards. **At most five Next models exist at a time** (the project
  author's rule), so at most five cards are hosted (today 37 + 58 + 24 MB). A card is published once
  and never rewritten; retiring a model removes its card (D-11).
- **D-5 - The app's own manifest is the trust anchor; the host is only transport.** Each set's
  `sdBaseImage` gains `size`, `gzSize` and `gzSha256` beside the raw `sha256`. A download is accepted
  only when both hashes match. HTTPS to the one fixed host only; a test-only override
  (`KLIVE_NEXT_SD_BASE_URL`, honoured only when not packaged) points the downloader at a local server.
- **D-6 - Base images leave git.** `src/public/mmc/` is deleted from the tree (history keeps it). The
  published cards are the source: `npm run next-sd:fetch` downloads and verifies them into the
  git-ignored `.local/next-sd/`, tests resolve them through one helper, CI caches the folder keyed on
  the manifest, and the release workflow fetches the default card into the installer's staging
  folder. **A published `.gz` is never re-packed**: gzip output can change with the zlib version, so
  `gzSha256` is fixed by the first publish and the raw `sha256` is what identifies the card.
- **D-7 - When a model is ready.** A Next model is *ready* when its working copy passes the check
  (D-8), or when its set's card is available (bundled or downloaded) so that the working copy can be
  made. A model that is not ready cannot be instantiated or started. Users with a working copy and no
  base card (developers today) keep working; only Reset then asks for the download.
- **D-8 - The integrity check** (`checkNextSdCard(modelId)`, main process, cheap: a few sectors, no
  full hash) of the card the Next would boot from:
  1. the file exists and is a regular file;
  2. `.cim`: a valid header and a cluster map inside the file (`CimFile`'s own validation); `.img`/`.hdf`:
     a sector count above zero;
  3. a partition NextZXOS can mount (MBR, FAT16/FAT32 volume opens with `Fat32Volume`);
  4. `machines/next/enAltZX.rom` and `nextzxos/enSystem.sys` exist;
  5. `enAltZX.rom`'s sha256 is the model's ROM set's (`files["enAltZX.rom"].sha256`), so a card of
     another release is named as such.
  The base card's full sha256 is computed only after a download or import, and the result is cached by
  size and mtime in the settings.
- **D-9 - Never lose a user's card silently.** A broken working copy is renamed aside
  (`<name>.broken-<yyyymmdd-hhmmss>.cim`) before a new one is made, and the user is told where it is.
- **D-10 - The Next and the DivMMC get separate media slots**: `MEDIA_SD_CARD` stays the Next's, the
  DivMMC's card moves to `MEDIA_DIVMMC_SD_CARD`. Migration on settings load **by the machine the settings
  were saved with** (the project author's answer to Q2): a Next keeps the card, any other machine's card
  moves to the DivMMC slot. **An unset DivMMC slot is an empty slot** (the project author's decision,
  2026-11-17): the DivMMC no longer falls back to a Next working copy, which esxDOS could not boot anyway;
  **Use the Default SD Card** became **Remove the SD Card**.
- **D-11 - Retiring a model** (to stay within five) removes its profile and WASM artifact, aliases its
  id to its successor (`NEXT_PROFILE_ALIASES`, as D1 did for `ks2-30300`), and removes its card from
  the site once no remaining model uses that set. A downloaded card left in `~/Klive/next-sd/` is
  listed in the SD Card menu's housekeeping item (phase 5) so the user can delete it.

## Phases

### Phase 0 - Hotfix: the release boots a Next (a patch release of its own)

1. `extraResources`: ship `src/public/mmc/nextzxos-26.11-base.cim` as `mmc/` (that file only).
2. `NEW_PROJECT_NEXT_PROFILE_ID = "ks3-30303"`; update `dev/ai/zxnext-models.md` D7's "New projects
   start on" and the docs' models page.
3. `initializeZxSpectrumNext`: when the base image is missing, log it in the Emulator pane and, at
   `setupZxSpectrumNext`, show a message box naming the model and offering **Switch to ZX Spectrum
   Next (KS3, core 3.03.03)** or **Select an image...** (texts through `t()`).
4. `setupZxSpectrumNext`: a stored `media.sdCard` that does not exist falls back to the model's
   default card, with a line in the Emulator pane.
5. Delete the unused `src/public/mmc/ks2.cim`.
6. A test (`test/build/packaging.test.ts`) that the default model's set's card is in
   `extraResources`, and a step in `release.yml` that fails when the built app's resources lack it.
7. Changeset (`fix`): the Next booted to "Drive C: not found" in every release, because the SD card
   was not in the installer.

Done when a locally packaged app (`electron-builder --dir`) boots `ks3-30303` and `ks2-30303` to the
NextZXOS menu on a fresh home folder, and the other two models show the message instead of a dead machine.

**As built (2026-11-17):**
- A machine's `setup` may return another model id; `setMachineType` switches to it. That is how
  **Switch to the ZX Spectrum Next (KS3, core 3.03.03)** works from every entry point at once. The
  button is left out when the selected model is the default one.
- The working copy is copied under `<name>.partial` and renamed, so a copy cut short is never taken
  for a card.
- **Reset the Default Image...** changes nothing when the base image is not installed: before, it
  deleted the user's working copy and had nothing to copy back.
- The installer step is `dev/scripts/check-packaged-sd-cards.cjs`, run after the CLI smoke test in
  the Windows, Linux x64 and macOS ARM64 jobs of `release-artifacts.yml` (the jobs that unpack the app).
- The message texts are `messages.sdCard.missing*`; the Emulator pane lines stay English (logs, D9 of
  the i18n guide).

### Phase 1 - The card catalogue and the integrity check (main process, no UI)

1. `src/main/next-sd/` owns where cards live: `bundledCardPath(setId)` (resources), `downloadedCardPath(setId)`
   (`<Klive home>/next-sd/<setId>.cim.gz`), `availableCard(setId)`, `isModelReady(modelId)` (D-7).
   Everything that today calls `defaultSdCardOf().baseImage` goes through it.
2. Manifest: `size`, `gzSize`, `gzSha256` in `sdBaseImage` (D-5), typed in `romSets.ts`;
   `test/zxnext/romSets.test.ts` checks every set has them.
3. `checkNextSdCard(modelId)` (D-8), returning `ok` or one of `missing`, `unreadable`, `noPartition`,
   `noSystemFiles`, `wrongRelease { found }`, each with the path. Unit tests on small cards made with
   Klive's own FAT code (a good one, one per failure); one e2e test runs it on every real card and
   checks that 2.08's card is `wrongRelease` for a 2.10 model.
4. Creating or resetting a working copy decompresses the `.gz` (stream, to a temp file, then rename),
   so an interrupted copy never leaves a half card under the real name.

**As built (2026-11-17):**
- `src/main/next-sd/nextSdCards.ts` owns the paths: `bundledCardPaths`/`bundledCardPath` (the
  installer's `next-sd/<setId>.cim.gz`, then its raw `sdBaseImage.file`), `downloadedCardPath`,
  `availableCard`/`availableCardOf`, `workingCopyPath`, `isModelReady` and `writeCardFrom`.
  `defaultSdCardOf` keeps only `workingCopy`; the menus, Reset and `next-sd-card-file.ts` ask the module.
- `writeCardFrom` checks the **raw** size and sha256 of every working copy it writes, from a raw card or
  a `.gz`, while streaming (`NextSdCardMismatchError`). A wrong or cut-short card leaves no file and
  keeps the card it would have replaced, so Reset can no longer lose a working copy.
- The manifest's `gzSize`/`gzSha256` were recorded by gzipping the committed cards with Node's zlib at
  level 9 (v22.23.4, macOS); those `.gz` files are kept in `.local/next-sd/` for the bootstrap publish
  (phase 3, step 3). Until a card is published its gz facts may be re-recorded; `next-sd:build` now
  records `size` and drops the gz facts when the card's bytes change.
- `checkNextSdCard(file, modelId)` (`src/main/next-sd/checkNextSdCard.ts`, result type in
  `src/common/zxnext/nextSdCardCheck.ts`) takes the file explicitly: choosing which card a Next boots
  stays in `zx-next-menus.ts` (phase 5). A caller that checks the running machine's card wraps it in
  `withSdCardAccess`. The `.cim` step also rejects a cluster that points past the file's end.
- Tests: `test/main/next-sd-check.test.ts` (cards built in memory: writing them through `CimHandler`
  syncs every sector and took 45 s), `next-sd-cards.test.ts`, and `next-sd-check-real.test.ts`, which
  stays in the unit tier (no core). All four real cards pass, the hand-built 2.08 one included.

### Phase 2 - Lazy working copies, the bundled `.gz`, separate DivMMC slot

1. The installer ships `next-sd/<default setId>.cim.gz` (24 MB) instead of the raw card (52 MB).
2. `initializeZxSpectrumNext` no longer runs at startup for every user: a working copy is made the
   first time its model is set up.
3. D-10: `MEDIA_DIVMMC_SD_CARD`, the DivMMC menus and `fmService`/`hard-disk-edit` move to it; settings
   migration; tests.

**As built (2026-11-17):**
- The installer carries `resources/next-sd/nextzxos-26.11.cim.gz` (24 MB instead of 52 MB). It comes
  from `.local/next-sd-stage/`, which `dev/scripts/stage-next-sd.cjs` (`npm run next-sd:stage`) fills at
  the end of `npm run build:app`, so every packaging script and every `release-artifacts.yml` job stages
  it. The stage takes a `.local/next-sd/<setId>.cim.gz` whose hash is `gzSha256` (phase 3's fetch puts it
  there), else gzips the raw card from the repository and checks its raw bytes.
  `check-packaged-sd-cards.cjs` decompresses the packaged card and checks the raw size and sha256.
- No machine `initializer` any more: the Next's was the only one, and it copied a card at every start.
  A working copy is made in `setupZxSpectrumNext`, the first time its model is set up. A packaged app
  started on a 48K now writes no card.
- **The machine names its card in the sector API**: the DivMMC passes `SD_CARD_DIVMMC` (2) to
  `readSdCardSector`, `writeSdCardSector` and `getSdCardInfo`; 0 and 1 stay the Next's cards. The slot
  cannot be chosen from the store's machine id, because a Next asks for its cards' sizes during
  `machine.setup()`, before the emulator publishes the new machine id. `activeSdCardFile()` (store
  based, for the menus, the file manager, the Disk Explorer's lock and the fingerprint) returns the
  DivMMC's card or undefined on any machine that is not a Next.
- The split is `splitSavedSdCardSlots` (`src/main/next-sd/sdCardSlots.ts`), run in `src/main/index.ts`
  before the saved media are dispatched. Projects save `media` but opening one does not restore it,
  so the settings are the only place to migrate.
- Checked on a packaged macOS ARM64 app with an empty home folder: the KS3 3.03.03 made its working
  copy from the `.gz` and booted to the NextZXOS welcome screen; a 48K start made no card.

### Phase 3 - Hosting, fetching and the repository

1. `npm run next-sd:pack -- <setId>`: gzip -9 the built card into `.local/next-sd/`, record `gzSize`
   and `gzSha256` in the manifest. Refuses a set that is already published (D-6).
2. Publishing: `.github/workflows/publish-next-sd.yml` (manual, input `setId`) takes the packed card from
   a workflow artifact or the `.local` upload, checks it against the manifest and commits it to
   `gh-pages:next-sd/`, refusing a sixth card. `deploy-doc.yml` gets `clean-exclude: next-sd/**`;
   `deploy-doc-preview.yml` must not copy cards. `npm run next-sd:check-site` downloads every published
   card and verifies it (by hand and in the release dry run, never in push CI).
3. Bootstrapping: publish the three current cards from the committed files before they are removed.
4. `npm run next-sd:fetch` (all sets, or `-- <setId>`): download, verify both hashes, gunzip into
   `.local/next-sd/<setId>-base.cim`. Tests find cards through one helper, `nextSdBaseImage(setId)`
   (`test/harness/zxnext/core/`), which fails with "run `npm run next-sd:fetch`" when a card is absent.
   `test.yml`, `slow-tests.yml` and `release.yml` run the fetch behind `actions/cache` keyed on
   `hashFiles('src/common/zxnext/nextRomSets.json')`.
5. `next-sd:build` writes into `.local/next-sd/` and updates the manifest; delete `src/public/mmc/`;
   `release.yml` fetches the default card into a staging folder that `extraResources` reads.
6. doc-shots, the IDE checks (`boriel-ide-check`, `kbasic-ide-check`) and the visual tests find cards
   through the helper or the fetch.

**As built (2026-11-17):**
- **Publishing is a local script, not a workflow** (`npm run next-sd:publish -- <setId> [--push]`). A
  `workflow_dispatch` workflow runs only from the default branch, and CI could not make the bytes anyway:
  the `.gz` is packed once on the author's machine and `gzSha256` names those bytes (D-6); the 2.08 card
  cannot be rebuilt at all. The script commits onto `gh-pages` without a checkout (a temporary index over
  `git fetch --depth=1 origin gh-pages`), checks the `.gz` against the manifest, never rewrites a published
  card, refuses a sixth, retries when a docs deploy moved the branch, and pushes only with `--push`.
  `KLIVE_NEXT_SD_REMOTE` names another remote (the tests use a bare repository).
- `deploy-doc.yml` keeps `next-sd/**` (`clean-exclude`). **That change must be on master before the
  first card is published**, or the next docs deploy deletes it.
- `npm run next-sd:pack -- <setId>` gzips the raw card (`.local/next-sd/<setId>-base.cim`, or the committed
  one) and records `gzSize`/`gzSha256`; it refuses a set whose card answers 200 on the site. Re-packing the
  26.11 card gave the bytes recorded in phase 1.
- `npm run next-sd:fetch [-- <setId>...]`: a raw card that is the manifest's is kept; else a local `.gz`
  that is the manifest's is decompressed; else the published card is downloaded
  (`KLIVE_NEXT_SD_BASE_URL`) and decompressed; else, **until step 5**, the committed raw card is copied.
  `npm run next-sd:check-site` downloads and checks every published card. The shared code is
  `dev/scripts/next-sd/cards.cjs` (`KLIVE_NEXT_SD_LOCAL` names another local folder for tests).
- A download that comes back with a `Content-Encoding` is refused: a server that compressed the `.gz`
  again (or a client that undid it) would not give the published bytes. Phase 4's downloader must ask for
  `identity` and do the same.
- Tests find cards through `nextSdBaseImage(setId)` (`test/harness/zxnext/core/sdCards.ts`), which falls
  back to the committed card until step 5. `test.yml`, `slow-tests.yml` and every `release-artifacts.yml`
  build fetch the cards behind `actions/cache`, keyed on the manifest and the fetch code.
- **A development Klive takes the fetched cards too**: `src/main/index.ts` sets
  `KLIVE_NEXT_SD_DEV_CARDS` to `.local/next-sd` when the app is not packaged, and `bundledCardPaths` tries
  it after the resources. Step 5 depends on it: without `src/public/mmc` a development run has no card.
- The Boriel, Klive BASIC and z88dk IDE checks copied `~/Klive/ks2.cim`, which Klive no longer makes at
  startup and which is not the default model's card since phase 0. They now copy the default model's
  fetched base card as its working copy (`defaultNextCard`, `defaultNextModel` in `cards.cjs`, pinned to
  `nextProfiles.ts` by a test). The browser tier clones `~/Klive/ks2.cim` when there is one, else the
  fetched 2.08 card.
- **Published (step 3):** the three cards went onto `gh-pages` once `deploy-doc.yml`'s `clean-exclude` was on
  master, each as its own commit on top of the site; `next-sd:check-site` found all three the manifest's,
  gzipped and raw. A failing docs deploy never touches `gh-pages`, so the cards are safe while the site is
  not deploying.
- **Step 5:** `src/public/mmc` is deleted and the manifest's `sdBaseImage.file` with it: a card's name follows
  from its set id (`<setId>-base.cim`, `<setId>.cim.gz`). `next-sd:build` writes `.local/next-sd/<setId>-base.cim`;
  fetch, pack, stage, `defaultNextCard` and `nextSdBaseImage` read only `.local/next-sd/`, and the app's
  `bundledCardPaths` only the installer's `.gz` and, in development, `.local/next-sd/`. The doc-shots
  recipes that seeded `~/Klive/ks2.cim` copy the fetched 2.08 card. A set that is not published yet gets its
  card from `next-sd:build` only.

### Phase 4 - The download dialog

1. Main: `downloadNextSdCard(setId, { onProgress, signal })` with Electron's `net` (system proxy), the
   fixed host (D-5), a size cap from the manifest, a temp file, both hash checks, and a disk-space check
   before it starts. `importNextSdCard(setId, file)` takes a `.cim.gz` or `.cim` the user downloaded
   elsewhere, with the same checks, for users behind a firewall.
2. Renderer: a Model/Controller/View dialog (`dev/ai/ui-mvc-guide.md`): the model, the size, a progress
   bar, Cancel, the error with Retry, **Import a downloaded file...**, and the URL to copy. All texts
   through `t()` with translator context.
3. Tests: controller tests without rendering; the downloader against a local HTTP server (the D-5
   override) for success, a wrong hash, a truncated body, cancel and a refused host.

### Phase 5 - Every way to a Next goes through the gate

1. `ensureNextModelReady(modelId, { interactive })` runs in `setupZxSpectrumNext`, which every machine
   change reaches through `setMachineType`: not ready and interactive -> the download dialog; declined
   or failed -> `setMachineType` returns `false` and the previous machine stays (its callers already
   handle `false`). Non-interactive callers (CLI, scripts) get an error naming the model and the command
   to download it.
2. The entry points, each with a test that it reaches the gate: the Machine type menu, the Select
   Machine dialog, favourites, New Project and Make Project, opening a project, restoring the last
   machine at startup, loading a machine state file or debug recording, the IDE's command line and the
   `klive` CLI.
3. `checkNextSdCard` runs at startup on a Next and on every Next selection. A failure opens one dialog
   that says what is wrong and offers what fits: **Reset to the default card** (D-9), **Select an
   image...**, **Download** (base card missing), **Continue anyway**. `ensureSdCardInfo` reports a card
   it cannot read in the Emulator pane instead of only `console.warn`.
4. The model lists (Select Machine dialog, New Project, Machine type menu) mark a model that is not
   ready with "download needed, NN MB".
5. Machine > SD Card gets **Manage downloaded cards...**: what is downloaded, its size, delete (not the
   bundled one, not a card a model in use needs).

### Phase 6 - Records, docs and closing

1. `dev/ai/zxnext-models.md`: D7 and D9.4 rewritten for this plan; "Adding a model" gains *build, pack,
   publish the card*, the five-model limit and retiring (D-11); "Where each piece lives" names
   `src/main/next-sd/` and `.local/next-sd/`.
2. `AGENTS.md`'s ZX Spectrum Next models section: cards are fetched, not committed.
3. Docs: `guides/next/sd-card.mdx` (the bundled card, downloading, the check and its dialog, where
   downloaded cards live) and `guides/next/next-models.mdx` (which model is the default, which need a
   download). Translated pages through `doc:i18n:todo`/`merge` only.
4. `npm run test:slow`, the `boriel-ide-check` `next` and `banked` parts on a fresh home folder, a packaged
   app on macOS and Windows with no network (default model only, the dialog's offline path).
5. Changeset (`feature`) for phases 1-5 as one change; the plan's as-built notes; close the plan.

## Open questions

- ~~**Q1 - Startup on a model that is not ready, and the user declines the download.**~~ Decided
  2026-11-17 (the project author): the session runs the default model and says so; the project's saved
  model is not rewritten until the user changes the machine on purpose. Needs a way for `setMachineType`
  to switch without saving.
- ~~**Q2 - D-10's migration**~~ Decided 2026-11-17: by the machine the settings were saved with (D-10).
- ~~**Q3 - Keep the downloaded `.gz` after the working copy is made?**~~ Decided 2026-11-17 (the project
  author): yes (Reset needs it; 24-58 MB); the housekeeping item lets the user delete it.
- ~~**Q4 - Is the 2.08 card worth hosting**~~ Settled 2026-11-17: the project author published it with the
  other two, so `ks2-30201` (the model old projects open on, D1) keeps a card and the implicit model stays.
