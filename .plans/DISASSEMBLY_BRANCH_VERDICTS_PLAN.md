# Disassembly Branch Verdicts — Implementation Plan

Sign every conditional branch visible in the Disassembly view with whether it will jump or fall
through, given the live CPU state. Z80 and Z80N only.

**Status:** planned, not started. Decisions below are settled with the project author; the one
remaining implementation choice is flagged in §6.2.

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
| 12 | `ED 98` gate | **Stays in this plan**, confirmed after decision 11 removed the original justification for it. Kept on the weaker but sufficient reason in §4.4: this feature makes the bug more visible. Sequenced first. |

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

One block at the end of `decodeInstruction`, after `tstates`/`tstates2` are assigned: look the
opcode up in the map, and if found attach `branch`, filling `target` from `symbolValue`.

---

### 4.4 The `ED 98` gate (decision 12)

`z80NextSet` (`z80-disassembler.ts`, ~lines 921–951) is the map of ED-prefixed opcodes that decode as
`nop` when `allowExtendedSet` is false. **`0x98` is missing from it**, so `jp (c)` — a Z80N-only
instruction — currently decodes as `jp (c)` on a plain Z80, where every other Next opcode correctly
becomes `nop`.

**Read the justification history here, because it changed.** The first draft argued this *had* to be
fixed with the feature, because the branch map would otherwise make the instruction text and the
branch metadata disagree about whether the opcode exists. That argument is void: once `jp (c)` is
never predicted (decision 11), the map simply marks it unobtainable, and text and metadata agree
whatever the gate does.

The remaining, weaker and honest reason to keep it here: **this feature makes the bug more visible.**
Today a 48K listing shows a slightly odd `jp (c)` where it should show `nop`. After this feature it
would also grow a branch glyph in the gutter, turning a textual oddity into an apparent control-flow
edge in a machine that has none. That is worth closing, and the fix is one map entry plus a test.

It is cleanly separable — but the decision is to **keep it here**, sequenced first, so that the
branch map is written against a correct gate rather than around a known-broken one.

Work:

1. Add `0x98` to `z80NextSet`.
2. **Audit the whole table rather than fixing the one case** — diff every Next-only entry in
   `extendedInstructions` against `z80NextSet` and close any other gaps found.
3. Regression test: `ED 98` decodes as `nop` with `allowExtendedSet` false, `jp (c)` with it true.

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

`direction: "indirect"` — `jp (hl)`/`(ix)`/`(iy)`, whose target *is* resolvable — reuses
`branch-back`/`branch-forward` according to the resolved address, like any other jump.

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

Both forms are rendered by one function taking the `BranchVerdict`, so the two cannot drift.

### 6.3 Panel wiring (`DisassemblyPanel.tsx`, `useDisassemblyRefresh.ts`)

- `useDisassemblyRefresh` keeps the register fields it currently drops: extend
  `DisassemblyRefreshResult` with `cpuSnapshot: BranchCpuSnapshot | undefined`, built from the
  `getMemoryContents` response it already awaits. No new call.
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
- `test/z80-disassembler/next-gate.test.ts` (or extend `extended-ops.test.ts`) — `ED 98` decodes as
  `nop` without `allowExtendedSet` and as `jp (c)` with it, plus the audit's findings (§4.4).
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

1. **Fix the `ED 98` gate** and audit `z80NextSet` (§4.4), with its regression test. Standalone,
   shippable on its own, and it makes step 2 correct by construction.
2. Types + `z80-branch-info.ts` + its tests. No behaviour change.
3. Wire into `decodeInstruction`. Still no behaviour change; existing disassembler tests prove it.
4. `branchVerdict.ts` + tests. Pure, unreferenced by UI.
5. Carry the register snapshot through `useDisassemblyRefresh`.
6. The gutter: icons, tokens, SCSS, row props, panel gate. **First visible change.**
7. The adaptive PC readout: both forms, the container on `.disassemblyWrapper`, the `ch` threshold,
   the row tooltip.
8. `.ai/ui-theming-intent-and-lessons.md`, and user documentation under
   `docs/content/working-with-ide/disassembly.mdx`.

---

## 9. Withdrawn from this plan

- **The injected spotlight row**, and its three virtualizer guards (scroll-handler `address`, Go To
  `findIndex`, zebra parity). Superseded by decision 10; see §6.2.
- **Deferring the `ED 98` gate.** It was listed here as out of scope in the first draft; decision 11
  pulls it in as step 1. See §4.4.
