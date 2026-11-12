# ZX Spectrum Next models: boards and core versions

Read this before adding a Next model or a behaviour that depends on the core version or the board.
It replaces `dev/plans/ZXNEXT_CORE_VERSIONS_PLAN.md`, which was fully implemented and closed on
2026-11-04; the plan, with its survey and phase list, is in git history at that path. Code cites
the decision IDs below (D1, D2, ...); they keep their meaning.

The hardware delta between the two shipped cores, classified per device, is
`dev/ai/zxnext-cores/30201-to-30204.md`.

## What a model is

`MI_ZXNEXT` is one machine with several models. Each model is a *Next profile*: a pair
(board, core version) with its own WASM artifact, VHDL reference, NextReg set, ROM set and SD card.
Shipped profiles:

| Model id | Board | Core | Artifact | ROM set (NextZXOS) | SD working copy |
|---|---|---|---|---|---|
| `ks2-30201` | KS2 (board issue 2 = Issue 4 PCB) | 3.02.01 | `zx-spectrum-next.wasm` | `nextzxos-2.08` | `~/Klive/ks2.cim` |
| `ks2-30204` | KS2 | 3.02.04 | `zx-spectrum-next-ks2-30204.wasm` | `nextzxos-2.10` | `~/Klive/ks2-30204.cim` |
| `ks2-30303` | KS2 | 3.03.03 | `zx-spectrum-next-ks2-30303.wasm` | `nextzxos-26.11` (2.10a) | `~/Klive/ks2-30303.cim` |
| `ks3-30303` | KS3 (board issue 3 = Issue 5 PCB) | 3.03.03 | `zx-spectrum-next-ks3-30303.wasm` | `nextzxos-26.11` (2.10a) | `~/Klive/ks3-30303.cim` |

The 3.03.03 models depart from D4: core 3.03's VHDL is not published, so its delta (the zxnDDMA and
zero wait states at 28 MHz) is built from the distribution's guide and its release page and every such guard is marked `VHDL-PENDING(3.03.03)`; their
`vhdlRef` is 3.02.04, whose VHDL has the issue 5 board. `dev/plans/ZXNEXT_3_03_PLAN.md` holds the
decisions (D-A to D-G) and what to do once the VHDL appears.

## Decisions

- **D1 - One machine, many models.** Model ids never change once shipped. `standard` and
  `compatibility` (the old single model and its alias) mean `ks2-30201`; so does a Next reference
  with no model id (`IMPLICIT_NEXT_PROFILE_ID`, the registry's `implicitModelIds`). Old projects,
  favourites and state files therefore open on the model they were made with.
- **D2 - A profile is data, owned by one module**, `src/emu/machines/zxNext/nextProfiles.ts`
  (neutral, no emulation). **Nothing reads "which Next" from a literal**: the core version, board,
  artifact, ROM set, SD card, NextReg set and VHDL version all come from the active profile
  (`nextProfileOf(modelId)`, `coreVersionOf`, `romSetOf`).
- **D3 - One C source tree, one WASM artifact per distinct hardware, chosen by compile-time
  defines.** `zxnext-profile.h` defines `ZXNEXT_CORE_VERSION` (MMmmss, e.g. `30204`) and
  `ZXNEXT_BOARD_ISSUE`; a behaviour a later core changed is guarded with
  `#if ZXNEXT_CORE_VERSION >= 30204`. A changed subsystem would get a second file selected by the
  build, never a forked tree (not needed so far: the 3.02.04 delta is all guards). Two profiles with
  the same hardware share an artifact. Hot paths pay nothing for another profile.
- **D4 - The VHDL reference is downloaded, versioned and never committed.** The pins (upstream
  `gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA`, full commit SHA, expected upstream blob ids) are
  in `dev/vendor/next-fpga/sources.json`; `npm run next-fpga:fetch` puts each version in the git-ignored
  `dev/vendor/next-fpga/<version>/`. Upstream has no tags; versions are branches, except 3.02.01, which
  is pinned to commit `5ad7546d` (the last before "Bump core number to 3.02.02"). Pin commits, not
  branch names. Readers resolve files through `nextFpgaPath(version, file)`
  (`dev/scripts/next-fpga-path.cjs`), which names the fetch command when the tree is missing. A
  citation names the version (`zxnext.vhd@3.02.04 ~5186`); an unversioned one means 3.02.01. Nothing
  in CI reads the VHDL.
- **D4.1 - Klive's VHDL comments are tracked patches** in `dev/vendor/next-fpga/comments/<version>/`,
  mirroring the upstream tree, applied by the fetch after the blob-id check (stamp
  `.klive-comments`). Edit the fetched file, then `npm run next-fpga:comments -- --save <version>`;
  never hand-edit a `.patch`. `--carry <from> <to>` starts a new version's patches from an older
  version's and lists the hunks that did not apply.
- **D5 - NextReg descriptions are a base set plus per-version deltas.** The 3.02.01 set is
  `nextRegDescriptors.ts`; `nextRegSets/<core>.ts` lists only added, removed or re-meant registers
  and bits; `nextRegSets/index.ts` applies them. The machine exposes the active set
  (`IZxNextIdeMachine.getNextRegDescriptors`) and the NextReg panel, Copper view, breakpoints and
  disassembler read it from there. Register *names* that source text or breakpoint expressions
  accept use the **union** of every set, since source does not know which model it runs on.
  (Assembler-side NextReg names were an idea, dropped on 2026-11-04.)
- **D6 - ROM-coupled addresses are facts of the ROM set, proved per set.** The NextZXOS key-wait
  loop, the main waiting loop (HALT), and the ROM 3 LD-BYTES tape routines live in the set's `facts`
  in `nextRomSets.json`, not in code. The tape trap addresses are host-written into the core at load
  (`zxnextTapeSetRomRoutines`; volatile, host-owned). `test/zxnext-hw/rom/rom-facts.test.ts` proves
  every fact against the real ROM bytes, so a new ROM set cannot silently break code injection or
  tape loading.
- **D7 - SD card per model.** Each profile has its own base image and working copy; `ks2.cim` stays
  the `ks2-30201` copy (no rename). Machine > SD Card > Default/Reset act on the active model's copy;
  another model's default card counts as no choice, so a model never boots a mismatched NextZXOS. A
  user-selected SD file still overrides. **New projects start on `ks2-30204`**
  (`NEW_PROJECT_NEXT_PROFILE_ID`, the registry's `newProjectModelIds`, the default favourite);
  model-less references still mean `ks2-30201` (D1).
- **D8 - ROM annotations follow the annotation provenance rule** (`dev/ai/rom-annotations/README.md`,
  D4 there). A page whose CRC is unchanged reuses its sidecar. For changed pages,
  `npm run rom:annotations:carry -- <fromSidecar> <toRom>` (`dev/scripts/rom-annotations-carry.cjs`,
  core in `src/common/roms/romCarry.ts`, tested by `test/annotations/romCarry.test.ts`) re-anchors
  each annotation by a byte signature and lists what it cannot place for hand review. Nothing is
  taken from a published commented disassembly. The 2.10 set was carried, then authored from its
  own bytes to level 2 (`dev/ai/rom-annotations/PROVENANCE.md`, 2026-10-31; review lists in
  `dev/ai/rom-annotations/carry-review/`).
- **D9 - ROMs come from the official distribution, fetched once when a model is implemented, then
  committed.** Source: `gitlab.com/thesmog358/tbblue`, `machines/next/`; its releases are branches
  (`KS2` = NextZXOS 2.08, the 3.02.01 set; `KS3` = NextZXOS 2.10, which ships core 3.02.04 for KS2
  boards too). The app and tests read only committed files and never touch the network.
  - **D9.1** The ROM facts (D6), sidecars (D8), the NextZXOS decoder's entry points and the SD base
    image belong to the *ROM set*; only the hardware (artifact, NextReg set, `$01`/`$0E`) belongs to
    the core. Two profiles with the same ROMs name one set. A newer distribution release is a new set
    with a new name, never a re-fetch over a committed set.
  - **D9.2** `npm run next-roms:fetch -- <setId> --ref <branch|commit>` resolves the ref with
    `git ls-remote`, downloads raw files (not the rate-limited REST API), writes
    `src/public/roms/zxnext/<setId>/` and the manifest entry. It refuses to overwrite a set in the
    manifest without `--replace` (only for a set not shipped yet). It does not guess facts.
  - **D9.3** A unit test (`test/zxnext/romSets.test.ts`) checks every set against the committed
    files (size, sha256, page CRCs); `romIdentity.ts`'s Next CRC table is generated from the
    manifest; the ROM loader checks page CRCs at load. `npm run next-roms:check -- --online` re-downloads
    and compares, by hand only, never in CI.
  - **D9.4** The SD base image is built from the distribution at the set's commit by
    `npm run next-sd:build -- <setId>` (`dev/scripts/build-next-sd-image.cjs`, deterministic) into
    `src/public/mmc/<setId>-base.cim`, committed, its sha256 in the set's `sdBaseImage`.
  - **D9.5** Layout: one folder per set, `src/public/roms/zxnext/<setId>/` (ROMs and their `.rom.dis`
    sidecars). Every reader finds a file through one helper, `nextRomPath(setId, file)`
    (`src/common/zxnext/romSets.ts`); tests use `nextRomFile()` (`test/harness/zxnext/core/roms.ts`).

## Where each piece lives

| Piece | Location |
|---|---|
| Profiles, aliases, implicit and new-project model, display name, state core id | `src/emu/machines/zxNext/nextProfiles.ts` |
| Machine models in the registry | `src/common/machines/machine-registry.ts` (`MI_ZXNEXT`) |
| Compile-time defines | `src/emu/machines/zxNext/wasm/zxnext/zxnext-profile.h` |
| Artifact list (must match `NEXT_PROFILES`) | `dev/scripts/zxnext-artifacts.cjs`, checked by `test/wasm/zxNext/wasm-next-artifacts.test.ts` |
| NextReg sets | `src/emu/machines/zxNext/nextRegDescriptors.ts` (base), `nextRegSets/` |
| VHDL pins and comments | `dev/vendor/next-fpga/sources.json`, `dev/vendor/next-fpga/comments/<version>/` |
| VHDL scripts | `npm run next-fpga:{fetch,comments,diff}` (`dev/scripts/next-fpga-*.cjs`) |
| ROM set manifest (provenance, hashes, page CRCs, facts, SD image) | `src/common/zxnext/nextRomSets.json`, typed by `src/common/zxnext/romSets.ts` (`nextRomPath`, `nextRomFolder`) |
| ROMs and sidecars | `src/public/roms/zxnext/<setId>/` |
| SD base images | `src/public/mmc/` (`ks2-base.cim` for 2.08, `nextzxos-2.10-base.cim`, `nextzxos-26.11-base.cim`) |
| SD card menus | `src/main/machine-menus/zx-next-menus.ts` |
| ROM loading, CRC check, facts written to the core | `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts` |
| NEX minimum-core check | `NexFileViewerPanel.tsx`, against the active model |
| Test ROMs | `test/harness/zxnext/core/roms.ts` (`nextRomFile()`, `readNextRom()`) |
| User docs | `docs/content/en/guides/next/next-models.mdx` |

## Rules

- Nothing reads "which Next" from a literal: it comes from the active profile (D2).
- A version-sensitive hardware test runs every profile: `createSession({ profile })` with
  `forEachProfile(...)` from `test/harness/zxnext/script/profiles.ts`. Same expectation where the
  versions agree, a per-profile one where they differ, citing the VHDL of each version. One that runs
  only one profile is a review smell.
- After every guarded change, the 3.02.01 artifact stays byte-identical in behaviour: its boot
  traces and goldens are the proof that a guard leaked nowhere.
- Keep the fast test tier to one representative case per artifact (e.g. `debug-loop-equivalence`,
  journal-replay determinism); exhaustive per-profile sweeps go to `e2e-slow` (`build/e2e-tests.ts`).
- Tests find ROMs through `nextRomFile()` / `readNextRom()`, never by a path literal.
- Model display names are not translated (`dev/ai/i18n-guide.md`, D9 there).

## As-built details worth knowing

- The manifest is `nextRomSets.json`, not `romSets.json`: tsconfig-paths in scripts resolved
  `@common/zxnext/romSets` to the `.json`. Each set has five ROMs (`enNextLG.rom` belongs to it) plus
  the FPGA boot ROM `bootrom_ab.bin`.
- `ks2-base.cim` kept its name and is referenced from the 2.08 set's manifest entry.
- The 2.08 set's ROM annotation working copies stay flat in `~/Klive/RomAnnotations/`
  (`romSidecarPaths.ts`); other sets nest by set id.
- The layout fingerprint does not see code, so two artifacts with the same statics could take each
  other's states. State files, debug recordings and boot checkpoints therefore carry a per-model
  core id (`stateCoreIdOf`: `zxnext` for `ks2-30201`, so earlier files open; `zxnext/<id>`
  otherwise), and the refusal message names both models.
- `$0E` reads `.01` on 3.02.01 (it used to claim 3.02.00); `$01`/`$0E` come from `zxnext-profile.h`.
- 3.02.04 facts: key-wait loop $0C98-$0CBE, HALT $0CB5; ROM 3 tape routines unchanged.
  `nextzxos-boot.test.ts` boots each model from its own card into its loop.
- The Next ROM decoder lists each set's inline-data call addresses (2.10 moved four, and its
  alternate ROM page 0 gained `RST $30` + a ROM 2 word); `nextRomDecoder.test.ts` proves no set uses
  another's.
- Delta items 1, 2 and 4-8 are guarded in C with tests on both profiles. Item 3 (ULA I/O contention)
  is skipped: neither version models I/O contention. Item 4's EAR polarity follows the VHDL pin
  chain, not confirmed on hardware.
- The ROM Annotations menu groups the Next's ROMs by NextZXOS release.
- **A set is named after its NextZXOS release, or after the distribution release when NextZXOS kept
  its number**: `nextzxos-26.11` is NextZXOS 2.10a (the 26.11 distribution), whose bytes differ from
  the `KS3` branch's 2.10. Its changes are all in place (the version word $E210 -> $A210, ROM 3's
  TONE_OUT back to the 48K ROM's, the alternate ROM's PLAY without the CPU-speed switch), so its
  sidecars are 2.10's at the same offsets plus a carry for the moved PLAY code.
- **A set has no `fpgaRoms` when its core's boot ROM is not published** (`nextzxos-26.11`); identical
  boot ROM bytes are named by their first set anyway.
- **An SD base image must stay under GitHub's 100 MB file limit**: a set's `sdBaseImage.exclude` leaves
  distribution paths off its card (`nextzxos-26.11` leaves out `extras/nextest`, the 52 MB factory
  board test). `next-roms:fetch -- --git` reads the files through Git when GitLab's raw URLs answer
  HTTP 429.
- **The KS3's memory (D-G of the 3.03 plan)**: 4 MB of SRAM, the upper 2 MB kept after the 8K error page
  in the core's array (`zxnextSramOffset`), so every offset below $202000 is the same on every board
  and the IDE's layout (`nextMemoryLayout.ts`) needs no board. The MMU reaches pages 0-223 on every
  board (`zxnext.vhd@3.02.04 ~3258`); only config-mode NextReg `$04` (8 bits on issue 5, ~6218) and
  the zxnDDMA's physical addresses reach the upper block. The loader accepts both memory sizes.
  `session.sramBytes(physical)` reads SRAM by physical address in tests.

## Adding a model

1. **Reference material.** Add the core's pin to `dev/vendor/next-fpga/sources.json` (full commit SHA,
   upstream blob ids), `npm run next-fpga:fetch`, carry the comments
   (`npm run next-fpga:comments -- --carry <old> <new>`), and classify the delta with
   `npm run next-fpga:diff` into `dev/ai/zxnext-cores/<old>-to-<new>.md`.
2. **ROMs.** If the model boots a new NextZXOS: `npm run next-roms:fetch -- <setId> --ref <ref>`,
   commit the files and manifest entry; `npm run next-sd:build -- <setId>` and commit the image.
   Otherwise name an existing set.
3. **ROM facts.** Fill in the set's `facts` by hand from the ROM bytes; extend `rom-facts.test.ts`
   and the ROM decoder's inline-data addresses.
4. **Profile.** Add the record to `NEXT_PROFILES` (new id, never reuse one), the artifact to
   `dev/scripts/zxnext-artifacts.cjs` (or share one), the model to the registry.
5. **NextReg set.** Add `nextRegSets/<core>.ts` with the delta and register it in `index.ts`.
6. **Hardware.** One delta item at a time, behind `#if ZXNEXT_CORE_VERSION >= <new>` (or the board
   define), each with a harness test on every profile; check the older artifacts stay unchanged.
7. **Annotations.** Unchanged pages reuse sidecars; carry changed ones with
   `npm run rom:annotations:carry`, review, then author; append to `PROVENANCE.md`.
8. **IDE and docs.** New-project default and favourite if it should change (D7), the models page in
   the docs, `npm run i18n:keys` if any text was added, a `feature` changeset, `npm run test:slow`.

KS3 fits the same steps: the board is a profile field and a compile-time define, its top file
(`zxnext_top_issue*.vhd`) is part of the versioned VHDL.

## Open

- **Per-profile visual goldens** for screen cases that boot NextZXOS are not recorded (they are
  recorded only after checking by eye). The current visual suites (`copper`, `parity`) do not boot
  NextZXOS, so nothing needs them yet.
- **`nextreg.txt.patch`** (3.02.01 and its 3.02.04 carry) holds two stray edits, not comments; drop
  it now that `dev/research/next-fpga/` is gone and nothing compares against it.
- **`t80na.vhd.patch`**: its pin descriptions should be checked for provenance.
- **ULA I/O contention** (delta item 3) is modelled in neither version; a separate fidelity item.
- **EAR polarity** on 3.02.04 (delta item 4) is unconfirmed on hardware.
- Upstream is at 3.02.05 (branch `30205`); adding it is one manifest entry plus the steps above.
- **Core 3.03's VHDL** is not published; `dev/plans/ZXNEXT_3_03_PLAN.md` phase 7 lists what to do
  when it is (pin, classify, check every `VHDL-PENDING(3.03.03)`, which reads lost the 28 MHz wait).
- **The IDE does not show the KS3's upper 2 MB** (memory panels, bank pickers, profiler): it is
  reached only through config mode and the DMA.
- Offering a second NextZXOS for the same core is possible by the data model (D9.1) but has no UI.
