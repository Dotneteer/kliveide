# ZX Spectrum 48K WebAssembly Migration Plan

This plan migrates the ZX Spectrum 48K machine from TypeScript to C/WebAssembly in small, testable steps. The end state is a Wasm-backed `sp48` machine that runs complete machine frames in C, writes display and audio output into static linear-memory buffers, and keeps the existing renderer contract for pixels, sound, and keyboard input.

The migration should be UI-first. The first useful Wasm milestone is not an accurate emulator; it is a visible, controllable machine skeleton wired into the emulator UI. Even before the real ULA, beeper, keyboard matrix, memory contention, and CPU frame loop are complete, the Wasm module should produce an animated bitmap pattern, placeholder audio samples, and observable input state. After that, each fake subsystem is replaced with the accurate implementation behind the same ABI.

## Goals

- Move deterministic ZX Spectrum 48K frame execution into C/Wasm:
  - Z80 CPU execution
  - 64K memory map, including ROM and 48K RAM writes
  - ULA contention and frame timing
  - port `$FE` keyboard, border, EAR/MIC output, tape interaction hooks
  - floating bus behavior
  - screen pixel generation
  - beeper audio sample generation
- Keep renderer-facing behavior compatible with the current TypeScript app:
  - `machine.getPixelBuffer()` returns a `Uint32Array`
  - `machine.getAudioSamples()` returns per-frame audio samples
  - `machine.setKeyStatus(code, down)` updates the emulated keyboard matrix
  - `screenWidthInPixels`, `screenHeightInPixels`, `tactsInFrame`, `baseClockFrequency`, and frame events keep their current meaning
- Use static memory only in C/Wasm. No `malloc`, `calloc`, `realloc`, `free`, dynamic collections, or runtime-sized buffers.
- Preserve the existing TypeScript implementation as the reference until each migrated slice has tests.
- Get a Wasm-backed machine skeleton into the UI as early as possible:
  - fake display returns a changing color/checker/raster pattern every frame
  - fake audio returns deterministic per-frame samples
  - fake input records keyboard state and visibly affects the pattern or exported diagnostics
  - the adapter exercises the same `EmulatorPanel`, screen, audio, and keyboard hooks that the final machine will use

## Reference Code To Mirror

- Machine shell: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/zxSpectrum48/ZxSpectrum48Machine.ts`
- Shared Spectrum behavior: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/ZxSpectrumBase.ts`
- Frame loop: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/MachineFrameRunner.ts`
- Controller/UI timing: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/MachineController.ts`
- ULA screen device: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/CommonScreenDevice.ts`
- Beeper/audio: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/BeeperDevice.ts` and `/Users/dotneteer/source/kliveide-ref/src/emu/machines/AudioDeviceBase.ts`
- Keyboard matrix: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/zxSpectrum/SpectrumKeyboardDevice.ts`
- Floating bus: `/Users/dotneteer/source/kliveide-ref/src/emu/machines/zxSpectrum48/ZxSpectrum48FloatingBusDevice.ts`
- Renderer screen: `/Users/dotneteer/source/kliveide-ref/src/renderer/appEmu/EmulatorArea/useEmulatorScreen.ts`
- Renderer audio: `/Users/dotneteer/source/kliveide-ref/src/renderer/appEmu/EmulatorArea/useEmulatorAudio.ts`
- Renderer keyboard: `/Users/dotneteer/source/kliveide-ref/src/renderer/appEmu/EmulatorArea/useEmulatorKeyboard.ts`
- Renderer machine panel: `/Users/dotneteer/source/kliveide-ref/src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx`

## Static Memory Model

The C/Wasm module must declare every runtime buffer at compile time:

- `uint8_t sp48Memory[0x10000]`
- `uint8_t sp48KeyboardLines[8]`
- `uint8_t sp48Contention[SP48_TACTS_PER_FRAME_MAX]`
- `uint8_t sp48RenderingPhase[SP48_TACTS_PER_FRAME_MAX]`
- `uint16_t sp48RenderingPixelAddress[SP48_TACTS_PER_FRAME_MAX]`
- `uint16_t sp48RenderingAttributeAddress[SP48_TACTS_PER_FRAME_MAX]`
- `uint32_t sp48RenderingPixelIndex[SP48_TACTS_PER_FRAME_MAX]`
- `uint32_t sp48PixelBuffer[SP48_PIXEL_BUFFER_WORDS_MAX]`
- `Sp48AudioSample sp48AudioSamples[SP48_AUDIO_SAMPLES_PER_FRAME_MAX]`
- fixed-size debug/event buffers if and when debugging moves into Wasm

Initial constants can be sized for the larger 48K PAL/NTSC cases:

- PAL tacts per frame: `69888`
- NTSC tacts per frame: calculated from the current NTSC configuration
- pixel buffer: enough for the current `CommonScreenDevice` visible buffer, including the existing start offset behavior
- audio sample capacity: enough for 44.1/48 kHz at the lowest frame rate, with headroom; overflow must clamp and set an exported diagnostic flag

Do not use C library allocation. Keep the existing freestanding build style: `clang --target=wasm32 -nostdlib -Wl,--no-entry -Wl,--export-memory`.

## Proposed Wasm ABI

Create a new target, probably `sp48.wasm`, under `src/emu/machines/zxSpectrum48/sp48.c` or `src/emu/sp48/sp48.c`.

Core exports:

- `sp48Reset()`
- `sp48HardReset(is16k: uint32_t, isNtsc: uint32_t)`
- `sp48UploadRom(ptr/byte API or byte setter)`
- `sp48ExecuteFrame() -> terminationMode`
- `sp48ExecuteInstruction() -> terminationMode`
- `sp48SetKeyStatus(key: uint32_t, down: uint32_t)`
- `sp48SetAudioSampleRate(rate: uint32_t)`
- `sp48SetFastLoad(enabled: uint32_t)` later, if tape stays integrated

Pointer exports:

- `sp48MemoryPtr()`
- `sp48PixelBufferPtr()`
- `sp48AudioSamplesPtr()`
- `sp48KeyboardLinesPtr()`

Shape/count exports:

- `sp48GetScreenWidth()`
- `sp48GetScreenHeight()`
- `sp48GetPixelBufferStartOffset()`
- `sp48GetAudioSampleCount()`
- `sp48GetTactsInFrame()`
- `sp48GetBaseClockFrequency()`
- `sp48GetFrames()`
- `sp48GetTacts()`

CPU/debug exports:

- Reuse or wrap the current Z80 register accessors.
- Add `sp48GetCpuState`-style accessors only after the non-debug frame path works.
- Keep step/breakpoint support in TypeScript initially unless it becomes impossible to maintain.

## Adapter Strategy

Add a TypeScript wrapper class, for example `WasmZxSpectrum48Machine`, that implements the same renderer-facing surface as the current machine:

- It instantiates `sp48.wasm`.
- It exposes `getPixelBuffer()` as a `Uint32Array` view over `sp48PixelBufferPtr()`.
- It exposes `getAudioSamples()` either as:
  - a lightweight object array copied from the static Wasm sample buffer, to satisfy current `AudioRenderer.storeSamples`, or
  - a later typed-array audio path after the UI is stable.
- It forwards `setKeyStatus()` to `sp48SetKeyStatus()`.
- It keeps ROM loading in TypeScript and copies ROM bytes into the static Wasm memory before reset.
- It preserves `screenWidthInPixels`, `screenHeightInPixels`, `tactsInFrame`, `baseClockFrequency`, `uiFrameFrequency`, and frame completion semantics.

This adapter lets `EmulatorPanel`, `useEmulatorScreen`, `useEmulatorAudio`, and `useEmulatorKeyboard` keep working while the implementation underneath changes.

The adapter should exist from the first milestone. It can initially be deliberately fake:

- `executeMachineFrame()` calls `sp48ExecuteFrame()`, which only increments `frames` and fills static output buffers.
- `getPixelBuffer()` returns the animated Wasm pattern buffer.
- `getAudioSamples()` returns copied placeholder samples from the static Wasm audio buffer.
- `setKeyStatus()` forwards to `sp48SetKeyStatus()`, and the fake screen pattern can encode key state so input is visibly proven.
- `pc`, `tacts`, and CPU state accessors can return stable placeholder values until the Z80 core is wired in.

This keeps the UI path honest from day one. The plan then becomes a sequence of replacing fakes with real hardware behavior without changing the renderer contract.

## UI-First Milestone Policy

Every migration step should keep the Wasm-backed machine runnable through the UI. If a subsystem is not accurate yet, provide a deterministic placeholder:

- Display missing: render an animated pattern into `sp48PixelBuffer`.
- Audio missing: generate a low-volume deterministic waveform or silence with a visible non-zero sample count.
- Keyboard missing: store key matrix bits and expose them; optionally modulate the fake display pattern with the current key state.
- CPU missing: advance `frames` and `tacts` as if a frame elapsed.
- Tape/debug missing: return neutral values and keep the TypeScript path as the reference.

No step should require waiting for the full CPU, screen, and audio implementation before the UI can show that the Wasm machine is alive.

## Renderer Shell And XMLUI Notes

Keep renderer shell composition in XMLUI wherever practical. For toolbar-like UI, prefer a `.xmlui` component that composes small XMLUI primitives instead of a large React-backed pane. Use React-backed components only for focused primitives that XMLUI cannot render by itself, such as the migrated SVG-backed `ToolbarButton` and pixel-perfect `ToolbarSeparator`.

When adding React-backed XMLUI primitives:

- Register each primitive in `src/renderer/lib/index.tsx`.
- Provide metadata for every public prop and event; XMLUI type-contract diagnostics are useful and should remain clean.
- Use `valueType`, default values, and `availableValues` so XMLUI tooling understands the component contract.
- Wire events through `wrapComponent(..., { events: { click: "onClick" } })` and call shared state APIs from XMLUI markup, such as `state.dispatchSetGlobalSetting(...)`.
- Avoid passing arbitrary DOM props to built-in XMLUI components unless their metadata declares them; for example, `HStack` rejects raw `role` and `aria-label` props.
- Load local migrated SVG icons with a renderer-bundle-relative glob (`../../../icons/**/*.svg` from `src/renderer/src/icons.ts`), not an absolute `/icons` glob.

This pattern keeps application behavior visible in XMLUI markup while still allowing React to encapsulate low-level rendering details.

## Freestanding C Toolchain Notes

The Wasm build uses `-nostdlib` and must not accidentally introduce libc dependencies. Even hand-written clearing loops can be optimized by Clang into calls such as `memset`, so the shared Wasm build flags include `-fno-builtin`. Keep this flag for all freestanding emulator targets unless a target deliberately provides its own runtime functions.

## Migration Steps

### Step 1 - UI-Connected Static Sp48 Skeleton

Create `sp48.c` with static memory, keyboard lines, pixel buffer, audio buffer, and exported shape/accessor functions. Do not execute CPU instructions yet.

Implement fake frame output immediately:

- `sp48ExecuteFrame()` increments `frames`.
- `sp48ExecuteFrame()` advances `tacts` by the configured frame length.
- `sp48ExecuteFrame()` fills `sp48PixelBuffer` with a frame-changing pattern.
- `sp48ExecuteFrame()` fills `sp48AudioSamples` with deterministic placeholder samples or silence with a valid count.
- `sp48SetKeyStatus()` updates `sp48KeyboardLines`, and the fake display pattern should change when keys are down so input is visibly proven.

Add a `WasmZxSpectrum48Machine` adapter immediately and wire it behind a feature flag or temporary machine id, so the existing `EmulatorPanel` can render the fake Wasm display and play/store fake audio.

Tests:

- Instantiate `sp48.wasm`.
- Verify all pointers are non-zero and stable across reset.
- Verify buffer sizes and dimensions for PAL 48K.
- Verify no exported allocator exists.
- Call `sp48ExecuteFrame()` twice and verify the pixel buffer changes.
- Set a key through the adapter and verify the Wasm keyboard line state changes.
- Verify `getPixelBuffer()` and `getAudioSamples()` return values consumable by the existing renderer hooks.

Done when:

- `npm run build:wasm` builds `sp48.wasm`.
- A tiny TypeScript test can read and write the static memory.
- The emulator UI can select/start the Wasm skeleton and show an animated pattern.
- Keyboard events reach Wasm, even if they only affect fake diagnostics/patterns.

### Step 2 - Fake Machine Lifecycle In The Existing Controller

Make the skeleton behave like a normal machine from the controller's perspective:

- `start`, `pause`, `stop`, and frame-completed notifications work.
- `screenWidthInPixels`, `screenHeightInPixels`, `tactsInFrame`, `baseClockFrequency`, and `uiFrameFrequency` return stable values.
- `machineFrameCompleted` submits fake audio samples through the current audio path.
- `renderInstantScreen()` can redraw or return the latest fake buffer.

Tests:

- Instantiate the adapter through the machine creation path or a focused test helper.
- Execute a frame through the machine/controller-facing method.
- Verify frame count and pixel/audio buffers update.
- Verify `setKeyStatus()` survives reset and release cycles as designed.

Done when:

- The UI integration is real enough that future hardware slices are internal swaps, not new UI plumbing.

Implementation note:

- The current workspace does not yet have the full reference `MachineController`; Step 2 introduces `Sp48FakeMachineController` as the temporary controller-facing lifecycle boundary.
- Toolbar and menu commands are XMLUI/shared-state driven through `emulatorState.lastMachineCommand` and `emulatorState.machineCommandSequence`, not through `globalSettings.demo`.
- Machine lifecycle state is published as `emulatorState.machineState`, using the shared `MachineControllerState` enum so toolbar and menu enablement follow the same pattern as the original app.
- API commands received by the emulator renderer must be dispatched with source `"emu"` after local processing, otherwise the main store will not receive controller state changes and menu enablement becomes stale.
- XMLUI component files that bind shared state need a `SharedAppState id="state"` in their own component scope; a `SharedAppState` declared in a parent component is not visible inside separately declared component files.
- `WasmSp48DisplayReact` owns the temporary controller instance, observes shared-state commands, and advances frames only while the fake controller is running.
- Frame completion events publish lightweight diagnostics under `emulatorState.sp48FrameInfo` with frame count, tact count, and audio sample count.
- `stop` hard-resets the skeleton and leaves it stopped; `restart` hard-resets and starts it; paused step commands execute one fake frame so display/audio/frame-completion plumbing remains visible.
- A stopped machine paints a homogeneous dark gray bitmap so the UI visibly distinguishes stopped state from a paused animated frame.

### Step 3 - ROM And Memory Map

Mirror `ZxSpectrum48Machine` memory behavior:

- The default Spectrum 48 ROM resource lives at `src/public/roms/sp48.rom`, matching the original `roms/sp48.rom` resource name.
- Renderer code loads ROM bytes through `MainApi.readBinaryFile("roms/sp48.rom", "public")`; renderer code must not read the file system directly.
- `WasmZxSpectrum48Machine.setup()` follows the original resource naming convention: `romName` becomes `roms/{romName}.rom`, while absolute ROM paths are passed through.
- The adapter validates that the uploaded Spectrum 48 ROM is exactly 16K before copying it into Wasm memory.
- `0x0000-0x3fff` is ROM.
- `0x4000-0xffff` is RAM for 48K.
- 16K mode writes only to `0x4000-0x7fff`; `0x8000-0xffff` reads as initialized `0xff` after hard reset.
- `sp48Reset()` resets runtime state/devices but does not clear memory; `sp48HardReset()` clears RAM while preserving uploaded ROM bytes.

Tests:

- Port memory-map tests from the TypeScript machine.
- Verify ROM writes are ignored.
- Verify RAM writes persist.
- Verify 16K model behavior.

Done when:

- The static Wasm memory model matches the TS memory model byte-for-byte.
- The fake UI skeleton still runs and can optionally visualize RAM or ROM state in its placeholder pattern.

### Step 4 - Real Keyboard Matrix And Port `$FE` Read

Move `SpectrumKeyboardDevice` behavior into C:

- `sp48KeyboardLines[8]` stores pressed bits.
- `sp48SetKeyStatus(key, down)` updates the line/mask.
- `sp48ReadPort(0xfe-like address)` returns `~OR(selected lines)`.

Tests:

- Use existing Spectrum key mapping constants from TS.
- Verify single-key, multi-key, and multi-line reads.
- Verify renderer-style `setKeyStatus(code, down)` changes the Wasm port result.

Done when:

- The existing keyboard tests can be adapted to use the Wasm module without changing test expectations.
- The UI keyboard path still reaches Wasm through `machine.setKeyStatus()`.

### Step 5 - Port `$FE` Write, Border, EAR/MIC State

Mirror `ZxSpectrumBase.writePort0xFE`:

- bits `0..2` update border color
- bit `3` is MIC
- bit `4` is EAR
- track bit 4 transition tacts for read-side analog EAR behavior
- expose border color and current EAR/MIC state for tests

Tests:

- Write `$FE` values and verify border color.
- Verify EAR/MIC output level state transitions.
- Verify bit 6 read behavior for passive tape mode.

Done when:

- Basic I/O behavior works without screen or audio generation.
- The placeholder display can use the real border color state before the real ULA renderer exists.

### Step 6 - Tacts, Frame Timing, And Contention Tables

Port the `CommonScreenDevice` PAL/NTSC screen configuration calculations into C using fixed arrays:

- Calculate `tactsInFrame`.
- Fill static contention table.
- Fill static rendering phase/address/index tables.
- Add `currentFrameTact = tacts % tactsInCurrentFrame`.
- Apply memory and I/O contention exactly as `ZxSpectrumBase` does.

Tests:

- Compare PAL `tactsInFrame` with TypeScript.
- Spot-check contention values across visible display tacts.
- Verify contended memory read/write delays.
- Verify contended I/O delay patterns for low-bit set/reset cases.

Done when:

- Z80 memory/port delays are machine-accurate enough to run ROM timing-sensitive code.
- The fake `sp48ExecuteFrame()` uses the real frame length and frame counters.

### Step 7 - Integrate Existing Wasm Z80 Into Sp48

Move or share the current `z80.c` CPU implementation so `sp48.c` can own memory and I/O behavior directly. Avoid a design where TypeScript preloads every memory/port access during a frame; full frame execution must stay inside Wasm.

Recommended approach:

- Refactor `z80.c` into CPU core functions with static callbacks/macros for memory and port operations.
- Build one `sp48.wasm` that includes the Z80 core and the Spectrum machine callbacks.
- Keep `z80.wasm` tests alive for CPU-only regression coverage.

Tests:

- Run a small Z80 program inside `sp48.wasm`.
- Verify memory writes, port writes, tacts, PC, and interrupt handling.
- Reuse existing Z80 instruction tests where practical through a CPU-only test harness.

Done when:

- `sp48ExecuteInstruction()` can execute instructions with Spectrum memory and port semantics.
- The UI still runs; the fake frame runner may still be used until the real frame loop is complete.

### Step 8 - No-Debug Frame Runner In C

Port the no-debug path of `MachineFrameRunner.executeMachineLoopWithNoDebug`:

- initialize new frames
- emulate queued keystrokes later, or keep queued keystrokes in TypeScript initially
- run complete Z80 instructions
- process interrupt window: `currentFrameTact < 32`
- stop when `frameCompleted`

Leave debug stepping, breakpoints, frame commands, and code injection in TypeScript for the first full-frame milestone.

Tests:

- Execute NOP loops until one frame completes.
- Verify `frames`, `tacts`, `frameCompleted`, and interrupt behavior.
- Compare against the TypeScript machine for deterministic short programs.

Done when:

- `sp48ExecuteFrame()` advances exactly one frame and returns a normal termination mode.
- The UI skeleton now advances through real CPU work, while fake display/audio can remain in place.

### Step 9 - Replace Fake Display With ULA Rendering

Port `CommonScreenDevice` rendering into C:

- static ARGB palette
- static ink/paper flash tables
- static rendering tact table generated at reset/config time
- `renderTact` called during tact increments
- `sp48PixelBuffer` uses the same ARGB `uint32_t` format expected by `useEmulatorScreen`
- preserve `getBufferStartOffset()` behavior

Tests:

- Write known bytes/attributes to screen memory.
- Run `sp48RenderInstantScreen()` and compare selected pixels with TypeScript output.
- Run a frame with border color changes and verify border pixels.

Done when:

- The current renderer can display the Wasm pixel buffer without conversion.
- The fake pattern path can remain behind a debug export until real rendering is trusted, then be removed.

### Step 10 - Replace Fake Audio With Beeper Audio

Port `SpectrumBeeperDevice` and the relevant `AudioDeviceBase` behavior:

- static `Sp48AudioSample { float left; float right; } sp48AudioSamples[]`
- `sp48AudioSampleCount`
- fixed sample-rate configuration
- transition-weighted EAR/MIC averaging
- DC high-pass filter state
- overflow flag if sample buffer capacity is exceeded

Tests:

- Set sample rate and verify sample count for one frame.
- Generate constant silence and transitions.
- Compare a simple port `$FE` toggling program with TypeScript sample values within tolerance.

Done when:

- `EmulatorPanel.machineFrameCompleted` can submit samples prepared by Wasm.
- The placeholder audio generator is removed or kept only as a diagnostic mode.

### Step 11 - Floating Bus

Port `ZxSpectrum48FloatingBusDevice`:

- use `currentFrameTact - 5`
- inspect static rendering phase table
- return pixel/attribute fetch values from screen memory
- return `0xff` otherwise

Tests:

- Spot-check known floating bus values at display fetch tacts.
- Verify non-fetch tacts return `0xff`.

Done when:

- Port reads from odd addresses match the current TS floating bus behavior.

### Step 12 - Promote Wasm Machine Adapter

Introduce a feature-selectable `WasmZxSpectrum48Machine`:

- Keep it behind a config flag until ROM boot and basic UI behavior are stable.
- Keep `EmulatorPanel` unchanged.
- Ensure `useEmulatorScreen`, `useEmulatorAudio`, and `useEmulatorKeyboard` work through the existing machine methods.

Tests:

- Instantiate the machine through the registry.
- Load ROM bytes.
- Run one frame.
- Verify the returned pixel/audio buffers are non-empty and stable.

Done when:

- The UI can run the Wasm-backed machine without renderer-specific changes.

### Step 13 - ROM Boot And Smoke Tests

Run the real 48K ROM through the Wasm machine:

- boot until the known ROM initialized state, such as `IY == 0x5c3a`
- verify screen memory and system variables against the TS machine at comparable checkpoints
- verify a queued or renderer-simulated key press changes ROM behavior

Tests:

- Boot smoke test.
- BASIC cursor/input smoke test.
- Simple code injection smoke test.

Done when:

- Wasm `sp48` can boot and respond to keyboard input.

### Step 14 - Debug And Tooling Compatibility

Only after normal frame execution is stable, migrate or adapt:

- debug stepping
- breakpoints
- memory read/write event logs
- I/O read/write event logs
- code injection flow helpers
- call stack/step-out support

Keep these in TypeScript as long as possible by reading exported CPU and memory state from Wasm.

Tests:

- Existing debugger tests, if present.
- New tests for step into/over/out around Wasm CPU state.

Done when:

- The IDE debugging workflow behaves like the TS machine.

## Test Strategy

Use three layers of tests:

- C/Wasm ABI tests: instantiate `.wasm`, read static buffers, call exported functions.
- Machine equivalence tests: run the same small program on TS `ZxSpectrum48Machine` and Wasm `WasmZxSpectrum48Machine`, then compare CPU state, memory slices, tacts, border, selected pixels, and audio count.
- Renderer contract tests: verify the current screen/audio/keyboard hooks can consume the Wasm-backed machine with no special cases.

Prefer tiny deterministic programs over full-ROM tests early. Full ROM boot should come after memory, ports, contention, and interrupts are already covered.

## Static Allocation Rules For C

- No `malloc`, `calloc`, `realloc`, `free`.
- No variable-length arrays.
- No recursion.
- No standard library dependency beyond freestanding integer types.
- All runtime buffers are file-scope `static`.
- All capacities are compile-time constants.
- Every exported pointer remains stable for the lifetime of the Wasm instance.
- If a buffer would overflow, clamp, set an exported overflow flag, and keep running deterministically.
- TypeScript may create views and copy data for UI compatibility, but C/Wasm must not allocate dynamically.

## Suggested First Implementation Milestone

The first useful vertical slice should be UI-visible:

1. Build `sp48.wasm`.
2. Expose static memory, pixel, audio, and keyboard buffers.
3. Implement `sp48ExecuteFrame()` as a fake frame generator.
4. Implement `sp48SetKeyStatus()` and make key state affect the fake pattern or diagnostics.
5. Add the TypeScript Wasm machine adapter.
6. Wire the adapter into the existing emulator UI behind a flag or temporary machine id.
7. Verify the UI shows a changing bitmap and the audio path receives samples.

That gives us a real Wasm machine boundary quickly, with the existing TypeScript machine still available for comparison. Accuracy then improves by replacing the fake memory, I/O, CPU, ULA, and beeper paths one at a time.

## Open Questions To Settle During Implementation

- Whether `sp48.wasm` should include its own copy of the Z80 core or whether `z80.c` should be refactored into shared include files used by both `z80.wasm` and `sp48.wasm`.
- Whether renderer audio should remain object-array based initially or move to typed-array samples once the Wasm path is stable.
- Whether tape loading/saving should be inside Wasm immediately or bridged later through TypeScript events.
- Whether debug support should be implemented as exported trace buffers or stay as TypeScript-side state reads for the first release.
