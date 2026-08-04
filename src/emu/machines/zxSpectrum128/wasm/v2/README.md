# ZX Spectrum 128K WASM v2 Backend

This folder contains the incremental full-machine C/WASM backend for the ZX
Spectrum 128K migration.

## Layout

- `sp128/`: the 128K machine implementation.

Later slices can either include the existing C Z80 core from the 48K WASM tree
or move the shared core to a neutral location in one focused change.

## Integration Status

The current Step 2 backend is a skeleton that establishes the production
artifact, loader, typed views, and build contract. It is not yet the default
128K emulator backend.
