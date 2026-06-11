# ZX Spectrum SAVE Migration Plan

This plan covers implementing ZX Spectrum tape SAVE functionality in parity with the original TypeScript implementation while keeping the emulator core in C/WebAssembly and using static memory only.

## Reference Behavior

The original implementation is centered around:

- `/Users/dotneteer/source/kliveide-ref/src/emu/machines/tape/TapeDevice.ts`
- `/Users/dotneteer/source/kliveide-ref/src/emu/machines/tape/ITapeSaver.ts`
- `/Users/dotneteer/source/kliveide-ref/src/emu/machines/MachineController.ts`
- `/Users/dotneteer/source/kliveide-ref/src/emu/machines/machine-props.ts`

Reference flow:

- `TapeDevice.updateTapeMode()` enters SAVE mode when the ROM PC reaches `$04C2`, the `SA-BYTES` routine.
- While in SAVE mode, `$FE` MIC bit transitions are processed by `TapeDevice.processMicBit(...)`.
- Pulse widths are classified with:
  - tolerance: `24` tacts
  - minimum pilot pulses before sync: `3000`
  - too-long save pause: `3_500_000` tacts
- Save phases are:
  - `None`
  - `Pilot`
  - `Sync1`
  - `Sync2`
  - `Data`
  - `Error`
- Valid data bits require two matching half-pulses.
- A terminating sync pulse ends the current standard-speed data block.
- A first standard-speed block with `dataLength === 0x13` and first byte `0x00` is treated as the Spectrum header.
- A later block whose first byte is `0xff` is treated as data. The reference writes a TZX file containing:
  - TZX header `"ZXTape!\x1a"` version `1.20`
  - the retained header block
  - the data block
- The output filename is extracted from header bytes `2..11`, trimmed, then suffixed with `.tzx`.
- The original machine sets `SAVED_TO_TAPE` to `{ name, contents }`; `MachineController` observes this on frame completion and forwards it in the frame-completed event.

## Current Workspace Baseline

Implemented:

- C/Wasm enters SAVE mode when PC reaches `$04C2`.
- `$FE` MIC bit transitions are routed from `sp48-ports.c` into `sp48-tape.c`.
- C classifies MIC pulse widths with the reference tolerance and constants.
- C captures standard-speed saved bytes into fixed static buffers:
  - saved data bytes
  - saved block offsets and lengths
- TypeScript adapter exposes diagnostics:
  - save phase
  - last pulse
  - MIC bit
  - pilot pulse count
  - saved block count
  - saved data length
  - saved block offset/length
  - saved data byte view
- Tests already cover:
  - SAVE mode entry
  - pulse classification
  - capturing a byte from a standard-speed MIC pulse stream
  - header/data pairing
  - generated TZX serialization
  - controller frame-event emission
  - main-process save dialog/write path
  - UI diagnostics
  - generated tape reattach workflow
  - end-to-end ROM SAVE smoke test

## Constraints

- C/WebAssembly must not use dynamic allocation.
- Keep SAVE capture buffers static and bounded.
- Renderer code must not import Electron or Node directly.
- File writing must go through main-process APIs.
- Shared state should remain reducer-driven; API messaging should handle commands and file writes.
- Do not disturb the existing LOAD path. LOAD is complete and should remain covered by current tests.

## Step 1 - Harden Static SAVE Capture ABI

Goal: make the existing C save buffers robust enough for later file export.

Status: implemented.

Implementation:

- Keep `SP48_TAPE_SAVE_MAX_BLOCKS` and `SP48_TAPE_SAVE_DATA_CAPACITY` explicit in `sp48.c`.
- Exports:
  - `sp48TapeGetSaveMaxBlocks()`
  - `sp48TapeGetSaveDataCapacity()`
  - `sp48TapeGetSavedBlockCount()`
  - `sp48TapeGetSavedBlockOffset(index)`
  - `sp48TapeGetSavedBlockLength(index)`
  - `sp48TapeGetSavedDataLength()`
  - `sp48TapeSaveDataPtr()`
  - `sp48TapeGetSavePhase()`
  - `sp48TapeGetSaveLastPulse()`
  - `sp48TapeGetSavedRevision()`
  - `sp48TapeClearSavedBlocks()`
- `sp48TapeGetSavedRevision()` increments when a saved block completes. This lets TypeScript detect new SAVE output without scanning every frame.
- `sp48TapeClearSavedBlocks()` clears captured saved blocks and data while leaving the current SAVE mode/classifier state alone.

Tests:

- Capturing multiple saved blocks records correct offsets and lengths.
- Exceeding saved block capacity sets a diagnostic flag and enters/save-reports error state.
- `sp48TapeGetSavedRevision()` changes exactly when a block completes.
- Clearing saved blocks resets saved block/data counts without incrementing the revision.

Tests later:

- Exceeding saved data capacity sets a diagnostic flag and does not write past the static buffer. This is best covered with a narrower C-side test hook or a smaller test-only capacity, because the production static buffer is 1 MiB and pulse-driving it through the public ABI would be slow.

Manual check:

- No visible UI change yet.

## Step 2 - Port Header/Data Pairing Semantics

Goal: match the original `TapeSaver` behavior inside the TypeScript adapter/controller layer.

Status: implemented.

Implementation:

- In `WasmZxSpectrum48Machine`, add a helper that returns completed saved blocks as views/copies:
  - block offset
  - block length
  - block data bytes
- In `Sp48MachineController`, maintain save-side state equivalent to `TapeSaver`:
  - retained header block
  - extracted SAVE name
  - last consumed saved revision/block index
- When a completed saved block appears:
  - if length is `0x13` and byte `0` is `0x00`, retain it as header and extract bytes `2..11` as name.
  - if byte `0` is `0xff` and a header exists, pair the retained header with this data block.
  - ignore or log unsupported block patterns in the first pass.
- Do not reset normal loaded tape media when SAVE output is produced.

Tests:

- Header block extracts a trimmed filename.
- Data block after header creates a pending saved-file payload.
- Data block without header does not produce a file.
- A second header replaces the retained header before a data block.

Manual check:

- During `SAVE "name" CODE ...`, diagnostics should show saved blocks advancing.

## Step 3 - TZX Serialization In TypeScript

Goal: produce exactly the same TZX shape as the original `TapeSaver`.

Status: implemented.

Implementation:

- Add a small serializer under `src/emu/tape`, for example `tape-save.ts`.
- Implement:
  - `createTzxHeader(): Uint8Array`
  - `createTzxStandardSpeedBlock(data, pauseAfter = 1000): Uint8Array`
  - `createSavedTapeTzx(headerBlock, dataBlock): Uint8Array`
- TZX file bytes:
  - ASCII `"ZXTape!"`
  - `0x1a`
  - major `0x01`
  - minor `0x14`
  - block `$10`
  - pause, little-endian `1000`
  - data length, little-endian
  - data bytes
  - second block `$10`, same shape
- Keep this in TypeScript; serialization is not time-critical and avoids bloating the C ABI.

Tests:

- Generated TZX header matches reference bytes.
- Standard speed block serializes as `$10`, little-endian pause, little-endian length, data.
- Header+data roundtrip through `parseTapeFile(...)` yields two blocks with identical data.

Manual check:

- None yet.

## Step 4 - Saved File Event From Controller

Goal: surface the `SAVED_TO_TAPE` equivalent through the migrated controller/frame event path.

Status: implemented.

Implementation:

- Extend `Sp48FrameCompletedEvent` with optional saved tape info:

```ts
type SavedTapeFileInfo = {
  name: string;
  contents: Uint8Array;
  blockCount: number;
};
```

- During `Sp48MachineController.executeFrame()` and debug frame slices, after running the frame:
  - inspect saved revision/block count
  - consume new completed saved blocks
  - if a header/data pair creates a TZX payload, attach `savedTapeFileInfo` to the frame event.
- Ensure a saved payload is emitted once, then acknowledged internally so repeated UI frames do not re-save the same file.

Tests:

- Running controller-side block ingestion emits a saved file once.
- Repeated frame event processing does not re-emit the same saved file.
- Debug slice path also emits saved file info.

Manual check:

- Add temporary console logging if useful, but keep it concise and remove it after UI save path works.

## Step 5 - Main Process File Save API

Goal: let the renderer ask the main process to save generated tape bytes.

Status: implemented.

Implementation:

- Add a main API method, for example:

```ts
saveGeneratedTapeFile(defaultName: string, contents: Uint8Array): Promise<{ fileName?: string }>;
```

- Main process behavior:
  - open `dialog.showSaveDialog`
  - default path uses the existing tape folder setting when available
  - default file name comes from SAVE header
  - filter: TZX files
  - write bytes with `fs.writeFileSync` or async equivalent
  - update the tape folder setting after successful save
- Do not write files directly from renderer.

Tests:

- Main processor unit test if the project has a suitable harness; otherwise keep API logic factored so path/default-name construction can be tested as a pure helper.

Manual check:

- Trigger a fake generated save file from renderer and confirm the save dialog/write path.

## Step 6 - Renderer Integration

Goal: handle saved tape files from frame events.

Status: implemented.

Implementation:

- In `EmulatorPanelReact`, when `Sp48FrameCompletedEvent.savedTapeFileInfo` is present:
  - call the new main API to save the generated file
  - avoid blocking frame execution more than necessary
  - guard against concurrent save dialogs if multiple save events arrive quickly
- Consider a small status update/toast:
  - saved successfully
  - save cancelled
  - save failed
- Keep shared media state separate from generated save output unless the user explicitly loads the saved file.

Tests:

- Component-level test if practical, or controller/API-level tests for event handling helpers.

Manual check:

- `SAVE "demo" CODE 32768,16` prompts to save `demo.tzx`.
- Cancelling the dialog does not crash or repeat indefinitely.

## Step 7 - End-To-End ROM SAVE Smoke Test

Goal: prove the real ROM SAVE path produces a TZX-like payload.

Status: implemented.

Implementation:

- Create a test that sets up ROM and memory, then runs enough frames/instructions for a small SAVE operation.
- If a full BASIC-driven SAVE test is too slow or brittle, start with a ROM entry setup that emits a known header/data SAVE path.
- Keep one lower-level pulse-stream test as the stable unit test and one ROM smoke test as the integration proof.
- `test/sp48/sp48-rom-boot.test.ts` injects a tiny RAM program that calls the real ROM `SA-BYTES` routine at `$04C2` twice:
  - once for a `0x00` header block
  - once for a `0xff` data block
- The test runs the normal `Sp48MachineController` frame loop and listens for `savedTapeFileInfo`, so it covers C MIC pulse capture, TypeScript header/data pairing, TZX serialization, and controller frame-event emission together.

Tests:

- Saved payload is produced.
- Output filename comes from the Spectrum header.
- Output TZX parses through `parseTapeFile(...)`.
- Parsed header and data block match expected bytes.

Manual check:

- In the UI, run a simple SAVE from BASIC and verify the file can be loaded back with the current LOAD implementation.

## Step 8 - UI Diagnostics And Polish

Goal: make SAVE observable without cluttering the emulator UI.

Status: implemented.

Implementation:

- Extend the EMU status bar tape tooltip with SAVE diagnostics while in save mode:
  - phase
  - pilot count
  - saved block count
  - saved data length
- Optionally change the tape icon while saving.
- Keep visible text compact; do not add long status strings to the bar.
- `EmulatorPanelReact` publishes SAVE-specific diagnostics into `media.tape`:
  - `savePhase`
  - `savePilotPulseCount`
  - `savedBlockCount`
  - `savedDataLength`
- `EmuStatusBar.xmlui` keeps the visible area compact:
  - saving uses the `floppy` icon
  - loaded tape filename text remains unchanged
  - SAVE details are exposed in the icon tooltip

Tests:

- No UI-specific test was added; the change is markup/state formatting only.

Manual check:

- During SAVE, the status tooltip shows save phase progression and saved block count.

## Step 9 - Error And Capacity Handling

Goal: make failure modes explicit and recoverable.

Status: implemented.

Implementation:

- Surface C diagnostic flags for:
  - save data overflow
  - save block overflow
  - malformed pulse sequence/save phase error
- When SAVE mode leaves due to ROM error `$0008` or too-long pause, ensure state settles back to passive.
- Decide whether partial saved blocks should remain inspectable after error; document the chosen behavior.
- SAVE malformed pulse sequences set `SP48_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE`.
- SAVE data and block overflow keep their dedicated diagnostic flags and are not reported as malformed pulses.
- A too-long SAVE pause returns tape mode to passive and leaves the capture diagnostics inspectable.
- Starting a later SAVE through the ROM `$04C2` hook resets SAVE capture buffers/counters, so a new valid SAVE can complete after a previous error. Diagnostic flags remain cumulative until the normal machine reset path clears them.

Tests:

- Too-long pause exits SAVE mode.
- Invalid pulse sequence enters error phase.
- After error, a later valid SAVE can start from a clean capture state.

Manual check:

- Failed/cancelled SAVE attempts do not break subsequent LOAD/SAVE operations.

## Step 10 - Re-Load Saved File Workflow

Goal: close the loop so a saved file can be used immediately.

Status: implemented.

Implementation options:

- Minimal parity: save the TZX file and leave current tape media unchanged.
- Better workflow: after successful save, ask whether to attach the saved file as the current tape.
- If attaching automatically:
  - parse generated TZX bytes with `parseTapeFile(...)`
  - upload to the active controller
  - dispatch `SET_TAPE_MEDIA`
  - persist selected tape path only if a real file was written
- The current implementation automatically attaches the saved file after the save dialog succeeds.
- Main process `saveGeneratedTapeFile(...)` parses the generated bytes, writes the TZX file, dispatches `SET_TAPE_MEDIA` with the saved file path/metadata, and persists that path in settings.
- Renderer `createGeneratedTapeSaveQueue(...)` runs a post-save hook only when the main process returns a saved path.
- `attachGeneratedTapeFile(...)` parses the same generated bytes and uploads the blocks through the active SP48 session bridge, so the saved file is immediately ready for a later LOAD.

Tests:

- Generated TZX parses and uploads through existing tape upload ABI.

Manual check:

- SAVE to TZX, then LOAD from that same generated file.

## Verification Commands

Use these after implementation slices:

```sh
npm run build:wasm
npm run typecheck
npm test
npm run build:app
```

Do not run `npm run dev` automatically. The user usually starts and checks the app manually.
