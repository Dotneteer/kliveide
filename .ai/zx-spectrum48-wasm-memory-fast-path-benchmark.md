# ZX Spectrum 48K WASM Memory Fast-Path Benchmark

Generated: 2026-08-03

## Summary

The SP48 fast Z80 adapter now uses direct CPU-bus memory value helpers instead
of routing CPU writes through public `sp48_write_memory()`. Public
`sp48_write_memory()` and `sp48_patch_memory()` still record dirty ranges;
normal CPU frame writes do not.

## Benchmark

Command:

```sh
npm run benchmark:sp48-wasm
```

Production artifact:

- Before: 226,153 bytes
- After: 225,453 bytes

Median WASM timings:

| Scenario | F5 baseline | After memory split |
| --- | ---: | ---: |
| idle-rom-loop | 37.395 ms | 37.330 ms |
| ram-heavy-loop | 33.352 ms | 33.612 ms |
| contended-screen-loop | 30.289 ms | 28.900 ms |
| fe-border-audio-loop | 39.228 ms | 38.282 ms |
| keyboard-polling-loop | 31.126 ms | 31.184 ms |
| tape-load-ear-loop | 31.493 ms | 31.524 ms |
| floating-bus-loop | 30.152 ms | 29.907 ms |
| debug-step-nop-loop | 0.811 ms | 0.790 ms |

The change is mainly a code-shape cleanup: it removes public dirty-range
bookkeeping from CPU-frame writes and slightly shrinks the artifact. Performance
is mostly neutral-to-slightly-better in this benchmark run, with RAM-heavy in
the noise/slightly-slower range.
