# ZX Spectrum 48K WASM v2 Migration Plan

Reference folder: <https://github.com/Dotneteer/kliveide/tree/dotneteer/groups-plan/src/emu>

Goal: replace the current incremental/hybrid SP48 WASM backend with the `groups-plan` v2-style full-machine WASM implementation. Do not add benchmark infrastructure; after each runnable milestone, verify manually with `npm run dev`.

## Deep-Dive Findings

The current implementation is slow because it is still architecturally a hybrid adapter. It has a fast Z80 in WASM, but the machine around it is still synchronized through TypeScript-facing state blocks, event buffers, dirty ranges, timing tables, and device compatibility logic.

The v2 implementation is faster because it is a single WASM-owned machine:

1. `sp48.c` owns the full machine state as static C globals: memory, keyboard rows, contention tables, ULA render tables, pixel buffer, audio samples, tape data, CPU counters, and port latches.
2. `sp48.c` includes `z80.c` directly with SP48-specific macros, so memory, port, contention, and tact hooks are compiled into the Z80 execution path instead of routed through a separate adapter layer.
3. A normal frame is one hot C loop: `sp48ExecuteFrame()` runs until `frameEndTact`, while audio, tape, contention, interrupt state, and ULA rendering all advance inside the C core.
4. Display output is a WASM-owned pixel buffer, not a TypeScript screen device reconstructed from memory/dirty ranges after execution.
5. Audio output is a WASM-owned `int16` sample buffer, not JS-side replay of transition traces.
6. Keyboard input is pushed as key status/row state into C, and FE port reads consume the C keyboard matrix directly.
7. Tape playback/save is C-owned in v2. The current backend still generates tape EAR tables from TypeScript and can touch frame-length loops on the adapter side.
8. The v2 TypeScript wrapper is thin: call `sp48ExecuteFrame()`, then expose typed views over WASM memory for pixels/audio/memory/tape state.

The most important conclusion: continuing to port individual devices into the current ABI will help at the edges, but it will not reach v2 speed. The current ABI itself is the drag: CPU state import/export, adapter wrappers, debug/event buffers, JS timing-table sync, and TypeScript device coupling remain in the normal frame path.

## Migration Phases

| Step | Status | Work | Manual Check |
| --- | --- | --- | --- |
| V2-0 | Completed | Vendored the v2 source set into `src/emu/machines/zxSpectrum48/wasm/v2/` without removing or rewiring the existing backend. Included `sp48.c`, `sp48-memory.c`, `sp48-ula.c`, `sp48-ports.c`, `sp48-tape.c`, `sp48-beeper.c`, `sp48-keyboard.c`, v2 `z80.c`, and TypeScript reference wrapper files. | No app behavior change; v2 is isolated and not compiled yet. |
| V2-1 | Completed | Added a separate `v2` build mode and CLI build path that emits `src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48-v2.wasm` from the vendored `sp48.c` translation unit, while keeping `zx-spectrum48.wasm` as the current fallback artifact. | `node scripts/build-sp48-wasm.cjs` emits both artifacts; focused build/ABI tests pass. |
| V2-2 | Completed | Added `Sp48WasmV2Loader.ts` with direct typed views for memory, pixel buffer, audio samples, keyboard lines, tape data, saved tape data, and tape filename data. Kept the v2 ABI separate from the current layout/event-buffer compatibility ABI. | Unit tests instantiate the v2 artifact, call hard reset/frame, and validate direct views without UI integration. |
| V2-3 | Completed | Added `ZxSpectrum48WasmV2Machine` as a parallel experimental adapter, wired explicit `sp48Implementation: "wasm-v2"` selection, and kept the current `"wasm"` backend as the default. The adapter loads the v2 artifact, uploads ROM bytes, runs `sp48ExecuteFrame()`, and exposes v2 memory/pixel/audio basics through the existing machine surface. | Unit tests select v2 manually and execute a full C-owned frame. Manual `npm run dev` validation can now use `"wasm-v2"` config. |
| V2-4 | Completed | Tightened the experimental v2 normal-run path around `sp48ExecuteFrame()`: no TypeScript frame runner, no CPU import/export blocks, no tape EAR table generation, no event trace replay, and no dirty-range screen invalidation. Keyboard input now syncs through the v2 keyboard-lines typed view with row-change caching; audio sample rate and clock multiplier sync only when changed. Removed per-frame full CPU register export sync from normal run and overrode V2 instant-screen/buffer-offset handling so the renderer no longer invokes the old TypeScript screen-device render path each full frame. Added a `ZX Spectrum 48K (WASM v2)` PAL model for manual `npm run dev` selection. | Select `ZX Spectrum 48K (WASM v2)` / `modelId: "pal-v2"` and manually check idle ROM, keyboard response, border changes, and audio. |
| V2-5 | Completed | Integrated the v2 pixel buffer with the renderer through an optional direct `getPixelBufferBytes()` machine API. The V2 machine exposes the WASM `Uint32Array` and `Uint8ClampedArray` pixel views directly, and the emulator screen hook uses the direct byte view when scanlines are off, avoiding the old full-frame `Uint32Array.set()` plus `ImageData.data.set()` copy chain. Existing backends keep the previous path. | Unit tests cover the direct byte renderer path; manually check full screen rendering, border timing, flash, and screen writes with `ZX Spectrum 48K (WASM v2)`. |
| V2-6 | Completed | Moved V2 tape load/save integration to the C tape state while preserving the existing app-level machine properties. `MEDIA_TAPE` uploads `TapeDataBlock` bytes directly into the WASM tape data view and block metadata through the v2 C API; `TAPE_MODE`, `FAST_LOAD`, and `REWIND_REQUESTED` mirror into v2 controls; saved v2 tape blocks publish back as `SAVED_TO_TAPE` TZX contents. The V2 path stays away from the old frame-length JS tape EAR table generation. | Unit tests cover V2 tape upload/control mirroring; manually check fast load, normal load, and tape save with `ZX Spectrum 48K (WASM v2)`. |
| V2-7 | Completed | Mapped the first IDE/debugger surface to v2 getters/setters without adding work to the normal frame path. `getCpuState()` now refreshes CPU registers, tacts, prefix, RET/RETN state, and last memory/port access from the V2 C core; `setTacts()` updates both TypeScript and WASM state; debug/termination execution uses `sp48ExecuteInstruction()` so Step Into and simple execution-point/breakpoint checks run instruction-by-instruction in C. V2 currently imports the last memory/port access, not a full multi-access log buffer. | Unit tests cover V2 Step Into and CPU/bus-state inspection; manually check pause, step into, simple breakpoints, and memory/port inspectors with `ZX Spectrum 48K (WASM v2)`. |
| V2-8 | Completed | Added explicit PAL comparison/fallback models so the current stable WASM backend, the experimental V2 WASM backend, and the TypeScript backend can coexist in the dev model picker. `pal-v2` selects `"wasm-v2"`, `pal-wasm` selects the stable `"wasm"` backend, and `pal-typescript` selects the `"typescript"` backend. The default PAL model still follows the centralized rollout default. | Toggle `ZX Spectrum 48K (WASM v2)`, `ZX Spectrum 48K (WASM stable)`, and `ZX Spectrum 48K (TypeScript)` in dev and compare visible behavior manually. |
| V2-9 | Completed | Made v2 the centralized default ZX Spectrum 48K backend by setting `DEFAULT_SP48_IMPLEMENTATION` to `"wasm-v2"`. Kept the current hybrid WASM backend and TypeScript backend available as explicit fallback/comparison models instead of removing them in the same step. Updated backend-selection tests and WASM docs to reflect the rollout default. | Final `npm run dev` manual pass on common workflows; use `ZX Spectrum 48K (WASM stable)` or `ZX Spectrum 48K (TypeScript)` if a fallback comparison is needed. |

## Implementation Notes

- Do not try to preserve the current `sp48_core.c` ABI as the v2 normal-run ABI. That preserves the main overhead.
- Keep current Z80 conformance tests, but test v2 at the machine boundary. The Z80 source is already effectively the same family; the speed difference is the integration shape.
- Use the v2 pointer-export style for high-volume data:
  - `sp48MemoryPtr`
  - `sp48PixelBufferPtr`
  - `sp48AudioSamplesPtr`
  - `sp48KeyboardLinesPtr`
  - tape data/save buffers
- Keep TypeScript object creation out of the frame loop where possible. Return typed views and let renderer/audio consumers copy only when they must.
- The first milestone worth manual performance checking is V2-4. V2-5 and V2-6 should improve perceived performance further because screen/tape work stops bouncing through TypeScript.

## Primary Risks

- Renderer integration may currently assume `CommonScreenDevice`; v2 wants a raw pixel buffer.
- Debugger APIs may require careful compatibility mapping because v2's normal execution is intentionally much thinner than the current adapter.
- Tape behavior is more complete in v2, but migration must preserve existing app-level media properties and saved-tape flows.
- The v2 artifact has larger static buffers, so build memory sizing and packaging paths need review.
