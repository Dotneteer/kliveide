# Klive BASIC — ZX BASIC Compatibility Plan

**Decision (project author, 2026-09-27):** Klive BASIC is to be **100% compatible with ZX BASIC**
(Boriel's `zxbc`, the 1.19 release the spec pins). This plan turns that into work. It extends
`.plans/ZXBASIC_COMPILER_PLAN.md` (the main plan) and, where the two disagree, **supersedes** it:
the Klive decisions recorded in the semantics annex where upstream behaves differently, including
the three the project author confirmed earlier the same day (MOD and division of negatives, literal
typing, FOR evaluating its limit once), are reversed by this decision.

**Status:** stage C0 done (2026-09-27): the DO…LOOP acceptance fixes. The §5 decisions are taken
(all proposals accepted; named arguments copied). **C1 done** (2026-09-27): oracle v2 and the bisect
helper; findings in §4.1. **C2 done** (2026-09-27, §4.2): 2,082 generated items over numbers, Strings
and the built-ins agree with zxbc apart from 75 recorded upstream faults and crashes. **C3
done** (2026-09-27, §4.3): evaluation order, named arguments, FOR, the runtime error model, the print
position on return, colours, POINT, USR of a String; PRINT's layout and the graphics agreed as they
were. **C4 done** (2026-09-27, §4.4): acceptance agrees with zxbc on 506 programs apart from recorded
faults. **C5 done** (2026-09-27, §4.5): zxbasm is the default inline-asm dialect, zxbc's FASTCALL
and register contracts hold, and NextLib compiles and runs as zxbc builds it. **C6 done** (2026-09-28, §4.6): every documented
library zxbc ships, checked against zxbc routine by routine. **C7 done** (2026-09-28, §4.7): options and
pragmas agree with zxbc (headerless open). Next: C8.

---

## 0. Ground rules

- **The provenance rule is unchanged** (main plan §0.1): no code from upstream's compiler, runtime or
  library is read, copied, converted or translated. Compatibility is established only from upstream's
  documentation (CC BY 4.0) and from **running** `zxbc` as a black-box oracle on Klive's own test
  programs (D12). A traceback's lines are never recorded, only the exception message.
- Therefore "100% compatible" is defined against **observations**: a behaviour is compatible when a
  test program shows zxbc and Klive BASIC doing the same thing. The work is to make the observations
  cover the language, then make them agree. What no program has observed is not known to be
  compatible; the generated suites (§3.3) exist to shrink that space.
- The oracle stays a developer tool: it runs on the author's machine, never in CI; its results are
  committed as JSON and CI compares Klive against them.

## 1. What "100% compatible" means

| # | Requirement | Measured by |
| --- | --- | --- |
| K1 | **Acceptance.** Klive accepts a program exactly when zxbc does: every program zxbc compiles, Klive compiles; every program zxbc rejects, Klive rejects (an error, not only a warning). | The acceptance suite (§3.2): every spec EBNF form and every corpus program, compiled by both. |
| K2 | **Behaviour.** An accepted program does the same observable things: the screen (text, attributes, border), ERR_NR and the way the program ends, the value it returns, the memory it is documented to touch (POKE targets, system variables), the sound and tape blocks it produces. | The corpus and the generated suites, run by both. |
| K3 | **Interfaces.** The same options (CLI flags, `#pragma`), the same `#include <…>` library names and APIs, inline asm in zxbasm's dialect, the runtime entry points user asm may call (by name and register contract, `.ai/kbasic/runtime-abi.md`), the documented memory layout facts (default ORG, heap size and place). | Option and library programs under the oracle; nextlib compiling (§4, C5). |

**Not required** (and not attempted): identical binaries, identical addresses of variables or
routines, identical timing, identical diagnostic wording. Klive keeps its own additions that do not
change what a ZX BASIC program means: source-level debugging, the optimiser, CODEBANK (a NextBuild
extension, which has its own compatibility target), the `'@` header options (comments to zxbc).

**Where zxbc has no defined behaviour** — it crashes while compiling, or a result depends on
whatever a register held — there is nothing to be compatible with. Those cases are listed in §5 for
the project author (D-C1, D-C2).

## 2. What the Phase 8 oracle run found (the starting inventory)

178 programs ran through zxbc 1.19.0 (main plan, Handoff "Phase 8 state"). Four behaviours were
already changed to upstream's (VAL, lazy scrolling, READ's A report, exact Fixed printing). The rest
are the work of this plan. Observed facts, in Klive's words:

| Area | zxbc 1.19 (observed) | Klive today | Stage |
| --- | --- | --- | --- |
| Integer MOD | the remainder of the magnitudes, never negative: -100 MOD 3 = 1, 100 MOD -3 = 1, -7 MOD 2 = 1 (Byte), -100000 MOD 7 = 5 (Long) — a hypothesis that fits all five observations | the dividend's sign | C2 |
| Division of negatives | Byte floors (-7 / 2 = -4); Integer and Long truncate (-100 / 3 = -33) | truncates for every type | C2 |
| Float MOD | floors: -7.5 MOD 2 = 0.5 (the ROM's n-mod-m) | the dividend's sign | C2 |
| Literal typing | 5 SHL 8 = 1280, 1 SHL 8 = 256, BNOT $100 = -257; 1 / 8 = 0.125; PRINT 0.001 prints 0.0009918212890625 and PRINT 1E10 prints 1410065408 (real literals typed as Fixed or a 32-bit integer when printed directly) | the documented rules (smallest unsigned type, shift keeps the left type, / of integers is integer division, a real literal is a Float) | C2 |
| Typed CONST | CONST k AS UByte = 200: k + k is 400 (folded without the type) | 144 | C2 |
| Constant division by zero | zxbc crashes | folds, warning K406 | C4 / D-C1 |
| FOR | limit and STEP re-evaluated on every pass; an unsigned variable with a negative STEP held in a signed variable runs no iteration | evaluated once; counts down | C3 |
| Evaluation order | a FUNCTION call before the other operand; an assigned array element's index after the value (arguments agree: last first) | left to right; index first | C3 |
| Runtime errors | return to the caller with ERR_NR set; the ROM's report is not printed by the program (PRINT AT 30, 0 gives ERR_NR 4 and ends) | stops with the ROM's report | C1 observes, C3 changes |
| PLOT / DRAW off screen | 5 Out of screen | B Integer out of range | C3 |
| POINT (sinclair-compatible) | 0 after PLOT 5, 5 | 1 | C3 |
| Fixed division by zero | -0.0000152587890625, no error | 6 Number too big | C3 |
| Substring assignment | strings/substring-assign.zxbas stops with B Integer out of range | clips and pads | C3 (find which statement) |
| Named arguments | `show(c := 7, a := 5)` passes by position | by name | C3 (copied, D-C2) |
| FASTCALL with a BASIC body; FUNCTION without RETURN; a BYREF Float in float-routines | results depend on leftover registers or an upstream fault | defined results | D-C2 |
| Acceptance | rejects `#elif`, `=` in `#if` (wants `==`), `x ^ -1`, READ in a program without DATA; crashes on strings/compare, strings/ordering, classic/primes-sieve | accepts all of them | C4 |
| DO…LOOP | see C0 | **fixed** | C0 |

## 3. Method

### 3.1 Oracle v2 (stage C1)

- **Run through BASIC.** Today a program is called from a machine-code stub. v2 also runs it the way
  a user does: a BASIC line `RANDOMIZE USR <org>` in the 48K's program area, run by the ROM, so what
  happens after an error return (the report BASIC prints, the `0 OK`) is observed as the user sees
  it. Both runs are recorded; the corpus compares the one its expectations describe.
- **Record more:** the border, the attribute rows the expectations name, the return value (BC), and
  the compile outcome of every program (accepted, rejected with zxbc's first message line, crashed
  with its exception message).
- **Bisect helper** (`scripts/kbasic-oracle.cjs --bisect <program>`): drops statements from a
  program zxbc rejects or crashes on until the smallest failing program remains — how the three
  crashing corpus programs get explained without reading upstream's source.

### 3.2 The acceptance suite (stage C4)

Every EBNF form in `.ai/zxbasic-syntax/zxbasic-syntax.json` already has an accepting and a rejecting
example (`test/kbasic/syntax/spec-forms.test.ts`). The oracle compiles each example with zxbc and
records the outcome in `test/kbasic/oracle/acceptance.json`; a test compares Klive's parser and
binder with it. Probes that find a rule (like C0's) become examples. Target: no disagreement.

### 3.3 Generated differential suites (stage C2)

The unknowns that matter most — literal typing, promotion, overflow, division, MOD, shifts, bitwise
operators, comparisons, conversions and CAST, number printing — are combinatorial. A generator
(`scripts/kbasic-compat-gen.cjs`, fixed seeds, committed output) writes programs of ~30 PRINT items
each over types × operators × operand forms (literal, CONST, variable, expression) × boundary values.
The oracle records zxbc's output once; CI runs Klive over the same programs and compares.
Rules found this way are written into the semantics annex in Klive's words, with the generated
program that pins them. Target: every generated program agrees.

### 3.4 Keeping it honest

- An expectation in the corpus changes only together with an oracle result that agrees with it.
- `'@expect oracle-differs <entry>` shrinks to the D-C2 list: the corpus runner already fails a mark
  on a program upstream agrees with; C8 adds a test that fails on a mark naming an entry outside
  that list.
- The annex's `klive-decision` entries that differ from upstream are set to `open` (phase 8) by this
  plan and become `oracle` entries as each stage lands.

## 4. Stages

| Stage | Content | Exit criterion |
| --- | --- | --- |
| **C0** | DO…LOOP: `DO LOOP UNTIL c` without a separator is accepted; a bare DO whose LOOP follows `:` on the line holding all of the body is rejected (E315), as zxbc does. `control/do-loops.zxbas` rewritten and confirmed by the oracle. | **Done 2026-09-27.** |
| **C1** | Oracle v2 (§3.1); the bisect helper; the three zxbc crashes and the error model observed through BASIC. | **Done 2026-09-27** (§4.1). |
| **C2** (**done 2026-09-27**, §4.2) | Expressions and types (§3.3): literal typing, promotion, CONST folding, division and MOD for every type, shifts, bitwise, comparisons, conversions, number printing (Float, Fixed and integer literals). The binder, the constant folder, the runtime (arith16/arith32/float/fixed) and the tree selector follow; the optimiser's folding stays equal to the run time. | The generated suites and the corpus agree with zxbc for these areas. |
| **C3** (**done 2026-09-27**, §4.3) | Statements: FOR (re-evaluation, unsigned with negative STEP, the value after the loop), evaluation order around calls, named arguments by position, the runtime error model (§4.1: which errors stop and which set ERR_NR and carry on; the debugger still stops at `errorEntry`), the print position written back for BASIC on return, PLOT/DRAW/POINT, Fixed division by zero, substring assignment, DATA/READ, PRINT's comma/TAB/AT edge cases, INPUT, sound and tape. | The statement corpus agrees; the debugger corpus and the step tests still pass at every level. |
| **C4** (**done 2026-09-27**, §4.4) | Acceptance (§3.2), both ways: reject what zxbc rejects (`#elif`, `=` in `#if`, `x ^ -1`, READ without DATA as a compile error, …), accept what it accepts. Klive's extensions are decided per D-C3. | The acceptance suite agrees. |
| **C5** | Inline asm: zxbasm's dialect (main plan §6.5, D10) as the default, the runtime alias table for documented entry points, `'@asm-dialect klive` for Klive's own. nextlib compiles and its demo programs run under the oracle. | nextlib and the corpus's asm programs agree. |
| **C6** | The standard library: every library `#include <…>` can name, with the APIs from upstream's documentation (the undocumented ones get their interface recorded from the docs first, main plan Handoff item 2). One oracle program per library. | Every documented library's programs agree. |
| **C7** | Options and `#pragma`s: every zxbc CLI option the spec lists (`--array-base`, `--string-base`, `--sinclair`, `--heap-size`, `--explicit`, `--strict`, `--debug-memory`, `--debug-array`, `--enable-break`, `--org`, …) has a program run by both with the option set. | The option programs agree. |
| **C8** | Close: the annex has no `open` entry left but string-concatenation-overflow (or it is observed too); `oracle-differs` marks only on the D-C2 list; the user documentation (main plan R18) states the compatibility and the remaining deviations; the main plan's status updated. | K1–K3 hold on every suite. |

### 4.1 C1 findings (2026-09-27)

- **Oracle v2.** `runBinaryThroughBasic` (`test/kbasic/codegen/run-kit.ts`) starts a program as a
  user does: `RANDOMIZE USR <org>` typed at the keyboard (`typeKeys`, new in the 48K harness), then
  BASIC's report is read from the bottom row. Every oracle result now has a `basic` part (report,
  screen, border) beside the stub run, except programs that hold keys (BASIC would type them once the
  program returns) — 167 of 178. The corpus does not compare `basic` yet; C3 does, for the error model.
- **The error model** (annex `runtime-error-model`), observed with `RANDOMIZE USR 32768: PRINT 7`:
  `ERROR n` and the ROM calculator's errors stop at once (report at statement 1). READ of the wrong
  kind and PRINT AT off the screen set ERR_NR and carry on; STOP ends the program by returning with
  ERR_NR 8. BASIC then runs `PRINT 7`, and its final report shows the leftover ERR_NR (`9 STOP
  statement, 0:2`). Klive stops at once for every error. So "follow zxbc" (D-C5) means: classify
  every runtime error source as stopping or carrying on (C3 probes each), and let ERR_NR through.
  The Phase 8 change to READ (report A) had the code right and the stop wrong (reopened).
- **The print position.** zxbc leaves BASIC printing after its output (`a7`); Klive does not write its
  cursor back (BASIC prints `7` at the top left). A C3 item (annex `print-position-on-return`).
- **VAL.** After a failed VAL, zxbc leaves BASIC's state broken (`C Nonsense in BASIC, 3331:1` once
  the program returns); Klive restores it. Kept (D-C2).
- **The crashes**, reduced with `--bisect` and by hand: a comparison of two String constants
  (`"a" = "a"`; strings/compare, strings/ordering), and a FOR whose STEP is a UByte or UInteger
  *variable* (classic/primes-sieve; a signed or Float STEP compiles). Klive compiles both as
  documented (D-C1; annex `constant-string-comparison`, `for-unsigned-variable-step`).
- **substring-assign** writes outside its String under zxbc (the typed run prints garbage and never
  reports); which statement does it is a C3 question before D-C2 can decide it.

### 4.2 C2 state (2026-09-27)

- **The generated suites** (`scripts/kbasic-compat.cjs gen`, `test/kbasic/compat/suites/`): literals,
  binary and mixed operators, shifts, CONST, conversions, unary operators, number printing, division
  by zero, variables meeting literals, DIM initialisers, implicit variables and FOR, signed variables
  divided by literals — 1,747 items. `oracle` records zxbc's result per item (a rejected program is
  halved until each rejected item stands alone); `compat.test.ts` compares Klive at levels 0 and 3,
  and requires the two levels to agree.
- **Two files keep it honest:** `baseline.json`, the items still to fix (a ratchet; empty now), and
  `faults.json`, the items Klive differs on purpose, each naming its annex entry (D-C1 crashes, D-C6
  faults): 75 now — `decimal-mod`, `fixed-division`, `byte-division`, `power-of-two-literal-divisor`,
  `shr-signed`, `fixed-division-by-zero`, `bnot-decimal`.
- **Copied from zxbc:** literal-only expressions fold exactly (`/` divides exactly, MOD floored,
  `BNOT n` = -(n+1), shifts unbounded) and the result takes its natural type — a whole number the
  smallest integer type, wrapping to 32 bits beyond it (`1E10` is 1410065408); a fraction a Fixed in
  Fixed range, else a Float (`0.001` is 65/65536; converted to Float, a literal keeps its exact value).
  A typed CONST folds by its value. A constant converts to Fixed truncating towards zero. Signed MOD
  at run time is the remainder of the magnitudes (`-100 MOD 3` = 1). Implicit variables and FOR take
  these types (`a = 1.5` is a Fixed).
- **Kept correct (D-C6):** Float and Fixed MOD at run time floor (`FixMod`, new; `FMod` uses the ROM's
  INT, with the divisor moved to calculator memory 2, since INT uses memory 0 for negative numbers).
- **Strings and built-ins** (suites `strings`, `builtins`, 335 items) agreed at once, apart from STR$ of
  a literal, which zxbc writes at compile time (annex `str-of-literal`; `literalText`).
- **Closed** with every suite agreeing: `baseline.json` empty, 75 recorded faults. A new difference
  anywhere in the suites fails CI; a fault that stops differing fails too.

### 4.3 C3 state (2026-09-27)

- **C3a done.** The suite `statements` (50 items, one program each) pins evaluation order around
  calls, named arguments and FOR; all agree but one recorded fault (`for-never-runs`).
  - **Single-line routines** (`FUNCTION f() AS UByte: RETURN 1: END FUNCTION`) now parse, as zxbc
    accepts them.
  - **Evaluation order** (annex `argument-evaluation-order`): a plain variable on the left of a binary
    operator, read in the operation's type, is read after a right operand that calls a FUNCTION; an
    assigned element's subscripts are evaluated after the value. `lower.ts` swaps the operands of a
    commutative or mirrored operator, and holds the right value in a hidden slot for the others (`-`,
    `/`, MOD, shifts, concatenation) - the level-0 stack machine needs its operands in order.
  - **Named arguments** (annex `named-arguments`): positional, in the order written, then the defaults
    of the parameters neither given nor named (a parameter may take another's default).
  - **FOR** (annex `for-loop-evaluation`, `for-unsigned-negative-step`): the limit, and a non-constant
    STEP whose sign decides, are evaluated at every test; NEXT evaluates the STEP again; a
    non-constant STEP takes the variable's type. Loops with an expression as the limit grew a little.
- **C3b done.** The suite `errors` (23 items, one program each: the statement, then `"after";
  PEEK 23610`) classifies each runtime error; probes through the oracle gave the details.
  - **Stop at once** (as before): ERROR n, the ROM calculator's errors, BEEP out of the ROM's range
    (new: duration 0-10, pitch -60..69, rounded down; annex `beep-limits`).
  - **Set ERR_NR and carry on** (annex `runtime-error-model`): PRINT AT off the screen (the cursor
    stays), PLOT/DRAW/CIRCLE off the screen (nothing drawn; DRAW checks its end first), READ of the
    wrong kind (0 or ""; the next READ reads on). READ with no DATA left reads 0 with no error.
  - **STOP** returns with ERR_NR 8 (`StopProgram`): BASIC shows the report when its line ends.
  - **The print position** (annex `print-position-on-return`): End calls `EndHook`, which the print
    module sets to `PrintSave`: S_POSN and DF_CC from the cursor, so BASIC prints on after the output.
  - Kept as faults: heap exhaustion (zxbc overwrites memory), Fixed division by zero. Left for C4:
    constant BEEP out of range and a program without DATA (compile-time rejections in zxbc). Left for
    C3c: invalid colours (zxbc masks them to 3 bits, INK 9 included), USR of a String.
- **C3c done.** The suite `screen` (95 items, one program each; multi-row items compare the first
  rows, graphics items a checksum of the bitmap computed in BASIC) agreed at once for PRINT's layout
  (comma, TAB, wrapping, control codes) and for PLOT, DRAW, arcs and CIRCLE. Changed:
  - **Colours** (annex `colour-values`): no value stops the program. INK/PAPER 8 keep, anything else
    is masked to 0-7 (there is no INK 9 contrast); FLASH/BRIGHT 8 keep, non-zero sets; INVERSE takes
    bit 0; OVER bits 0-1 - a glyph is replaced, XORed, ANDed or ORed (PrintFlags bit 4 holds OVER's
    bit 1), PLOT reads bit 0 only; BORDER shows bits 0-2 and sets BORDCR to n * 8.
  - **POINT** (annex `point-coordinates`): -1 past the top; under sinclair-compatible the ROM's
    coordinates (POINT(x, y) tests PLOT x, y + 16), through `__KBASIC_SINCLAIR_POINT` in sinclair.bas.
  - **USR of a String** (annex `usr-string`): zxbc's arithmetic on the first character, never an
    error; the empty String gives 0 and ERR_NR 9.
  - Kept as a fault: a slice assignment past the String's end or open-ended (zxbc corrupts memory).
- **C3 closed.** 2,321 generated items agree apart from 79 recorded faults; `baseline.json` holds one
  item for C4 (a constant BEEP out of range, which zxbc rejects at compile time).

### 4.4 C4 state (2026-09-27)

- **The acceptance suite** (`acceptance`, 506 programs: every spec case, accepting and rejecting, and
  hand-written edges) records zxbc's verdict per program (the oracle only compiles them); Klive's
  full compile must give the same verdict. The corpus runner now fails a program zxbc rejects other
  than by crashing. The policy: follow zxbc's verdicts, except its crashes (D-C1: Klive compiles
  them) and malformed code it silently repairs (`PRINT )`, `NEXT` alone, `CLS 1`, `SUB PASCAL s`:
  kept rejected, annex `silent-syntax-repair`).
- **Now rejected, as in zxbc:** a sign right after `^` or after a built-in without parentheses (E309);
  `#elif` (E208) and `=` in `#if` (E213); READ in a program without DATA (E432); a constant BEEP
  outside 0-10 / -60..127 (E433); `@` or SAVE/LOAD DATA of an undeclared name (E434; `@` after
  `DIM ... AT` excepted); slicing what a FUNCTION returns (E435), a built-in's result, or a
  parenthesised expression with a single index; an END IF after `ELSE statement` in a block IF.
- **Now accepted, as in zxbc:** built-ins without parentheses (`SIN 0 + 1` is `SIN(0) + 1`); an
  unused DECLARE; an array parameter without a type; `ELSE statement` closing a block IF.
- **Found on the way:** zxbc folds a built-in of a literal (`SQR(2) + 0` is a Fixed, `LEN("abc") / 2`
  is 1.5 - annex `builtin-literal-folding`), and RESTORE to a label with no DATA after it wraps to the
  first item (C3b had it read 0).
- **Left:** SAVE/LOAD DATA without a name (whole-memory tape blocks, E501) stays in `baseline.json`
  for C8. Faults: 29 acceptance items (crashes, silent repairs, CODEBANK as NextBuild's, a degenerate
  #ifdef program, a Float constant past the range).

### 4.5 C5 state (2026-09-27)

- **zxbasm is the default dialect.** `src/main/kbasic/asm/zxbasm.ts` converts every zxbasm-dialect
  block of a program together, after binding (zxbc assembles the blocks as one file): `:` statements,
  `;` comments, case (keywords fold, labels keep theirs), numbers and characters, `NNNb`/`NNNf`
  temporary labels, PROC/LOCAL/ENDP by renaming (LOCAL covers its whole PROC, across blocks; other
  labels stay global), grouping parentheses to `[ ]`, the data directives, dotted names
  (`.LABEL._x`, `._name`, `.core.X` through `RUNTIME_ALIASES` - empty: NextLib 8 calls no runtime
  entry), and labels that are keywords of Klive's assembler (`bank`). It rejects what zxbasm rejects
  (`name: EQU`, an undefined temporary label). `'@asm-dialect klive` / `#pragma asm_dialect = klive`
  (push/pop) keep Klive's own; the five standard-library files with asm declare it. The corpus's asm
  programs needed no change. Annex `inline-asm-dialect`.
- **The preprocessor expands macros inside ASM lines**, as text (NextLib's `#define ESXDOS rst 8`,
  `getreg(R)`); two lexer fixes on the way (an ASM followed by a `;` comment, a `#define`
  continuation after a blank continued line) and keyword macro parameters. Annex `inline-asm-macros`.
- **zxbc's register contracts** (annex `inline-asm-registers`): a FASTCALL routine whose body is only
  zxbasm asm and labels, with no locals, is **frameless** (`naked` in MIR: no prologue, a bare `ret`;
  the asm pops the return address and the stack parameters itself, and may `ret` mid-body); a FASTCALL
  body that starts with asm otherwise finds its parameter reloaded into A / HL / DE:HL; a FUNCTION that
  ends with zxbasm asm returns A / HL / DE:HL / A,E,D,C,B. This is a documented idiom, not the leftover
  state D-C2 keeps Klive's results for: a FUNCTION that ends without RETURN after BASIC code still
  returns its zeroed result.
- **The `asm` suite** (51 items: dialect features and frame/register contracts) agrees with zxbc except
  7 faults, all annex `asm-unused-variable`: zxbc drops a variable only asm names (the global's `_name`
  is undefined, a local's frame bytes hold leftovers); Klive keeps it.
- **NextLib 8** (read locally, never committed): the whole library compiles for the Next at -O2 (at
  -O0/-O1 zxbc rejects it too: DoTile8 and DoTileBank8 both define `PlotTile8`, which only unused-SUB
  removal hides). A demo using NextRegA, GetReg, ScrollLayer, ShowLayer2, GetMMU, checkints,
  ClipLayer2, PlotL2 and CLS256, built by both compilers and run on the Next harness, leaves the same
  NextRegs, memory and Layer 2 pages.

### 4.6 C6 state (2026-09-28)

- **The inventory.** zxbc 1.19 ships 41 library files; upstream documents 20 of them. Klive now has
  all 20: new are `clearbox`, `fmath`, `hmirror`, `input42`, `megalz`, `memorybank`, `puttile` and
  `zx0`. Left out (annex `library-coverage`): the undocumented files, whose interface only their
  source could give (the provenance rule), and `fastplot.bas`, which ships without the documented
  `fastPlot`. A name the documentation only shows as a listing (`distance.bas`, `iSqrt.bas`, ...)
  gives E216 saying so.
- **The `library` suite** (152 items, 3000 frames a program) runs every documented routine under
  zxbc, including edges the documentation leaves open, and agrees apart from 11 faults: the print42 /
  print64 glyphs (annex `library-font`: Klive's fonts are its own) and fmath outside 0-360, where
  zxbc's inexact run-time Fixed MOD shows (annex `fmath-angle-reduction`, D-C6).
- **Found and followed:** `right` longer than the String gives ""; print42/print64 wrap an
  out-of-range cursor instead of stopping, handle CHR$ 13 / 22 (and print42's CHR$ 8 and UDGs) and
  skip every other code (annex `library-print-cursor`); fmath is a 2-degree SIN * 255 table with
  linear interpolation; zx0.bas reads ZX0 format 2, its Back names the compressor's backwards
  format (flag bits flipped, the offset's low byte plain), its RCS names the RCS screen order (annex
  `library-compressed-formats`). The test data comes from Klive's own packers
  (`scripts/kbasic-packers.cjs`), written from the formats' published descriptions.
- **Not observable under the 48K oracle:** memorybank's paging, tested on the Next harness instead
  (SetCodeBank copies the bank at $C000 to $8000 and pages the previous bank back); INPUT42, which
  needs typed keys, tested with the harness's keyboard.
- **Left for later:** zx0.bas has one decoder for all names, so the Turbo and Mega names are not
  faster than Standard (the results are the same).

### 4.7 C7 state (2026-09-28)

- **The `options` suite** (47 items, each alone in its program): header options (`'@name value`,
  passed to zxbc as flags through the corpus oracle's mapping) and their `#pragma` forms. Items can
  add ERR_NR to their result (`err`) and run with keys held (`hold`). Everything agrees but one fault:
  zxbc's `--zxnext` flag has no effect (annex `zxnext-option`; the pragma works in both).
- **Implemented:** `check-bounds` (every array, a parameter's through its descriptor's bounds; 3
  Subscript wrong) and `break-key` (CAPS SHIFT + SPACE at each of the user's statements; L BREAK),
  which were parsed and then ignored (annex `runtime-checks`); the whole-program pragmas (heap_size,
  heap_address, memory_check, array_check, enable_break, optimization_level, opt_strategy, org,
  headerless, zxnext, autorun, expected_warnings), also ignored before (annex `program-pragmas`); a
  `zxnext` option (the assembler's new `allowNextInstructions`).
- **Found and followed:** strict typing rejects an untyped DIM with an initial value (annex
  `strict-initialised-dim`); string.bas's mid counts from 0 whatever the string base, asc follows it
  (annex `string-library-base`); `#pragma sinclair` has no effect in zxbc.
- **Open:** `headerless` is accepted but not implemented (Klive still emits its start-up and END
  code). A headerless zxbc build run as a program prints nothing, so no program can compare the two;
  it needs a decision on what Klive's start-up may leave out. Options with no effect on a program's
  behaviour (warnings, output formats, include paths, the memory map) are covered by their own tests,
  not by this suite.

**What each stage must keep:** the debugger guarantees (G1–G6, the debugger corpus at levels 0–3),
the optimiser baseline ratchet (a compatibility change that costs bytes is recorded with
`node scripts/kbasic-opt-report.cjs`, the reason in the commit), the Next and CODEBANK corpus.

## 5. Decisions (project author, 2026-09-27)

**All five proposals below are accepted, and named arguments are copied too:** zxbc passes them by
position, so Klive will (a C3 item). The table keeps the questions and the accepted answers.

| # | Question | Proposal |
| --- | --- | --- |
| D-C1 | zxbc **crashes** on a program (constant division by zero, strings/compare, strings/ordering, classic/primes-sieve). Klive cannot crash the same way. | Compile the program as upstream's documentation defines it, and record the crash in the annex. Revisit per case once C1 has reduced each crash. |
| D-C2 | zxbc's result **depends on leftover state or an upstream fault**: a FASTCALL routine with a BASIC body, a FUNCTION ending without RETURN, a BYREF Float in float-routines, named arguments passed by position. | Keep Klive's defined results (documented as undefined in ZX BASIC). **Named arguments: copy zxbc** (by position; C3). |
| D-C3 | Klive **extensions zxbc rejects**: `#elif`, `=` in `#if`, `x ^ -1`, READ without DATA. | Reject them, as K1 says (a program Klive accepts then also compiles with zxbc). |
| D-C4 | **Inline asm default**: today Klive's own dialect. | zxbasm's by default (K3); Klive's with `'@asm-dialect klive`. The standard library and tests keep Klive's by declaring it. |
| D-C5 | **Runtime errors**: zxbc returns to the caller with ERR_NR set. | Follow zxbc once C1 has shown what the user sees through BASIC; the debugger's error stop stays. |

**D-C6 (project author, 2026-09-27, from C2's findings):** zxbc's *consistent* rules are copied,
even where they surprise (constant folding in exact arithmetic, MOD taking the magnitudes at run time,
named arguments by position). Where its **run-time arithmetic is simply wrong** — Byte division
dropping the sign, `Integer -100 SHR 1` = 32718, Float MOD (-7.5 MOD 2 = -19.5), Fixed MOD losing
precision, Float/Fixed division by zero giving 0 — Klive keeps the correct result, recorded in the
annex as an upstream fault. For Float and Fixed MOD at run time, "correct" is zxbc's own constant
rule: floored, as the ROM's n-mod-m.

## 6. References

- Main plan: `.plans/ZXBASIC_COMPILER_PLAN.md` (§0.1 provenance, D10 asm dialect, D12 oracle,
  R8 annex, the Handoff's "Phase 8 state").
- The oracle: `scripts/kbasic-oracle.cjs`, `test/kbasic/oracle/`, the corpus runner's comparison
  (`test/kbasic/corpus/corpus.test.ts`, `expectations.ts`).
- The semantics annex: `semantics` in `.ai/zxbasic-syntax/zxbasic-syntax.json` (its `oracle` notes).
- The runtime ABI and library API: `.ai/kbasic/runtime-abi.md`, `.ai/kbasic/stdlib-api.json`.
