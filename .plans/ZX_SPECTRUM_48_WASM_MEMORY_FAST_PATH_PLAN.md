# ZX Spectrum 48K WASM Memory Fast-Path Plan

## Goal

Use the high-performance memory shape from the `groups-plan`
`sp48-memory.c` reference to reduce overhead in the current SP48 WASM memory
hot path while preserving the existing 48K/16K machine semantics and public
debug/snapshot helpers.

Reference:

- `https://github.com/Dotneteer/kliveide/blob/dotneteer/groups-plan/src/emu/sp48/sp48-memory.c`

## Findings

The reference implementation keeps CPU memory access small and direct:

- CPU reads mask once and read from a flat 64K array.
- CPU writes update a flat 64K array directly for RAM addresses.
- Public memory helpers are separate from CPU-bus helpers.
- Screen-memory writes can trigger incremental ULA rendering in the reference
  architecture.

The current WASM backend already uses a flat 64K static array, but the fast
Z80 SP48 adapter still routes CPU writes through the public `sp48_write_memory`
helper. That helper records dirty ranges and updates result-block state on every
CPU RAM write, which is unnecessary for normal frame execution and expensive in
RAM-heavy loops.

## Steps

| Step | Work | Gate | Status |
| --- | --- | --- | --- |
| M0 | Capture the current memory path and F5 benchmark baseline. | Review notes identify hot-path gaps. | Complete |
| M1 | Add direct CPU-bus memory value helpers, separate from public memory helpers. | `npm run build:sp48-wasm`; SP48 memory tests pass. | Complete |
| M2 | Route the fast SP48 Z80 adapter through the direct CPU-bus helpers. | SP48 focused suite passes. | Complete |
| M3 | Keep dirty-range behavior only on public write/patch/reset helpers. | Dirty-range tests prove public helpers still report ranges and CPU frame writes do not spam them. | Complete |
| M4 | Benchmark RAM-heavy, contended-screen, floating-bus, and full SP48 scenarios after the split. | Benchmark note records before/after and artifact size. | Complete |
| M5 | Run final hygiene gates and update handoff notes. | `test/z80`, focused SP48 tests, size check, build check, allocation scan, diff check pass. | Complete |

## Baseline

F5 benchmark baseline, generated 2026-08-03:

| Scenario | Iterations | WASM median |
| --- | ---: | ---: |
| idle-rom-loop | 200 frames | 37.395 ms |
| ram-heavy-loop | 200 frames | 33.352 ms |
| contended-screen-loop | 200 frames | 30.289 ms |
| fe-border-audio-loop | 200 frames | 39.228 ms |
| keyboard-polling-loop | 200 frames | 31.126 ms |
| tape-load-ear-loop | 200 frames | 31.493 ms |
| floating-bus-loop | 200 frames | 30.152 ms |
| debug-step-nop-loop | 10000 steps | 0.811 ms |

Production artifact baseline: 226,153 bytes.

## M4 Result

Benchmark generated 2026-08-03 after splitting CPU-bus memory value helpers:

| Scenario | F5 baseline | M4 median |
| --- | ---: | ---: |
| idle-rom-loop | 37.395 ms | 37.330 ms |
| ram-heavy-loop | 33.352 ms | 33.612 ms |
| contended-screen-loop | 30.289 ms | 28.900 ms |
| fe-border-audio-loop | 39.228 ms | 38.282 ms |
| keyboard-polling-loop | 31.126 ms | 31.184 ms |
| tape-load-ear-loop | 31.493 ms | 31.524 ms |
| floating-bus-loop | 30.152 ms | 29.907 ms |
| debug-step-nop-loop | 0.811 ms | 0.790 ms |

Production artifact after M4: 225,453 bytes.
