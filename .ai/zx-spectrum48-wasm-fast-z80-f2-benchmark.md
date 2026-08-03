# ZX Spectrum 48K WASM fast Z80 F2 benchmark

Generated: 2026-08-03T11:24:39.463Z

F2 split CPU execution entrypoints so the SP48 normal frame path calls
`z80_cpu_execute_sp48_instruction`, SP48 debugger/logging calls
`z80_cpu_execute_sp48_debug_instruction`, and the standalone Z80 ABI calls
`z80_cpu_execute_test_instruction`. The old `z80_bus_mode` selector is no
longer used by SP48 frame/debug execution; it remains only for compatibility
with the legacy generic wrapper and standalone test reset.

This phase did not yet duplicate or template the opcode body for a truly
branch-free compile-time production core. The opcode body still shares one
`readMemory`/`writeMemory`/`readPort`/`writePort` helper family selected by an
internal access mode. A deeper compile-time split would require moving the
opcode implementation into a reusable template or adopting the fast source
more directly in F3/F4.

## SP48 Frame Benchmark

- Artifact: `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm`
- Artifact bytes: 71,066
- Repeats: 7
- Frame tacts: 69,888

| Scenario | WASM median ms |
| --- | ---: |
| idle-rom-loop | 24.908 |
| ram-heavy-loop | 25.106 |
| contended-screen-loop | 22.137 |
| fe-border-audio-loop | 28.969 |
| keyboard-polling-loop | 21.764 |
| tape-load-ear-loop | 22.040 |
| floating-bus-loop | 23.257 |
| debug-step-nop-loop | 0.687 |

## Standalone Comparison

The standalone comparison artifact remained correctness-clean against the fast
reference scenarios after F2. Current test artifact size dropped to 72,927
bytes. The fast reference still wins on most standalone micro-scenarios, but
the production SP48 frame benchmark regressed versus the F1/T9 range.

## Decision

Continue to F3 only if the goal is to migrate opcode bodies toward the fast
source. F2's entrypoint split is useful architecture, but by itself it is not a
performance win. If manual checks confirm the benchmark regression, either F3
must remove the shared helper branch entirely, or this F2 routing should be
reconsidered/reverted before deeper work.

