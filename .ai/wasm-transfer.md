# Wasm Transfer Notes

These notes capture lessons from migrating the original TypeScript ZX Spectrum 48K emulation toward a C/WebAssembly core.

## Migration Strategy

- Move behavior in small, testable slices. Keep the TypeScript UI operational after each slice.
- Bring up a UI-connected skeleton early. Even fake display/audio/input helped prove the renderer, controller, shared state, and Wasm ABI before the full machine was accurate.
- Preserve original timing and state semantics. The original `MachineController` and shared `emulatorState.machineState` pattern drive menu and toolbar availability; do not replace that with ad hoc renderer globals.
- Keep shared state reducer-driven. Machine commands are issued through shared actions; emulator-owned state changes must be dispatched from the EMU renderer with source `"emu"` so main menu state stays synchronized.
- Use the existing TypeScript unit tests wherever possible. For CPU migration, the goal is to adapt the test infrastructure to Wasm rather than rewriting test cases.

## C/Wasm Core Rules

- Use static memory only for the machine core. Do not introduce `malloc`, heap allocators, or dynamic collections in C.
- Keep exported Wasm memory and explicit exported functions as the ABI. TypeScript reads static buffers from known exported pointers.
- Keep C source and TypeScript adapter/controller files together per machine under `src/emu/<machine>` for ABI locality.
- For SP48, the coordinator remains `src/emu/sp48/sp48.c`; device files are included by it:
  - `sp48-memory.c`
  - `sp48-ula.c`
  - `sp48-keyboard.c`
  - `sp48-beeper.c`
  - `sp48-ports.c`
- The included-C-file pattern keeps the freestanding clang build simple while making devices navigable. Avoid splitting into separate object/link steps until there is a concrete need.
- Keep the Z80 implementation single-sourced. `src/emu/z80/z80.c` builds as standalone `z80.wasm` for CPU tests and is included by `sp48.c` with SP48 bus/timing macros.

## Frame Execution And Timing

- The C frame runner should execute actual CPU instructions until the frame boundary is crossed. Do not snap tacts back to the nominal boundary; instruction overshoot is part of the machine timing.
- Interrupt state should be recalculated before each instruction using the current frame tact.
- UI frame statistics should distinguish wall-clock pacing from active emulation work. The status bar's frame execution time should measure the active `executeMachineFrame()` or debug frame-slice call, not the delayed interval waiting for the next 50 Hz frame.
- The renderer machine loop should pace frames from `tactsInFrame / baseClockFrequency`, not `requestAnimationFrame`, because Spectrum PAL is 50 Hz and UI repaint cadence is often 60 Hz.

## Display

- Renderer TypeScript owns presentation. The Wasm core prepares a border-inclusive pixel buffer; TypeScript copies it to canvas.
- SP48 currently exposes the original-style PAL display size `352x288`, with a start offset that skips guard rows, matching the original screen-device shape.
- Use sharp pixel rendering in the canvas path; blurred scaling makes Spectrum output look wrong.
- Scanlines are applied in the renderer to the zoomed canvas backing store. Match the original panel by setting the canvas `width`/`height` attributes to the zoomed display dimensions; CSS-only scaling leaves `canvas.width / sourceWidth` at `1`, so the zoom-aware scanline pattern has no lines to darken.
- `sp48RenderInstantScreen()` is important for UI feedback after memory, border, or input changes while paused/stopped.

## Audio

- Do not fake fixed sample counts. Generate samples according to continuous tact/sample timing, matching the reference beeper device.
- Use the actual `AudioContext.sampleRate`; do not hardcode 44.1 kHz.
- The frame's sample count can vary naturally, for example around `958, 958, 959...` at 48 kHz PAL.
- Render samples through the actual CPU tact after the instruction that crosses the frame boundary so overshoot tacts are included.
- Keep output scheduling in the renderer audio worklet path. The C core prepares static per-frame sample buffers; TypeScript normalizes, applies volume/mute, and submits to the worklet.
- For the current Spectrum speaker path, post the mixed speaker signal to both left and right channels so playback is centered.

## Keyboard And Ports

- Implement keyboard handling early, even if initially fake, because it validates end-to-end UI-to-Wasm input.
- Preserve the Spectrum keyboard matrix and `$FE` read/write behavior. Virtual and physical keyboard events both update Wasm key state.
- The virtual keyboard needs multi-zone keys because one visual Spectrum key can emit different key combinations depending on where the user clicks.
- Keep visual key highlighting for both virtual and physical key presses; it is useful diagnostic feedback that input reached the emulator.
- `$FE` writes drive border color and EAR/MIC state. These should be visible/audible in the UI soon after implementation.

## Debug And Diagnostics

- Keep lightweight diagnostics while migrating: PC, AF, frame tact, contention, interrupt line, keyboard matrix, `$FE` in/out, and audio sample count have all helped validate incremental steps.
- Diagnostics can be temporary overlays or status-bar fields, but they should read from the same Wasm adapter methods tests use.
- Status-bar statistics live in shared `emulatorState.sp48FrameInfo`, published by the emulator panel from frame-completed events.

## Verification

Use targeted checks after each migration slice:

```sh
npm run build:wasm
npm run typecheck
npm test
npm run build:app
```

For UI-only XMLUI documentation changes, build/test may not be necessary. For C/Wasm, adapter, controller, or renderer integration changes, at least `build:wasm`, `typecheck`, and relevant tests are expected.
