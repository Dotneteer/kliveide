# ZX Spectrum 48K WASM v2 Reference Backend

This folder contains an isolated snapshot of the high-performance v2 ZX Spectrum
48K WASM implementation from:

https://github.com/Dotneteer/kliveide/tree/dotneteer/groups-plan/src/emu

Downloaded source branch: `dotneteer/groups-plan`
Downloaded on: 2026-08-03

## Layout

- `sp48/`: the v2 SP48 C machine implementation.
- `z80/`: the v2 Z80 C core used by `sp48/sp48.c`.
- `ts-reference/`: the v2 TypeScript wrapper/controller files kept as migration
  reference material.

The C files are arranged so `sp48/sp48.c` can keep its original relative
`#include "../z80/z80.c"` shape.

## Integration Status

This is wired as the default ZX Spectrum 48K backend through
`DEFAULT_SP48_IMPLEMENTATION`. The existing `sp48_core.c` backend remains
available with `sp48Implementation: "wasm"` or the
`ZX Spectrum 48K (WASM stable)` model, and the TypeScript backend remains
available with `sp48Implementation: "typescript"` or the
`ZX Spectrum 48K (TypeScript)` model.

The v2 backend builds to `dist/zx-spectrum48-v2.wasm` and is loaded by
`Sp48WasmV2Loader.ts`. The migration keeps the older backends available for
manual comparison while v2 receives final validation.
