# ZX Spectrum WASM Tests

This folder contains ZX Spectrum WASM machine and device tests.

Keep new Spectrum WASM tests here so they are grouped separately from the
existing `test/zxSpectrum` WASM smoke tests.

Use `wasm-test-helpers.ts` for deterministic ROM setup, WASM artifact builds,
matrix helpers, and shared assertions. Keep model tests focused on direct WASM
behavior instead of repeating WASM loader setup or comparing against removed
classic TypeScript machines.

The helper subclasses also expose a test-only control surface for C-owned
single-instruction execution, CPU pair registers, tacts, memory/port access,
contention counters, and paging state. Use those methods instead of reaching
into adapter internals.
