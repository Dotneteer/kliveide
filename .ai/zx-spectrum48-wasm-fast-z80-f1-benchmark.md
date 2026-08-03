# ZX Spectrum 48K WASM fast Z80 F1 benchmark

Generated: 2026-08-03T11:08:37.682Z

F1 changed the current C/WASM CPU control-state shape from packed internal
`flags`/`signals` bits to direct byte fields while preserving the exported
64-byte state block. The fast reference artifact is unchanged from F0.

- Current test artifact: `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-test.wasm`
- Current test artifact bytes: 73,246
- Fast reference artifact: `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-reference.wasm`
- Fast reference artifact bytes: 173,340
- Repeats: 9
- Default iterations: 10,000

| Scenario | Correct | Current median ms | Fast median ms | Speedup |
| --- | --- | ---: | ---: | ---: |
| standard-00-nop-jr | yes | 0.854 | 0.864 | 0.989x |
| standard-40-7f-register-ld | yes | 0.876 | 0.834 | 1.051x |
| standard-80-bf-register-alu | yes | 0.858 | 0.843 | 1.018x |
| memory-stack-call-ret | yes | 0.860 | 0.854 | 1.007x |
| cb-rotate-bit | yes | 1.339 | 1.411 | 0.949x |
| ed-block-io | yes | 1.357 | 1.426 | 0.952x |
| ix-iy-indexed | yes | 0.503 | 0.521 | 0.967x |
| z80n-ed-extension | yes | 1.271 | 1.380 | 0.921x |

F1 is behavior/state preparation, not the expected performance phase. The main
performance opportunity remains F2/F3: compile-time bus specialization and
direct opcode-body migration.

