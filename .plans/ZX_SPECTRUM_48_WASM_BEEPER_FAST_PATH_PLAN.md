# ZX Spectrum 48K WASM Beeper Fast Path Plan

Reference source: `sp48-beeper.c` from `Dotneteer/kliveide` `dotneteer/groups-plan`.

Goal: move the production ZX Spectrum 48K WASM beeper audio path from JS-side transition replay to C/WASM-side sample generation, following the reference implementation's accumulator, DC filter, and fixed sample buffer model.

## Steps

| Step | Status | Notes |
| --- | --- | --- |
| B0 | Completed | Mapped the current audio trace ABI, TypeScript beeper adapter path, and timing hooks. `advance_tacts()` is the correct C-side sample hook. |
| B1 | Completed | Extended the WASM layout and exports with an audio sample buffer pointer, sample count, capacity, sample rate setter, and overflow status bit. |
| B2 | Completed | Ported the reference beeper accumulator/DC-filter/sample-buffer implementation into `sp48_core.c`, wired it into tact advancement and FE port writes, and validated it with the WASM build. |
| B3 | Completed | Switched `ZxSpectrum48WasmMachine.getAudioSamples()` to consume WASM-generated `int16` stereo samples while keeping existing trace APIs for diagnostics/tests. |
| B4 | Completed | Added/adjusted focused tests for generated samples, silent frames, tape-load EAR override, and loader ABI validation. |
| B5 | Completed | Ran focused tests, WASM build, size check, type-check, and whitespace validation. |

## Design Notes

- Keep border/tape-save trace behavior unchanged.
- Keep audio trace exports for compatibility and existing diagnostics, but stop using trace replay as the main production audio path.
- Store WASM audio samples as packed stereo `int16` pairs: `left`, `right`.
- Convert samples to existing `AudioSample` shape on the TypeScript side by dividing by `32767`.
- Generate samples during `advance_tacts()` so audio follows CPU timing exactly, including contention delays.
