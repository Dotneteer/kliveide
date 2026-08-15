# Z80 WASM Test Corpus

This folder contains the WASM-side Z80 CPU test corpus.

The `*.test.ts` files in this folder are copied literally from `test/z80/`.
Do not edit them, including whitespace, imports, descriptions, or assertions.

WASM adaptation belongs in wrapper and runner infrastructure only. The local
`test-z80.ts` wrapper exposes the same test-facing API as `test/z80/test-z80.ts`
while running against a test-only standalone build of the WASM CPU
implementation.

These literal tests are intentionally excluded from the default Vitest node
project while they are migrated in small batches. Run opt-in copied Z80 WASM
tests with:

```sh
npx vitest run --config test/wasm/vitest.z80.config.ts test/wasm/z80/standard-ops-00.test.ts
```

Current wrapper limitations come from the existing WASM CPU export surface:
memory-operation history is not populated, and Step-Out stack observations for
CALL/RET instructions are not yet synthesized by the wrapper.
