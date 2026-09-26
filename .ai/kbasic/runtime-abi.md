# ZX BASIC runtime ABI — the interface Klive BASIC's runtime is compatible with

Facts about the binary interface of Boriel ZX BASIC programs (upstream v1.19.0, architectures
`zx48k` and `zxnext`), recorded in Klive's own words. **Klive BASIC's runtime is written from
scratch** (plan §6); these facts decide where it must match upstream (anything a program, inline
asm or a library can observe) and where it is free to differ (internal routine names and
algorithms). Read `README.md` in this folder for the provenance rule.

Each section ends with **Klive BASIC:** — the decision for Klive's own runtime.

---

## 1. Architectures

- Upstream's `zxnext` runtime is almost entirely the `zx48k` runtime reused; only 8- and 16-bit
  multiply (using the Z80N `mul d,e`), the array element-address routine and the string
  comparisons differ. It is **not** Next-aware: it calls the 48K ROM, assumes the 48K BASIC ROM at
  `$0000-$3FFF` and the system variables at `$5C00` (IY = `$5C3A` while ROM routines run), touches
  no NextReg, and knows nothing of 28 MHz.
- The zxnext backend differs from zx48k only in inline 8-bit multiplication with `mul d,e`, one
  extra peephole rule, Z80N opcodes enabled in inline asm, and a slightly different prologue.

**Klive BASIC:** one runtime source with architecture variants chosen at assembly time
(`#if` on a predefined target symbol). The Next variant uses Z80N instructions where they help and
is designed to work **without the ROM** except for the floating-point calculator (§9).

## 2. Type sizes and data representation

| Type | Bytes | Representation |
| --- | --- | --- |
| Byte / UByte | 1 | two's complement / unsigned |
| Integer / UInteger | 2 | little-endian |
| Long / ULong | 4 | little-endian; in registers DE:HL (DE = high word) |
| Fixed | 4 | 16.16 signed; integer part in DE (high word), fraction in HL |
| Float | 5 | Sinclair ROM format (§2.1) |
| String | 2 | pointer to a heap block `[length:2][chars…]`, no terminator, max 65535; pointer 0 = empty string |
| Boolean (internal) | 1 | 0 = false, non-zero = true; normalised to 0/1 when widened or stored in a numeric variable |

### 2.1 Float

- Byte 0: exponent, excess 128. Bytes 1–4: mantissa, most significant first, with bit 7 of byte 1
  replaced by the sign (the implicit leading 1 is not stored).
- Exponent 0 is the ROM's **small-integer form**: `0, sign byte (0 or $FF), low, high, 0`. Both
  forms must be accepted wherever a Float is read.
- Register image: **A = exponent, E = mantissa byte 1 (with sign), D, C, B = bytes 2–4.** The
  upstream docs pages say "C/DE/HL" — that is wrong; the compiler and runtime use A/E/D/C/B.
- On the stack a Float takes 6 bytes (one padding byte first, then exponent, E, D, C, B in
  ascending addresses) because parameters are word-aligned.

### 2.2 Strings

- Assignment copies. Concatenation allocates a new block.
- **Ownership:** a string produced by an expression is a *temporary*; whoever consumes it frees
  it. Upstream passes "free this operand after use" flags to routines that consume temporaries
  (bit 0 = first operand, bit 1 = second).
- Slicing indices are relative to `string_base` (0 by default, 1 with the Sinclair option); the
  valid range is 0…65534; a reversed range gives the empty string.
- String literals are stored once each as `[length:2][chars…]` in the program image (not on the
  heap).

### 2.3 Arrays

- A global array `a` has a **descriptor** at its label: four words — pointer to the
  dimension table, pointer to the data, pointer to the lower-bound table (or 0), pointer to the
  upper-bound table (or 0) — followed by the data (unless `DIM … AT`).
- Dimension table: number of dimensions − 1 (word), the element count of dimensions 2…n (a word
  each), then the element size (byte).
- Bound tables: one word per dimension. The lower-bound table exists only for arrays with a
  non-zero base that are indexed dynamically or queried with `LBOUND`; the upper-bound table only
  when `UBOUND` is used or bounds checking is on.
- Data is contiguous, row-major (last subscript varies fastest). `@a(0)` (or `@a(0,0)`) is the
  first element's address; since upstream 1.18.3 a bare `@a` is the **descriptor** address.
- Arrays are always passed by reference: the argument is the descriptor address.
- Local arrays keep their descriptor in the stack frame and their data on the heap, allocated on
  entry and freed on exit.

**Klive BASIC:** keep every layout in this section exactly — they are observable through `PEEK`,
`DIM … AT`, `@`, `LBOUND/UBOUND`, inline asm and libraries.

## 3. Calling conventions

### 3.1 STDCALL (default)

- The caller evaluates arguments and pushes them **last argument first** (the first argument ends
  up nearest the return address), then `call`s the routine. **The callee removes the
  arguments.**
- Push encodings: 8-bit → one word with the value in the **high** byte (`push af`); 16-bit and
  String pointer → `push hl`; 32-bit and Fixed → high word then low word (so memory holds
  low word at the lower address); Float → 6 bytes (padding, exponent, E, D, C, B).
- Callee frame: `push ix`, `ld ix,0`, `add ix,sp`. Saved IX at `(ix+0)`, return address at
  `(ix+2)`, **first parameter at `(ix+4)`**; an 8-bit parameter's value is the slot's high byte
  (`ix+5` for the first); a Float parameter's five bytes start at slot + 1. Locals at negative
  offsets, **zeroed on entry**.
- Results: A (8-bit), HL (16-bit, String), DE:HL (32-bit, Fixed), A/E/D/C/B (Float).
- ByRef parameters: the caller pushes the address of the variable (global label; `IX − n` for a
  local; `IX + n` for a parameter, +1 for an 8-bit one; a ByRef parameter forwarded ByRef passes
  its stored address).
- String arguments by value: the caller passes a **copy** it owns no longer (a variable or literal
  is duplicated first; a temporary is passed as it is); the callee frees it on exit. A returned
  String belongs to the caller, which frees it (a statement that discards a String result frees it
  immediately).
- Epilogue: frees local Strings, by-value String parameters and local arrays; restores SP from IX,
  pops IX, removes the arguments, returns. The result registers survive the epilogue (it uses the
  alternate registers).

### 3.2 FASTCALL

- The first parameter arrives in registers: A / HL / DE:HL / A-E-D-C-B by size (String = HL).
- No frame, no locals; the body ends in a plain `ret`. Further parameters are pushed STDCALL-style
  and the routine must remove them itself (`[SP+0]` return address, `[SP+2]` second parameter…).
- Results as STDCALL.

### 3.3 Register discipline

Nothing is preserved across a user call except IX (restored by the STDCALL epilogue). Runtime
routines document individually what they preserve. **IY must be `$5C3A` whenever a ROM routine
runs.** Alternate registers are free for the runtime.

**Klive BASIC:** §3 is the user-visible ABI and is kept exactly, so that inline asm, `USR`
routines and libraries that call BASIC SUBs/FUNCTIONs (or are called by them) work.

## 4. Symbols and naming (what inline asm and debuggers see upstream)

- Global variables and SUB/FUNCTION entry points: `_name` (declared spelling, sigil stripped).
- BASIC labels and line numbers: `.LABEL._name`, `.LABEL._10`.
- Compiler temporaries, string literals, array dimension tables: `.LABEL.__LABELn`.
- Routine exit: `_name__leave`. Array parts: `_a.__DATA__`, `_a.__DATA__.__PTR__`,
  `_a.__LBOUND__`, `_a.__UBOUND__`.
- Runtime: everything in the `.core` namespace (`.core.__MEM_ALLOC` …). Program markers:
  `.core.__START_PROGRAM`, `.core.__MAIN_PROGRAM__`, `.core.__END_PROGRAM`, `.core.__CALL_BACK__`,
  `.core.ZXBASIC_USER_DATA`, `…_END`, `…_LEN`, `.core.ZXBASIC_MEM_HEAP`, `.core.ZXBASIC_HEAP_SIZE`.

**Klive BASIC:** inline asm is Klive dialect (plan D4), so Klive defines its own names (plan §8.4:
`_name` for globals and routines, `_label.x`, `_name.leave`, runtime in module `core`). Keeping
`_name` for globals and routines preserves the most common inline-asm idiom. For D10
(zxbasm-dialect libraries), the converter maps upstream names to Klive's, and the runtime exports
**aliases** for the upstream entry points such libraries actually call (decided per library when
it is supported).

## 5. Program layout and start-up

Upstream emits, in order: origin (default 32768) → program start → prologue → the saved-SP word
→ user-data area (heap storage if needed, then global variables and arrays) → main program →
the `END` sequence → SUB/FUNCTION bodies → DATA tables → string literals → jump tables → runtime
modules → initialiser templates.

- Prologue (zxnext): disable interrupts, save IY, set IY to `$5C3A`, save SP, enable interrupts,
  call each registered initialiser, jump to the main program. zx48k also saves IX and HL' and does
  not set IY.
- `END [n]`: value in BC; restore SP from the saved word, restore the saved registers, return to
  the caller (BASIC's `USR`).
- Headerless mode: no register saving, no initialiser calls, `END` becomes `ret`.
- The program runs on its caller's stack; the runtime sets up no stack of its own.
- Heap: a free list in `[heap start, heap start + heap size)`; blocks carry a 2-byte size and a
  2-byte next pointer; allocation returns the payload address or 0. With memory checking on, an
  allocation failure raises the "Out of memory" report; otherwise the result is treated as an
  empty string.

**Klive BASIC:** own prologue (plan §6.2), which also records the main program's baseline SP for
the debugger (plan §10.2.2). Layout order is Klive's choice; observable facts to keep: default
origin 32768, default heap size 4768, `END n` returning n in BC to `USR`, headerless semantics.

## 6. DATA / READ / RESTORE

Upstream stores DATA items as a stream of `[type byte][value]` (1 String, 2 Byte, 3 UByte,
4 Integer, 5 UInteger, 6 Long, 7 ULong, 8 Fixed, 9 Float; bit 7 set = a routine that computes a
non-constant item follows) terminated by 0; READ converts dynamically to the target's type;
reading past the end wraps to the first item.

**Klive BASIC:** the stream format is internal (not observable) — Klive may choose its own; the
behaviour (dynamic conversion, wrap-around, `RESTORE label`) is kept.

## 7. Runtime entry points upstream provides (by area)

Names are upstream's; register contracts are in Klive's words. They document **what a runtime must
provide**; Klive BASIC's names and algorithms are its own (with aliases only where §4 requires).

- **Integer arithmetic:** 8/16/32-bit multiply, signed/unsigned divide and modulo (8-bit: A and H;
  16-bit: HL and DE; 32-bit: DE:HL with the second operand on the stack, callee pops), 32-bit
  subtract, negate/abs for 8/16/32-bit, 32-bit shifts (one bit per call; the compiler loops).
- **Fixed:** multiply, divide, modulo (DE:HL with the second operand on the stack).
- **Float:** add, subtract, multiply, divide (divide by zero raises "Number too big"), modulo,
  power, SIN/COS/TAN/ASN/ACS/ATN/EXP/LN/SQR, negate, abs, compare (=, <>, <, <=, >, >=), all
  through the ROM calculator; conversions between Float and every integer type and Fixed.
- **Bitwise and boolean:** 16/32-bit AND/OR/XOR/NOT (bitwise), 16/32-bit and Float logical
  AND/OR/XOR/NOT returning 0/1-style booleans, boolean normalisation.
- **Comparisons:** 8/16/32-bit signed (unsigned are inline), Float, String (=, <>, <, <=, >, >=;
  operands in HL and DE with free flags in A).
- **Sign:** SGN for every numeric type → A (−1/0/1).
- **Memory:** heap init (registered initialiser), alloc, calloc, free (null-safe, coalescing),
  realloc (null → alloc), overlap-safe copy.
- **Strings:** length, concatenate, copy/assign, duplicate, store (copying and "take ownership"
  variants), slice, substring assignment, compare, CHR (n arguments), ASC/CODE, VAL (via ROM),
  STR (via ROM), USR of a string (UDG address).
- **Arrays:** element address (descriptor in HL, subscripts on the stack, first subscript on top),
  element address through a ByRef descriptor pointer, LBOUND/UBOUND, local array allocation
  (plain and initialised, with or without bound tables), string-array copy and free.
- **PRINT and attributes:** print init (registered initialiser), print character, string (with a
  free flag), every integer type, Fixed, Float (via ROM), newline, comma (next 16-column field),
  TAB, AT (with range check), control codes 0–22 embedded in strings, scrolling; INK, PAPER,
  FLASH, BRIGHT, INVERSE, OVER, BOLD, ITALIC as permanent and temporary (per-PRINT) settings;
  BORDER; CLS; screen and attribute address helpers. The screen and attribute base addresses are
  variables (redirectable for double buffering).
- **Graphics:** PLOT (with range check), DRAW (line, respects OVER/INVERSE), DRAW with arc,
  CIRCLE.
- **I/O and sound:** INKEY (heap string), IN/OUT inline, BEEP (Float duration and pitch),
  fast beeper, PAUSE (frames), LOAD/SAVE/VERIFY CODE (via ROM tape routines), RANDOMIZE, RND
  (Float), USR (calls an address, returns BC; preserves IX).
- **Control:** raise error (ROM report through `rst 8`), STOP, ON GOTO/GOSUB dispatch, jump-table
  helpers, BREAK-key check (per line when enabled), READ/RESTORE.

**Error codes** the runtime raises (ROM report numbers): Subscript wrong 2, Out of memory 3, Out of
screen 4, Number too big 5, Invalid argument 9, Integer out of range 10, Nonsense in BASIC 11,
Invalid file name 14, Invalid colour 19, BREAK into program 20, Tape loading error 26.

**System variables** the upstream runtime uses: CHARS 23606, TV_FLAG 23612, UDG 23675,
COORDS 23677, FLAGS2 23681, ECHO_E 23682, DFCC 23684, DFCCL 23686, S_POSN 23688, ATTR_P 23693,
ATTR_T 23695, P_FLAG 23697, MEM0 23698, ERR_NR 23610, ERR_SP 23613, PPC 23621, FRAMES 23672,
SEED 23670.

## 8. Compile-time switches that change runtime behaviour

Memory checking (allocation failure raises "Out of memory"), array bounds checking (raises
"Subscript wrong"; upper-bound tables always emitted), BREAK checking (after each statement the
BASIC line number is passed to a check routine that raises "BREAK into program"), optimisation
strategy (size/speed), user defines such as hiding tape messages, disabling BOLD/ITALIC/scroll
support, screen offsets.

**Klive BASIC:** the same switches exist as header options (plan §5.3); the runtime selects
variants with `#if` on symbols the compiler predefines.

## 9. ROM dependency

Upstream uses the ROM for: the whole floating-point calculator, Float ↔ text (PRINT of Float,
STR, VAL), BEEP, PAUSE, INKEY key scanning, BORDER, scrolling, LOAD/SAVE/VERIFY, the BREAK test,
and error reports.

**Klive BASIC:** use the ROM **only** for the floating-point calculator, Float ↔ text conversion,
tape LOAD/SAVE/VERIFY and error reports. Everything else (PRINT including BOLD/ITALIC and all 24
rows, keyboard, PAUSE, BEEP, BORDER, scrolling, graphics) is Klive's own code. Reasons: the Next
harness's direct loader does not page the 48K BASIC ROM (`klive-integration-map.md` §7), programs
that page the ROM out keep working for everything except Float, and fewer ROM calls mean fewer
places where IY must be `$5C3A`.

## 10. Assembler features upstream's runtime relies on

Namespaces with absolute (`.core.X`) and relative names, `PROC/ENDP` with `LOCAL`, numeric
temporary labels (`1:` referenced as `1f`/`1b`), include-once with an architecture search path,
initialiser registration collected into the prologue, conditional assembly on compiler defines,
`EQU`, `DEFB/DEFW/DEFS/DEFM` (strings with doubled quotes), `ALIGN`, and `(ix+n)` operands.

**Klive BASIC:** irrelevant for its own runtime (written in Klive's dialect with `.module`,
`.proc`, `#if`). Relevant only to the zxbasm-dialect converter for user libraries (plan D10).

## 11. Debug-relevant upstream behaviour

- The label map (`-M`) lists address labels as `HHHH: label`, sorted; EQU and PROC-local labels
  excluded. NextBuild's fork prefixes banked labels with `B<n>:`.
- Upstream emits no per-statement line markers in generated assembly (only around inline asm
  blocks and include boundaries); with BREAK checking on, the BASIC line number is embedded before
  each check call — the only per-line trace in an upstream binary.

**Klive BASIC:** its own debug information (plan §8) replaces all of this.
