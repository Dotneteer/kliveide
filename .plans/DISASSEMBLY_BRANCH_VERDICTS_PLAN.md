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

### Non-goals

- M6510 / C64 disassembly. Untouched.
- The `.NEX` annotated listing (`annotated` rows) — out of scope for the first cut.
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
5. **Z80N adds exactly one branch**, `ED 98` `jp (c)` → `(PC & $C000) | (C << 6)`.
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
| `ED 98` (Z80N) | `jp-indirect` | — | `"c"` | 13 / 13 |

Everything absent from this table has no `branch`, so **`LDIR` and the block-repeat family are
excluded by construction** rather than by a filter someone can later delete.

`target` is *not* recomputed here. `processPragma`'s `^r` and `^L` already resolve it into
`symbolValue` (setting `hasLabelSymbol`); the map supplies kind and condition, and
`decodeInstruction` copies `symbolValue` into `branch.target` when `hasLabelSymbol` is set.
`RST` is the one exception — the map supplies the vector directly, since `^R` creates no symbol.

### 4.3 Wiring (`z80-disassembler.ts`)

One block at the end of `decodeInstruction`, after `tstates`/`tstates2` are assigned: look the
opcode up in the map, and if found attach `branch`, filling `target` from `symbolValue`.

Gate `ED 98` behind `allowExtendedSet` for the *branch metadata*, matching the machine gate.

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
  /** Where the CPU actually goes next. Absent when unresolvable (see §5.2). */
  nextAddress?: number;
  direction: "back" | "forward" | "return" | "indirect" | "none";
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
| `jp-indirect` | `hl` / `ix` / `iy`, or `(pc & 0xC000) \| ((bc & 0xff) << 6)` for `"c"`. |
| **ret** | **`atPc` only** (decision 7). `readByte(sp) \| (readByte(sp + 1) << 8)`. When `atPc` is false, or `readByte` is unavailable, `nextAddress` is left undefined and the UI shows the verdict without an address. |

`readByte` is undefined whenever the displayed memory image is not the flat 64K one — i.e. the
banked (`isFullView === false`) view, where `memory` is a single partition and SP is not
addressable within it. This must be a guard, not an assumption.

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

`direction: "indirect"` reuses `branch-forward` for the first cut (always taken, target known only
at runtime); revisit if it reads badly.

Speculative rows render at reduced opacity; the PC row at full strength. Opacity is a rule in the
stylesheet keyed off the existing `.execPoint` class, not a token.

### 6.2 The PC spotlight (prototype D) — **the one open implementation choice**

The spotlight is a full-width line drawn directly under the PC row, e.g.

```
↳ jumps back to L0296  ·  C met (C=1)  ·  12 T
```

Two ways to place it, and this needs a call before coding:

- **(a) Inject a synthetic item into `items`.** There is precedent: `prefixComment` rows already
  sit in the array with no address and render as a full-width line (`DisassemblyRow`'s
  `isPrefixComment` path). Fits M3 — it is one more fixed-height row. **Three guards required:**
  `DisassemblyPanel`'s `onScroll` handler reads `items[startIndex].address` (would be `undefined`);
  the Go To handler's `items.findIndex(di => di.address >= toScroll)` (ditto); and zebra parity
  shifts by one for every row below PC.
- **(b) Render it inside the PC row**, right-aligned in the space after the instruction column.
  No virtualizer interaction at all, no guards. But the text is ~50 characters and competes with
  the hard-comment column on a narrow panel.

Recommendation: **(a)**, because the prototype the author selected shows a separate line and (b)
degrades exactly where the listing is densest. The three guards are small and each wants a test.

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
  `B = 2, 1, 0`; `RET cc` with and without `atPc`; each indirect form including the `jp (c)`
  formula; the fall-through address derived from `opCodes.length`.
- `test/controls/DisassemblyRow.test.tsx` (extend) — gutter absent when `showBranchGutter` is
  false; reserved-but-empty on a non-branch row when true; the four glyph states; the spotlight
  rendered only at PC.
- If §6.2(a) is chosen: a test for each of the three guards.

Must stay green: `test/z80-disassembler/*`, `test/controls/Disassembly*`,
`test/theming/type-scale-contract.test.ts` (M1/M2 — the gutter is `2ch`, not px),
`row-size-contract.test.ts` (M3).

Then `npm run build:check` and `npm run lint:renderer`.

---

## 8. Sequencing

Each step is independently reviewable and leaves the tree working.

1. Types + `z80-branch-info.ts` + its tests. No behaviour change.
2. Wire into `decodeInstruction`. Still no behaviour change; existing disassembler tests prove it.
3. `branchVerdict.ts` + tests. Pure, unreferenced by UI.
4. Carry the register snapshot through `useDisassemblyRefresh`.
5. The gutter: icons, token, SCSS, row prop, panel gate. **First visible change.**
6. The PC spotlight, per the §6.2 decision.
7. `.ai/ui-theming-intent-and-lessons.md`, and user documentation under
   `docs/content/working-with-ide/disassembly.mdx`.

---

## 9. Noted in passing, out of scope

`ED 98` (`jp (c)`, Z80N) is absent from the `z80NextSet` gate map in `z80-disassembler.ts`
(lines 921–951), so it currently decodes as `jp (c)` even when `allowExtendedSet` is false — where
every other Z80N opcode correctly decodes as `nop`. A pre-existing inconsistency, unrelated to this
feature, tracked separately.
