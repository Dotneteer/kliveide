# Beta 128 disk interface and TR-DOS on the Pentagon 128 (G9.1b)

Status: **draft: waiting for the author's answers to §8.**
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G9 (G9.1b, size M–L).
Builds on: [PENTAGON_128_PLAN.md](PENTAGON_128_PLAN.md) (G9.1, done).

> **Standing rule (from the base plan):** when this ships, update §2 (the Pentagon in "Other
> machines", and the disk rows) and §4 (W9) of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md), and mark G9.1b done
> in the base plan, in the same change. A visual change (the disk menu, the media strip, a disk
> viewer) also updates `.ai/ui-theming-intent-and-lessons.md`.

---

## 1. What is being added

The Pentagon 128 shipped with the **Beta 128** disk interface, and most Pentagon software (demos,
games, the Russian scene's disk magazines) comes on **TR-DOS** disks. G9.1 gave Klive the Pentagon's
timing but no disks: a Pentagon program on a `.trd` cannot be run today, and a `.sna` with the TR-DOS
ROM paged loads with a warning.

The Beta 128 is small hardware around one chip:

- a **WD1793** floppy disk controller (FDC): command/status, track, sector and data registers;
- a **system register** (drive select, side, head load, density, controller reset) that also reads
  back the FDC's INTRQ and DRQ lines;
- the **TR-DOS ROM** (16K), and **automatic paging**: the ROM replaces the 48K BASIC ROM at
  `$0000–$3FFF` when the CPU fetches an instruction from `$3D00–$3DFF` while the 48K BASIC ROM is
  selected, and the 48K ROM comes back when the CPU fetches an instruction from RAM (`$4000` and up).
  The interface's ports respond only while the TR-DOS ROM is paged in.

| Port | Read | Write |
|---|---|---|
| `$1F` | FDC status | FDC command |
| `$3F` | FDC track | FDC track |
| `$5F` | FDC sector | FDC sector |
| `$7F` | FDC data | FDC data |
| `$FF` | INTRQ (bit 7), DRQ (bit 6) | system register: drive (bits 0–1), reset (bit 2, active low), head load (bit 3), side (bit 4, inverted), density (bit 6) |

The table and the paging rule are the starting point for Phase 0, which confirms every bit against
the WD1793 data sheet and the interface's documentation (P6) before any code relies on it.

After this change, on the Pentagon model (Q2):

- two drives, A and B (Q3), with `.trd` and `.scl` images (Q4);
- the Machine menu's disk items and the emulator's media strip, as on the +3;
- a **Disk Loader** flow (Q5): the IDE resets, enters TR-DOS and boots the disk, as the tape
  Loader does for tapes;
- `.sna`, `.szx` and Klive state files keep the interface's state;
- the debugger sees the TR-DOS ROM as a memory partition of its own.

**Out of scope:** the Beta 128 on the plain 128K and 48K (Q2), drives C and D, the FDI/UDI/TD0 disk
formats, Pentagon 512/1024 memory, and the Next's own TR-DOS-free disk story.

## 2. What the code looks like today (the foundation)

- **The +3's disk support is the template, but not the code.** The +3's controller is a uPD765,
  written in C inside `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c` (command, execution and
  result phases; `SPP3E_FDC_*`). The WD1793 is a different chip with a different programming model
  (type I–IV commands, a status register whose bits change meaning by command type, DRQ/INTRQ
  instead of a result phase), so it is a new device. What carries over is the *plumbing*:
  - the image is uploaded into WASM memory (`spp3eDiskBeginUpload` / `WriteData` /
    `FinishUpload`) and lives there, so state files capture it;
  - writes are tracked by a dirty revision (`spp3eFdcGetDirtyRevision`), collected as
    `SectorChanges`, and written back to the file by the main process
    (`RendererToMainProcessor.saveDiskChanges`);
  - write protection (`DISK_A_WP`, `DISK_B_WP`), media ids `MEDIA_DISK_A` / `MEDIA_DISK_B`, the media
    strip (`spectrumMedia.ts`, gated by `MC_DISK_SUPPORT`), the disk menu
    (`zx-specrum-menus.ts` `diskMenuRenderer`, gated by `MC_DISK_SUPPORT`), and restoring the last
    session's disks (`main/index.ts`).
- **Everything disk-format-specific is CPC DSK today.** `disk-readers.ts`, `disk-changes.ts`,
  `saveDiskChanges` (sector changes keyed `track * 100 + sectorId` and located through the DSK
  track table), the insert dialog's filter (`extensions: ["dsk"]`), the Create Disk dialog
  (`renderer/appEmu/dialogs/createDisk/`) and `DskViewerPanel.tsx`. A TRD is a raw image (logical
  track = cylinder × 2 + side, 16 sectors of 256 bytes, the catalogue on track 0), so each of these
  needs a format switch, not a second copy.
- **The 128K core** (`sp128.c`) has `sp128ApplyTiming` (G9.1), ROM pages R0/R1, port decoding in
  `sp128ReadNonFePort` / `sp128WriteNonFePort`, and the shared Z80 core's opcode-fetch hook that a
  paging trap needs (to be confirmed in Phase 1: the trap must see the *fetch* address, not data
  reads).
- **Snapshots** already parse the `.sna` TR-DOS byte (`snaFile.ts` → `peripherals.trdosPaged`) and
  name the `.szx` `BDSK` block (`szxFile.ts`); `snaWriter.ts` writes 0 ("not paged").
- **Host and debugger:** `ZxSpectrum128WasmHost.getPartitionLabels()` lists R0, R1, B0–B7;
  `getRomFlags()`; `getCodeInjectionFlow`, `getTapeLoadFlow`.
- **Test harness:** `test/harness/sp128/` runs the Pentagon (`createSp128Session("pentagon")`), has
  `insertDisk` for the +3, `runTo(address, { rom })`, `typeText`, `runFlow`, `screenText`.
  Hardware tests live in `test/sp128-hw/`.
- **References in the repo:** `_input/765.pdf` (the uPD765) exists; there is no WD1793 data sheet yet
  (Phase 0 adds one). The Next FPGA sources have no Beta 128.

## 3. Decisions (proposed; see §8)

- **B1. The Beta 128 is part of the Pentagon model.** `pentagon` gets `MC_DISK_SUPPORT: 2`; the 128K
  model stays disk-less. No new model id, so G9.1's projects are unaffected.
- **B2. One C device, shared.** The WD1793 and the Beta 128 glue go in
  `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beta128.c`, `#include`d by `sp128.c` with the
  same macro renaming the ULA, PSG and tape files use, so a later 48K or 128K Beta 128 (Q2) reuses it
  unchanged. Enabled at hard reset (`sp128HardReset(timing, beta128)`), so the 128K model pays only a
  predictable branch.
- **B3. Images live in WASM memory, as raw sectors.** A `.trd` uploads as-is; an `.scl` is converted to
  a TRD image on insert (Q4). The core sees one layout: `track * 2 + side`, 16 × 256 bytes.
- **B4. One disk-format layer in TypeScript.** `src/emu/machines/disk/trd/` gets a TRD reader/writer
  (geometry from the disk-info sector, catalogue, free space), an SCL→TRD converter, and a blank-disk
  formatter. `saveDiskChanges`, `applySectorChangesToDiskContents`, the Create Disk dialog and the
  insert dialog choose by format (`.dsk` → DSK, `.trd` / `.scl` → TRD), never by machine.
- **B5. Accurate timing, no fast mode at first (Q6).** DRQ comes once per byte at the drive's data
  rate (250 kbit/s: one byte every 112 T at 3.5 MHz), with rotation, index pulses, head settle and
  step rates from the data sheet. TR-DOS's own loops then behave as on hardware. A fast mode, like the
  tape's, is a later option.
- **B6. Provenance.** The WD1793 is written from its data sheet; the Beta 128's ports and paging from
  its documentation; TR-DOS behaviour (entry points, the command loop's waiting point) found by
  running the ROM in the harness and recorded in Klive's words, as G9.2 did for the Amstrad ROMs. No
  code from other emulators (Fuse, Unreal Speccy, ZEsarUX: GPL) is copied or translated.
- **B7. Test disks are Klive's own.** Fixture `.trd` / `.scl` images are made by Klive's own
  formatter and writer from programs in the repository, so no third-party disk image is needed.

## 4. Behaviour to emulate

1. **Paging trap.** TR-DOS ROM in on an opcode fetch from `$3D00–$3DFF` with the 48K BASIC ROM
   selected (ROM 1 of the 128K ROMs); out on an opcode fetch from `$4000` and up. Data reads do not
   trigger it. The `$7FFD` ROM bit still selects which Sinclair ROM returns.
2. **Ports only while paged.** Outside TR-DOS, `$1F`/`$3F`/`$5F`/`$7F`/`$FF` behave as on a plain
   Pentagon (unattached: `$FF`; no floating bus).
3. **WD1793 commands:** type I (Restore, Seek, Step, Step In, Step Out, with update/verify/head-load
   flags and the four step rates), type II (Read Sector, Write Sector, single and multiple), type III
   (Read Address, Read Track, Write Track — Write Track is how TR-DOS formats), type IV (Force
   Interrupt with its conditions). Status register meaning by command type; Busy, DRQ, Lost Data,
   CRC Error, Record Not Found, Write Protect, Track 0, Index, Not Ready.
4. **Drives:** 80 or 40 tracks, one or two sides, from the image; no disk → Not Ready; write-protected
   → Write Protect on writes; motor/ready behaviour as the Beta 128 wires it.
5. **Reset:** system register bit 2 low resets the controller; a machine hard reset resets the
   interface and pages the TR-DOS ROM out (Q5).
6. **Timing:** B5.

## 5. Phases

### Phase 0 — references, ROM and fixtures (S)
1. Settle the TR-DOS ROM source and licence (Q1); add the ROM (or the setting that names it), with a
   readme in the style of `spp3-roms-readme.txt`, a line in `THIRD_PARTY_NOTICES.md`, and a test of
   its size and CRC32.
2. Add the WD1793 data sheet to `_input/`; record the port and paging facts of §1 and §4 with their
   sources in §9 of this plan.
3. Boot TR-DOS in the harness (48 BASIC, `RANDOMIZE USR 15616`) with no disk: record the address of
   the TR-DOS command loop's key wait and the entry points the Disk Loader flow needs (B6).

### Phase 1 — the controller and the interface in the core (M)
1. `zx-spectrum-beta128.c`: the WD1793 state machine (B5 timing, driven from the tact counter as the
   tape player is), the system register, the drive state, the image buffers (two drives; capacity
   for an 80-track double-sided disk each: 640K), upload/eject/write-protect exports and a dirty
   revision with per-sector change tracking.
2. `sp128.c`: the paging trap in the opcode-fetch path; the TR-DOS ROM as a third ROM page (`R2`);
   port decoding gated by "TR-DOS paged"; `sp128HardReset(timing, beta128)`; getters for the debugger
   and the snapshot capture (paged flag, FDC registers, system register).
3. The 128K golden (`test/sp128-hw/sp128-golden.test.ts`) still passes bit for bit; the Pentagon's
   G9.1 timing tests still pass; the speed check of G9.1 is repeated.

### Phase 2 — WD1793 and Beta 128 hardware tests (M)
In `test/sp128-hw/beta128/`, through the harness (a new `insertTrd`/`insertDisk` for the Pentagon,
and reads of the FDC registers), each test citing the data-sheet section it checks:
1. Paging: fetch from `$3D00–$3DFF` with ROM 1 pages in; with ROM 0 does not; a data read of `$3D00`
   does not; a fetch from `$4000+` pages out; the ports respond only while paged.
2. Type I: Restore reaches track 0 and sets Track 0; Seek/Step update the track register; step-rate
   timing; verify against the image's track; Index pulses at 5 Hz (300 rpm).
3. Type II: read and write one and several sectors with DRQ per byte at 112 T; Lost Data when the CPU
   is late; Record Not Found for a missing sector; Write Protect.
4. Type III: Read Address returns the sector ID; Write Track formats a track that Read Sector then
   reads.
5. Type IV and reset: Force Interrupt stops a command and raises INTRQ as asked; the system
   register's reset bit clears the controller; Not Ready with no disk.

### Phase 3 — disk formats and the media path (M)
1. `disk/trd/`: TRD geometry and catalogue reader, writer (add a file), blank-disk formatter
   (TR-DOS's disk-info sector), SCL→TRD converter; unit tests, including round trips.
2. Media: `MC_DISK_SUPPORT: 2` on `pentagon` and `MEDIA_DISK_A/B` on the 128K machine; the disk menu
   on `sp128` gated by the model; the insert dialog's filter by machine (`.dsk` on the +3, `.trd` /
   `.scl` on the Pentagon); write-back of `.trd` changes by direct sector offset; `.scl` handled as Q4
   decides; the media strip shows the Pentagon's drives; the last session's disks are restored.
3. Create Disk dialog: a TR-DOS blank disk (80/40 tracks, one/two sides) on the Pentagon
   (MVC tests in `test/dialogs/createDisk/`).
4. Optional, if it stays small: the DSK viewer shows a TRD/SCL catalogue (files, types, sizes, free
   sectors).

### Phase 4 — TR-DOS end to end and the IDE flows (M)
1. On the real TR-DOS ROM in the harness, with Klive-made fixture disks (B7): `CAT` lists the
   catalogue; `LOAD` a BASIC program and a `CODE` file and run them; `SAVE` a file and find its bytes
   in the image (and in the file after write-back); `FORMAT` a blank disk; `RUN` boots a disk's
   `boot` file.
2. The **Disk Loader** flow (Q5): `getDiskLoadFlow()` on the 128K host, analogous to
   `getTapeLoadFlow()` — reset, 48 BASIC, enter TR-DOS, boot. A "Boot disk" command/menu item
   uses it. E2E test: the flow boots a fixture disk whose program writes a known byte.
3. Code injection is unchanged (the 128K's flows; TR-DOS is not paged at reset) — the G9.1 flow tests
   stay green.
4. Debugger: the partition label `R2` ("TR-DOS ROM") in the memory and disassembly views, `getRomFlags`,
   breakpoints in the TR-DOS ROM by partition, the Call Stack across the paging trap.

### Phase 5 — snapshots and state files (S–M)
1. `.sna`: a 128K `.sna` with the TR-DOS byte set loads on the Pentagon with the TR-DOS ROM paged in
   (the warning goes on the Pentagon, stays on the 128K); saving writes the byte.
2. `.szx`: read and write the `BDSK` block (interface state, drives, current track/sector, the
   paged flag) from the zx-state specification; disks are referenced, not embedded (as the +3's
   `DSK` blocks are handled).
3. Klive state files: the FDC and the images are in WASM memory, so they travel with the image; the
   files they came from are detached on load (state-files plan D11), as on the +3.
4. RZX: a recording made on a Pentagon with TR-DOS plays back (the disk is part of the embedded
   state; the RZX plan's determinism tests cover it).
5. Tests: extend `test/spectrum/snapshot/*` and `test/wasm/state/machine-state-flow.test.ts`.

### Phase 6 — documentation and roadmap (S)
1. `docs/content/machine-types.mdx` (the Pentagon's disks), a how-to for TR-DOS disks (insert, boot,
   create, write-back), the command reference for the new command.
2. `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2 and §4; mark G9.1b ✅ in `CLOSING_THE_GAPS_PLAN.md`;
   this plan's "as built" section.
3. `.ai/ui-theming-intent-and-lessons.md` for any visual rule the disk UI taught.
4. `npm run doc:build && npm run doc:check`.

## 6. Verification

Focused tests per phase, then `npm run build:check`, `npm run lint:renderer` (Phases 3–4 touch the
renderer), `npm run test:all`, and `npx electron-vite build --config build/electron.vite.config.ts`.
In the running IDE (the doc-shots Playwright driver): insert a `.trd`, boot it with the Disk Loader,
save a file from TR-DOS and confirm the `.trd` on disk changed; insert an `.scl` and confirm Q4's
behaviour.

## 7. Risks

| Risk | Mitigation |
|---|---|
| The TR-DOS ROM cannot be shipped | Q1: a user-supplied ROM setting; without it the Pentagon runs as today and the disk items explain why |
| The paging trap slows every opcode fetch on the 128K | gate it on `beta128` and the selected ROM; G9.1's speed check repeated |
| WD1793 timing details (Lost Data, index, head settle) differ from hardware in ways TR-DOS notices | Phase 2's data-sheet tests; Phase 4 runs TR-DOS's own read, write and format paths |
| Copy-protected disks rely on Read Track / odd sector IDs that a TRD cannot hold | out of scope: TRD and SCL hold standard TR-DOS disks; FDI/UDI (which can) are a later format |
| Writing back to an `.scl` corrupts it | Q4: never written back in place |
| A Klive state of the 128K changes size | the layout fingerprint changes as in G9.1; old states load through their `.szx` (D9) |

## 8. Questions for the author

- **Q1. The TR-DOS ROM.** Proposed: Phase 0 looks for a TR-DOS 5.0x image whose distribution with
  emulators is permitted, and ships it like the Amstrad ROMs (readme, notice, CRC test). If no clear
  permission is found, the user names a ROM file in the settings, and the Pentagon's disk features
  stay off until they do. Which do you prefer if the rights are unclear?
- **Q2. Which machines.** Proposed: the Pentagon model only, with the interface always present
  (B1). The 128K (and 48K) with a Beta 128 as an option is a later step on the same device (B2).
- **Q3. Drives.** Proposed: two (A, B), reusing the +3's media ids and UI. The Beta 128 supports four.
- **Q4. `.scl` images.** Proposed: converted to TRD on insert; TR-DOS can write to the emulated disk,
  but the `.scl` file is never written back. The disk is shown as "changed, not saved", and a command
  saves it as a `.trd`. Alternatives: `.scl` read-only (write-protected), or rewrite the `.scl` on
  every change.
- **Q5. Booting.** Proposed: the Pentagon still boots the 128K menu (so code injection and the tape
  Loader stay as they are), and a Disk Loader flow plus a "Boot disk" item enter TR-DOS and boot the
  disk. Alternative: boot straight into TR-DOS, as many real Pentagons did, which changes every IDE
  flow on the model.
- **Q6. Speed.** Proposed: accurate disk timing only; a fast-disk mode, like fast tape loading, later.

## 9. Reference values (filled in Phase 0)

| Value | Klive | Source |
|---|---|---|
| Ports and bits (`$1F`, `$3F`, `$5F`, `$7F`, `$FF`) | | |
| Paging trap range and conditions | | |
| Data rate, rotation, index pulse | | |
| Step rates, head settle | | |
| TR-DOS ROM version and CRC32 | | |
| TR-DOS command loop key wait | | |
