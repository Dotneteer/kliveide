# Klive IDE survey for an Interface 1 + Microdrive plan

Read-only survey of the codebase (2026-10-24). Line numbers are approximate and drift; search
for the symbol names.

## 0. Main findings

- **No Interface 1 or Microdrive emulation exists.** The only traces are snapshot parsing (it detects
  IF1 and warns that it is ignored), names of skipped `.szx` blocks, and TZX hardware-type enums (§9).
- **Closest template for a shadow-ROM add-on: the DivMMC "classic" device.**
  - `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-divmmc-classic.c`: one C file included by
    **all three** Spectrum cores (48K, 128K, +3) under a macro prefix.
  - Switched on at runtime by a `<prefix>DivMmcSetPresent` export; the user's 8K ROM is uploaded
    into a core static; pages through `Z80_BEFORE_OPCODE_FETCH` / `Z80_AFTER_OPCODE_FETCH`; decodes
    its ports only while present.
  - TypeScript side: one bridge class, `DivMmcSupport`. Config: machine-config flag `MC_DIVMMC`,
    toggled from Machine › SD Card.
- **Template for media: Beta 128.** Images live in WASM memory, a dirty-sector revision reports
  writes, the main process writes back to file, media ids `MEDIA_DISK_A/B`, a media strip card per
  drive. For a "cartridge" medium the Timex DOCK is also an analogue.
- **Port clash:** DivMMC decodes `$E7` (SD card chip select). IF1's `$E7`/`$EF`/`$F7` are partially
  decoded on real hardware. Treat IF1 and DivMMC as mutually exclusive, or settle decoding first.
- **The 48K host exposes no memory partitions at all**, even with DivMMC mapped. An IF1 ROM
  partition on the 48K would be the first one.

## 1. Spectrum models, machine IDs, factories, hosts and C cores

IDs: `src/common/machines/constants.ts`. Registry: `src/common/machines/machine-registry.ts`.
Factories registered in `src/common/machines/machine-renderer-registry.ts`.

| Machine id | Models (modelId) | Factory / host / machine class | C core |
|---|---|---|---|
| `sp48` | `pal`, `ntsc`, `pal-16k` | `zxSpectrum48/ZxSpectrum48MachineFactory.ts`, `ZxSpectrum48WasmHost.ts`, `ZxSpectrum48WasmV2Machine.ts` | `zxSpectrum48/wasm/sp48/sp48.c` (+ `sp48-memory.c`) |
| `sp128` | `sp128`, `pentagon` (`zxSpectrum128/sp128Timings.ts`; Pentagon has `MC_DISK_SUPPORT: 2`) | `ZxSpectrum128MachineFactory.ts`, `ZxSpectrum128WasmHost.ts`, `ZxSpectrum128WasmV2Machine.ts` | `zxSpectrum128/wasm/sp128/sp128.c` |
| `scorpion` | `zs256` | `ScorpionMachineFactory.ts`, `ScorpionWasmV2Machine.ts` (extends 128K) | **shares `sp128.c`** |
| `spp3e` | `nofdd` (+2E), `fdd1`, `fdd2` (+3E), `plus2a`, `plus2a-es`, `plus3-*` (`zxSpectrumP3e/p3RomSets.ts`) | `ZxSpectrumP3eMachineFactory.ts`, `ZxSpectrumP3eWasmHost.ts`, `ZxSpectrumP3eWasmV2Machine.ts` | `zxSpectrumP3e/wasm/spp3e/spp3e.c` |
| `timex` | `tc2048`, `tc2068`, `ts2068` | `timex/TimexMachineFactory.ts`, `TimexWasmV2Machine.ts` | `timex/wasm/timex/timex.c` **includes `sp48.c`** with `SP48_SCLD` (DivMMC stubbed out there) |
| `zxnext` | `standard` | `zxNext/*` | own core |

- **No separate +2 model**: the 128K covers it (snapshot "plus2" maps to 128K).
- Shared C devices: `src/emu/machines/zxSpectrum/wasm/common/` (ula, keyboard, beeper, psg, ports,
  tape, frame, rzx, divmmc-classic, sd, scld, beta128 [128K only]). Shared Z80: `src/emu/z80/wasm/z80.c`.
- Build scripts: `scripts/build-sp48-wasm.cjs`, `build-sp128-wasm.cjs`, `build-spp3e-wasm.cjs`,
  `build-timex-wasm.cjs`. Fixed memory sizes: sp48 14 MB, sp128 21 MB, spp3e 20 MB.
- `scripts/check-wasm-cpu-contract.cjs` pins which common files each core includes.

## 2. How shadow-ROM interfaces work today

**M1 hooks (shared Z80, `z80.c`)**: defaults for `Z80_BEFORE_OPCODE_FETCH`, `Z80_AFTER_OPCODE_FETCH`
(may overwrite `cpu.opCode`) and `Z80_AFTER_RETN`. Called in `z80ExecuteCpuCycle`: BEFORE only for an
unprefixed M1 before `readOpcodeMemory`, then AFTER; RETN hook in RETN. The profiler's fetch hook runs
after BEFORE, so an instruction is credited to the ROM paged in for it. IF1 page-in at `$0008`/`$1708`
and page-out at `$0700` map onto these hooks (AFTER for a delayed page-out).

**Beta 128 (TR-DOS) on `sp128.c`**
- Separate `sp128TrdosRom[0x4000]`; includes `zx-spectrum-beta128.c` with `BETA128_NOW` /
  `BETA128_TACTS_PER_MS`.
- `Z80_BEFORE_OPCODE_FETCH` → `sp128BetaBeforeFetch(pc)`: page in on `$3Dxx` with ROM 1, page out at
  `pc >= $4000`; then `rebuildMemorySlotMap()` (slot-0 source priority: DivMMC view > Scorpion
  RAM/service ROM > TR-DOS > ROM 0/1) and `rebuildFlatRomSlot()` (16K copy into flat memory).
- Armed only when `beta128Enabled` (set by `sp128HardReset(timing, beta128)`).
- `sp128UploadRomByte`: `rom==2` → TR-DOS ROM, `rom==3` → Scorpion service ROM (not part of 128K checksum).
- Exports `sp128Beta*`, listed in `scripts/build-sp128-wasm.cjs`, typed in `Sp128WasmV2Loader.ts`.
- Debugger partition: `sp128GetCurrentPartition` returns `-3` ("R2") while paged; history context
  byte 3 holds the paged flag; profile layout gives TR-DOS its own physical range
  (`src/common/profile/layouts/sp128.ts`, `src/common/history/contexts/sp128Context.ts`).

**DivMMC (classic) on 48K/128K/+3**
- Header comment of `zx-spectrum-divmmc-classic.c` lists includer macros: `ZXDC_PREFIX`,
  `ZXDC_ROM3_PRESENT()`, `ZXDC_TACTS`, `ZXDC_REMAPPED()`.
- State: `zxdcMemory` (8K ROM + 128K RAM), `zxdcPresent`, `zxdcMapped`, `zxdcView[16K]`; port decode
  `zxdcIsPort` (0 unless present); exports `<prefix>DivMmc*`. `ZXDC_HOST_WAITING()` stops the frame
  while an SD sector is pending.
- 48K wiring (`sp48.c`): ROM kept in `sp48RomShadow`; `sp48DivMmcRemapped` copies 16K into flat
  `sp48Memory[0..$3FFF]`; ports via `SP48_PORT_READ_NON_FE` / `WRITE_NON_FE` → `zx-spectrum-ports.c`;
  ROM upload in `sp48-memory.c` (also writes the shadow).
- 128K wiring: `ZXDC_ROM3_PRESENT` = `(selectedRom==1 && !beta128Paged)`; ports first in
  `sp128ReadNonFePort` / `WriteNonFePort`, Beta ports gated by `beta128Paged`.
- +3 wiring: include, hook and ports in `spp3e.c`.
- TS bridge `src/emu/machines/zxSpectrum/divmmc/divMmcCoreBridge.ts`: prefixed export list,
  `divMmcPartitionLabels()` (`DR` = -16, `D0..DF` = -32..-47), `DivMmcSupport.connect`,
  `pagePartitions`, `partitionMemory`, frame commands for SD I/O. Build-side export list:
  `scripts/divmmc-classic-exports.cjs`.

**How the extra ROM reaches the core**: `ZxSpectrum128WasmV2Machine.setup()` loads machine ROMs, then
`loadTrdosRomForBeta128` (checks 16384 bytes, sets `trdosRomProblem`) and uploads byte by byte.
`beta128Active` = ROM loaded. DivMMC: `await this.divMmc.connect(ESXDOS_ROM_FILE)` then reset. ROM
files read by `Z80MachineBase.loadRomFromResource` (absolute path = user file, else `roms/<name>[-page].rom`).

**Partitions in the debugger**: `ZxSpectrum128WasmHost.getPartitionLabels` (adds `-3: "R2"` for Beta,
DivMMC labels when attached), descriptions, `parseSpectrumPartitionLabel`.
`ZxSpectrum128WasmV2Machine.getMemoryPartition` / `getCurrentPartitions` (eight 8K entries).
`ZxSpectrum48WasmHost` returns empty partitions; 48K profile `src/common/profile/layouts/sp48.ts` uses
fixed addresses. `MF_ROM` is per machine, so the disassembly ROM picker doesn't list R2. Label tests:
`test/memory/partition-label-round-trip.test.ts`, `test/memory/partition-descriptions.test.ts`.

## 3. Optional attachments / configuration

- Model config (Beta 128): `MC_DISK_SUPPORT` on Pentagon/Scorpion; `ZxSpectrum128WasmHost.beta128Model`.
- User toggle (DivMMC): `MC_DIVMMC = "divMmc"` in `constants.ts`; `src/common/machines/divMmc.ts`
  (`isDivMmcMachine`, `hasDivMmc`); menu `src/main/machine-menus/divmmc-menus.ts` (`divMmcMenuRenderer`
  Connect checkbox + ROM + SD items; `setDivMmcConnected` copies config, sets/deletes `MC_DIVMMC`,
  calls `setMachineType(machineId, modelId, config)` which rebuilds the machine, then
  `saveKliveProject`). Host getters `divMmcModel` on 48K/128K/+3 hosts. SD fingerprint goes into state
  and recording files (`MachineStateCommands.ts`, `DebugRecordingCommands.ts`).
- Menu slots: `src/main/machine-menus/machine-menu-registry.ts` per-machine
  `devices: { tape, disks, sdCard, cartridge, input, program }`; allowed keys `MACHINE_DEVICE_MENUS`
  in `src/common/machines/info-types.ts` (a "microdrives" key + i18n label would be added there).
- Global ROM settings: `src/common/settings/setting-const.ts` (`SETTING_EMU_TRDOS_ROM`,
  `SETTING_EMU_ESXDOS_ROM`), `setting-definitions.ts`, `settings-pages.ts` rows with
  `when: {kind:"beta128"}` / `{kind:"divMmc"}` evaluated by `isSettingsRowApplicable`. Browse/forget:
  `zx-specrum-menus.ts` (`forgetTrdosRom`, `selectTrdosRomFile`, `restartForTrdosRom`), `divmmc-menus.ts`.
- Config → core: `src/renderer/appEmu/MachineService.ts`: `rendererInfo.factory(store, modelInfo,
  config, messenger)`, ROM paths pushed as machine properties (`TRDOS_ROM_FILE`, `ESXDOS_ROM_FILE`;
  keys in `src/emu/machines/machine-props.ts`), then `setup()`, `hardReset()`, `setMachineConfigAction`.
- Hardware sheet: `src/common/machines/hardware-specs.ts` (media rows, e.g. `hardware.media.pentagonBeta`).
- Machine select dialog (`src/renderer/appIde/dialogs/machineSelect/*`) chooses machine/model only, no add-ons.

## 4. Media handling

- Media ids `src/common/structs/project-const.ts`: `MEDIA_TAPE`, `MEDIA_DISK_A`, `MEDIA_DISK_B`,
  `MEDIA_SD_CARD`, `MEDIA_DOCK`. A machine lists its media in registry `mediaIds`.
- Insert/eject:
  1. Menu (main): `zx-specrum-menus.ts` — `diskMenuRenderer` (gated by `MC_DISK_SUPPORT`, Boot Disk
     item for Beta), `setDiskFile` (filter per machine), `setSelectedDiskFile` (dispatch
     `setMediaAction(mediaId, {diskFile, writeProtected})`, read file, `setDiskWriteProtection`,
     `setDiskFile(index, name, bytes)`), `ejectDiskFile`, `setDiskWriteProtection`; tape equivalents
     `tapeMenuRenderer`, `setSelectedTapeFile`; generic `selectMediaFile` / `ejectMediaFile`;
     Timex cartridge `timex-menus.ts` (`setDockFile`).
  2. IPC: `src/common/messaging/EmuApi.ts` (`setDiskFile`, `setDiskWriteProtection`, `startDiskBoot`).
  3. Emulator: `src/renderer/appEmu/MainToEmuProcessor.ts` `setDiskFile` (clears history cursor,
     interrupts RZX, `mediaStore.addMedia`, `machine.setMachineProperty(mediaId, bytes)`),
     `setDiskWriteProtection` (`DISK_A_WP` / `DISK_B_WP` props), `startDiskBoot`.
  4. Machine: `ZxSpectrum128WasmV2Machine.setMachineProperty` → `syncBetaDiskPropertyToWasmV2` →
     `Beta128Disks.insert` / `setWriteProtected` (canonical layout, core buffer, `sp128BetaDiskInsert`).
- Media store: `src/emu/machines/media/media-info.ts` (`MediaInfo {id, mediaFile, mediaContents,
  writeProtected}`); `MachineController.attachStoredMedia` re-attaches on start/restore.
- Write-back: core dirty revision (`sp128BetaGetDirtyRevision`, per-sector bits) → `Beta128Disks.publish()`
  returns `SectorChanges` into `DISK_A_CHANGES` / `DISK_B_CHANGES` props → `MachineController` collects
  and emits on frame completion → `EmulatorPanel.tsx` `saveDiskChanges` → `mainApi.saveDiskChanges` →
  `src/main/RendererToMainProcessor.ts` `saveDiskChanges` (`.trd` at `sector*256`, `.scl` never written,
  `.dsk` per sector/whole). "Unsaved" props `DISK_A_UNSAVED`/`DISK_B_UNSAVED`. After a reverse-debugging
  fork: `republishDisks()` (`reverse/Timeline.ts` interface).
- Media strip: `src/renderer/appEmu/machines/spectrumMedia.ts` `describeSpectrumMedia(media,
  diskDrives, dock)`, rendered by `SpectrumMediaToolArea.tsx`; enabled per machine via
  `MEDIA_INFO_MACHINE_IDS`.
- Session restore / project: `src/main/index.ts` re-inserts media from `appSettings.media`;
  `src/main/projects.ts` saves `state.media`.
- CLI and disk FS: `src/cli/verbs/disk.ts` (`ls/info/add/get/rm/mv/compact/new`); format layer
  `src/common/diskfs/open.ts` (`diskImageKind` / `openDiskFileSystem`: dsk → `Plus3DosFileSystem`,
  trd/scl → `TrdosFileSystem`) — where an `.mdr` file system would plug in. Also `diskExport.ts`,
  `edit.ts`, `importFiles.ts`; IDE command `src/renderer/appIde/commands/DiskCommands.ts`; Disk
  Explorer doc `docs/content/en/guides/emulator/disk-explorer.mdx`.

## 5. State: snapshots, Klive state files, reverse debugging

- Snapshot model `src/common/spectrum/snapshot/spectrumSnapshot.ts`:
  `SpectrumSnapshotPeripherals.interface1?: boolean`, `beta128?`, `trdosPaged`, `plus3`, `tape`.
- `.z80`: `z80File.ts` hardware-mode tables, `machineOf()` (modes 1/4/5 mean IF1), byte 36 = `$FF`
  means IF1 ROM paged (except Timex modes). `z80Writer.ts` writes "Interface 1 ROM not paged".
- `.szx`: `szxFile.ts` — `IF1` and `MDRV` are in `SKIPPED_BLOCK_NAMES` (warning only); `szxWriter.ts`
  writes B128/BDSK.
- Warning: `spectrumSnapshotMapping.ts` pushes `media.snapshot.warning.interface1` ("Interface 1 is not
  emulated; its state is ignored").
- Capture/restore: `src/emu/machines/zxSpectrum/spectrumSnapshotCapture.ts`,
  `spectrumSnapshotRestore.ts`, `spectrumSnapshotFit.ts`; renderer `spectrumSnapshotLoad.ts` /
  `spectrumSnapshotSave.ts`.
- Klive state files: whole linear memory is the state (`src/emu/machines/state/wasmStateImage.ts`;
  fingerprint `wasmLayout.ts`, `scripts/wasm-layout.cjs`). **New C statics are captured automatically**
  and change the fingerprint. Debug/scratch statics go in the core's `*_VOLATILE_SYMBOLS` (in the build
  scripts). Media in states: `src/renderer/appEmu/machines/machineStateFile.ts` (disks detached on
  load, D11); `Beta128Disks` `detached` handling.
- Reverse debugging (`src/emu/z80/wasm/README.md`): anything a debug run writes and a fast frame does
  not must be volatile (trap T9); debug work behind a runtime flag; new core stops proven by
  `test/wasm/debug-loop-equivalence.test.ts`; media changes clear the history cursor;
  `MF_REVERSE_DEBUG` gated on `test/wasm/reverse/journal-replay-determinism.test.ts`; host caches
  re-push via `reverse/IReplayHostSync.ts`; SD writes undone by `reverse/SdUndoLog.ts` (in-core
  microdrive writes roll back with the image; file write-back needs a `republishDisks`-style resync).
- **Tact rebase rule** (`zxSpectrum48/wasm/README.md`): every new absolute tact point (cartridge
  position/start tact) must be shifted in `sp48ShiftTactOrigin` and the 128K/+3 equivalents
  (e.g. `beta128ShiftTactOrigin`). Test: `test/wasm/zxSpectrum/wasm-tact-rebase.test.ts`.

## 6. Timing

- No per-tstate device callback. Z80 advances `cpu.tacts` via `Z80_TACT_PLUS_N` and delay hooks
  `Z80_DELAY_MEMORY_READ/WRITE`, `Z80_DELAY_PORT_READ/WRITE`, `Z80_DELAY_ADDRESS_BUS_ACCESS`,
  `Z80_DELAY_REFRESH_BUS_ACCESS`. Spectrum contention lives there (e.g. `sp48CpuDelayPortAccess`).
- **WAIT precedent:** ZX81 drains WAIT inside its port/memory delay hooks
  (`zx8081/wasm/zx8081/zx8081-ula.c` `zx8081DrainWait`, `zx8081DelayPort`). An IF1 holding WAIT on
  `$E7` until the next byte arrives could add tacts the same way.
- Frame loop `zx-spectrum-frame.c`: `<prefix>ExecuteFrame` loops instructions to the frame end tact;
  hooks `ZXS_STOP()`, `ZXS_ON_PLAY_PICTURE`, `ZXS_AFTER_PLAY_CYCLE`.
- **Lazy devices:** tape EAR bit computed on demand from `sp48Tacts - sp48TapeStartTact` on port `$FE`
  reads (`zx-spectrum-tape.c` `sp48TapeGetEarBitInternal`); Beta 128 WD1793 is lazy too
  (`beta128Advance()` replays elapsed events on each port access; header explains it's allowed because
  INTRQ isn't wired to the CPU). A spinning microdrive loop can be modelled the same way:
  position = `(now - start) / byteTime mod loopLength`, evaluated at `$E7`/`$EF` accesses.
- RZX records INs, so IF1 port reads are covered (`zx-spectrum-rzx.c`). Fast-load trap blocked under
  RZX (`SP48_TAPE_FAST_LOAD_BLOCKED`).

## 7. Tests

- Harnesses: `test/harness/sp48/` (`connectDivMmc(rom, sdCard)`, `insertTape`, snapshots, RZX,
  `runTo`, `typeKeys`, `screenLine`); `test/harness/sp128/` (`createSp128Session`, `insertDisk`,
  `beta128()`). New `connectInterface1` / `insertCartridge` would be session methods (don't reach into
  `session.machine`).
- Beta 128: `test/sp128-hw/beta128/` — `test-rom.ts` (assembled stand-in ROM because the real one
  can't ship), `wd1793.test.ts` (each test cites its data-sheet tag), `snapshots.test.ts`,
  `trdos-fs.test.ts`, `trdos.test.ts` (real ROM only with `KLIVE_TRDOS_ROM=/path`).
- DivMMC: `test/spectrum-hw/divmmc-48k.test.ts`, `test/spectrum-hw/esxdos-e2e.test.ts`,
  `test/sp128-hw/divmmc/divmmc.test.ts` + `divmmc-test-rom.ts`.
- Others: `test/sp128-hw/plus3-disk/*`, `test/spectrum/snapshot/*` (parse tests already assert
  `peripherals.interface1`), `test/timex-hw/2068-snapshots.test.ts`, `test/wasm/state/machine-state-flow.test.ts`.
- Tiers `build/e2e-tests.ts`: `test/sp128-hw/**`, `test/spectrum-hw/**`, `test/wasm/**`,
  `test/harness/**/self-tests/**` already in `E2E_CORE_TESTS`. Files > 20 s go to `E2E_SLOW_TESTS`.
- IDE checks: `scripts/*-ide-check.cjs`, `scripts/doc-shots/` (`.ai/doc-screenshots-guide.md`),
  `.plans/baseline/`. Beta plan noted scripted instances' menus were empty; its IDE check used a
  seeded setting and disk.

## 8. Docs, i18n, roadmap, ROM licensing

- **Roadmap:** neither `.plans/CLOSING_THE_GAPS_PLAN.md` nor `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md`
  mentions Microdrive/Interface 1. Nearest item: G9 "Machine breadth" (G9.5 disk images done); a new
  G-item would be added. Comparison row that changes: "Tape / disk"; gap row W9 "Machine breadth".
  AGENTS.md requires updating §2 and §4 of the competitive analysis in the same change.
- **Docs** (`docs/content/en/`): `guides/emulator/trdos-disks.mdx` (model for a "Microdrives" page,
  incl. the "cannot ship the ROM" callout and Settings › Machine ROM), `disk-explorer.mdx`,
  `snapshots.mdx` (lists Interface 1 as not emulated), `machine-state.mdx`, `custom-rom.mdx`,
  `reference/machine-types.mdx`, `get-started/load-from-tape.mdx`, `guides/ide/settings.mdx`,
  `reference/whats-new.mdx`; book appendix `book/app-C-io-ports-reference.md`.
- **i18n:** existing keys `media.snapshot.warning.interface1`, `media.snapshot.header.if1RomPaged`
  (`src/common/i18n/locales/en/media-common.json`). New keys in `src/common/i18n/locales/en/*.json`,
  then `npm run i18n:keys`.
- **ROM licensing:** shipped ROMs in `src/public/roms/` — **no IF1 ROM**. Readmes beside ROMs;
  `THIRD_PARTY_NOTICES.md` has a section per ROM set (Amstrad text "allow distribution of the ROMs but
  retain the copyright"). "Cannot ship" pattern: setting → machine prop → loader with a problem
  message → menu browse/forget (TR-DOS, esxDOS, TC2048/TC2068/TS2068, Scorpion). Whether the IF1 ROM
  may be shipped needs a decision (like Beta plan Q1), with readme, notice and a CRC test if shipped.

## 9. Existing mentions of microdrive / interface 1 / if1 / mdr

- `src/common/spectrum/snapshot/z80File.ts` (hardware-mode names "48K + Interface 1" / "128K +
  Interface 1", `interface1` flag, byte 36), `z80Writer.ts`, `spectrumSnapshot.ts`,
  `spectrumSnapshotMapping.ts`, `szxFile.ts` (`IF1`, `MDRV` skipped).
- i18n keys above (all locales).
- `src/emu/machines/tape/TzxExternalStorageType.ts` (`ZxMicroDrive = 0x00`), `TzxSerialPortType.ts`,
  `TzxNetworkAdapterType.ts` (`ZxInterface1 = 0x00`).
- `src/renderer/appIde/DocumentPanels/Tape/tapeView.ts` comment about PROG with no microdrive.
- Tests: `test/spectrum/snapshot/spectrum-snapshot-parse.test.ts`, `test/timex-hw/2068-snapshots.test.ts`.
- Docs: `docs/content/en/guides/emulator/snapshots.mdx`; plan `.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md`.
- No `.mdr` handling anywhere. Provenance precedent: Beta plan B6 says no GPL emulator code is copied.

## 10. Places a new device touches

1. **C:** `zxSpectrum/wasm/common/zx-spectrum-if1.c`, prefix-macro'd like divmmc-classic. Wire:
   BEFORE/AFTER opcode fetch (`sp48.c`, `sp128.c`; `spp3e.c` only if supported), port decode in
   `SP48_PORT_*_NON_FE` and `sp128Read/WriteNonFePort`, ROM slot selection (sp48 flat copy +
   `sp48RomShadow`; sp128 `rebuildMemorySlotMap` / `rebuildFlatRomSlot`), reset/hard reset,
   ShiftTactOrigin, `GetCurrentPartition`, history context, profile layout, exports list, volatile
   list, `check-wasm-cpu-contract.cjs`.
2. **TS:** bridge like `divMmcCoreBridge.ts`; loader typings (`Sp48WasmV2Loader.ts`); host
   `getPartitionLabels` / `getMemoryPartition` / `getCurrentPartitions`; machine props for ROM file
   and cartridge media.
3. **Config/UI:** `MC_` flag + `isIf1Machine`/`hasIf1` helper, menu renderer + device key, ROM
   setting + settings-pages row, `MachineService` ROM prop, media strip, startup/project restore,
   write-back in `RendererToMainProcessor`, an `.mdr` diskfs format, CLI.
4. **Snapshots:** z80 byte 36 and modes; `.szx` IF1/MDRV blocks parsed and written; capture/restore.
5. **Tests:** harness methods, a stand-in ROM test if the ROM is not shipped, e2e folders.
6. **Docs, roadmap, changeset.**
