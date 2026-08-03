# ZX Spectrum 48K WASM performance tuning — T7 note

Generated: 2026-08-03T04:11:24Z

## Implemented

- Added real WASM build modes:
  - `production` emits `src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm`
    with only the SP48 production ABI.
  - `test` emits `src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-test.wasm`
    with the standalone Z80 ABI/test-bus exports.
- Kept the packaged app artifact name unchanged: `zx-spectrum48.wasm`.
- Kept the test artifact out of `dist/` so Vite/Electron production builds only
  bundle the production WASM.
- Updated Z80 WASM tests to build/load the test artifact explicitly.
- Added optimization profiles:
  - `speed`: `-O3`
  - `size`: `-Oz`
  - `lto`: `-O3 -flto`
- Added `-ffreestanding` and `-fno-builtin` to avoid accidental libc/builtin
  lowering beyond the provided static `memset`/`memcpy` shims.
- Added `npm run check:sp48-wasm-size` with an 85,000-byte production ceiling.
- Wired the artifact-size check into `.github/workflows/test.yml`.

## Optimization comparison

Production artifact sizes:

- `speed` (`-O3`): 71,312 bytes
- `size` (`-Oz`): 35,232 bytes
- `lto` (`-O3 -flto`): 71,193 bytes

Reduced benchmark comparison showed `-Oz` is materially slower in hot frame
paths despite its excellent size. LTO saved only 119 bytes compared with `-O3`
on this toolchain and did not justify changing the selected profile.

Selected profile: `speed` (`-O3`, `-ffreestanding`, `-fno-builtin`,
`-nostdlib`).

## Full selected-profile benchmark

`SP48_WASM_OPTIMIZATION=speed npm run benchmark:sp48-wasm`

- Artifact size: 71,312 bytes
- `idle-rom-loop`: 21.163 ms / 200 frames
- `ram-heavy-loop`: 21.375 ms / 200 frames
- `contended-screen-loop`: 19.492 ms / 200 frames
- `fe-border-audio-loop`: 26.581 ms / 200 frames
- `keyboard-polling-loop`: 20.042 ms / 200 frames
- `tape-load-ear-loop`: 20.216 ms / 200 frames
- `floating-bus-loop`: 19.441 ms / 200 frames
- `debug-step-nop-loop`: 0.624 ms / 10,000 steps
