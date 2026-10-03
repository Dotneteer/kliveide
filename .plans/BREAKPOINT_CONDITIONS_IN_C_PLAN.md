# Breakpoint Conditions In The C Cores

Status: **done** (2026-10-03) - Phases 1-3 implemented and verified; §8 records what was built.
The author answered §9 and accepted the recommended resolution of Q1 (no constant folding).
Follows [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md) (done), whose risk R1 and
out-of-scope note ("conditions evaluated in C") this plan takes up. Read that plan's §3 (the
language) and §9 (what was built) first: the language does not change here, only where it runs.

---

## 1. Why

Today a condition is parsed, checked, folded and **evaluated in TypeScript**
(`src/common/utils/breakpoint-condition/`). The WASM core runs the program; after every instruction
the TypeScript debug loop asks `DebugSupport` whether to stop, and at an address carrying `COND_BP`
the slow path syncs the whole register file out of the core (~14 boundary crossings), builds a
context and walks the tree. Measured on the 48K (65 536 passes of a `NOP; DJNZ` loop):

| Breakpoint at the looped address | ns / pass |
|---|---|
| none | 389 |
| hit rule only | 498 |
| register or memory condition | ≈ 2 500 |

Almost all of the extra ≈2.1 µs is the register sync and context construction, not the arithmetic.
A condition on a hot address (an interrupt handler, an inner loop) slows a debug run by a factor of
six. Moving evaluation next to the registers removes the sync entirely.

**The goal is one evaluator.** The cores are separate WASM modules, but they already share one Z80
(`src/emu/z80/wasm/z80.c`, `#include`d by all five Z80 cores and wired through `Z80_*` hook macros).
The condition evaluator follows the same pattern: one C file, included by every Z80 core, with the
machine-specific parts (memory, paging, Next registers) behind hook macros. After this plan there is
**no TypeScript evaluator** — not a second copy kept "for tests" or "for the IDE".

## 2. What exists today (survey, 2026-10-03)

- **Shared CPU.** `z80.c` is included by `sp48.c`, `sp128.c`, `spp3e.c`, `zxnext-cpu.c` and `z88.c`.
  The register file is `static Z80State cpu` (`af`, `bc`, …, the shadow set, `ix`, `iy`, `ir`, `wz`,
  `pc`, `sp`) — a C evaluator included after `z80.c` reads registers directly, with no sync.
- **Tables pushed from TypeScript into a core.** The Next's NextReg watch
  (`zxnextNextRegWatch[3][256]`, `zxnextNextRegWatchPtr()`, a `Uint8Array` view the loader creates,
  one `.set()` per debug-loop entry) is the precedent for a TypeScript-built table living in WASM
  memory. The per-instruction access log (Phase 0 of the previous plan) is the precedent for a
  shared-core structure exported to every machine.
- **Side-effect-free reads per core** (what `getConditionContext` uses now, R3 of the previous plan):

  | Core | CPU view | Partition | Notes |
  |---|---|---|---|
  | 48K | `sp48Memory[a]` | — | no partitions |
  | 128K | `readMappedMemory` (slot map) | ROM/RAM bank arrays | |
  | +3E | slot-base array, **not** `spp3eReadMemory` | ROM/RAM bank arrays | the export latches the floating-bus value |
  | Next | `zxnextMemoryPeekMapped` | 8K pages, 16K ROMs, DivMMC (the `getMemoryPartition` layout) | `zxnextPeekNextRegister`; 16K banks = pages 2b, 2b+1 |
  | Z88 | `z88MemoryRead` | 16K banks | |

  Today the TypeScript `partitionViewMemory` reads the partition views; in C each core supplies the
  same reads as hooks.
- **The compiled form.** `CompiledCondition` holds a tree (`CondNode`) plus a label table re-bound
  after every build. The checker also **folds constants** (with `applyUnary`/`applyBinary` from the
  evaluator) and needs folded values for §3.7 rule 3 (out-of-range constants) and string folding.
- **Who evaluates.** Only `DebugSupport.passesFilters` (emulator renderer). The IDE renderer
  (commands, dialog) compiles and checks but never evaluates — except through constant folding.
- **Non-WASM Z80 machines.** None remain; `MachineFrameRunner` runs the C64 (6510), on which
  conditions are rejected (C18). So no machine needs a TypeScript evaluator.

## 3. Decisions (proposed — confirm in §9)

| # | Decision | Why |
|---|---|---|
| E1 | **The front end stays in TypeScript**: lexer, parser, checker, label binding, error ranges, warnings. The C side never sees text. | Error messages with ranges, the dialog's live validation and the command's caret output are UI concerns; a C parser would add a second grammar to keep in step. |
| E2 | **The evaluator is C, and it is the only one**: `src/emu/z80/wasm/z80-condition.c`, included by every Z80 core after `z80.c`. The TypeScript `condition-evaluator.ts` is deleted. | The author's requirement: one evaluation logic. |
| E3 | The checker emits **bytecode** for a small stack machine (§4.1) instead of a tree. The tree remains an internal checker structure. | A flat `Uint32Array` crosses into WASM with one `.set()`; a stack machine is a ~150-line C loop; no allocation at evaluation time. |
| E4 | **No constant folding** (Q1, recommended). The front end does no evaluation at all: constant sub-expressions are emitted as bytecode and evaluated by C at run time. The out-of-range check (§3.7 rule 3 of the previous plan) keeps working for **literal operands** - a number, a negated number, a character literal, a partition literal - which need no evaluation, and no longer applies to computed constants (`A == 255 + 1`). String folding stays: it packs bytes for an access width and byte order, it does not evaluate. | Folding *is* evaluation; doing it in TypeScript would be the second evaluator E2 forbids, and doing it in C would need a WASM module in the IDE renderer. The loss is narrow (§9 Q1). |
| E5 | Values are **`int64_t`** in C. Every value the language produces fits comfortably: operands are at most 32 bits, and a sum or difference of two stays within ±2³³. Shifts and bitwise operators reproduce C5/C6 explicitly (`(int32_t)`/`(uint32_t)` conversions, count `& 31`). | Exact integers, as C4 requires, with native wasm32 i64 arithmetic. |
| E6 | **"No value"** (`page()` where nothing is paged — `NaN` today) is a reserved `int64_t` sentinel the comparison ops treat with NaN rules (every comparison false, `!=` true; arithmetic on it stays "no value"). | Keeps today's observable behaviour without floating point. |
| E7 | Programs live in a **per-core program store**: one static `uint32_t` arena plus a slot table (offset, length) for **256 conditions** (Q4), written by TypeScript through an exported pointer, as the NextReg watch is. The arena holds 16 384 words (64 KB of zero-initialised static memory, which does not grow the `.wasm` file); one condition may use at most 1 024 words, far beyond any realistic condition. | No heap in the cores (their existing rule); one view in the loader. |
| E8 | Export names are **unprefixed and identical in every core** (`condProgramPtr`, `condSlotTablePtr`, `condEvaluate`, …), defined by the shared file. | One TypeScript binding for all five cores, like the shared `z80*` internals. |
| E9 | **The stop decision stays in TypeScript** (Q3): counters, hit rules, partitions and definition enumeration stay in `DebugSupport`; only "is this condition true?" crosses into C, as one call per definition. Moving the decision and the per-instruction loop into C is **not part of this plan** (§4.5). | Captures most of the win (the register sync) with the smallest change to the most intricate code: `DebugSupport`'s slow path and the step, source-step, one-shot and launch-flow decisions all stay as they are. |
| E10 | Labels are bound **into the bytecode** (a `PUSH_CONST` per label occurrence) and the program is re-uploaded after `setConditionSymbols`. An inactive condition (C14) is never uploaded. | No label table in C; rebinding is rare (once per build). |

## 4. Design

### 4.1 Bytecode

One `uint32_t` per instruction word; an operand follows in the next word(s). Postfix order, so a
program is evaluated left to right with a small value stack (depth bounded by the checker — reject a
condition deeper than, say, 64; no realistic condition comes close).

| Op | Operands | Effect |
|---|---|---|
| `CONST` | lo32, hi32 | push a 64-bit constant (literals, folded strings, partition literals, bound labels) |
| `REG` | register id | push a register (8-bit, 16-bit, shadow, `I`, `R`, `WZ`) from `cpu` |
| `FLAG` | bit | push `(F >> bit) & 1` |
| `VAL`, `ADDR` | — | push the access value / address passed to `condEvaluate` |
| `MEM` | width, flags (be, signed), part kind, part value | pop address, push the read (CPU view / partition / bank), wrapping as §3.4 says |
| `PAGE`, `NR` | — | pop address / register, push `partitionOf` / Next register |
| `S8`, `S16`, `S32` | — | reinterpret the low bits as two's complement |
| `NOT`, `BNOT`, `NEG` | — | unary operators (`!`, `~`, `-`) |
| `ADD`, `SUB`, `AND`, `OR`, `XOR`, `SHL`, `SHR`, `USHR` | — | binary arithmetic/bitwise, C4–C6 semantics |
| `EQ`, `NE`, `LT`, `LE`, `GT`, `GE` | — | comparisons → 0/1, NaN rules for "no value" (E6) |
| `JZ`, `JNZ` | target | short-circuit `&&` / `||` (keeps "a guard reads no more than it must") |
| `BOOL` | — | normalise to 0/1 |
| `END` | — | result = top of stack ≠ 0 |

Versioned: the first word of every program is a format version; `condEvaluate` refuses (returns
"error", which `DebugSupport` treats as true, C15) a program from a newer front end.

### 4.2 The C file

`src/emu/z80/wasm/z80-condition.c`, included by each core **after** `z80.c` (it reads `cpu`). The
machine-specific reads are hooks with defaults, the `z80.c` pattern:

```c
#ifndef COND_PEEK            /* side-effect-free read through the current paging */
#define COND_PEEK(addr) 0u
#endif
#ifndef COND_PEEK_PARTITION  /* (partition, address): the byte at address modulo the partition's size */
#define COND_PEEK_PARTITION(p, addr) COND_PEEK(addr)
#endif
#ifndef COND_PEEK_BANK       /* Next 16K bank */
#define COND_PEEK_BANK(bank, offset) 0u
#endif
#ifndef COND_PARTITION_OF    /* returns COND_NO_VALUE when nothing is paged */
#define COND_PARTITION_OF(addr) COND_NO_VALUE
#endif
#ifndef COND_NEXTREG
#define COND_NEXTREG(reg) 0u
#endif
```

Exports (E8): `condProgramPtr`, `condProgramCapacity`, `condSlotTablePtr`, `condSlotCount`
(256), and `condEvaluate(slot, accessValue, accessAddress)` → 1 true / 0 false / 2 error.

**A test build** (`condition-test.wasm`): the same file compiled alone with test hooks - registers,
memory, partitions, banks and Next registers read from arrays the test fills through exported
pointers - so the language's semantics are tested without a machine. Built by
`scripts/build-condition-wasm.cjs` through `wasm-build-lock.cjs`. It is test-only; nothing ships it.

### 4.3 Per-core wiring

| Core | `COND_PEEK` | `COND_PEEK_PARTITION` | `COND_PARTITION_OF` | extra |
|---|---|---|---|---|
| 48K | `sp48Memory[a]` | (default) | (default: no value) | |
| 128K | slot map | ROM/RAM arrays | `sp128GetCurrentPartition` | |
| +3E | slot base (no latch) | ROM/RAM arrays | `spp3eGetCurrentPartition` | |
| Next | `zxnextMemoryPeekMapped` | page/ROM/DivMMC layout | page bank8 | `COND_PEEK_BANK`, `COND_NEXTREG` |
| Z88 | `z88MemoryRead` | bank arrays | Z88 slot banks | |

Each core adds the include and these defines; its build script exports the `cond*` names. The
partition reads must match the TypeScript `getMemoryPartition` views exactly — a test per core
compares them over every partition (§6).

### 4.4 TypeScript side

- **Front end** (`condition-checker.ts`): emits bytecode (`condition-bytecode.ts`, an emitter and
  the op table) instead of `CondNode`; `CompiledCondition` carries `code: Uint32Array` with label
  placeholders and is re-emitted on bind. The constant folder goes (E4); rule 3 compares only
  literal operands. The IDE renderer needs no WASM to validate.
- **`condition-evaluator.ts`: deleted.** `ConditionContext` and `conditionContext.ts`'s register
  reading and `partitionViewMemory` go with it; `getConditionContext` on the machines is replaced by
  a `conditionHost` (upload program, evaluate slot).
- **`DebugSupport`**: arming uploads the bytecode into the core's store and records the slot;
  `passesFilters` calls `condEvaluate(slot, value, address)` instead of building a context. Uploads
  happen when a definition is armed or re-bound and when the machine changes (a new core has an empty
  store). Capacity overflow (more conditions or bytes than the store holds) falls back to "error →
  stop every time" for the overflowing definition and reports it in `conditionError`, rather than
  silently evaluating nothing.
- **Machines**: each WASM machine's loader adds the `cond*` exports and a `Uint32Array` view on the
  store; `getConditionContext` is replaced. No register sync on the slow path.

### 4.5 Not in this plan: the stop decision in C

Decided against for now (Q3) - recorded so the store and ABI do not block it later. With evaluation
in C, the remaining per-instruction cost of a debug run is the TypeScript loop itself
(one `…ExecuteInstruction` crossing plus a PC read per instruction, ~390 ns on the 48K). Moving the
**breakpoint** part of the stop decision into the core — the 64K flag table, partition entries,
definitions with their counters and hit rules — would let a core run `…RunUntilBreak(budget)` for
whole frames in C and return only on a stop, a frame end or a step condition. That touches the
step-over/step-out/source-step decisions (`DebugStepDecision.ts`, `SourceStepDecision.ts`), the
one-shot and run-to-cursor logic, the NEX entry stop and the launch-flow suppression, so it is a
plan of its own. **Revisit when** a measurement shows the per-instruction loop itself (not
conditions) is what makes debug runs slow enough to matter; Phase 3's re-measurement gives the
baseline. Definitions are already slot-addressed, so the store and ABI would carry over.

## 5. Phases

Each ends green on `npm test` with the e2e tiers forced (`npm run test:all`), `npm run build:check`,
`npm run check:wasm-cpu-contract`, and the size checks (`check:*-wasm-size`).

**Phase 1 — the evaluator and its tests, no machine.** `z80-condition.c` with the op set and the
hooks' defaults; `build-condition-wasm.cjs` and the test build; the bytecode emitter in TypeScript;
the front end switched to bytecode, the constant folder removed. The existing engine suites
(`test/debug/breakpoint-condition*.test.ts`, 469 tests) are split: parsing, checking, errors and
warnings stay unit tests of the front end; every *evaluation* expectation is ported to run the
emitted bytecode through `condition-test.wasm` in the `e2e-cores` tier - same expectations, now
against the C evaluator. Expectations that relied on folding (a computed constant out of range)
change to the E4 rule, each change listed in §8. `condition-evaluator.ts` deleted at the end of the
phase. *Acceptance: every other existing expectation passes unchanged.*

**Phase 2 — the cores.** Include the file and wire the hooks in all five Z80 cores; exports; loader
views; a per-core test that every partition/bank read matches `getMemoryPartition`; the per-core
binary size budgets adjusted with a recorded reason.

**Phase 3 — `DebugSupport` on the cores.** Upload on arm/re-bind/machine change; `passesFilters` via
`condEvaluate`; `getConditionContext`/`conditionContext.ts` removed; capacity overflow handling.
The real-machine suites (`test/emu/conditional-breakpoints-real-machine.test.ts`,
`…-injection-flow.test.ts`) must pass unchanged. Re-measure §1's table; record it in §8.

*(No Phase 4: the stop decision stays in TypeScript, §4.5.)*

## 6. Tests

- **Semantics** (Phase 1): every existing engine expectation, run through the C evaluator — the
  access matrix (14 prefixes × CPU / partition / bank / bank label × wrap), operators and precedence,
  JavaScript shift semantics (`1 << 31`, `-8 >>> 28`, count masking), signed reads, strings, "no
  value" comparisons, short-circuiting (a counting fake `COND_PEEK` proves `&&` reads nothing after a
  false left side).
- **Bytecode**: emitter golden tests (small conditions → exact words); a version-mismatch program is
  refused; stack-depth limit enforced by the checker.
- **Hooks** (Phase 2): per core, `COND_PEEK_PARTITION` vs `getMemoryPartition` for every partition
  and offset boundary; `COND_PEEK` has no side effect (the +3E floating-bus latch and the access log
  are unchanged after a condition reads contended memory — the R3 regression test).
- **Integration** (Phase 3): the existing real-machine and injection-flow suites; a store-overflow
  test; a machine switch re-uploads.
- **Tiers** (Q2): the evaluation suites run C, so they go in the **`e2e-cores`** tier
  (`build/e2e-tests.ts`), with the core wiring tests; the front-end suites (parse, check, emit) stay
  in the unit tier and need no toolchain. The unit-tier guard in `test/vitest.setup.ts` must also
  recognise the test build (add `cond` to its export pattern), so an evaluation test left in the
  unit tier fails with the usual message. Inputs of `e2e-cores` in `scripts/run-tests.cjs`: the C
  file is under `src/emu` and the build script matches `scripts/build-*-wasm.cjs` already; **add
  `src/common/utils/breakpoint-condition`**, because the emitter decides what the C code is asked
  to evaluate - a front-end change must re-run the evaluation suites.
- **Performance**: re-run §1's measurement; expected (not promised) under 600 ns/pass for a register
  condition. Benchmarks stay out of the unit tier.

## 7. Risks

- **R1 — semantic drift during the port.** The C evaluator must reproduce C4–C6 and E6 exactly.
  Mitigation: Phase 1 runs the *existing* 469 expectations against C before anything else changes.
- **R2 — a computed constant out of range is accepted** (E4): `A == 255 + 1` never becomes true and
  says nothing. Mitigation: the docs' "Checks" section says literal constants are range-checked;
  if it proves to matter, a pure-literal pass (fold `+ - << >>` of literals only) could return
  without becoming an evaluator - not planned.
- **R3 — side effects through hooks.** A hook that reads through a contended or latching path
  perturbs the machine (the +3E case). Mitigation: §6 hook tests; hooks name the raw arrays.
- **R4 — core size.** Each core grows by the evaluator (a few KB at `-O3`). The size checks enforce
  budgets; adjust them deliberately with the number recorded.
- **R5 — two places hold a condition's bytecode** (TypeScript `CompiledCondition`, the core's store).
  The store is a cache rebuilt from the definitions on arm/re-bind/machine change; `DebugSupport`'s
  existing "derived, not cached" lessons apply — rebuild the whole store rather than patching slots
  if in doubt.

## 8. Implementation notes (2026-10-03)

**What exists now.**
- `src/emu/z80/wasm/z80-condition.c` - the one evaluator: a stack machine over the §4.1 bytecode,
  `int64_t` values, "no value" as `INT64_MIN` with the NaN rules (E6), hooks `COND_REGISTER`,
  `COND_PEEK`, `COND_PEEK_PARTITION`, `COND_PEEK_BANK`, `COND_PARTITION_OF`, `COND_NEXTREG`. Every
  malformed program (format word, unknown op, stack under/overflow, truncated operand, backward or
  out-of-range jump, bad width, missing `END`) returns `COND_RESULT_ERROR`. Store: 256 slots, 16 384
  words, 1 024 words per program; exports `condArenaPtr`, `condArenaCapacity`, `condSlotTablePtr`,
  `condSlotCapacity`, `condMaxProgramWords`, `condGetToken`/`condSetToken`, `condGetLastStatus`,
  `condEvaluate`, `condEvaluateValue`.
- **Cores.** Included at the end of `sp48.c`, `sp128.c`, `spp3e.c`, `zxnext.c` and `z88.c` (each a
  single translation unit) with their hooks; the build scripts export the `cond*` names and the
  loaders require them (`CONDITION_CORE_EXPORTS`, `ConditionCoreExports` in
  `src/emu/machines/conditionStore.ts`). All five stay within their size budgets.
- **Hook details.** 48K: `sp48Memory`. 128K: `readMappedMemory`, ROM/RAM arrays,
  `sp128GetCurrentPartition`. +3E: the slot bases (not `spp3eReadMemory`, which latches the floating
  bus), ROM/RAM arrays, `spp3eGetCurrentPartition`. Next: `zxnextMemoryPeekMapped`, the
  `getMemoryPartition` layout and the `getWasmV2PartitionForPage` logic restated in C,
  `zxnextNextRegPeek`. Z88: `z88MemoryRead`, the `z88BankStorageOffset` mirroring; **`page()` on
  the Z88 is "no value"**, as before - the Z88 machine's `getPartition` does not report its paging
  (a pre-existing gap, not introduced here).
- **Front end.** `condition-bytecode.ts` (op table, `emitCondition`, `stackDepthOf`); the checker no
  longer folds and range-checks literal operands only (`literalValue`); it refuses a condition
  deeper than 64 or longer than 1 024 words. `condition-evaluator.ts` is deleted.
- **Emulator.** `DebugSupport.conditionStoreProvider` (set by `connectConditionSupport`, now in
  `conditionStore.ts`) gives the core's store; `syncConditionStore` rebuilds it whole when stale -
  a program compiled, re-bound or dropped (`storeDirty`) or a store not carrying the last token (a
  fresh core). `passesFilters` makes one `condEvaluate` call; no evaluator, no room, or an evaluator
  error all count as true (C15). A condition without room reports "the machine's condition store is
  full". Machines expose `getConditionStore()` (one store per runtime, `conditionStoreOf`);
  `getConditionContext` and `src/emu/machines/conditionContext.ts` are gone.

**Tests.** Unit tier: `test/debug/breakpoint-condition.test.ts` (front end: errors, warnings,
tokens, trees, the bytecode, limits). `e2e-cores` tier, all under `test/wasm/condition/`:
`condition-evaluation.test.ts` and `condition-access-matrix.test.ts` (every evaluation expectation
of the old suites, unchanged, plus malformed programs and "no value"), `condition-cores.test.ts`
(per core: every partition at its boundaries, the CPU view, the paging and the registers against
the TypeScript views; the +3E latch and the access log untouched), `debug-support-conditions.test.ts`
(`DebugSupport` on the standalone evaluator: store rebuilds, re-binding, 256-slot capacity,
freeing). The standalone build is `scripts/build-condition-wasm.cjs` → `condition-test.wasm`, whose
imports are the test's fake machine (`condition-host.ts`). The unit-tier guard recognises `cond*`
exports; `src/common/utils/breakpoint-condition` is an input of the `e2e-cores` tier.

**Expectations changed by E4** (no folding): `A == (1 << 8)` is accepted (was refused as out of
range); the folded-tree test became "leaves constant sub-trees to the C evaluator". No other
expectation changed.

**Defect found while porting:** removing a breakpoint did not mark the store stale, so a freed slot
was not reused until something else forced a rebuild; every place that drops runtime state now does.

**Performance** (48K, the §1 loop, steady state):

| Breakpoint at the looped address | before | after |
|---|---|---|
| none | 389 ns | ≈410 ns |
| hit rule only | 498 ns | ≈550 ns |
| register condition | ≈2 500 ns | ≈550 ns |
| memory condition | ≈2 500 ns | ≈575 ns |

A condition now costs ≈150 ns over a bare pass instead of ≈2 100 ns; the remaining per-instruction
cost is the TypeScript debug loop itself (§4.5).

## 9. Questions and answers (2026-10-03)

1. **Dropping constant folding - consequence?** Folding has three uses today. String folding (packing
   `"KLIV"` into the number a 4-byte access reads) is byte encoding, not evaluation, and **stays**.
   Speed is **unaffected** in practice (a constant sub-expression costs a few bytecode steps per
   evaluation). The one real loss is §3.7 rule 3 for **computed** constants: `A == 255 + 1`,
   `A == (1 << 8)`, `sb[IX] == s8($80) - 1` would be accepted and simply never be true, where today
   they are refused. Literal operands - `$1234`, `300`, `-1`, `'A'`, `@B5` - stay checked, since none
   needs evaluation. **Recommended (E4): drop folding.** It keeps the front end free of any evaluation
   and spares the IDE a WASM module. *Accepted by the author.*
2. **Where the evaluation tests run:** the `e2e-cores`-style tier (answered).
3. **The stop decision in C:** "as you find it better, easier, more straightforward" (answered) -
   **not in this plan** (E9, §4.5): the straightforward route with most of the gain, revisited only if
   a measurement calls for it.
4. **Store capacity:** 256 conditions (answered); E7 sizes the arena for it.
