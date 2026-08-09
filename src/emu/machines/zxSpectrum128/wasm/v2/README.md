# ZX Spectrum 128K WASM v2 Backend

This folder contains the full-machine C/WASM backend for the ZX Spectrum 128K
machine.

## Layout

- `sp128/`: the 128K machine implementation.

The backend currently reuses the existing C Z80 core from the 48K WASM tree.
Move the shared core to a neutral location only as a focused change that updates
both machine build scripts together.

## Integration Status

The backend is the default 128K emulator implementation. The TypeScript backend
remains available through `sp128Implementation: "typescript"` as a fallback.
