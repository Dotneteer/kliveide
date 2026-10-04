# Snapshot Saving (G2.4) and Klive State Files (G2.6) Plan

Status: **done** (2026-10-04).
- **G2.4** (Phases 1–3) is implemented, except the manual interop check against Fuse/ZEsarUX
  (D16), which needs those emulators installed.
- **G2.6** (Phases 4–9) is implemented.
- §5.1 and §5.2 record where the code differs from this plan.
- Decisions D1–D14 are accepted, and the §9 questions were answered as proposed (D15–D22).
Scope: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md):
- **G2.4**: save the current 48K / 128K / +2E / +3E machine as `.szx`, `.z80` or `.sna`;
- **G2.6**: Klive state files that save and restore the *complete* emulator state of every WASM
  machine: 48K, 128K, +2E/+3E, ZX Spectrum Next, Z88, ZX80 and ZX81.

The two items are planned together because they share four things:
- the capture point (a paused machine at an instruction boundary);
- the save-dialog and command infrastructure, which Klive does not have yet;
- the menus;
- a fallback: a G2.6 state of a Spectrum embeds a G2.4 `.szx` (D9).

Builds on the finished [ZX_SPECTRUM_SNAPSHOT_PLAN.md](ZX_SPECTRUM_SNAPSHOT_PLAN.md) (snapshot
*loading*: its model, parsers, restore, viewer and traps are prerequisites here). Its §1.2 kept the
model "shaped so a writer can be added later". This plan adds that writer.

Format references (normative; the writers are written from these, in Klive's own words, exactly as
the parsers were):
- `.sna`: <https://worldofspectrum.org/faq/reference/formats.htm>
- `.z80`: <https://worldofspectrum.org/faq/reference/z80format.htm>
- `.szx`: <https://www.spectaculator.com/docs/svn/zx-state/intro.shtml>

> Field layouts and ids quoted below come from the parsers in `src/common/spectrum/snapshot/`,
> which were checked against the specs in the loading plan's Phase 1–2. Anything not covered by a
> parser (the `.z80` T-state encoding as *written*, the `.szx` `CRTR` layout, the 147,487-byte `.sna`
> rule) is checked against the spec again before code is written.

---

## 1. What is being added, and why

**G2.4.** Klive loads all three Spectrum snapshot formats, but cannot write any of them. Saving lets
a user:
- bookmark a debugging situation;
- attach a bug repro that Fuse, ZEsarUX or Spectaculator can open;
- hand a game state to someone else.

The competitive analysis (§2 row "Load .sna / .z80 / .szx snapshots", §4 W5) lists saving as the
remaining part of the snapshot gap.

**G2.6.** Standard snapshot formats cannot describe:
- the Next at all;
- the Z88 and ZX80/81 in Klive's terms;
- the parts of a Spectrum that `.szx` leaves out, such as the µPD765 mid-command, the tape
  player's exact pulse position and the ULA's floating-bus phase.

A Klive state file captures *everything* the core holds, so "save, load, continue" is identical to
"continue". This is the user-facing half of the roadmap's cross-cutting item: cheap whole-state
capture across all cores. G4.4 (reverse debugging) and G2.7/G2.8 (RZX) need the same capture, so
G2.6 is also the first concrete step of the Wave 4 design spike.

### 1.1 What the code already has

| Concern | Where | Notes |
| --- | --- | --- |
| Normalised model | `src/common/spectrum/snapshot/spectrumSnapshot.ts` | `SpectrumSnapshot`: cpu, ula, paging, `ram` (128K bank numbering), ay, peripherals |
| Parsers | `snaFile.ts`, `z80File.ts`, `szxFile.ts`, `parseSpectrumSnapshot.ts`, `z80Compression.ts` | read only; **no writer exists anywhere** |
| Restore into a core | `src/emu/machines/zxSpectrum/spectrumSnapshotRestore.ts` | `restoreSpectrumSnapshot(core, snapshot)` over a prefixed export table |
| Core getters G2.4 needs | `scripts/build-sp*-wasm.cjs` | present: every register incl. `Wz`, `Halted`, `EiBacklog`, `Iff2`, `CurrentFrameTact`, `PortFeValue`, `BorderColor`, `PsgRegisterIndex`, `ReadPsgRegisterValue`, `ReadRamBank`, `GetSelectedBank/Rom`, `GetPagingEnabled`, `GetUseShadowScreen`, +3: `GetInSpecialPagingMode`, `GetSpecialConfigMode`, `GetDiskMotorOn`, `GetDiskDriveCount`. **Missing: the raw last-written `$7FFD` and `$1FFD` values** (the +3's printer-strobe bit cannot be rebuilt from the parts), and `GetCpuPrefix` is exported but is not yet used as a guard |
| Next checkpoint | `ZxNextWasmV2Machine.ts:110-130, 583-650` | `captureCheckpoint` / `tryRestoreCheckpoint` / `invalidateCheckpoints`: a copy of WASM linear memory minus the trace ring (`zxnextTraceGetStartOffset`), plus a few TS mirror fields. One in-memory slot, no header, no version, never persisted |
| Checkpoint interface | `src/renderer/abstractions/IAnyMachine.ts:231-244` | optional trio; the only caller is `MachineController.runCode` (`MachineController.ts:718-746`) |
| Checkpoint tests | `test/wasm/zxNext/wasm-next-checkpoint*.test.ts`, `test/zxnext-hw/checkpoint/checkpoint-restore.test.ts` | replay identity, hard reset, SD write invalidation |
| WASM memory | `scripts/build-*-wasm.cjs` | `--initial-memory == --max-memory` for every core: **fixed, no growth**. sp48 / sp128 / spp3e / z88: 8 MiB; zx8081: 2 MiB; zxnext: 32 MiB (about 13 MiB without the trace ring) |
| Restore seam | `IMachineController.restoreState(apply, description)` (`MachineController.ts:616`) | stop → apply → `attachStoredMedia` → Paused |
| File write | `MainApi.saveBinaryFile(path, data, resolveIn?)` (`RendererToMainProcessor.ts:474`), `confirmFileOverwrite` (:188) | **no `showSaveDialog` exists anywhere in `src`** |
| Load menus to mirror | `spectrumSnapshotRenderer` / `openSpectrumSnapshot` (`src/main/machine-menus/zx-specrum-menus.ts:512-570`); File menu item at `src/main/app-menu.ts:370-378` | |
| Media | `mediaStore` (`src/emu/machines/media/media-info.ts:52`); `MEDIA_TAPE`, `MEDIA_DISK_A/B`, `MEDIA_SD_CARD` | the +3 disk *bytes* live in WASM memory (`spp3eDiskData[2][0x80000]`); dirty sectors are written back to the host file by `saveDiskChanges` (`RendererToMainProcessor.ts:812`); the Next SD card is a host `.cim` file that is **not** in WASM memory |
| C64 | `src/emu/machines/c64/` | TypeScript and experimental: out of scope (§1.4) |

### 1.2 Decisions

| # | Decision |
| --- | --- |
| D1 | **Writers live beside the parsers and write from the model.** `snaWriter.ts`, `z80Writer.ts` and `szxWriter.ts` in `src/common/spectrum/snapshot/` take a `SpectrumSnapshot` and return bytes plus a list of **losses**: what the format cannot express. They never see a machine. Capture is a separate, machine-side step that produces the model. |
| D2 | **The format follows the file extension.** **`.szx` is the recommended and default format**, because it is the only one that keeps the frame position, HALT, the EI delay, MEMPTR, `$1FFD` and the +3 drive state together. `.z80` is always written as **v3**. `.sna` is offered for compatibility only. |
| D3 | **Saving is lossy only with a warning, never silently.** Each writer reports its losses (for example: `.sna` has no frame position and no EI delay; `.z80` has no NTSC 48K and no +2E/+3E). The command prints them in yellow, and the menu shows them in a message box *after* saving. A save is **refused** only when the file would load into a different machine state: §3, traps 3 and 4. |
| D4 | **Capture happens on a paused machine.** A Running machine is paused, captured and resumed, so it is never left paused by a save. A Paused machine stays paused. A Stopped machine has no state, so the save is refused with "Start the machine first". Capture also refuses when the CPU is between a prefix and its opcode (`GetCpuPrefix ≠ 0`), which only a single-step can produce; the message says "step once more". |
| D5 | **Saving the 48K `.sna` does not touch the live machine.** The format pushes PC onto the stack. The writer pushes it in the *model's copy* of RAM, never in the core. |
| D6 | **A state file is a memory image of the core**, generalising the Next checkpoint to every WASM core. It holds the core's linear memory minus per-core *volatile* ranges (trace rings, access logs, audio and scratch buffers), compressed with `fflate` (D5 of the loading plan: no new dependency), plus the wrapper's TypeScript mirror fields. This is exact by construction: the Next checkpoint tests already prove replay identity. A per-field, versioned serialiser for each core (the roadmap's "M–L" assumption) is **not** built. |
| D7 | **A memory image is valid only for a core with the same memory layout.** Every core build publishes a **layout fingerprint**: a hash over its data-symbol map (addresses and sizes of every static) and its function-table layout. A state file records it. On load, an equal fingerprint restores the image. A different fingerprint means a code-only change kept the image valid, or it did not, and Klive cannot tell which without the fingerprint; so a different fingerprint does **not** restore the image (D9). |
| D8 | **The state file is a chunked container**, so readers can skip what they do not know: a header (magic, container version, machine id, model id, machine config, Klive version, core fingerprint, saved-at time), then tagged sections: `META`, `THMB` (a screen thumbnail for the viewer and Explorer), `CORE` (the compressed image), `HOST` (the TS mirror as JSON), `MEDI` (media references and fingerprints), and optionally `SZX ` (D9). |
| D9 | **Spectrum states embed a `.szx` as the portable fallback.** A 48K, 128K or +2E/+3E state also carries the G2.4 `.szx` of the same moment, which costs about 50 KB. A state from a Klive build with another fingerprint then still loads, through the snapshot path, with a warning saying exactly what was lost (tape position, FDC mid-command, and so on). Next, Z88 and ZX80/81 states have no portable fallback: a fingerprint mismatch is refused with "saved by Klive x.y; this core has changed since". |
| D10 | **The state carries the machine type, and the load switches to it.** The guard is the same as the loading plan's D7: with a project open, a state of a different machine id is refused; without a project, the machine is switched freely. **A state is never retargeted** to another model: a `fdd2` state does not load into `fdd1`. The model is set from the state, and inside a project a model difference gives a warning. |
| D11 | **Media that live in WASM memory travel with the image.** The tape image and +3 disk images do. **The file they came from is detached on load:** the media store gets the *name*, but the restored disk's dirty-sector writeback is switched off until the user re-inserts a disk. Otherwise rewound guest writes would corrupt the original `.dsk`. The output says so. |
| D12 | **The Next SD card is referenced, not embedded.** `MEDI` records the `.cim` path, its size and a content fingerprint (a hash of the FAT and directory sectors, and the mtime). On load, a missing card is refused. A changed card warns and asks for confirmation: "the file system may be inconsistent". Embedding a 128 MB–2 GB image is out of scope (D18). |
| D13 | **No IDE state in a state file**: no breakpoints, watches, source maps or open documents. Those belong to the project. A state file is a machine state, which keeps it shareable. |
| D14 | **Test fixtures are synthetic or self-produced.** A writer's output is checked by our parser (round trip) *and* against hand-built bytes from `test/spectrum/snapshot/builders.ts`, never only against itself. Interop with other emulators is checked manually and with an installed Fuse/ZEsarUX oracle (D16), never in CI. |
| D15 | (Q1) The names in §1.3 are adopted: the `.kls` extension, `state-save` / `state-load`, and `zx-snapshot-save`. |
| D16 | (Q2) An installed **Fuse and ZEsarUX may be used as oracles for reading** Klive-written `.sna`/`.z80`/`.szx` files, under the loading plan's D15 conditions: local only, only observed results are recorded, no emulator code is copied or read for design, and never in CI. It is used for Phase 3's interop check. |
| D17 | (Q3) **`.szx` references the tape by file name by default.** It embeds the tape (the `TAPE` chunk's embedded form, zlib-compressed) only when the tape has no file on disk, such as a tape built by SAVE. |
| D18 | (Q4) **The Next SD card is referenced only** (D12). A "save a copy of the card beside the state" option is a later item, added only if users ask for it. |
| D19 | (Q5) **Quick save/restore is in this plan** (Phase 8): **one in-memory slot per machine**, reached from a menu item and a keyboard shortcut each for save and restore. The slot is never written to disk. It is built on Phase 5's state image. It is dropped when the machine is rebuilt (a machine or model change) and when the app closes. The shortcuts are chosen in Phase 8 so that they clash with no existing emulator or IDE key. |
| D20 | (Q6) **The Z88 RTC is restored as saved** on a state load, so that continuation is exact. It is not advanced to "now" as the `.z88` loader does. |
| D21 | (Q7) **It is accepted that Next, Z88 and ZX80/81 states stop loading after a Klive update that changes the core's memory layout** (D7, D9). The refusal message names the Klive version that saved the state, and the docs say plainly that states are bookmarks, not archives. |
| D22 | (Q8) **Two PRs:** G2.4 (Phases 1–3) first, then G2.6 (Phases 4–9). G2.4 closes the W5 saving gap on its own. |

### 1.3 Naming (D15)

- State file extension: **`.kls`** ("Klive state"); magic `KLIVESTA`; container version 1.
- Commands:
  - `zx-snapshot-save <file> [-f]` (alias `zxsave`): `-f` overwrites an existing file;
  - `state-save <file> [-f]` (alias `ssave`);
  - `state-load <file> [-r | -d]` (alias `sload`): with no option, or `-d`, it debugs, as `zx-snapshot` does.
- Menus:
  - each Spectrum machine menu: **Save Snapshot...**;
  - every machine menu: **Save State...** and **Load State...**;
  - File menu: **Save ZX Spectrum Snapshot...**, **Save Machine State...** and **Load Machine State...**.

### 1.4 Out of scope

- RZX (G2.7/G2.8). Capture is reused, but no input recording happens here.
- More than one quick slot per machine (D19), and quick slots that survive a machine rebuild or an
  app restart.
- Saving snapshots of the Next as `.sna`/`.z80`/`.szx`. NextZXOS formats are a separate feature.
- Writing `.z88` (OZvm) snapshots. The Z88 gets a Klive state (G2.6) only.
- The C64, a TypeScript core with no linear memory. When it graduates it will need a per-field
  serialiser, which is recorded as a known gap.
- Embedding the Next SD card image (D12).
- Restoring a state into a *different* Klive core build without loss (D7, D9).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Model, parsers | `src/common/spectrum/snapshot/*` |
| New writers | `src/common/spectrum/snapshot/{snaWriter,z80Writer,szxWriter,writeSpectrumSnapshot}.ts`; `z80Compression.ts` gains `compressZ80DataBlock` |
| Capture (Spectrum) | new `src/emu/machines/zxSpectrum/spectrumSnapshotCapture.ts`, the mirror image of `spectrumSnapshotRestore.ts`; `captureSnapshotState()` on `ZxSpectrum48/128/P3eWasmV2Machine.ts` |
| Core exports | `sp48.c`, `sp128.c`, `spp3e.c`: `GetPort7ffd`, `GetPort1ffd` (last written values); the export lists in `scripts/build-sp*-wasm.cjs` and the loader types `*WasmV2Loader.ts` |
| State image | new `src/emu/machines/state/` (`wasmStateImage.ts`, `kliveStateFile.ts`); per-core `volatileRanges()` and `captureHostState()`/`restoreHostState()` on every `*WasmV2Machine.ts`; `IAnyMachine` gains `saveMachineState?()`/`loadMachineState?()` |
| Next checkpoint | `ZxNextWasmV2Machine.ts:583-650` refactored onto `wasmStateImage.ts` (its tests must stay green, unchanged) |
| Fingerprint | every `scripts/build-*-wasm.cjs`: link with a symbol map, hash the data-symbol and function-table layout, emit `<core>.layout.json` beside the `.wasm`, and the loader exposes it |
| Orchestration | `src/renderer/appEmu/machines/{spectrumSnapshotSave,machineStateSave,machineStateLoad}.ts`; `EmuApi` stubs and proxies, handlers next to `loadSpectrumSnapshot` |
| Save dialog | new `displaySaveFileDialog(browserWindow, filters, settingsId, defaultName)` beside `displayOpenFileDialog` (`RendererToMainProcessor.ts:1226`) |
| Commands | `src/renderer/appIde/commands/{SpectrumSnapshotSaveCommand,MachineStateCommands}.ts`, registered in `IdeCommands.ts` |
| Menus | `zx-specrum-menus.ts` (`spectrumSnapshotRenderer`), a new `machine-menus/state-menus.ts` composed for every machine in `machine-menu-registry.ts`, and `app-menu.ts` (File) |
| Viewer | `.kls` file type and a `MachineStateViewerPanel` (§4.9); `src/renderer/registry.ts` |
| Media | `media-info.ts`, `MachineController.attachStoredMedia` (:115), `saveDiskChanges`, the +3 wrapper's dirty-sector publisher (`publishDiskChangesFromWasmV2`, `ZxSpectrumP3eWasmV2Machine.ts:906`) |
| Tests | `test/spectrum/snapshot/` (writers), `test/harness/sp48/`, `test/harness/sp128/`, `test/harness/z88/`, `test/harness/zx81/`, `test/harness/zxnext/` (sessions gain `saveState`/`loadState`), the `e2e-cores` tier in `build/e2e-tests.ts` |

---

## 3. The traps

1. **The 48K `.sna` pushes PC.** PC goes to `[SP-2]` and SP drops by 2, in the model's RAM copy only
   (D5). If `SP-2` is below `$4000` (ROM), the pushed bytes are lost on load and the program
   crashes, so the save is **refused**. If SP is `$0000` or `$0001` the push wraps; that is refused
   too. Two stack bytes being overwritten is how the format works, and it is documented, not a
   loss: a correct loader pops them.
2. **`.sna` IFF.** Byte 19 bit 2 holds IFF2; a loader's implied `RETN` copies it into IFF1. If
   IFF1 ≠ IFF2 at capture (inside an NMI handler), the round trip changes IFF1. This is reported as a
   loss.
3. **A +2E/+3E in special paging (`$1FFD` bit 0) cannot be a `.sna` or a `.z80` it would load
   back from.** `.sna` has no `$1FFD`. `.z80` v3 has `$1FFD` (the 55-byte-header byte), but only for
   +3 hardware modes. So `.sna` from special paging is **refused**, and from normal paging it is
   written as a 128K `.sna` with a loss ("loads as a 128K"). `.z80` writes mode +3 (`fdd*`) or +2A
   (`nofdd`) with `$1FFD`, plus a loss "Amstrad ROMs expected" (the loading plan's D3, mirrored).
4. **A 16K or NTSC 48K in `.z80`.** 16K is mode 48K with the "modified hardware" bit. NTSC has no
   `.z80` representation, so the file is written as PAL 48K with a loss. `.sna` cannot say either:
   16K is written as a 48K with zeroed upper RAM, and the save is **refused** only if upper RAM is
   non-zero. That cannot happen on a real 16K, but Klive's 16K core is a 48K core with a model flag.
   This must be checked in Phase 1.
5. **Raw `$7FFD`/`$1FFD`.** The cores keep the decoded parts (bank, ROM, shadow, lock, special mode,
   motor) but the +3's printer strobe (`$1FFD` bit 4) and the unused bits are not recoverable. New
   `GetPort7ffd`/`GetPort1ffd` exports return the last written byte. They are needed for *exact*
   `.szx` `SPCR` output, and so that the round-trip test can compare bytes.
6. **The paging lock survives the save.** `$7FFD` bit 5 is saved as it is. The loading restore
   already writes `$7FFD` last, so a locked snapshot reloads locked. The test keeps it that way.
7. **The frame tact convention.** `GetCurrentFrameTact` must mean "T-states since the interrupt",
   the convention the loader assumed for `.z80` v3 and `.szx` (the loading plan's §7, first risk).
   The writer emits exactly what the loader reads. The save → load → run N frames test pins it.
   `.z80` v3's T-state field is a quarter-frame counter plus a low word with an offset, written *from
   the spec*; the parser's reading of it is the oracle.
8. **HALT.** Klive keeps PC on the `HALT` opcode, the same as `.szx`. `.z80` and `.sna` have no
   HALT flag, and PC on the `HALT` opcode re-executes it, which is equivalent. So it is *not* a
   loss, and the test checks it.
9. **The EI delay and MEMPTR** exist only in `.szx`. A `.z80`/`.sna` saved right after `EI` may
   take an interrupt one instruction early on load. That is a loss line, only when
   `GetCpuEiBacklog ≠ 0`.
10. **The volatile ranges must really be volatile.** If something the core *reads* lives in an
    excluded range (for example the access log's write cursor, used by conditional breakpoints),
    leaving it as the current values on restore breaks determinism. Each core's exclusion list is
    reviewed against its C sources in Phase 5, and the replay-identity test (§5, Phase 6) is the
    proof: every excluded byte is *poisoned* before restore, and replay must still be identical.
11. **Restore must not clobber what the host already put in.** The Next checkpoint restores the
    whole image *except* the trace ring. ROM images uploaded by the host (custom ROMs, Z88 cards)
    are *inside* the image and come back from the file, which is intended: a state carries its own
    ROM. Since the same file can also be loaded where the configured ROM differs, the viewer and the
    load report "ROM from the state file differs from the configured ROM".
12. **`attachStoredMedia` runs after `applyState`** (the loading plan's trap 12). For a state file
    it would re-upload the stored tape and disks *over* the restored image, destroying the tape
    position and the disk contents. `restoreState` therefore needs a "keep core media" flag, or the
    media store must be updated to match the state first, with uploads skipped when the revision
    matches. Phase 7 chooses between these, and a test covers it.
13. **Disk writeback after a restore** (D11). `spp3eFdcGetDirtyRevision` continues from the
    restored value. Unless writeback is detached, the next dirty sector is written into the host
    `.dsk` at whatever offset the rewound guest chose.
14. **Next SD writes invalidate in-memory checkpoints today** (`processWasmV2SdWriteFrameCommand`,
    :1239). A *state file* is not invalidated, because it is the user's explicit choice; D12's
    fingerprint warning replaces that protection.
15. **Function pointers in linear memory are table indices.** A code-only rebuild can renumber
    the indirect-function table, and a restored pointer then calls the wrong function. The
    fingerprint (D7) must therefore hash the **table layout** as well as the data symbols. If that
    is hard to get from the linker, the fingerprint falls back to a hash of the whole `.wasm` and
    accepts more invalidation.
16. **The TS mirror is part of the state.** Each wrapper has fields outside WASM: frame counters,
    `lastRenderedFrameTact`, queued key strokes, the frame command, audio sample rate, the Z88's
    RTC host-time base, and the tape's TS-side play state if any is left. These are listed per
    wrapper in Phase 5. The Next checkpoint's field list is the model. Queued key strokes and the
    pending frame command are *cleared*, not saved, as the checkpoint already does.
17. **The Z88 RTC.** The Z88 snapshot load advances the RTC to "now" (`nowMs`). A state restores
    it **as saved**, because exact continuation is the point (D20).
18. **Audio.** Restoring the PSG/DAC state mid-sample can click. The audio output buffer is volatile
    (trap 10) and is flushed on load, as the checkpoint does with `wasmV2AudioSamples`.
19. **Big IPC payloads.** The Next image is about 13 MiB before compression. Compression happens in
    the emulator renderer, and only the compressed bytes cross IPC to `saveBinaryFile`. The
    compression level is chosen in Phase 5 so a save stays under about 300 ms on the Next (it is
    measured, not assumed).

---

## 4. Design

### 4.1 G2.4: capture — `spectrumSnapshotCapture.ts`

`captureSpectrumSnapshot(core: SpectrumSnapshotCore & { model }): SpectrumSnapshot` reads, through
the same prefixed export table as the restore:

- **cpu**: every pair, `IR` (R with bit 7), IM, IFF1, IFF2, SP, PC, `halted`,
  `suppressInterrupt = EiBacklog ≠ 0`, `memptr = Wz`;
- **ula**:
  - `border = GetBorderColor`;
  - `lastFe = GetPortFeValue`;
  - `frameTact = GetCurrentFrameTact`;
- **paging** (sp128/spp3e): `port7ffd = GetPort7ffd`, `port1ffd = GetPort1ffd` (spp3e);
- **ram**:
  - 48K: banks 5/2/0 from `$4000`/`$8000`/`$C000` of the flat memory (16K: bank 5 only);
  - 128K and +3E: all 8 banks through `ReadRamBank` or the RAM pointer;
- **ay** (sp128/spp3e): `selected = GetPsgRegisterIndex`, and R0–R15 through
  `ReadPsgRegisterValue`. That export must be a pure read with no envelope side effect; Phase 2
  checks this;
- **peripherals**:
  - +3: `drives = GetFdcEnabledDriveCount`, `motorOn = GetDiskMotorOn`;
  - disks: drive and file name from the media store;
  - tape: file name and `TapeGetCurrentBlockIndex`;
- **machine** from the machine id and model:

  | Model | Machine |
  | --- | --- |
  | `pal-16k` | `16k` |
  | `ntsc` | `48k-ntsc` |
  | `pal` | `48k` |
  | `sp128` | `128k` |
  | `nofdd` | `plus3e`, written as a +2A where the format has no +3e |
  | `fdd*` | `plus3e` |

  `.szx` has id 6 for the +3e.

`captureSnapshotState()` on the three machines calls it, after the D4 guards.

### 4.2 G2.4: writers

`writeSpectrumSnapshot(snapshot, format): { bytes: Uint8Array; losses: string[]; refused?: string }`
dispatches by format to:

- **`szxWriter.ts`** (v1.4, D2):
  - the header: `ZXST`, major 1, minor 4, machine id (the inverse of the parser's `SZX_MACHINES`),
    flags (alternate timings: never);
  - the chunks:
    - `CRTR`: "Klive IDE" and the version;
    - `Z80R`: registers, `dwCyclesStart = frameTact`, the HALTED and EILAST flags, MEMPTR;
    - `SPCR`: border, `$7FFD`, `$1FFD`, last `$FE`;
    - `RAMP` per bank: zlib through `fflate.zlibSync`, with the compressed flag;
    - `AY`, for sp128 and spp3e;
    - `+3`: drives and motor;
    - `DSK` per inserted disk: by **file name** reference, not embedded (the spec reserves
      embedding, and the loader warns when a referenced file is missing);
    - `TAPE`: file name and current block. The tape image is embedded (zlib) only when it has no file
      on disk, for example a tape built by SAVE (D17).
  - It is lossless for everything the model holds.
- **`z80Writer.ts`** (always v3):
  - the 30-byte header with PC = 0, then the 54-byte extended header (55 bytes with `$1FFD`);
  - the hardware mode per trap 3/4;
  - AY registers and the last `$FFFD`;
  - the T-state counter (trap 7);
  - pages compressed with the new `compressZ80DataBlock`. A page whose compressed form is not
    shorter is stored raw with length `$FFFF`, per the spec.
  - Losses: NTSC, +3e/+2E naming, the EI delay, MEMPTR.
- **`snaWriter.ts`**:
  - 48K: the 27-byte header and the PC push (traps 1 and 2);
  - 128K: banks 5, 2, then the paged bank, PC, `$7FFD`, TR-DOS = 0, then the rest, with the paged
    bank duplicated when it is 2 or 5 (the 147,487-byte variant), all per the spec;
  - Losses: the frame position, the EI delay, MEMPTR, AY (48K), and +3 paging (trap 3).

`compressZ80DataBlock` is the inverse of the existing `decompressZ80DataBlock`. That covers the
`ED ED` escaping, runs of 5 or more, any run of `ED`, and the rule that "`ED` followed by a single
byte is not encoded". It also takes the v1 end-marker option, which is not used by the v3 writer but
is tested.

### 4.3 G2.4: orchestration and command

- `EmuApi.saveSpectrumSnapshot(format): Promise<{ bytes; losses; machine; pc }>`, with its handler
  next to `loadSpectrumSnapshot`. `src/renderer/appEmu/machines/spectrumSnapshotSave.ts` takes the
  usual `ports` (the controller and the emulator state) and does:
  1. the D4 guards;
  2. pause if Running;
  3. capture;
  4. resume if it paused;
  5. write.
  A refusal throws with the reason.
- `zx-snapshot-save <file> [-f]` (`SpectrumSnapshotSaveCommand.ts`):
  - the extension picks the format;
  - an existing file needs `-f`, or the command fails with "exists";
  - it writes with `mainApi.saveBinaryFile`;
  - the output is `szx snapshot <file> saved (ZX Spectrum 128K, PC $XXXX).`, plus one yellow line per
    loss.
  - `spectrumSnapshotSaveCommandText(path)` is shared by the menus.

### 4.4 G2.4: menus and dialog

- `displaySaveFileDialog(...)` in the main process, using `dialog.showSaveDialog`. It remembers its
  folder in `appSettings.folders[settingsId]` (`spectrumSnapshotFolder`, shared with Load) and
  proposes `<project or machine name>-<yyyymmdd-hhmm>.szx`. The OS dialog has already confirmed any
  overwrite, so the menu passes `-f`.
- **Save Snapshot...** sits under Load Snapshot in `spectrumSnapshotRenderer`. Its filters are
  `.szx` (first), `.z80`, `.sna`. It is disabled while the machine is Stopped (the menu version is
  bumped on state changes, as other machine items do).
- **File → Save ZX Spectrum Snapshot...** sits beside the load item. It is disabled when the
  machine is not a Spectrum, or is Stopped.
- After a save with losses, a message box lists them, with a "Don't show again for this format"
  checkbox stored in app settings.

### 4.5 G2.6: the state image — `src/emu/machines/state/wasmStateImage.ts`

```ts
type VolatileRange = { start: number; length: number; reason: string };

type WasmStateImage = {
  coreId: string;               // "sp48", "sp128", "spp3e", "zxnext", "z88", "zx8081"
  fingerprint: string;          // D7
  memorySize: number;           // the fixed linear memory size; must match
  volatile: VolatileRange[];    // as captured (for diagnostics)
  memory: Uint8Array;           // the full image with the volatile ranges zeroed
};

captureImage(memory: WebAssembly.Memory, volatile: VolatileRange[]): Uint8Array;
restoreImage(memory: WebAssembly.Memory, image: Uint8Array, volatile: VolatileRange[]): void;
```

- Zeroing the volatile ranges before compression costs nothing and compresses well. On restore,
  those ranges are left as they are in the live core, as the Next checkpoint does with the trace
  ring.
- Every `*WasmV2Machine` implements:
  - `volatileRanges(): VolatileRange[]`, built from exports such as `zxnextTraceGetStartOffset`, the
    access-log pointer and the audio sample pointer. New exports are added where a buffer has none;
  - `captureHostState(): object` and `restoreHostState(o)` (trap 16);
  - and, on top of those, `saveMachineState(): MachineStateParts` and
    `loadMachineState(parts): void`.
- `ZxNextWasmV2Machine.captureCheckpoint`/`tryRestoreCheckpoint` are re-expressed on the same
  helpers. The in-memory checkpoint keeps its semantics (one slot, keyed, invalidated by SD writes),
  and its existing tests are the regression net.

### 4.6 G2.6: the fingerprint

- Each `scripts/build-*-wasm.cjs` links with a symbol map (to be verified in Phase 4: `wasm-ld
  --Map=<file>`, or `llvm-objdump`/`wasm-objdump` over the output if the map lacks what is needed).
- It extracts:
  - every data symbol's (name, address, size);
  - the stack pointer's initial value and the heap base;
  - the indirect-function table's element list as function *names* (trap 15).
- It hashes these with SHA-256 and writes `dist/<core>.layout.json`:
  `{ fingerprint, symbols: n, memorySize }`.
- The loaders import it, so the fingerprint is a static constant in the bundle.
- A **CI check** (`scripts/check-wasm-layout.cjs`) fails when a core's `.wasm` changed but its
  `layout.json` was not regenerated, so the fingerprint can never be stale.
- **What it buys:** C changes that move no static and add no indirect function keep old state
  files loadable. Any layout change invalidates them, safely.

### 4.7 G2.6: the container — `src/common/state/kliveStateFile.ts` (pure)

```
"KLIVESTA" u16 containerVersion=1 u16 flags
u32 headerJsonLength, headerJson (UTF-8):
  { machineId, modelId, config, kliveVersion, coreId, fingerprint, memorySize,
    savedAt, pc, description? }
then sections: { tag[4], u32 length, payload }...
  META  JSON: per-machine extras for the viewer (paging summary, CPU registers)
  THMB  u16 w, u16 h, RGBA (the last rendered frame, downscaled to ≤ 320×256)
  CORE  deflate(image)
  HOST  JSON: captureHostState()
  MEDI  JSON: [{ id, fileName, fingerprint, size, mtime, detached }]
  SZX   the G2.4 .szx bytes (Spectrum only, D9)
```

- `readKliveStateFile(bytes)` validates the magic, the version and the section lengths. Unknown
  sections are skipped, and a missing `CORE` is an error.
- `writeKliveStateFile(parts)` is the inverse.
- Both are tested without a machine.

### 4.8 G2.6: orchestration — save and load

- **Save** (`machineStateSave.ts`):
  1. the D4 guards (the prefix rule applies to every Z80 core);
  2. pause if Running;
  3. `saveMachineState()`, and for a Spectrum also `captureSnapshotState()` → `.szx`;
  4. the thumbnail from the pixel buffer;
  5. media fingerprints (D12; the hash is computed in main over `getSdCardHandler`, through a new
     `MainApi.fingerprintMediaFile(path)`);
  6. resume if it paused;
  7. write the container, then `saveBinaryFile`.
- **Load** (`machineStateLoad.ts`, `EmuApi.loadMachineState(fileName, bytes, mode)`):
  1. Read the container. Run the project guard (D10).
  2. **Fit the machine**: `setMachineType(machineId, modelId, config)` when it differs (copying
     `spectrumSnapshotLoad`).
  3. **Choose the path:**
     - the fingerprint matches → the image path;
     - otherwise, if `SZX ` is present → the snapshot path (`loadSnapshotState`), with a warning
       naming what is lost;
     - otherwise → refuse.
  4. Media:
     - the image path: update the media store to match `MEDI` and mark disks **detached** (D11,
       trap 13);
     - the SD card: check its fingerprint (D12). A mismatch returns a "needs confirmation" result,
       and the command asks.
  5. `controller.restoreState(() => machine.loadMachineState(parts), "state loaded", { keepCoreMedia: true })`
     (trap 12).
  6. Then by mode: run, or debug with a one-shot breakpoint at PC (the snapshot load's code path,
     reused).
- **Commands** (`MachineStateCommands.ts`):
  - `state-save <file> [-f]`;
  - `state-load <file> [-r | -d] [-y]`, where `-y` accepts the SD-card mismatch;
  - output lines in the style of `zx-snapshot`.

### 4.9 G2.6: viewer and menus

- `.kls` file type: binary, read only, with `documentTabRenderer` and Run/Debug `TabButton`s
  (copying `SpectrumSnapshotLaunchMenu`).
- `MachineStateViewerPanel` shows:
  - the thumbnail;
  - machine and model, Klive version, saved-at;
  - **Loadable here**: the fingerprint matches, falls back to `.szx`, or is refused, with the
    reason;
  - the CPU registers from `META`;
  - the media list with "detached" and fingerprint status.
  
  No core is instantiated to show it.
- Menus: **Save State...** and **Load State...** on every machine menu (a new `stateMenuRenderer`
  composed in `machine-menu-registry.ts`), and in the File menu. Load is enabled on any machine.
  Drag and drop of `.kls` onto the emulator is added to the routing function from the loading plan's
  §4.10.

---

## 5. Phases

### Phase 1 — G2.4 writers (pure, nothing user-visible) ✅
- `compressZ80DataBlock`, `snaWriter.ts`, `z80Writer.ts`, `szxWriter.ts`, and
  `writeSpectrumSnapshot.ts` with losses and refusals.
- Check every written field against the spec (header note). Correct this plan where it differs.
- Tests in `test/spectrum/snapshot/spectrum-snapshot-write.test.ts`:
  - **compression**: a compress → decompress round trip over random and adversarial data (`ED`
    runs, `ED xx`, runs of exactly 4 and 5, 255+ runs, the end marker);
  - **round trip**: per format and per machine kind, model → bytes → `parseSpectrumSnapshot` →
    an equal model, minus the declared losses (each loss is asserted, not just tolerated);
  - **byte equality** with `builders.ts` output for the same state (D14);
  - **refusals**: traps 1, 3 and 4;
  - **sizes**: 49,179 / 131,103 / 147,487 for `.sna`;
  - **the `.sna` push**: the original model is unchanged (D5).

### Phase 2 — G2.4 capture on the cores ✅
- C: `GetPort7ffd` (sp128, spp3e) and `GetPort1ffd` (spp3e). Rebuild, then update the export lists
  and loader types.
- Check that `ReadPsgRegisterValue` has no side effects; add a pure read if it has.
- `spectrumSnapshotCapture.ts` and `captureSnapshotState()` on the three machines, with the D4 guards.
- Harness: `test/harness/sp48` and `sp128` sessions gain `saveSnapshot(format)`.
- Tests, in the `e2e-cores` tier:
  - **capture → restore identity**: run a program (IM 2 handler, a screen loop, AY writes, paging
    and a `$7FFD` lock), capture, restore into a fresh core, then run N frames on both. RAM, the
    registers and the screen must be equal. Do this for each machine and for `.szx`, and for `.z80`
    and `.sna` where their losses allow;
  - **frame position**: a capture at tact T restores at T, and the next interrupt arrives on time
    (trap 7);
  - **HALT and EI**: halted capture; capture right after `EI` (`.szx` keeps it, while `.z80` reports
    the loss);
  - **guards**: Stopped, mid-prefix;
  - **mutation checks**: the capture reading `$7FFD` from the decoded parts, `frameTact` from
    `GetTacts`, or IFF2 copied from IFF1 must each fail a test.

### Phase 3 — G2.4 user surface ✅ (except the manual interop check)
- `displaySaveFileDialog`, `EmuApi.saveSpectrumSnapshot` and its handler, `spectrumSnapshotSave.ts`.
- `SpectrumSnapshotSaveCommand` and its registration.
- The two menu items, and the losses message box.
- Command tests (copying `SpectrumSnapshotCommand.test.ts`):
  - format by extension in any case;
  - `-f` and the existing file;
  - the guards' messages;
  - loss lines;
  - the tokenizer round trip of the command text.
- A flow test on a real `MachineController`: save while Running resumes; while Paused it stays
  Paused.
- **Interop check (manual, D16):** a 48K, a 128K and a +3 snapshot written in each format open in
  Fuse and ZEsarUX. The results are recorded in this plan.
- **Standing rule:** in `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`, update the §2 snapshot row (saving
  done) and narrow §4 W5 to RZX. Mark G2.4 done in `CLOSING_THE_GAPS_PLAN.md`.
- Docs: a "Saving snapshots" section in `docs/content/howto/spectrum-snapshots.mdx`, covering which
  format to pick, the loss table and the `.sna` stack note. Add `zx-snapshot-save` to
  `commands-reference.mdx`.

> **G2.4 can ship here**, independently of G2.6.

### 5.1 How G2.4 was built (2026-10-04)

What landed:
- **Writers:** `src/common/spectrum/snapshot/{snaWriter,z80Writer,szxWriter,snapshotLosses,snapshotBytes,writeSpectrumSnapshot}.ts`.
- **Capture:** `src/emu/machines/zxSpectrum/spectrumSnapshotCapture.ts`, plus `captureSnapshotState()` on the
  three machines.
- **Core exports:** `sp128GetPort7ffd`, `spp3eGetPort7ffd` and `spp3eGetPort1ffd`. These are the last
  values written, while paging was unlocked.
- **Save flow:** `src/renderer/appEmu/machines/spectrumSnapshotSave.ts` and `EmuApi.saveSpectrumSnapshot`.
- **Command and menus:** the `zx-snapshot-save` command (`SpectrumSnapshotSaveCommand.ts`), the two menu
  items, and `MainApi.getAppVersion` for the `.szx` creator.
- **Tests:**
  - `test/spectrum/snapshot/spectrum-snapshot-write.test.ts` (unit);
  - `spectrum-snapshot-save.test.ts` (e2e-cores);
  - the save part of `spectrum-snapshot-flow.test.ts`;
  - `test/commands/SpectrumSnapshotSaveCommand.test.ts`.

Where the code differs from the plan, and why:
- **`compressZ80DataBlock` already existed** (the loading work added it for the test builders). Phase 1
  added round-trip tests for it instead of writing it.
- **Refusals throw `SnapshotRefusedError`.** There is no `refused` field in the result, so a caller
  cannot overlook one.
- **MEMPTR is not reported as a loss** of `.z80`/`.sna`, a deliberate exception to D3.
  - It only shows in two undocumented flag bits after `BIT n,(HL)`, and listing it would put a
    warning on every `.z80`/`.sna` save.
  - The docs say so.
  - The core tests compare MEMPTR only for `.szx`.
- **"Interrupts suppressed" means an EI backlog ≥ 2.**
  - At the instruction boundary after `EI` the core's backlog is 2.
  - After the next instruction it is 1, and that no longer blocks an interrupt.
  - The restore writes 2.
- **Prefixed instructions.** The core runs a prefix byte (`CB`/`DD`/`ED`/`FD`) as its own cycle, and a
  single step (the harness's, and potentially a pause) can stop between the prefix and its opcode.
  - Capture refuses that state with "step once more".
  - When the save flow did the pausing itself, it lets the machine run on and retries, up to five
    times.
- **The +2E/+3E drive count comes from the core** (`GetFdcEnabledDriveCount`), not from the model id.
  - A +2E is written as a `.szx` +3e (id 6) **without a +3 block**.
  - The mapping now prefers `nofdd` for a `.szx` +3e that has no +3 block, so Klive's own +2E file
    reloads as a +2E.
  - The loading flow test now gives its +3e fixture a +3 block.
- **No embedded tape in practice (D17).** The writer embeds a tape that has no file, but the capture
  never produces one: the deck always plays a file, and capture records the tape only while one is
  loaded.
- **There is no file-exists API.** Without `-f`, the command probes for an existing file with
  `readBinaryFile`. The menu passes `-f`, because the OS save dialog has already confirmed any
  overwrite.
- **Muted loss notices** are kept in `appSettings.snapshotLossNoticesMuted`, one entry per format.

### Phase 4 — G2.6 fingerprint ✅
- Symbol-map extraction and `layout.json` in all six build scripts, and the loader constants.
- `scripts/check-wasm-layout.cjs`, wired into the build check.
- **Spike first:** confirm that the linker map has data symbols *and* the table elements
  (trap 15). If it does not, decide between objdump and the whole-`.wasm` hash, and record the
  choice here.
- Tests:
  - the fingerprint is stable across two clean builds;
  - it changes when a static is added (a scratch build with a `-D` define that adds a dummy
    static);
  - it is unchanged by a pure code edit (same define trick, inside a function body).

### Phase 5 — G2.6 state image on every core ✅
- `wasmStateImage.ts`.
- Per core: `volatileRanges()`, `captureHostState()`/`restoreHostState()`, `saveMachineState()`
  and `loadMachineState()`. The volatile ranges and the TS-mirror fields are listed per core *in
  this plan* as they are found (traps 10 and 16).
- Refactor the Next checkpoint onto it. `wasm-next-checkpoint*.test.ts` and PAR-006 must pass
  unchanged.
- Measure the compressed sizes and the save and load times per core, and record them here (trap 19).

### Phase 6 — G2.6 determinism proof ✅
- One parametrised test per core, in the `e2e-cores` tier, through the harness sessions
  (`saveState()`/`loadState()` added to the sp48, sp128, z88, zx81 and zxnext sessions):
  1. Boot and run a busy workload: a game-like loop with sound, interrupts and paging. On the Next,
     also Copper, DMA and sprites; on the +3, a disk read in progress; on the 48K, tape loading in
     progress; on the Z88, the RTC.
  2. Save a state at an odd tact, mid-frame.
  3. Run N frames, and record the memory hash, the screen and the audio samples (A).
  4. Load the state into a **fresh** machine, and **poison every volatile byte first** (trap 10).
  5. Run N frames (B).
  6. A == B, byte for byte.
- This test is the reusable proof the Wave 4 spike needs, so it is documented in each harness
  README.

### Phase 7 — G2.6 container, orchestration, media ✅
- `kliveStateFile.ts` (pure, with node tests): round trip, unknown sections, truncation, a bad magic
  or version.
- `machineStateSave.ts` and `machineStateLoad.ts`, the `EmuApi` entries, and
  `MainApi.fingerprintMediaFile`.
- `restoreState` with `keepCoreMedia` (trap 12), media detaching (D11 and trap 13), and the SD
  fingerprint (D12).
- Flow tests:
  - machine fitting from every machine to every other;
  - a fingerprint mismatch takes the `.szx` fallback on a Spectrum, and is refused on the Next;
  - a restored +3 disk does **not** write back to its host file;
  - a changed SD card needs `-y`;
  - a state loaded over a running machine stops it first;
  - debug mode stops at PC with zero instructions executed.

### Phase 8 — G2.6 user surface ✅
- `MachineStateCommands.ts`, the state menus (every machine, and File), the `.kls` viewer with its
  tab-bar Run/Debug, and drag and drop.
- **Quick save/restore (D19):** one in-memory slot per machine, holding the same parts as a state
  file (image, host state, media list) without the container. **Quick Save** and **Quick Restore**
  items are added to every machine menu, each with a shortcut that clashes with no existing
  emulator or IDE key. Restore goes through the Phase 7 load path (`keepCoreMedia`, disk detaching)
  and leaves the machine Paused. Restore is disabled while the slot is empty. A machine rebuild
  empties the slot.
- Command tests and viewer jsdom tests (copying the snapshot viewer's). Quick-slot flow tests:
  - save, run, restore, run: the result equals a straight run;
  - a machine switch empties the slot;
  - restore on an empty slot is disabled;
  - a quick restore does not write back to a +3 disk file.
- **Standing rule:**
  - add a "Save/restore full machine state (all machines)" row to
    `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2, or update the existing one if there is a matching
    row, and update §4;
  - mark G2.6 done, and note in the roadmap's cross-cutting paragraph that the capture half of the
    Wave 4 spike is done.
- Docs: `docs/content/howto/machine-state.mdx` (what a state is, the version rule with the
  fingerprint and the `.szx` fallback, media detaching, the SD card), plus the
  `commands-reference.mdx` entries and the route in `.plans/docs-routes.golden.txt`.

### Phase 9 — verification ✅
- In the running app, on the `scripts/doc-shots` harness (isolated HOME; read
  `.ai/doc-screenshots-guide.md` first):
  - save and load a snapshot in each format from the menus;
  - save a state on each machine, switch to another machine, then load it, and it continues;
  - the EMU status bar and pause overlay agree on PC;
  - audio after the load;
  - a Next state with NextZXOS booted and a `.nex` running;
  - drag and drop of a `.kls`.
- Then run `npm test` with the e2e tiers, `npm run build:check`, `npm run lint:renderer`,
  `npx electron-vite build --config build/electron.vite.config.ts`, and
  `npm run doc:build && npm run doc:check`.
- Any viewer styling updates `.ai/ui-theming-intent-and-lessons.md` (house rule). No new colours are
  expected.

---

### 5.2 How G2.6 was built (2026-10-04)

What landed:
- **Fingerprint:** `scripts/wasm-layout.cjs`, called by all six `scripts/build-*-wasm.cjs`, and the
  runtime reader `src/emu/machines/state/wasmLayout.ts`.
- **Image:** `src/emu/machines/state/wasmStateImage.ts`, plus `saveMachineState()` /
  `loadMachineState()` on all six WASM machines.
- **Container:** `src/common/machineState/kliveStateFile.ts` and `machineStateTypes.ts`.
- **Save and load flow, quick slot:** `src/renderer/appEmu/machines/machineStateFile.ts`.
- **Commands:** `state-save` and `state-load` (`MachineStateCommands.ts`).
- **Menus:** `src/main/machine-menus/state-menus.ts`, the File menu items and
  `MainApi.getSdCardFingerprint`.
- **Viewer:** the `.kls` viewer (`DocumentPanels/MachineState/`) with its tab bar and Explorer menu
  (`MachineStateLaunchMenu.tsx`), and drag and drop.
- **Docs:** `docs/content/howto/machine-state.mdx`.
- **Tests:**
  - in `test/wasm/state/`: `wasm-layout`, `machine-state-determinism` and `machine-state-flow`;
  - `test/machineState/klive-state-file.test.ts`;
  - `test/commands/MachineStateCommands.test.ts`;
  - `test/renderer/MachineStateViewerPanel.test.tsx`.

Measured (Phase 5, trap 19), with deflate level 6, on a harness machine soon after boot. Real
states are larger; the in-app check saved a 128K at its menu as 236 KiB and a booting Next as
208 KiB, thumbnail and `.szx` part included:

| Core | Linear memory | `.kls` image | Save | Load |
| --- | --- | --- | --- | --- |
| 48K | 8 MiB | ~107 KiB | ~60 ms | ~20 ms |
| 128K | 8 MiB | ~134 KiB | ~55 ms | ~15 ms |
| +3E | 8 MiB | ~152 KiB | ~50 ms | ~10 ms |
| ZX81 | 2 MiB | ~12 KiB | ~8 ms | ~10 ms |
| Z88 | 8 MiB | ~10 KiB | ~30 ms | ~15 ms |
| Next | 32 MiB | ~107 KiB | ~130 ms | ~40 ms |

Where the code differs from the plan, and why:
- **The fingerprint lives inside the `.wasm`, not in a committed `layout.json`.**
  - The cores' `dist/` is gitignored and built in CI, so a committed file and a "stale layout" CI
    check had nothing to compare against.
  - Each build links with `--Map`, computes the fingerprint and appends it as a `klive.layout`
    custom section. The loaders already keep the compiled `module`, so
    `WebAssembly.Module.customSections` reads it with no loader change and nothing extra to
    package.
  - No second link is needed.
- **Table entries are turned into function names through the map,** in the function-index order the
  map's CODE section lists. The cores strip the `name` section, so the names can only come from
  there.
- **The volatile statics are listed by name in each build script** and resolved to addresses at
  build time. That made new "pointer" exports unnecessary, and a renamed static fails the build.
  - On every core: the breakpoint-condition evaluator (`cond*`) and the access log.
  - On the Z88 and the ZX80/81: the exec-breakpoint flags.
  - On the Next: the NextReg watch and hit state and the trace ring.
  - These are IDE debugging state, so a restore never brings back old breakpoints. A test proves a
    breakpoint set after the save still fires.
- **The Next checkpoint was not refactored onto the new helper.** It already worked and has its own
  tests; changing which statics it restores (it restores the breakpoint state too) was not needed for
  G2.6.
- **The state's media come from the image; the media store is left alone.**
  - `restoreState` gained `{ attachMedia: false }`, so the stored media are not uploaded over the
    image (trap 12).
  - The plan's D11 said the media store would get the state's file names. Rewriting the project's
    tape or disk entries behind the user's back was judged worse, so the load reports the state's
    media in the output instead.
  - Disks are detached by dropping the wrapper's disk payloads, so no sector the rewound machine
    writes is merged into a host `.dsk`. The core's dirty journals are cleared.
- **The SD card fingerprint** hashes the image's size and its first 8 MB (boot sector, FATs, root
  directory). It ignores the modification time, so a copied card still matches.
- **The viewer cannot say "Loadable here"**, because the IDE has no core to compare fingerprints
  with. It shows which Klive version saved the state and whether a portable `.szx` part is there;
  the load gives the exact verdict.
- **Load State... and dropping a `.kls` debug-stop at the saved PC**, while the snapshot menus run
  (D14 of the loading plan). A state is a debugging bookmark.
- **Quick slot (D19):**
  - The shortcuts are **Ctrl/Cmd+Alt+S** and **Ctrl/Cmd+Alt+L**. F5 and F4 are machine control,
    F6, F8 and F9 are Next hotkeys, and Monaco binds Alt+F1…F5.
  - Each machine instance has its own slot (a `WeakMap`), so a rebuilt machine has none.
  - `emulatorState.quickStateAvailable` enables Quick Restore. It is cleared by a machine or model
    change.
- **A Spectrum state's `.szx` part is skipped, with a warning,** when the CPU stands inside a
  prefixed instruction. The memory image itself captures that state exactly.

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| G2.4 writers | 1 | S–M (`.szx` is the largest; compression is the fiddliest) |
| G2.4 capture and two exports | 2 | S |
| G2.4 UI, command, dialog | 3 | S |
| **G2.4 total** | 1–3 | **M**, as the roadmap estimated |
| G2.6 fingerprint | 4 | S–M (risk: what the linker exposes) |
| G2.6 image on six cores | 5 | M (mostly finding volatile ranges and mirror fields) |
| G2.6 determinism proof | 6 | M (workloads per core; this is where hidden state is found) |
| G2.6 container, media, UI | 7–8 | M |
| G2.6 quick save/restore slot (D19) | 8 | S |
| **G2.6 total** | 4–8 | **M–L**: "L" only if Phase 6 finds state outside linear memory that needs real serialisers |

The memory-image design (D6) is what keeps G2.6 below the roadmap's "every core needs a complete,
versioned serialiser". The price is D7: states do not survive a core-layout change, except for the
Spectrum, through `.szx`.

## 7. Risks

- **Hidden state outside linear memory.** Examples are WASM globals other than the stack pointer, a
  TS-side device such as a leftover TS tape player, or host-side timers. The Phase 6 test is
  designed to find these: any such state shows up as A ≠ B. The fix is per case: move it into C, or
  into `captureHostState`.
- **Fingerprint churn.** If ordinary C work moves statics often, every release invalidates old
  Next, Z88 and ZX81 states. That is acceptable for states (they are bookmarks, not archives) and
  is said plainly in the docs. If it becomes a real complaint, the next step is a `.z88` writer
  and a Next-specific portable section, which are separate items.
- **Snapshot interop.** Other emulators' readers are lenient in different ways. The manual Phase 3
  check is the defence, and the losses list is honest about the rest.
- **A state file is about 1–3 MB for the Next** (estimated; measured in Phase 5). That is fine as a
  file, but too big for a future "save every N frames" rewind buffer. G4.4 will need incremental
  (dirty-page) capture on top of this, which this plan does not attempt.

## 8. How this feeds the rest of the roadmap

- **G4.4 / G4.3 reverse debugging**: Phase 5's `wasmStateImage` is the "cheap state capture" of the
  Wave 4 spike, and Phase 6's identity test is its determinism proof. What is missing is
  incremental capture and periodic keyframes.
- **G2.7 / G2.8 RZX**: RZX embeds a snapshot (usually `.szx`), which is Phase 1's writer, and needs
  deterministic replay, which Phase 6 proves for the Spectrum cores. What is missing is the per-frame
  IN-value log.
- **G6.1 CLI / CI**: `state-load` gives scripted tests a fast, exact start point, faster than
  booting and injecting.

---

## 9. Questions answered (2026-10-04)

The project author accepted every proposed answer; they are recorded as D15–D22 in §1.2.

| # | Question | Proposed answer |
| --- | --- | --- |
| Q1 | The state file extension and the command names (§1.3): `.kls`, `state-save` / `state-load`, `zx-snapshot-save`? | As proposed. |
| Q2 | May an installed Fuse (and ZEsarUX) be used as an oracle for **reading** Klive-written `.sna`/`.z80`/`.szx` files, under the loading plan's D15 conditions (local only, observed results only, never CI)? | Yes, for Phase 3's interop check. |
| Q3 | Should `.szx` *embed* the inserted tape (the `TAPE` chunk supports it) so a snapshot is self-contained, or only reference it by name? | Reference by default; embed when the tape has no file on disk (a SAVEd tape). |
| Q4 | The Next SD card: reference with a fingerprint and warning (D12), or also offer "save a copy of the card beside the state"? | Reference only now. A copy-beside option later, if asked for. |
| Q5 | Add in-memory **quick save/restore slots** (for example F5/F9, a few slots, not written to disk) in this plan, as a Phase 8 extra? It is about S on top of Phase 5. | Yes, one slot per machine, as a menu item and a shortcut. |
| Q6 | Z88 RTC on state load: restore as saved (exact continuation), or advance to now like the `.z88` loader? | As saved. |
| Q7 | Is it acceptable that Next, Z88 and ZX80/81 states stop loading after a Klive update that changes the core's memory layout (D7, D9), with a clear message? | Yes. States are bookmarks; the docs say so. |
| Q8 | G2.4 and G2.6 as two separate PRs (Phases 1–3, then 4–9)? | Yes. G2.4 is independent and closes the W5 gap on its own. |
