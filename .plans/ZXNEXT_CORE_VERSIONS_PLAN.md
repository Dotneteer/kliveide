# ZX Spectrum Next: Board and Core Versions as Models — Implementation Plan

**Status:** implemented 2026-10-31 (P0-P7), uncommitted at the time of writing; see "As built" below.
**Goal:** move from one hard-wired ZX Spectrum Next (KS2 board, core 3.02.01) to a set of
*Next models*, each a pair **(board, core version)** with its own VHDL reference, ROM set, SD-card
base image, NextReg set and, where the hardware differs, its own WASM artifact. The first new model
is **KS2 / core 3.02.04**; KS3 must fit later without another redesign.

---

## 0. Where things are today (survey, 2026-10-31)

Everything below assumes one Next. These are the places that encode "which Next":

| Concern | Where | Today |
|---|---|---|
| Machine and model | `src/common/machines/machine-registry.ts` (`MI_ZXNEXT`) | one model, `"standard"`, empty config; alias `compatibility → standard` |
| Favourites | `src/common/machines/machine-favorites.ts` | `{ MI_ZXNEXT, "standard" }` |
| Factory | `zxNext/ZxNextMachineFactory.ts` | ignores the model |
| WASM artifact | `zxNext/wasm/ZxNextWasmV2Loader.ts`, `scripts/build-zxnext-wasm.cjs` | one `zx-spectrum-next.wasm` |
| VHDL reference | `_input/next-fpga/` (+ `nextreg.txt`, `ports.txt`), committed | one tree, `g_version = X"32"`, `g_sub_version = X"01"` (3.02.01); upstream commit `5ad7546d` plus Klive's comments (D4) |
| Core-version claim | `zxNext/nextCoreVersion.ts`, `zxnext-nextreg.c` ($01 = $32, $0E = $00) | **reports 3.02.00, not 3.02.01** — see P0 |
| Board issue | `zxnext-nextreg.c` ($0F = 2, "Issue 4"), the $11 and $F0 rules, `zxnext-audio-mixer.c` (Issue 2 bias note) | Issue 4 (KS2) hard-coded |
| ROMs | `ZxNextWasmV2Machine.loadWasmV2RomImages` | `roms/enNextZX.rom`, `enNxtmmc.rom`, `enNextMf.rom`, `enAltZX.rom`, flat |
| ROM identity and sidecars | `src/common/roms/romIdentity.ts` (CRC table), `src/public/roms/*.rom.dis` (per-page `crc32`) | one ROM set |
| ROM-coupled code | `nextMachineInfo.ts` (key-wait loop $11E5–$120B, $1202), `zxnext-tape.c` (LD-BYTES trap in ROM 3), `nextzxos-disassembler.ts`, `ZxNextSysVars.ts` | addresses of this ROM set |
| SD card | `src/main/machine-menus/zx-next-menus.ts` | `mmc/ks2-base.cim` copied to `~/Klive/ks2.cim` |
| NextReg descriptions | `zxNext/nextRegDescriptors.ts`, consumed by the NextReg panel, Copper view, breakpoints, Z80 providers, the disassembler, `nextRegSlices.ts`, `copperDecoder.ts` | one set |
| NEX "minimum core" check | `NexFileViewerPanel.tsx` ← `EMULATED_CORE_VERSION` | one version |
| Tests | `test/harness/zxnext` (`createSession()`), `test/zxnext-hw/**`, `test/visual/**`, `test/wasm/zxNext/**`, boot traces, sidecar tests | one machine; VHDL citations by line number (`~5186`) into the one tree |

The key observation: **almost nothing is version-specific in a deep way yet — it is version-specific
by being the only thing there.** So the work is mostly to give each of these one *owner* (a profile)
and then add a second profile.

---

## 1. Decisions (proposed; confirm before P1)

**D1 — One machine, many models.** `MI_ZXNEXT` stays the machine. Each model is one *Next profile*:
`ks2-30201`, `ks2-30204`, later `ks3-…`. Model ids never change once shipped. `"standard"` (and its
existing `compatibility` alias) becomes an alias of `ks2-30201`, so old projects, favourites and
state files open on the model they were made with. A reference without a model means `ks2-30201`
(`implicitModelIds`). The default for *new* projects is a separate choice (D7).

**D2 — A profile is data, owned by one module.** New `src/emu/machines/zxNext/nextProfiles.ts`
(neutral, no emulation), one record per profile:

```ts
type NextProfile = {
  id: "ks2-30201" | "ks2-30204";        // = modelId
  board: "ks1" | "ks2" | "ks3";          // NextReg $0F, $11 rules, audio bias…
  boardIssue: number;                    // value read from $0F
  coreVersion: [3, 2, 1];                // $01 / $0E, NEX check
  wasmArtifact: string;                  // see D3
  romSet: "nextzxos-2.08";               // D9: folder, page CRCs, ROM facts, sidecars, SD base image
  sdBaseImage: string;                   // mmc/<romSet>-base.cim
  nextRegSet: string;                    // which descriptor set (D5)
  vhdlRef: string;                       // version key in vendor/next-fpga/sources.json (D4)
};
// ROM facts (D6) hang off the ROM set, not the profile: romSets[profile.romSet].facts
```

`nextCoreVersion.ts` stops exporting constants and exports `coreVersionOf(profile)`. Everything in
the §0 table reads its "which Next" fact from the active profile, never from a literal.

**D3 — One C source tree, one artifact per *distinct hardware*, chosen by compile-time defines.**
The C core stays a single tree under `zxNext/wasm/zxnext/`. Differences are guarded by a
`zxnext-profile.h` that the build defines per artifact:

```c
#define ZXNEXT_CORE_VERSION 30204   /* 3.02.04 */
#define ZXNEXT_BOARD_ISSUE  4       /* KS2 */
#if ZXNEXT_CORE_VERSION >= 30204
  … new behaviour …
#endif
```

`build-zxnext-wasm.cjs` builds `zx-spectrum-next-<profile>.wasm` for each artifact profile; two
profiles with identical hardware share an artifact. Why compile time, not a run-time switch:

- The hot paths (memory decode, the frame loop, Copper, DMA) pay nothing for a profile they are not.
- Each artifact has its own layout stamp, so a state file or reverse-debug keyframe made by one core
  can never be restored into another — the existing layout check already refuses it.
- `debug-loop-equivalence`, journal-replay determinism and the backend snapshot run per artifact
  without new machinery.
- Board issue *could* be a run-time flag (it touches few, cold paths); keep it compile-time too for
  one rule, unless the 3.02.04 delta (P2) shows it buys a lot.

Re-examine D3 at the **P2 gate**: if the 3.02.01 → 3.02.04 VHDL delta is a handful of register-level
fixes, the compile-time guards are cheap; if it rewrites a subsystem, that subsystem gets a second
file selected by the build, never a forked tree.

**D4 — The VHDL reference is downloaded, versioned and never committed.** Klive's repository keeps
only a tracked manifest, `vendor/next-fpga/sources.json`, which follows the Boriel kit pattern
(`vendor/boriel-basic/kit.json`): for each version, the upstream repository, the commit SHA, the
path inside it and the expected git blob ids of the files the tests read. `npm run next-fpga:fetch`
downloads each pinned tree into the git-ignored `vendor/next-fpga/<version>/` (GitLab archive API,
`?sha=<commit>&path=cores/zxnext`), checks the blob ids, and is a no-op when they already match.
Tests, parity checks and scripts that need the VHDL resolve it through one helper
(`nextFpgaPath(version, file)`), which fails with "run `npm run next-fpga:fetch`" instead of a
missing-file error. CI fetches once and caches the folder by the manifest's hash. `_input/next-fpga/`
is deleted once nothing reads it.

Verified upstream sources (2026-10-31), official repo `gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA`
(project 13818899). It has **no tags**; versions are **branches** (`30202`, `30203`, `30204`, `30205`;
`master` is 3.02.03), except 3.02.01, which has none:

| Version | Pin | Evidence |
|---|---|---|
| 3.02.01 | commit `5ad7546d19d7e1b60645c11086c8407f238280df` (2023-09-06), the last before "Bump core number to 3.02.02" (`cfa612ae`) | `zxnext_top_issue4.vhd` and `zxnext.vhd` are blob-identical to `_input/next-fpga/`; `g_sub_version = X"01"` |
| 3.02.04 | branch `30204`, tip `dc8d76419a6968d6c93bfa5f62231a40ad8b4221` (2026-05-28) | `g_sub_version = X"04"`; `changelog.md` 3.02.04 entry. Also has `zxnext_top_issue5.vhd` and `zxnext_pins_issue5.xdc` (issue 5 board, added in 3.02.03) |

Pin the commit, not the branch name: a branch can move. The current upstream is 3.02.05 (branch
`30205`, 2026-09-25); the manifest makes adding it one entry.

**The local copy is not pristine.** Against `5ad7546d`, Klive's `_input/next-fpga/` differs in
four files: `cpu/t80n.vhd`, `cpu/t80na.vhd` and `device/divmmc.vhd` carry Klive's own explanatory
comments, `misc/relaxation.vhd` only line endings, plus two small edits in `nextreg.txt` (about 400
diff lines in all). The fork `gitlab.com/Dotneteer/ZX_Spectrum_Next_FPGA` ("with comments") does
not contain them: its `master` is plain 3.02.03. No branch is created for them (decided
2026-10-31). Before `_input/next-fpga/` goes, they move into the repository as patches.

**D4.1 — Klive's VHDL comments live in `vendor/next-fpga/comments/<version>/`, tracked.** The
folder mirrors the upstream tree, one unified diff per commented file:

```
vendor/next-fpga/
  sources.json                       tracked: the pins
  comments/                          tracked: Klive's own comments, as patches
    3.02.01/
      README.md                      what each patch explains, and the base commit (5ad7546d)
      src/cpu/t80n.vhd.patch
      src/cpu/t80na.vhd.patch
      src/device/divmmc.vhd.patch
      nextreg.txt.patch
  3.02.01/                           git-ignored: the fetched tree, comments applied
  3.02.04/                           git-ignored
```

Why patches and not commented copies of the files: a patch holds Klive's comment lines and only a
few lines of upstream context around each, so the repository keeps its "no VHDL" rule, and a patch
that no longer applies shows at once that upstream changed under a comment. Line-ending-only
differences (`misc/relaxation.vhd`) are dropped, not kept as patches.

- `npm run next-fpga:fetch` applies `comments/<version>/` after the blob-id check and marks the
  tree as commented (a `.klive-comments` stamp with the patch hashes), so a test can tell a
  pristine tree from a commented one. The blob ids in `sources.json` are the *upstream* ones; the
  check runs before the patches.
- Adding or changing a comment: edit the fetched file in `vendor/next-fpga/<version>/`, then
  `npm run next-fpga:comments -- --save <version>` rewrites that version's patches from the diff
  against the pinned upstream file. Hand-editing a `.patch` is never needed.
- A comment for a new version starts as a copy: `npm run next-fpga:comments -- --carry 3.02.01
  3.02.04` applies the 3.02.01 patches to the 3.02.04 tree with fuzz, saves what applied under
  `comments/3.02.04/`, and lists the hunks that did not, for review. The P2 diff report says which
  of those files changed.
- `.gitignore` gets `vendor/next-fpga/*/` with `!vendor/next-fpga/comments/`, so only the pins and
  the comments are tracked.

A test that cites the VHDL names the version (`zxnext.vhd@3.02.01 ~5186`); an unversioned citation
means 3.02.01, so existing comments stay valid. The `src/emu/machines/zxNext/wasm/README.md`
maintenance policy is amended: "the VHDL of the profile's version is the reference".

**D5 — NextReg descriptions are a base set plus per-version deltas.** `nextRegDescriptors.ts` keeps
the 3.02.01 set as the base; `nextRegSets/30204.ts` lists only added, removed or re-meant registers
and bits. The machine exposes the active set through `IZxNextIdeMachine`, and every consumer in §0
reads it from there (not the static import). Assembler-side NextReg names
(`.plans/NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md`) use the **union** — source code does not know
which model it will run on — with a warning only if a project's model lacks the register.

**D6 — ROM-coupled addresses come from the profile and are proved per profile.** The NextZXOS
key-wait loop, `ZXNEXT_MAIN_WAITING_LOOP`, sysvar addresses and the ROM 3 LD-BYTES trap addresses
move into `romFacts`. The C trap addresses become values the host writes into the core at load
(they are host-owned facts about a ROM, not hardware). A per-profile test boots the profile's ROMs
and asserts each fact against the real ROM bytes, so a new ROM set cannot silently break code
injection or tape loading.

**D7 — SD card per profile.** Each profile has its own base image and its own working copy
(`~/Klive/ks2-30204.cim`); the existing `ks2.cim` becomes the `ks2-30201` working copy (no rename,
just an entry in the profile). Switching models never boots NextZXOS from a mismatched SD card. A
user-selected SD file (`MEDIA_SD_CARD`) still overrides it. *Open:* which model new projects default
to — recommend the newest supported (`ks2-30204`) once P7 passes, `ks2-30201` until then.

**D9 — ROMs: fetched from the official distribution when a model is implemented, then committed.**

*Where they come from.* The Next ROMs are not in the FPGA repository (its `src/rom/` has only the
boot ROM). They are in the official distribution, `gitlab.com/thesmog358/tbblue` (project 8302266),
in `machines/next/` (`enNextZX.rom`, `enNxtmmc.rom`, `enNextMf.rom`, `enAltZX.rom`, plus
`enNextLG.rom` and others). Its releases are **branches**, and they line up with the cores
(checked 2026-10-31):

| Distribution ref | Date | NextZXOS | Matches |
|---|---|---|---|
| branch `KS2` (tip `9a3c3c7b489603b475753b723b543e078d59bb4c`) | 2023-06-05 | 2.08 ("Core 3.01.10 needed") | **Klive's four shipped ROMs are blob-identical to this branch**: the 3.02.01 set |
| branch `KS3` (tip `b7cc7d348052bc99e45622e27dbe6f56f753317e`, "TBBLUE final for testing") | 2026-05-28 | 2.1x ("Core 3.02.00 needed") | all four ROMs differ; the same date as FPGA branch `30204`; its `TBBLUE.TBU` carries issue 2, 4 and 5 bitstreams |
| `master` / tag `system/next_24.11` | 2024 | 2.09 | an in-between release, not targeted |

So the distribution branch named `KS3` is a *distribution release*, not KS3-only: it is the one
that ships 3.02.04, for KS2 boards too. That it carries exactly 3.02.04 still has to be confirmed in
P2, by reading the core version the booted machine reports, or from the TBU.

**D9.1 — ROMs are fetched once, when a model is implemented, and committed.** Downloading the ROM
set is a development step, the first one of adding a model, never something the app or a test run
does. The app keeps loading ROMs from its own package, as it does today, and works offline from the
first start. Tests and CI read the committed files and never touch the network.

The tracked manifest `src/common/zxnext/romSets.json` records where each committed set came from
and what its bytes must be:

```jsonc
{
  "nextzxos-2.08": {
    "source": { "project": "thesmog358/tbblue", "ref": "KS2", "commit": "9a3c3c7b489603b475753b723b543e078d59bb4c", "dir": "machines/next" },
    "fetched": "2026-11-…",
    "files": {
      "enNextZX.rom": { "size": 65536, "sha256": "…", "pages": ["95ba84d4", "74dbb504", "cafb1e32", "92d23960"] },
      "enNxtmmc.rom": { "size": 8192,  "sha256": "…" },
      "enNextMf.rom": { "size": …,     "sha256": "…" },
      "enAltZX.rom":  { "size": 32768, "sha256": "…" }
    },
    "facts": { "keyWaitLoop": ["0x11e5", "0x120b"], "mainWaitingLoop": "0x1202", "ldBytes": { … } }
  },
  "nextzxos-2.1x": { "source": { "ref": "KS3", "commit": "b7cc7d348052bc99e45622e27dbe6f56f753317e", … }, … }
}
```

- The **commit is a full SHA**, recorded at fetch time. `ref` is only a note of which branch it came
  from: `KS3` says "final for testing" and can still move. A newer distribution release is a new
  set with a new name and its own fetch, never a re-fetch over a committed set.
- A profile names its set (`romSet: "nextzxos-2.08"`), so two profiles with the same ROMs share one
  folder (a KS3 profile on 3.02.04 would name the same set as KS2/3.02.04).
- The ROM facts (D6), the sidecars (D8), the NextZXOS disassembler's entry points and the SD base
  image (D9.4) belong to the set; only the hardware (WASM artifact, NextReg set, `$01`/`$0E`)
  belongs to the core. A later profile can pair a core with another NextZXOS without copying
  anything.

**D9.2 — The fetch tool.** `npm run next-roms:fetch -- <setId> --ref <branch|commit>`:

1. resolves `--ref` to a full commit SHA with `git ls-remote` (Git's HTTPS endpoint, not the REST
   API, which rate-limits anonymous callers per IP and did so while this plan was written);
2. downloads each file from `https://gitlab.com/thesmog358/tbblue/-/raw/<commit>/machines/next/<file>`
   (the raw file URL, again not the REST API);
3. writes them to `src/public/roms/zxnext/<setId>/` and adds or updates the set's entry in
   `romSets.json`: commit, date, size, sha256, page CRCs;
4. prints what to review and commit (the files, the manifest diff, the distribution's licence
   note).

It refuses to overwrite a set that is already in the manifest unless given `--replace`, which is
for a set that has not shipped yet. The ROM facts are not guessed by the tool: they are filled in by
hand in P5 and proved by the D6 test.

**D9.3 — Checking the committed sets.**
- A unit test (no network) checks every set in the manifest against the committed files: present,
  size and sha256 match, page CRCs match `romIdentity.ts`. `romIdentity.ts`'s CRC table is generated
  from the manifest instead of being kept by hand.
- The ROM loader checks the page CRCs at load time too, so a hand-replaced ROM in a user's
  installation is reported, not booted.
- `npm run next-roms:check -- --online` (by hand, never in CI) downloads each set's files at its
  recorded commit again and confirms they are the committed bytes: a provenance check, for a review
  or a release.

**D9.4 — The SD base image follows the same rule.** It is built when the model is implemented and
committed, as `ks2-base.cim` is today: `scripts/build-next-sd-image.cjs <setId>` builds
`src/public/mmc/<setId>-base.cim` from the distribution at the set's commit (the same commit as the
ROMs, so the ROMs on the card and the ROMs Klive uploads are the same bytes), and its sha256 goes into
the set's manifest entry. `ks2-base.cim` becomes the `nextzxos-2.08` image (renamed in P1, or kept
by name and referenced from the manifest; decide in P1).

**D9.5 — Layout after P1 and P5.**

```
src/common/zxnext/romSets.json            tracked: provenance, hashes, ROM facts
src/public/roms/zxnext/
  nextzxos-2.08/  enNextZX.rom  enNxtmmc.rom  enNextMf.rom  enAltZX.rom  + *.rom.dis
  nextzxos-2.1x/  enNextZX.rom  enNxtmmc.rom  enNextMf.rom  enAltZX.rom  + *.rom.dis
src/public/mmc/
  nextzxos-2.08-base.cim  nextzxos-2.1x-base.cim
```

The readers that name `roms/enNextZX.rom` etc. directly today (`ZxNextWasmV2Machine.ts`,
`romIdentity.ts`, `romAnnotationCatalog.ts`, `romAnnotationTools.ts`, `rom-annotations.index.json`,
and the tests under `test/annotations/`, `test/zxnext-hw/{multiface,nmi,ports,reset,rom,memory,tape}`,
`test/main/rom-annotations-menu.test.ts`) move to one helper, `nextRomPath(setId, file)`.

**D8 — ROM annotations follow the D4 provenance rule.** New ROM pages get sidecars written from
scratch. Pages whose CRC is unchanged reuse the existing sidecar (the sidecar is keyed by page CRC
already). For changed pages, a migration tool carries over annotations whose surrounding bytes match
(a byte-signature re-anchor), and everything it cannot place is listed for hand review. Nothing is
taken from a published commented disassembly.

---

## 2. Phases

Each phase ends green on `npm test`, `npm run build:check`, `npm run lint:renderer` (when renderer
code changed) and the Next acceptance set (`npm run test:zxnext-wasm-matrix`).

### P0 — Make today's identity true (small, separate commit)
- The VHDL in `_input/next-fpga/` says 3.02.01; the core reports $0E = $00 and `nextCoreVersion.ts`
  says 3.2.0. Decide which is right (it should be 3.02.01) and fix both the C reset value and the TS
  constant; `identity.test.ts` already reads them back.
- This is a user-visible `fix` changeset (a NEX asking for 3.02.01 was reported as unsupported).

### P1 — Introduce the profile with exactly one profile (pure refactor)
- Add `nextProfiles.ts` with `ks2-30201`; replace the `"standard"` model by it, add the aliases and
  `implicitModelIds` entry (D1); update favourites.
- Factory, ROM loading, SD default, NEX check, ROM facts, NextReg set: all read the profile (D2, D5,
  D6). Move the four ROMs and their sidecars to `src/public/roms/zxnext/nextzxos-2.08/` (D9) and
  update the sidecar, `romIdentity` and annotation-menu tests that pin the paths. Write the fetch
  tool (D9.2) and run it once for `nextzxos-2.08 --ref KS2`: it must reproduce the four committed
  files byte for byte, which proves both the tool and their provenance, and it writes the set's
  `romSets.json` entry.
- Harness: `createSession({ profile? })`, default `ks2-30201`.
- Proof of "nothing changed": all Next tests, boot traces and visual goldens byte-identical; a
  project saved with `standard` opens on `ks2-30201`. No changeset (internal) — or one `internal`.

### P2 — Collect the 3.02.04 reference material, then decide (gate)
- Save the local VHDL comments as patches in `vendor/next-fpga/comments/3.02.01/` (D4.1), write `vendor/next-fpga/sources.json`
  with the two pins from D4, `npm run next-fpga:fetch`, and switch every reader of
  `_input/next-fpga/` to `nextFpgaPath()`; then delete `_input/next-fpga/`. Proof: the fetched
  3.02.01 tree plus the comments reproduces the old folder byte for byte.
- `npm run next-roms:fetch -- nextzxos-2.1x --ref KS3` (D9.2): commit the new set and its manifest
  entry, and confirm it is the 3.02.04 pairing. Build and commit its SD base image (D9.4).
- Write `scripts/next-fpga-diff.cjs`: a structured diff of the two trees (per file, per process,
  with the generics) plus a diff of `nextreg.txt`. Hand-classify the result in
  `.ai/zxnext-cores/30201-to-30204.md`: per device, *behaviour change / new register or bit /
  timing / bug fix / board-only / no emulator impact*.
- Diff the ROM sets page by page (CRC, then the D6 addresses).
- **Gate:** review the delta with the project author; confirm or adjust D3 (compile-time guards vs.
  a second file per changed subsystem) and D5. Every later phase works from that list.

### P3 — Build and load more than one artifact
- `zxnext-profile.h`; build script loops over the artifact profiles; size check per artifact;
  `build:all-wasm` builds all.
- Loader takes the artifact name from the profile; `ZXNEXT_WASM_V2_ARTIFACT_NAME` goes away.
- The `ks2-30204` artifact at this point is the 3.02.01 hardware with only the identity changed
  ($01/$0E), so the plumbing is proved before any behaviour moves.
- Tests: both artifacts load; the wrong artifact's state file is refused with a message; the
  determinism and debug-loop-equivalence tests run against each artifact (fast tier: one
  representative case per artifact; full sweep in `e2e-slow`).

### P4 — Implement the hardware delta in C
- One item from the P2 list at a time, each behind the version guard, each with a harness test in
  `test/zxnext-hw/<component>/` that runs **both** profiles: same expectation where they agree,
  per-profile expectation where they differ, citing the VHDL of each version.
- Add a `profiles` helper to the harness (`forEachProfile(…)`, or `describe.each`) so a test states
  which profiles it covers. A version-sensitive test that only runs one profile is a review smell.
- After each item: the 3.02.01 artifact stays byte-identical (boot traces, goldens) — that is the
  proof that a guard leaked nowhere.

### P5 — ROMs, ROM facts and annotations for 3.02.04
- The set's files are already committed (P2); fill in its D6 facts in `romSets.json` with their
  proving test (`romIdentity.ts` picks up its CRCs from the manifest); the code-injection flow (`.nexload` typing, key-wait detection) passes on both profiles.
- Sidecars per D8; `.ai/rom-annotations/PROVENANCE.md` entry; the ROM annotations menu offers the
  ROM of the active profile.
- Visual cases that boot NextZXOS get per-profile goldens (recorded only after checking by eye).

### P6 — The IDE
- Machine menu lists both models (display names through `t()`, e.g. "ZX Spectrum Next (KS2, core
  3.02.04)"); favourites; New Project dialog; the status bar/machine info shows the profile.
- SD card per profile (D7): Machine › SD Card › Default/Reset act on the active profile's copy;
  backups keep working.
- NextReg panel, Copper view, breakpoints and the disassembler read the active NextReg set (D5).
- NEX viewer checks against the active profile's core version.
- `hardware-specs.ts` entry per profile if any spec differs.
- `npm run i18n:keys`; `.ai/ui-theming-intent-and-lessons.md` only if a visual rule changes.

### P7 — Docs, slow tier, release
- `docs/content/en/guides/machines/` Next page: the models and how to choose; landing feature with a
  `since` version if it is featured.
- `npm run test:slow` with both profiles in the exhaustive sweeps; `npm run doc:build && npm run
  doc:check`.
- One `feature` changeset for the whole plan (the plan's result, not its last step): **ZX Spectrum
  Next models** — KS2 with core 3.02.01 or 3.02.04, each with its own ROMs, SD card and hardware.

---

## 3. Leaving room for KS3

KS3 is a different board, so expect differences in `board`/`boardIssue` (NextReg $0F, the $11 video
timing rules), possibly in peripherals, and possibly a different FPGA top file
(`zxnext_top_issue*.vhd` already exists per board). Nothing above assumes KS2 beyond the profile
record: the board is a profile field and a compile-time define, the top-level VHDL is part of the
versioned reference, and the artifact list is data. Adding KS3 is then: reference material (P2),
a profile record, guarded C, its tests, ROMs/SD, UI entry.

---

## 4. Risks and traps

- **Line-number citations.** Hundreds of comments cite `zxnext.vhd ~NNNN`. After D4 they must say
  which version, or they rot the first time someone reads the 3.02.04 file at the same line.
- **Silent sharing.** A `#if` that accidentally covers 3.02.01 changes the default machine. The
  byte-identical 3.02.01 boot traces and goldens after every P4 item are the guard.
- **State files and history.** Already layout-stamped per artifact; make sure the refusal message
  names the model, not a hash.
- **Mismatched SD and ROMs.** NextZXOS on the SD and the ROMs Klive uploads must belong together;
  D7 and the CRC check in the profile prevent the mix.
- **Test cost.** Running every Next test on two profiles doubles the tier. Keep the fast tier to one
  representative case per profile for anything that is not version-sensitive; the sweeps go to
  `e2e-slow` (`build/e2e-tests.ts`).
- **Provenance.** ROM sidecars for 3.02.04 follow D4/D8 of the annotation rules, exactly as today.

## 5. Open questions for the project author

1. Answered by the sources (D9): 3.02.04 pairs with the distribution's `KS3` branch. Should a model
   ever offer a second NextZXOS for the same core? D9 keeps that possible but adds no UI for it.
2. Settled: the VHDL is fetched, never committed (D4); its Klive comments are patches in
   `vendor/next-fpga/comments/` (D4.1); ROMs and SD base images are fetched when a model is
   implemented and committed (D9). The pins are recorded (resolved 2026-10-31 with
   `git ls-remote`): distribution `KS2` = `9a3c3c7b…`, `KS3` = `b7cc7d34…`, FPGA `30204` = `dc8d7641…`.
3. Default model for new projects (D7).
4. Do you want a run-time "core version" switch on one model instead of separate models? (This plan
   says no: a model is what a project records, and the artifact must follow it.)

---

## As built (2026-10-31)

- **P0:** `$0E` reads `.01`; the version comes from `zxnext-profile.h` now.
- **P1:** `nextProfiles.ts` (`ks2-30201`, aliases `standard`/`compatibility`, implicit model);
  `nextRegSets/` (base + delta, union for names); ROM sets in `src/public/roms/zxnext/<setId>/`,
  manifest **`src/common/zxnext/nextRomSets.json`** (renamed from `romSets.json`: tsconfig-paths in
  scripts resolved `@common/zxnext/romSets` to the `.json`). `npm run next-roms:fetch -- nextzxos-2.08
  --ref KS2` reproduced the five committed ROMs byte for byte (`enNextLG.rom` belongs to the set too).
  `ks2-base.cim` kept by name (D9.4), referenced from the manifest. The 2.08 set's ROM annotation
  working copies stay flat in `~/Klive/RomAnnotations/` (`romSidecarPaths.ts`); other sets nest.
  The loader checks page CRCs (D9.3). The tape trap addresses are host-written (`zxnextTapeSetRomRoutines`).
- **P2:** `vendor/next-fpga/` (pins, comment patches for 3.02.01 and carried to 3.02.04),
  `npm run next-fpga:{fetch,comments,diff}`; the fetched 3.02.01 tree + comments equals the old
  `_input/next-fpga/` (bar `relaxation.vhd` line endings), which is deleted. Citations say
  `vendor/next-fpga/3.02.01/`. Nothing in CI reads the VHDL, so CI needs no fetch step. The delta
  is `.ai/zxnext-cores/30201-to-30204.md`. The `KS3` distribution branch is NextZXOS **2.10**
  (set `nextzxos-2.10`); its README lists core 3.02.04 for issue 4 boards. D3 confirmed: guards, no
  second files. Open: the `nextreg.txt` "comment" patch is two stray edits, not comments; and the
  `t80na.vhd` patch's pin descriptions should be checked for provenance.
- **P3:** `scripts/zxnext-artifacts.cjs`, both artifacts built and size-checked. The layout
  fingerprint does not see code, so state files, debug recordings and boot checkpoints carry a
  per-model core id (`stateCoreIdOf`; `zxnext` for 3.02.01) and the refusal names both models.
- **P4:** items 1, 2, 4-8 guarded in C with tests on both profiles; item 3 (ULA I/O contention)
  skipped: neither version models it. The 3.02.01 artifact's bytes are unchanged (MD5 before = after).
  Item 4's EAR polarity follows the VHDL pin chain; not confirmed on hardware.
- **P5:** facts for 2.10 (key-wait loop $0C98-$0CBE, HALT $0CB5; ROM 3 tape routines unchanged),
  proved by `rom-facts.test.ts` and `nextzxos-boot.test.ts` (each model boots its own card into its
  loop). SD base image by `npm run next-sd:build`. Sidecars carried by byte signature
  (`npm run rom:annotations:carry`), review lists in `.ai/rom-annotations/carry-review/`; then authored
  from the 2.10 bytes to level 2 (every page, reassembled byte for byte; `PROVENANCE.md`, 2026-10-31).
  The Next decoder lists both sets' inline-data call addresses (2.10 moved four, and its alternate ROM
  page 0 gained `RST $30` + a ROM 2 word); `nextRomDecoder.test.ts` proves no set calls another's.
  Not done: per-profile visual goldens (recorded only after checking by eye).
- **P6:** models in Select Machine / New Project; SD card per model, another model's default card
  counts as no choice; the ROM Annotations menu groups the Next's ROMs by NextZXOS release; NEX
  check against the active model. Model names are not translated (i18n guide D9).
- **P7:** `docs/content/en/guides/next/next-models.mdx`, SD card page; changeset
  `.changes/zx-spectrum-next-models.md`. D7 decided by the project author: new projects start on `ks2-30204`
  (`NEW_PROJECT_NEXT_PROFILE_ID`, `newProjectModelIds` in the registry, the default favourite);
  model-less references still mean `ks2-30201`.
