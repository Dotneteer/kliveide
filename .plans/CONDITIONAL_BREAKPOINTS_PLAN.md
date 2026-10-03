# Conditional Breakpoints Plan: Hit Counts, Register/Flag Conditions, Memory/Value Conditions

Status: **done — all phases (0–7) implemented and verified** (2026-10-03). G1.1–G1.3 are marked done
in the base plan. §9 records what was built, where it departs from the design above, and what is
left for G1.4/G1.5.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G1. This plan covers
**G1.1** (hit-count breakpoints), **G1.2** (register/flag conditions) and **G1.3** (memory and
value conditions). G1.4 logpoints, G1.5 DeZog source comments and G1.6 one-shot breakpoints are not
in scope, but §4.8 makes sure the expression engine built here is the one G1.4 and G1.5 reuse.
Related plans: `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` (the last extension of the same commands,
dialog and panel; its structure is mirrored here), `.plans/BREAKPOINT_MANAGEMENT_UI_PLAN.md` (the
dialog and panel).

> **Standing rule (from the base plan):** when this ships, update §2 and §4 of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) and mark G1.1–G1.3
> done in the base plan, in the same change.

---

## 1. What is being added

Today a breakpoint either stops the machine every time it is reached, or it is disabled. This plan
adds two independent filters that every breakpoint can carry — execution, memory read/write, I/O
read/write, NextReg write, and every binding shape (address, partition, bank-relative,
label-anchored, **source-bound**):

1. **A condition** — an expression over registers, flags, memory contents (current paging or a
   named bank), the value being read or written, the current paging, and program labels. The
   machine stops only if it is true.
2. **A hit-count rule** — stop on the Nth hit, before/after/from the Nth hit, or on every Nth hit.
   A hit is counted only when the condition (if any) is true.

Both are edited with the existing `bp-set` command, the existing Breakpoint dialog (which now also
opens for source breakpoints), and a new right-click menu in the editor's breakpoint margin. The
Breakpoints panel shows them with a live hit count that can be reset per breakpoint.

### 1.1 What the code already has (survey, 2026-10-03)

- `BreakpointInfo.hitCount` exists and `DebugSupport.addBreakpoint` copies it into
  `BreakpointData.targetHitCount` / `currentHitCount`, and sets `HIT_BP` — **but nothing ever reads
  them**: no stop decision consults the count, and no command or dialog control can set it. The
  dialog only *displays* `initial.hitCount`. So G1.1 replaces a dead stub. `BreakpointData` is also
  keyed **per address**, while several breakpoints can share an address (partition entries,
  bank-relative projections), so the stub's counter was in the wrong place anyway (§4.5).
- Every WASM machine (48K, 128, +3E, Next) runs a **per-instruction TypeScript debug loop**
  (`executeWasmV2DebugLoop`) and asks `shouldStopAtDebugPoint` (`DebugStepDecision.ts`) after every
  instruction. The interpreted machines do the same through `MachineFrameRunner`. **Evaluation can
  live entirely in TypeScript; the C cores need no change for G1.1 and G1.2.** G1.3 does need one,
  for the reason in the next bullets; it is Phase 0.
- The debug loop mirrors only `pc` per instruction; the full register file is pulled from the core
  by `syncCpuFromWasmV2` on exit. A condition therefore needs one register sync *when it is
  evaluated* — never on the fast path (§4.6).
- The cores record **one** data-memory access and **one** port access per instruction — each access
  overwrites the last (`zxnextCpuSharedReadMemory` / `…WriteMemory` in `zxnext-cpu.c`; the other
  cores alike). Opcode fetches are not recorded. See Q12 and Phase 0.
- The Next core has a side-effect-free read, `zxnextMemoryPeekMapped` (used by opcode fetch, no
  contention or bus-mirror update). Phase 3 finds or adds the equivalent in each core (R3).
- Program symbols reach the renderer as the last build's `compRes.symbols`, keyed lower-case, each
  with an `ExpressionValueType` — the Watch panel resolves its symbols from exactly that
  (`WatchPanel.tsx`). Conditions use the same source (§3.6).
- The command tokenizer has double-quoted strings with backslash escapes and keeps the escapes raw
  in the token text.
- The watch commands use `b`/`w`/`l` for byte/word/long; the access syntax here keeps the letters.
- The editor's glyph margin has a left-click toggle and no context menu; the Breakpoints panel's
  menu shows a disabled "Edit from the editor's left margin" for source rows (§4.4.2 replaces it).

---

## 2. Design decisions

| # | Decision | Why |
|---|---|---|
| C1 | The condition is stored **as text** in `BreakpointInfo.condition`. It is parsed into an evaluation tree **when the breakpoint is created or modified** — in the IDE to validate it, and again in the emulator's `DebugSupport.addBreakpoint` to arm it. The tree is cached beside the definition, never persisted or sent over IPC. | Text is the stable persisted form; the tree is an implementation detail. Parsing twice costs microseconds and the two sides cannot disagree about a stale tree. |
| C2 | One parser, in `src/common/utils/breakpoint-condition/`, imported by both the IDE renderer and the emulator. No reuse of the assembler's expression code. | Different operators, symbols and precedence; a dedicated grammar gives exact error ranges and exact type rules (§3.7). |
| C3 | **Bitwise and shift operators bind tighter than relational ones** (unlike C). | `A & $80 == 0` must mean `(A & $80) == 0`. Rust and Go made the same choice. |
| C4 | Values are exact integers (JavaScript numbers in the safe range). Unsigned accesses/registers yield non-negative values; signed accesses and `s8/s16/s32` yield two's-complement negatives. `+`, `-`, unary `-` and the six comparisons are **mathematical**, so signed and unsigned values compare correctly with each other. Truthiness is "non-zero"; `!`, `&&`, `||` and comparisons yield 0 or 1. | Signed support (Q4) without two comparison families. |
| C5 | **Shifts follow JavaScript exactly** (Q1): `a << n` and `a >> n` work on `ToInt32(a)` and yield a signed 32-bit result; `a >>> n` works on `ToUint32(a)` and yields an unsigned one; the count is `n & 31`. | The author's choice. Consequence, documented: `1 << 31` is `-2147483648`; write `(x << n) >>> 0` for an unsigned result, as in JavaScript. |
| C6 | `& \| ^ ~` work on 32 bits and yield an **unsigned** 32-bit result (`(a & b) >>> 0`), so `~0 == $FFFFFFFF`. Confirmed (F1). | Otherwise `l[HL] & $80000000 == $80000000` is false (JS gives a negative left side). |
| C7 | Endianness is a property of the **memory access** (Q2): `w[…]`/`l[…]` read little-endian, `wbe[…]`/`lbe[…]` big-endian. A literal is just a number. | Makes `<`, `>` and `&` meaningful for big-endian data too, with one place to look. |
| C8 | `'c'` is a **character literal** (a number, usable anywhere). `"…"` is a **string literal**, usable only as an operand of `==`/`!=` whose other operand is an **unsigned** memory access of exactly the string's length (1 → `b`, 2 → `w`/`wbe`, 4 → `l`/`lbe`). Anything else is a **syntax error at creation time**. | `w[HL] == 'A'` (word equals $0041) is a legitimate numeric test; `w[HL] == "A"` is a length mistake. |
| C9 | A string compares **in character order**: `"AB"` means `'A'` at the address and `'B'` at the next byte, whatever the access's endianness. The compiler folds the string into the number the access would read for those bytes. | The author's rule, at zero run-time cost. |
| C10 | **A constant out of range for the operand it is compared with is a parse error** (Q5): `b[HL] == $1234`, `A > 300`, `sb[IX] == $FF`, `ZF == 2` (§3.7 rule 3). | The author's choice; the same treatment as a wrong-length string. |
| C11 | A hit is counted only when the breakpoint matched **and** its condition is true (and active, C14). | VS / VS Code semantics; the only reading under which "every 10th time A is $FF" works. |
| C12 | The live hit counter is **runtime state per breakpoint definition** (keyed by storage key), not per address, and is not persisted. It resets **only** on a machine restart — *Start* after *Stop*, *Restart*, or a machine reset (Q13, F2) — and on an explicit reset — per breakpoint or all — from the command line, the Breakpoints panel, the dialog and the editor margin. Editing a condition or hit rule does **not** reset it. | The author's choice; fixes the per-address flaw of the stub. |
| C13 | `condition` and the hit rule are **not part of the breakpoint's identity**, like `disabled` and `nextRegCopper`. `bp-set` on an existing breakpoint replaces them; `bp-set` without `-if`/`-hit` clears them — `bp-set` states the whole breakpoint, as every other option already does. | One breakpoint per place; consistent with `-c`. |
| C14 | A condition that names a **label missing from the current symbol table is inactive** (Q8): the breakpoint never stops and never counts until a build defines the label. Labels are re-resolved **after every build**. | The author's choice. The panel and the margin show the state (§4.9). |
| C15 | A condition that fails to **parse** when the emulator arms it (a hand-edited project file, a grammar change) **stops the machine every time** and the panel shows the error. | Fail-safe for the case the IDE could not have validated. Contrast C14: a missing label is an expected, transient state; a syntax error is not. |
| C16 | Flags have names (Q3) — see §3.5. The base plan's example `A == $FF && !Z` becomes `A == $FF && !ZF`. | `C` and `H` are registers, so bare flag letters are ambiguous. |
| C17 | A bank-qualified access (Q6) names a partition with the `bp-set` spelling; **on a machine without banks the bank part is ignored** and the access reads the CPU address. | The author's choice: a condition written for a 128K still means something on a 48K. |
| C18 | **Z80 only** (Q9). The register/flag names are a Z80 profile; a breakpoint with a condition on a non-Z80 machine is rejected with a clear message. | Scope. The profile boundary keeps a 6510 profile a later, local addition. |
| C19 | Conditions are evaluated only in **debug runs**, as breakpoints are today. | Unchanged behaviour. |

---

## 3. The condition language

### 3.1 Examples

```text
A == $FF && !ZF
HL > $C000
(B & %0000_0111) == 3 || CF
(F & $28) != 0  ||  F3F || F5F      undocumented flags, two ways
[IX+3] == 0                         byte at IX+3 (same as b[IX+3])
w[$5C3A] > 100                      little-endian word
wbe[$8000] == $1234                 big-endian word: $12 at $8000, $34 at $8001
l[HL] == "KLIV"                     four bytes 'K','L','I','V' starting at HL
sb[IX+2] < -1                       signed byte
s16(HL) < 0                         HL as a signed 16-bit value
(A >> 4) == $0A                     high nibble
b[05:$C010] == $FF                  byte at offset $0010 of partition 05, whatever is paged in
w[0A:+$0100] == score               Next: word at offset $0100 of 16K bank $0A
VAL == $C9                          (memory/I/O/NextReg breakpoints) the value read or written
ADDR >= $5800 && ADDR < $5B00       (memory/I/O) the address or port accessed
page($C000) == @B5                  128K: bank 5 is paged at $C000
nr($56) == $0A                      Next: MMU slot 6 holds page $0A
w[score] >= 1000                    a program label
b[05:Flags] == 1                    Next: byte at bank-local label Flags of 16K bank $05
AF' == $0044
```

### 3.2 Grammar (precedence from lowest to highest)

```ebnf
condition   = logicalOr ;
logicalOr   = logicalAnd { "||" logicalAnd } ;
logicalAnd  = relation   { "&&" relation } ;
relation    = bitOr [ relOp bitOr ] ;              (* non-associative: a < b < c is an error *)
relOp       = "==" | "!=" | "<" | "<=" | ">" | ">=" ;
bitOr       = bitXor { "|" bitXor } ;
bitXor      = bitAnd { "^" bitAnd } ;
bitAnd      = shift { "&" shift } ;
shift       = additive { ( "<<" | ">>" | ">>>" ) additive } ;
additive    = unary { ( "+" | "-" ) unary } ;
unary       = { "!" | "~" | "-" } primary ;
primary     = number | charLit | stringLit | partitionLit
            | register | flag | special | label | bankLabel
            | memAccess | call
            | "(" condition ")" ;
memAccess   = [ accessType ] "[" [ partSpec ":" ] condition "]" ;   (* no type = unsigned byte *)
accessType  = "b" | "w" | "l" | "wbe" | "lbe"
            | "sb" | "sw" | "sl" | "swbe" | "slbe" ;                 (* "wle"/"lle"/"swle"/"slle" aliases *)
partSpec    = partitionLabel | bank ":+" ;                           (* see §3.4 *)
bankLabel   = bank ":" identifier ;     (* Next: a bank-local label, §3.6; inside "[...]" it is a read *)
call        = ( "page" | "nr" | "s8" | "s16" | "s32" ) "(" condition ")" ;
label       = identifier | "`" identifier "`" ;
```

The author's operator list (`== != < <= > >=`, `& | ^`, `! && ||`, parentheses, `<< >> >>>`) is
complete above. `+`, binary and unary `-`, and `~` are additions: `[IX+3]` needs `+`/`-`, signed
literals need unary `-`, and `~` is the bitwise partner of `!`. There is no `*`, `/` or `%`
operator; `%` is the binary-literal prefix.

### 3.3 Literals

| Form | Example | Notes |
|---|---|---|
| Decimal | `100`, `65_535`, `-1` | `_` as a digit separator. (`'` is not a separator here: it starts a character literal.) A negative number is unary `-` applied to a literal, folded at compile time. |
| Hexadecimal | `$FF`, `0xFF` | |
| Binary | `%1010`, `0b1010`, `%0000_0111` | |
| Character | `'A'`, `'\''`, `'\x7F'`, `'£'` | Exactly one character → its ZX Spectrum code. `''` or `'AB'` is an error that suggests a string literal. |
| String | `"AB"`, `"KLIV"`, `"a\"b"` | Only against an unsigned memory access of equal length (C8, C9). |
| Partition | `@B5`, `@R0`, `@0A` | A partition label as `bp-set` spells it, resolved by the machine's `parsePartitionLabel`; meaningful against `page(…)`. |

**Character set (Q7, both):** the three printable characters where the ZX Spectrum set differs from
ASCII are mapped automatically — `£` → `$60`, `©` → `$7F`, `↑` → `$5E` — and any code can be written
as `\xHH`. Every other character maps to its code point and must be ≤ `$FF`. Escapes: `\\`, `\'`,
`\"`, `\n`, `\r`, `\t`, `\0`, `\xHH`.

### 3.4 Memory access

| Syntax | Reads | Range |
|---|---|---|
| `[a]`, `b[a]` | 1 byte | 0 … 255 |
| `w[a]` / `wbe[a]` | 2 bytes, little- / big-endian | 0 … 65535 |
| `l[a]` / `lbe[a]` | 4 bytes, little- / big-endian | 0 … 2³²−1 |
| `sb[a]` | 1 byte, signed | −128 … 127 |
| `sw[a]` / `swbe[a]` | 2 bytes, signed, LE / BE | −32768 … 32767 |
| `sl[a]` / `slbe[a]` | 4 bytes, signed, LE / BE | −2³¹ … 2³¹−1 |

- **Unqualified** (`w[HL]`): memory **as the CPU sees it now** (current paging); the address is
  wrapped to 16 bits and consecutive bytes wrap `$FFFF → $0000`.
- **Partition-qualified** (`b[05:$C010]`): the `bp-set` spelling `<partition>:<address>`. The byte
  read is at offset `address mod pageSize` **inside that partition, whatever is paged in** — the
  same reading `bp-set 05:$C010` gives the address. Consecutive bytes wrap inside the partition.
- **Bank-relative, ZX Spectrum Next** (`b[0A:+$0100]`): the `bp-set` spelling
  `<bank>:+<offset>`, a 16K bank and an offset `$0000–$3FFF`.
- **Bank-local label, ZX Spectrum Next** (`b[05:Flags]`): the label-anchored breakpoint spelling
  `<bank>:<label>` (16K bank, as in `getBreakpointKey`'s label branch) — the byte at that label's
  offset inside the bank, whatever is paged in. Equivalent to `b[05:+<offset of Flags>]`.
- **Telling the three `X:` forms apart:** after the `:`, a `+` means a bank offset; an identifier
  means a bank-local label; anything else is the address of a partition-qualified read. To use a
  *global* label as that address, parenthesise it: `b[05:(score)]`.
- **On a machine without banks** the part before `:` is ignored (C17) and the access reads the CPU
  address; the label is not validated there.
- An unknown partition label or an out-of-range bank on a banked machine is a parse error.
- **Lexing:** inside `[`, a run of letters/digits immediately followed by `:` is a partition spec
  (partition labels never begin with `$`, `%` or `@`), so `b[05:$C010]` is unambiguous with
  `b[$05]`; there is no other use of `:` in the language.
- All reads are side-effect free: no contention, no floating-bus latch, no access-breakpoint trigger,
  no bus-mirror update (R3).

### 3.5 Names

Case-insensitive. **Reserved names win over labels**; a label that collides with one is written in
backticks: `` w[`ZF`] ``.

- **8-bit registers:** `A F B C D E H L I R IXH IXL IYH IYL` (also `XH XL YH YL`).
- **16-bit registers:** `AF BC DE HL IX IY SP PC WZ`, and the shadow set `AF' BC' DE' HL'`. A `'`
  *immediately* after one of these four names is a prime, never the start of a character literal.
- **Flags** (Q3), each 0 or 1:

  | Name | Bit | Flag |
  |---|---|---|
  | `SF` | 7 | sign |
  | `ZF` | 6 | zero |
  | `F5F` (alias `YF`) | 5 | undocumented — a copy of bit 5 of the result |
  | `HF` | 4 | half carry |
  | `F3F` (alias `XF`) | 3 | undocumented — a copy of bit 3 of the result |
  | `PVF` (aliases `PF`, `VF`) | 2 | parity / overflow |
  | `NF` | 1 | add/subtract |
  | `CF` | 0 | carry |

  `F5F`/`F3F` are the suggested primary names: they keep the `…F` pattern of the others and say
  which bit they are. `YF`/`XF` are accepted because that is what the Z80 literature (Sean Young's
  *The Undocumented Z80 Documented*) and several emulators call them.
- **Access specials** (only on memory read/write, I/O read/write and NextReg breakpoints; on an
  execution breakpoint they are a parse error):
  - `VAL` — the byte read or written (memory), the port value (I/O), the new register value (NextReg).
  - `ADDR` — the memory address or the full 16-bit port accessed.
- **Functions:**
  - `page(addr)` — the partition index paged in at `addr` now; compare it with `@label`. On a machine
    without partitions it is a parse error (unlike the access prefix of C17, which degrades
    gracefully, `page(…) == @B5` has no meaningful reading there).
  - `nr(reg)` — the current value of a Next register. Next only.
  - `s8(x)`, `s16(x)`, `s32(x)` — the low 8/16/32 bits of `x` read as two's complement.
- **Labels** — every other identifier (§3.6).

### 3.6 Labels (Q8)

- Any identifier that is not reserved is a **label reference**, looked up case-insensitively in the
  symbol table of the **last successful build** — the same `compRes.symbols` the Watch panel reads.
  Only integer symbols qualify; a string or boolean symbol makes the condition inactive with that
  reason.
- Resolution happens **after every build** and when a project is opened; the IDE pushes the integer
  symbol table to the emulator in one call (`setConditionSymbols`), and `DebugSupport` re-binds every
  compiled tree against it.
- A label not in the table makes the condition **inactive** (C14): the breakpoint never stops and
  never counts. At creation time an unknown label is therefore a **warning, not an error** — the
  command prints it and the dialog shows it under the field, but the breakpoint is accepted, because
  the next build may define it.
- Labels have no static range, so rule 3 of §3.7 does not apply to them.
- **NEX sidecar labels (F3).** When a `.nex` is debugged, the labels of its `.nex.dis` sidecar join
  the symbol table — the same table label-anchored breakpoints resolve through:
  - its **global** labels are plain identifiers (`w[score]`); where a build also defines the name,
    the build's value wins;
  - its **bank-local** labels are written `<bank>:<label>` (`05:Flags`), the label-anchored
    breakpoint spelling. Inside `[...]` that is a read from the bank (§3.4); anywhere else it is the
    label's **offset within its bank** (`$0000–$3FFF`), since a bank-local label has no Z80 address
    of its own. Bank-local labels exist only on the Next; elsewhere the form is a parse error.
  - The sidecar is re-read whenever it changes (a NEX launch, `nex-label`, the NEX annotation views),
    and the emulator re-binds as it does after a build. A missing local label makes the condition
    inactive exactly like a missing global one.

### 3.7 Static checks (all at creation/modification time)

The parser produces a tree and a checker walks it before the breakpoint is accepted. Each error
carries a message and a `[start, end)` range so the command can say "column 12" and the dialog can
underline it.

1. **Syntax:** unexpected token, unbalanced brackets/parentheses/quotes, chained comparison, empty
   condition, a bad escape, a character literal that is not one character, a number above 2³²−1,
   a character above `$FF`.
2. **Strings:** a string literal must be an operand of `==` or `!=` whose other operand is an
   unsigned memory access (parentheses allowed). Its length must be 1 for `b[]`, 2 for
   `w[]`/`wbe[]`, 4 for `l[]`/`lbe[]`. Messages: *"String "AB" has 2 characters but l[…] compares
   4"*, *"A string can only be compared (==, !=) with an unsigned memory access"*.
3. **Out-of-range constants (C10):** every operand kind has a static range — accesses (§3.4),
   8-bit registers 0…255, 16-bit registers 0…65535, flags 0…1, `VAL` 0…255, `ADDR` 0…65535,
   `nr()` 0…255, `s8/s16/s32` their signed ranges, `page()` the machine's partition index range. When
   one side of any of the six comparisons is such an operand and the other side folds to a constant
   outside that range, it is an error: *"$1234 is out of range for b[…] (0…255)"*. Compound
   expressions (`A & $0F`) are not range-checked; only direct operands are.
4. **Context:** `VAL`/`ADDR` on an execution breakpoint; `page()` on a machine without partitions;
   `nr()` and Next bank specs off the Next; an unknown partition label on a banked machine.
5. **Profile:** any condition on a non-Z80 machine (C18).
6. **Warnings (accepted):** labels not in the current symbol table (§3.6).

### 3.8 The evaluation tree

```ts
type CondNode =
  | { k: "num"; v: number }                         // literals, folded strings, @labels, constants
  | { k: "reg"; r: RegId }                           // flags are derived register reads
  | { k: "special"; s: "val" | "addr" }
  | { k: "label"; name: string; slot: number }      // bound to a value after every build
  | { k: "mem"; width: 1 | 2 | 4; be: boolean; signed: boolean;
      part?: { kind: "partition"; index: number } | { kind: "bank"; bank: number };
      addr: CondNode }
  | { k: "call"; fn: "page" | "nr" | "s8" | "s16" | "s32"; arg: CondNode }
  | { k: "un"; op: "!" | "~" | "-"; e: CondNode }
  | { k: "bin"; op: BinOp; l: CondNode; r: CondNode };
```

Constant sub-trees are folded. A compiled condition carries its tree, its label names, and a bound
label-value array (`slot` indexes it); binding sets `inactiveReason` when a label is missing.
Evaluation is a recursive walk; if profiling shows it matters, the same tree compiles to a closure
chain without changing anything else. The evaluator depends only on:

```ts
interface ConditionContext {
  reg(id: RegId): number;                                // after one register sync, §4.6
  readMemory(address: number): number;                   // side-effect free, current paging
  readPartition(partition: number, offset: number): number;  // side-effect free
  readBank(bank: number, offset: number): number;        // Next 16K bank
  partitionOf(address: number): number | undefined;
  nextReg?(reg: number): number;                         // Next only
  accessValue?: number;                                  // VAL
  accessAddress?: number;                                // ADDR
}
```

---

## 4. Design

### 4.1 The model — `BreakpointInfo`

```ts
/** The condition as typed. Parsed when the breakpoint is created or modified (C1). */
condition?: string;

/** The hit-count rule. Absent: every (condition-true) hit stops. */
hitMode?: "eq" | "gt" | "ge" | "lt" | "le" | "every";
/** The N of the rule. The existing field, finally given a meaning. */
hitCount?: number;
```

`hitCount` keeps its name, so the persisted shape does not churn; its doc comment becomes the rule's
N. A definition with `hitCount` and no `hitMode` (only possible from a hand-written file, since
nothing could set it) reads as `"eq"`.

Runtime-only, returned by `listBreakpoints` and stripped by every persister:

```ts
/** Times hit (condition true) since the last restart or reset. */
currentHits?: number;
/** The emulator could not parse `condition` (C15): the breakpoint stops every time. */
conditionError?: string;
/** A label in `condition` is not in the symbol table (C14): the breakpoint never stops. */
conditionInactive?: string;
```

`addBreakpoint` rebuilds definitions field by field (its comments record three bugs from omitted
fields), so the three persisted fields are added to that literal, with a round-trip test in
`BreakpointFlagIntegrity.test.ts`.

### 4.2 Hit-count rules (Q10)

| `-hit` spec | `hitMode` | Stops on hit number… |
|---|---|---|
| `10` or `=10` | `eq` | 10 only (until the counter is reset) |
| `>10` | `gt` | 11, 12, … |
| `>=10` | `ge` | 10, 11, … |
| `<10` | `lt` | 1 … 9 |
| `<=10` | `le` | 1 … 10 |
| `*10` | `every` | 10, 20, 30, … |

N must be 1–65535 (`<1` is rejected as never-true). A bare number means "equal", as the author asked.

### 4.3 The command grammar

`bp-set`, `bp-del` and `bp-en` keep their address grammar. Changes:

- **`bp-set <address-spec> … [-hit <spec>] [-if <condition>]`**
  - `-if` must be the **last** option, and **everything after it to the end of the line is the
    condition, verbatim** — no quoting needed: `bp-set $8000 -if A == $FF && l[HL] == "KLIV"`.
    If the whole remainder is a single double-quoted string, it is unquoted, so `-if "A == 1"` works
    too. This needs a small extension of `IdeCommandBase`: an optional `rawTailOption`; the base
    class finds that option by **token position** and hands the raw text after it to the command, so
    the tokenizer never sees `&&` or `[`, and a `[file:line]` source spec cannot be cut.
  - `-hit` takes the specs of §4.2. Phase 4 checks how the tokenizer splits `>=10` and `*10`; if it
    does not keep them as one token, `-hit` reads its argument from the raw text the same way.
  - Errors print as `Condition error at column 12: …` with a caret line under the condition;
    warnings (unknown labels) print in yellow and the breakpoint is set.
  - Works for source specs: `bp-set [main.asm:42] -hit *8 -if B == 0`.
- **`bp-del`, `bp-en`** accept and ignore `-if`/`-hit`, so a `bp-list` line can be edited into either.
- **`bp-list`** appends ` -hit >=10`, ` -if <condition>`, ` (hits: 3)` and, when relevant,
  ` <inactive: unknown label score>` or ` <condition error: …>` — so a line pasted back into
  `bp-set` recreates the breakpoint.
- **New `bp-reset-hits [<address-spec>]`** (alias `bprh`) — resets one breakpoint's counter, or all
  counters without an argument (C12).

### 4.4 The dialog, and conditions on source breakpoints (Q11)

#### 4.4.1 New fields, for every kind

`BreakpointDialog` gains, under the existing rows:

- **Condition** — a single-line monospace text input, validated on every keystroke by the same
  parser through `validateBreakpointForm` (new `condition` field in `BreakpointFormState`, error in
  `FieldErrors`, warnings in a new `FieldWarnings`). The message shows under the field with the
  column; it is also the field's accessible description. The placeholder shows two examples; a
  "Syntax" link opens the docs section.
- **Hit count** — a select (`Always`, `Equal to`, `Greater than`, `At least`, `Less than`,
  `At most`, `Every`) and a numeric field enabled for all but `Always`.
- **Hits so far: N  [Reset]** — shown only when editing an existing breakpoint; replaces today's
  read-only "Hit count" hint.

The checker's machine facts (§3.7 rules 3–5) come from `BreakpointEnvironment`, extended with
`hasPartitions`, `isNext`, `cpu` and the current symbol names; the access kind comes from the form's
own `kind`, so changing the kind re-validates `VAL`/`ADDR`.

#### 4.4.2 Source breakpoints — the suggested UI

Source breakpoints stay *placed* by the editor (clicking the margin, tracked as lines move, undo/redo
in the editor). What changes is that their **condition and hit rule** can be edited:

1. **The dialog, in "source" mode.** The kind selector, address and partition rows are replaced by a
   read-only **Location** row: `main.asm:42` plus the resolved address (`$8012`, or "not resolved —
   build the project"). Only Condition, Hit count and Hits so far are editable. Same component, same
   form module, one more mode flag — so validation cannot diverge between the two kinds.
2. **A right-click menu in the editor's breakpoint margin** (new; today only left-click exists):
   - on a line **with** a breakpoint: *Edit Condition…*, *Edit Hit Count…* (both open the dialog in
     source mode, focused on that field), *Disable/Enable Breakpoint*, *Reset Hit Count*,
     *Remove Breakpoint*;
   - on a line **without** one: *Add Breakpoint*, *Add Conditional Breakpoint…* (adds the breakpoint
     and opens the dialog on the Condition field; *Cancel* removes it again).
   The same menu applies to the inline statement markers (column breakpoints).
3. **The Breakpoints panel:** *Edit breakpoint…* is enabled for source rows (source mode) instead of
   the disabled "Edit from the editor's left margin" hint; new *Reset hit count* and *Reset all hit
   counts* items for every row.
4. **Glyphs** (margin, disassembly, memory views): a **conditional** variant (the dot with a small
   `=` mark, the VS Code convention), and an **inactive** variant (hollow dot) for C14 and for a
   breakpoint whose condition failed to arm. Hovering any breakpoint glyph shows a tooltip with the
   condition, the hit rule, the hit count and, when inactive, the reason.

*Considered and deferred:* a VS Code-style inline editor (a Monaco zone widget under the line with
an Expression / Hit Count switch). It is quicker to type into, but needs its own validation display
and focus handling inside Monaco; it can be added later on top of the same form module.

Per `AGENTS.md`, every rule stays in `breakpoint-form.ts` (no React, tested in the node project).
`.ai/ui-mvc-guide.md` is read before Phase 5; the dialog has no new async orchestration beyond the
"Add Conditional Breakpoint… → Cancel removes it" flow, which lives in the margin's action code.

### 4.5 `DebugSupport`

- New flag `COND_BP = 0x1000` in `breakpointFlags`: set where at least one definition has a condition
  **or** a hit rule (`HIT_BP` keeps marking the latter and finally gets a reader). Derived in
  `refreshFlagsAt` / `collectBpFlags` / the I/O mask loop like the other bits.
- **The fast path does not change**: an address without `COND_BP | HIT_BP` is decided exactly as now,
  with no context, no register sync and no allocation.
- With the bit set, the **slow path** enumerates the definitions that claim the address (the existing
  `claimsAddress`, which understands partitions, bank-relative and label-anchored shapes; source
  breakpoints through their resolved address). For each enabled one whose partition matches:
  inactive → skip; otherwise evaluate (a parse error counts as true, C15), increment the counter if
  true, apply the hit rule. The machine stops if **any** definition says stop. Every definition at
  the address is evaluated, so each counter stays correct.
- Per-definition runtime state: `Map<storageKey, { compiled?, error?, hits }>`;
  `BreakpointData.targetHitCount` / `currentHitCount` are deleted.
- `hasMemoryRead`, `hasMemoryWrite`, `hasIoRead`, `hasIoWrite` and `hasNextRegWrite` take the same
  slow path, with `accessValue` / `accessAddress` set from the bus mirror or the NextReg hit.
- New `IDebugSupport` methods: `setConditionSymbols(symbols)` (re-binds every tree, §3.6) and
  `resetHitCounts(key?)`.
- **Counter lifetime (C12):** kept across pause/resume, step, and edits of the breakpoint; zeroed on
  machine restart — *Start* after *Stop*, *Restart*, and a machine reset (F2) — and by
  `resetHitCounts`. Resuming from a pause is not a restart. A breakpoint removed and re-added
  starts at zero, since it is a new definition.
- **Live count in the panel:** counting must not dispatch per hit (a hot loop would flood the store).
  `DebugSupport` sets a dirty bit; the machine controller dispatches a new
  `incBreakpointHitsVersionAction` at most every 10 frames while running and once on pause. The
  panel adds `breakpointHitsVersion` to its refresh dependencies.

### 4.6 The debug loop and the stop decision

- `shouldStopAtDebugPoint` calls `debugSupport.shouldStopAt` **before** the `lastBreakpoint`
  re-trigger guard. Harmless while the call had no side effects; with counting it would count the
  instruction a run *resumes from*. The order changes to guard first, then the full decision — the
  reasoning the existing comment gives for consuming one-shots inside the guard. A test in
  `test/emu/debug-step-decision.test.ts` pins it.
- `DebugStopDecisionInput` gains `getConditionContext: () => ConditionContext`, a lazy factory each
  machine implements once. The WASM machines call `syncCpuFromWasmV2` once and serve registers from
  the mirrored fields (simpler than adding getters for `I`, `R`, `WZ` and the shadow set to four
  loaders), and read memory through side-effect-free exports (R3). The interpreted path reads the
  TypeScript CPU directly. The Z88 machine is included in Phase 3's survey of callers.
- Stepping onto a conditional breakpoint evaluates and counts it like a run does.

### 4.7 Persistence

`condition`, `hitMode` and `hitCount` persist wherever the breakpoint is persisted today (the
project file, the `.nex.dis` sidecar); the runtime fields are stripped. Phase 1 audits every
persister and every place that filters breakpoint fields (`nexBreakpointSync.ts`,
`src/main/kbasic/breakpoints.ts`, `breakpoint-actions.ts`, the editor's source-breakpoint refresh
and its line tracking/undo) with save/load round-trip tests — a source breakpoint that moves with
its line must keep its condition.

### 4.8 Reuse by the rest of G1

- **G1.4 logpoints** — `"x={A} at {PC}"`: each `{…}` is parsed with this grammar's `bitOr` entry
  point and evaluated with the same context.
- **G1.5 DeZog ASSERTION / WPMEM** — DeZog's expression syntax differs; when G1.5 is planned its
  comments are translated into this tree, not parsed by a second engine.

### 4.9 The Breakpoints panel

Each row shows the condition (truncated, full text in the tooltip), the hit rule and the live count.
An inactive condition renders muted with the reason in the tooltip; a condition error renders in the
error colour. Colours come from tokens only; `.ai/ui-theming-intent-and-lessons.md` is updated in the
same change (standing rule).

---

## 5. Phases

Each phase ends green on its focused tests, `npm run build:check`, and — when renderer React code is
touched — `npm run lint:renderer`.

### Phase 0 — exact per-instruction memory accesses in the cores (Q12) — done

Done first because it needs nothing else from this plan: today's `bp-set <addr> -r` / `-w`
breakpoints are enough to test it, and it fixes misses they already have.

**The problem.** After each instruction, the debug loop asks the core which memory the instruction
touched. Every core keeps that in one set of scalars (address, value, read/write) that **every data
access overwrites**, so only the instruction's *last* access survives:

| Instruction | Real accesses | Reported | Today's miss |
|---|---|---|---|
| `LD ($8000),HL` | W `$8000`, W `$8001` | W `$8001` | write breakpoint on `$8000` never fires |
| `PUSH`, `CALL nn`, `RST` | 2 stack writes | the second | the other stack byte |
| `LD HL,($8000)` | R `$8000`, R `$8001` | R `$8001` | read breakpoint on `$8000` |
| `INC (HL)`, `RLC (HL)`, `SET b,(HL)` | R `(HL)`, W `(HL)` | the write | any **read** breakpoint |
| `LDI` / `LDIR` | R `(HL)`, W `(DE)` | the write | read breakpoint on a copy's source |
| `EX (SP),HL` / `EX (SP),IX` | 2 R, 2 W | the last write | both reads and the first write |

The TypeScript side is already built for more: the interpreted `Z80Cpu` records up to 8 reads and
8 writes per instruction (`lastMemoryReads` / `lastMemoryWrites`, `Z80Cpu.ts:717-729`), and
`DebugSupport.hasMemoryRead` / `hasMemoryWrite` already loop over a list. Only the WASM cores feed it
a single entry (`importWasmV2BusAccess` in each machine).

**Where each core records today** (survey, 2026-10-03):

| Core | Recording site | Gated to debug runs? |
|---|---|---|
| 48K | `sp48CpuReadMemory` / `sp48CpuWriteMemory` (`sp48-memory.c`) | yes — `sp48CaptureBusEvents` is off inside `sp48ExecuteFrame` |
| 128K | `sp128.c` CPU read/write (~lines 728, 789) | check in Phase 0 |
| +3E | `spp3e.c` CPU read/write (~lines 1090, 1100) | check in Phase 0 |
| Next | **two** sites: `zxnextCpuSharedReadMemory` / `…WriteMemory` (`zxnext-cpu.c:282-308`) **and** `zxnextMemoryReadMapped` (`zxnext-memory.c`) | no |

Two Next-specific defects follow from recording inside `zxnextMemoryReadMapped`, which is not a
CPU-only path:

- **DMA reads are recorded as if the CPU made them** (`zxnext-dma.c:391` calls it), so a DMA
  transfer between instructions can overwrite or fake the CPU's access record.
- **The `zxnextReadMemory` export records too** (`zxnext.c:302`). The IDE uses it for
  `get64KFlatMemory` (the memory views), so an IDE read clobbers the access record — and it is not
  usable as the side-effect-free read conditions need (R3).

**The change.**

1. **A per-instruction access log in each core.** Replace the scalars with a small static log of
   entries in access order, each packed in one `uint32_t`: bits 0–15 address, 16–23 value, bit 24
   write. Capacity 8 with a saturating count (no Z80/Z80N instruction needs more than 4 —
   `EX (SP),IX` — so 8 also covers an interrupt acknowledge falling into the same step: two pushes
   plus an IM2 vector read). An overflow sets a flag the tests assert is never raised.
2. **CPU accesses only.** Recording happens in the CPU bus functions and nowhere else; on the Next
   it is removed from `zxnextMemoryReadMapped`, so DMA traffic and IDE reads no longer touch it.
   (DMA watchpoints are out of scope; DMA simply stops being misreported as CPU activity.) The log
   is cleared at instruction start, where the scalars are cleared today.
3. **Gated like the 48K.** Every core records only while bus capture is on (debug loop), so the
   fast `…ExecuteFrame` path pays nothing; `sp48CaptureBusEvents` is the model.
4. **One crossing to read it.** Each core exports the log's address and a count
   (`…GetAccessLogPtr`, `…GetAccessLogCount`); TypeScript keeps a `Uint32Array` view on the WASM
   memory, the same arrangement as the Next's NextReg watch table. That replaces the six or so
   `…GetLastMemory*` calls per instruction with one count read plus array reads. The old
   `…GetLastMemoryAddress/Value/IsWrite/Accessed` exports are **removed**, not kept beside the new
   ones (`AGENTS.md`: no compatibility wrappers); loaders, machines and the loader tests that name
   them are updated.
5. **TypeScript.** `importWasmV2BusAccess` in the four machines fills `lastMemoryReads` /
   `lastMemoryWrites` from the log, plus new parallel value arrays (`lastMemoryReadValues` /
   `lastMemoryWriteValues`) that Phase 3 uses for `VAL`, so each matched address gets **its own**
   byte (a breakpoint on `$8000` sees L, on `$8001` sees H). The scalar `lastMemoryReadValue` /
   `lastMemoryWriteValue` the CPU panel shows stay, holding the last read / write.
6. **I/O is unchanged.** No instruction makes two port accesses (`INI`/`OUTI` are one port plus one
   memory access), so the single port record is already exact.

**Tests.**

- Loader/core tests (`test/zxSpectrum/sp48|sp128|spp3e-wasm-v2-loader.test.ts`,
  `test/wasm/zxNext/wasm-next-loader.test.ts`, `test/wasm/zxSpectrum/wasm-debug-step.test.ts`): for
  every row of the table above, the log holds exactly the expected accesses, in order, with values,
  on all four cores; the overflow flag stays clear; nothing is logged in a fast frame.
- Next-specific: a DMA transfer between two instructions leaves the CPU's log untouched; a
  `zxnextReadMemory` call from the IDE leaves it untouched.
- Real-machine breakpoint tests through `test/harness/sp48/` and `test/harness/zxnext/`, using
  only today's breakpoints: a write breakpoint on the low byte of `LD ($8000),HL` stops; a read
  breakpoint on an `LDIR` source stops; a read breakpoint on `INC (HL)`'s address stops; a breakpoint
  on a `PUSH`'s first stack byte stops. Missing harness capabilities are added as session methods.
- Performance: the `perf` project shows no regression in normal (non-debug) frames.

### Phase 1 — model, keys and persistence (nothing user-visible) — done
`BreakpointInfo` fields (§4.1); `addBreakpoint` literal; storage key unchanged (test that condition
and hit rule are not in it); persister audit and round-trip tests (§4.7).

### Phase 2 — the condition engine — done
`src/common/utils/breakpoint-condition/`: lexer, parser, checker, constant folder, binder, evaluator,
`ConditionContext`. Exhaustive node-project tests: every operator and precedence level, JS shift
semantics (`1 << 31`, `-8 >> 1`, `-8 >>> 28`, count masking), signed accesses and `s8/s16/s32`,
every literal and escape, the ZX character mapping, `AF'` lexing, partition-spec lexing, backtick
labels, bank-local labels (inside and outside brackets, and the `05:(score)` disambiguation),
every §3.7 error with its range, string folding for all four width/endianness combinations,
out-of-range constants on every operand kind, wrap-around at `$FFFF` and at a partition's end,
label binding and the inactive state.

### Phase 3 — `DebugSupport` and the debug loops — done
`COND_BP`, the slow path, per-definition state, counters and resets, symbol binding, the guard
reordering, `getConditionContext` in every machine that calls `shouldStopAtDebugPoint` (survey
first), side-effect-free memory/partition/bank reads per core, the throttled hits-version dispatch,
`setConditionSymbols` called after every build and on project open.
Tests: `DebugSupport` unit tests (every hit mode; two definitions at one address with different
partitions and conditions; disabled and inactive definitions not counted; I/O mask; reset rules;
counter survives an edit) and **real-machine tests** through `test/harness/sp48/` and
`test/harness/zxnext/` — a `B == 3` breakpoint in a DJNZ loop, `-hit *4` and `-hit >5`, a
memory-write breakpoint with `VAL == $AA`, a partition-qualified read with a different bank paged in
(128K and Next), `page($C000) == @…`, `nr($56)` on the Next, a 48K run of a bank-qualified
condition (prefix ignored), and a NEX with a sidecar using a global and a bank-local label. Missing harness capabilities are added as session methods.

### Phase 4 — commands — done
`rawTailOption`; `-if` and `-hit` on `bp-set` (accepted on `bp-del`/`bp-en`); `bp-list` output;
`bp-reset-hits`. Tests for every validation message, the caret output, warnings, and that every
`bp-list` line pasted back into `bp-set` recreates the same breakpoint.

### Phase 5 — the dialog — done
Form state, validation, warnings and the source mode in `breakpoint-form.ts` (node tests); the
controls in `BreakpointDialog.tsx` (jsdom, extending `test/controls/BreakpointDialog.test.tsx`).

### Phase 6 — editor margin, panel and glyphs — done
The margin context menu (§4.4.2), the panel's new items and columns, the conditional and inactive
glyph variants and their tooltips, live count refresh. Verified in the running app (CDP recipe in
`.ai/ui-theming-intent-and-lessons.md`), not in a replica.

### Phase 7 — docs, roadmap, lessons — done
`docs/content/working-with-ide/breakpoints.mdx` (a "Conditions and hit counts" section with the §3
reference) and `docs/content/commands-reference.mdx`; `npm run doc:build && npm run doc:check`. Mark
G1.1–G1.3 done in the base plan; update §2/§4 of `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`; theming
lessons file for Phase 6's visuals.

---

## 6. Risks

- **R1 — hot loops.** A conditional breakpoint inside a tight loop costs one register sync, a tree
  walk and a few memory reads per pass. Acceptable at first; the measured cost goes into §9 after
  Phase 3. A later step could evaluate simple register-only trees in C.
- **R2 — the core change touches four cores.** Phase 0 edits the bus functions of the 48K, 128K,
  +3E and Next cores and removes exports. The per-row instruction tests on every core, the existing
  loader tests and the `perf` project are what keep it honest; it goes first so later phases build
  on an access record already proven exact.
- **R3 — debug reads with side effects.** A read that touches contention, the floating-bus latch or
  I/O-mapped state would let a condition perturb the machine. The Next core's `zxnextMemoryPeekMapped`
  is the model; Phase 3 verifies or adds the equivalent (and partition/bank reads) in every core.
- **R4 — the command tokenizer.** `-if` as a raw tail changes how one option is parsed; the split is
  based on token positions so a quoted spec or a `[file:line]` spec cannot be cut.
- **R5 — label/register collisions.** A program label called `C` or `VAL` is shadowed by the reserved
  name. The backtick form exists for that, and the dialog's warning names the shadowing when a
  reserved name is also a symbol in the current table.

---

## 7. Verification

- Unit: engine (Phase 2), `DebugSupport`, `DebugStepDecision`, commands, form.
- Real machine: the sp48 and zxnext harness tests (Phase 3).
- In the IDE: set each example of §3.1 by command, by dialog and (for source breakpoints) from the
  margin menu; run, and confirm the stop, the panel count, reset per breakpoint, and the glyph
  variants; rebuild after renaming a label and confirm the condition goes inactive and comes back;
  save, reopen the project and confirm conditions survive and counters are zero.

---

## 8. Out of scope

G1.4 logpoints, G1.5 DeZog source comments, G1.6 one-shot breakpoints (all reuse this engine later);
data breakpoints without an address ("stop when HL changes"); conditions evaluated in C; non-Z80
machines.

---

## 9. Implementation notes

### Phase 0 — verification (2026-10-03)

The handoff checklist ran green on a fresh `npm run build:all-wasm`: the full unit suite (901 files,
22 448 tests), the Z80 WASM corpus (1 473), `npm run build:check` and
`npm run check:wasm-cpu-contract`. No test had pinned the old single-record behaviour.

### Phase 1 — what was built

- **Model** (`BreakpointInfo`): `condition`, `hitMode` (type `BreakpointHitMode`), `hitCount` (the old
  stub, now the rule's N), and the runtime-only `currentHits`, `conditionError`, `conditionInactive`.
- **`src/common/utils/breakpoint-filters.ts`** — type-only imports, so the main process can use it:
  `breakpointFiltersOf` (the normalised persisted subset: a blank condition and a mode without a
  count are dropped), `effectiveHitMode` (a bare count is `eq`), `sameBreakpointFilters`,
  `withoutBreakpointRuntimeState`, and `readStoredBreakpointFilters` (validates a stored entry; a bad
  field is dropped with a message and the breakpoint kept — it then stops every time, the safe way).
  Phase 4's `-hit` parser and Phase 5's form should use `BREAKPOINT_HIT_MODES`,
  `MAX_BREAKPOINT_HIT_COUNT` and `isValidBreakpointHitCount` from here.
- **`DebugSupport.addBreakpoint`** spreads `breakpointFiltersOf(bp)` into its literal, so runtime
  fields handed back from a `listBreakpoints` round trip are never stored. **Phase 3 must keep the
  per-definition hit state outside `breakpointDefs`**: `resetBreakpointsTo` (undo/redo, dialog
  edits that move a key, NEX label resolution) rebuilds every definition, and C12 says counters
  survive edits. The `HIT_BP` / `BreakpointData.targetHitCount` stub is untouched until Phase 3.
- **Existing bug fixed:** the literal also dropped `column`, so a statement breakpoint was listed —
  and saved — as a line breakpoint on the same line (its storage key still had the column).
- **Persisters.** The project save strips runtime state (so a moving counter never rewrites the
  file) and so does the project load. The `.nex.dis` sidecar stores the three fields on both
  shapes (`NexSidecarBreakpointFilters`), its reader validates them with warnings, and
  `to/from/sameSidecar*Breakpoints` carry and compare them. Additive fields, no schema bump (as
  `labelBreakpoints` was); the project's breakpoint schema stays 1 for the same reason.
- **Audited, nothing to change:** the editor's undo/redo (`resetBreakpointsTo` with listed
  snapshots), statement re-anchoring (spreads `...bp`), `scrollBreakpoints` / `renameBreakpoints`
  (mutate the stored definition), `normalizeBreakpoints` (only deletes), `refreshSourceCodeBreakpoints`
  and `resolveBreakpoint` (resolve by key), `applyBreakpointEdit` (whole-set round trip), the NEX
  label resolution, and `src/main/kbasic/breakpoints.ts` (persists nothing).
- **Tests:** `test/debug/breakpoint-filters.test.ts` (filters out of the key for all nine binding
  shapes, normalisation, stored-entry validation), `BreakpointFlagIntegrity.test.ts` (filters stored
  on every shape; runtime state never stored; C13 replacement; survival through
  `resetBreakpointsTo`, line scrolling, rename, disable/enable; the `column` fix),
  `test/renderer/nexBreakpointSync.test.ts` (both sidecar shapes, round trips, change detection,
  reading with warnings), `test/main/save-klive-project.test.ts` (filters saved, runtime state not,
  no rewrite when only a counter moved).

### Phases 2–7 — what was built (2026-10-03)

**Verification.** Full unit suite green (909 files, 22 947 tests at the last full run, after Phase 6),
`npm run build:check` (no new type errors), `npm run lint:renderer` (0 errors), the Vite build,
`npm run doc:build && npm run doc:check`. Phase 6 was checked in the running app over CDP against
`~/KliveProjects/sp48-1` (its `klive.project` restored afterwards): the margin menu, the "=" and
hollow glyphs, the dialog in source mode, the panel's filter cells, and a `-hit *3` source
breakpoint stopping on the third pass with the live count reading 3.

**Engine (Phase 2)** — `src/common/utils/breakpoint-condition/`: `condition-types.ts`,
`condition-lexer.ts`, `condition-parser.ts` (syntax tree with spans), `condition-checker.ts`
(`compileCondition`, `bindCondition`, §3.7 checks, string and constant folding),
`condition-evaluator.ts`, `condition-machine.ts` (`conditionMachineFacts`, the one builder of
machine facts used by the IDE *and* the emulator). Tests: `test/debug/breakpoint-condition.test.ts`.
Departures from §3.8: flags are their own node (`{k:"flag", bit}`) rather than register reads;
`ConditionContext.readPartition(partition, address)` takes the *address* and the context wraps it by
the partition's real size (a Next ROM partition is 16K, a RAM page 8K, so no single
`partitionSize` is right); a bank-local label is a symbol keyed `bankLocalSymbolKey(bank, name)`;
the first error stops compilation (one diagnostic, with its range).

**Emulator (Phase 3).**
- `DebugSupport`: `COND_BP`, the slow path `decideFiltered` / `passesFilters`, a per-definition
  runtime map (counter + compiled condition) kept **outside** `breakpointDefs` so
  `resetBreakpointsTo` keeps counters (pruned for removed keys; moved with `scrollBreakpoints` /
  `renameBreakpoints`), `setConditionEnvironment`, `setConditionSymbols` (dispatches
  `breakpointsVersion` only when an inactive state changed), `resetHitCounts`, `takeHitsChanged`,
  `listBreakpointsWithState`. The `BreakpointData.targetHitCount/currentHitCount` stub is gone.
- **Departure from §4.6:** the context arrives through `debugSupport.conditionContextProvider`
  (set once per machine by `connectConditionSupport` in `src/emu/machines/conditionContext.ts`),
  not a new `DebugStopDecisionInput` field, so the six stop-decision call sites and the access
  checks needed no new parameter. `Z80MachineBase.getConditionContext` reads the partition views;
  each WASM machine syncs its registers first and uses its own side-effect-free read (`sp48ReadMemory`,
  `sp128ReadMemory`, `zxnextReadMemory` (= peek) and `zxnextPeekNextRegister`, `z88ReadMemory`); the
  **+3E uses the partition views** because `spp3eReadMemory` latches the floating-bus value (R3).
- Access checks pass the per-access values (`lastMemoryReadValues`/`WriteValues`, the port value)
  and are all evaluated, not short-circuited. The **Z88** core keeps no per-access values, so its
  `VAL` is read back from memory: exact for writes, for reads unless the same instruction wrote the
  byte afterwards.
- The re-trigger guard runs before `shouldStopAt` (§4.6). Counters reset in `MachineController.run`
  on a start from Stopped/None; `incBreakpointHitsVersionAction` is published every 10 frames and
  on every run end.
- Symbols: `src/renderer/appIde/utils/condition-symbols.ts` merges the build's integer symbols (set
  in `refreshSourceCodeBreakpoints`, which every build path calls) with each NEX sidecar's labels
  (set in `useNexSidecarBreakpointSync`); the build wins; cleared on project load; a new machine
  inherits the table.
- Tests: `test/debug/DebugSupport-conditions.test.ts`, `test/emu/conditional-breakpoints-real-machine.test.ts`
  (sp48 and zxnext harnesses, plus the 128K and +3E through `test/wasm/zxSpectrum/wasm-test-helpers.ts`
  — there is no 128K harness), the guard test in `test/emu/debug-step-decision.test.ts`.
- **R1, measured** (sp48, 65 536 passes of a `NOP; DJNZ` loop, breakpoint on the `NOP`): no
  breakpoint 389 ns/pass; a hit rule alone 498 ns; a register or memory condition ≈2.5 µs — almost
  all of it the WASM register sync and context build. Addresses without filters pay nothing.

**Commands (Phase 4).** `CommandArgumentInfo.rawTailOption` + `splitRawTail` in `ide-commands.ts`
(text-level, respects quotes and `[...]`); `IdeCommandService` cuts the line before tokenizing
(the tokenizer silently drops `==` and `&&`). `-hit` is a plain string option (its specs tokenize
whole). `parseHitSpec` / `formatHitSpec` live in `breakpoint-filters.ts`. **`bp-list` departs
from §4.3's single line:** the first line is pure `bp-set` syntax (spec, kind options, `-hit`,
`-if` last) and the state (`<disabled>`, `(hits: N)`, `<inactive: …>`, `<condition error: …>`)
goes on an indented second line, because anything after `-if` would become part of the
condition. Tests: `test/commands/breakpoint-condition-commands.test.ts`.

**Dialog (Phase 5).** Form fields `condition`, `hitMode`, `hitCount`, `source` (source mode keeps
the editor's breakpoint, its resolution and column, and drops runtime state); `FieldWarnings` via
`breakpointFormWarnings`; `BreakpointEnvironment` gained `machineId` and `conditionSymbols` (the
plan's `hasPartitions`/`isNext`/`cpu` are derived by `conditionMachineFacts`). The dialog takes
`focus` and `onResetHits`; `useBreakpointDialog` re-reads the breakpoint from a fresh listing. The
"Syntax" link uses `MainApi.showWebsite(docsPath)`, which now accepts a site-relative path.

**Margin, panel, glyphs (Phase 6).** `marginBreakpointMenu.ts` (items and actions, including
"Add Conditional Breakpoint… → Cancel removes it"), `breakpoint-filter-text.ts` (one wording and
the glyph predicates), `bp-conditional.svg` / `bp-inactive.svg`, the Monaco mask classes (also on
the *unreachable* glyph, so a condition shows before the first build), `⊜`/`○` statement markers.
Source rows are editable from the panel and the disassembly gutter. Also fixed: the indicator's
tooltip printed a stray `)`.

**Docs (Phase 7).** `breakpoints.mdx` ("The Editor's Breakpoint Margin", "Conditions And Hit
Counts"; the memory-read type no longer claims opcode fetches count), `commands-reference.mdx`
(`-hit`, `-if`, `bp-list` format, `bp-reset-hits`, and the source spec example now has its line).

**Fix after review (2026-10-03): breakpoints only in debug runs.** A `-hit 4` breakpoint on $38
never fired when a compiled program was started in debug mode. The code-injection flow boots the
ROM with `ReachExecPoint`, a `NoDebug` run that still goes through the per-instruction loops, and
`MachineController.run` handed those loops the breakpoint store, so the boot's IM 1 interrupts were
counted: the 4th hit silently ended the boot step and the program's own hits started at 5. (A plain
$38 breakpoint had the same latent defect, invisible because it stops every time.) `run` now
attaches the store only when `debugStepMode !== NoDebug` (C19), and `executeInjectionFlow` resets
the counters, since a restored boot checkpoint skips the reset in `run`. Test:
`test/emu/conditional-breakpoints-injection-flow.test.ts` (real 48K under a real `MachineController`).

**For G1.4/G1.5:** a logpoint's `{…}` fields can use `parseCondition` → the checker; the parser's
`bitOr()` entry is not exported yet (export it, or wrap a field as `(…)`). `passesFilters` is the
place a logpoint would format and resume instead of stopping.

### Phase 0 — what was built

- **One log, in the shared core.** The log lives in `src/emu/z80/wasm/z80.c` (`z80AccessLog`,
  `z80AccessLogCount`, `z80AccessLogOverflows`), not in each machine: only the shared core knows
  whether a read is data or a code fetch. `readMemory` / `writeMemory` record when
  `Z80_CAPTURE_BUS_EVENTS()` is on; opcode, displacement and operand fetches go through a new
  `readCodeMemory` that never records. `z80ClearBusEvents` and `z80Reset` clear the log. A new hook,
  `Z80_MEMORY_WRITE_SUPPRESSED()`, keeps the Next's stackless-NMI pushes (which never reach memory)
  out of the log.
- **Correction to §1.1 ("Opcode fetches are not recorded").** That was wrong: the 48K, 128K and +3E
  recorded opcode *and* operand fetches, and the Next opcode fetches - only hidden because each later
  access overwrote them. The log now records **data accesses only**, which is what a memory
  breakpoint means. The interpreted TypeScript `Z80Cpu` and the Z88 core (which has its own lists)
  still count opcode fetches as reads; they were left unchanged. The copied `memoryOp.test.ts` stays
  excluded from the WASM Z80 corpus for that reason (`test/wasm/z80/unsupported-tests.md`).
- **Exports.** Each core exports `…GetAccessLogPtr`, `…GetAccessLogCount`, `…GetAccessLogOverflows`
  (`sp48`, `sp128`, `spp3e`, `zxnext`); the `…GetLastMemory*` exports are removed. The standalone Z80
  test build exports `z80AccessLogPtr` / `z80GetAccessLogCount` / `z80GetAccessLogOverflows`.
- **Gating.** The Spectrum cores already turned capture off in `…ExecuteFrame`. The Next gained
  `zxnextCaptureBusEvents`, off in `zxnextFrameExecute` **unless the frame trace is on** (the trace
  records the instruction's last data access, so it needs the log in fast frames too).
- **Next: CPU accesses only.** `zxnextMemoryReadMapped` / `WriteMapped` no longer record anything,
  so DMA transfers and the IDE's `zxnextReadMemory` export cannot touch the CPU log;
  `zxnextMemoryReadMapped` is now `zxnextMemoryPeekMapped`.
- **TypeScript.** `src/emu/machines/wasmAccessLog.ts` (`importAccessLog`) fills `lastMemoryReads` /
  `lastMemoryWrites` and the new parallel `lastMemoryReadValues` / `lastMemoryWriteValues` (added to
  `Z80Cpu`, which fills them too) from a `Uint32Array` view the loaders create (`runtime.accessLog`).
  This also fixed the old 48K/128K/+3E filter that dropped a read of `$00` from address `$0000`.
- **Prefixes.** The Spectrum cores' `…ExecuteInstruction` runs one `z80ExecuteCpuCycle`, so a prefix
  byte is a step of its own there; the Next runs the whole instruction. Either way the step that
  completes the instruction holds its accesses.
- **Performance.** `benchmark:spectrum-wasm` and `benchmark:zxnext-wasm` against a build of the
  previous commit: within noise on the Spectrum cores, marginally faster on the Next (it no longer
  stores four scalars on every access). The `perf` vitest project covers neither core.
- **Tests added:** `test/wasm/wasm-access-log.test.ts` (every row of the Phase 0 table and the other
  read-modify-write shapes, on all four cores, raw log order and the machine lists; no logging in a
  fast frame; an IDE read leaves the log alone) and `test/emu/access-breakpoints-real-machine.test.ts`
  (the four plan scenarios through the sp48 and zxnext harnesses, plus a burst DMA transfer whose
  source/destination breakpoints must never fire).

---

## 10. Questions and answers

### 10.1 Answered by the project author (2026-10-03)

| Q | Answer | Where |
|---|---|---|
| Q1 more operators | Add `<<`, `>>`, `>>>` with JavaScript semantics. | C5, §3.2 |
| Q2 endianness | `w`/`l` little-endian, `wbe`/`lbe` big-endian, on the access. | C7, §3.4 |
| Q3 flags | Named flags; suggest names for bits 3 and 5. | C16, §3.5 (`F3F`/`F5F`, aliases `XF`/`YF`) |
| Q4 signed | Yes. | C4, §3.4, `s8/s16/s32` |
| Q5 out-of-range literal | A parse error. | C10, §3.7 rule 3 |
| Q6 bank-qualified memory | Yes; ignore the bank part on machines without banks. | C17, §3.4 |
| Q7 ZX characters | Both: automatic mapping and `\x`. | §3.3 |
| Q8 labels | Yes; resolve after every build; a missing label makes the condition inactive. | C14, §3.6 |
| Q9 other CPUs | Z80 only for now. | C18 |
| Q10 hit rules | All of them; a bare number means equal. | §4.2 |
| Q11 source breakpoints | Allow conditions; suggest a UI. | §4.4.2 |
| Q12 core change | Yes — record every data access of an instruction; do it **first**, as Phase 0, since it can be checked with today's breakpoints. | Phase 0, R2 |
| Q13 counters | Reset only on restart; reset one counter from a command and from the panel. | C12, §4.3, §4.4.2 |
| F1 bitwise results | Unsigned 32-bit results for `& \| ^ ~`, as proposed. | C6 |
| F2 restart | *Start* after *Stop* is a restart. | C12, §4.5 |
| F3 NEX labels | Yes to sidecar global labels and to bank-local `05:Label`. | §3.4, §3.6 |

### 10.2 Still open

Nothing.
