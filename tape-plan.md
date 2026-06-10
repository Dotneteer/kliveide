# ZX Spectrum Tape Migration Plan

This plan migrates ZX Spectrum tape handling from the reference TypeScript emulator to the current C/WebAssembly SP48 core in small, testable steps. The first goal is to make the UI and test infrastructure observable and reliable. The second goal is normal tape loading through the ROM EAR-bit path. The third goal is fast load.

## Reference Findings

The original implementation splits tape handling across these areas:

- `src/main/machine-menus/zx-specrum-menus.ts`
  - Adds `Fast load`, `Rewind Tape`, `Select Tape File...`, and `Eject Tape`.
  - Reads `.tap` and `.tzx` bytes in the main process.
  - Stores selected tape media in app/project state as `MEDIA_TAPE`.
  - Sends `setTapeFile(filename, contents)` to the emulator renderer.
- `src/renderer/appEmu/MainToEmuProcessor.ts`
  - Parses TZX first, then falls back to TAP.
  - Normalizes supported blocks to `TapeDataBlock[]`.
  - Stores parsed media in `mediaStore`.
  - Sets machine property `MEDIA_TAPE` to the parsed blocks.
- `src/emu/machines/tape/TapeDevice.ts`
  - Owns the tape mode state machine: `Passive`, `Load`, `Save`.
  - Detects ROM load at PC `$056C`.
  - Detects ROM save at PC `$04C2`.
  - In normal load mode, returns the current EAR bit based on pilot, sync, data, termination, and pause phases.
  - In fast load mode, directly copies the current block to memory using AF/IX/DE and returns to ROM address `$05E2`, or fails through `$05B6`.
  - Handles rewind via `REWIND_REQUESTED`.
- `src/emu/machines/ZxSpectrumBase.ts`
  - On `$FE` reads, if tape mode is `Load`, bit 6 comes from `tapeDevice.getTapeEarBit()`.
  - On `$FE` writes, MIC changes are passed to the tape device for save detection.
  - Calls `tapeDevice.updateTapeMode()` after every executed instruction.
- `src/emu/machines/MachineController.ts`
  - Applies `SETTING_EMU_FAST_LOAD` to the machine at run start.
  - Reattaches persisted media when the machine starts.

The current workspace already has the C/Wasm SP48 core, machine menu/state wiring, `SETTING_EMU_FAST_LOAD`, and `MF_TAPE_SUPPORT`. It does not yet have tape media state, tape menu commands, `setTapeFile`, parsed tape data, or a C tape device.

## Design Decisions

- Keep TAP/TZX parsing in TypeScript initially. The parser is not time-critical and the existing reference parser already normalizes files to `TapeDataBlock` objects.
- Move time-sensitive tape state into C/Wasm:
  - loaded tape block metadata and bytes
  - rewind/eject state
  - tape mode and playback phase
  - EAR-bit generation
  - fast-load CPU/register/memory manipulation
- Use only static C memory. No `malloc`, no growable buffers.
- Start with TAP and the TZX blocks that already normalize to `TapeDataBlock` in the reference implementation:
  - TAP blocks
  - TZX standard speed block `$10`
  - TZX turbo speed block `$11`
  - Additional TZX block types can follow after the core path is proven.
- Leave tape save as an explicit later phase. The plan below prepares names and status fields for save mode, but normal load and fast load come first.

## Static Wasm Data Shape

Add `src/emu/sp48/sp48-tape.c` and include it from `sp48.c`.

Suggested static limits for the first implementation:

- `SP48_TAPE_MAX_BLOCKS`: 512
- `SP48_TAPE_DATA_CAPACITY`: 4 MiB
- `SP48_TAPE_FILENAME_CAPACITY`: 260 bytes

Each block should store:

- byte offset into the static tape byte buffer
- byte length
- pause after block in milliseconds
- pilot pulse length
- sync 1 pulse length
- sync 2 pulse length
- zero bit pulse length
- one bit pulse length
- end sync pulse length
- last byte used bits
- optional pilot pulse count, with `0` meaning default header/data pilot count

Diagnostic overflow flags should be added if the file exceeds static capacity or block count.

## Step 1 - Media State And Menu Skeleton

Goal: make tape selection/eject/rewind appear and update state without touching Wasm yet.

Implementation:

- Add shared media state to `AppState`, using a small shape compatible with future project persistence:
  - `media.tape.fileName`
  - `media.tape.displayName`
  - `media.tape.size`
  - `media.tape.blockCount`
  - `media.tape.error`
- Add reducer actions:
  - `SET_TAPE_MEDIA`
  - `CLEAR_TAPE_MEDIA`
  - optionally `SET_TAPE_STATUS`
- Add `MEDIA_TAPE` constant in current workspace.
- Add machine menu items when `MF_TAPE_SUPPORT` is true:
  - `Fast load` checkbox using existing `SETTING_EMU_FAST_LOAD`
  - `Rewind Tape`
  - `Select Tape File...`
  - `Eject Tape`
- Make `Eject Tape` enabled only when a tape file is present.
- Add concise status-bar or overlay-visible tape info so UI testing does not depend only on menu state.

Tests:

- Reducer test: selecting/ejecting tape updates immutable state.
- Menu construction test if practical: tape-capable machine includes tape commands; non-tape machine does not.

Manual check:

- Machine menu shows tape commands for ZX Spectrum 48K/16K/NTSC.
- Selecting/ejecting can be stubbed but should visibly update tape state.

## Step 2 - Main-To-EMU API For Tape Files

Goal: wire the same process pattern as the reference project while still not loading into Wasm.

Implementation:

- Extend `EmuApi` with:
  - `setTapeFile(file: string, contents: Uint8Array, confirm?: boolean, suppressError?: boolean)`
- Implement main menu file selection with Electron dialog:
  - filter `.tap`, `.tzx`, and all files
  - remember last tape folder in settings, similar to the reference `tapeFileFolder`
  - main process reads bytes with Node `fs`
  - main process sends bytes to EMU renderer via `getEmuApi().setTapeFile(...)`
- Implement `rewind` command routing through existing `issueMachineCommand`.
- Implement `setTapeFile` in the EMU renderer processor as a stub that validates arguments and updates shared state.

Tests:

- API processor unit test: `setTapeFile("", empty)` clears media state.
- Main/menu helper test for extension/default path can be added if helpers are factored.

Manual check:

- Select a file and see its name/size in the UI.
- Eject clears the name.
- Rewind logs/status-updates without failing.

## Step 3 - Parser Port Into Current Workspace

Goal: parse TAP/TZX in TypeScript and expose a normalized block format for Wasm upload.

Implementation:

- Migrate minimal parser support from the reference:
  - `TapeDataBlock`
  - tape timing constants
  - `TapReader`
  - `TzxHeader`
  - `TzxReader`
  - only block classes needed for initially supported normalized blocks
- Keep unsupported TZX blocks readable only when they can be skipped safely; otherwise report a clear error.
- Add a `parseTapeFile(contents)` helper returning:
  - `blocks`
  - source format (`tap` or `tzx`)
  - warnings for ignored/non-data blocks
  - error text
- Normalize parser output to a plain serializable `Sp48TapeBlock` TypeScript type that mirrors the static C block metadata.

Tests:

- TAP parser test with an in-memory file containing two blocks.
- TZX standard-speed block test.
- TZX turbo-speed block test if migrated in this step.
- Invalid TZX and invalid TAP fallback behavior.

Manual check:

- Selecting a known TAP shows correct block count.
- Selecting an invalid file shows an error and does not poison the current tape state.

## Step 4 - Wasm Tape Upload ABI

Goal: let TypeScript upload parsed tape blocks into static C memory and inspect the loaded tape.

Implementation:

- Add `sp48-tape.c`.
- Add exported functions:
  - `sp48TapeClear()`
  - `sp48TapeSetFileNameByte(index, value)`
  - `sp48TapeBeginUpload(blockCount, totalDataLength)`
  - `sp48TapeSetBlock(index, offset, length, pauseAfter, pilotPulseLength, sync1PulseLength, sync2PulseLength, zeroBitPulseLength, oneBitPulseLength, endSyncPulseLength, lastByteUsedBits, pilotPulseCount)`
  - `sp48TapeWriteData(offset, value)`
  - `sp48TapeFinishUpload()`
  - `sp48TapeRewind()`
  - diagnostics: block count, current block index, mode, phase, EOF flag, data capacity, diagnostic flags
- Add exports to `build/wasm/build-wasm.mjs`.
- Add adapter methods to `WasmZxSpectrum48Machine`.
- Add controller method `setTape(blocks, fileName)`.
- On `hardReset`, keep loaded tape bytes but reset playback position to passive/current block `-1`, matching media attachment semantics.
- On `sp48TapeClear`, eject all blocks and reset mode/phase.

Tests:

- Wasm upload test for a small two-block tape.
- Capacity overflow test returns diagnostic flag and refuses partial load.
- Rewind test resets current block/EOF/phase.
- Hard reset does not erase uploaded tape metadata.

## Step 5 - UI Connected To Real Wasm Tape Upload

Goal: after selecting a tape file, the C core knows about it, but the CPU still does not consume it.

Implementation:

- In EMU `setTapeFile`, parse file then call controller/machine upload.
- Store UI media state only after successful Wasm upload.
- Eject calls `sp48TapeClear`.
- Rewind calls `sp48TapeRewind`.
- Add status text such as `Tape: filename.tap, 2 blocks, block 0/2`.

Tests:

- Controller test: `setTapeFile` parses and uploads blocks.
- Eject test clears Wasm and shared state.
- Rewind test after advancing block index restores block position.

Manual check:

- Select TAP/TZX and see block count/status.
- Rewind changes diagnostics/status.
- Changing machine model should preserve selected tape if media state says a tape is loaded, or explicitly re-upload it to the new controller.

## Step 6 - Normal Load EAR-Bit Playback In C

Goal: emulate the original `TapeDevice.getTapeEarBit()` path accurately enough for ROM `LOAD` to read from the tape.

Implementation:

- Add C tape enums:
  - `TapeModePassive`, `TapeModeLoad`, `TapeModeSave`
  - `PlayPhaseNone`, `Pilot`, `Sync`, `Data`, `TermSync`, `Pause`, `Completed`
- Port normal playback fields:
  - tape start tact
  - pilot/sync end tacts
  - bit start tact
  - bit pulse length
  - data index
  - bit mask
  - termination/pause end tacts
- Port `nextTapeBlock()`.
- Port `getTapeEarBit()`.
- Update `sp48ReadPort()`:
  - if tape mode is load, bit 6 comes from `sp48TapeGetEarBit()`
  - set beeper EAR state from the tape bit so audio and UI diagnostics reflect loading tones
  - otherwise keep existing analog EAR behavior
- Add `sp48TapeSetMode`, `sp48TapeGetMode`, and diagnostics exports.

Tests:

- Unit-level Wasm tests with manual tacts:
  - pilot alternates every `2168` tacts
  - sync pulses return low/high
  - data bit `0` has two `855`-tact pulses
  - data bit `1` has two `1710`-tact pulses
  - after pause, next block is selected
- Port `$FE` test: in load mode, bit 6 follows tape EAR.

Manual check:

- With fast load off, starting a ROM `LOAD ""` should produce audible loading tones and changing EAR diagnostics.

## Step 7 - Tape Mode Detection After Instructions

Goal: let the ROM enter tape mode automatically, exactly like the reference `afterInstructionExecuted()`.

Implementation:

- Add `sp48UpdateTapeMode()` and call it after every executed instruction in:
  - `sp48ExecuteInstruction()`
  - the no-debug frame loop inside `sp48ExecuteFrame()`
- Detect Spectrum 48 ROM load start at PC `$056C`.
- When detected:
  - set mode to load
  - call `nextTapeBlock()`
  - if fast load is disabled, stay in load mode
- In load mode, return to passive when EOF or ROM error PC `$0008`.
- Add `sp48SetFastLoad(uint32_t enabled)` and adapter/controller wiring from `SETTING_EMU_FAST_LOAD`.

Tests:

- Program-counter test: set PC `$056C`, execute/update, mode becomes load and current block increments.
- EOF test: no blocks moves to passive/EOF.
- Error PC `$0008` returns to passive.

Manual check:

- Toggle fast load off, type `LOAD ""`, see tape mode change to Load and hear normal loading.

## Step 8 - Normal ROM Load Smoke Test

Goal: prove a small TAP can be loaded through the real ROM code and normal EAR playback.

Implementation:

- Create a tiny in-memory TAP fixture with one BASIC header and one short data block.
- Use ROM boot helper or direct ROM load entry conditions.
- Prefer a smoke test that runs frames until either:
  - memory receives expected bytes, or
  - timeout frame count is reached
- Keep this test guarded/targeted if runtime becomes long.

Tests:

- `fastLoad=false`: ROM load eventually writes expected bytes and advances tape block.
- Assert tape mode returns passive after completion or pause.

Manual check:

- User can disable fast load and load a small TAP from the UI.

## Step 9 - Fast Load In C

Goal: port the reference `TapeDevice.fastLoad()` behavior exactly.

Implementation:

- Port constants:
  - load routine `$056C`
  - invalid header routine `$05B6`
  - resume routine `$05E2`
- Port register behavior:
  - move `AF'` to `AF`
  - detect verify with `(AF & 0xff01) === 0xff00`
  - expected block type is `A` (`0x00` header, `0xff` data)
  - `IX` is target address
  - `DE` is byte count
  - checksum accumulates in `H`
  - success sets carry
  - header/checksum/verify errors clear flags and branch to `$05B6`
  - success branches to `$05E2`
- Ensure fast load uses C memory write semantics, including ROM write protection.
- Set play phase to pause and set pause end to zero, as the reference does.

Tests:

- Header block fast load copies 17 bytes to IX and sets carry.
- Data block fast load copies payload and sets carry.
- Wrong expected block type branches to `$05B6`.
- Checksum mismatch clears carry.
- Verify mismatch branches to `$05B6`.
- Current block advances consistently with the reference.

Manual check:

- With fast load on, `LOAD ""` loads a small TAP almost instantly.
- UI should show block advancement and no long loading tone.

## Step 10 - Main Loop And Settings Integration

Goal: make fast-load setting and media attachment behave like the reference during lifecycle transitions.

Implementation:

- Watch `SETTING_EMU_FAST_LOAD` in the emulator panel or controller and call `machine.setFastLoad(...)`.
- On controller creation/model change, re-upload current selected tape from renderer-held parsed block data or ask main to resend it.
- On stop/restart/hard reset, do not lose selected tape; reset playback position only.
- On changing machine type, stop current machine, create the new controller, then reattach tape if the new machine has `MF_TAPE_SUPPORT`.

Tests:

- Fast-load setting change reaches Wasm without recreating the machine.
- Restart resets CPU and rewinds or preserves tape position according to the chosen reference behavior. The reference hard reset resets tape mode and rewind-request property, while media remains attached.
- Machine model change reattaches loaded tape.

Manual check:

- Select tape, switch 48K to 16K, tape status remains visible and usable.
- Toggle fast load while stopped/running; next load uses the new setting.

## Step 11 - UI Diagnostics And Polish

Goal: give the user obvious proof that tape handling works.

Implementation:

- Add status-bar fields or a compact tape panel:
  - tape file name
  - block count
  - current block
  - mode (`Passive`, `Load`, later `Save`)
  - phase (`Pilot`, `Sync`, `Data`, `Pause`)
  - fast load on/off
- Enable/disable menu commands:
  - Rewind enabled only when tape loaded
  - Eject enabled only when tape loaded
  - Select tape enabled for tape-capable machines
- Consider toolbar icon later; keep the first pass menu/status driven.

Tests:

- State-to-status formatting tests if implemented as pure helper.

Manual check:

- During normal load, status visibly moves through load phases.
- During fast load, status advances blocks quickly.

## Step 12 - Save Support Preparation

Goal: keep save behavior out of the critical load path but avoid designing against it.

Implementation later:

- Port MIC pulse classification from the reference:
  - pulse tolerance `24`
  - pilot minimum `3000`
  - too-long pause threshold `3_500_000`
- Capture saved bytes into a static buffer.
- Surface `SAVED_TO_TAPE` equivalent through an event/API.
- Let TypeScript write the resulting TZX file through main process APIs.

Tests later:

- SAVE pulse classifier unit tests.
- Generated TZX standard-speed block roundtrip.

## Recommended Implementation Order

1. Media state and tape menu skeleton.
2. `EmuApi.setTapeFile` and stubbed UI status.
3. TAP/TZX parser migration and tests.
4. Wasm static tape upload ABI and tests.
5. Connect UI selection/eject/rewind to real Wasm upload.
6. Normal EAR playback and `$FE` integration tests.
7. Per-instruction tape mode detection.
8. Normal-load ROM smoke test.
9. Fast-load C implementation and tests.
10. Lifecycle/settings/model-change hardening.
11. UI diagnostics polish.
12. Tape save support.

## Verification Commands

Use these after implementation slices:

```sh
npm run build:wasm
npm run typecheck
npm test
npm run build:app
```

Do not run `npm run dev` automatically. The user usually starts and checks the app manually.
