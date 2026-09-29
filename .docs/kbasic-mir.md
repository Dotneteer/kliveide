# Klive BASIC: the MIR (mid-level intermediate representation)

Design note R11-1 of `.plans/ZXBASIC_COMPILER_PLAN.md` (§3.1, §7, §8.2). **Status: approved by the project author on 2026-09-26, with every proposal in the decisions table below.**

The MIR sits between the typed tree the binder produces (`src/main/kbasic/semantics/bound.ts`)
and instruction selection (`kbasic-lir-regalloc.md`). Lowering turns each routine into a MIR
function; the optimiser (Phase 7) rewrites MIR functions; instruction selection turns them into
LIR. This note fixes the MIR's shape, instruction set, typing, statement-id rules and the lowering
of every BASIC construct. String values have their own note (`kbasic-string-ownership.md`); how
statement ids become debug tables is in `kbasic-debug-builder.md`.

## 1. Principles

1. **Variables live in memory; temporaries live in virtual registers.** Lowering reads and writes
   every BASIC variable with explicit `load`/`store` instructions. Virtual registers (vregs) hold
   only the intermediate values of expressions. This is LLVM's "memory form": correct by
   construction, trivially debuggable, and it makes statement boundaries real barriers at
   levels 0 and 1 without any bookkeeping.
2. **SSA for vregs from the start.** Every vreg is defined exactly once. At levels 0 and 1 no vreg
   is used outside the statement that defines it (the verifier checks this), so no phi is ever
   needed there. At level 2 a promotion pass (`promote`, §7) turns suitable local variables into
   vregs with phis, and SSA destruction before instruction selection turns phis back into copies.
3. **One function per activation kind**: the main program, each SUB and FUNCTION. GOSUB
   subroutines are not functions: they are blocks of the main program entered by a `gosub`
   terminator (§5.6), because BASIC lets them share the main program's code and variables.
4. **Every instruction carries a statement id** (§4). Nothing downstream may create an instruction
   without one.
5. **The MIR says what, not how.** Runtime routines, calling conventions and register constraints
   are instruction selection's business. A PRINT item is a `rtcall` to a named runtime entry with
   typed operands; which registers carry them is decided later from the runtime call table.

## 2. Types

| MIR type | BASIC types | Size | Notes |
| --- | --- | --- | --- |
| `i8` / `u8` | Byte / UByte | 1 | |
| `i16` / `u16` | Integer / UInteger | 2 | |
| `i32` / `u32` | Long / ULong | 4 | |
| `fix` | Fixed | 4 | 16.16 |
| `flt` | Float | 5 | the ROM format |
| `str` | String | 2 | a heap pointer or 0; has an ownership (see the string note) |
| `bool` | internal Boolean | 1 | always 0 or 1 in a vreg |
| `ptr` | addresses | 2 | `@x`, element addresses, BYREF parameters, array descriptors |

Signedness is part of the type, so `div`, `mod`, `shr`, comparisons and conversions need no
separate signed/unsigned opcodes. Every instruction's operand and result types are checked by the
verifier; implicit conversions do not exist in MIR (the binder already made them explicit as
`convert` nodes, which lower to `conv`).

## 3. Structure

```
Module
  globals      symbols from the binder (storage "global"), string literals, DATA table
  functions    main, then every SUB/FUNCTION in source order
Function
  name, kind (main | sub | function), convention (stdcall | fastcall), params, return type
  frame        its local slots: user locals, hidden locals (FOR limits, ...), each typed.
               The main program has no frame: its hidden slots are static (one per FOR),
               like the globals it loops over, so a GOSUB that re-enters the same FOR shares
               them exactly as it shares the loop variable.
  blocks       basic blocks; the first is the entry
Block
  label, instructions, one terminator
Instruction
  op, result vreg (if any), operands, type, sid (statement id), flags
```

Operands are vregs, immediate constants (`Constant` from `semantics/constants.ts`, so a folded
Float keeps its exact five bytes) or **slots**:

| Slot | Meaning |
| --- | --- |
| `global(sym)` | a global variable, or a mapped one (`DIM … AT`) |
| `local(slot)` | a frame slot of the current function |
| `param(i)` | parameter i (by value: the value; BYREF: the address) |
| `deref(%p)` | the value at the address in a `ptr` vreg (BYREF access, elements, `PEEK` typed) |

## 4. Statement ids

A **sid** identifies one BASIC statement, or one separately executing part of a block statement
(plan §8.2). Lowering assigns sids in source order and records each in the statement table
(`kbasic-debug-builder.md` §2): file, span, kind, function.

| Construct | Parts with their own sid |
| --- | --- |
| `IF c THEN … ELSEIF c2 … ELSE … END IF` | the `IF c` condition; each `ELSEIF c2` condition. `ELSE` and `END IF` have none. |
| `FOR i = a TO b STEP s … NEXT i` | the `FOR` (initialisation and first test); the `NEXT` (increment and test) |
| `WHILE c … WEND` | the `WHILE c` test (evaluated at every iteration; the back edge targets it) |
| `DO … LOOP UNTIL c` and the other tested forms | the test (`DO WHILE c` or `LOOP UNTIL c`) |
| `DO … LOOP` (untested) | `LOOP` (a jump back); `DO` has no code and no sid |
| `SUB`/`FUNCTION` | the header gets none; `END SUB` / `END FUNCTION` gets the epilogue's sid |
| everything else | the statement |

Special values: **`-1`** = compiler glue and runtime (prologue, the jump from a statement into a
shared epilogue, trampolines, and the jump of a block that holds nothing else, such as the join
after an IF or a loop's way back after an `EXIT`: only branches reach it, so tagging it with the
statement before it would put a branch target inside that statement); **`-2`** = shared by several
statements after optimisation (§7).

Rules every pass must keep (the verifier checks them):

- **S1** — every instruction has a sid.
- **S2** — at levels 0 and 1, a vreg is used only by instructions with the sid of its definition.
- **S3** — the first instruction executed for a sid is the first instruction of that sid in its
  block, and control enters a sid only there (the entry). A jump into the middle of a sid's
  instructions from another sid is forbidden. The debug builder's validator checks the same after
  assembly (plan §8.2, G1–G2).
- **S4** — a pass that merges instructions of different sids gives the result `-2` or the sid of
  the statement that dominates it; a pass that moves an instruction out of a loop keeps its sid
  and sets the `hoisted` flag.
- **S5** — a statement that ends with no instruction left (an assignment to a variable the
  optimiser removed) keeps a zero-length `stmt` marker (§6) so the debug builder can record it as
  `elided`.

## 5. Instructions

`%v` is a vreg, `T` a MIR type, `S` a slot.

### 5.1 Values

| Instruction | Meaning |
| --- | --- |
| `%v = const T k` | a constant (numbers, `str` literal label, address constant `@x+n`) |
| `%v = load T S` | read a variable |
| `store T S, %v` | write a variable (a `str` store has its own rules: string note) |
| `%v = addr S` | the address of a slot (`@x`, BYREF arguments) |
| `%v = copy %w` | only after SSA destruction |
| `%v = phi [b1: %a, b2: %b]` | only after `promote` (level 2) |

### 5.2 Arithmetic and logic

| Instruction | Types | Notes |
| --- | --- | --- |
| `add sub mul` | integral, `fix`, `flt` | integral results wrap |
| `div mod` | integral, `fix` (`div` only), `flt` (`div` only) | integral: truncates towards zero; remainder takes the dividend's sign; a zero divisor gives every bit set / the dividend (runtime rule, R8 `integer-division-by-zero`) |
| `pow` | `flt` | |
| `neg` | signed integral, `fix`, `flt` | |
| `and or xor not` | integral | bitwise (`bAND`…) |
| `shl shr` | integral left, `u8` count | `shr` on a signed type is arithmetic (R8 `shr-signed`) |
| `cmp.eq ne lt le gt ge` | any, both operands the same type | result `bool`; `str` comparisons consume their operands (string note) |
| `band bor bxor bnot` | `bool` | the logical `AND`/`OR`/`XOR`/`NOT` after both sides are made `bool` (`ne 0`) |
| `conv T` | numeric → numeric | the spec's conversions; float/fixed → integral truncates towards minus infinity, the same rule constant folding uses (`convertConstant`), so folded and computed values agree |

### 5.3 Arrays

| Instruction | Meaning |
| --- | --- |
| `%p = elem S, %i1, …, %in` | the address of an element (row-major, bounds from the descriptor; with `check-bounds`, a failing subscript raises report 3, "Subscript wrong") |
| `%v = bound lower/upper S, %d` | `LBOUND`/`UBOUND` with a run-time dimension (constant ones were folded) |
| `arrcopy S1, S2` | whole-array assignment |
| `arralloc S` / `arrfree S` | a local array's data at routine entry / exit |

### 5.4 Strings

`strcat`, `strcmp` (as `cmp.*` on `str`), `strslice`, `strchar`, `strdup`, `strfree`, `strstore`,
`strsliceassign`, `strlen`, `strcode`. Their operands and results carry ownership; the string note
defines them.

### 5.5 Calls

| Instruction | Meaning |
| --- | --- |
| `%r = call R(args)` | a SUB or FUNCTION; `args` are values, or `byref` addresses; defaults are materialised by lowering. Carries a **call-site record** (kind, callee, `moreCallsFollow`, order) for the debugger (plan §10.2.2, G5). |
| `%r = rtcall core.X(args)` | a runtime routine; its register contract comes from the runtime call table (the runtime modules' headers, extended with operand types) |
| `%r = builtin NAME(args)` | a built-in that instruction selection may expand inline or turn into a `rtcall` (`PEEK`, `IN`, `ABS`, `CODE`, …) |
| `asm "text…"` | an inline `ASM` block: opaque, clobbers every register and every global, keeps its sid |

### 5.6 Terminators

| Terminator | Meaning |
| --- | --- |
| `jmp B` | |
| `br %c, Bt, Bf` | on a `bool` |
| `switch %sel, [B0, B1, …], Bdefault` | `ON … GOTO`: selector 0 takes the first target; out of range continues (R8 `on-goto-out-of-range`, open) |
| `gosub L, Bnext` | calls label L of the main program; `RETURN` comes back to `Bnext`. Carries a call-site record. |
| `ongosub %sel, [L0, …], Bnext` | the compiler's own `ON … GOSUB` dispatch, so every target is a recorded call (G5) |
| `ret [%v]` | returns from a function, or (main program, inside a GOSUB subroutine) from `GOSUB` |
| `end %code` | `END n`: never returns |
| `raise %code` | `ERROR n`, `STOP`: never returns |

## 6. Markers

Zero-size pseudo-instructions that instruction selection passes through as labels:

- `stmt sid` — the entry of a statement. Lowering emits one at the start of every sid's code. It
  anchors the entry address even when the statement produced no code (S5).
- `prologue.end`, `epilogue.begin` — the frame boundaries the debugger needs (`bodyStart`,
  `epilogueStart`, plan §8.4).
- `label L` — a BASIC label or line number (a jump target).

## 7. The pass list

Plan §7.2 gives the passes per level. The MIR adds what they need:

| Pass | Levels | MIR-specific notes |
| --- | --- | --- |
| verify | all (tests; debug builds) | types, SSA, terminators, S1–S5, string linearity |
| fold | all | the binder already folded constant expressions; this folds what lowering creates (element offsets with constant subscripts, `conv` of constants) |
| promote | 2–3 | locals and by-value parameters of STDCALL functions whose address is never taken and which contain no `asm`: `load`/`store` become vregs with phis. Globals, BYREF parameters and mapped variables are never promoted (inline asm, interrupts and `USR` code can see them). |
| the plan's passes 3–10 | 1–3 | at level 1 they run per statement, respecting S2 |
| ssa-out | 2–3 | phis to copies before instruction selection |

## 8. Lowering the typed tree

Order of evaluation, and the choices it implies, are listed as questions in §10.

### 8.1 Expressions

Straightforward recursion over `BoundExpr`: `constant` → `const`; `variable` → `load`;
`element` → `elem` then `load deref`; `convert` → `conv`; `binary` → the operand-typed
instruction; `call` → `call`; `builtin` → `builtin` or `rtcall`. Logical `AND`/`OR`/`XOR` evaluate
both operands (no short-circuit, question Q2).

### 8.2 Assignment and DIM

`store T S, %v`; element targets through `elem`. A `dim` statement with a value is an assignment;
a local's `dim` without a value lowers to nothing (locals are zeroed at entry by the prologue).
Static initial values (`symbol.initial`) are emitted as data, not code.

### 8.3 IF

```
stmt s_if ; %c = … ; br %c, then, next_test
then:  … ; jmp after
next_test: stmt s_elseif ; …          ; one per ELSEIF
else:  …
after:
```

### 8.4 FOR

The limit and step are evaluated **once**, at the `FOR`, into hidden slots (frame slots in a
routine, static ones in the main program; question Q3).
The variable is the user's variable (a slot, not a vreg, so the debugger sees it).

```
stmt s_for ; store i, from ; store lim, to ; store step, s ; test: br (i beyond lim), exit, body
body:  …
stmt s_next ; store i, i + step ; br (i beyond lim), exit, body
exit:
```

"Beyond" is `i > lim` for a positive step and `i < lim` for a negative one; a step whose sign is
not constant is tested at run time. Overflow of the variable's type wraps, as the spec warns.

### 8.5 WHILE and DO

The test's sid owns the test block. The back edge targets the test's entry, so each iteration is a
statement entry (plan §10.3, re-entry stops). An untested `DO … LOOP` jumps back to the first
statement of its body, or to the `LOOP` itself when the body is empty.

### 8.6 EXIT and CONTINUE

`jmp` to the loop's exit block, or to its `NEXT` / test block.

### 8.7 GOTO, ON GOTO, labels

`jmp` / `switch` to the block that starts at the label. A label starts a new block.

### 8.8 SUB and FUNCTION

Parameters are `param(i)` slots; locals are frame slots. `RETURN` jumps to the epilogue block,
whose sid is `END SUB`/`END FUNCTION`'s. A FUNCTION's `RETURN v` first stores `v` in a hidden
result slot, so there is a single `ret %v` in the epilogue.

### 8.9 GOSUB and RETURN

`gosub L, Bnext`. At global scope `RETURN` is `ret`. The subroutine's statements belong to the
main function; the activation is visible to the debugger through the call-site record.

### 8.10 PRINT and the other statements

Each item is one or more `rtcall`s (`PrintStr`, `PrintU16`, `PrintAt`, …). Attribute modifiers
inside PRINT set temporary colours and end with `PrintReset`. `READ` is a `rtcall` per target with
the target's type. `DATA` emits the DATA table (its format is Klive's own, plan §6.1) and no code.

## 9. Text form and tests

Every function prints as text (used by goldens, `'@emit-ir` and the verifier's messages):

```
function Fact(n: i16 = param 0) -> i16  stdcall
  frame: result i16
b0:
  stmt 12                                  ; IF n <= 1 THEN
  %1 = load i16 param 0                    ; s12
  %2 = cmp.le i16 %1, 1                    ; s12
  br %2, b1, b2                            ; s12
b1:
  stmt 13 …
```

Tests (plan §13.1): a golden per construct (BASIC → MIR text), per-pass before/after goldens, and
the verifier run on every compiled test program.

## 10. Decisions (approved as proposed)

| # | Question | Proposal |
| --- | --- | --- |
| Q1 | Evaluation order of arguments | **Right to left** (last argument first), because STDCALL pushes the last argument first and evaluating in push order needs no temporaries. Operands of binary operators left to right. Observable only when calls have side effects; confirm with the oracle (R8 `argument-evaluation-order`). |
| Q2 | Are `AND`/`OR` short-circuit? | **No**: both sides are evaluated, as a numeric operator. An optimisation may skip the right side only when it has no side effects. Confirm with the oracle (R8 `logical-operators-short-circuit`). |
| Q3 | FOR: limit and step evaluated once or every iteration; the variable's value after the loop | **Once**, at the `FOR`; after a normal exit the variable holds the first value beyond the limit. R8 `for-loop-evaluation` is open (Phase 4); Phase 3 implements this proposal. |
| Q4 | Memory form with promotion only at level 2 | Keeps levels 0–1 simple and makes G4 hold by construction; costs speed at level 1 (every variable access goes to memory). Alternative: promote per statement at level 1 — little gain, since variables rarely repeat within one statement. |
| Q5 | The main program's variables are globals, never promoted | Upstream's model (globals are visible to asm and interrupts). The main program's loops therefore keep their counters in memory at every level; Phase 7 may add a narrower promotion for main-program globals that no asm, call or interrupt handler can see. |
| Q6 | Runtime conversion Float → integral | Truncate towards minus infinity (as constant folding does). If the oracle shows upstream truncates towards zero at run time, both the folder and the runtime change together. |
