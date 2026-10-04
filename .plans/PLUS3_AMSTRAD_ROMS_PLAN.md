# ZX Spectrum +2A / +3 with the Amstrad ROMs (G9.2)

Status: **decisions recorded** (2026-10-04; §8). Ready for Phase 0.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G9 (G9.2, size S–M).

> **Standing rule (from the base plan):** when this ships, update §2 and §4 of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) and mark G9.2 done
> in the base plan, in the same change. A visual change (only the machine list is expected to
> change) also updates `.ai/ui-theming-intent-and-lessons.md`.

---

## 1. What is being added

Klive emulates the +2A/+3 *hardware* already: the `spp3e` C/WASM core
(`src/emu/machines/zxSpectrumP3e/`) is the Amstrad gate array, the `$7FFD`/`$1FFD` paging, the
uPD765 FDC and the AY. What it does not have is the **original Amstrad ROMs**: every model boots
Garry Lancaster's +3E ROMs (`src/public/roms/spp3e-0..3.rom`). The +3E is a ROM replacement for the
same machine, so G9.2 is a ROM-set feature, not a new core.

After this change the machine list offers (Q1: every Amstrad ROM version, not just v4.1):

| Model id | Display name | ROM set | Drives |
|---|---|---|---|
| `plus2a` | ZX Spectrum +2A | `amstrad41` (v4.1 English) | none |
| `plus2a-es` | ZX Spectrum +2A (Spanish) | `amstrad41es` (v4.1 Spanish) | none |
| `plus3-fdd1` / `plus3-fdd2` | ZX Spectrum +3 (1 FDD / 2 FDDs) | `amstrad41` | A / A, B |
| `plus3-v40-fdd1` / `plus3-v40-fdd2` | ZX Spectrum +3 v4.0 (1 FDD / 2 FDDs) | `amstrad40` (v4.0 English, the 1987 +3) | A / A, B |
| `plus3-es-fdd1` / `plus3-es-fdd2` | ZX Spectrum +3 (Spanish, 1 FDD / 2 FDDs) | `amstrad41es` | A / A, B |
| `plus3-v40-es-fdd1` / `plus3-v40-es-fdd2` | ZX Spectrum +3 v4.0 (Spanish, 1 FDD / 2 FDDs) | `amstrad40es` | A / A, B |
| `nofdd`, `fdd1`, `fdd2` | ZX Spectrum +2E / +3E (unchanged) | `plus3e` | as today |

The +2A shipped only with v4.1, so it gets no v4.0 models. A ROM set that turns out to be missing
from the chosen archive (§4) drops its models; the rest of the plan is unaffected.

and everything that already works on the +2E/+3E works on the new models: run/debug, code
injection, the tape Loader, `.dsk` disks, snapshots, Klive state files, the compilers.

Snapshots: a .z80/.szx of a +2A or +3 still loads on the +E models by default (Q4), but it now
stays on an Amstrad model when the project already uses one, without the "+E ROMs instead of the
Amstrad ones" warning (`src/common/spectrum/snapshot/spectrumSnapshotMapping.ts`). A snapshot saved
from an Amstrad model is written as a +2A/+3, not "+3e".

## 2. What the code looks like today (the foundation)

- **Registry.** `machine-registry.ts` has one machine, `MI_SPECTRUM_3E = "spp3e"`
  ("ZX Spectrum +2E/+3E"), with models `nofdd`, `fdd1`, `fdd2`, which differ only in
  `MC_DISK_SUPPORT`. Saved projects and favorites (`machine-favorites.ts`) refer to these ids, so
  they never change.
- **ROM loading.** `ZxSpectrumP3eWasmV2Machine.setup()` loads `roms/${this.romId}-0..3.rom`;
  `romId` is `machineId` (`ZxSpectrumBase.romId`). `hardReset` replays the uploaded pages. The 48K
  has the precedent for a per-model ROM (`MC_SP48_ROM_FILE`), the ZX80 for a ROM chosen by a model
  config flag (`MC_ZX80_ROM8K`).
- **ROM-address-dependent flows.** `ZxSpectrumP3eWasmHost.getCodeInjectionFlow` and
  `getTapeLoadFlow` (`menuTapeLoadFlow`) wait for `SPP3_MAIN_WAITING_LOOP = $0706` (ROM 0) and
  `SPP3_RETURN_TO_EDITOR = $0937` (ROM 1) in `ZxSpectrumBase.ts`. Both are **+3E ROM addresses**;
  the Amstrad ROMs need their own. The "48 BASIC" path then waits for `SP48_MAIN_ENTRY` in ROM 3,
  which has to be confirmed for v4.1 too. These are the only ROM addresses found (`grep SPP3_`).
- **Snapshots.** Capture (`spectrumSnapshotCapture.ts`) always reports the `spp3e` core as
  `"plus3e"`; the writers (`szxWriter.ts` machine ids 4/5/6, `z80Writer.ts` hardware modes)
  already know `plus2a` and `plus3`. Mapping sends `plus2a`/`plus3` to the +E models with a warning.
- **State files.** `kliveStateFile.ts` records `machineId`, `modelId` and `config`; the core's
  state image is its whole linear memory, ROM pages included.
- **Specs and harness.** `hardware-specs.ts` lists `spp3e-0..3` as the ROMs, with per-model
  overrides available (`models?: Record<string, Overrides>`). The test harness
  (`test/harness/sp128/session.ts`) reads `spp3e-${page}.rom` by name.
- **Compilers.** sjasmplus, Pasta/80 and Klive BASIC select by `machineId` only (`zxplus3`
  target). The Klive BASIC ROM-switch runtime (`src/main/kbasic/runtime/rom.kz80.asm`) uses the
  `BANKM`/`BANK678` system variables, which the Amstrad ROMs define too — to be proven, not assumed
  (Phase 4).
- **No IDE interface** is emulated in `spp3e.c`, so nothing +3E-specific in the core needs to be
  switched off.

## 3. Decisions

- **P1. Same machine, new models.** The +2A/+3 stay on `MI_SPECTRUM_3E` as new models
  (listed in §1); the machine's display name becomes "ZX Spectrum +2A/+3/+2E/+3E" (Q3). A separate machine id would duplicate the registry entry, the menu
  registry, the state-menu lists and every `MI_SPECTRUM_3E` switch for no hardware difference.
- **P2. The ROM set is model config.** A new config key `MC_SP3_ROM_SET = "sp3RomSet"` with values
  `"plus3e"` (default when absent, so existing projects and state files are unchanged),
  `"amstrad40"`, `"amstrad41"`, `"amstrad40es"` and `"amstrad41es"`. `ZxSpectrumP3eWasmHost` overrides `romId` from it.
- **P3. ROM files are named by set:** `src/public/roms/spp3-40-*.rom`, `spp3-41-*.rom`,
  `spp3-40es-*.rom`, `spp3-41es-*.rom` (pages 0–3).
- **P4. One ROM-set table owns the addresses.** A small `p3RomSets.ts` maps each set to
  `{ romId, mainWaitingLoop, returnToEditor, sp48MainEntry, snapshotKind(drives) }`; the host's flows
  and the snapshot capture read it. No address literal is added anywhere else.
- **P5. ROM addresses are found by observation.** The two entry points are located by running the
  ROM in the harness (where the menu idles in its key-wait loop; where "+3 BASIC" settles in the
  editor) and recorded in Klive's words, once per ROM set (v4.0 and v4.1 may differ, the Spanish
  ROMs even more) — the same provenance discipline as D4 / Klive BASIC. No third-party ROM
  disassembly is copied.
- **P6. The E models stay the default (Q4).** Favorites are unchanged, and snapshot mapping lists
  the +E models first and the Amstrad models after them (Phase 3).

## 4. Licensing and provenance of the ROM images

Amstrad has allowed the Spectrum ROMs to be distributed with emulators free of charge, provided the
copyright messages in the ROMs are kept and they are not sold. Klive is free, so the +2A/+3 ROMs can
ship like `sp48.rom` and `sp128-*.rom` do.

- Add `src/public/roms/spp3-roms-readme.txt` stating the Amstrad permission and the source of the
  images, in the style of `zx8081-roms-readme.txt`, and a line in `THIRD_PARTY_NOTICES.md`.
- Record each page's size and CRC32 in a test (Phase 0), so a wrong or corrupted image fails CI
  rather than booting to a garbled menu. The values are taken from the files when they are added,
  not written from memory.
- **Source (Q2): a known archive** that distributes the Amstrad ROMs under that permission (for
  example the ROM set shipped with an established open-source emulator, or a long-standing Spectrum
  archive). Phase 0 picks one archive for all four sets where possible; the readme records its name,
  URL, the original file names and the date taken. Version and language are confirmed from each image
  itself (the menu's copyright line, booted in the harness), never assumed from a file name.

## 5. Phases

### Phase 0 — ROM images (S)
1. Take the four ROM sets (16 pages of 16 KB) from the chosen archive (§4), add them under P3's
   names with the readme, and update `THIRD_PARTY_NOTICES.md`.
2. Test `test/machines/p3-rom-images.test.ts`: per set, four files of 16 384 bytes, CRC32 as
   recorded, ROM 0 contains the Amstrad copyright text; no two sets are identical.

### Phase 1 — models and ROM selection (S)
1. `constants.ts`: `MC_SP3_ROM_SET`. `machine-registry.ts`: the ten new models of §1, each
   `{ [MC_DISK_SUPPORT]: n, [MC_SP3_ROM_SET]: <set> }`; the new display name (P1). Check that the
   machine-select dialog stays readable with 13 models under one machine.
2. `p3RomSets.ts` (P4) with the +3E row filled from today's constants; `ZxSpectrumP3eWasmHost`
   gets `romSet` from config and overrides `romId`. `SPP3_*` constants move into the table (their
   only users are the host and `ZxSpectrumBase.ts`).
3. `hardware-specs.ts`: per-model `rom` override listing the model's set; extend
   `test/machines/hardware-specs.test.ts`.
4. `spectrumSnapshotMapping.ts` `MODEL_NAMES` and `kliveSpectrumName` learn the new models.
5. Harness: `test/harness/sp128/session.ts` reads the ROM file from the model's set instead of the
   hard-coded `spp3e-${page}`; README updated.
6. Unit tests: registry models resolve, `romId` per model, config merge keeps the set across
   `hardReset` (ROM pages replayed from the right set).

### Phase 2 — ROM-set-aware flows (S–M; the only real unknown)
1. In the harness, boot one model of each ROM set to the start-up menu; find the menu's key-wait
   loop address in ROM 0 and the +3 BASIC editor's return point in ROM 1 (P5); confirm the 48 BASIC
   entry in ROM 3 and the menu order (Loader / +3 BASIC / Calculator / 48 BASIC) that the
   arrow-down counts in `getCodeInjectionFlow` assume (the Spanish menus have different text but
   are expected to keep the order). Fill the four Amstrad rows.
2. `getCodeInjectionFlow`, `getTapeLoadFlow` and `menuTapeLoadFlow` take the addresses from the set.
3. E2e tests (in `build/e2e-tests.ts`'s `e2e-cores` tier), parameterised over the four ROM sets
   (a +3 model of each, plus `plus2a` for the no-drive case):
   - boots to the menu and the screen shows the Amstrad menu (probe, not a golden);
   - inject-and-run of a small program for both target models `sp48` and `spp3e`; the return point
     is hit;
   - tape Loader loads a TZX; on the +3 models, Loader boots a `.dsk` in drive A and `CAT` lists it
     (+3DOS from the Amstrad ROM 2 driving Klive's FDC);
   - `plus2a` with no drives: the ROM's disk probe does not hang (Loader falls to tape).
4. Regression: the existing `test/wasm/zxSpectrum/wasm-p3e-disk.test.ts` and +3E flows stay green.

### Phase 3 — snapshots and state files (S)
1. Capture reports `plus2a` (0 drives) or `plus3` (drives > 0) on any Amstrad set, `plus3e`
   otherwise (from the table's `snapshotKind`). The writers then emit szx machine ids 4/5 and the
   matching .z80 hardware mode.
2. Mapping (P6): `plus2a` → `["nofdd", "fdd1", "fdd2", "plus2a", "plus2a-es"]`; `plus3` →
   `["fdd1", "fdd2", <the eight Amstrad +3 models>]`; `plus3e` unchanged. The +E model comes first,
   so a snapshot opens on it by default; `spectrumSnapshotLoad.ts` already keeps the project's
   current model when it is in the list, so a +3 project stays on its Amstrad ROMs. The "+E ROMs
   instead of the Amstrad ones" warning is shown only when the chosen model is an E model. The
   two-drive preference keeps working (it moves `fdd2` forward, ahead of the Amstrad `-fdd2`s).
3. State files: a state saved on `plus3-fdd1` restores to `plus3-fdd1` (model + config round-trip);
   a +3E state file from before this change (no `sp3RomSet`) still restores as +3E.
4. Tests: extend `spectrum-snapshot-parse/load/save/flow` tests and the state round-trip test for the
   new models.

### Phase 4 — IDE surfaces and compilers (S)
1. Machine-select dialog: the new models appear. Favorites are unchanged (P6). `test/dialogs/machineSelect/*` updated.
2. Menus (`machine-menu-registry.ts`, `state-menus.ts`, `zx-specrum-menus.ts`) need no change if P1
   holds; verify the disk menus appear on `plus3-fdd*` and not on `plus2a`.
3. New-project dialog: the `spp3e` templates work for the new models (test in
   `test/dialogs/newProject/`).
4. Compilers: run a sjasmplus `+3` project and a Klive BASIC `zxplus3` program (one corpus program
   that switches to the 48 ROM and back) on `plus3-fdd1`, proving `rom.kz80.asm`'s `BANKM`/`BANK678`
   handling against the Amstrad ROMs.
5. `scripts/kbasic-ide-check.cjs` (or the doc-shots driver) smoke check in the running IDE.

### Phase 5 — documentation and roadmap (S)
1. `docs/content/machine-types.mdx`, `introduction.mdx`: the new models and when to pick +3 vs +3E.
2. `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`: §2 row "48K / 128K / +2E / +3E" becomes
   "48K / 128K / +2A / +3 / +2E / +3E"; §2 snapshot row and §4 W9 note the +2A/+3.
3. Mark G9.2 ✅ in `CLOSING_THE_GAPS_PLAN.md`; set this plan's status to done with a short
   "as built" section.
4. `npm run doc:build && npm run doc:check`.

## 6. Verification

Focused tests per phase, then `npm run build:check`, `npm run lint:renderer` (Phase 4 touches the
dialog), `npm run test:e2e` for the core tests, and
`npx electron-vite build --config build/electron.vite.config.ts`. Check in the running IDE that
switching between `plus3-fdd1`, `plus3-es-fdd1` and `fdd1` swaps the start-up menu (Amstrad
English, Amstrad Spanish, +3E) without a restart.

## 7. Risks

| Risk | Mitigation |
|---|---|
| The Amstrad ROM's key-wait loop is not a single stable PC the way the +3E's is | Phase 2 step 1 finds it before any flow is changed; a flow can wait on a range or a ROM-paging condition if needed |
| +3DOS in ROM 2 exercises FDC paths the +3E never hit | the Phase 2 disk tests; the FDC is the same uPD765 model, and the +3E's own +3DOS is derived from the Amstrad one |
| `+2A` (no drives): the ROM probes the FDC at boot | test that boot reaches the menu and Loader falls back to tape |
| Existing projects silently switch ROMs | P2's default: no `sp3RomSet` means +3E; existing model ids untouched |

## 8. Decisions from the author (2026-10-04)

- **Q1. ROM versions:** ship the extra models too: v4.0 and v4.1, English and Spanish (§1).
- **Q2. ROM source:** a known archive distributed under the Amstrad permission (§4).
- **Q3. Naming:** "ZX Spectrum +2A/+3/+2E/+3E" and the model ids of §1 are accepted.
- **Q4. Defaults:** use the E models: favorites unchanged, snapshots open on the +E models first
  (P6).
