# Unsupported Copied Z80 WASM Tests

Copied test files in this list remain byte-for-byte identical to `test/z80/`.
They are excluded only by `test/wasm/vitest.z80.config.ts`.

| File | Reason |
| --- | --- |
| `memoryOp.test.ts` | Counts opcode fetches as memory reads, as the TypeScript `Z80Cpu` does. The WASM core's per-instruction access log (`z80AccessLogPtr`) records data accesses only - opcode, displacement and operand fetches are code, not data - so the counts differ by design. |
