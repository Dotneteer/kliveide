# Z80 WASM Test Corpus

This folder contains the WASM-side Z80 CPU test corpus.

The `*.test.ts` files in this folder are copied literally from `test/z80/`.
Do not edit them, including whitespace, imports, descriptions, or assertions.

WASM adaptation belongs in wrapper and runner infrastructure only. The local
`test-z80.ts` wrapper exposes the same test-facing API as `test/z80/test-z80.ts`
while running against a test-only standalone build of the WASM CPU
implementation.

These literal tests are intentionally excluded from the default Vitest node
project. The opt-in WASM Z80 config runs the full copied corpus except files
listed in `unsupported-tests.md`.

Run the active copied Z80 WASM suite with:

```sh
npx vitest run --config test/wasm/vitest.z80.config.ts
```

Current wrapper limitations come from the existing WASM CPU export surface:
full memory-operation history is not exported. Direct `@emu/z80/Z80Cpu`
imports are resolved by the WASM Z80 Vitest config to
`test/wasm/z80/Z80Cpu.ts`; copied test files must not be edited for that.
