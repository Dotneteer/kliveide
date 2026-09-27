# Klive BASIC: the optimiser (Phase 7)

Design note for plan §7 (optimisation), §8.6 (the debug profile) and §7.5 / §10.3 (optimisation and
debug information), written before any Phase 7 code as R11 asks. It builds on the approved notes:
the MIR's memory form, `promote` and the statement-id rules S1–S5 (`kbasic-mir.md` §1, §4, §7),
and the LIR, the level-0 stack machine and linear-scan allocation (`kbasic-lir-regalloc.md` §4–§5).
Section 9 lists the decisions this note asks the project author to approve.

## 1. What must not change

Every level produces a program that behaves exactly as level 0 does — the same screen, memory,
errors and heap — and that the debugger can still follow. Level 0 stays the reference and is never
optimised. The debugger relies on these facts (Phase 5, Phase 6), so each is a hard constraint on
every pass, checked by tests rather than by review:

| Fact | Relied on by | Kept at |
| --- | --- | --- |
| **G1/G2** — one entry per statement, reached only by entering it | breakpoints, stepping, the validator | all levels; a statement that loses its entry is `merged` (§5) |
| **G4** — SP is the activation's baseline at every statement entry | Step Over/Out, the frame locator | all levels |
| **G5** — every user call is one Z80 `call` with a call-site record | stepping over calls, the call stack | all levels (no inlining of a call without removing its site, §4.3) |
| **G6** — a FUNCTION's result is in its ABI registers at the `ret` | returned values | all levels |
| **Every SUB and FUNCTION builds an IX frame** (`push ix; ld ix,0; add ix,sp`) | the locator (`IX + 2` is the return slot), Variables (locals at `IX + offset`) | all levels (O2) |
| **Frame layout** — `returnSlotOffset = frame + 2`, `argBytes`, locals at their recorded offsets | the locator, Variables | all levels; spill slots are added *below* the locals |
| **Variables in memory at their recorded addresses** | Variables panel, watches, data breakpoints later | levels 0–1 always; level 2–3 per §5.2 |
| **Runtime and CODEBANK conventions** (trampolines, `FarCall`, `core.X` register contracts) | everything | untouched: the optimiser works on user code only |

## 2. Levels (plan §7.1, made concrete)

| Level | MIR | LIR | Boundary rule |
| --- | --- | --- | --- |
| 0 | none | the stack machine (unchanged) | — |
| 1 | per statement: fold, algebraic simplification, strength reduction, narrowing, dead code inside a statement | per-statement register allocation; peephole rules that do not cross a `stmt` marker; branch shaping | statement boundaries are barriers (S2) |
| 2 | promote (locals and by-value parameters of STDCALL routines), then SSA passes over the routine: constant/copy propagation (SCCP), CSE, dead code and dead stores, branch folding, jump threading, simple LICM, unused routines and globals | routine-wide linear scan; all peephole rules, cross-statement ones included; tail calls | a value may live in a register across statements; statements keep their entries unless merged (§5) |
| 3 | adds inlining of small leaf FUNCTIONs and SUBs, loop strength reduction, FASTCALL conversion of internal leaf routines whose address is never taken | cross-block peephole | as level 2 |

`optimize-for` (`size` / `speed` / `balanced`) is an input to the rule cost model (§4.2) and to the
inlining threshold (level 3), not a separate pass list.

## 3. MIR passes

Each pass is a function `(fn: MFunction, ctx) => boolean` (changed or not) in `src/main/kbasic/opt/`,
with a table of passes per level in `opt/pipeline.ts`. The MIR verifier (`kbasic-mir.md` §7) runs
after every pass in tests and debug builds, so a pass that breaks S1–S5, SSA or types fails at once
with the pass's name.

- **Level 1 passes see one statement at a time**: they get the instructions between two `stmt`
  markers and may not move anything across one. That is what keeps level 1 "debug-friendly" without
  extra bookkeeping.
- **`promote` (level 2)** exactly as `kbasic-mir.md` §7 defines it, with one addition: a promoted
  variable keeps its frame slot, and the pass records for the debug builder which statements hold
  its current value only in a vreg (§5.2).
- **Type narrowing** (plan §7.2 step 5) is a MIR pass: an operation whose operands and result
  provably fit in 8 bits is rewritten in `u8`/`i8`, with a `conv` at the edges. FOR loops over UByte,
  attribute arithmetic and array indices are the targets.
- **Unused-routine removal** reuses the reachability the library already has (plan Phase 4: unreached
  library routines are not generated) and extends it to the user's routines at level 2; W170 is
  already reported by the binder.
- **Folding** reuses the binder's constant evaluator (and `float40` for Float, bit-exact with the ROM),
  so folded and run-time results agree by construction.

## 4. LIR: allocation, rules, branch shaping

### 4.1 Allocation

As `kbasic-lir-regalloc.md` §5 describes; the frame keeps its IX (O2), spill slots go below the
locals and are zeroed with them, and the main program and FASTCALL routines use in-statement
`push`/`pop` at level 1 (G4 holds because every push has its pop inside the statement). The level-0
stack machine stays as the code generator of last resort: an expression the level-1 selector does not
cover falls back to it, statement by statement, so Phase 7 can grow coverage gradually and every
program always builds.

### 4.2 The peephole rule engine

Rules are data in TypeScript, one file per group (`opt/rules/loads.ts`, `branches.ts`, `flags.ts`,
`z80n.ts`, …):

```ts
type Rule = {
  name: string;                     // "ld-store-reload": ld (x),a ; ld a,(x) → ld (x),a
  levels: 1 | 2;                    // 1: may run at level 1 (never across a stmt marker)
  targets?: ("z80" | "z80n")[];     // z80n-only rules (mul d,e, add hl,a, ...) for target next
  match: LirPattern[];              // instruction shapes, with named operand captures
  when?: (m: Match, ctx: RuleContext) => boolean;   // liveness of registers and flags, ranges
  replace: (m: Match) => LirInstr[];                // sids: the first matched instruction's (S4)
  cost?: (before: LirInstr[], after: LirInstr[]) => { bytes: number; tstates: number };
};
```

- `RuleContext` gives register and flag liveness after the window (computed once per function, updated
  as rules fire), the target, and `optimize-for`.
- The engine applies rules to a fixed point per basic block; a rule fires only when its replacement
  is not worse under the strategy's cost (size: bytes, then T-states; speed: the reverse; balanced:
  a weighted sum).
- **A rule may never** drop or move a `stmt` marker, a call carrying a call-site record, a
  `prologue.end`/`epilogue.begin` marker, or an instruction of the epilogue before `ret` that G6
  depends on. The engine enforces this (such instructions are "pinned" and a pattern cannot consume
  them), so individual rules need not remember it.
- Each rule has a before/after unit test and one corpus-style execution check (plan §7.3, §13.1).

### 4.3 Tail calls and inlining versus G5

A tail call (`call f; ret` → `jp f`) removes a return address the debugger would find, so it is done
only at level 3 and only when the calling routine's `ret` has no call-site record — never for a
user call (G5); in practice it applies to calls of runtime routines. Inlining (level 3) removes the
call site together with the call: the inlined statements keep their own sids, flagged `inlined` with
the callee's callable index, so the call stack can show a synthetic frame for them (§5.3).

### 4.4 Branch shaping

After allocation and rules, instruction sizes are known exactly (the instruction-length table
already covers Z80N), so `jp` → `jr` and `djnz` are decided before assembly, iterating to a fixed
point because shortening one branch can bring another in range. Branches to a statement's entry keep
targeting the entry (G2).

## 5. Debug information at levels 1–3 (plan §7.5, §10.3)

### 5.1 Statements

- Levels 0–1: unchanged; every statement has its own entry.
- Levels 2–3: a statement whose code was merged into a neighbour's or removed keeps a zero-length
  `stmt` marker; the builder records it `elided` (no code) or `merged` (its entry is shared). Stepping
  stops at the first surviving entry; the status bar says "optimised: statements merged" while
  paused in such code (plan §10.3). Code shared by several statements has sid `-2`, which the
  debugger treats like runtime code.
- Hoisted code (LICM) keeps its sid with a `hoisted` flag; it is not an entry.

### 5.2 Variables

At levels 0–1 every variable is in memory at its recorded address whenever a statement starts, as
today. At level 2 a promoted local may live only in a register for a range of statements. This note
proposes **not** to build location lists in Phase 7: a promoted local's Variables row says "optimised"
(with the value when the builder can prove the slot is current, which it records per statement), and
the debug profile (§6) keeps debug builds at level 1, where the question does not arise. Location
lists can come later if level-2 debugging turns out to matter (O3).

### 5.3 Call stack

G4 and IX frames hold at every level, so the frame locator is unchanged. Inlined callees (level 3)
appear as synthetic frames without a return slot, taken from the `inlined` flag of the statement PC
is in.

## 6. The debug profile (plan §8.6, D11)

`klive.debug` (and `debug` from the IDE) compiles with optimisation capped at 1 unless the header
sets `'@optimize` explicitly; `run`, `inject` and export use the level as it is. The build output
states the effective level ("code generated at optimisation level 1 (the debug profile; the header
does not set '@optimize)"). The compiler learns the purpose through a new, optional
`IKliveCompiler.compileFile(filename, options?, profile?: "debug" | "build")` argument passed down
from the IDE's compile command (never inside `options`, which the Z80 assembler takes whole —
Phase 1 facts); compilers that do not know it ignore it (O6).

## 7. Tests and measurement

- **The level matrix** (plan §13.2): the corpus runner's `LEVELS` becomes `[0, 1, 2, 3]` as each
  level lands; every program meets its expectations, passes the debug-info validator and G4 at every
  level. The Next runner and the debugger corpus run at levels 0 and 1 (the debug profile's range),
  and the debugger corpus also at 2 for the checks that hold there (entries, call stack).
- **Per pass**: MIR before/after goldens; the verifier after every pass.
- **Per rule**: before/after LIR and an execution check.
- **The §10.2/§10.3 step scenarios** run at levels 0 and 1 (they already run at 0).
- **Measurement**: a script (`scripts/kbasic-opt-report.cjs`) builds every corpus program at each
  level and records code size and the T-states to the program's end on the harness into
  `test/kbasic/opt-baseline.json`; a test fails when a level gets worse than the recorded figures
  (a ratchet, like the type-error baseline). The plan's exit criterion "measurable size/speed gains
  on the corpus" is this report.

## 8. Staging

Each stage ends green (all execution tests at every level that exists, `build:check`, the IDE check)
and is committed on its own:

1. **7a — the framework**: `opt/` pipeline and the verifier hook, the rule engine with the load/store
   and branch groups, branch shaping, the measurement script and baseline; level 1 = level 0 code +
   peephole rules within statements.
2. **7b — level 1 proper**: the per-statement MIR passes, the level-1 selector with per-statement
   allocation (falling back to the stack machine per statement), the debug profile (§6).
3. **7c — level 2**: promote, the SSA passes, routine-wide allocation, cross-statement rules,
   `merged`/`elided`/`hoisted` in the debug info and the IDE's "optimised" states.
4. **7d — level 3**: inlining, loop strength reduction, FASTCALL conversion, tail calls of runtime
   calls, cross-block rules; the Z80N rule group (and, optionally, plan §6.2's Z80N runtime variants).

## 9. Decisions for approval

| # | Question | Proposal |
| --- | --- | --- |
| O1 | Staging | 7a–7d as §8, each stage green on its own; level 1 first, since the debug profile uses it. |
| O2 | Frame pointer | Keep the IX frame for every SUB and FUNCTION at every level: the locator and the Variables panel depend on it, and IX-relative access is what the code already uses. Frame-pointer omission is not planned. |
| O3 | Variables at level 2 | No location lists in Phase 7: promoted locals show "optimised" where their slot is not current; debug builds stay at level 1 through the profile. |
| O4 | Rule format | TypeScript rule objects with pattern shapes and a `when` predicate (§4.2), not a text DSL: typed, testable, no parser to maintain. |
| O5 | Pinned instructions | The engine, not each rule, protects `stmt` markers, call sites, frame markers and the epilogue's result registers. |
| O6 | Debug profile transport | A new optional `profile` argument on `IKliveCompiler.compileFile`, set by the IDE's debug command; never inside `options`. |
| O7 | Measurement | A committed size/T-state baseline per corpus program and level, with a ratchet test (§7). |
| O8 | Stack-machine fallback | The level-1 selector falls back to the level-0 scheme per statement for anything it does not cover yet, so every program builds at every level throughout Phase 7. |
| O9 | Main-program globals (MIR Q5) | Stay in memory at every level in Phase 7: inline asm, interrupts and `USR` code can see them. A narrower promotion for globals no asm, call or handler can reach is left for later. |

## 10. State after stage 7a (2026-09-27)

Approved as proposed (O1–O9). Done:

- `src/main/kbasic/opt/`: `lir.ts` (parses LIR text into opcode, operands, register uses/defs and
  side effects; anything unknown is conservative), `liveness.ts` (per-function control flow; at
  levels 0–1 nothing is live at a statement entry, except the `END SUB`/`END FUNCTION` entry, which a
  `RETURN` reaches with the result in registers), `engine.ts` (the rule engine and its protections),
  `rules/loads.ts` (store-reload, store-reload pair, immediate operand, dead instruction),
  `rules/branches.ts` (bool-branch, jump over jump, jump threading through glue, unreachable code),
  `pipeline.ts` (the rules per function, and branch shaping), `verify.ts` (the MIR verifier: S1,
  SSA, S2, jump targets).
- `codegen.ts`: from level 1 the MIR is verified, the rules run, and after the first assembly
  `jp` → `jr` where in reach, then the program is assembled again. `effectiveLevel` clamps levels 2–3
  to 1 until 7c/7d; the build output says so. The default level is 2, so default builds now get
  level-1 code.
- Tests: the corpus (48K and Next), the debugger corpus, the §10.2/§10.3 step scenarios and the
  CODEBANK step tests run at levels 0 and 1; `test/kbasic/opt/rules.test.ts` (each rule, the engine's
  protections, the MIR verifier on the corpus, every rule fires somewhere in it — the two rules that
  never did, `ld r,r` and push/pop folding, were dropped); `test/kbasic/opt/opt-report.test.ts` with
  `opt-baseline.json` and `scripts/kbasic-opt-report.cjs`; the IDE check passes on level-1 code.
- First figures (147 48K programs): level 0 31,360 bytes, level 1 29,283 bytes (−6.6%); T-states
  −0.3% (these programs spend their time in the runtime, the ROM and waits).

Learned: the level-0 selector's comparisons build a 0/1 in A through a stack round trip
(`push af … pop af ; ld l,a ; ld a,h ; ld h,l ; cp h`); the rules cannot reach that shape well —
the level-1 selector (7b) should produce the flags directly.

## 11. State after stage 7b (2026-09-27)

Done:

- **The tree selector** (`backend/select1.ts`) — level 1's code generator. The level-0 selector
  (`select0.ts`) splits every block into *runs* (the instructions between the block's start and the
  statement markers, where no value is live — G4) and gives each run to the tree selector first; it
  selects the run itself when the tree selector declines (O8). Accepted runs: values that form trees
  (each defined once, used once) of 8/16-bit constants, loads, stores, address constants, arithmetic,
  logic, comparisons and 8↔16-bit conversions; SUB calls and runtime calls with at most one computed
  argument as roots; jump, branch, END and the main program's RETURN. A call is only ever a root:
  inside a tree it could be reordered against the tree's loads. Leaves are used where they are
  (`cp 10`, `add a,(ix-2)`, `ld de,(_b)`, `cp (hl)` for a global); only an operation whose operands
  both need computing saves one on the stack. A branch on a comparison branches on the flags; a
  comparison used as a value is materialised (`sbc a,a / neg` for carry).
- **Strength reduction is in the tree selector**, not a MIR pass (a change to §3): the constant
  operands are in view there — constant shifts straight-line (whole bytes at once for 16-bit),
  multiplication by a constant as shift-and-add when that takes at most 8 steps, unsigned division
  and MOD by a power of two as shifts and masks.
- **MIR passes** (`opt/mir-passes.ts`): constant folding (into a `const` defining the same vreg),
  algebraic identities (`x+0`, `x*1`, `x AND -1`, … rename the result to the operand; `x*0` and
  `x AND 0` become 0 when x's tree is pure) and removal of unused pure integer instructions; the
  verifier runs after every pass.
- **The debug profile** (§6, O6): `IKliveCompiler.compileFile(filename, options?, profile?)`; the
  IDE's debug runs pass `debug` (`compileCode(context, profile)`, the main process forwards it, the
  ZX BASIC dispatcher too); Klive BASIC caps the level at 1 unless the header sets `'@optimize` (or
  NextBuild's `'!opt`), and says so in the build output.
- Tests: `test/kbasic/opt/level1.test.ts` (the passes, the selector's code shapes, the fall-back);
  the corpus program `integers/level1-shapes.zxbas`; the rule-coverage test now runs on level-1
  code (every rule still fires); the baseline is rewritten.
- Figures (148 48K programs): level 0 32,475 bytes, level 1 28,608 bytes (−11.9%); T-states −0.9%.

Not done in 7b, and why:

- **Register allocation across a statement's trees** (linear scan per statement, §4.1): the tree
  selector keeps one value in the accumulator and saves others on the stack; values do not stay in
  registers from one root to the next. A statement rarely has more than one root at level 1, so the
  gain is small until level 2 keeps values across statements — linear scan moves to 7c.
- **Type narrowing** (§3): the corpus's hot 8-bit code (FOR over UByte, attributes) is already 8-bit
  in the MIR; narrowing mixed 8/16-bit arithmetic needs the value ranges that SCCP (7c) provides.
- The tree selector declines Float, 32-bit, Fixed and String values and FUNCTION calls: those still
  get level-0 code (plus the 7a rules). They are most of what is left at level 1.

## 12. Stage 7c-1, and a change of order (2026-09-27, decided by the project author)

**7c-1 is done:** level 2 = the level-1 rules, then `opt/available.ts` (a forward pass that knows which
registers hold a variable's value or a constant and drops loads of values already held; facts are
forgotten at labels something refers to and at every store but its own; only program variables and
frame slots are tracked; stores are never removed), then the rules again without statement barriers.
Level 3 generates level-2 code. Figures: level 2 28,159 bytes (level 1 28,608).

**The order changed.** The measurements showed that what is left is mostly Float, String and 32-bit
code, which the tree selector declines, and that `promote` reaches only SUB/FUNCTION locals (O9 keeps
the main program's variables in memory). So:

1. **Next: widen the tree selector** to FUNCTION calls in expressions, 32-bit and Fixed values and
   Float, which pays at levels 1 and 2 alike.
2. **Then 7c's MIR passes** (promote, SCCP, CSE, branch folding) — **with write-back instead of the
   routine-wide linear scan of §4.1**: after the passes, a value that crosses a statement is written
   to a memory home (a promoted variable's own frame slot, else a hidden slot), so both existing
   selectors keep working unchanged and `available.ts` removes most of the reloads. Promoted
   variables then stay current in memory, so the Variables panel stays exact at level 2 (this
   supersedes O3's "optimised" rows). A linear-scan allocator for hot values can come later.

## 13. The tree selector widened (2026-09-27)

Step 1 of §12 is done. The tree selector (`backend/select1.ts`) now also takes:

- **FUNCTION calls in expressions** (a call is a node of the tree that uses its result). Wherever it
  would evaluate operands out of MIR order to keep a leaf in place — commutative swaps, `gt`/`le`
  swaps, two computed operands, stores through a pointer — it keeps MIR order when one side calls a
  FUNCTION and the other reads memory (`mayReorder`); `gt`/`le` then swap the registers, not the
  evaluation. Pinned by `routines/call-order-effects.zxbas`.
- **32-bit and Fixed values** in DE:HL: add/subtract with a leaf operand in place through BC, the left
  on the stack otherwise (as the arith32 routines take it), comparisons as flags, constant shifts,
  unsigned div/MOD by powers of two, conversions. A signed comparison with a variable on the right
  goes the stack way: flipping its sign bit between the two word subtractions would clear the low
  word's borrow (the bug `long/long-loop.zxbas` caught). Pinned by `long/level1-long-shapes.zxbas`.
- **Float** as level 0 computes it (the ROM calculator gives no better way), so runs holding Float
  values no longer fall back whole. Pinned by `float/level1-float-shapes.zxbas`.
- Two computed 8-bit operands are evaluated in MIR order (the left pushed): shorter than computing
  the right first, and never out of order. Right shifts past two bits (16/32-bit) use a `djnz` loop:
  straight-line code there costs more bytes than it saves time.

Figures (151 48K programs): level 0 35,524 bytes / 41.55M T-states; level 1 31,242 bytes (−12.1%) /
39.01M T-states (−6.1%); level 2 30,733 bytes / 38.99M T-states. Strings are the one value type still
left to level 0 (their ownership rules live in the runtime calls). Next: step 2 of §12, 7c's MIR
passes with write-back.

## 14. 7c: constant slots (2026-09-27)

Step 2 of §12 begins with SCCP's most valuable case, done in memory form (`opt/constant-slots.ts`,
level 2, before the per-statement passes): a slot the routine stores exactly once, with a constant,
holds that constant wherever the store dominates the load, and the load becomes the constant.
Slots: frame slots of routines whose address is never taken (locals, parameters, hidden temporaries;
one access type, no overlapping access), and the main program's hidden FOR slots (`__forlim<n>`,
`__forstep<n>`); never the main program's variables (O9), never in a routine with inline asm.
Dominance (an iterative analysis over the MIR's blocks; a GOSUB also reaches its return point) keeps
it exact: a load that can run before the store — the first time round a loop, a GOTO into a FOR
body — still reads memory. A user variable's store always stays (write-back); a hidden slot's store
and data go once nothing reads them. Pinned by `control/level2-constant-slots.zxbas` and
`level1.test.ts`.

With it, a FOR loop with a constant limit tests `cp 10` at every NEXT: the tree selector now writes a
branch on `a > k` as `a >= k + 1` (and `a <= k` as `a < k + 1`; unsigned `> 0` / `<= 0` as the zero
tests), keeping the constant the immediate operand. Only for branches: as a value, the swapped form
ends on carry, the cheapest flag to turn into 0/1.

Figures (152 programs): level 1 31,787 bytes; level 2 30,554 bytes (−15.7% against level 0's 36,244).
