# Klive BASIC: String ownership

Design note R11-3 of `.plans/ZXBASIC_COMPILER_PLAN.md` (§6.7, §17.2 R11). **Status: draft,
awaiting the project author's approval. No Phase 3 code before that.**

Strings are the one part of Klive BASIC where a code-generation mistake does not show up as a
wrong value but as a slow leak, a double free, or a read of freed memory that corrupts the heap
much later. This note fixes who owns every String value at every point, the MIR rules that encode
it, and the checks that catch a mistake in the compiler's tests rather than in a user's program.

## 1. The facts it builds on

- A String value is a pointer to a heap block `[length:2][characters]`, or **0 for the empty
  string** (`runtime-abi.md` §2.2). `core.Free` of 0 does nothing, so 0 is always safe to free.
- String literals live in the program image, never on the heap.
- The heap (`heap.kz80.asm`) allocates first fit and coalesces on free. A failed allocation returns
  0 (the empty string) or, with `check-memory`, stops with report 4.
- The Phase 0 string routines (`strings.kz80.asm`) consume operands through **free flags** in A:
  bit 0 frees the first operand (HL), bit 1 the second (DE), after the result is built. `StrStore`
  takes ownership of its value and frees the variable's old one.
- The user-visible ABI (plan §6.7): a by-value String argument is a copy the caller hands over
  and the callee frees; a returned String belongs to the caller.

## 2. Ownership

Every `str` vreg in the MIR has one of two ownerships, fixed where it is defined:

| Ownership | Produced by | Obligation |
| --- | --- | --- |
| **owned** | anything that allocates: `strcat`, `strslice`, `strchar`, `strdup`, `CHR$`, `STR$`, `INKEY$`, `INPUT`, a FUNCTION returning String, `READ` into a String | consumed **exactly once** on every path |
| **borrowed** | `load` of a String variable, parameter or element; a literal; a String constant | never freed; not used after anything that may change its source (§4) |

**Consuming** an owned value means one of:

1. storing it (`strstore` into a variable or element: the store owns it now);
2. passing it by value to a SUB or FUNCTION (the callee owns it now);
3. returning it from a FUNCTION (the caller owns it now);
4. handing it to a runtime routine with its free flag set (`strcat`, comparisons, `PrintStr`,
   `LEN`, `CODE`, `VAL`, …: the routine frees it after use);
5. `strfree`.

A borrowed value is turned into an owned one with `strdup` wherever an owned one is needed
(assignment copies; a by-value argument is a copy the callee will free).

## 3. The rules per construct

| Construct | Lowering |
| --- | --- |
| `a$ = expr` | evaluate `expr` to an owned value (`strdup` a borrowed one), then `strstore a$` (frees the old value **after** taking the new one, so `a$ = a$` and `a$ = a$ + "x"` are safe) |
| `a$ = b$ + c$` | `strcat` with borrowed operands (flags 0) produces an owned result; store it |
| `a$ + f()` | `f()` is owned, `a$` borrowed: `strcat` with only the second flag set |
| `a$(i TO j) = v$` | `strsliceassign` overwrites the characters in place (the length never changes); `v$` is consumed with its flag |
| comparison `a$ = b$` | `cmp` consumes owned operands through its flags; the result is a `bool` |
| `PRINT s` | `PrintStr` with the free flag of `s` |
| `LEN(s)`, `CODE(s)`, `VAL(s)` | the runtime routine takes the free flag; a routine without one (Phase 0's `StrLen`) is followed by `strfree` when `s` is owned |
| argument by value | owned: passed as it is; borrowed: `strdup` first |
| argument BYREF | the address of the variable; nothing is copied or freed |
| `RETURN s` in a FUNCTION | owned: stored in the result slot; borrowed: `strdup` first (a local's value is freed by the epilogue, so returning it without a copy would return freed memory) |
| a String result nobody uses (`f()` as a statement) | `strfree` right after the call |
| local String variables | zeroed at entry (empty); the epilogue frees each |
| by-value String parameters | the epilogue frees each |
| local String arrays | the epilogue frees every element, then the data block |
| global Strings and String arrays | live for the whole program; never freed |
| `READ s$`, `INPUT` | produce an owned value that is stored |

## 4. The hazard: a borrowed value whose source changes

A borrowed value is only a copy of a pointer. If the variable it came from is assigned while the
borrowed value is still waiting to be used, the old block is freed and the borrowed pointer
dangles. Within one statement this can happen only through code that runs between the load and
the use:

```basic
a$ = a$ + Change()      ' Change assigns a$ — the loaded a$ is freed before strcat reads it
```

**Rule B1.** In a statement that runs user code while it evaluates — a FUNCTION called within an
expression, or a `READ` (DATA items may be expressions that call FUNCTIONs, evaluated when `READ`
runs) — a borrowed String that is evaluated **before** the last such call and used after it is made
owned (`strdup`) where it is loaded, unless it is a local variable or by-value parameter of the
current routine, which no callee can reach. BYREF parameters and globals are always copied in that
situation.

Right-to-left argument evaluation (MIR note Q1) is taken into account: "before" is in evaluation
order, not source order.

**Rule B2.** Lowering evaluates an assignment's whole right side before the store, so the store
never frees something the right side still needs.

## 5. The linearity check

A MIR verifier pass (`verify`, MIR note §7) checks, for every function:

- every owned vreg is consumed **exactly once** on every path from its definition (the MIR's
  terminators give the paths; at levels 0–1 a vreg never leaves its statement, so the check is
  local);
- no borrowed vreg is freed, stored with ownership, or passed where an owned value is required
  without a `strdup`;
- B1 holds: no borrowed global or BYREF String is live across a user call.

A violation is a **compiler bug**: the verifier throws in tests and in debug builds of the
compiler, and is skipped in release builds only for speed.

## 6. Leaks at run time: the heap check

The tests add a run-time check (plan §13.2): the 48K harness's `heapUsed()` (already in
`test/kbasic/runtime/runtime-kit.ts`) after a program ends must equal the bytes held by its global
Strings and String arrays at that moment — nothing else may be live. Every corpus program is run
this way at every optimisation level, and a set of targeted programs exercises each row of §3,
each B1 case, recursion with local Strings, and early `RETURN`s from nested loops.

## 7. What the rules do not cover

- **Errors stop the program.** A runtime error or `STOP` leaves temporaries allocated; the program
  is over, so nothing is leaked into later execution. (There is no `ON ERROR` in the language.)
- **`END` inside a routine** skips epilogues for the same reason.
- **Inline `ASM`** that changes a String variable must follow the ABI (store through `core.StrStore`
  or free the old value itself); the compiler cannot check it.
- **Interrupt handlers written in BASIC** (IM2 via the stdlib) that assign global Strings can
  invalidate a borrowed value of the interrupted statement. B1 does not cover this; the stdlib's
  IM2 documentation will say that handlers must not assign Strings the main program uses.

## 8. Decisions for the author

| # | Question | Proposal |
| --- | --- | --- |
| O1 | Copy-on-load for B1, or keep borrowed values and reload after calls? | Copy (`strdup`) where B1 applies: simple, provably safe, and the cost is one allocation in statements that already make a call. |
| O2 | Should a statement like `a$ = a$ + "x"` avoid the copy (append in place)? | Not in Phase 3. A later optimisation (`StrAppend`: grow the block when it is last on the heap or has room) can do it without changing the ownership rules. |
| O3 | Returning a local String variable | `strdup` at `RETURN` in Phase 3; Phase 7 may turn it into a move (clear the local's slot instead of copying) when the local is dead after the `RETURN`. |
| O4 | IM2 handlers that assign Strings (§7) | Document it as unsupported rather than make every String load in the main program pay for it. |
