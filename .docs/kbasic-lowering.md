# Klive BASIC: lowering the typed tree to MIR

How Klive BASIC's lowering (`src/main/kbasic/ir/lower.ts`) turns each BASIC construct into the shared
back end's MIR (`.docs/z80-backend-mir.md`). It was §8 of the MIR note, which became the back end's
when the back end was shared (`.plans/SHARED_Z80_BACKEND_PLAN.md`); the section numbers below keep
their original numbering. GOSUB lowers to `localcall`, ON ... GOSUB to a calling `switch`, END and
ERROR to `exit`, and every operation states BASIC's meaning (`src/main/kbasic/ir/types.ts`): integer
division truncates, `MOD` takes magnitudes, reals floor into integers, integers wrap.

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

