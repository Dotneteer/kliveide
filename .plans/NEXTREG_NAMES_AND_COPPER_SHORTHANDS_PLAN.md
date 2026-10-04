# NextReg Names and `.copper` Shorthands Plan (Follow-up)

Status: **future, not scheduled** (2026-10-04). The open questions in §4 must be answered before
work starts.

Origin: [COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md) decisions D13 (Q4) and D14 (Q5). They
kept both features out of that plan so its `.copper` pragma stays one-to-one with the hardware.

Prerequisite: the Copper plan's Track A (Phases 1–2, the `.copper` pragma and its language support)
is done. Part A below does not depend on the Copper at all, and could start earlier if wanted.

The plan has two independent parts:
- **Part A: symbolic NextReg names.** Names that can be used wherever the assembler takes an
  expression (`nextreg`, `.copper move`, `.equ`, ...), and in the IDE's `nr:` breakpoints.
- **Part B: `.copper` shorthand sub-commands.** Conveniences that expand only to base `.copper`
  words.

---

## Part A: Symbolic NextReg names

### A.1 Why

Next code is full of magic numbers: `nextreg $07, 3`, `nextreg $43, %00010000`,
`.copper move $41, $E0`. Today:

- **The assembler has no NextReg name table.** The register operand is a plain numeric expression,
  so every project defines its own `.equ` constants or writes hex.
- **`NEXT_REG_DESCRIPTORS`** (`src/emu/machines/zxNext/nextRegDescriptors.ts`, 141 entries) has
  descriptions ("Palette Index", "CPU Speed") but **no identifiers**.
- **The NextReg write-breakpoint plan therefore ruled names out**
  ([NEXTREG_WRITE_BREAKPOINTS_PLAN.md](NEXTREG_WRITE_BREAKPOINTS_PLAN.md) §8, decision 1:
  "`nr:` takes a register number only, never a name"). Its reason was that names do not exist, not
  that they are unwanted.

One name table fixes all three places at once.

### A.2 One source of truth

- **Add a `name` field** to every `NextRegDescriptor`, in Klive's own words.
- **Move the id → name table to `src/common/zxnext/nextRegNames.ts`.** The assembler lives in
  `src/main` and the descriptors in `src/emu`. Check whether the main-process build may import from
  `src/emu`; if it may not, `src/common` is the shared home. The descriptors then reference this
  table, so a name is written once.
- **A contract test pins the table.** It checks that:
  - every one of the 141 descriptors has a name;
  - names are unique;
  - every name is a valid assembler identifier;
  - the full list matches a golden file.

  Names become public API the moment users write them in source, so **renaming one is a breaking
  change**. The golden file makes that visible in review.

### A.3 Naming convention

**Proposed: a built-in module `NR`, with Klive's own UPPER_SNAKE names derived from the
description:**

```z80klive
    nextreg NR.CPU_SPEED, 3
    nextreg NR.PALETTE_CONTROL, %00010000
    .copper move NR.PALETTE_INDEX, 16
    .copper move NR.PALETTE_VALUE, $E0
    ld a, NR.MMU6               ; = $56
```

- **The `NR.` qualifier avoids collisions.** Users already have their own `PALETTE_INDEX`-style
  constants, so bare names would clash with user code, and the qualifier keeps both working.
- **It reuses an existing language feature.** Qualified module names are already documented in
  `docs/content/z80-assembly/modules.mdx` (`Module.Symbol`, `::Module.Symbol`), so nothing new has
  to be learnt.
- **Naming rules for the derivation:**
  - registers in a numbered family keep their number with no separator: `MMU0`–`MMU7`,
    `CLIP_WINDOW_LAYER2`;
  - descriptions with qualifiers in parentheses lose them where the result is still unique:
    "Palette Value (8 bit)" → `PALETTE_VALUE`, and "Palette Value (9 bit)" → `PALETTE_VALUE_9BIT`;
  - Phase A1 writes the whole table, and the golden file is reviewed by a person.

- **Alternative (see QA1): community-style aliases.** Next sources in the wild often use names with
  the register number embedded, e.g. a form like `PALETTE_INDEX_NR_40`. Accepting such aliases
  would ease porting. **The exact convention is not recorded here.** It must be researched from
  public Next documentation and source before it is adopted, and only the names (facts) would be
  taken, written into Klive's own table.

### A.4 Resolution in the assembler

- **The lookup is a last resort.** `getSymbolValue` (`src/main/compiler-common/common-assembler.ts:1119`)
  gains one fallback at the end: if a symbol is still unresolved, the model is Next, and the name is
  `NR.<name>` (or `::NR.<name>`), it returns the register number from the table.
- **User symbols always win.** A user module or symbol named `NR` shadows the built-in. A new
  warning says so once per compilation: "`NR` hides the built-in NextReg names".
- **Matching is case-insensitive**, like every assembler symbol. When the case-sensitive option
  (`isCaseSensitive`) is on, only the uppercase spelling matches.
- **Outside `.model next`**, the name stays unresolved and gives the usual unresolved-symbol error,
  plus a hint: "NextReg names need `.model next`".
- **Forward references and fixups need nothing new.** The value is a constant known before the
  first pass ends.

### A.5 Where names appear in the IDE

| Place | Change |
| --- | --- |
| Assembler completion | After `NR.`: every register, with `$40 · Palette Index` as detail. In `nextreg ` and `.copper move ` operand position: `NR.` is offered first. `.copper move` offers only `$00-$7F`. |
| Assembler hover | On `NR.PALETTE_INDEX`: `$40`, the description, and the slice breakdown, reusing the Next Registers panel's slice text. |
| Breakpoints | `nr:` accepts a name: `bp-set nr:PALETTE_INDEX` or `bp-set nr:NR.PALETTE_INDEX`. **This revisits NextReg plan §8 decision 1.** The key stays numeric (`NR:$40`), so stored breakpoints do not change and round-trip as numbers. |
| Next Registers panel | The name is shown as the row's secondary text or tooltip. The description stays primary. |
| Copper List viewer | The name is in the MOVE row tooltip. The description stays in the Meaning column. |
| Z80 disassembler | Optional (QA3): `nextreg $40,$10 ; Palette Index` could become `nextreg NR.PALETTE_INDEX,$10`. |

### A.6 Traps

1. **The names are API** (A.2). Freeze them with the golden list; add new ones but never rename.
2. **Shared or overlaid registers.** Some registers' meaning depends on another register, such as
   the palette selection in `$43`. A name describes the **register**, not its current role.
3. **The identifier grammar.** A name must not start with a digit, and must not match a Z80
   mnemonic, register, condition or pragma keyword after the `NR.` qualifier. The contract test
   checks this.
4. **Name lookup in the `nr:` command parser** must come before numeric parsing fails, or
   `nr:CPU_SPEED` would report "invalid register".

### A.7 Phases

- **A1, the table.**
  - Work: `nextRegNames.ts`, a `name` on every descriptor, the golden file, and the contract test.
    Nothing is user-visible yet.
- **A2, the assembler.**
  - Work: the `getSymbolValue` fallback, the `NR` shadow warning, and the model hint.
  - Tests: `test/z80-assembler/nextreg-names.test.ts`, covering `nextreg`, `.copper move`, `.equ`,
    `::NR.`, the shadowing, the case-sensitive option, and the non-Next error.
- **A3, language support.**
  - Work: completion and hover.
  - Tests: the providers tests.
- **A4, the IDE.**
  - Work: names in `nr:` (with `BreakpointCommands` tests), the Next Registers panel, and the Copper
    List tooltips. Also the disassembler option, if QA3 is accepted.
- **A5, docs.**
  - Work: a "NextReg names" section in `docs/content/z80-assembly/zx-next.mdx`, generated from the
    table so it cannot drift. A note in `commands-reference.mdx` for `nr:`. Update NextReg plan §8,
    decision 1, to point here.

---

## Part B: `.copper` shorthand sub-commands

### B.1 Principles

1. **A shorthand only expands.** Every shorthand emits only base `.copper` words (`wait`, `move`).
   It has no encoding of its own, so the hardware mapping (Copper plan D7) stays the only one.
2. **Hover shows the expansion**, word by word. The listing file shows every word.
3. **Source mapping maps one line to N instructions.** The Copper plan's `copperBlocks` debug info
   (D8) then carries a word count per entry, and the viewer shows the same source line on each
   expanded row.
4. **A gutter breakpoint on a multi-word line binds to its first word.** That matches a Z80
   statement, whose breakpoint is on its first byte.

### B.2 Candidates

| Shorthand | Expands to | Notes |
| --- | --- | --- |
| `.copper palette <index>, <rgb8>` | `move $40, index` · `move $41, rgb8` | The common colour-bar idiom. It writes to whichever palette `$43` selects; the docs say so. Writing `$40` every time sidesteps `$41`'s auto-increment. |
| `.copper palette9 <index>, <rgb9>` | `move $40, index` · `move $44, rgb9 >> 1` · `move $44, rgb9 & 1` | Verify `$44`'s two-write protocol against `_input/next-fpga/` before implementing. That includes the priority bit for Layer 2: whether to expose it, and how (QB2). |
| `.copper waitx <line>, <x>` | `wait line, x / 8` | Takes the horizontal position in paper pixels. **When `x` is not a multiple of 8**, it is rounded down and a warning is given (QB3). |
| `.copper waitline <line>` | `wait line, 0` | The most frequent WAIT form. |
| `.copper list` … `.copper endlist` | Nothing itself | An explicit block (QB4). It checks the length against 1024 instructions and can warn when the list does not end in `halt`, the check Copper plan D15 left out because a bare block gives no such knowledge. It also gives D8 an explicit block boundary instead of an inferred one. |

**Rejected:** `.copper upload <label>`, a pragma that would generate the Z80 upload loop. `.dma` and
`.copper` emit **data only**, and a pragma that emits CPU code breaks that rule. The docs show the
`$60` loop and a DMA-based upload as snippets instead.

### B.3 Errors

New codes follow the Copper plan's Z0371–Z0377. Check the range is free at implementation.

| Code | Message |
| --- | --- |
| Z0378 | `.copper waitx` position {0} is not a multiple of 8; the Copper waits from x {1} (a warning) |
| Z0379 | `.copper endlist` without `.copper list` / `.copper list` not closed |
| Z0380 | Copper list ends without `.copper halt` (a warning; only inside `.copper list`) |

Range errors for the expanded words are the base sub-commands' own (Z0373–Z0376), reported at the
shorthand's position.

### B.4 Phases

- **B1, expansion.**
  - Work: `palette`, `waitx` and `waitline` in the parser and assembler, emitting through the base
    emitters.
  - Tests: byte-identical to the hand-written base form.
- **B2, `palette9`.**
  - Work: `palette9`, once `$44` has been checked against the VHDL. A harness test in
    `test/zxnext-hw/` confirms the colour on the real core.
- **B3, the list block** (if QB4 is accepted).
  - Work: `.copper list`/`endlist`, Z0379–Z0380, and the explicit block boundary in the debug info.
- **B4, language support and docs.**
  - Work: completion, highlighting, and hover with the expansion. A "Shorthands" section on the
    `.copper` docs page.
  - Source mapping of multi-word lines (B.1 points 3 and 4), with tests in `copperSourceMatch`.

---

## 3. Effort

| Item | Estimate |
| --- | --- |
| Part A: name table, assembler, language support | S–M (writing and reviewing 141 names is most of it) |
| Part A: `nr:` names, panel and disassembler touches | S |
| Part B: `palette`, `waitx`, `waitline` | S |
| Part B: `palette9`, `.copper list` block | S |

## 4. Open questions

| # | Question | Proposal |
| --- | --- | --- |
| QA1 | Should community-style aliases (with the register number embedded) also be accepted for porting existing sources? | Research the convention first; decide after seeing how widespread it is |
| QA2 | Should names also be usable without the `NR.` prefix when no user symbol clashes? | No; one spelling, no context-dependent meaning |
| QA3 | Should the Z80 disassembler show names in `nextreg` operands? | As an option, off by default; the description comment stays |
| QA4 | Should Klive BASIC get the same names (e.g. for its `NEXTREG` support)? | Out of scope here; a separate decision under the Klive BASIC plan's rules |
| QB1 | Which shorthands make the first cut? | `palette`, `waitx`, `waitline` |
| QB2 | Should `palette9` expose the Layer 2 priority bit, and how? | Decide after the `$44` check; possibly a third, optional operand |
| QB3 | Should `waitx` with an unaligned x round down with a warning, or be an error? | Round down with a warning (Z0378) |
| QB4 | Should there be an explicit `.copper list` … `.copper endlist` block? | Yes; it enables the length and missing-`halt` checks |
