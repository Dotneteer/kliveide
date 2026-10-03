# Logpoints Plan: Breakpoints That Log, and DeZog LOGPOINT Comments

Status: **done — all phases (1–7) implemented and verified** (2026-10-03). G1.4 is marked done in
the base plan. §9 records what was built and where it departs from the design above.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G1, feature **G1.4**, under
decision **D3** (be compatible with DeZog's source conventions).
**Depends on** [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md): its Phase 1
(model), Phase 2 (the expression engine), Phase 3 (the per-definition slow path in `DebugSupport`)
and the `rawTailOption` of Phase 4. Nothing here starts before those land; §4.8 of that plan already
reserves the engine for this feature.
**Feeds** G1.5 (ASSERTION / WPMEM comments): the source-annotation pipeline (§4.7) and the DeZog
expression dialect (§3.4) are built here so that G1.5 adds two annotation kinds and nothing else.

> **Standing rule (from the base plan):** when this ships, update §2 and §4 of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) and mark G1.4 done in
> the base plan, in the same change.

---

## 1. What is being added

A **logpoint** is a breakpoint whose action is *log a message* instead of *stop*. When it is hit in
a debug run, its message template is filled in from the machine's state and written to the output,
and execution continues as if nothing happened.

Logpoints come from two places:

1. **The user**, exactly like breakpoints: `bp-set` with a message, the Breakpoint dialog, and a new
   *Add Logpoint…* item in the editor's margin menu. Such a logpoint can also carry the condition and
   hit rule of the conditional-breakpoints plan ("log `HL` every 100th time `A == 0`").
2. **Source comments** using DeZog's convention, so a DeZog-annotated project logs in Klive
   unchanged:

   ```z80klive
   DrawSprite:
       ld a,(hl)        ; LOGPOINT [SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}
   ```

   The build turns every such comment into a logpoint at the right address. They are owned by the
   build, never persisted, and replaced by the next build.

Logpoints are organised in **groups** (DeZog's `[SPRITES]`); groups can be switched on and off
without touching the logpoints themselves.

### 1.1 What the code already has (survey, 2026-10-03)

- **The stop decision** is one function, `shouldStopAtDebugPoint` (`src/emu/machines/DebugStepDecision.ts`),
  called after every instruction by every WASM machine's TypeScript debug loop
  (`executeWasmV2DebugLoop`) and by `MachineFrameRunner` on the interpreted path. It asks
  `DebugSupport.shouldStopAt`, then applies the `lastBreakpoint` re-trigger guard. After the
  conditional-breakpoints plan, `shouldStopAt` walks every definition at a flagged address (its
  §4.5 slow path); "log and continue" is one more outcome of that walk.
- **Output from the emulator** goes through `MachineController.sendOutput` (`MachineController.ts:1228`):
  one awaited `displayOutputBatch` IPC request to the IDE window, into the `emu` pane
  (`PANE_ID_EMU`). Fine for one debug-stop line; **far too slow per hit** for a logpoint in a loop.
  A debug stop is reported at `MachineController.ts:1038`, after the frame ends.
- **Breakpoint ownership** (`BreakpointOwner`, `breakpoint-scope.ts`): absent = project, `nex`
  (a `.nex.dis` sidecar), `session` (never persisted). `resetBreakpointsTo(bps, scope)` replaces one
  owner's set. `breakpointMatchesScope` **throws** on an unknown scope, so a new owner kind has to be
  added in every switch.
- **Identity**: `buildBreakpointKey` (`src/common/utils/breakpoints.ts:77`); a source breakpoint is
  keyed `[resource]:line[:column]`. Fields such as `disabled` "update in place" and are not part of
  the key.
- **Klive assembler**: the lexer produces `EolComment` tokens, and the parser attaches the comment
  to each line (`AssemblyLine.comment`); comment-only lines become `CommentOnlyLine`. **Comments do
  not reach the output**: only lines that emit code get `sourceMap` / `listFileItems` entries
  (`common-assembler.ts:1344-1357, 1541-1552`).
- **sjasmplus**: `extractSldInfo` (`SjasmPCompiler.ts:341`) splits each SLD line on `|` and keeps
  `parts[7]` only; the consumer (`:142`) keeps only `T` (trace) lines. **No symbols are produced for
  sjasmplus builds at all**: the `L` (label) lines are dropped too, so a condition or logpoint that
  names a label is inactive in every sjasmplus project today.
- **Formatting helpers** `toHexa2/4`, `toBin8/16`, … exist in `ide-commands.ts:186-225`, in the
  renderer. The emulator needs its own (or a move to `src/common`).
- There is no reverse debugging yet; `REWIND_REQUESTED` is the tape.

### 1.2 DeZog's convention (reference, in Klive's words)

Read from DeZog's `documentation/Usage.md` (sections *LOGPOINT*, *vscode breakpoint*, *vscode
logpoints*) and sjasmplus's `documentation.xml` (*SLDOPT*, *SLD data*). Only the conventions are
adopted; no DeZog code is read or copied (D3).

- **Form:** `LOGPOINT [group] text ${expression[:format]}` inside an assembler comment. `[group]` is
  optional, the brackets are literal, the default group is `DEFAULT`.
- **Expressions:** register names (`A`, `BC`, `HL`, `IX`, `H`, `IXL`, `AF'` …), labels, arithmetic,
  and memory reads `b@(addr)` (byte) and `w@(addr)` (word). The same expression language as DeZog
  breakpoint conditions: C-style operators, `&&` binds tighter than `||`, hex as `0x12FA` or `7Fh`,
  parentheses only group (`(addr)` does not read memory).
- **Formats:** `string`, `hex8`, `hex16`, `int8`, `int16`, `uint8`, `uint16`, `bits`.
- **Specials:** `${Remote.tStates}` (T-states since the session started), `${Remote.cpuFrequency}`
  (Hz), `${Remote.slots}` (the slot/bank map as a string). DeZog offers the first two only in its own
  simulator.
- **Where it applies:** the comment becomes a breakpoint at the address of its line, evaluated
  **before** that instruction executes (documented for ASSERTION, which works the same way). A
  comment on a line of its own therefore lands on the next instruction.
- **Groups:** all logpoints on/off together, or a space-separated list of groups to enable.
- **Output:** the debug console; execution never stops.
- **sjasmplus:** the source must contain `SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION`, or sjasmplus
  drops the comments from the SLD file. They then appear as type-`K` lines whose data is the comment.
  Per sjasmplus's docs only **end-of-line** comments containing a listed keyword are exported, and
  keywords are **case-sensitive**. Labels must be written with their full global dotted name.
- **Lifetime:** read from the build output, so a changed comment needs a rebuild. Not evaluated
  during reverse debugging.

---

## 2. Design decisions

| # | Decision | Why |
|---|---|---|
| L1 | A logpoint is a **`BreakpointInfo` with a `logMessage`**, not a separate kind. It binds like any breakpoint (address, partition, bank-relative, label-anchored, source, and memory/I/O/NextReg access breakpoints too) and carries the same optional condition and hit rule. | Every binding shape, the panel, persistence, enable/disable and the slow path come for free. VS Code models it the same way. |
| L2 | `logMessage` is **not part of the identity** (like `disabled`, `condition`). `bp-set` on an existing breakpoint with `-log` turns it into a logpoint; without `-log` it turns it back into a stopping breakpoint. | One breakpoint per place, and `bp-set` states the whole breakpoint (C13 of the conditional plan). |
| L3 | A logpoint **never stops** the machine. Its condition and hit rule decide whether it *logs*; the hit counter counts logs. | VS Code / DeZog semantics. |
| L4 | When a stopping breakpoint and logpoints share an address, the logpoints log **and** the machine stops; the log lines appear before the stop message. | Nothing is lost; the order matches what happened. |
| L5 | **A logpoint logs once per arrival.** It logs when execution reaches its address, never again on the instruction a run or step *resumes from*, including after a pause or a step that landed on it. The first instruction after a machine start counts as an arrival. | Without this, every Continue from a step onto a logpoint prints a duplicate line. §4.2 has the cases. |
| L6 | **Two template dialects, chosen by origin**: user logpoints use the **Klive dialect** (`{expr[:fmt]}`, the conditional plan's expression language); source comments use the **DeZog dialect** (`${expr[:fmt]}`, DeZog's expression language). Both compile to the **same `CondNode` tree** and use one evaluator. | D3 needs DeZog's text to work verbatim; Klive's own surfaces keep one expression language with the conditional plan. A second *front end*, not a second engine, as §4.8 of that plan requires. |
| L7 | Logpoints run in **debug runs only**, like every breakpoint (C19). | Unchanged behaviour; a normal run pays nothing. |
| L8 | **Messages are formatted at hit time** (values must be the ones at the hit) and **queued**; the queue is flushed to the IDE **once per frame** and on every pause or stop, in one `displayOutputBatch` call. | One IPC call per frame instead of one per hit. |
| L9 | The queue has a **per-frame cap of 256 lines** (Q10); excess lines are counted and reported as one line ("… 1 234 log lines dropped in this frame"). | A logpoint in a tight loop must not freeze the IDE or exhaust memory. |
| L10 | Source-comment logpoints get a **new owner kind, `annotation`**: never persisted, replaced as a set after every successful build, cleared when the machine changes. | They belong to the build output, not to the project or a sidecar. |
| L11 | **Groups are a property of the logpoint** (`logGroup`, default `DEFAULT`), written as a leading `[NAME]` in the message in **both** dialects. Group on/off state is separate from each logpoint's own `disabled` flag; a logpoint logs only if both allow it. | One convention for both sources; group switching never rewrites logpoints. |
| L12 | **Z80 only**, as conditions are (C18). | Same expression engine and register profile. |
| L13 | A malformed LOGPOINT comment is a **build warning**, never an error: the build succeeds and that logpoint is not created. An unknown label makes it **inactive** (C14) with the same warning. | A debugging aid must not break a build. |

---

## 3. The message template

### 3.1 Klive dialect (user logpoints)

```text
x={A} at {PC:hex16}
[SPRITES] sprite {B} at {w[IX+2]:hex16}, visible={b[IX+4] & $80 != 0}
{{literal braces}} and a dollar $ sign
```

- `{` opens a placeholder, `}` closes it; `{{` and `}}` are literal braces.
- The placeholder holds a full **condition** expression of the conditional plan (§3.2 there), not just
  `bitOr`, so `{A == 3}` prints 0 or 1. That plan's §4.8 now says so too.
- An optional `:format` (§3.3) ends the placeholder. The format is recognised only as a **top-level
  `:` followed by a format name and `}`**. That keeps `{b[05:$C010]}` and `{05:Flags}` (the
  conditional plan's partition and bank-local forms) working. A bank-local label whose name *is* a
  format name is written in parentheses: `{(05:hex8)}`.
- A leading `[NAME]` (letters, digits, `_`, `.`) is the group (L11) and is not printed.
- The whole template is checked when the logpoint is created (same error ranges as conditions);
  an unknown label is a warning and makes the logpoint inactive (C14).

### 3.2 DeZog dialect (source comments)

```text
[SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}
Status=${w@(HL)}, ${DE}, ${b@(DE+1)}
Freq=${Remote.cpuFrequency/1000000}MHz
```

- `${` opens a placeholder and `}` closes it. Every other character, including a lone `$` or `{`,
  is literal text.
- The expression is parsed by the DeZog dialect parser (§3.4).
- The text after the `LOGPOINT` keyword is taken to the end of the comment and trimmed.

### 3.3 Formats

Formats apply in both dialects and work on the value's low bits.

| Format | Output | Example (value $F3) |
|---|---|---|
| `hex8` | 2 hex digits | `F3` |
| `hex16` | 4 hex digits | `00F3` |
| `uint8` / `uint16` | unsigned decimal of the low 8 / 16 bits | `243` |
| `int8` / `int16` | signed decimal of the low 8 / 16 bits | `-13` |
| `bits` | binary, 8 digits for a value below 256, otherwise 16 | `11110011` |
| `string` | the value is an address; bytes are read up to a 0 or at most 64, ZX characters mapped back (`$60` → `£`, `$7F` → `©`, `$5E` → `↑`) (Q8) | `HELLO` |
| *(none)* | a bare register, flag, special or memory access: `$` plus width-aware hex (`$3F`, `$C000`, `$12345678` for `l[…]`; a flag prints `0`/`1`); any other expression: decimal (Q2) | `$F3` |

The `hex8`/`hex16` formats carry no `$` prefix, as in DeZog's examples, so a template can choose
its own (`$${HL:hex16}` in DeZog form, `${HL:hex16}` in Klive form). The prefixed default exists
because a bare `{HL}` should read like the rest of Klive's debugger views. DeZog's own default is not
documented, and D3 asks for compatible *sources*, not identical log text.

### 3.4 The DeZog expression dialect

A separate lexer and parser in `src/common/utils/breakpoint-condition/dezog/` that emits the
conditional plan's `CondNode` tree (§3.8 there). It is shared with G1.5, whose ASSERTION
conditions use the same language.

| DeZog | Tree |
|---|---|
| `b@(e)`, `w@(e)` | `mem` node, width 1 / 2, little-endian, current paging |
| `A`, `HL`, `IXL`, `AF'` … | `reg` node (the same register profile) |
| `sprite.counter` | `label` node; dotted names are one identifier, looked up by full name |
| `0x1F`, `1Fh`, `31` | `num` node |
| `+ - & \| ^ ~ << >> ! && \|\| == != < <= > >=` | the existing `un` / `bin` nodes |
| `*`, `/`, `%` | `*` and `/` are the `bin` operators added to the shared grammar (Q4); `%` is a new `bin` operator that only this dialect can produce. `/` and `%` are **integer** operations, truncating toward zero like C, and divide-by-zero is an evaluation error (Q3) |
| `Remote.tStates`, `Remote.cpuFrequency`, `Remote.slots` | the special functions of §3.5 |

- **Precedence is C's**, not the Klive dialect's: relational binds tighter than bitwise, `&&` tighter
  than `||`. The parser builds the tree the C way; the tree does not care which grammar built it.
- Literal forms beyond the documented ones (`$1F`? `%1010`? character literals?) are checked against
  DeZog's documentation in Phase 2. Anything undocumented is rejected with a clear message rather
  than guessed.
- **Integer division is a documented difference** (Q3): DeZog's own example
  `${Remote.cpuFrequency/1000000}MHz` prints `3` for a 3.5 MHz machine in Klive, where DeZog's
  floating-point division may print `3.5`. Values stay exact integers (C4 of the conditional plan).
- A division by zero at hit time logs `<division by zero>` in place of the value; it does not stop
  the machine or drop the line.
- DeZog also accepts ZEsarUX-style operators (`=`, `OR`, `peek()`). **Not supported**; they are a
  ZEsarUX remote detail, not a source convention.

### 3.5 Machine specials

New zero-argument calls, available in both dialects, in logpoint templates **and** conditions:

| Klive | DeZog spelling | Value |
|---|---|---|
| `tstates()` | `Remote.tStates` | T-states since the machine started (the CPU's `tacts`) |
| `cpufreq()` | `Remote.cpuFrequency` | the current CPU clock in Hz (base clock × multiplier; Next turbo included) |
| `frame()` | none | frames since the machine started |
| `slots()` | `Remote.slots` | text: the partition paged into each slot, in the machine's own partition labels (`R0`, `B5`, …), not DeZog's `ROM1` / `BANK10` |

A function call, not a reserved name, so no program label is shadowed (R5 of the conditional plan).
`slots()` is text, so it may only appear as a **whole placeholder**; anywhere else it is a parse
error.

---

## 4. Design

### 4.1 The model — `BreakpointInfo`

```ts
/** The template, as typed (Klive dialect) or as read from the comment (DeZog dialect). Its
 *  presence makes the breakpoint a logpoint (L1). */
logMessage?: string;
/** Which parser `logMessage` is written for. Absent = "klive". */
logDialect?: "klive" | "dezog";
```

The group is not a field: it is the template's leading `[NAME]`, derived when the template is
compiled. Runtime-only, stripped by every persister: `logError?` (the template failed to compile in
the emulator; such a logpoint **logs the error text** on every hit instead of stopping, the logging
analogue of C15).

`BreakpointOwner` gains `{ kind: "annotation" }` and `BreakpointScope` gains `{ kind: "annotation" }`;
`breakpointMatchesScope` and `ownerForScope` handle them, and the project and sidecar savers skip
the owner (they already filter by scope; tests pin that).

**Keys.** An annotation logpoint is keyed `LP:[resource]:line@<address>`. The resource and line are
there for display and click-to-source; the address is there because one comment inside a macro
yields one logpoint per expansion. This key never collides with a user breakpoint on the same line,
so a user can still put a stopping breakpoint on a line that has a LOGPOINT comment.

### 4.2 `DebugSupport` and the decision

- A definition with `logMessage` sets the conditional plan's slow-path flag (`COND_BP`; renamed to
  `SLOW_BP` if that reads better once it has two reasons), so the fast path is untouched.
- In the slow path, for each enabled definition that claims the address and whose group is enabled:
  condition → hit rule → **if it is a logpoint, format its template and queue the line; otherwise
  vote "stop"**. Every logpoint at the address logs, in key order.
- **Arrival rule (L5).** `DebugSupport` remembers the address of its last evaluation and whether it
  happened after an executed instruction. At `instructionsExecuted == 0` logpoints are skipped if this
  address was already evaluated on arrival. Phase 3 pins the cases with tests in
  `test/emu/debug-step-decision.test.ts`:
  1. a run passing through a logpoint logs once per pass;
  2. stopping at a breakpoint with a logpoint at the same address logs once; Continue does not log again;
  3. Step Into onto a logpoint logs; Continue from there does not;
  4. Pause while sitting on it, then Continue: no second line;
  5. Step Over a CALL whose routine has a logpoint: it logs (breakpoints are checked during stepped-over calls);
  6. a machine started with PC on a logpoint logs once.
- **The queue.** `DebugSupport` holds `pendingLog: { text, group, address }[]` plus a dropped
  count. `MachineController` drains it at the end of every frame that produced lines, and before
  `describeDebugStop` is sent (L4), with one `displayOutputBatch` call (L8). The per-frame cap is L9.
- **Formatting** lives in `src/common/utils/breakpoint-condition/format.ts`. The hex and binary
  helpers move there from `ide-commands.ts` if they are a clean fit; otherwise the new module gets
  its own small ones. The template compiles once, on arming, into literal segments and
  `(CondNode, format)` pairs.
- **Groups.** `DebugSupport.setLogGroups({ enabled: boolean; groups?: string[] })`, the DeZog model:
  all on, all off, or only the listed groups on. Changing it bumps `breakpointsVersion`.

### 4.3 The output

Log lines go to a **new output pane, *Log*** (`PANE_ID_LOG = "log"`, Q1), registered next to the
`emu` and `build` panes. It can be cleared on its own, and a busy logpoint does not bury debug-stop
and machine messages in the `emu` pane. The pane does not steal focus. When the first line of a debug
session arrives, the `emu` pane gets one hint: *Logpoint output is in the Log pane*.

Each line is `[GROUP] message`, in a distinct colour (a token, not a literal), with a trailing dimmed
`@ $8012` (the display key's address part).

### 4.4 Commands

- **`bp-set <spec> … [-log "<template>"] [-hit <spec>] [-if <condition>]`**: `-log` takes a
  double-quoted string (the tokenizer's escapes: `\"`, `\\`) and must come before `-if`, which stays
  the raw tail. Errors print with a caret under the template, as condition errors do.
  - `bp-set $8000 -log "x={A} at {PC:hex16}"`
  - `bp-set [main.asm:42] -log "[LOOP] B={B}" -hit *100`
- **`bp-list`** shows ` -log "<template>"`, so a pasted line recreates the logpoint. Annotation
  logpoints are listed under their own heading with their source location, read-only.
- **`bp-del` / `bp-en`** accept and ignore `-log`; they do not touch annotation logpoints (edit the
  comment and rebuild).
- **New `lp-en [<group> …] [-d]`**: with no groups, enables (or with `-d` disables) all logging;
  with groups, enables only those (or disables those). **New `lp-groups`** lists every known group,
  its state and how many logpoints it holds.

### 4.5 The dialog, margin and panel

- **Breakpoint dialog:** an **Action** row, *Stop* or *Log message*. *Log message* shows a monospace
  template field validated on every keystroke by the same compiler (column-accurate errors, label
  warnings). The validation goes in `breakpoint-form.ts`, as all its rules do.
- **Editor margin menu** (introduced by the conditional plan's §4.4.2): *Add Logpoint…* on a line
  without a breakpoint, *Convert to Logpoint…* / *Convert to Breakpoint* on one with a breakpoint.
- **Glyphs:** the logpoint glyph is a **diamond** (the VS Code convention), in the same colour
  family as breakpoints, with the conditional and inactive variants of the conditional plan.
  A LOGPOINT comment line shows a **hollow** diamond, owned by the build. Hovering it
  shows the template, its group, the address or addresses, and any compile warning. *Amended
  2026-10-03 by [ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md](ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md)
  Q6:* the mark is no longer read-only - like an ASSERTION or WPMEM mark, a click disables the
  comment's logpoint for the session, and right-click (and the panel row's menu) offers
  Disable/Enable and Show in Disassembly. It still cannot be deleted from the IDE.
- **Breakpoints panel:** user logpoints are ordinary rows showing their template. Annotation
  logpoints appear in a **"LOGPOINT comments"** group with one checkbox row per log group (wired to
  `setLogGroups`) and the comment logpoints under it; clicking one opens the source line.
- Colours come from tokens only; `.ai/ui-theming-intent-and-lessons.md` is updated in the same
  change (standing rule).

### 4.6 Persistence

`logMessage` and `logDialect` persist with user breakpoints wherever breakpoints persist (project
file, `.nex.dis` sidecar). Phase 1 extends the round-trip tests of the conditional plan's §4.7. A
source logpoint that moves with its line keeps its template. Annotation logpoints are never
persisted.

**The group switch state is persisted in the project file** (Q5), next to its breakpoints, as
`logpointGroups: { enabled: boolean; groups?: string[] }`. It is absent when everything is on, so
existing project files stay byte-identical. The project file's schema version is checked in Phase 1.
Opening a project pushes the state to the emulator with `setLogGroups`.

### 4.7 Source annotations from the build

A new, kind-tagged collection on `DebuggableOutput`, meant to be reused by G1.5:

```ts
type SourceAnnotation = {
  kind: "LOGPOINT";            // G1.5 adds "ASSERTION" | "WPMEM"
  fileIndex: number;
  line: number;
  address: number;             // where it fires (§1.2: the next instruction for a comment-only line)
  partition?: number;          // when the build knows the bank
  text: string;                // everything after the keyword, trimmed
};
debugAnnotations?: SourceAnnotation[];
```

After every successful build the IDE compiles each annotation (DeZog dialect), reports problems as
build warnings with file and line (L13), and installs the result with
`resetBreakpointsTo(list, { kind: "annotation" })`. A failed build leaves the previous set in place,
as source breakpoints do.

**Klive assembler.**
- Scan `AssemblyLine.comment` on **every assembled line**, comment-only and label-only lines
  included, for the case-sensitive word `LOGPOINT`.
- Address: the line's own address if it emits code; otherwise the location counter at that line,
  which is the address of the next instruction emitted in the same segment.
- Lines in a false `IF` branch produce nothing, because they are not assembled. This is better than
  DeZog's list-file reader, which documents that it also picks up comments in non-assembled areas.
- Inside a macro, each expansion yields its own annotation. Phase 4 first checks that the comment
  survives expansion.
- The partition comes from the segment's bank when there is one.

**sjasmplus.**
- **Keep `K` lines.** Parse the keyword out of the data, and decode the address and page exactly as
  the `T` lines do (G10.3 owns any fix for banked addresses there; this plan follows whatever it
  decides).
- **Fix `extractSldInfo`**: rejoin `parts.slice(7)` with `|`, because a comment may contain `|`
  (`${A | B}`).
- **Produce symbols from `L` lines** (Q7, in this plan): module, main and local name joined with dots, the way
  DeZog expects labels to be written. This also turns on labels in conditions for sjasmplus projects,
  which are inactive today.
- **`SLDOPT` warning, never an injected option** (Q6): Klive does not rewrite user sources, and
  sjasmplus has no command-line switch for `SLDOPT`. When a build yields no `K` lines but a source file in `sourceFileList`
  has `LOGPOINT` in a comment, warn: *add `SLDOPT COMMENT LOGPOINT` (or `WPMEM, LOGPOINT, ASSERTION`)
  to use DeZog logpoints*.
- **Verify the comment-only line case** with a real sjasmplus in Phase 4: does a keyword in a
  comment on a line of its own produce a `K` line, and at which address? sjasmplus documents
  end-of-line comments only.

Other compilers (Klive BASIC, Pasta80, zxbasm, z88dk) produce no annotations; that is out of scope.

---

## 5. Phases

Each phase ends green on its focused tests, `npm run build:check`, and, when renderer React code is
touched, `npm run lint:renderer`.

### Phase 1 — model, ownership, keys, persistence (nothing user-visible)
`logMessage` / `logDialect`; `logpointGroups` in the project file (Q5); the `annotation` owner and scope in every switch; the `LP:` key; that
`logMessage` is not in the identity key; round trips through project file and sidecar; savers skip
annotation-owned breakpoints.

### Phase 2 — templates and the DeZog dialect
Template compiler for both dialects (placeholders, escapes, the top-level-`:` format rule, groups,
error ranges); formats; the specials; the DeZog lexer and parser with C precedence, `b@`/`w@`,
dotted labels, `h`-suffix and `0x` literals, the new `*` `/` `%` operators. Node-project tests cover
every example in §1.2 and §3, every format at its boundaries (`int8` of $80, `bits` of $100), the
precedence differences between the two dialects (`A & 0x0F == 3`), and every error message.

### Phase 3 — `DebugSupport`, the decision and the output path
Logpoint outcome in the slow path, the arrival rule (§4.2 cases), the queue with its cap and dropped
count, the per-frame flush and the flush before a stop message, `setLogGroups`, the specials'
context (`tstates`, `cpufreq`, `frame`, `slots`) in every machine that provides a condition context.
**Real-machine tests** through `test/harness/sp48/` and `test/harness/zxnext/`: a logpoint in a
`DJNZ` loop logs B = 10 … 1 in order; `-hit *4` logs every fourth pass; a logpoint and a breakpoint at
one address log and stop with the line first; a memory-write logpoint shows `VAL`; a logpoint with
the group disabled is silent; a 100 000-pass loop hits the cap, reports the drop, and keeps the frame
rate. Missing harness capabilities are added as session methods.

### Phase 4 — build integration
Klive assembler annotations (inline, comment-only, label-only, macro, false `IF`, banked segment);
sjasmplus `K` lines, the `|` fix, `L`-line symbols, the `SLDOPT` warning, with fixture SLD files in
tests. The real-sjasmplus check of §4.7 runs locally, never in CI. The IDE side: compile, warn, and
`resetBreakpointsTo` after every build; a failed build keeps the old set. An end-to-end test assembles
a DeZog-style sample and runs it on the sp48 harness, checking the logged lines.

### Phase 5 — commands
`-log` on `bp-set` (accepted on `bp-del` / `bp-en`), `bp-list` output and its paste-back round trip,
`lp-en`, `lp-groups`.

### Phase 6 — dialog, margin, glyphs, panel, output
The *Log* output pane (Q1); the Action row and template field (`breakpoint-form.ts` in node tests, the dialog in jsdom), the
margin items, the diamond glyphs, the panel group with group checkboxes, the output styling.
Verified in the running app (CDP recipe in `.ai/ui-theming-intent-and-lessons.md`), not in a replica.

### Phase 7 — docs, roadmap, lessons
- `docs/content/working-with-ide/breakpoints.mdx`: a "Logpoints" section with the template
  reference and a "DeZog LOGPOINT comments" subsection, including the sjasmplus `SLDOPT` line.
- `docs/content/commands-reference.mdx`.
- Code fences in these pages use only registered languages (`AGENTS.md`).
- Run `npm run doc:build && npm run doc:check`.
- Mark G1.4 done in the base plan, and update §2 and §4 of `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`.
- Add the logpoint glyph and colour to the theming lessons file.

---

## 6. Risks

- **R1 — hot loops.** Every hit pays one register sync, a tree walk per placeholder and a string
  build. The cap (L9) protects the IDE; it does not make the loop fast. The measured cost goes into §9.
- **R2 — output flooding.** Even below the cap, a logpoint per frame produces 50 lines a second. The
  output pane's own buffer limit and scrolling are checked in Phase 6; the dedicated *Log* pane (Q1)
  can be cleared without losing build or machine output.
- **R3 — DeZog dialect drift.** DeZog's expression language is documented by example, not by
  grammar. Anything undocumented is rejected with a message naming the construct, so a gap shows up
  as a clear warning in a real project, never as a silently wrong value.
- **R4 — sjasmplus address encoding.** `K` lines share the `T` lines' address encoding, slot bits
  included; any error there shows up in both. Phase 4 tests on 48K, 128K and Next devices.
- **R5 — the arrival rule.** It depends on the order of the pause check and the decision in each
  debug loop. Phase 3 surveys every caller of `shouldStopAtDebugPoint` before implementing it.

---

## 7. Verification

- Unit: template compiler, DeZog parser, formats, `DebugSupport`, the decision's arrival cases,
  commands, form.
- Real machine: the sp48 and zxnext harness tests of Phase 3, and the end-to-end assembly test of
  Phase 4.
- In the IDE:
  - Set a logpoint by command, by dialog and from the margin; run a loop and watch the output.
  - Convert a logpoint to a breakpoint and back.
  - Toggle groups from the panel and with `lp-en`.
  - Build a sjasmplus project that has DeZog LOGPOINT comments, with and without `SLDOPT`, and check
    the warning.
  - Edit a comment, rebuild, and see the new text.
  - Save and reopen the project: user logpoints survive and annotation logpoints come back only
    after a build.

---

## 8. Out of scope

- G1.5 ASSERTION and WPMEM. They reuse §3.4 and §4.7 and add only their annotation kinds.
- LOGPOINT comments in Klive BASIC, Pasta80, zxbasm or z88dk sources.
- A Klive-dialect comment keyword for Klive assembler sources (Q9). DeZog's `LOGPOINT` works there,
  and user logpoints cover the Klive dialect.
- Logging to a file.
- Non-Z80 machines.
- DeZog's ZEsarUX-style operators.
- Reverse debugging. When G4 lands, logpoints must stay silent during replay, as DeZog's do; G4's
  plan inherits that requirement.

---

## 9. Implementation notes (2026-10-03)

**Verification.** Unit tier and both e2e tiers green (`npm test`), `npm run build:check` (no new type
errors), `npm run lint:renderer` (0 errors), the Vite build, `npm run doc:build && npm run doc:check`.
Checked in the running app through the Playwright harness (`scripts/doc-shots/harness.cjs`, a
throwaway sp48 project in a scratch folder): `compile` → `bp-set $8009 -log …` → `debug` produced the
Log pane lines `[LOOP] B=$05, counter=$00 @ $8005` … `[END] …` `[USER] ret with A=5 @ $8009`, the
Emulator pane's one hint, the Breakpoints panel's *Log groups* and *LOGPOINT comments* sections with
live counts (5×, 1×, 1×), and the margin's diamonds. That run found one defect (below).

**Departures from the design.**
- **Evaluation is in C**, because conditions moved there after this plan was written
  ([BREAKPOINT_CONDITIONS_IN_C_PLAN.md](BREAKPOINT_CONDITIONS_IN_C_PLAN.md)). Every value placeholder
  is a program of its own in the core's store (sharing its 256 slots with conditions; no room →
  `<error>` and a `logError` note), run with `condEvaluateValue`. New in `z80-condition.c`: `MUL`,
  `DIV`, `MOD` (C semantics, `INT64_MIN / -1` guarded), `TSTATES` (hook `COND_TSTATES`, default
  `cpu.tacts`), `ENV` (the clock and frame counter, written by TypeScript with the new `condSetEnv`
  export before a program that reads them runs), status `COND_RESULT_DIVZERO` (3; a condition treats
  it as an error, fail-safe), and the `condPeek` export the `string` format reads with. All five
  cores rebuilt within their size budgets.
- **The DeZog dialect is a second parser over the one checker**: `dezog/dezog-parser.ts` builds the
  shared `SyntaxNode` tree and `compileConditionWith` checks it. A non-register name is passed as a
  quoted label, so Klive's flag names and `VAL`/`ADDR` are labels there.
- **Default format (Q2), read narrowly:** "special" means `VAL`/`ADDR`. The machine specials, labels
  and signed accesses print in decimal - T-states and Hz in hex would be unreadable.
- **The group switch lives in the shared store** (`AppState.logpointGroups`, `SET_LOGPOINT_GROUPS`),
  so the commands, the panel, the project save and the emulator read one value. `DebugSupport`
  picks it up lazily by reference (`logGroupState`); `setLogGroups` remains for direct use.
- **Annotations are checked in the main process** right after a compile (`checkSourceAnnotations`
  in `RendererToMainProcessor.compileFile`): a malformed comment is dropped with a build warning
  (`LP001`), an unknown label warns (`LP002` is the sjasmplus `SLDOPT` warning). The IDE installs the
  rest in `refreshSourceCodeBreakpoints` (`buildLogpoints`, every build path); the emulator compiles
  them again against the real machine facts.
- `SourceAnnotation` gained `segmentIndex`: the Klive assembler records the segment and the IDE
  derives the partition with `resolvedPartitionFor`, as for source breakpoints.
- **The arrival rule** (L5) is `DebugSupport.lastDecisionPc` / `logArrival`, set in
  `shouldStopAtDebugPoint`; the controller clears `lastDecisionPc` on every machine start. On the
  interpreted path (`MachineFrameRunner`), Step Into answers before the decision, so a logpoint
  stepped onto logs on the following Continue instead - still once.
- **Flushing:** the per-frame `displayOutputBatch` is not awaited (frame rate); it is awaited before
  a stop message, so the lines come first (L4).
- Annotation logpoints are also cleared when a **project opens** (they belong to the previous
  project's build), besides on a machine change.

**Defects found and fixed.**
- `refreshSourceCodeBreakpoints` reset the project scope with *every* listed breakpoint, which would
  have restamped a sidecar's breakpoints (and now the build's logpoints) as project-owned; it now
  passes only project-owned ones.
- The editor's binary-address margin path did not pass the breakpoint to the glyph chooser, so an
  address logpoint (and an address breakpoint with a condition) drew a plain dot.

**Not verified here.** No sjasmplus binary is installed on this machine, so the §4.7 real-sjasmplus
check (a keyword on a comment-only line; 128K/Next page encoding of `K` lines) was not run; the
`K`/`L` parsing is tested against the documented SLD v1 format. `K` addresses are decoded exactly as
`T` lines are (`value`, no page), per G10.3.

**R1, measured** (48K, the conditional plan's loop, noisy): a bare pass ≈0.7 µs; a logged pass with
1-3 placeholders ≈0.3-0.8 µs more. A 100 000-pass loop holds 256 lines per frame and counts the rest.

**Where things are.** Model: `BreakpointInfo.logMessage/logDialect/logError`, owner/scope
`annotation`, the `LP:` key (`breakpoints.ts`), `breakpoint-filters.ts`. Engine:
`logpoint-template.ts`, `dezog/dezog-parser.ts`, `integer-symbols.ts`. Emulator: `DebugSupport`
(`handleHit`, `queueLog`, `takeLogLines`), `logOutput.ts`, `MachineController.flushLogLines`,
`conditionStore.ts` (`conditionMachineInfo`). Build: `source-annotations.ts`, the Klive assembler's
`emitSingleLine`, `SjasmPCompiler` (`sldSymbols`, `sldAnnotations`). IDE: `BreakpointCommands.ts`
(`-log`, `lp-en`, `lp-groups`), `breakpoint-form.ts`, `BreakpointDialog.tsx`,
`marginBreakpointMenu.ts`, `breakpoint-filter-text.ts` (glyphs), `breakpoint-grouping.ts`
(`logpointSections`), `BreakpointsPanel.tsx`, the Log pane (`PANE_ID_LOG`). Tests:
`test/debug/logpoint-template.test.ts`, `test/debug/logpoint-model.test.ts`,
`test/wasm/condition/logpoint-evaluation.test.ts`, `test/wasm/condition/debug-support-logpoints.test.ts`,
`test/emu/logpoints-real-machine.test.ts` (with the end-to-end DeZog sample),
`test/z80-assembler/logpoint-annotations.test.ts`, `test/sjasm-int/sld-logpoints.test.ts`,
`test/commands/logpoint-commands.test.ts`, `test/renderer/logpoint-ui.test.ts`, and additions to the
dialog, margin-menu and project-save tests. The sp48 harness's `continueToBreakpoint` gained
`onFrame`.

---

## 10. Questions

### 10.1 Answered by the project author (2026-10-03)

All ten suggested answers were accepted.

| Q | Answer | Where |
|---|---|---|
| Q1 output | A new *Log* output pane. | §4.3, Phase 6 |
| Q2 default format | `$` plus width-aware hex for a bare register, flag, special or memory access; decimal for any other expression. | §3.3 |
| Q3 DeZog `/` | Integer division, truncating toward zero; the difference from DeZog is documented. | §3.4 |
| Q4 `*` and `/` | Added to the Klive dialect too, and therefore to conditions; no `%` there. | §3.4; `CONDITIONAL_BREAKPOINTS_PLAN.md` §3.2 |
| Q5 group state | Persisted in the project file. | §4.6, Phase 1 |
| Q6 `SLDOPT` | Warn only; the IDE never adds it. | §4.7 |
| Q7 sjasmplus symbols | From `L` lines, in this plan's Phase 4. | §4.7, Phase 4 |
| Q8 `string` | An address; up to a 0 or 64 bytes, ZX characters mapped back. | §3.3 |
| Q9 Klive comment keyword | Not now. | §8 |
| Q10 cap | 256 lines per frame. | L9 |

### 10.2 Still open

Nothing.
