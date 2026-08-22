# ZX Spectrum Next WASM Backend

The ZX Spectrum Next WASM backend is an explicitly selectable migration
candidate. It is not the default backend while the timing-depth audit is open.
The earlier binary-size inversion has been explained by missing shared Z80N
timing hooks. The production artifact name is `zx-spectrum-next.wasm`, built
from this folder and loaded by `ZxNextWasmV2Loader.ts`.

## Layout

- `zxnext/`: the freestanding C implementation.
- `dist/`: generated production WASM artifact.

The runtime switch has two supported values:

- `zxnextImplementation: "typescript"` selects the TypeScript machine and
  remains the default/parity oracle while timing-depth parity is open.
- `zxnextImplementation: "wasm"` selects the WASM backend for migration and
  parity work.

Diagnostics from `ZxNextWasmV2Machine.getWasmV2Diagnostics()` report the
migrated public surfaces, default readiness, and any future rollout blockers.

## Maintenance Policy

New ZX Spectrum Next emulator behavior should be implemented in TypeScript and
WASM together while TypeScript is the oracle. TypeScript-only emulator changes
are reserved for behavior that is explicitly host-owned rather than
machine-owned.

The TypeScript backend remains the supported default and parity oracle. Keep
WASM selectable through `zxnextImplementation: "wasm"` and the
`ZX Spectrum Next Preview` model until the timing-depth audit gate closes.

Use TypeScript oracle tests for behavior parity and WASM matrix tests for the
production backend. When a Next device stays separate from the shared Spectrum
WASM devices, keep the reason documented in the migration plan or in an oracle
test.

Boundaries that remain host-owned after the default flip include IDE/UI policy,
Electron resource lookup, host file and media persistence, and test harness
setup. Those boundaries may call into WASM, but they are not reasons to move
machine-owned behavior back to TypeScript.

Build with `npm run build:zxnext-wasm`. The compiler defaults to `clang`; set
`ZXNEXT_WASM_CC` to select another C compiler. The build script uses the
portable `wasm32` target and `wasm-ld`, so it does not require Emscripten.
