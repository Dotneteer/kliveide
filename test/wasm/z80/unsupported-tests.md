# Unsupported Copied Z80 WASM Tests

Copied test files in this list remain byte-for-byte identical to `test/z80/`.
They are excluded only by `test/wasm/vitest.z80.config.ts`.

| File | Reason |
| --- | --- |
| `memoryOp.test.ts` | Requires full per-instruction memory read/write history. The current standalone WASM Z80 test exports expose only the final memory bus event for an instruction. |
