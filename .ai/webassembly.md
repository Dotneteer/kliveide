# WebAssembly And C Toolchain Notes

Read this before changing C/WebAssembly emulator code, Wasm build wiring, or renderer code that consumes Wasm memory.

## Current Baseline

- Target stable WebAssembly 2.0-compatible browser/Electron runtimes.
- C code is compiled directly to `wasm32` with `clang`; no Emscripten runtime is used.
- Wasm modules are freestanding:
  - compiled with `-nostdlib`
  - compiled with `-fno-builtin` so Clang does not lower simple loops to libc calls such as `memset`
  - no start function: `-Wl,--no-entry`
  - exported linear memory: `-Wl,--export-memory`
  - explicit exported C functions per target
- Renderer TypeScript owns presentation and browser APIs. C/Wasm should prepare frame data in linear memory; TypeScript should read those buffers and render display/audio.

## Toolchain Requirement

A newly cloned repository needs:

```sh
clang --target=wasm32 --version
```

The repository does not install this automatically. On macOS, Homebrew LLVM clang is known to work. Keep respecting the project rule: do not run `npm install` automatically.

## Source And Artifact Layout

- C source lives under `src/wasm` for standalone demos and under `src/emu` for emulator code.
- The current proof-of-concept target is:
  - Source: `src/wasm/bitmap-demo/bitmap-demo.c`
  - Generated artifact: `public/wasm/bitmap-demo.wasm`
- The current Z80 migration target is:
  - Source: `src/emu/z80/z80.c`
  - Generated artifact: `public/wasm/z80.wasm`
- The current ZX Spectrum 48K skeleton target is:
  - Source/coordinator: `src/emu/sp48/sp48.c`
  - Included device files:
    - `src/emu/sp48/sp48-memory.c`
    - `src/emu/sp48/sp48-ula.c`
    - `src/emu/sp48/sp48-keyboard.c`
    - `src/emu/sp48/sp48-beeper.c`
    - `src/emu/sp48/sp48-ports.c`
    - `src/emu/sp48/sp48-tape.c`
  - Generated artifact: `public/wasm/sp48.wasm`
  - TypeScript adapter: `src/emu/sp48/WasmZxSpectrum48Machine.ts`
  - Controller adapter: `src/emu/sp48/Sp48MachineController.ts`
  - Active renderer integration: `src/renderer/lib/EmulatorPanel/EmulatorPanelReact.tsx`
- Keep C device files and TypeScript adapter/controller files together under `src/emu/sp48` for ABI locality. Do not split C and TypeScript into separate top-level folders unless multiple machine families make that worthwhile.
- ZX Spectrum ROM resources used by the main process live under `src/public/roms`. The default 48K ROM is `src/public/roms/sp48.rom`, copied from the reference workspace.
- `public/wasm` is the renderer static-asset location. Electron Vite copies it to `out/renderer/wasm` for packaged/preview builds.
- Do not put generated `.wasm` files under `src/renderer/src`; Vite may try to module-load them instead of serving them as static assets.

## Build Commands

Use:

```sh
npm run build:wasm
```

This runs:

```sh
node build/wasm/build-wasm.mjs
```

`npm run build:app` runs `build:wasm` before typechecking and `electron-vite build`, so production builds regenerate Wasm from C.

## Dev Watch Behavior

`electron.vite.config.mts` defines `watchWasmResourcesPlugin()` for the renderer dev server.

During `npm run dev`, it:

- builds Wasm once when the renderer dev server starts
- watches `src/wasm/**/*.c`, `src/wasm/**/*.h`, `src/emu/**/*.c`, and `src/emu/**/*.h`
- debounces changes
- rebuilds `public/wasm/*.wasm`
- sends a renderer full reload so the updated binary is fetched

Do not start `npm run dev` unless the user explicitly asks; the user usually starts and tests the app manually.

## Adding Or Changing Wasm Targets

Add targets in `build/wasm/build-wasm.mjs`:

```js
const wasmTargets = [
  {
    name: "bitmap-demo",
    source: "src/wasm/bitmap-demo/bitmap-demo.c",
    output: "public/wasm/bitmap-demo.wasm",
    exports: ["bitmap_width", "bitmap_height", "bitmap_ptr", "render_frame"]
  }
];
```

For each target:

- keep standalone demo sources in `src/wasm`
- keep emulator migration sources in `src/emu`
- keep `output` in `public/wasm`
- explicitly list every C function that TypeScript must call
- keep exported buffers stable for the duration of the TypeScript read

## Current Proof Of Concept ABI

`bitmap-demo.wasm` exports:

- `memory: WebAssembly.Memory`
- `bitmap_width(): number`
- `bitmap_height(): number`
- `bitmap_ptr(): number`
- `render_frame(frameNo: number): void`

The framebuffer format is RGBA8888, one byte per channel, with alpha set to `0xff`.

Renderer loading/rendering is in:

- `src/renderer/lib/WasmBitmapDisplay/wasmBitmapDemo.ts`
- `src/renderer/lib/WasmBitmapDisplay/WasmBitmapDisplayReact.tsx`

The TypeScript side fetches `wasm/bitmap-demo.wasm` relative to the renderer page URL, instantiates it, calls `render_frame`, reads `memory.buffer` at `bitmap_ptr()`, and paints an `ImageData` to a canvas.

## Current SP48 ROM And Memory ABI

`sp48.wasm` keeps a single static 64K memory array. The first 16K is ROM and the rest is RAM:

- `sp48UploadRomByte(offset, value)` writes a byte only while `offset < 0x4000`.
- `sp48ReadMemory(address)` reads the 16-bit address space.
- `sp48WriteMemory(address, value)` ignores writes below `0x4000` and writes RAM at `0x4000-0xffff`.
- `sp48Reset()` resets runtime counters/devices without clearing memory.
- `sp48HardReset(is16k, isNtsc)` preserves uploaded ROM and clears RAM. In 16K mode, `0x8000-0xffff` is initialized to `0xff`.

Renderer code must load ROM bytes through the main API, not Node or Electron imports. The current adapter setup path is:

```ts
const machine = await loadWasmZxSpectrum48Machine();
await machine.setup(readBinaryFile);
machine.hardReset();
```

`WasmZxSpectrum48Machine.setup()` maps the default `romId` (`"sp48"`) to `roms/sp48.rom` and calls `readBinaryFile(path, "public")`.

## Current SP48 CPU Integration

`src/emu/z80/z80.c` is still the single Z80 CPU implementation. It builds as standalone `z80.wasm` for CPU tests, and `src/emu/sp48/sp48.c` also includes it directly with `Z80_EXTERNAL_BUS` defined.

`src/emu/sp48/sp48.c` is the SP48 Wasm entry point and machine coordinator. It intentionally includes internal device `.c` files instead of compiling separate objects, keeping the freestanding Wasm build simple while making devices navigable:

- `sp48-memory.c`: ROM/RAM map, ROM upload, raw memory access, CPU memory bus logging
- `sp48-ula.c`: PAL/NTSC timing tables, contention, display rendering, floating bus
- `sp48-keyboard.c`: keyboard matrix state and key status exports
- `sp48-beeper.c`: EAR/MIC transitions and beeper sample generation
- `sp48-ports.c`: port `$FE` reads/writes, border, EAR/MIC state updates

When embedded in `sp48.c`, the Z80 core is configured with macros:

- memory reads/writes use the SP48 ROM/RAM map
- port reads/writes use the SP48 port implementation, currently `$FE`
- base tacts are mirrored into both the Z80 CPU counter and the SP48 machine tact counter
- memory and I/O delays apply the SP48 contention tables

Keep this single-source pattern when expanding the machine core. Do not fork instruction implementations into `sp48.c`; add new bus/timing hooks to `z80.c` only when they keep standalone `z80.wasm` behavior unchanged by default.

The SP48 adapter exposes CPU diagnostics such as PC, AF/HL, CPU tacts, and instruction counters. These are used by tests and by the temporary UI overlay to prove that Step 7 is active before the full frame runner and debugger are migrated.

`sp48ExecuteFrame()` currently implements the no-debug frame loop in C. It executes complete embedded Z80 cycles until `sp48Tacts` crosses `sp48NextFrameStartTact + sp48TactsInFrame`, then marks the frame complete, advances `sp48NextFrameStartTact`, renders the ULA display buffer plus beeper audio samples, and returns normal termination mode `0`. It deliberately does not snap `sp48Tacts` to the frame boundary; the final instruction can overshoot, matching the original machine runner shape.

The frame-start INT line is recalculated before every `sp48ExecuteInstruction()` call with `currentFrameTact() < 32`. SP48 exposes `sp48GetInterruptsRaised()` and `sp48GetInterruptLineActive()` as diagnostics. Keep debug stepping, breakpoints, code injection, and queued-keystroke frame commands outside this C loop until those features are migrated deliberately.

## Current SP48 Display Rendering

The fake SP48 display pattern has been removed. `src/emu/sp48/sp48-ula.c`, included by `sp48.c`, renders the Spectrum screen into an original-style border-inclusive static buffer:

- bitmap bytes are read from `$4000-$57ff`
- attribute bytes are read from `$5800-$5aff`
- Spectrum's non-linear bitmap row layout is mirrored from the original `CommonScreenDevice`
- color values use the original 16-entry normal/bright palette
- FLASH swaps ink and paper based on `frames / 16`
- the PAL screen shape exposed to the renderer is `352x288`
- `sp48GetPixelBufferStartOffset()` returns one screen row (`352` for PAL), matching the original panel copy offset
- the 256x192 display is placed within the buffer at the same border offset as the original screen device
- border pixels are currently filled from the latest `$FE` border color

`sp48RenderInstantScreen()` is exported for UI and tests that need to repaint the screen immediately after memory or border-color writes. The backing pixel buffer is taller than the displayed height by a few guard rows, just like the TypeScript screen device allocation pattern; TypeScript consumers should copy from `getPixelBufferStartOffset()` for `screenWidthInPixels * screenHeightInPixels` pixels.

## Current SP48 Beeper Audio

The fake SP48 audio pattern has been removed. `src/emu/sp48/sp48-beeper.c` prepares audio samples from the `$FE` EAR/MIC state:

- `$FE` writes record fixed-size, static transition entries with absolute tacts
- left channel is EAR and right channel is MIC, matching the current reference beeper model
- each output sample uses transition-weighted averaging over its sample window
- a DC high-pass filter with `alpha = 0.995` is applied
- output samples currently use the workspace ABI `Sp48AudioSample { int16_t left; int16_t right; }`
- transition-buffer overflow sets diagnostic flag `0x00000002`

Do not introduce dynamic allocation for future audio work. If the sample ABI changes to floats later, update both the C struct and `WasmZxSpectrum48Machine` typed-array view together.

Renderer playback for the emulator panel lives in `src/renderer/lib/EmulatorPanel/AudioRenderer.ts`, `useEmulatorAudio.ts`, and `Sampling.worklet.js`. The panel creates the `AudioContext`, reads its actual `sampleRate`, configures the Wasm machine with that same rate, resumes the context when the machine enters `Running`, suspends it on pause/stop, normalizes the current int16 Wasm samples to WebAudio's `[-1, 1]` range, mixes the diagnostic EAR/MIC channels into the mono Spectrum speaker level (`0.66 * EAR + 0.33 * MIC`), applies `emulatorState.soundLevel`, and posts that same speaker sample to both left and right worklet channels. Do not hardcode 44.1 kHz; many Electron/WebAudio devices run at 48 kHz, and a producer/consumer sample-rate mismatch creates audible periodic gaps.

Keep Wasm audio scheduling aligned with the reference `AudioDeviceBase`: `_audioSampleLength = baseClockFrequency / sampleRate`, `_audioNextSampleTact` is continuous across frames, and `onNewFrame()` clears the current frame's sample list without resetting the next sample tact. A sample is emitted only after machine tacts advance past `_audioNextSampleTact`; do not create zero-width samples at exact frame/sample boundaries. Render the frame's beeper samples through the actual CPU tact after the instruction that crosses the frame boundary, not merely through the nominal frame-end tact, so no overshoot tacts are lost. Frame sample counts therefore vary naturally, for example 48 kHz PAL starts `958, 958, 959, 958...` samples. Do not force `sampleRate / 50` or a fixed `ceil(tactsInFrame * sampleRate / baseClockFrequency)` count every frame. The emulator panel must pace machine frames with a timed machine loop based on `tactsInFrame / baseClockFrequency`, not `requestAnimationFrame`; a 60 Hz repaint loop cannot evenly submit 50 Hz Spectrum audio chunks.

## Current SP48 Floating Bus

`src/emu/sp48/sp48.c` implements the ZX Spectrum 48K floating bus through the static rendering phase/address tables:

- `sp48ReadFloatingBus()` samples `(currentFrameTact - 5 + tactsInFrame) % tactsInFrame`, matching the reference `ZxSpectrum48FloatingBusDevice`.
- bitmap fetch phases return `sp48Memory[0x4000 + pixelAddress]`
- attribute fetch phases return `sp48Memory[0x4000 + attributeAddress]`
- non-fetch phases return `0xff`
- `sp48ReadPort()` routes even-address `$FE` reads to keyboard/EAR and odd-address reads to the floating bus
- diagnostic exports include `sp48ReadScreenMemoryOffset(offset)` and `sp48ReadFloatingBus()`

## Current SP48 Tape Upload ABI

`src/emu/tape/tape-parser.ts` keeps TAP/TZX parsing in TypeScript for now and normalizes supported files into `Sp48TapeBlock` objects. The parser currently supports TAP blocks and TZX blocks `$10`, `$11`, `$14`, and `$20`, while safely skipping a small set of metadata-only TZX blocks.

`src/emu/sp48/sp48-tape.c` owns static tape media storage inside `sp48.wasm`:

- `SP48_TAPE_MAX_BLOCKS`: 512
- `SP48_TAPE_DATA_CAPACITY`: 4 MiB
- `SP48_TAPE_FILENAME_CAPACITY`: 260 bytes

There is no dynamic allocation. Tape upload uses:

- `sp48TapeClear()`
- `sp48TapeSetFileNameByte(index, value)`
- `sp48TapeBeginUpload(blockCount, totalDataLength)`
- `sp48TapeSetBlock(...)`
- `sp48TapeWriteData(offset, value)`
- `sp48TapeFinishUpload()`
- `sp48TapeRewind()`

Diagnostics and inspection exports include block/data capacities, loaded/eof/upload-active flags, current block index, block metadata getters, `sp48TapeDataPtr()`, and `sp48TapeFileNamePtr()`. `WasmZxSpectrum48Machine.uploadTape(blocks, fileName)` is the preferred TypeScript adapter entry point; avoid hand-writing byte loops elsewhere.

`sp48Reset()` and `sp48HardReset()` preserve uploaded tape bytes and metadata, but reset playback position through `resetTapePlayback()`. `sp48TapeClear()` is the eject path and clears filename, metadata, loaded state, and playback flags.

The current UI connection is in `src/renderer/messaging.ts`: `EmuApi.setTapeFile(...)` parses bytes with `parseTapeFile`, uploads the normalized blocks through the active `Sp48MachineController`, and only then dispatches `SET_TAPE_MEDIA` with filename, size, format, warnings, and block count. Invalid files and upload failures leave the previous media state intact. `src/emu/sp48/sp48-session.ts` exposes the active controller set by `EmulatorPanelReact`; keep this bridge small and renderer-only. The session bridge retains the currently selected parsed tape blocks until eject, so if a machine/model change creates a new SP48 controller, the selected tape is reattached to the new Wasm instance. Re-registering the same controller does not reupload or rewind the tape.

Normal tape load playback is implemented in `sp48-tape.c`. `sp48ExecuteInstruction()` calls `updateTapeMode()` after each instruction; entering ROM PC `$056C` switches to load mode and starts the next tape block. In load mode, `sp48ReadPort()` routes `$FE` bit 6 from `sp48TapeGetEarBit()` and records EAR transitions for beeper audio. Exported diagnostics include tape mode, play phase, current EAR bit, data index, bit mask, and start tact. `EmulatorPanelReact` publishes Wasm tape mode/block progress back to shared media state so the EMU status bar can switch from rewound to loading/EOF indications.

Fast tape load is also implemented in `sp48-tape.c` and is controlled by `sp48TapeSetFastLoad(...)`. When fast load is enabled and the CPU reaches ROM routine `$056C`, C mirrors the reference `TapeDevice.fastLoad()` behavior: moves `AF'` into `AF`, detects VERIFY through `(AF & 0xff01) == 0xff00`, checks the block flag against `A`, copies or verifies `DE` bytes at `IX`, accumulates checksum in `H`, routes errors to `$05B6`, and resumes at `$05E2`. Data writes go through the SP48 memory map, so ROM writes remain protected. The TypeScript adapter exposes `setCpuAfAlt(...)` for tests that set up the ROM load entry state directly.

Tape SAVE preparation is in C as static state only; there is still no file-writing UI/API. When ROM PC reaches `$04C2`, `sp48-tape.c` enters SAVE mode, watches `$FE` MIC bit transitions from `sp48-ports.c`, classifies pulse widths with reference tolerances (`24` tacts, minimum `3000` pilot pulses, too-long pause `3_500_000` tacts), and captures standard-speed data bytes into a fixed `SP48_TAPE_SAVE_DATA_CAPACITY` buffer plus fixed saved-block metadata. Adapter diagnostics include save phase, last pulse, pilot count, saved block count, saved data length, saved revision, saved block offsets/lengths, and `getTapeSaveData()`. `clearSavedTapeBlocks()` clears the captured saved blocks/data for acknowledgement without leaving SAVE mode or resetting pulse-classifier state.

`WasmZxSpectrum48Machine.getSavedTapeBlock(index)` returns a copied completed SAVE block with its offset and length, so consumers are insulated from later Wasm buffer reuse. `Sp48MachineController.syncSavedTapeBlocks()` is the SAVE pairing layer that mirrors the original `TapeSaver`: a `0x13`-byte block starting with `0x00` is retained as the header, bytes `2..11` are trimmed as the Spectrum filename, and a later block starting with `0xff` is paired with that header as a pending saved tape file. This pairing does not clear or reset normal loaded tape media.

Saved TZX serialization lives in `src/emu/tape/tape-save.ts`, not in C. It writes the original `TapeSaver` shape: TZX header `"ZXTape!\x1a"` version `1.20`, followed by two standard speed `$10` blocks with 1000 ms pauses, one for the retained header and one for the data block. Keep serialization in TypeScript unless there is a measured reason to move it; it avoids expanding the Wasm ABI and keeps C focused on timing-sensitive capture.

`Sp48FrameCompletedEvent.savedTapeFileInfo` is the migrated equivalent of the original `SAVED_TO_TAPE` machine property. `Sp48MachineController` consumes a pending paired SAVE file when publishing a normal or debug frame event, serializes it with `createSavedTapeTzx(...)`, and emits `{ name, contents, blockCount: 2 }` once. Repeated frame events do not re-emit the same saved file unless C captures another data block.

`test/sp48/sp48-rom-boot.test.ts` contains the ROM SAVE smoke test. It injects a tiny RAM program that calls the real 48K ROM `SA-BYTES` routine at `$04C2` for a header block and then a data block, runs the normal `Sp48MachineController` frame loop, and asserts that the emitted `savedTapeFileInfo` is a parseable TZX whose two standard-speed blocks match the expected TAP block bytes. This is the end-to-end proof for C MIC pulse capture through controller event emission.

## Sass Warning Note

Renderer SCSS is configured to use Dart Sass's modern JS API in `electron.vite.config.mts`:

```ts
css: {
  preprocessorOptions: {
    scss: { api: "modern" },
    sass: { api: "modern" }
  }
}
```

Keep this in place; otherwise Vite 5 may emit Dart Sass `legacy-js-api` deprecation warnings during dev/build.

## Verification

Relevant checks after Wasm/C or renderer integration changes:

```sh
npm run build:wasm
npm run typecheck
npm test
npm run build:app
```

Optional low-level artifact check:

```sh
node -e "const fs=require('fs'); WebAssembly.instantiate(fs.readFileSync('public/wasm/bitmap-demo.wasm'),{}).then(({instance})=>{const e=instance.exports; e.render_frame(1); console.log(e.bitmap_width(), e.bitmap_height(), e.bitmap_ptr());})"
```
