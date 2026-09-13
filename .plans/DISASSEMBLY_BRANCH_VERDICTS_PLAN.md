# Disassembly Branch Verdicts — Implementation Plan

Sign every conditional branch visible in the Disassembly view with whether it will jump or fall
through, given the live CPU state. Z80 and Z80N only.

**Status:** complete. All seven steps done, verified in the running app, and documented.
All twelve decisions in §1 are settled with the project author; none are open.

---

## 1. Decision log

Recorded from the prototype review (two prototype pages: a four-way comparison, and a focused
study of the gutter's arrow direction against `KEY-SCAN`).

| # | Question | Decision |
|---|---|---|
| 1 | Which visual treatment | **Prototype A (verdict gutter) + prototype D's spotlight line for the PC row.** Prototypes B (inline chip) and C (flow rail) rejected. |
| 2 | Machine not started | **Render exactly as today.** No gutter column, no reserved width, no shifted columns — there is nothing to predict, so the UI must not change shape. |
| 3 | Machine running (not paused) | **Verdicts render.** The sample is up to 750 ms old, which the author accepts; the panel already refreshes on that same cadence, so no new flicker source is introduced. |
| 4 | Speculative rows (not at PC) | **Signed, but quietly** — same glyph, reduced opacity. Their flags are today's, not the flags that will hold when the CPU arrives. |
| 5 | The PC row | **Unmissable.** Full-strength glyph plus a dedicated spotlight line naming target, condition, deciding flag and T-states actually spent. |
| 6 | Flow analysis | **None.** No loop detection, no reachability, no dataflow. Direction is `target <= address`, a single comparison on data the row already carries. |
| 7 | `RET cc` target | **Option 2 — resolve the return address at the PC row only.** Everywhere else the sideways glyph carries the verdict with no address. SP is only meaningful at PC; resolving it for other visible `RET cc` rows would print confidently wrong addresses. |
| 8 | Colour | **Taken = `--status-success`. Not taken = `--text-secondary`, never red.** Falling through is not a failure, and red/orange are already `--color-breakpoint-*` and the PC marker. |
| 9 | Claim scope | The gutter shows **where loops close** (back-edges), *not* where loops are. Loop extent was prototype C's job and is deliberately given up. |
| 10 | PC readout placement | **R3 — adaptive, in the row.** The full sentence where the panel has room, a compact chip where it does not, switched by a CSS container query on the listing's own width. **No injected row.** Rejected: R1 inline tail (unreadable narrow), R2 chip-always (needlessly cryptic when there is room), R4 anchored right (drifts far from the instruction when wide, covers the comment when narrow), R5 status strip (robust, but detached from the row). |
| 11 | `jp (c)` (Z80N) | **Never predicted.** Marked in the UI as a jump whose destination cannot be computed. See §2 (fact 5) and §5.3 — this is a correction to an error in the first draft. |
| 13 | `CALL` / `RST` wording | **A call is not a jump.** `RST $08` reported "jumps back to $0008"; `RST n` is `CALL n` in a one-byte encoding, so both now read `calls $0008`, with no direction word. Reported by the project author after the feature shipped. See §13. |
| 12 | `ED 98` gate | **Void — there is no bug.** The premise was false; verified against the source and by test. See §4.4. Nothing to do. |

### Non-goals

- M6510 / C64 disassembly. Untouched.
- The `.NEX` annotated listing (`annotated` rows) — out of scope for the first cut.
- A panel-level status strip (prototype R5). Rejected for this cut, but it is the one placement that
  still answers when PC has been scrolled off screen; revisit if that turns out to matter in use.
- Any change to the Breakpoints panel, Call Stack, or the memory dump's inline disassembly.

---

## 2. What the investigation established

Facts the plan depends on. Each was verified in the current tree.

1. **No branch metadata exists.** `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts`
   decodes from pure text templates (`"jr nz,^r|12/7"`); nothing downstream ever parses the mnemonic
   back. `DisassemblyItem` (`disassemblers/common-types.ts:483`) has no kind/condition field.
2. **The obvious heuristics do not work.**
   - `tstates2 > 0` misses `JP cc,nn` entirely (it costs 10 either way, encoded `"jp nz,^L|10"`),
     and false-positives on the block-repeat ops `LDIR`/`CPIR`/`INIR`/`OTIR`/`LDDR`/`CPDR`/`INDR`/
     `OTDR` and Z80N's `LDIRX`/`LDPIRX`/`LDDRX`, all `21/16`.
   - `hasLabelSymbol` covers JR/JR cc/DJNZ/JP/JP cc/CALL/CALL cc but not `RET cc`, `RST`,
     `JP (HL)/(IX)/(IY)/(C)` — and it is also set for non-branch operands.
   - Parsing `instruction` text is fragile: `noLabelPrefix`, `decimalMode` and
     `operandLabelResolver` all rewrite it.
   → **A real opcode→branch map is required.**
3. **The CPU state is already in hand.** `emuApi.getMemoryContents(partition)` returns
   `MemoryInfo` (`src/common/messaging/EmuApi.ts:636`) = `{ memory, pc, af, bc, de, hl, af_, bc_,
   de_, hl_, sp, ix, iy, ir, wz, partitionLabels, selectedRom, selectedBank, osInitialized,
   memBreakpoints }`. `useDisassemblyRefresh` already calls it on **every** refresh and currently
   discards everything but `pc`, `memory`, `partitionLabels`, `selectedRom`, `memBreakpoints`.
   **Consequences:** no new IPC method, no new round-trip, no extra polling. `F = af & 0xff`,
   `B = bc >>> 8`, and the `RET cc` return address is `memory[sp] | (memory[sp+1] << 8)` — a local
   array read.
4. **Refresh cadence** (`useStateRefresh.ts`): one shared 100 ms timer polls the cheap
   `getCpuStateChunk()`; subscribers are notified immediately when paused, at most every 750 ms
   while running, and on a 5 s heartbeat otherwise. The disassembly panel is already a subscriber.
5. **Z80N adds exactly one branch**, `ED 98` `jp (c)`. **Its destination cannot be computed.**
   `src/emu/z80/Z80NCpu.ts:325` is authoritative:

   ```ts
   cpu.pc = cpu.wz = (cpu.pc & 0xc000) | (cpu.readPort(cpu.bc) << 6);
   ```

   The low bits come from **`readPort(bc)`** — a live I/O read — not from the `C` register. An earlier
   draft of this plan stated the formula as `(PC & $C000) | (C << 6)`; **that was wrong** and is
   recorded here so the mistake is not reintroduced. Two consequences, and the second is the
   important one:
   - The value does not exist anywhere in the CPU snapshot, so there is nothing to read.
   - Obtaining it would require *performing* the port read, and port reads have side effects —
     acknowledging interrupts, advancing FIFOs, changing device state. **A debugger view must never
     do that.** So this is not "expensive to compute", it is "must not be computed".
6. **Flag masks already exist**: `FlagsSetMask` in `src/emu/abstractions/FlagSetMask.ts`
   (`S=0x80, Z=0x40, H=0x10, PV=0x04, N=0x02, C=0x01`). It is a `const enum` with no current
   renderer importer; it inlines at compile time, so importing it from the renderer is safe and
   avoids a second source of truth.

---

## 3. Architecture

Three layers, each independently testable, each usable without the one above it.

```
z80-branch-info.ts      opcode  -> { kind, condition, tstatesTaken, tstatesNotTaken }   (pure data)
        |
z80-disassembler.ts     attaches DisassemblyBranchInfo to each DisassemblyItem
        |
branch-verdict.ts       (branchInfo, address, cpuSnapshot) -> BranchVerdict             (pure fn)
        |
DisassemblyPanel/Row    gutter glyph + PC spotlight line
```

---

## 4. Layer 1 — branch metadata

### 4.1 Types (`src/renderer/appIde/disassemblers/common-types.ts`)

```ts
export type DisassemblyBranchKind =
  | "jr" | "jp" | "call" | "ret" | "djnz" | "rst" | "jp-indirect";

export type DisassemblyBranchCondition =
  | "nz" | "z" | "nc" | "c" | "po" | "pe" | "p" | "m";

export type DisassemblyBranchInfo = {
  kind: DisassemblyBranchKind;
  /** Absent on an unconditional branch. DJNZ is conditional but tests B, not a flag. */
  condition?: DisassemblyBranchCondition;
  /** Statically known target. Absent for ret / rst-with-no-label / the indirect jumps. */
  target?: number;
  /** Which register supplies the target, for the indirect forms. */
  indirect?: "hl" | "ix" | "iy" | "c";
  tstatesTaken: number;
  tstatesNotTaken: number;
};
```

Add one optional field to `DisassemblyItem`:

```ts
/** Control-flow metadata, present only on branching instructions. See `z80-branch-info.ts`. */
branch?: DisassemblyBranchInfo;
```

Optional means every existing consumer and every existing test is unaffected.

### 4.2 The map (new: `disassemblers/z80-disassembler/z80-branch-info.ts`)

A standalone module keyed by prefix + opcode. **Deliberately not folded into the instruction
tables**: those are 900 lines of text templates whose format is asserted by
`test/z80-disassembler/standard-ops.test.ts` and friends, and extending the `"text|t/t2"` syntax
risks all of them for no benefit. A separate map is additive and testable in isolation.

Coverage:

| Opcode(s) | Kind | Condition | Target from | T-states |
|---|---|---|---|---|
| `10` | `djnz` | — (tests B) | `symbolValue` | 13 / 8 |
| `18` | `jr` | — | `symbolValue` | 12 / 12 |
| `20 28 30 38` | `jr` | nz z nc c | `symbolValue` | 12 / 7 |
| `C3` | `jp` | — | `symbolValue` | 10 / 10 |
| `C2 CA D2 DA E2 EA F2 FA` | `jp` | nz z nc c po pe p m | `symbolValue` | 10 / 10 |
| `CD` | `call` | — | `symbolValue` | 17 / 17 |
| `C4 CC D4 DC E4 EC F4 FC` | `call` | nz z nc c po pe p m | `symbolValue` | 17 / 10 |
| `C9` | `ret` | — | stack | 10 / 10 |
| `C0 C8 D0 D8 E0 E8 F0 F8` | `ret` | nz z nc c po pe p m | stack | 11 / 5 |
| `C7 CF D7 DF E7 EF F7 FF` | `rst` | — | `opcode - 0xC7` | 11 / 11 |
| `E9` | `jp-indirect` | — | `indirect: "hl"` | 4 / 4 |
| `DD E9` / `FD E9` | `jp-indirect` | — | `"ix"` / `"iy"` | 8 / 8 |
| `ED 45` (+ `55 5D 65 6D 75 7D`) | `ret` | — | stack | 14 / 14 |
| `ED 4D` | `ret` | — | stack | 14 / 14 |
| `ED 98` (Z80N) | `jp-indirect` | — | **unobtainable** (§5.3) | 13 / 13 |

Everything absent from this table has no `branch`, so **`LDIR` and the block-repeat family are
excluded by construction** rather than by a filter someone can later delete.

`target` is *not* recomputed here. `processPragma`'s `^r` and `^L` already resolve it into
`symbolValue` (setting `hasLabelSymbol`); the map supplies kind and condition, and
`decodeInstruction` copies `symbolValue` into `branch.target` when `hasLabelSymbol` is set.
`RST` is the one exception — the map supplies the vector directly, since `^R` creates no symbol.

### 4.3 Wiring (`z80-disassembler.ts`)

Two parts, and the split is forced rather than stylistic.

**`disassembleOperation` resolves the metadata**, in the same four branches that resolve
`decodeInfo`. It cannot be done later from `_opCode`, because the opcode byte alone does not
identify an instruction:

- after a `CB` prefix, `0xC3` is `set 0,e`, not `jp nn`;
- after `DD`/`FD`, `disassembleIndexedOperation` consults the indexed table **and then falls back to
  the un-prefixed one**, so `DD C3 nn nn` really is `jp nn` with a wasted prefix — the metadata has
  to fall back the same way or it will disagree with the text (`getIndexedBranchInfo`);
- after `ED`, a Next-only opcode on a non-Next machine is rewritten to `nop`, and a `nop` must not
  carry a branch — so the metadata is taken from the same `isGatedNextOpCode` test that picks the
  text, not from the opcode.

**`decodeInstruction` attaches it**, after the pragmas have run, copying `symbolValue` into `target`
where `hasLabelSymbol` is set. The table deliberately does not restate the operand — decoding it
twice is how the metadata and the rendered text would get to disagree. `RST` is the exception the
table does carry `target` for, since `^R` renders its vector without creating a symbol.

Always a fresh object per item: table entries are shared by every item decoding to the same opcode,
and one of them is about to receive a per-item `target`.

---

### 4.4 The `ED 98` gate — investigated, no bug (decision 12)

**Earlier drafts of this plan asserted that `0x98` was missing from the `z80NextSet` gate map, so
that `jp (c)` decoded on a plain Z80 where every other Next opcode became `nop`. That assertion was
false.** It came from an automated survey of the disassembler and was written into the plan without
being checked against the file. It is recorded here rather than deleted so the same false report is
not filed again.

What is actually true, verified three ways:

1. **`0x98: true` is present** in `z80NextSet` at `z80-disassembler.ts:944`, in `HEAD` and in the
   working tree.
2. **The whole table is consistent.** Mechanical diff of `extendedInstructions` (107 entries)
   against `z80NextSet` (29 entries), classifying an ED opcode as standard Z80 when it falls in
   `0x40–0x7F`, `0xA0–0xA3`, `0xA8–0xAB`, `0xB0–0xB3` or `0xB8–0xBB`:
   - 29 non-standard opcodes, **29 of them gated** — no gaps;
   - no `z80NextSet` entry without a matching instruction;
   - no standard Z80 opcode wrongly gated.
3. **Runtime behaviour is correct.** `ED 98` disassembles as `nop` with `allowExtendedSet` false and
   `jp (c)` with it true; a standard ED opcode (`ED 4D` → `reti`) is unaffected either way.

**No work. No test.** A contract test asserting the invariant in point 2 — "every non-standard ED
opcode is gated" — would be a reasonable future guard against someone adding a Next opcode without a
gate entry, but it guards a hazard that has not occurred and is not part of this feature. Raise it
separately if wanted.

---

## 5. Layer 2 — verdict evaluation

New pure module: `src/renderer/appIde/DocumentPanels/branchVerdict.ts`.

```ts
export type BranchCpuSnapshot = {
  af: number; bc: number; hl: number; ix: number; iy: number; sp: number; pc: number;
  /** Reads a byte of the currently displayed memory image. Undefined when SP is not addressable. */
  readByte?: (address: number) => number | undefined;
};

export type BranchVerdict = {
  taken: boolean;
  /** "NZ", "Z", ... or "B≠0"; absent when unconditional. */
  conditionText?: string;
  /** "Z=0" / "S=1" / "B $A4→$A3". */
  reasonText?: string;
  /** Where the CPU actually goes next. Absent when unresolved — see §5.2 and §5.3. */
  nextAddress?: number;
  /**
   * Set when the destination cannot be obtained *at all*, as opposed to merely not being known
   * here. Drives its own glyph and its own wording. See §5.3.
   */
  unobtainable?: "io-port" | "stack-unreadable";
  direction: "back" | "forward" | "return" | "indirect" | "unknown" | "none";
  /** T-states this instruction will actually spend. */
  tstates: number;
};

export function evaluateBranch(
  branch: DisassemblyBranchInfo,
  address: number,
  byteLength: number,
  cpu: BranchCpuSnapshot,
  atPc: boolean
): BranchVerdict;
```

### 5.1 Rules

- **Fall-through** is `(address + byteLength) & 0xffff`, from `item.opCodes.length` — exact, and
  independent of what the listing window happens to contain (the next *row* is the wrong source:
  in a banked view it may not be the next instruction).
- **Conditions** decode from `af & 0xff` via `FlagsSetMask`: `nz`→`!Z`, `z`→`Z`, `nc`→`!C`,
  `c`→`C`, `po`→`!PV`, `pe`→`PV`, `p`→`!S`, `m`→`S`.
- **DJNZ**: `taken = ((B - 1) & 0xff) !== 0` where `B = bc >>> 8`. `reasonText` shows the
  decrement, e.g. `B $A4→$A3`. Note `B = 0` **is taken** (0 → 255), which is the classic
  256-iteration case and must be covered by a test.
- **Unconditional** kinds are `taken: true` with no `conditionText`.
- **Direction**: `target <= address` → `"back"`, `target > address` → `"forward"`,
  `kind === "ret"` → `"return"`, `indirect` set → `"indirect"`, not taken → `"none"`.
- **T-states**: `taken ? tstatesTaken : tstatesNotTaken`.

### 5.2 Target resolution

| Kind | Resolution |
|---|---|
| jr / jp / call / djnz / rst | `branch.target`, always available. |
| `jp-indirect`, `hl` / `ix` / `iy` | The register from the snapshot. Off the PC row this is stale like everything else, and gets the same faint treatment. |
| `jp-indirect`, `"c"` (Z80N) | **Never resolved.** `unobtainable: "io-port"`. See §5.3. |
| **ret** | **`atPc` only** (decision 7). `readByte(sp) \| (readByte(sp + 1) << 8)`. When `atPc` is false, or `readByte` is unavailable, `nextAddress` is left undefined and the UI shows the verdict without an address. |

`readByte` is undefined whenever the displayed memory image is not the flat 64K one — i.e. the
banked (`isFullView === false`) view, where `memory` is a single partition and SP is not
addressable within it. This must be a guard, not an assumption.

### 5.2a Two deviations from the drafted types, made while implementing

- **`BranchDirection` has no `"indirect"` member.** §6.1 drafted one and then said the UI should
  pick the back/forward glyph from the resolved address anyway — which makes it a value that exists
  only to be translated away. `JP (HL)`/`(IX)`/`(IY)` resolve to a real address, so they are
  `"back"` or `"forward"` like any other jump; the register is how the address was found, not a kind
  of movement. The union is now `back | forward | return | unknown | none`, and each maps to exactly
  one glyph.
- **`BranchCpuSnapshot` is a narrow slice, not `Z80CpuState`.** It carries `af`, `bc`, `hl`, `ix`,
  `iy`, `sp`, `pc` and an optional `readByte`. Deliberately: with no port accessor on it, the
  `jp (c)` rule in §5.3 is enforced by the type rather than by a comment, and a later edit has
  nothing to reach for. A test asserts the snapshot exposes no port-shaped key.

### 5.3 Unobtainable destinations (decision 11)

There are two different reasons the panel might not show a destination, and **they must not look the
same**, because they mean opposite things to the person reading the listing:

| | Meaning | Treatment |
|---|---|---|
| **Stale** | The value exists and we have it; it is simply today's value on a row the CPU has not reached yet. Every flag verdict off the PC row is stale, and so is `jp (hl)`/`(ix)`/`(iy)` off the PC row. | Shown, faint. The existing speculative treatment. |
| **Unobtainable** | The value does not exist anywhere we can look, and getting it would require executing something. | Shown as **explicitly unknowable** — its own glyph, its own wording. Never guessed at. |

Two cases are unobtainable:

- **`jp (c)` — `unobtainable: "io-port"`.** The destination is `(PC & $C000) | (readPort(BC) << 6)`.
  The byte is not in the CPU snapshot, and fetching it would mean performing an I/O read whose side
  effects (interrupt acknowledgement, FIFO advance, device state) would corrupt the very execution
  being debugged. **Do not read the port. Not behind a setting, not on the PC row, not ever.**
  The verdict is still complete and useful: `taken: true`, `direction: "unknown"`, T-states 13. Only
  the address is withheld.
- **`ret cc` where the stack cannot be read — `unobtainable: "stack-unreadable"`.** The banked-view
  guard above. Distinct from an off-PC `ret cc`, which is simply *not resolved* (decision 7) rather
  than unobtainable, and shows no address without further comment.

The principle to carry into anything added later: **a debugger view is read-only.** If producing a
number would require the machine to do something it would not otherwise have done, the view says so
instead of producing the number.

---

## 6. Layer 3 — rendering

### 6.1 The gutter (prototype A)

`DisassemblyPanel.module.scss` gains `.branchGutter`, a `2ch` cell sitting between `.tstates` and
the instruction `Value`. **`ch`, not px** — M2, and it makes the column follow the panel font size
like every other column.

`DisassemblyRow.tsx` takes one new optional prop:

```ts
/** Live branch verdict for this row. Undefined = render exactly as today (machine not started). */
verdict?: BranchVerdict;
/** Whether the listing as a whole is showing verdicts, so every row reserves the same column. */
showBranchGutter?: boolean;
```

Two props, not one, and this matters: the cell is reserved on **every** row whenever the panel has
verdicts on, so the columns after it sit at the same x down the whole listing — the same reason
`annotationRail` is drawn on every annotated row. When `showBranchGutter` is false the cell is
omitted entirely, which is decision 2.

Four glyphs, as `.svg` files dropped into `src/renderer/assets/icons/` (the filename is the icon
id — see AGENTS.md; do **not** hand-edit `icon-defs.ts`):

| File | State | Fill |
|---|---|---|
| `branch-back.svg` | taken, `direction: "back"` — arrow leaving the line upward | `--color-disassembly-branch-taken` |
| `branch-forward.svg` | taken, `direction: "forward"` — arrow leaving downward | `--color-disassembly-branch-taken` |
| `branch-return.svg` | taken, `direction: "return"` — arrow leaving sideways | `--color-disassembly-branch-taken` |
| `branch-through.svg` | not taken — a straight vertical stroke | `--color-disassembly-branch-fallthrough` |
| `branch-unknown.svg` | taken, `direction: "unknown"` — the same arrow leaving the line, but with an **outlined** head instead of a filled one | `--color-disassembly-branch-taken` |

Indirect jumps whose target resolves (`jp (hl)`/`(ix)`/`(iy)`) carry an ordinary `back`/`forward`
direction and so reuse those two glyphs — see §5.2a for why there is no separate `"indirect"` state.

**Built at 24×24, judged at 12px.** The first cut used small chevron heads on a long shared curve,
which made `back` and `forward` near-indistinguishable in the row while looking fine enlarged. The
shipped glyphs lengthen the vertical travel and widen the heads.

`direction: "unknown"` — `jp (c)`, and any future instruction whose destination is unobtainable — uses
`branch-unknown`. The outlined head is deliberate and is the whole visual idea: **the arrow still
says "the flow leaves here", and the empty head says "and we cannot tell you where".** It reads as
the same family as the other three at 13 px, rather than as a fifth unrelated symbol, and it does not
need a `?` glyph, which is illegible at this size.

Speculative rows render at reduced opacity; the PC row at full strength. Opacity is a rule in the
stylesheet keyed off the existing `.execPoint` class, not a token.

### 6.2 The PC readout — adaptive, in the row (decision 10)

The PC row carries its verdict as a sentence appended after the instruction cell. **No row is
injected into `items`**, so the virtualizer is untouched: no index shift, no `undefined` address in
the scroll handler, no zebra parity break. The earlier injected-row design and its three guards are
withdrawn.

Two renderings of the same fact, one visible at a time:

| Form | Example | Width |
|---|---|---|
| Long | `↳ jumps back to L0EFD · NC met (C=0) · 12 T` | ~44 ch |
| Short | `↑ L0EFD  C=0  12T` | ~18 ch |

For an unobtainable destination (§5.3) the same two forms say so in words rather than leaving a
blank where an address should be:

| Form | `jp (c)` |
|---|---|
| Long | `↳ jumps · destination is read from port BC as it executes · 13 T` |
| Short | `↗ ?  13T` (row tooltip carries the long form) |

Wording rule: say **why** there is no address, not merely that there is none. `destination unknown`
invites the reader to suspect the debugger; naming the port says the machine genuinely has not
decided yet.

Both are emitted; **CSS decides which is shown**, via a container query on the listing's own inline
size. No `ResizeObserver`, no measurement, no JavaScript, no re-render on resize.

```scss
.disassemblyWrapper { container-type: inline-size; }

.branchReadoutLong  { display: none; }
.branchReadoutShort { display: inline-flex; }

@container (min-width: 113ch) {
  .branchReadoutLong  { display: inline-flex; }
  .branchReadoutShort { display: none; }
}
```

Four things about this that are easy to get wrong:

- **The container is `.disassemblyWrapper`, not the row and not `virtua`'s scroller.** The query must
  resolve against the *visible panel width*, and the wrapper is the plain div the panel already owns
  whose inline size is exactly that. A row is `min-width: max-content` and routinely wider than the
  viewport, so querying a row would ask the wrong question. Do not put `container-type` on anything
  whose width must be derived from its content — `inline-size` containment would break it.
- **The threshold is `ch`, not px.** The panel font size is a user setting spanning 10–16 px (View |
  Panel Options | Font Size), and the bundled fonts differ in advance width — Iosevka and Inconsolata
  are 0.500 em per glyph, Noto Sans Mono and JetBrains Mono are 0.600 em. A px threshold would be
  correct at exactly one combination of the two and wrong everywhere else. `ch` resolves against the
  container's own font, so it tracks both axes for free. This is the same reasoning as M2.
- **113 ch is derived, not guessed.** The row before the readout is bp 16 px + address 7 ch +
  opcodes 16 ch + label 10 ch + T-states 36 px + gutter 2 ch + instruction 25 ch ≈ 69 ch, and the long
  form is ~44 ch. Recheck the arithmetic if any column width changes.
- **The short form is notation and needs a tooltip.** Bind it to the row (not the cell) per the
  tooltip rule in `.ai/ui-theming-intent-and-lessons.md`, carrying the long form as its text — so the
  narrow panel loses nothing but immediacy.

Both forms are rendered by one function taking the `BranchVerdict`, so the two cannot drift. Each is
returned split into `head` (the outcome — verb and address) and `detail` (the evidence), because the
row paints them differently: colouring the whole sentence as the outcome made a green paragraph of
it, which the first build in the app showed immediately.

### 6.5 Verified in the running app

Driven under Playwright with `scripts/doc-shots/harness.cjs` (see `.ai/doc-screenshots-guide.md`):
sp48 project, machine started and paused, `show-disass`, then the IDE window resized while a probe
read computed styles out of the DOM. Measured, not eyeballed:

| | 1500px window | 1180px | 1040px | 900px |
|---|---|---|---|---|
| wrapper inline size | 1192 | 872 | 732 | 592 |
| long form | shown | hidden | hidden | hidden |
| short form | hidden | shown | shown | shown |

- **The container query works, at a font the threshold was not derived against.** The harness seeds
  JetBrains Mono at 14px — 0.600em advance, not the 0.500em/12px the `113ch` sum was worked out
  from — and the swap still lands where it should (≈949px at that font). That is the `ch` threshold
  earning its keep; a px threshold would have been wrong here by ~30%.
- **The virtualizer is unaffected by `container-type`.** 24 rows, all 21px, tops strictly
  increasing. The concern that layout containment might disturb `virtua`'s absolute positioning was
  unfounded — it positions against its own inner element, not the wrapper.
- **The gutter reserves on every row** (24 gutters over 24 rows) with glyphs on the 7 that branch,
  and the two opacities (1 at PC, 0.45 elsewhere) both present.

**The conditional case was verified separately**, by stepping into the ROM until PC landed on one
rather than by setting a breakpoint (the breakpoint never fired, and failed silently). At
`$0043 jr nz,L0048` the readout rendered `jumps forward to $0048  ·  NZ met (Z=0)  ·  12 T`, with the
head measured at `rgb(78,201,138)` = `--status-success` and the detail at `rgb(148,154,164)` =
`--text-secondary` — the colour split confirmed against the token values rather than by eye.

**One honest limit found here, not predicted.** Below about 745px of wrapper width *neither* form is
visible without scrolling sideways: the columns ahead of the readout already total ~560px at this
font, and the fixed 25ch instruction column pushes the readout past the edge. This is the same
behaviour the hard-comment column has always had, and the gutter glyph — which sits *before* the
instruction — still carries the verdict. Recorded rather than fixed: narrowing the instruction column
to make room is a change to the existing layout, not to this feature.

### 6.3 Panel wiring (`DisassemblyPanel.tsx`, `useDisassemblyRefresh.ts`)

- **Done.** `useDisassemblyRefresh` keeps the register fields it used to drop; `cpuSnapshot` is
  built by `createBranchCpuSnapshot` from the `getMemoryContents` response it already awaits. No new
  call, no new polling.
- The `readByte` guard is keyed off `partition === undefined`, which is exactly the 64K view:
  `MainToEmuProcessor.getMemoryContents` calls `get64KFlatMemory()` for `undefined` and
  `getMemoryPartition(n)` otherwise, so that one test is the whole condition.
- The hook does **not** gate on machine state — it cannot see it. `cpuSnapshot` is `undefined` only
  before the first refresh; decision 2's gate belongs to the panel.
- The panel computes verdicts in a `useMemo` over `(items, cpuSnapshot, pausedPc, machineState)`.
  `DisassemblyRow` is memoized, so the verdict object must be stable for unchanged rows or every
  row re-renders on every tick — build the map once per refresh, not per row.
- **Gate** (decision 2): verdicts only when `machineState` is `Running` or `Paused`, and only for
  Z80/Z80N. Reuse the existing `MF_Z80` machine-feature flag, the same gate `registry.ts` uses for
  `Z80CpuPanel`.

### 6.4 Theming (`theming/tokens/componentAliases.ts`)

Two new tokens in the existing `--color-disassembly-*` family (per the view-scoped-colour rule in
`.ai/ui-theming-intent-and-lessons.md` — disassembly owns its own family):

```ts
"--color-disassembly-branch-taken": "var(--status-success)",
"--color-disassembly-branch-fallthrough": "var(--text-secondary)",
```

Each needs the family's usual comment explaining *why* — in particular why not-taken is neutral
rather than an error hue (decision 8).

**AGENTS.md standing instruction:** `.ai/ui-theming-intent-and-lessons.md` must be updated in the
same change, folding in the durable rule this establishes — that a *predicted* state in a data
panel takes a status hue for the positive case and a neutral for the negative, and that speculative
versus certain is carried by strength, not by hue.

---

## 7. Tests

New:

- `test/z80-disassembler/branch-info.test.ts` — every opcode in the map produces the right
  kind/condition/timings; `JP cc,nn` **is** marked conditional despite having no `tstates2`;
  `LDIR`/`CPIR`/`INIR`/`OTIR`/`LDDR`/`CPDR`/`INDR`/`OTDR` and `LDIRX`/`LDPIRX`/`LDDRX` carry **no**
  `branch`; `ED 98` only when `allowExtendedSet`.
- `test/renderer/branchVerdict.test.ts` — all eight conditions in both polarities; DJNZ at
  `B = 2, 1, 0`; `RET cc` with and without `atPc`, and with `readByte` unavailable
  (`unobtainable: "stack-unreadable"`); `jp (hl)`/`(ix)`/`(iy)` resolving from the snapshot.
- **`jp (c)` gets its own test, and it is a negative one**: the verdict is `taken: true`,
  `direction: "unknown"`, `unobtainable: "io-port"`, `nextAddress` **undefined**, T-states 13 — and
  `evaluateBranch` is given a `BranchCpuSnapshot` with no port accessor on it at all, so there is
  nothing for a future edit to reach for. The type is the guard; the test pins the behaviour.
- `test/controls/DisassemblyRow.test.tsx` (extend) — gutter absent when `showBranchGutter` is
  false; reserved-but-empty on a non-branch row when true; the five glyph states; the spotlight
  rendered only at PC.
- `DisassemblyRow` renders **both** readout forms into the DOM for the PC row (the container query
  hides one; jsdom does not evaluate container queries, so assert presence, not visibility), and the
  short form's tooltip text equals the long form's sentence.

Container-query behaviour itself is not unit-testable in jsdom. Verify the swap in the running app
per the CDP recipe in `.ai/ui-theming-intent-and-lessons.md` — and specifically at both ends of the
font-size ladder (10 px and 16 px), which is the whole point of the `ch` threshold.

Must stay green: `test/z80-disassembler/*`, `test/controls/Disassembly*`,
`test/theming/type-scale-contract.test.ts` (M1/M2 — the gutter is `2ch`, not px),
`row-size-contract.test.ts` (M3).

Then `npm run build:check` and `npm run lint:renderer`.

---

## 8. Sequencing

Each step is independently reviewable and leaves the tree working.

1. ~~Types + `z80-branch-info.ts` + its tests. No behaviour change.~~ **Done.**
   `DisassemblyBranchKind` / `Condition` / `TargetSource` / `Info` and the optional
   `DisassemblyItem.branch` in `common-types.ts`; the map in
   `z80-disassembler/z80-branch-info.ts`; 87 tests in `test/z80-disassembler/branch-info.test.ts`.
   Nothing reads the map yet.
2. ~~Wire into `decodeInstruction`.~~ **Done.** `disassembleOperation` resolves the metadata in the
   same branches that resolve `decodeInfo` (it must — see §4.3); `decodeInstruction` attaches it and
   copies `symbolValue` into `target`. 102 tests in `branch-info.test.ts`; the full ROM region
   re-disassembles byte-identical to a pre-change capture.
3. ~~`branchVerdict.ts` + tests.~~ **Done.** `DocumentPanels/branchVerdict.ts`; 55 tests in
   `test/renderer/branchVerdict.test.ts`. Pure, still unreferenced by any UI.
4. ~~Carry the register snapshot through `useDisassemblyRefresh`.~~ **Done.**
   `createBranchCpuSnapshot` + `cpuSnapshot` on `DisassemblyRefreshResult`; 8 tests in
   `test/renderer/branchCpuSnapshot.test.ts`. Confirmed no new IPC: the hook now keeps registers it
   was already fetching and discarding.
5. ~~The gutter: icons, tokens, SCSS, row props, panel gate.~~ **Done.** Five glyphs in
   `assets/icons/branch-*.svg`; two tokens; `.branchGutter` at `2.5ch` with the speculative dimming
   keyed off `.execPoint`; `showBranchGutter` + `verdict` on `DisassemblyRow`; verdicts built once
   per refresh in a `useMemo` in the panel. `.ai/ui-theming-intent-and-lessons.md` updated in the
   same change, per the standing instruction.
6. ~~The adaptive PC readout.~~ **Done and verified in the app.** `formatBranchReadout` produces
   both forms from one function; `.disassemblyWrapper` is the query container; the swap happens at
   `113ch`; the tooltip carries the long form. Measured under Playwright — see §6.5.
7. ~~`.ai/ui-theming-intent-and-lessons.md`, and user documentation.~~ **Done.** Theming notes were
   folded in with step 5 and step 6 as those landed; a **Branch Verdicts** section was added to
   `docs/content/working-with-ide/disassembly.mdx`. `doc:build` and `doc:check` pass — assets match
   the golden snapshot, no broken links, Z80 highlighting intact. No screenshot added yet; see below.

---

## 9. Withdrawn from this plan

- **The injected spotlight row**, and its three virtualizer guards (scroll-handler `address`, Go To
  `findIndex`, zebra parity). Superseded by decision 10; see §6.2.
- **The `ED 98` gate fix**, in all three of its forms across successive drafts (out of scope → step 1
  → confirmed step 1). There is no bug to fix; the premise was never verified. See §4.4.

## 10. A note on sourcing

One claim in this plan survived three revisions and a confirmed go-ahead before anyone checked it
against the file, and it was wrong. Claims here that came from reading source directly are marked
with file and line; treat anything not so marked as needing verification before it is acted on.

---

## 11. The documentation screenshot

`docs/public/images/working-with-ide/disass-branch-verdicts.png`, generated by
`scripts/doc-shots/recipes/disassembly.cjs` rather than hand-captured, so it can be regenerated when
the view changes. `.plans/docs-assets.golden.txt` gained its entry (103); `doc:build` and
`doc:check` pass.

The recipe walks the ROM by single-stepping and keeps the **richest** frame it finds — the one with
the most *distinct* gutter glyphs on screen, provided the execution point is a conditional branch so
the readout carries its condition clause. Five is both the target and the ceiling: a 48K listing can
show back, forward, call, return and fall-through, but never the unobtainable mark, which belongs to
Z80N's `jp (c)`.

It settles on the tail of `KEY-SCAN`, which contains all five: `jr c` closing a loop backwards at
PC, three `ret z` falling through, a `ret` and a `ret nz` returning, a `call` hook, and two `jr nz`
going forwards.

Three earlier attempts are recorded in `.ai/doc-screenshots-guide.md`, each a variation on the same
mistake — stopping too early. A 520px window cropped to nine rows with one glyph repeated; requiring
only the condition clause gave a frame with no fall-through; and stopping at four distinct glyphs
settled immediately on a frame with no call in it. `data-branch-glyph` on the gutter exists so the
recipe can count what is actually on screen rather than re-deriving it.

## 12. Not done

- **The `.NEX` annotated listing** still shows no verdicts; out of scope from the start (§1).
- **A contract test for `z80NextSet`** — the invariant that every non-standard ED opcode is gated.
  The audit in §4.4 found no gaps, so this guards a hazard that has not occurred.

---

## 13. Fixed after review: a call is not a jump

`RST $08` reported **"jumps back to $0008"**. Both halves were wrong: `RST n` is `CALL n` in a
one-byte encoding — it pushes a return address and the CPU comes back — and "back" carries the sense
of a loop closing, which a call to a low vector is not. `CALL nn` and `CALL cc,nn` had the identical
defect and were fixed with it.

**Why the tests did not catch it.** `BranchVerdict` carried `direction` but not `kind`, so
`formatBranchReadout` had nothing to distinguish a call from a jump and chose its verb from the
direction alone. Every readout test used jump-shaped fixtures, so the wrong verb was never
exercised. `kind` is now on the verdict, `isCall()` selects the verb, and there is a test that runs
a real `rst` through `evaluateBranch` into `formatBranchReadout` — the missing link, since a
hand-built verdict with no `kind` silently falls back to "jumps".

**The gutter glyph is unchanged, and the documentation was corrected instead.** The arrow states
which way control goes, which is true for a call; it was the docs that over-claimed, saying an up
arrow means "a loop closing". The table now says direction only, and points at the readout as the
place a call and a jump are told apart.

**The sixth glyph was then added, at the author's request.** `branch-call.svg` — an out-and-back
hook — is drawn for `call` and `rst` whenever the branch is taken, so a `CALL` and a `JP` to the same
address are no longer indistinguishable in the gutter. Five of the six marks encode *direction*;
this one encodes something else entirely, that control returns here afterwards, which is why a call
looks the same whichever way its target lies.

Two ordering rules come with it, both tested:

1. **Not-taken beats kind.** A conditional call that will not be taken carries on to the next
   instruction like any other fall-through, and must not be drawn as a call.
2. **Kind beats direction.** A call is a call whichever way its target lies.

`isCall()` is exported from `branchVerdict.ts` so the glyph and the wording read the same predicate.
They were separate judgements before, and that is exactly how `rst $08` came to be drawn as a loop
closing while being described as a jump.
