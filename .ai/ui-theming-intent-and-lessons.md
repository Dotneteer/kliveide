# UI Modernization: Intent And Lessons

Durable notes from the Phase 0–9 UI modernization and the Phase 10 / Phase 11 follow-ups
(`.plans/UI_MODERNIZATION_PLAN.md`). Read `../AGENTS.md` first. Read this before touching theming,
tokens, the shared data-display primitives, the Monaco palette, **or the memory dump/disassembly
colour** (§ "Secondary Accents" and § "View-Scoped Colour" below).

The plan file is the detailed record: every phase has a retrospective written **after** it shipped,
including the mistakes. This file is the part worth carrying into unrelated work.

> ## Standing Instruction From The Author
>
> **Every style or theming change updates this file, in the same change.** Not a changelog entry —
> the durable rule the change taught, written so a session that never saw the work can apply it.
> Fold new learnings into the existing sections; if a rule here is superseded, **replace it**.
>
> The author is explicit that *the history of the learnings is not wanted* — only their current
> state. Do not append "Phase N found…", do not date entries, do not keep a superseded rule beside
> its replacement. This file is a standing brief, not a log.

## Settled Intent — Do Not Re-Litigate

These were decided by the project author. Changing them is a product decision, not a refactor.

| Decision | Choice |
|---|---|
| Visual direction | Refined VS Code / Fleet. Same bones, softer skin. No OS vibrancy, no shell rethink. |
| Density | **Compact.** This is a debugger with many value panels; density is a feature. |
| Layout freedom | Restyle + targeted layout fixes only. *Nothing moves, everything is re-drawn.* |
| Accent | **Six**, a user setting orthogonal to light/dark. Sinclair Blue is the default. |
| Light theme | **Derived by construction** from the same ramps as dark, with four hand-tuned exceptions. |
| Device surfaces | **Theme-invariant.** The emulated machine is hardware; hardware has no light mode. |
| Rainbow motif | Confined to empty states and the About panel. Order (red, yellow, green, cyan) confirmed correct by the author. |
| Monaco | The syntax palette is a **fixed multi-hue table**; only the *keyword* colour follows the accent. Comments are green and italic, never grey. Which `.zxbas` words get which class is not hand-kept: the Monarch lists come from the generated BASIC help data (`monarchWordLists()` in `src/common/kbasic/help.ts`), so a word is coloured as a keyword exactly when Klive BASIC knows it — change the spec or the overrides and run `npm run kbasic:help`, never edit the lists. BASIC hovers use Monaco's own markdown (a `zxbas` code fence, plain lines, an italic attribution footer) and add no styling. **Editors set `fixedOverflowWidgets`:** Monaco shifts a hover that does not fit right of its word to the left, past the editor's edge, and the document panel clips whatever lies outside it (a wide BASIC keyword hover near column 1 lost its left side). Hovers, suggestions and parameter hints therefore live in Monaco's fixed overflow layer; do not turn it off, and do not try to fix such clipping with hover widths. **Gutter folding chevrons take the editor's font size** (`font-size: inherit` in `MonacoEditor.module.scss`), not Monaco's 140%, which made them louder than the line numbers and wider than their column. Size gutter glyphs from the editor font, never with a fixed step. **Injected text (`before`/`after` decorations) needs a non-empty range and a scoped colour:** Monaco 0.55 draws no `before` text on an empty-range decoration (the statement-breakpoint markers were invisible for that reason; they now cover the statement's first character), and it gives injected text the token class of the text it stands in (`mtk1`), which beats a bare module class — scope such classes under `:global(.monaco-editor)`. Check injected text in the running app, where both failures are silent. |
| Window chrome | Frameless/title-bar toolbar: **explicitly deferred.** |
| Secondary accent | **Yes, added in Phase 10.** Every accent has a second hue (`--accent-secondary-*`), for the specific case one hue can't cover — two things in the same view that must both read as accent-tied and clearly apart. Not a general "add more colour" licence; see below. |
| Memory dump / disassembly colour | **These two views are exceptions to §5.2's neutral data-panel hierarchy**, added in Phase 10 — hex-editor-style views read better for real colour. |
| Sidebar panel headers | **A shallow top-lit gradient band** (`--surface-header*`), added in Phase 11. Deliberately not a flat fill: the band is 26px and the list rows under it are 22px and also hover-highlight, so a flat strip reads as *a selected row*. A lit strip reads as chrome. |
| Sprite editor layout | **Document editors are exempt from the `Layout freedom` rule above, which governs the shell.** The sprite editor was rebuilt as one CSS grid — tool rail, pane-fitted canvas with rulers, right inspector, sheet browser — because its canvas was capped at 513px however wide the pane was, so the editor got *emptier* as the window grew. A workspace whose content cannot use its own pane is not fixable by redrawing. |
| Modal dialogs | **A floating tool panel, not a lifted card.** Header and footer are flat `--surface-chrome` at `--strip-panelHeader` (30px) with `--border-default` seams — the shared `PanelHeader` idiom — an 11px/600 uppercase title, `--radius-md`, and the accent on **one chip** behind an optional header glyph (`ModalProps.iconName`), never a slab. Dialogs were never in the modernization and had to be brought in wholesale; the four treatments were prototyped and the author chose this one. |
| Overflow (scroll) shadow | **6px, a 1px hairline over a gradient**, app-wide via `AttachedShadow`. The author chose the height against 14/8/6/4/1px. It says "there is content above", it does not dim the first row. |
| Sidebar "..." menu and panel badges | **Extension points exist, unused by default** (`Activity.commands`, `SideBarPanelInfo.badge`). An activity with no commands renders **no button at all**. The Testing activity is the first with commands (`TestingCommands`: Add unit-test support and the runs). Badges so far: Breakpoints, Watch (neutral counts) and Unit Tests (failures, `tone="error"`, so it is absent when everything passes). |
| Next palette display | **Four device sections, one fixed-cell grid.** The sidebar panel is ULA / Layer 2 / Sprites / Tilemap — *one palette with two banks each*, never eight peers — each row carrying a 32px thumbnail of its whole palette and a two-segment bank control: the fill is the bank you are *looking at*, an accent ring is the bank the machine is *drawing with*. The ring marks the **exception** — the two coincide by default, so it only becomes visible once the view is pinned away from the hardware. `NextPaletteViewer` has no "small" mode and is **sized from its swatch** (`cellSize`, 14px in the sidebar), never from its container. |
| Navigation history (Go Back / Forward) | **Toolbar controls, not per-area buttons** (the author chose Option A over buttons in each document header): Back, a narrow chevron that opens the history list, and Forward, grouped with no internal gap at the **start** of the IDE toolbar, then a separator. Neutral `--color-toolbarbutton` glyphs; the tooltip names the target and the shortcut. The list is a portalled popover — see "A Menu-Like List With A Header". |
| Register/state panel colour | **A third exception, added after Phase 10** at the author's request, panel by panel — Z80 CPU, ULA & I/O, Next Registers, Next Memory Mapping, Call Stack, Watch, Breakpoints, the Copper panel and Copper List, the Sprite Inspector, the Tilemap Inspector, the Layer 2 Inspector, the Layers document and the Execution History (whose plans asked for it). Every *value* takes the primary accent (`--color-state-value`); labels stay `--data-label`. **One hue, plus the secondary (`--color-state-value-alt`) wherever a row carries two kinds of number with nothing but position to tell them apart** — `NextRegPanel`'s previous value, `MemMappingPanel`'s page offsets, `CallStackPanel`'s stack slot beside its return address. Contrast the Z80 shadow bank, which asked for the same treatment and was refused — `AF'` is *named* differently from `AF`, so the hue would buy nothing. Panels that have not been converted stay neutral; convert one by passing `valueXclass`/`iconFill`, never by restyling the shared primitives. |

> **Phase 8's Monaco palette was wrong and has been replaced.** It generated every class as a
> lightness step of the accent, which put nine of eleven classes in one blue and comments in neutral
> grey. Syntax highlighting needs **hue** to separate classes; grey comments read as disabled text.
> The replacement is a fixed multi-hue table with only the keyword following the accent, and three
> tests now guard it (comment saturation floor, hue spread, and every class held clear of the
> keyword for all six accents). Before touching `theming/tokens/syntax.ts`, read
> **`.plans/SYNTAX_PALETTE_REVISION_PLAN.md`** — including its retrospective, which records that the
> two tightest accent pairings were reviewed and **deliberately left as they are**.

## Secondary Accents

Full derivation, per-accent numbers and the WCAG accounting are in `.plans/UI_MODERNIZATION_PLAN.md`
§10.2. What to carry forward:

- **Each accent has a second hue**: `--accent-secondary-solid`/`-solid-hover`/`-subtle`/`-border`/
  `-text`/`-text-subtle`, generated in `semantic.ts` from `AccentDef.secondary` exactly the way
  `--accent-*` is generated from `AccentDef.solid`. `--text-on-accent-secondary` mirrors
  `--text-on-accent`.
- **It exists for one reason: two things in the same view both need to read as accent-tied *and*
  clearly apart.** It is not a second colour to reach for whenever something "needs more colour" —
  if only one thing in a view needs an accent, that is `--accent-*`, full stop.
- **The test that separates a real case from a wanted one is whether anything *else* already tells
  the two apart.** Four attempts, three accepted, and the refusal is the instructive one:
  - *Refused* — the Z80 shadow bank. `AF'` is already named differently from `AF`, so a second hue
    duplicates what the label says.
  - *Accepted* — `NextRegPanel`'s previous value (`08 → 08`): the same register a moment apart,
    with nothing but position separating the pair.
  - *Accepted* — `MemMappingPanel`'s page rows (`FF -- 000000 0000FF`): bank numbers and memory
    offsets, four unlabelled hex numbers where only the colour split says where the pair breaks.
  - *Accepted* — `CallStackPanel`'s rows (`4: 5BFF → FF00`): the stack slot an address is *stored
    at* against the address it *returns to*. Two 16-bit numbers of identical shape, one row apart
    from meaning completely different things.
  - *Accepted* — `BreakpointsPanel`: the resolved address against the disassembled instruction at it.
    Same split by role — the addresses locate, the instruction is what the row is for.

  All the accepted cases share the shape: **one row, two kinds of number, no words**. Dropping the
  weaker of a pair to plain `--data-secondary` is not a consolation prize either — it makes the
  thing read as chrome rather than as a value, which is wrong when both are data.
- They share **one token**, `--color-state-value-alt`, for the same reason the panels share
  `--color-state-value`: the role is "the second kind of value in this row", not "the previous
  value" or "the offset column". Name a role, not a use.
- **A hue rotation with the primary's own lightness is not automatically legible.** Blue-family
  hues carry far less of WCAG's relative-luminance weight than green/yellow (0.0722 vs. 0.7152), so
  a rotation that lands in blue can fail the 4.5:1 text floor even though the primary it was
  derived from clears it comfortably. Separately, hue alone does not reliably separate two colours'
  *luminance* — a rotation can leave the secondary reading as the same colour as its own primary
  even when both are individually legible. **Check contrast against the background AND against the
  primary, not just one.** Sinclair Blue and Deep Teal needed the first fix, Spectrum Magenta the
  second; Ultraviolet and Phosphor Green needed neither because their primaries already sit at a
  lightness that carries over safely.
- If you add a seventh accent (§5.4 already asks for a `token-contract.test.ts` re-run), it needs a
  `secondary`/`onSecondary` pair through the same two checks, not just a hue offset copied from a
  neighbour.

### When neither accent is the answer: borrow the hue of the thing you are counting

The accent pair says "these two are the same kind of thing, told apart". A mark that is a *different
kind of fact* from everything around it is not a third member of that pair, and giving it
`--accent-secondary-*` would claim a relationship it does not have.

The NEX viewer's bank heading is the worked case. It carries three marks: `PC $C004` and `SP $FF00`,
which are facts the file states and correctly share the accent pair, and a breakpoint tally, which is
a fact about what the *debugger* has armed. The tally takes `--color-breakpoint-binary` — the token
the gutter dot the user clicked to create it is painted with — so the count and the dots it counts
read as one thing. Reaching for a third accent would have made it look like a third machine register.

The rule, generally: **when a mark refers to something the user can see elsewhere in the app, take
that thing's token rather than a position in the local hue order.** The alternative — painting it by
where it sits in this row — is how the same concept ends up a different colour in every view.

Two details from the same change, both about a count rather than a value:

- **Filled, where the marks beside it are outlined.** The chips state a value; this one is a tally,
  and on a collapsed section it is the only sign that anything is in there at all. It has to survive
  being skimmed rather than read.
- **Absent at zero, never `0`.** A column of zero badges down a list is noise claiming to be
  information. The state "none" is already carried by there being no mark.

### A strip pads both its ends, not just the one you noticed

`DocumentsHeader`'s `.commandBar` had `padding-left` and no `padding-right`, so whatever a document's
tab renderer ended with sat hard against the end of the header. That was true of **every** bar — the
build-root, scripting and NEX ones all end in a `TabButton` — and went unseen while the bars were
short.

Two rules from it:

- **A container owns its own gutters, on every side.** Padding one end and leaving the other to the
  content is how an asymmetry survives: each renderer would have to know it is last, and three
  renderers each remembering to pad themselves is three chances to forget.
- **Symmetry is worth checking whenever a strip grows.** Nothing changed about the padding when the
  NEX bar went from two buttons to three; it just moved the last icon far enough right to be seen.

The same strip's *internal* spacing is a `TabButtonSpace` between buttons, which the build-root and
scripting bars already did. A new bar should match it, or its icons read as one undifferentiated run.

### A data row in a dense panel sets no height

`min-height` on a row of label/value pairs is almost always wrong. The NEX viewer's header attributes
carried `min-height: var(--space-6)` — **24px**, taller than the app's own sidebar list rows at 22px,
for content that is denser than theirs.

`controls/layout`'s `.row` deliberately sets no height, so the content decides; `Data.module.scss`'s
`.dense` exists to *remove* the height from register-panel rows, and records that keeping it made the
Z80 panel 47% taller. A dense data surface is the same kind of thing wherever it appears — a sidebar
panel, a document panel, an expandable section — and should reach for the same answer.

Reserve a row height for rows that need a **hit target** (a list you click, a menu) or that must line
up with a fixed-height neighbour. A read-only pair of short strings needs neither.

### A readout sitting in a strip of controls

The popped-out bank's toolbar is a row of things that change the document — view mode, decimal,
offset, Go To. The "where is this bank paged in" readout sits in the same strip and is not one of
them: it states something about the live machine and nothing happens when you click it.

So it is styled as machine state rather than as a control: `--color-state-value` for the value,
`--data-label` for the word that names it, monospace for the addresses it quotes. That is the same
label/value split the Z80 CPU, Next Registers and Memory Mapping panels use, and reusing the *role*
token is what makes a value read as a value in a place that has never shown one.

`--color-state-value` resolves to the accent, which is right for the same reason it is right there —
the value is what the eye should land on. Do not re-derive that from the local palette: take the
role token, and the accent follows.

Its absent state (`not paged in`) is `--data-secondary`, **not** a warning colour. A NEX bank is
paged out constantly during normal execution; painting that as a problem would cry wolf every time
the program pages a bank. Reserve the status hues for things that are actually wrong.

### Marking individual bytes in a row that is one text node

The memory dump's hex row is deliberately a single text node, with absolutely-positioned overlays in
`ch` units for the hovered byte and the last-jump byte. That is what lets the row read the hovered
byte back out of the pointer position, and it means **a byte cannot be given its own element**.

So a new per-byte mark is another overlay, not a span: lay a copy of the byte's text over it at the
computed offset. `MemoryDumpSection`'s changed-byte mark (live NEX bank vs the file) is the third
user of that mechanism. Two details that generalise:

- **Order in the DOM is the z-order.** Put a new overlay *before* the hover overlay so hovering a
  marked byte still shows the hover treatment on top, rather than the two fighting.
- **Do not fill the background.** At 16 bytes to a row, a filled cell every other byte turns a
  modified bank into a stripe pattern that is harder to read than the numbers. Colour and weight
  carry a mark; the hover overlay is the one that may fill, because there is only ever one of it.

And the pairing rule again, from the other direction: the changed-byte mark takes
`--accent-secondary-text` because the **address column** already owns the primary accent, and a mark
*inside* the row would be read as more of that. Its count in the toolbar takes the same token, so the
number and the bytes it counts are one thing — the same reason the NEX viewer's breakpoint badge
borrows the gutter dot's colour rather than picking a position in the local hue order.

A changed byte is also not painted as a status: it is the normal result of a program running, and
finding it is the whole point of the view.

**The heat map is the one per-byte mark that fills**, and the reason is the rule above turned round:
a changed byte is a fact about *that byte*, while heat is a pattern across a region - a band of fills
*is* the information. Three things keep it readable:

- **It goes behind the text, not over it.** A heat cell is an empty box at `z-index: -1` inside
  `.hexValues`, which is already a stacking context (`position: relative; z-index: 1`), so the row's
  one text node paints on top. No copy of the byte's text, so nothing can drift out of alignment. A
  cell spans its byte and half the gap each side, so a hot run reads as one band.
- **Its ramp is fixed and accent-independent** (`HEAT` in L1, three hues: execute warm, read
  green-teal, write violet). An accent ramp would collide with the changed-byte mark and the hover,
  which are the secondary accent in the same rows. L2 derives the five steps by mixing each hue into
  `--surface-panel` (`HEAT_RAMP_PCT`), so the light theme is derived, the steps are monotonic in
  lightness by construction (lighter in dark, darker in light), and they are opaque - alternate row
  tints do not change a step's meaning.
- **The text never changes colour over it.** The ramp stops where `--text-primary` still has 3:1
  over the hottest step in both tones; `test/theming/heat-ramp.test.ts` holds monotonicity, that
  contrast, the hues apart at every step and the ramp independent of the accent. A self-modified byte
  takes an *inset* outline (`box-shadow`), which shows on any step and moves no text.

**Coverage marks say "ran" in one colour everywhere.** The editor strip (Monaco's
`linesDecorationsClassName` column, so the glyph margin stays the breakpoints') and the disassembly's
coverage cell both use `--color-coverage-covered` (the success green: DeZog's convention, and the
meaning). Code that never ran is a hollow mark in `--text-tertiary` - an absence, not a problem, so
never a status hue - and only where the absence is news: the editor shows it, because every line of a
source file is the user's own; the disassembly does not, because most of a ROM listing never runs and
a hollow mark on every such row would bury the ones that did. A cell like this is reserved on every
row once there is data (the branch gutter's pattern), and absent - no reserved width - before.

### Two lines of prose about the same problem: colour one, not both

The NEX viewer's validation banner says two things at once — *"This NEX file has 3 problems."* and
then the worst one, spelled out. Only the summary takes `--status-error`; the detail sentence takes
`--data-secondary`.

Two full-strength status colours side by side read as an **alarm** rather than as information, and
the longer of the two strings is the one that would dominate. The rule generalises: when a surface
states a problem and then explains it, the statement carries the status colour and the explanation
recedes. The same applies to a warning icon plus text — the icon is the status mark, so the text
beside it does not have to be one too.

Mechanically, the detail is also the only arbitrarily-long item in a flex row, so it is the one that
gets `min-width: 0; overflow: hidden; text-overflow: ellipsis`. Without `min-width: 0` a long
sentence pushes its siblings out of the panel instead of truncating — a flex item's default
`min-width: auto` refuses to shrink below its content.

## View-Scoped Colour: Memory Dump, Disassembly & The Register/State Panels

**§5.2's neutral data-panel hierarchy (`--data-value`/`--data-label`/`--data-secondary`) still
stands for every panel that has not been explicitly excepted.** The
memory dump, the disassembly view and the converted register/state panels (Z80 CPU, ULA & I/O, Next
Registers, Next Memory Mapping, Call Stack, Watch, Breakpoints) are the deliberate exceptions, and each has
its **own** token family in `componentAliases.ts` (`--color-memory-*`/`--bgcolor-memory-*`,
`--color-disassembly-*`/`--bgcolor-disassembly-*`, `--color-state-value`) rather than a shared one, so
colouring one never touches the others or the still-neutral panels. Full role tables are in the plan
§10.3; the pattern to reuse elsewhere is:

- **One thing anchors the view in the primary accent** (an address column, usually) and **one
  column is the "most legible thing in the row"** in plain bold `--text-primary` — not accent —
  because legibility of the actual data was the point of §5.2 and still is here.
- **A highlight that could be confused with the anchor takes the secondary accent instead of
  echoing the primary.** The memory dump's hovered byte and disassembly's opcode bytes both ended up
  here; disassembly's jump-target label did not, because a label is a *name for* the address rather
  than a different kind of information, so it deliberately shares the address's hue.
- **Give a shared component (`AddressLabel`, `controls/layout`'s `Secondary`/`Value`/`Label`,
  `Tooltip`/`TooltipFactory`) an optional `className`** merged onto its existing class, rather than
  forking it or restyling it for everyone. Every other one of its 20+ other call sites simply does
  not pass the prop.
- **That override class lives in a different stylesheet than the shared component's own base
  class, so both are single-class selectors of equal specificity** — the load order between two
  separate CSS Modules files decides the tie, which is not something to depend on. Nest the
  override under something unique to the caller's own row (`.dumpSection .memoryAddress`,
  `.item .disassemblyAddress`) or double the class (`.memoryTooltip.memoryTooltip`) to force it to
  win regardless of load order.
- **A tooltip usually belongs to the row, not to the cell.** `controls/layout`'s `Label`/`Value`/
  `Secondary`/`Flag` each bind their own tooltip to their own cell, so the hit area ends up being a
  two-character hex value while the rest of a wide row is inert. `DataRow` forwards its ref, and
  `TooltipFactory` binds `mouseenter`/`mouseleave` to whatever element it is handed — so wrap the
  row (see `TipRow` in `MemMappingPanel`) and drop the per-cell `tooltip` props. It renders nothing
  inline (it portals only while visible), so it is safe as a child of the row's flex container.
  Keep per-cell tooltips only where a row genuinely has two things to say — `NextRegPanel` names
  its previous and current values separately.
- **In a narrow sidebar, a row tooltip opens *under* the row and wraps.** `placement="right"` on a
  full-width row places the box past the row's far end - past the sidebar's edge, far from the value
  it explains - and `.tooltip` has no width limit, so a sentence-long description ran out of the
  window on one line (the Z88 Blink panel). Use `placement="bottom-start"` (it aligns the box with
  the row's label) with `className={regStyles.rowTooltip}` (`max-width` in `ch`, wrapping); the
  shared `FlagFieldRow` takes `tooltipBelow` for the same. The box covers the rows below while the
  pointer is there, which is harmless: tooltips are `pointer-events: none`.

- **A row tooltip and a cell tooltip inside it are two boxes for one pointer.** Where a row's cells
  each have something to say — 192 array bytes, eight flag bits — do not give the cells tooltips
  *and* the row one: both appear, at different placements and on different timings, and a native
  `title` on the cell is the worse half of the pair (unstyled, and on the browser's clock). The
  shape that works is the memory dump's: **the row owns the one tooltip and the hovered cell only
  reports its index**, so the tooltip's *content* changes with what is under the pointer. The shared
  primitives now offer exactly that — `HexByteGrid`'s `onHoverByte` and `FlagRow`'s `onHoverBit`,
  which **suppress their own per-cell tooltips when passed**, because a caller taking over the
  content is the only reason to ask for the index. `SysVarsPanel` is the worked example.
  `FlagFieldRow` still has the double-tooltip latent (a row `TooltipFactory` over eight
  `BitValue` tooltips); it is now fixable from the same prop.
- A shared primitive can also take an **optional prop that is not a class** where the styling does
  not go through CSS — `FlagValue`/`VerticalFlagValue`/`BitValue` take `iconFill` (a token *name*,
  resolved by `Icon` via `getThemeProperty`), because an SVG presentation attribute cannot read
  `var()`. Same principle as M4: pass token names, never literals.
- **The register/state panels share one role token, `--color-state-value`, rather than a family
  each.** This is the one place the per-view rule above does not apply, and the reason is that the
  rule is about *role tables*, not about view count: memory and disassembly are separate families
  because their roles genuinely differ (address/hex/char against address/opcode/instruction), while
  every register/state panel has the same single role — "this is a live value". Adding
  `--color-ula-value`, `--color-vic-value` and so on would be a near-identical family per panel.
  Split it the day a panel needs a role the others do not have.
- **A name in the live disassembly takes the label hue of its *source*, never a hue per source.**
  The live view labels rows through the shared resolver (build symbols, the active annotation set,
  the ROM's annotations): a generated `L1234` keeps `--color-disassembly-label` (the address's
  accent, a name *for* the address), a named row takes the annotated listing's
  `--color-annotation-label`, and a ROM label takes `--color-disassembly-rom-label` — the same
  syntax-label hue, set back by **weight and slant** (400, italic) rather than by a fourth hue,
  because it names the machine's code rather than the program's and a reader scanning for their
  own routines should not have to read past every ROM call. Which source named the row, and the
  other names the address has, go in the label's tooltip, not in the colour.
- **A *predicted* state takes a status hue for the positive case and a neutral for the negative —
  never an error hue for the negative.** The disassembly view's branch gutter
  (`--color-disassembly-branch-taken` / `-fallthrough`) says whether each conditional branch will
  jump given the live CPU state. Taken is `--status-success`; falling through is `--text-secondary`,
  because falling through is not a failure, it is half of what a conditional branch does. Red was
  refused twice over: it would read as "something is wrong here", and `--status-error` /
  `--status-warning` are already spoken for *in the same row* by `--color-breakpoint-code`,
  `-binary` and `--color-breakpoint-current`. The general rule: before giving a new mark a status
  hue, check what else in that row already owns one.
- **A note on an existing mark takes neutral text, not a hue of its own.** The source debugger's
  return point (`MonacoEditor.module.scss` `.returnPointNote`, "← returned from f" after the
  execution-point statement) is the execution point with an explanation, not a second state, so it
  is `--text-secondary` italic beside the usual `--bgcolor-debug-active-bp` highlight. A "possible
  here" mark reuses its family's tokens at reduced strength: the inline statement-breakpoint marker
  is `--color-breakpoint-disabled` at 50% where a breakpoint can go and `--color-breakpoint-code`
  where one is set — the same pair the gutter uses, so a statement breakpoint reads as a breakpoint.
  The test is "is this a second state?": a runtime-error stop *is* one — the program failed on that
  statement — so its note (`.errorStopNote`, "✖ 3 Subscript wrong") takes `--status-error`, while a
  return point's does not.
- **A breakpoint's filter state changes the glyph's *shape*, never its colour.** A conditional
  breakpoint (a condition or a hit rule) draws the dot with an "=" knocked out (`bp-conditional.svg`,
  the VS Code convention); one whose condition cannot stop it now — a label the last build did not
  define, or a condition the emulator could not arm — draws a hollow ring (`bp-inactive.svg`). Both
  keep the colour the plain dot would have had (binary / code / unreachable / disabled), because hue
  in that column already says *which kind* of breakpoint and whether it can resolve; a fourth hue
  for "conditional" would have collided with the amber unresolved one. **One vocabulary in three
  places:** `BreakpointIndicator` (panel, disassembly gutter) uses the SVGs; the Monaco margin, which
  draws `clip-path` dots, uses the same two shapes as CSS `mask`s over the same background token
  (`.conditionalBreakpointMargin` / `.inactiveBreakpointMargin`) — a mask reads only alpha, so the
  colour stays a token; inline statement markers use the character equivalents `⊜` and `○` (and
  `①` for a one-shot). Every
  state is read through `breakpoint-filter-text.ts`, never re-derived at a call site.
- **The breakpoint's *action* is a second shape axis: a dot stops, a diamond logs.** A logpoint
  (`bp-logpoint.svg`, VS Code's convention) takes the same "=" and hollow variants as the dot
  (`bp-logpoint-conditional.svg`, `bp-logpoint-inactive.svg`), and a logpoint the *build* owns - a
  DeZog `LOGPOINT` source comment - is a hollow diamond with a centre dot
  (`bp-logpoint-comment.svg`). Still shape only, never hue. `breakpointGlyphOf` is the one reader;
  `BreakpointIndicator` takes its result as `glyph` and the Monaco margin maps it to a mask class
  (`.logpoint*BreakpointMargin`, in the execution-point cancel rule like the others). **Pass the
  breakpoint to every margin decoration builder** - the binary-address path once dropped it and drew
  a logpoint as a plain dot. **Where a user breakpoint and a comment's logpoint share a line, the
  user's glyph owns the margin** (Monaco would merge the comment's mask onto the user's dot); the
  comment then lives in the hover.
- **"Removed after it stops" is a third shape axis, and inactive still outranks it.** A one-shot
  draws the dot with a "1" knocked out (`bp-once.svg`); a one-shot with a condition or hit rule draws
  the "1" over a single bar (`bp-once-conditional.svg`) - one bar, not the full "=", because a "1"
  beside an "=" is three thin strokes that merge at 14px. The hollow ring still wins over both:
  whether a breakpoint can fire at all matters more than what happens after it does. Inline
  statement markers use `①`. The Breakpoints panel adds a quiet italic `once` (or `run-to`) tag in
  `--text-secondary` - a word for scanning the key column, never a hue.
- **A build-owned comment draws the mark of its kind, not a dot.** An `ASSERTION` comment is a
  shield with a "!" knocked out (`bp-assertion.svg`); a `WPMEM` comment reuses the memory-write
  glyph (`bp-mem-write`) as a margin mask. Both sit on the *comment's* line in the dot's colour
  tokens (disabled colour when switched off for the session) and join the execution-point cancel
  rule. All three comment marks - the `LOGPOINT` diamond included - are interactive (click toggles,
  right-click menu), so they set `cursor: pointer`; `BreakpointIndicator` still treats them as
  read-only (its gestures would build `bp-*` commands a comment's breakpoint does not accept).
- **A Watch row's watchpoint mark reserves its column.** The memory read/write glyph in
  `--color-breakpoint-binary` sits in a fixed `2ch` cell that is always rendered, so the symbol
  column does not shift as watchpoints come and go.
- **One group, one ink, in both places it appears.** A logpoint's `[GROUP]` is painted with the
  output pane's `bright-magenta` in the Log pane, and the Breakpoints panel's log-group switch rows
  take the same ink through `--color-logpoint` (an L4 alias of `--console-ansi-bright-magenta`), so a
  group reads as one thing. The line's trailing `@ $8012` is `bright-black`: where it fired is
  supporting context, not the message.
- **Monaco merges every glyph-margin decoration of a line into one element**, so a shape class and
  the execution point's class (`.active*Margin`, a background-image arrow) land on the same box. A
  `mask` or `clip-path` written for the dot therefore cuts the arrow too: the "=" mask once made the
  execution point vanish at a conditional breakpoint while the line stayed highlighted. **Any
  shaping property on a margin glyph class must be cancelled by a two-class rule for every
  execution-point class** (`.conditionalBreakpointMargin.activeBreakpointMargin { mask: none }`, ...).
  Specificity decides it; never rely on source order, because Monaco's class order is not yours.
- **A row's condition is its last cell, and its state is told by strength, then by hue.** In the
  Breakpoints panel the filters follow everything else on the row — the live count `9×` (secondary
  state accent, it is a supporting value), the rule `hit *4` and the condition `if A == $FF`
  (neutral secondary text) — so the condition is the cell that truncates in a narrow sidebar; the
  row tooltip carries it whole. An inactive condition is italic at 60% (it is a *pending* state, not
  a fault); a condition that failed to arm takes `--status-error`, because it really is wrong — it
  stops every time.
- **A dialog warning is `--status-warning` under the field, an error is the field's own error.** The
  breakpoint dialog's condition field shows a parse error through `TextInput`'s `error` (accessible
  description included) and an *accepted-with-a-note* message — an unknown label — as a
  `role="status"` line in `--status-warning` below it. Warnings show at once (they explain why a
  saved breakpoint may not stop); errors wait for the field to be touched, like every other field.
- **Source-level debug panels follow the converted state panels.** The Variables panel's values use
  `--color-state-value`, like a register, and a watch that fails to evaluate shows its message in
  `--status-error` in the value column rather than a hue on the row. The symbolic Call Stack's
  selected frame is `--surface-selected`, the explorer's selection, because selecting a frame is
  choosing what the Variables panel shows — a selection, not a debug state; its per-row action
  (Run to this frame) appears only on hover or on the selected row, so the frame names stay what
  the eye lands on. Tree indentation is `calc(var(--space-3) * depth)`, and the expander column is
  present on every row so names align whether or not a row expands. The same "selection, not a
  debug state" reading puts `--surface-selected` behind the selected outer frame's calling
  statement in the editor (`.selectedFrameStatement`), never the execution point's highlight. An
  in-place value editor borrows the data-panel filter input's tokens (`--bgcolor-input`,
  `--accent-border`) and turns its border `--status-error` while its text does not fit the type.
- **Certainty is carried by strength, not by hue.** The same branch gutter draws the same glyph in
  the same colour on every row, and dims it to 45% everywhere except the execution point. Away from
  PC the verdict was computed from *today's* flags rather than the ones that will hold when the CPU
  arrives, so it is a guess; at PC it is fact. Encoding that difference as a second colour was
  rejected — it would have doubled a five-glyph vocabulary into ten and put a third meaning on hue
  in a row that already uses hue for column role and for breakpoint type. Opacity is free of both.
- **A glyph drawn at 24×24 and rendered at 12px needs its distinguishing feature enlarged, not just
  scaled.** The first cut of the branch arrows put a small chevron head on a long shared curve; at
  12px "jumps back" and "jumps forward" were near-identical, because the part that differed was the
  smallest part of the mark. Lengthening the vertical travel and widening the heads fixed it.
  **Check a small icon at its real size against its own siblings**, not enlarged and not alone — a
  standalone 40px preview showed no problem at all.
- **Icons need a `@controls/Icon` mock in a jsdom test.** `Icon` resolves its colour through
  `useTheme`, so a row containing one throws without a provider. Mock it to render
  `<svg data-icon={iconName} data-fill={fill} />` rather than `() => null`: the test can then assert
  *which* glyph and *which token* the component asked for, which is the part worth pinning.

- **A glyph set that encodes one axis will eventually meet something off that axis.** The branch
  gutter began as five *directions* — up, down, left, dashed-right, straight — and `CALL`/`RST` were
  filed under direction because their target has one. That put `rst $08` in the same visual class as
  a loop closing, and had the readout calling it a jump. The fix was a sixth mark encoding a
  different property entirely (control returns here), and the ordering rule that goes with it: the
  **not-taken** test runs first, then the **kind** test, and only then direction. Where two glyph
  rules can both match, write down which wins and why — and have the wording and the glyph read the
  same predicate (`isCall`) rather than deciding separately, which is how they drifted apart.

- **A CSS container query is the cheap way to make a dense row adapt, and the threshold must be in
  `ch`.** The disassembly view's execution-point readout ships both a long prose form and a short
  notation form and lets `@container disassembly (min-width: 113ch)` on `.disassemblyWrapper` choose
  — no `ResizeObserver`, no measurement, no re-render on resize. Two things this pinned down, both
  measured in the running app under `scripts/doc-shots/`:
  - **The container must be the panel wrapper, never a row.** Rows are `min-width: max-content` and
    routinely wider than the panel, so a row measures its own content rather than the space
    available for it.
  - **`container-type: inline-size` does not disturb `virtua`.** Layout containment makes the
    element a containing block for absolute descendants, which looked like a risk; the virtualizer
    positions rows against its own inner element, and 24 rows measured at a uniform 21px with
    strictly increasing tops afterwards.
  - **`ch`, not px.** The panel font is a user setting across 10–16px *and* across fonts of 0.500em
    and 0.600em advance. A threshold derived at 12px Iosevka and expressed in `ch` still landed
    correctly at 14px JetBrains Mono; in px it would have been ~30% wrong.
- **A secondary line inside a data row usually wants *no* `font-size` at all.** The reflex is
  `0.85em`, which M1 forbids because it compounds; the `--font-size-*` ladder is the documented
  alternative, but it is fixed px and would stop the text scaling with the panel font size the user
  chose (10–16px). Inheriting the row's own size is the only option that tracks the setting, and the
  hierarchy against neighbouring text is better carried by colour anyway. **Run
  `test/theming/type-scale-contract.test.ts` under the `!perf` project, not `jsdom`** — it is a
  `.test.ts`, so a `jsdom` run silently does not include it and an `em` slips through.

- **A register that is a pointer shows what it points at as the secondary cell, not as a second
  value.** The Z88 Blink panel's SBF and PB0-PB3 rows (issue #1417) keep the raw 16-bit value in
  the state-value colour and put the decoded 24-bit address after it as `DataSecondary`, in the
  machine's own notation (OZvm's `(243800h)`) - the slot a byte register's decimal reading takes.
  It is a reading *of* the value, so it stays muted; colouring it too would make two payloads compete
  in a row that holds one. The decoding lives in `@common/z88/z88ScreenPointers`, shared with the
  snapshot viewer, never inline in a panel.

- **Split a composed readout into "outcome" and "evidence" and colour only the outcome.** The first
  build wrapped the whole sentence in the accent-status colour and produced a green paragraph in a
  row of otherwise neutral text. The verb and the value carry the hue; the supporting clause stays
  on the muted token.

- **Converting a panel to the accent silently disarms `--data-changed`.** That token and
  `--color-state-value` are *both* the accent's `solid`, so `.changed` repaints an accent value in
  the same accent: present in the DOM, absent on screen — the `AttachedShadow` failure again, from
  the other direction. Use `.changedWash` (`--data-changed-bg`, 18% of the same hue *behind* the
  glyphs) on any converted panel; `.changed` stays correct on a neutral one. `SysVarsPanel` marks
  both its scalars and its individual array bytes this way, and pins the class in a test, because
  "simplify this to `changed`" is precisely the tidy-up that would remove the only visible half.

## The Graphics Finder: Hardware Pixels Under Token Chrome

The graphics finder (`features/graphics/`, `.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5) draws
memory as ZX bitmaps. The pixels are the machine's: ink and paper are `SPECTRUM_48_COLORS` entries
the user picks (default `INK 0: PAPER 7`), never tokens. Everything drawn *over* them is chrome, on
one overlay canvas, from `--color-graphics-*` aliases read off the element: the selection takes the
primary accent, a named graphic the secondary (two things on one surface that must stay apart),
the band over bytes the listing decodes as code the warning hue (it marks a disagreement), the
hovered byte only the strong border, so hover never competes with the selection.

- **A region a tool wrote is marked by provenance, not by kind.** A row in a region detection or a
  SkoolKit import wrote (`origin`) gets a dotted rail in `--color-annotation-auto` (tertiary text):
  quieter than the authored rail, never a hue of its own, and the tooltip names the tool. A fourth
  annotation hue beside label, comment and operand would read as another data column.
- **A view whose scroll position *is* an address scrolls natively.** The finder is virtualised: a
  spacer as tall as the whole sheet, only the frame rows in view decoded. That needs the real
  `scrollTop`, so it is the one place a bare `overflow: auto` is right rather than `ScrollViewer`.
  It also needs **`overflow-anchor: none`**: the drawn window moves inside the spacer as it scrolls,
  and the browser's scroll anchoring "corrects" for that move.
- **State a re-layout reads in the same commit as a jump lives in a ref.** A Go to sets the frame
  alignment and scrolls; the panel's first measurement (no scrollbar yet, so one more column) and
  the next (with one) re-run the layout in the same commit. A `useState` value read there is the old
  one, and the jump landed a row off. Keep the jump's alignment in a ref, and do not let the
  view's *own* scroll events overwrite the remembered top byte.

## Colour That Belongs To The Machine, Not To The Theme

Two rules, both learned on the Next palette, both general.

**A Next palette entry exists in two packings and nothing can tell them apart by inspection.**

| Layout | Shape | Held by |
|---|---|---|
| **Register** | `RRRGGGBB` in bits 7..0, the low blue bit in bit 8, priority in bit 15 | `PaletteEditor`, `.nex`/`.pal` files, the sprite editor's *fallback* ramp — and **every function in `emu/machines/zxNext/palette.ts`** |
| **Device** | straight `RRRGGGBBB` | `PaletteDevice`, and therefore `getPalettedDeviceInfo`'s payload |

They are a **one-bit rotation** apart. Convert at the boundary with `paletteCodeFromDeviceValue`
and never anywhere else; do not add a function that "detects" the layout, because both cover
0..511. The reason this matters more than a normal unit mismatch is how it fails: the rotation
leaves greys and whites *unchanged* and moves saturated colours to another plausible colour, so a
palette drawn through the wrong one still looks like a palette. It shipped for as long as nobody
put it beside the emulator's own screen. `test/zxnext/palette-codec.test.ts` pins both directions,
and pins the 3-bit→8-bit intensity ramp across all three tables that encode it (`zxNextBgra`,
`zxNextRgb333Codes`, `colorIntensity`) — one of them had `0x25` where bit-replication gives `0x24`.

**A view that shows the machine's colours reads them from the machine, and labels it when it
cannot.** The sprite editor drew every sprite through an invented identity ramp — `palette[i] = i` —
while `getPalettedDeviceInfo()` had been serving the real sprite palette to the sidebar all along.
That is not a placeholder, it is a claim about what the artist is painting, and it was false in a way
no screenshot catches: the ramp never sets bit 8 of the register layout, which is the low blue bit,
so it cannot express four of the Next's eight blue levels and contains **no pure white and no pure
blue at all**. On the real machine `$FF` is `#ffffff`; through the ramp it drew `#ffffdb`. Two rules
follow. Read the device, converting once at the boundary. And when there is no machine — a `.spr` is
perfectly editable with the emulator stopped — fall back, but **say so where the colours are**, in
`--status-warning`: a silently-wrong palette still looks like a palette, which is exactly how the
rotation bug above survived.

**A picture of the machine that a file carries is shown as stored.** The `.z88` viewer's LCD capture
(`snapshot.png`) is a device surface frozen in a file: its pixels are the machine's, so it gets no
theme treatment, no tint and no smoothing — `image-rendering: pixelated`, `max-width: 100%` and
nothing else, so it shrinks to its pane but never blurs. The same holds for any thumbnail a snapshot
format embeds.

**The same holds for the frame around a machine's picture.** The Z88's LCD surround is unlit
green, and grey while the LCD is off. The core reports it (`z88GetLcdSurroundColor`, following
what it last painted rather than COM.LCDON, so frame and picture never disagree) through
`getScreenSurroundColor()`, in the pixel buffer's ABGR packing. It is not a token. It is the
machine's colour, the same in both themes, and changes with the machine's state.

**A user who has learned one control should not have to learn it twice.** The sprite editor's bank
switch is the sidebar's, deliberately — same two segments, same meaning (*the fill is the bank you
are looking at, the ring is the bank the machine is drawing with*), same default of following the
hardware until the user pins it. Reuse the vocabulary before inventing a second one; a control that
means something slightly different in two places is worse than either version of it.

**A ghost layer over artwork goes *above* the art and is masked to its holes, not underneath it.**
The sprite editor's onion skin was first drawn beneath the pixel layer, which renders nothing at
all: a transparent pixel is painted with an opaque crosshatch, so anything below it is hidden by the
very pixels it is supposed to show through. Drawn above but restricted to the cells the current
sprite leaves transparent, it does what is wanted - the neighbouring frame shows through the holes,
and never over the work in progress. **And it carries opacity only, no tint.** Device artwork is
theme-invariant, and a hue laid over pixel art is read as part of the pixel art rather than as
chrome, which is why the red/blue onion tinting other editors use was rejected here.

**A state mark that is always present is not a signal.** The palette panel's bank control first
marked the live bank with a corner dot. Because the shown bank follows the live bank by default, that
dot was on every device, all the time, and carried information only in the rare pinned state — while
costing legibility always: on the *filled* segment it had to be drawn in `--text-on-accent` to show
up at all, which is `#0e0f11` in dark, so the ordinary state rendered as a near-black speck on a blue
chip and read as a rendering artefact. The author flagged it as one. Mark the **exception** instead:
the ring that now carries it is the same accent as the fill it normally sits under, i.e. invisible
until the two states diverge. Before adding a second indicator to a control, check which of its
states is the common one — if the mark is on screen in the default case, it is decoration.

**A reference image is sized from its content, not from its container — and on whole pixels.** The
palette grid was first built with `repeat(16, 1fr)`, which is the right instinct for a *layout* and
the wrong one for a *picture of data*. Two things went wrong at once, and they have the same fix.
Dragging the sidebar swung the swatches from 13.9px to 30.2px — a 2.2x change from resizing chrome,
on something the reader is trying to hold in their head between glances. And every one of those
widths was fractional, so cell edges and the hairlines between them landed off the pixel grid and the
whole mosaic was faintly soft at *every* size; nobody reports that as a bug, they just find the view
slightly unconvincing. Size such a view from its unit (`--palette-cell`) and let the container's
extra width go unused. The shape that keeps it shrinkable is `width: calc(<gutter> + 16 *
var(--cell)); max-width: 100%` with `1fr` tracks — a definite width so the tracks divide an exact
multiple and land on integers, and a percentage cap so a genuinely narrower container degrades by
shrinking instead of clipping. Fixed tracks (`repeat(16, var(--cell))`) would overflow, which is the
clipping this replaced.

**A preview must be a miniature of the thing, not a re-encoding of it.** The same panel first
previewed each palette as a 2x128 gradient strip. At ~1.7px per entry it could not show an
individual colour, and on the ULA — whose palette repeats every 16 — the stripes it *did* show were
the repeat period rather than anything about the colours, so it read as texture. A 32px thumbnail of
the actual 16x16 grid, at an integer 2px per entry, says "palette" instantly and shows the ramp
palettes' real two-dimensional structure. When a summary needs its own encoding to fit, that is the
signal it is too small, not that it needs a cleverer encoding.

**Anything drawn *on top of* user colour takes its contrast from that colour, never from a token.**
A swatch is arbitrary machine colour, not a themed surface, so there is no tone-dependent value that
stays legible across a palette: one fixed alpha disappears over half of any of them and a theme
neutral over more. `NextPaletteViewer` computes white-or-black from the entry's own luminance
(`getLuminanceForPaletteCode(...) < 3.5`) for its selection ring, transparency disc and priority
notch, and sets `--palette-rule` per element the same way for the quadrant hairlines. This is the
same principle as the settled "device surfaces are theme-invariant" decision, one level down. Such a
property has to be registered in `RUNTIME_PROVIDED` in `test/theming/token-contract.test.ts`, with
the justification written there — that list is a hole in the contract and each entry pays for itself
in prose.

**A device keyboard may have a light key face, and its highlight then needs the accent's dark end.**
The ZX81's keys are light grey (`--device-key-zx81`) with black, red and white print, where every
earlier keyboard was dark keys with light legends. The 48K's single `--color-key48-highlight`
(`--accent-solid`) cannot serve both grounds: in the dark tone it is the accent's *light* value,
which vanishes on a white key, and device surfaces do not change with the tone (§8.2.1), so following
the tone is wrong anyway. Each accent already carries its two ends as its two tone values, so the
semantic layer exposes them tone-invariantly: `--accent-on-device-light` (the light tone's value,
dark enough for a light key face), `--accent-on-device-dark` (the dark tone's value, light enough for
a black case) and `--accent-device-pressed` (an opaque light tint of the accent mixed over the key
face, `mix()` in `semantic.ts`). On the ZX81, a hovered legend on the key takes the first, the
keyword and function print on the black case the second, and a pressed key the third. Reach for
these for any highlight on a device surface; never `--accent-solid`, whose value depends on a tone
the device does not have.

## Alignment In The Register Panels

Three traps found the hard way while aligning the Z80 CPU panel. All three produce offsets small
enough to look like "it just feels off" and large enough to be visible.

- **A `DataRow` can contain another `DataRow`.** `Bit16Value`/`Bit8Value`/`SimpleValue`/`FlagValue`
  each render their *own* `DataRow` for their label/value pair, and a panel row puts two of those
  side by side — a register row is literally a row inside a row. Putting horizontal padding on
  `.dense` therefore indented register rows **twice** (16px) and the flag strip, which is built from
  bare divs, **once** (8px): measured live as `.flagLetter` at x=56 against the `AF` label at x=64.
  `.dataRow .dataRow { padding-left: 0; padding-right: 0 }` makes the outermost row own the gutter.
  Prefer that over moving the gutter to the panel, which would stop row backgrounds being
  full-bleed and so break the zebra/hover treatments.
- **A glyph's left side bearing scales with its font size, so a larger label does not optically
  left-align with a normal one even when the boxes share an x.** The flag strip's `F` is `1.6em`:
  in the bundled Iosevka it carries 1.843px of bearing at 19.2px against `A`'s 0.528px at 12px, so
  its stem printed 1.315px right of the label column. Corrected with `margin-left: -0.0685em` on the
  glyph — expressed in the glyph's own em so it tracks the type scale. Keep the scaling on an inner
  span, never on the width-bearing box: `ch` resolves against the element's own font size, so a
  `1.6em` box measuring `3ch` is 28.8px while its `1em` neighbours' `3ch` is 18px.
- **A conditionally rendered cell moves every column after it.** `NextRegPanel` renders its
  `previous value -->` cell only when the register has a `lastWrite`, so the value column sits 10ch
  further right on those rows than on the others — a ragged column in a 128-row virtualized list.
  Left as-is for now (see the note in that panel's review): reserving the column always would put an
  8ch hole in the majority of rows, which fights the Density decision above. Worth knowing as a
  shape: in a tabular list, a cell that can vanish needs a placeholder or the grid is not a grid.
- **`controls/layout`'s `Label` is not on the same origin as `controls/data`'s.** It adds
  `.legacySpacing` — `margin-inline: var(--measure-gap)` on *both* sides — so a row using it starts
  0.8ch right of a row using `DataLabel`/`SimpleValue`. The ULA panel had both shapes and therefore
  two label origins (`KL0` against `FCL`). Override it from the caller's own stylesheet with a
  type+class selector (`span.klLabel { margin-inline: 0 }`), which beats the single-class
  `.legacySpacing` whatever the load order. It also takes its `width` as an **inline style**, so a
  width in your override class is ignored unless you drop the `width` prop. `NextRegPanel` had the
  same margin *plus* a leading `LabelSeparator`, which started its content ~21.6px into the row
  while the two panels stacked above it started at 8px — worth checking the left edge of adjacent
  sidebar panels against each other, not just rows within one panel.
- **A fixed-px icon in a `ch`-sized cell does not align with text in that cell.** A 16px flag dot at
  the value cell's `flex-start` centres ~8px in, while a digit's ink centres half a character in, so
  every dot read as shifted right of the numbers above it. Wrap the icon in a `width: 1ch;
  justify-content: center` box (`.flagDot`) — it then centres on the first character cell whatever
  the font does, and the icon simply overflows that box symmetrically, which is invisible for a
  round glyph. Same idea aligns the flag strip to the value column: `.flagLetter` is
  `calc(var(--measure-label) - 1ch)`, because a `3ch` flag column centres its content 1.5ch in while
  a value cell's first character centres 0.5ch in.

## CSS Grid: What Sizes A Track

Two layout bugs in the sprite editor's rebuild had the same cause and neither looked like itself.
**An item that spans an intrinsically-sized track (`auto`, `min-content`, `max-content`) pushes its
own content size into that track**, and the damage shows up somewhere else entirely.

- **A 34px tool rail rendered 358px wide.** The sheet toolbar had no `grid-area` at all — it
  rendered a bare `Row` — so it was auto-placed into row 1, column 1, and its row of buttons became
  the intrinsic width of the rail's `auto` column. Nothing about the toolbar looked wrong; the
  *rail* looked wrong. **Every child of a grid must claim its area**; audit with
  `[...grid.children].filter(c => getComputedStyle(c).gridArea === "auto")`.
- **A canvas collapsed to its 3px minimum in a short pane.** The inspector — a 272px palette plus a
  preview — spanned the sheet's `auto` row, forcing it open and starving the `1fr` stage row. Bound
  any track a tall item spans (`minmax(0, 132px)`), or do not span it.
- **`minmax(0, 132px)` is a *definite* max, and definite maxima are satisfied before `fr` gets
  anything.** So the sheet took its full 132px while the stage row starved. If one region must win
  when space is scarce, give *that* region the floor — `minmax(140px, 1fr)` — rather than trusting
  `1fr` to mean "the important one".
- **A fitted canvas needs integer cell sizes.** Same lesson `NextPaletteViewer` learned with `1fr`
  columns: fractional cells put every edge and hairline off the device pixel grid and the mosaic
  goes faintly soft at *every* size. Floor the division, clamp it, and re-measure on resize.
- **A list laid out as a grid through `display: contents` rows must render every cell of every row.**
  Auto-placement fills cells in order, so a row that omits an optional cell (a note) pulls the next
  row's first cell up into its place and every row after it shifts by one; the Layers document's
  priority stack wrapped its notes into a one-word-wide column that way. Render the empty cell
  (`{note ?? ""}`), never `{note && …}`.

## An Indicator's State Is Told, Never Inferred From A Prop's Type

`BreakpointIndicator` chose its dot colour from the **type** of its `address` prop: a number meant
"armed" and took `--color-breakpoint-binary`, anything else fell through to the amber
`--color-debug-unreachable-bp` that means "this cannot fire yet". That was only ever right by
coincidence. Every breakpoint shape added since passes a *string* — a bank-relative site
(`05:+$0100`), a NextReg register (`NR:$07`) — and each one was painted as an unresolved source
breakpoint while being perfectly able to fire. Nobody noticed, because a wrong colour still looks
like a colour.

The fix is a boolean prop the caller sets, not a cleverer inference. **A component that renders
state must be handed that state**; deriving it from the shape or type of some other prop makes every
future shape a silent bug, and the derivation is invisible at the call site where the mistake is
made.

## A Mode Badge In A Strip Colours Its Tag, Not The Strip

A session that changes what the machine is doing (the RZX PLAY / REC / VIDEO badge in the emulator
status bar, `EmuStatusBar.tsx`) is a small outlined **tag** in a status token - `--status-success`
playing, `--status-error` recording, `--status-info` rendering, `--status-warning` for "stopped,
not saved" - followed by an ordinary monospace status-bar label for its counter. The bar stays
`--surface-chrome`; only the tag carries the mode's colour, so the strip never turns into a coloured
band and the counter stays as readable as every other readout in it. The tag's colour is chosen by
the mode the store reports, never by which number happens to be shown.

## A Dialog Field Is As Wide As Its Widest Legal Value

A `TextInput` fills its row unless told otherwise, and in a dialog that is almost never right. A
full-width box **promises room the value can never use** — the widest literal the breakpoint
dialog's address parser accepts is `%1000000000000000`, seventeen characters, in a field that ran
the whole width of the modal.

Size each field from the longest thing it can legally hold, in `ch` (mandate M2, and the mono stack
has changed advance width before — Menlo's 0.6em to Iosevka's 0.5em — silently mistuning every
pixel width tuned to the old one). Two constants are usually enough: one for 16-bit fields, one for
byte fields.

The second gain is free and matters more than the first: **unequal widths tell the fields apart.**
A register, a port mask and an address are different quantities, and boxes of identical width say
they are the same kind of thing.

**A `Dropdown` follows the same rule, computed from its options.** Its widest legal value is its
longest label, and when the options come from data, a literal width goes stale with them: the Create
Disk dialog's fixed 200px fitted the +3's CPC labels and clipped the Pentagon's TR-DOS ones. Size it
as `` `${longest label length + 4}ch` `` (the 4ch hold the chevron); the open list takes the trigger's
width (`--radix-select-trigger-width`), so one value sizes both.

## A Hint Under A Field Needs Its Own Top Margin

`TextInput` carries no bottom margin — `DialogRow` owns the gap between a label and its field, and
the control's own block margins were removed so the two would stop fighting. The consequence is
easy to miss when adding a field: **anything placed directly beneath a field sits on it**, and an
explanatory line that touches the box it explains reads as part of the control rather than as a note
about it.

## A `min-width` Is A Column, Not A Gap

`.bpLabel` used one `min-width: 9ch` to do two jobs — line the keys up into a column, *and* keep the
next cell off them — with a comment claiming the extra character "guarantees separation in the worst
case". It guarantees nothing of the sort: a minimum width only separates anything while the content
is **narrower** than it. The moment a key outgrew the box it abutted the next cell with no space at
all, which is what `NR:$4C=$0B` (ten characters) did to a register's name, and what a bank-relative
`0A:+$0100` (nine) was one character away from doing.

Two jobs, two properties: `min-width` aligns the common cases, a `margin-inline-end` keeps the
columns apart whatever the content turns out to be. The general form of the mistake is worth
recognising — **a property chosen for one effect that happens to produce a second one is a
coincidence with a deadline**, and the deadline is the first piece of content that does not fit the
author's idea of the worst case.

## A New Row Type Reuses The Panel's Accent Split

Adding a row to a data panel is not an occasion for a new hue. Each of these panels already divides
its colour two ways, and a new row states which half each of its cells belongs to:

- the **headline** — the thing the row is *about*, and the thing a user scans the column for — takes
  the primary `--color-state-value`;
- a **supporting value** beside it takes the secondary `--color-state-value-alt`.

The Breakpoints panel had two of these pairs before and now has three, all following the same split:
a resolved address beside a source breakpoint's key, an op address beside a watchpoint's, and a
NextReg breakpoint's `$00 → $03` beside its register. Context that is neither — a disassembled
instruction, a register's documented name — stays on `Value`/`Secondary`'s neutral `--data-value`.
Three pairs reading the same way is the point; a fourth hue would have made the panel a legend.

## Two Pointers Into One List Get Two Markers, Never One

A view of a list that something executes — the Copper List, the Copper panel's window — can have two
"current" rows at once: where the executor **is now** and where a breakpoint **hit**. They differ
whenever the executor outruns the stop (the Copper runs on to the end of the Z80 instruction), and
showing one marker for both makes the user read the PC as the breakpoint. So each gets its own glyph
in a fixed `2ch` marker column (`▶` now, `●` hit) **and** its own row tint: `--bgcolor-copper-pc`
(the accent's subtle fill, as the debugger's active line) and `--bgcolor-copper-hit` (the warning's
subtle fill, the same family as `--color-breakpoint-current`). The hit's beam position is printed on
its row, because the row the user is looking at is the only place it is true.

A view-specific token family (`--bgcolor-copper-*`, `--color-copper-*`) aliases L2 roles at L4, like
the memory and disassembly families: the ruler's three raster zones are the accent's subtle fill
(paper, where the effect is seen) and two neutral surfaces (the borders), and a WAIT that can never
match is a muted tick rather than a red one — it is a fact about the timing mode, not an error.
A palette MOVE's colour swatch is the machine's colour, drawn inline from the decoded value, and is
the one literal colour in these views (see "Colour That Belongs To The Machine").

**A data strip narrower than ~6ch reads as a scrollbar.** The raster ruler at `4ch` (minus padding)
sat beside the list's scrollbar and looked like a second one; its zones were invisible. At `8ch` the
bands read as bands. Size a vertical overview strip so its content, not its edge, is what you see.

## An Event In An Instruction Listing Is A Band, Not A Row Kind Of Its Own

A listing of what the CPU did - the Execution History - interleaves instructions with events that ran
no opcode: an interrupt acknowledge, an NMI, the DMA holding the bus. They are drawn as **separator
rows**: the whole row is one secondary-text sentence ("— IM 2 interrupt, vector $FF —") on a subtle
neutral band (`--bgcolor-history-separator` / `--color-history-separator`), with no address, bytes or
changes columns. A run of instructions then reads unbroken, and the event still stands out; colouring
them with an accent or a status hue would make an ordinary interrupt look like an error. A HALT that
repeated is an instruction row with a count (`HALT ×1,203`), not a separator: the CPU did execute it.

Two things in the same listing are **not** rows: a frame boundary is a hairline on the frame's first
record (`--color-history-frame-line`, a top border that is transparent on every other row so heights
never change), because a row there would shift the step numbers G4.3 steps through. And the newest
record - where the machine is now - takes the execution point's fill (`--bgcolor-history-newest`, the
accent's subtle fill, as the Copper's PC row). The recording indicator in the header is the one status
hue (`--color-history-recording`, `--status-error`: the conventional "recording" red); it is text, so
"○ Not recording" is told by the words, not the colour alone. Values (addresses, register changes)
take `--color-state-value`, the register/state panels' rule.

A **folded interrupt service** is the same separator band, not a new row kind: the INT or NMI row
reads "▸ NMI service, 5 instructions, 32 T" and stands for the whole service. A merged ZX80/81
display line ("Display NOPs ×32") is *not* a separator: like `HALT ×n`, the CPU did execute those
NOPs, so it is an instruction row with a count. The open/fold glyph (`▸`/`▾`) is the only
interactive part of a separator: neutral `--data-label`, `--color-history-separator` on hover, a
fixed `2ch` box so folded and opened rows keep their text aligned - no button chrome, no accent,
because folding is a view choice, not an event. Folding never renumbers: a folded row keeps its INT
record's step number and the next row jumps past the service, so "−120" names the same instruction
folded or not (G4.3 steps through those numbers).

**A `VirtualizedList` beside a side pane goes in a flex row, not a `SplitPanel`.** The first
Execution History put its list in a `SplitPanel` pane: the virtualizer laid out its full 2.7M px
content, yet OverlayScrollbars marked the viewport `overflowYHidden`, its `scrollHeight` equalled its
`clientHeight`, and neither the wheel nor `scrollToIndex` moved it - so "follow newest" showed the
*oldest* rows. Laid out as the Copper List lays out its table and ruler (`.body` a flex row with
`min-width: 0`, the list `flex: 1 1 0; min-width: 0; overflow: hidden`, the side pane a fixed `ch`
width), the same list scrolls. Probe it in the running app: the viewport's
`data-overlayscrollbars-viewport` attribute says `overflowYScroll` when it works.

## Changed Since The Previous Stop Is A Dot, Defined Once

"These bytes moved since the machine last stopped" has one treatment, so any state panel can adopt it
without inventing its own: a small dot in `--color-state-changed` (an L4 alias of the data
hierarchy's `--data-changed`) after the row's index, drawn as an `::after` on the index cell. It is a
**marker, never a row fill** — the row's values keep `--color-state-value` and the selection keeps
its wash, so a changed, selected row still reads as both. The baseline is the attribute snapshot at
the *previous* stop while paused, and the last stop while running; the Sprite Inspector is its first
user (`useNextSpriteState`). On an image rather than a table (the Tilemap Inspector's map) the same
dot goes in the changed cell's top-right corner, drawn on the overlay canvas — still a marker, never a
tint over the machine's pixels.

## A Breakpoint On A Table Row Is The Gutter Dot, Before The Index

A table that is not a code listing still marks a row with a breakpoint the way the Copper List's
gutter does: the `circle-filled` icon in `--color-breakpoint-binary` (`--color-breakpoint-disabled`
when disabled), placed **before** the row's index in the index cell. The Sprite Inspector's `sp:`
rows are the first case. The "changed since the previous stop" dot stays **after** the index, as an
`::after` in `--color-state-changed`, so a row can carry both and they never compete for one spot or
one hue. Do not add a gutter column to a table that has none: the index cell already is the row's
identity, and the menu on the row is where the breakpoint is set.

A new event-breakpoint type gets its own `bp-*` icon in the family's shape: the downward write arrow
over a small glyph of the thing written (`bp-nextreg` sliders, `bp-sprite` a sprite cell), painted
with `--color-breakpoint-type` like every other type icon.

A dialog choice among a handful of independent bits (the sprite kind's five attribute bytes) is a
column of checkboxes, each labelled with its bit and what it holds (`2: palette, mirror, rotate,
X8`), with `--space-1` between them; one error line under the group when none is ticked.

## A Wide Table Scrolls As One Piece, Pinned Columns Fixed

A table wider than its pane puts its header **and** its rows in one scroller: the header row is
`position: sticky; top: 0`, so it moves sideways with its columns. A header kept outside the scroller
stays put while the columns move under it — the Sprite Inspector's first version did that.

Columns pinned to the left (`position: sticky; left: …`) each get a **fixed** width — `width`,
`min-width` and `max-width` equal, `box-sizing: border-box` so padding is inside — and each left offset
is the sum of the widths before it. A pinned cell that can shrink lets the next pinned cell slide over
it, which reads as a column getting narrower as the table scrolls. Pin only what identifies a row, and
keep it narrow: the Sprite Inspector pins `#`, `vis` and the pattern thumbnail with its number, and
moves the 4-bit half (`4·hi`) to the scrolling `fmt` column. The pinned header cells take a higher
`z-index` than the pinned body cells, which take a higher one than the rest.

Every cell keeps the monospace stack at one size, header included: the widths are in `ch`, and `ch`
resolves against each element's own font, so a header in the UI font sits several characters off its
column. Let colour (`--data-label`) set the header apart.

## A Document Lays Itself Out By Its Own Width

A document that holds several panes measures **its own** width (a `ResizeObserver` and a hidden `0`
in the panel font to turn pixels into `ch`), never the window's: docked in a narrow split it must
behave like a narrow window. The Sprite Inspector has three layouts, with breakpoints in `ch`, and
the Tilemap Inspector copies them (Map/Tiles for Sprites/Patterns):
narrow (the list as tabs, the inspector a band under it), medium (tabs, the inspector a rail beside
it), wide (two lists side by side and the rail). Rules it settled:

- **A toolbar and a status strip are one line at every width.** Low-priority controls fold into a
  `⋯` menu as the width drops; the strip shows its flags and primary items and puts the rest behind
  "+n more". Two wrapped strips cost the list four rows.
- **A pane has no toolbar of its own** when the document has one: its controls join the document
  toolbar as a context group for the active view.
- **Do not offer a mode that does not fit.** *Both* exists only in the wide layout; elsewhere a tab
  decides, and the chosen mode is kept for when it fits again. Never decide it from the width at the
  moment a request arrives — the document may not have measured itself yet.
- **An inspector band shows details and its map side by side**, details as previews beside fields
  (two pairs to a line, a long value on its own line), so nothing scrolls. An SVG map in a band fills
  its box and letterboxes (`xMidYMid meet`); sized from its width it is taller than the band. Map a
  click through `getScreenCTM().inverse()`, not the element's box.
- **Two columns, not three, for "own vs effective"**: the effective value, then the slot's own reading
  after it in `--color-state-value-alt` only where it differs. A third column's header wraps first.

## A `SplitPanel` Needs No Positioned Ancestor Inside The Document

`SplitPanel` places its splitter from offsets measured against the page. A `position: relative` on an
element between the document and the `SplitPanel` makes the splitter draw shifted by that element's
offset — by the sidebar's width — as a stray line through the content, while the drag still works at
the real seam. Leave the containers of a `SplitPanel` unpositioned.

## A Next Inspector's Vocabulary

The Sprite Inspector (`--color-sprite-*`, `--bgcolor-sprite-*`) aliases L2 roles like the Copper
family: values in `--color-state-value`, a relative's anchor badge and the lit `R X Y` glyphs in the
secondary `--color-state-value-alt` (they are the row's *second kind* of value), effective visibility
a `--status-success` dot or a `--status-warning` ring (set but hidden by its anchor), diagnostic
chips in the warning hue with an info-level one neutral. Its sprite-space map draws the paper in the
accent's subtle fill, sprites as state-value outlines, the selection filled with the accent, and the
clip window dashed in the warning hue. Pattern pixels are the machine's colours (see "Colour That
Belongs To The Machine"); the sheet's badges, the mixed-format corner and the upload bar are the
only chrome drawn on them.

The Tilemap Inspector (`--color-tilemap-*`) keeps that vocabulary and adds one rule: **two different
windows get two hues**. The clip window (what cuts pixels off, shown in *As displayed*) is the
warning hue, as on the sprite map; the visible window on the *unscrolled* map (where the screen's
view lands after the scroll, possibly wrapped into four pieces) is a dashed `--accent-secondary-solid`
outline, because it is a different question. The selected cell is the primary accent, 2px; a
selected tile's users the same hue at 1px. Its diagnostics reuse the sprite chip aliases rather than
minting a second set.

Chrome over a machine-coloured image is drawn on **one overlay canvas** (`OverlayCanvas`) from a
list of shapes, never an element per cell: an 80×32 map is 2560 cells, and DOM badges cost more
than the image. The canvas reads its colours with `getComputedStyle` from the `--color-tilemap-*`
tokens, so the theme still decides. Text on a small tile (a usage count) is a **corner badge** at
about two-thirds of the cell height; centred at full size it hides the tile it describes. The image
itself is one `ImageData` in an `IndexedImageCanvas`, scaled by CSS with `image-rendering:
pixelated`, the checker as a CSS background behind transparent pixels. An image pane scrolls through a `ScrollViewer` like every
other scroll area (the rule under "Method Lessons"): a `display: flex` box with `min-width`/
`min-height: 0` around the `ScrollViewer`, and the image in an `inline-block` wrapper so the content is
as wide as the image and the viewer scrolls both ways. The first version used bare `overflow: auto`
and showed native bars; `recipes/tilemap-inspector.cjs` now fails if any element in the document
scrolls outside an OverlayScrollbars viewport.

The Layer 2 Inspector (`--color-layer2-*`) keeps both windows' hues and adds the rest of a
layer's plumbing, **one hue per question**: the `$123B` write window (where writes land) in
`--status-success`, bank boundaries as `--border-strong` 1px outlines with a number chip, and banks past
2 MB **hatched** in the warning hue - absent pixels must never look like transparent ones, which keep
the checker. The Banks strip tags a bank's roles in the overlay's hues (displayed in the accent text,
shadow in the secondary, write window in the success hue), so a chip and the outline it explains
match. A selected *pixel* is framed by a box one pixel wider each way, not stroked over itself: a
one-pixel rectangle at zoom 2 is a dot the stroke covers. A view option that changes how the machine's
colours read (priority highlighting) **dims the others** through `IndexedImageCanvas`'s `dim` mask
rather than tinting the pixels it is about, so the highlighted pixels keep their real colour. A pixel
layer half as wide as tall (640×256) doubles its **height** (`zoomY`), never halves its width: halving
drops every other column at zoom 1.

The Next **layer views** (`--color-layers-*`: the Layers strip under the emulator screen, the clip
outlines and probe over it, the `$layers` document) give each of the four video layers an
**identity hue**: ULA `--status-info`, tilemap `--status-success`, Layer 2 `--status-warning`, sprites
`--status-error`. It is the one place the status hues name things rather than states, which is
tolerable only because the colour is never alone: always a dot or frame **beside the layer's name**
(the strip's chip, the document's card and picture frame) or a dashed outline whose `<title>` names
it. Four layers need four well-separated hues that hold in both tones and under all six accents; the
accents cannot supply four, and the status hues can. Three further rules:

- **A state the user must not forget is announced on the screen and cannot be dismissed.** A hidden
  or soloed layer gets a pill in the overlay stack (`LayerDebugOverlay`), in the warning hue, which a
  click does not hide - unlike the execution pill. A forgotten toggle must never look like a bug in
  the user's program.
- **A strip that can close itself restores the picture first.** The Layers strip's close button
  (`closeLayerView`) shows every layer and turns its overlays off before hiding: a strip gone while a
  layer stayed hidden would leave only the pill to undo it. It sits last, apart from the controls.
- **Two kinds of "off" get two marks.** A layer the *debug view* hides dims its chip and crosses its
  eye; a layer the *program* has switched off strikes its name through. The strip is a device
  surface (`--bgcolor-display`), like the Spectrum media strip.
- **Chrome over the emulator screen is an SVG in the picture's own pixels**: `viewBox` = the machine's
  buffer size, `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`, so it follows every
  zoom and stays one screen pixel wide. There is **one** such layer, `EmulatorScreenOverlay`: the clip
  outlines, the probe and the beam overlay are all shapes handed to it, never a second overlay
  component. **Text never goes in that SVG** - with `preserveAspectRatio="none"` the Next's half-width
  pixels squash it - so labels are HTML placed by percentage at their buffer position, on the overlay
  pill's surface so they read over any machine colour. A **fill pattern** in it is stretched the same
  way: divide its width by the machine's pixel aspect (`getAspectRatio()[0]`) to keep it square on
  screen. The solo checkerboard is *not* chrome: the core paints it into
  the picture (two greys, 16×8 buffer pixels, square on screen), because it stands in for transparent
  machine pixels. The document's per-layer pictures use the shared CSS checker behind alpha 0.
- **A small picture of the Next screen keeps the screen's shape.** Its buffer pixels are half as wide
  as they are tall (0.5:1), so a reduced copy drops every other *column* and keeps every row
  (360×288, shown with `aspect-ratio: 360 / 288`). Dropping both halved the height and squashed the
  Layers document's pictures to 2.5:1. Same rule as the Layer 2 Inspector's 640×256: never scale the
  two axes of a non-square pixel by the same factor.

## The Past Is Outlined In The Secondary Accent; The Present Stays Solid

Lite step back (`.plans/LITE_STEP_BACK_PLAN.md` D7) shows registers from the past while memory stays at
the present, so two rules carry the whole visual vocabulary:

- **Where the view shows the past, it says where - in the secondary accent, as an outline or a band,
  never a fill or a panel tint.** The present's execution point is a *solid* primary-accent fill
  (editor line, disassembly row); the historical one is an *outline* in `--color-history-marker`
  (dashed in the editor, solid in the disassembly, dashed there too when the bytes have changed since
  - "what is listed is not what ran"), with a hollow arrow glyph in the gutter. Two pointers into one
  timeline, two hues - the same reasoning as two pointers into one list. A tint over a whole panel was
  rejected: it reads as *disabled*, and under full reverse debugging (G4.4) it would have to cover the
  whole IDE.
- **Where the view shows the present while the cursor is in the past, it says that** - a thin band
  (`HistoryPresentBanner`, italic `--text-tertiary` on `--bgcolor-history-band` with a 2px rail) at
  the top of every memory- or device-reading view. It keys off `historyMemoryIsHistorical`, not off
  "a cursor is set", so it disappears by itself when memory becomes historical.
- Four L4 aliases, all of the secondary accent: `--color-history-marker`, `--color-history-text`,
  `--bgcolor-history-band`, `--border-history-band`. The CPU panel's band, the status-bar chip, the
  Execution History document's cursor row (a 3px rail plus an outline, so it reads apart from the
  selection) and the toolbar's absence of any colour change all come from them.
- **Under full reverse debugging the machine itself is in the past**, so the "present" bands go by
  themselves (`historyMemoryIsHistorical`) and nothing else changes colour: the outline markers stay
  the only in-view signal. The status bar carries the rest in **one chip whose text is the state** -
  `⟲ −1.24 s · step −3,412` in the past, `▶ Replaying · 800 ms to present`, `⟲ Searching back… 3
  intervals` - all on the history tokens, a click doing the one obvious thing (back to the present,
  cancel the search; nothing while replaying, which drops the pointer and the hover). The words
  live in `@common/history/reverseDebugText.ts`, not in the component, so status bar, tooltip and
  docs cannot drift. The reverse range and "input ignored" go in the tooltip (the latter also
  suffixes the label), never in a second chip.
- **An action beside a state chip is outlined in the same hue, never filled** (`.historyAction`:
  "Take over here"): fill is what says *state*, so a filled button next to a filled chip reads as a
  second state. It gains the band's fill only on hover.
- **A timeline that stopped early uses the status bar's error label** (`--bgcolor-errorLabel`), not a
  history token: it is a failure, not a place in time. Its tooltip carries the reason; it clears at
  the next Stop or debug session.
- **A changed value on an accent-coloured panel takes the wash, not the colour** (`changedWash` via
  `Bit16Value`/`Bit8Value`'s `changed`): `.changed` repaints an accent value in the same accent and
  shows nothing. In history the CPU panel marks what the *previous step* changed, the present value
  goes in the tooltip, and what a record does not hold (T-states, last accesses) shows as `--`,
  never as the present's number.

## A Picture That Is Partly Last Frame's Says So

A paused emulator screen holds two frames: this one up to the beam, the previous one after it. That
second part must be **marked, never hidden** - it is still the machine's pixels, and hiding it would
lose the evidence of a mid-frame effect. The beam position overlay (`--color-beam-*`) washes it with
the backdrop's alpha (`--bgcolor-beam-stale` = `--bgcolor-backdrop`) under a `--border-strong` hatch,
and puts a `previous frame` legend at its first pixel: an unexplained hatch reads as an emulator bug.
The beam itself is the primary accent (a dashed line across its row, a solid tick at its pixel, a
thicker edge mark in blanking), and the Copper's breakpoint hit the secondary accent - two pointers
into one raster, two hues, as with two pointers into one list. Over Instant Screen there is no stale
part, so there is no hatch: the pill says *instant screen* instead. The overlay's pill joins the
overlay stack; it does not float near the beam, where it would cover the pixels it describes.

## A Read-Only View Of An Editor Hides Its Tools, And Says So In One Line

When an editor shows something that must not change (the Sprite Inspector's pattern snapshot in the
sprite editor), it **hides** the editing chrome rather than disabling it: the tool rail, the sheet
operations and the pen/fill colours go, because a column of greyed tools reads as "broken", not as
"read-only". The toolbar row becomes one line: a `Read-only` badge in the warning hue's subtle fill
(the inspectors' chip vocabulary), the title in `--text-primary`, the facts (source, offset, time) in
`--text-tertiary`, and only the actions that still mean something (Copy). Everything for looking -
zoom, grid, onion skin, palette, preview, hover readout - stays exactly as in the editable view, so
the reader sees what the editor would show. The guard is in the editor's one commit point as well as
in the hidden UI, so a shortcut that slips through still changes nothing.

Where no editor fits (a tilemap tile is 8×8 4-bit; the sprite editor is 16×16 8-bit throughout), the
read-only view is a **viewer built in the editor's shape** rather than a stretched editor: the same bar,
stage header, rulers (`SpriteRulers` takes a `count`), status line and palette/preview column, and the
file viewers' root type (`--monospace-font` at `--panel-font-size`), so the two snapshots read as one
family. A snapshot that should outlive the machine freezes its **palette** with its bytes and says so
in the palette's header ("as taken").

## A Heading Inside Panel Content Is `SectionHeader`, Not `PanelHeader`

`PanelHeader` is a *panel's own chrome* — a chrome surface with a bottom border. Dropping one into
the middle of a listing reads as a second title, which is what made `DskViewerPanel`'s nested
headings look like strips of chrome in the content. `SectionHeader` is the primitive for a heading
*within* content: a disk track, a memory bank, a breakpoint group. Its own doc comment says so; the
mistake recurs anyway, which is why it is here too.

## A Header Action The Machine State Forbids Stays, Disabled, And Its Tooltip Says Why

A document-header action that cannot run in the current machine state (the Execution History's
Export while the machine runs) stays in its place, disabled, and its `title` changes to the reason
("Pause the machine to export the history") - it does not disappear and reflow the strip. A file
action in a header is a `SmallIconButton` with the stock `save` glyph, placed after the panel's other
actions and before its filter; the context menu carries the row-relative variant ("… from here to
the newest…") rather than a second header button.

## Where A Timeline Came From Rides In The Reverse Segment, Not A New One

The IDE status bar has one reverse-debugging segment (`reverseStatusText`). Anything more that
describes the timeline - such as the debug recording (`.klr`) it was opened from - is appended to
that segment's text after ` · ` (`⟲ −1.24 s · step −42 · bug.klr`), and at the present, where the
segment would otherwise be empty, it is the whole text (`Recording: bug.klr`), in words, not a glyph
that could be read as "recording in progress". It never adds a second segment beside the first: the
status bar's segments are the machine's facts, and two that change together must not compete. The
tooltip carries the sentence that explains it.

A file viewer whose file the running build may refuse (a `.klr` replays only in the build that made
it) says so in one row, **Opens in this build:**, answered in a sentence - yes, no with the reason and
the fallback, or "not known yet" with why - rather than a flag, because the useful part is the reason.

## A Share Is A Wash Behind Its Figure; Time That Is Nobody's Recedes In Italics

The Profiler (`.plans/PROFILER_PLAN.md` D3, D4, D14) set three rules for tables of measured time:

- **A percentage of a whole is drawn as a bar behind the figure**, in `--bgcolor-profiler-bar`
  (the primary accent's subtle wash), never as a coloured number or a status hue. The figure stays
  in the data ink and stays legible over the bar; the bar is the at-a-glance ranking. A heat ramp
  is for patterns across many cells (the memory view); a single share per row is a bar.
- **Rows that are time but not a routine** (HALT waiting, interrupt acknowledge, DMA, snooze) and the
  call tree's roots are **italic in `--color-profiler-pseudo`** (the secondary data ink): present,
  counted, but not code you can fix. A recursive repeat is `--color-profiler-recursive` with `↺`.
- **A caveat about the data's accuracy is a warning-ink fact in the header** with its explanation
  in the tooltip (`--color-profiler-warning`: stack switches, overflowed depth, a full edge table),
  never an error colour and never a modal - the data is still useful.
- **A column that can never hold anything on this machine is omitted**, not left blank: the
  partition column appears only on machines that have banks.
- **A view with tabs inside a document uses a segmented `role="tablist"`** in the panel header,
  styled like the Sprite Inspector's (accent fill on the selected segment), so tabs never read as
  the document tab strip.



This is the process lesson from the same work, and it cost two rounds of shipping a "fix" the user
could see was still broken.

A standalone HTML page that copies the stylesheet rules is **not** evidence. The replica used to
"prove" the alignment above flattened the nested `DataRow`, so it measured everything landing within
0.01px while the real panel was 8px out. A replica can only confirm what you already modelled
correctly; it cannot discover the wrapper you did not know about.

**This was violated again in Phase 11, in a way worth spelling out, because the violation looked
reasonable from the inside.** The author asked for prototypes — a legitimate request, and a
standalone HTML gallery is the right tool for *choosing between design options*. The failure was
never drawing the line at the other end: the chosen design was then applied to the real SCSS and
reported as done on the strength of a passing build, a green suite and a read of the compiled CSS,
with "my tools can't drive an Electron window" said twice — while this very file documents the
recipe that can. Keep the two apart:

| Purpose | Replica | Running app over CDP |
|---|---|---|
| Choosing between design options, A/B-ing a value with the author | **Yes** — cheap, side by side, no relaunch | Awkward |
| Believing a change works | **Never** | **Always** |

A prototype that is honest about being a prototype is fine. A prototype standing in for verification
is the same mistake twice. If the app is already running without `--remoteDebuggingPort=9222`, that
is a reason to ask the author to relaunch it — not a reason to skip the check.

**The line falls between *geometry* and *rasterisation*, and it is worth being exact about which
side a question is on.** "Is this row aligned?" depends on the wrappers around it, so only the
running app can answer it. "Does this 24×24 stroke glyph survive being drawn at 16px?" depends on
nothing but the SVG, the size and the rasteriser — and Chromium is the rasteriser either way, so a
page that draws the *actual file* at the *actual size* beside the icons it must be told apart from
answers it faithfully and in a fraction of the time. That is how the NextReg breakpoint glyph was
settled: three variants at 16 and 32px next to `bp-mem-write` and `bp-io-write`, which showed the
first draft's shortened arrow was the weakest in a family whose whole grammar rests on that arrow.
Say which of the two you did. The temptation is to let a cheap rasterisation check stand in for the
geometry check it cannot make.

Drive the real thing instead — `.plans/baseline/drive.mjs` against a CDP-enabled launch:

```bash
npx electron-vite dev --config build/electron.vite.config.ts --remoteDebuggingPort=9222
node .plans/baseline/drive.mjs ide "<expression returning a JSON string>" - -
```

Specifics worth keeping:

- **CSS Module class names are hashed**, so query by substring: `[class*=flagLetterGlyph]`.
- **The sidebar panels only exist when their activity is selected.** The Z80 panel needs the Debug
  activity; a fresh profile opens on Explorer and the probe returns zero elements. Check for
  `_active_` before clicking an activity button — clicking the active one collapses the sidebar.
- **Relaunch after SCSS + `.tsx` edits.** HMR left the panel missing from the tree mid-session,
  which matches the warning under "Running the app for visual checks" below.
- Measure *ink*, not boxes, when the question is optical: `getBoundingClientRect()` gives the
  advance box, and canvas `measureText(...).actualBoundingBoxLeft` gives the bearing to add to it.
- **Never clear `#themeRoot`'s inline `style` to test something.** That attribute *is* the token
  set — `ThemeProvider` emits all ~400 custom properties onto it — so wiping it renders the whole app
  in CSS initial values. It looks exactly like a component failing to resolve its own tokens (black
  text on black, every surface transparent) and will send you hunting a bug you just caused. Setting
  properties on it is fine, and is how to preview the other tone without the app menu: dump the light
  set from `semanticTokens("light", …)` and `setProperty` each one. Reload the window to undo.
- **Hovering over CDP needs the mouse parked elsewhere first, and patience.** `TooltipFactory`
  listens for `mouseenter` on its `refElement`, so a synthetic `new MouseEvent` often does nothing —
  use `Input.dispatchMouseEvent`. And the previous tooltip's hide timer outlives a fast script:
  reading too early returns the *last* row's tooltip and looks like crossed wiring. Park at a far
  corner, wait ~1s, hover, wait ~1s, then read.

It catches more than geometry. This same loop caught a **blank renderer**: replacing the panel's
`writeOffset ?? 0xff` with a `=== undefined` test let a `null` through to `toHexa6`, which threw
`Cannot read properties of null` and took the whole React tree down — `tsc` and `eslint` were both
clean, because the field's type says `number | undefined` while the emulator actually sends `null`.
When you tighten a nullish check, keep it nullish (`== null`, or an explicit both-branches helper),
and load the panel before believing it.

## A Pass/Fail List Colours Its Status, Nothing Else

The Unit Tests panel is a data list whose one piece of meaning beyond the neutral hierarchy is a
verdict, so the verdict is the only colour: the status glyph takes `--color-unit-test-passed` /
`-failed` / `-error` (L4 aliases of `--status-success` / `--status-error` / `--status-warning`), a
running test the accent, a test not run `--text-tertiary`, and the message line under a test that did
not pass repeats its glyph's hue. Names, T-states and suite rows stay `--data-label`/text, and the
selected row takes the accent's tint (`--bgcolor-unit-test-selected`), as list selections do. A suite
row shows its *worst* member's glyph, so a collapsed reading of the list still finds the failure.
Do not tint whole rows red or green: the glyph plus the message line already say it, and a coloured
band would read as a selection. The same applies to any future verdict list (lint results, a CI
report).

## A Status-Bar Item For Something Outside The IDE Is Quiet Until It Acts

The automation item (`IdeStatusBar`, COMMAND_LINE_AUTOMATION_PLAN D4) exists only while the server
listens, and it is plain status-bar text (`--color-statusbar-label`, no border) while nobody is
connected: "listening" is configuration the user chose, not news. While a client is connected it
becomes an accent chip (`--color-/--bgcolor-/--border-statusbar-automation-active`, L4 aliases of the
accent's text, subtle and border tones) with the count, because something outside the IDE can now
drive it - that is state worth seeing from across the screen. Not the error colour (nothing is
wrong) and not the secondary accent (that means "the past"). The icon paints with `currentColor`, so
it follows the chip. A future "an external thing is attached" indicator (a hardware link, a remote
session) should follow the same two steps.

Any state the main process publishes for a renderer must be **re-published when that renderer
loads**: an action dispatched in main before a window's store exists never reaches it (the item
was missing until the first client connected).

## Token Architecture

Four layers, in `src/renderer/theming/tokens/`:

1. **L1 `palette.ts`** — primitives. Neutral ramp per tone, six accents, status hues, `DEVICE`,
   `DEVICE_INK`, ANSI.
2. **L2 `semantic.ts`** — `semanticTokens(tone, accentId)`. Roles, not shades.
3. **L3 `dimensions.ts`** — spacing, radii, strips, sizes, type scale, measure, shadow, motion, z.
4. **L4 `componentAliases.ts`** — the ~200 legacy `--bgcolor-*` / `--color-*` names repointed onto
   L2. **This is why 110 stylesheets changed palette without being edited.** If you are adding a
   colour to an old stylesheet, alias it here rather than reaching for a literal.

Because L2 varies by tone and the alias map does not, `light-theme.ts` collapsed. Keep it that way:
a new hand-copied light value is a regression.

**`ThemeProperties` in `theming/theme.ts` lists L4 alias names only** — not L1/L2/L3. Add every new
alias there as well as to `componentAliases.ts`. Nothing enforces it: the alias map is typed
`Record<string, string>`, so a missing entry compiles, passes the token-contract test, and works at
runtime. It is a documentation convention, and the only way to keep it is to follow it. (Phase 11
added six aliases and registered none of them until a concurrent change on the same file made the
omission visible.)

**A mandate that is documented as tested and is not will be re-opened by new code at full rate.**
For thirteen phases `AGENTS.md` and the plan both said M1, M2 and M3 "have tests that will fail
you". Only M3 did. The result was not slow decay: the single largest block of `em` font sizes in the
repo was written in the commit *immediately before* anyone checked, years after the
rule (19 of the 54 that existed when the test was finally written). Everyone involved believed the
rule was enforced, so nobody looked. **Before trusting a
documented gate, run it and watch it fail on a deliberate violation.** This is the `AttachedShadow`
lesson arriving from a third direction: there a feature was wired up and drawing nothing; here a
rule was written down and enforcing nothing. Both look exactly like working.

**Not every mandate can be a text rule, and pretending otherwise is worse than admitting it.**
M1 is syntactically decidable and its test is worth having. M2 is not: two heuristics were tried and
both were dropped — px widths in "tabular-looking" stylesheets ran ~80% false positives (swatches,
icons, a 2px rail), and counting every bare-number `width` buried the one real violation under 19
legitimate `<LabelSeparator width={8} />` spacers. **A rule with that hit rate trains people to add
allowlist entries instead of fixing code.** What shipped is the one shape a regex can settle — a
numeric *literal* on a column cell — plus a written note that the general case is a **type** problem:
every other column width goes through a named constant whose unit depends on whether it is a string
or a number, which only the compiler can see. The durable fix is to delete the number half of the
prop, after which the M2 test becomes redundant and should be deleted rather than kept as decoration.

**Count a baseline by the thing you will fix.** The first version counted one offending *element*,
so `<LabeledFlag labelWidth={36} valueWidth={20} />` scored 1 — and clearing both props would have
moved the number by one, leaving slack the next edit could spend for free. Count per prop.

**A shrink must fail the build too, not just a growth.** `check-types.cjs` only logs when its counts
drop. For a ratchet whose entire purpose is to shrink, that lets the baseline drift above reality and
silently re-authorise a violation someone already fixed. Failing on a stale-high entry costs one
clearly-worded message and makes the fix stick.

**An absence and a failure are not the same empty state.** `EmptyState` renders
`--data-secondary`, which is right for "nothing here yet" and wrong for "this file would not parse" —
converting an error surface to it demotes a failure to grey. It now takes a `tone`, and `error`
(`--status-error`) is what a viewer that could not read its file uses. Watch for the instruction
"use the shared primitive" hiding a semantic change like this one.

**A completeness check belongs in the type, not in the list.** `DialogProvider` kept a
`Set<keyof DialogOptions>` naming every option key, used to tell two `open()` overloads apart — and
`iconName` and `danger` were added to the type and not to the set, which silently misroutes any call
passing them. A `Set<keyof T>` constrains what goes *in*; it cannot require completeness.
`Record<keyof Required<T>, true>` can, and fails the build when the type grows.

**When a rename must precede the work, do it as its own commit and batch nothing into it.** A
mechanical rename is reviewable only while it is provably mechanical; one behavioural change hidden
in a 200-line path diff is invisible. And the gate for a directory rename is `electron-vite build`,
not `tsc` — a path-only break type-checks clean and fails at Vite's import analysis.

**Prefer a fix that makes the bug unrepresentable over one that makes it absent.** Two in one pass.
The Breakpoints panel kept its disassembly in a ref indexed in parallel with a state array, filled
across an `await` per row: correct only while nothing re-rendered mid-refresh. Pairing the two into
one state value removes the window rather than narrowing it. The PSG panel's `CntC`-reads-`cntB` was
a one-character fix, but the *cause* was three hand-copied seven-row blocks; parameterising them is
what stops the fourth copy. Ask what shape the defect lived in.

**A row's accessible name comes from its content, and `aria-label` silently replaces it.** Adding
`aria-label={fullPath}` to an Open Editors row looked like an improvement and made a screen reader
announce `/proj/src/a.asm` where the eye reads `a.asm`. Long text belongs in the tooltip; a state
worth announcing (here "Unsaved changes") goes on a child element, where it *appends* to the name
instead of displacing it. The existing tests caught this, which is the argument for querying by role
and name rather than by class.

**`role="list"` is not a free upgrade for a group of buttons.** ARIA's `list` requires `listitem`
children, so wrapping clickable rows in one means giving up the `button` role that says what they do.
`role="group"` with a label supplies the missing context without misdescribing the rows.

**`e.code` is the physical key; `e.key` is what it means.** Three handlers in this codebase switched
on `e.code === "Enter"`, so the numeric keypad's Enter — which reports `NumpadEnter` — did nothing.
Two of them read `e.key` a few lines further down for the arrows, in the same switch.

**Stripping a type colour needs the glyph checked first, not after.** §5.2's rule is that a hue
marking a type is not state and the glyph already says it. In the NEC UPD 765 log the glyph did
*not*: reading data and reading the status register were the same left arrow, distinguished only by
cyan versus white, so a straight deletion would have merged two operations into one. Redraw first,
then remove the colour — the `BreakpointIndicator` order, which is the general one.

**A CSS class with no declarations is stripped at build time.** Keeping `.psgPanel { }` as a "DOM
hook" after `DataPanel` absorbed its only rule leaves `styles.psgPanel` `undefined` and a comment
describing something that does not exist. Delete the stylesheet.

**A duplicated constant table is a bug waiting for one of its copies to be fixed.** The ZX Spectrum
48K palette existed twice — in `CommonScreenDevice` and in the `.SCR` viewer — each headed "ARGB
colors", and the heading was wrong in both. Whoever corrected one would have left the other saying
the opposite. It is now `emu/machines/spectrum-colors.ts`. **And the values were right all along:
they are ABGR**, because they reach the screen as the bytes of a `Uint32Array` handed to
`ImageData`, which is RGBA byte order — so the low byte is red. Check a byte order on an entry whose
channels actually differ; a grey or a white passes under either reading, which is exactly why the
wrong comment survived so long.

**A field that is always the same value is not a field.** The DSK viewer showed "Write protected:
true", "Has weak sectors: false" and "Total: 0", all hardcoded. Two were derivable from the disk
surface and now are; the third had no source in the data at all and was deleted. Displaying a
constant as though it were a reading is worse than omitting it, because it looks like information.

**Two labels showing one value is invisible until you read the source.** `B/T` and `TLen` in the
same DSK row both rendered `bytesPerTrack`. Nothing about the screen says so — the numbers merely
match, which for two related measures looks like a fact about the disk.

**Registering a renderer and routing a file to it are two halves that type-check separately.**
`Z80_VIEWER` sat in `documentPanelRegistry` for six months while the `fileTypeRegistry` entry that
reaches it was commented out — 913 lines of complete parser that nothing could open, switched off in
passing by an unrelated feature. Neither half is wrong on its own, so no compiler and no test saw
it. When a viewer "does not work", check it is reachable before reading its code.

**A parser reached only through a route that was disabled has not been exercised either.** Before
re-enabling one, add the guards its first real input will need — `loadZ80FileContents` walked into a
30-byte header with no length check.

**`<svg viewBox="…">` with no `width`/`height` is 300×150.** That is the CSS replaced-element
default, and it applies inside a 20px swatch as readily as anywhere else; only the absence of a
background on the overflow keeps it invisible. This is the second time the same defect has been
found in this codebase (§13.2 was the first), in a file the earlier sweep did not reach — so it is
worth grepping for `<svg` without dimensions rather than fixing the reported instance.

**Parsing in the render body costs a re-parse per render, and the cost is invisible in the code.**
Both the tape and disk viewers called their file readers directly in the component body, so every
`DataSection` expand — which dispatches a hub state change and re-renders the panel — re-read the
whole file. Neither had a comment suggesting anyone had considered it.

**A `catch` that discards the message turns a diagnosable failure into a mystery.** Three viewers
caught their parser's error and rendered a fixed string ("Invalid tape file format", "Invalid disk
file format"). The readers already returned a sentence saying what was wrong with the file; it was
being thrown away one line from where it would have been shown.

**Colour that restates the adjacent word is decoration.** The palette editor labelled its channel
scales "Red", "Green" and "Blue" *in* red, green and blue, borrowed from the console's ANSI palette.
§5.2's test — does the mark carry information the text does not? — fails here as plainly as it did
for the document icons. The swatches under each heading are what must carry channel colour.

**Prefer the field that was set on purpose over the string that happens to look right.** The
`.pal`/`.npl` editor asked `document.id.endsWith(".npl")` — a path, which need not end in the
extension — when the registry had already made that exact distinction and recorded it in
`document.type`.

**A label that is merely next to its input gives the control no accessible name.** The shared
`Checkbox` had them as siblings with no `htmlFor`/`id`, so every checkbox in every dialog announced
itself as "checkbox, unchecked" with nothing to say which setting it was. It looked fine because the
label carried its own `onClick` — the *visible* behaviour was complete, so nothing prompted a look.
**And fixing it is where the bug is**: once `htmlFor` associates the two, the browser forwards a
label click to the input, so the label's own handler now fires *alongside* it and toggles twice.
Remove the handler when you add the association, and test the label click, not just the input's.

**A prop the component does not declare is dropped in silence.** `dialogs.open`'s generics infer the
props type from the object passed, not from the component, so `machineId` was handed to
`BreakpointDialog` — which has no such prop — and vanished. A test asserted it was passed, which
made the dead value look load-bearing. Assert what the component *does* with a value, not that the
caller supplied it.

**Adding a prop to a shared control is often cheaper than the workaround it prevents.** Seven
dialogs hand-rolled bare `<input>`s rather than use `TextInput`, and one reason was that it had no
`placeholder`. Two props on the shared control removed sixteen hand-rolled fields. When a team keeps
avoiding a primitive, ask what it is missing before assuming the avoidance was carelessness.

**Write the folder-wide rule first and watch every file fail it.** Phase 41's five new consistency
rules were all red across all seven dialogs before a single fix. That is the shape to aim for: a
rule that passes when you write it has told you nothing, and a rule asserted over the *folder*
rather than over the files you remembered is the only kind an eighth file inherits.

**Narrowing a rule honestly beats satisfying it dishonestly.** The same phase's "no bare form
controls" rule would have forced a single-line `TextInput` on a multi-line comment field, because no
shared `TextArea` exists. The rule now excludes `<textarea>` and says why, and the gap is recorded.
A lint satisfied by a functional regression is worse than the lint.

**When a flag is passed and unused, ask whether it should be used before deleting it.** `isFolder`
reached both `RenameDialog` and `DeleteDialog` and neither read it. In rename it was genuinely dead
— the consequence is identical either way. In delete it was not: a folder takes everything inside
it, and a destructive confirmation should say which it is about.

**A control disabled with `pointer-events: none` is not disabled.** It is greyed and
mouse-proof, and still in the tab order — so a keyboard user reaches it, opens it, and changes the
setting the UI is presenting as unavailable. `StartModeSelector` did this to a `Dropdown` for want
of a `disabled` prop. Use the underlying control's own disabled state; it also marks the control for
assistive technology, which no amount of opacity does.

**When call sites keep avoiding a shared primitive, ask what it is missing.** Three times in one
batch a hand-rolled control turned out to be a workaround for an absent prop: `TextInput` had no
`placeholder` (so seven dialogs wrote bare `<input>`s), `Dropdown` no `enabled` (so one dialog kept
a native `<select>` and another faked disabling with a style), `Checkbox` no label association. Each
gap cost more in duplicated markup than the prop cost to add — and two of the three workarounds were
also *wrong*, not merely verbose.

**A stub that drops the prop under test makes the test vacuous.** `Toolbar.test.tsx` mocks
`Dropdown` with a bare `<select>` that ignored `enabled`, so a new "is disabled" assertion passed
against a control that was not disabled. When you add a prop to a shared control, update its mocks
before trusting any assertion about it.

### The five mandates

- **M1 — the type scale is absolute, never `em`.** `em` compounds. Real example found: a panel set
  `1em` inside a `0.8em` parent and got 12.8px where it plainly meant 16px.
  Enforced since Phase 14 by `test/theming/type-scale-contract.test.ts`. **The baseline is now
  empty**: `src/renderer` has no `em` font size left, so the test is a plain rule again rather than a
  ratchet, and any new one fails immediately. (Monaco's vendored CSS has its own; it is third-party
  and out of scope.)
  **`calc(var(--some-token) * n)` is the sanctioned exception**, for a size that must stay
  proportional to a *named* base — the register panel's flag letters, whose `ch` column widths scale
  with that same font size, and the memory tooltip's secondary line. What M1 forbids is a ratio
  against whatever ancestor happens to set a size; naming the base removes exactly that. Do not
  "simplify" either to a fixed step.
- **M2 — tabular measure is `ch`, never px.** Column widths tuned to one font silently mistune when
  the font changes. **Iosevka is exactly 0.5em**, so 1ch = 6px at `--font-size-200` (12px) — measured
  twice, in a standalone probe and in the running app, not assumed.
  **`controls/layout`'s `width` prop is px for a number** (`cssWidth`) and a CSS length for a string,
  while `controls/data`'s cells read a bare number as `ch`. A column therefore wants `width="7ch"`,
  never `width={7}`. All three layout cells *documented the opposite* until Phase 14 corrected them,
  which is how `NecUpd765Panel` acquired a 16px column from an author who read the prop's own doc.
- **M3 — row heights are JS-readable.** `rowSizes.ts` is the single source; `VirtualizedList`
  positions rows from a number while CSS draws them, and if they disagree **no stylesheet change can
  fix it**. A ratchet test (`test/theming/row-size-contract.test.ts`) fails on any new
  component-private `*ROW*SIZE|HEIGHT` literal.
- **M4 — shrink imperative theme reads.** Key SVGs still resolve colours through
  `themeService.getThemeProperty("--token")`. That is allowed; passing a raw hex is not. Pass **token
  names** and resolve them, as `Sp48Key` does.
  The same holds **outside the renderer**: pixels the main process draws (the IDE + Emulator
  recording's fill and click rings) take token names - `--surface-canvas`, `--accent-solid`,
  `--accent-secondary-solid` - and read their computed values from the IDE page's theme root
  (the element whose inline style carries the tokens) when the work starts
  (`recording/window-recording/themeColors.ts`). The only literals allowed there are a fallback for
  an unreadable page and the drawn picture of a mouse pointer, which is an image, not UI chrome.
- **M5 — the Monaco syntax palette is generated in one place** (`theming/tokens/syntax.ts`),
  never as colour literals in the seven language providers. *What* it generates is being
  revised (see the note above); *where* it comes from is not.

## Where Things Live Now

- **`controls/data/`** — the shared data-display primitives: `DataPanel`, `DataRow` (+`dense`),
  `DataLabel`/`DataValue`/`DataSecondary` (ref-forwarding), `PanelHeader`, `SectionHeader`,
  `PanelFilter`, `EmptyState`, `HexValue`/`formatHex`, `HexByteGrid`, `PartitionPrefix`,
  `AddressLabel`. `registers.tsx` holds the CPU-state components.
  **`PanelFilter`** is the one-row filter box at the top of a long list (name/address matching is
  the *panel's* decision; the box only owns the input, the count and the clear). It is content, not
  chrome — no `--surface-chrome`, no bottom border — because a sidebar panel already has a header
  band and a second strip under it reads as a second title. `TextInput` is not a substitute: it is a
  dialog field, with 8px block margins, a 32px button and a `font-size: 0.9em` M1 forbids.
- **`controls/bankBrowser/`** — `BankBrowser`, the bounded list-and-details browser of a file's banks
  with per-bank pop-out, shared by the NEX viewer (`NexBankBrowser`) and the `.z88` viewer
  (`Z88SlotBrowser`), and by the tape viewer (`Tape/TapeBlockBrowser`). The shell's stylesheet holds the frame, rows, chips (`BankChip`), facts
  (`BankFacts`), sections and group headers; a viewer's own stylesheet holds only what that viewer
  alone shows (the NEX breakpoint chip, content mix, comment, labels). See "A Bank Browser Has One
  Shell".
- **`controls/layout/`** — the wrappers with 21+ importers. They now *delegate* their cell to
  `controls/data` and add only `TooltipFactory` behaviour.
- **`theming/tokens/syntax.ts`** — `syntaxPalette(tone, accent)`, `syntaxRules`, `editorColors`,
  plus the colour maths (`contrastRatio`, `ensureContrast`).
- **`theming/tokens/palette.ts`** — `AccentDef.secondary`/`onSecondary` alongside `solid`/`onSolid`,
  one pair per accent (Phase 10).
- **`theming/tokens/semantic.ts`** — the `--accent-secondary-*` family, generated from `secondary`
  the same way `--accent-*` is generated from `solid` (Phase 10).
- **`theming/tokens/componentAliases.ts`** — also `--color-scrollbar-handle` / `-hover` /
  `-active`, the overlay scrollbar handle's three states (`--text-disabled` → `--text-tertiary` →
  `--text-secondary`, so the progression is derived in both tones). The sizing lives in
  `assets/styles/overlayScrollbars-modified.css`: `--os-size` is the **track**, and the painted
  handle is `--os-size - 2 x --os-padding-perpendicular` — 12px/2px = an 8px handle, 10px/2px = 6px
  for the `thinScrollBar` variant. Fully rounded (`--os-handle-border-radius: 999px`).
- **`theming/tokens/componentAliases.ts`** — also `--color-panel-separator`, the rule between
  sections of a register/state panel (`controls/layout/Separator`, used by the Z80, M6510, VIC,
  Blink and ULA panels). Distinct from `--color-toolbar-separator`; see the trap below.
- **`theming/tokens/componentAliases.ts`** — `--color-memory-*`/`--bgcolor-memory-*`,
  `--color-disassembly-*`/`--bgcolor-disassembly-*` and `--color-state-value`, the memory dump's,
  disassembly's and the Z80 CPU panel's own scoped colour tokens (see § "View-Scoped Colour" above).
- **`appIde/SideBar/SideBarBadge.tsx`** — the panel-header pill, four tones (`neutral` default,
  `accent`, `warning`, `error`). **Renders `null` for an empty count** (zero, negative, `undefined`,
  `NaN`); that is why it exists rather than a `<span>` per panel, so no future badge can forget the
  empty case. Consumers: `SideBarPanels/BreakpointsBadge.tsx`, `SideBarPanels/WatchBadge.tsx`.
- **`theming/tokens/dimensions.ts`** — also `SCROLL_SHADOW` (per-tone colours, like `SHADOW`) and
  `SCROLL_SHADOW_HEIGHT`, emitted as `--shadow-scroll`, `--shadow-scroll-line`,
  `--shadow-scroll-height` (Phase 11).
- **`theming/tokens/semantic.ts`** — also `--surface-header`/`-lit`/`-hover`/`-lit-hover`, the panel
  header band's gradient stops (Phase 11).
- **`controls/Modal.tsx` + `Modal.module.scss`** — the dialog frame. `iconName` is the optional
  header glyph; the chip takes the danger tone from `primaryDanger`, so `DialogOptions` carries
  `iconName` and `danger` through to it and `useConfirmPort` sets both. The close button sits in the
  header's flow (it was absolutely positioned from an inline style, which is why the header used to
  carry a 52px right padding). `--z-modal` is the z-index; it was a literal `100`, i.e. the
  *overlay* level, which is also what the two portalled dropdown menus were sitting at.
- **`controls/Button.tsx`** — three variants now: `primary` (filled accent), `variant="secondary"`
  (an outline, `--border-button-secondary`) and `isDanger`. Dialog footers pair secondary + primary.
  It had one axis before, so Cancel and the commit button were the identical accent fill.
- **`theming/tokens/semantic.ts`** — also `--status-error-hover`, derived from `--status-error` the
  way `--accent-solid-hover` is derived from `--accent-solid`, for the filled destructive button.
- **Deleted:** `--bgimage-modal-header` (the header scanline) and `--color-modal-accent` (the 2px
  slab) — and with the scanline gone, `toneTokens()` is down to the backdrop alone.
- **Deleted:** `controls/valuedisplay/`, `DocumentPanels/helpers/PanelHeader.tsx`,
  `GenericFileViewerPanel`/`GenericFileEditorPanel` (now one `GenericFilePanel`).

Four traps worth knowing:

- **An overlay positioned near its own anchor must be `pointer-events: none`, or it destroys the
  hover that produced it.** `Tooltip` renders its box relative to the anchor, and the register rows
  place it over the right-hand end of their *own* row (`placement: "right"`, `offsetX: -32`). With
  the box hit-testable, a pointer reaching that band was covered by the tooltip, so the anchor
  stopped being topmost, `mouseleave` fired, the box unmounted, the anchor was topmost again, and
  `mouseenter` restarted it. Self-sustaining, and it runs at the anchor's own `showDelay` — ~107ms
  per cycle against the register rows' `showDelay={100}`, about nine flashes a second.
  **The symptom names the wrong culprit**: it was reported (reasonably) as "the tooltip flickers
  near the vertical scrollbar", because a sidebar row's right-hand end is where the scrollbar is.
  The trigger is the anchor/overlay overlap; the scrollbar is a bystander. Any portalled overlay
  driven by the anchor's own pointer events — tooltip, popover, hover card — has this bug latent
  the moment its box can reach back over its anchor.

- **Before re-implementing a library's behaviour in React state, check whether the library already
  has it.** `ScrollViewer` drove scrollbar auto-hide from a `pointed` state
  (`onMouseEnter`/`onMouseMove`/`onMouseLeave`) feeding a second OverlayScrollbars theme,
  `os-theme-not-hovered`, whose only declaration was `--os-handle-bg: transparent`. The library has
  `scrollbars.autoHide: "leave"`, and the vendored stylesheet already carried the
  `.os-scrollbar-auto-hide-hidden` rule and its `opacity .15s, visibility .15s` transition. The
  hand-rolled version could not fade (a custom property flips instantly), re-rendered the panel's
  whole subtree on **every mouse move**, and depended on React's synthesised `onMouseLeave` — which
  comes from `mouseout` and does not arrive by every path a pointer can leave an element. It is now
  `autoHide: "leave"` + `autoHideDelay: 100` and the component has no mouse handlers at all.
  `autoHideSuspend: false` matters: the default (`true`) holds every scrollbar visible until the
  first scroll.

- **Two single-class selectors setting the same custom property are a tie that stylesheet order
  breaks.** `.os-theme-not-hovered { --os-handle-bg: transparent }` was declared *before*
  `.os-theme-dark { --os-handle-bg: #808080c0 }`, so any moment both classes sat on one element the
  handle painted grey whatever the hover state was — verified by setting both on a probe element in
  the running app and reading the resolved value. This is the same specificity-tie trap recorded for
  CSS Modules overrides further down, and it is *worse* for custom properties, because the losing
  declaration produces no visual artefact to notice — just an occasional wrong colour.

- **A border token is only as visible as the surface behind it — so one shared token cannot serve
  two surfaces.** `--color-toolbar-separator` drew both the toolbar dividers (on `--surface-chrome`)
  and the section rules in the register panels (on `--surface-panel`, the darkest surface in the
  dark tone). `--border-default` is correct on chrome and measures **1.37:1** on panel — a rule that
  physically exists and optically does not. The fix is to *split the token*, never to retune the
  shared one: raising `--color-toolbar-separator` would have heavied every toolbar in the app to
  solve a sidebar problem. Panel section rules are now `--color-panel-separator`
  (`--border-strong`, 1.74:1 dark / 1.76:1 light). **Before changing a shared L4 alias, list every
  surface it lands on.** Same family as the `AttachedShadow` trap below, arriving from the other
  side: there a token pointed at the wrong semantic family, here a correct token was asked to cover
  two grounds at once.

- **`--surface-raised` is not "the raised surface" in both tones.** It means *lighter*, which is only
  what "raised" implies in dark; in light it is pure white. Anything that must read as lifted in
  dark and **recessed** in light — a header band on a panel — needs its own semantic pair, not
  `raised`. This is the general shape of the one asymmetry the derived light theme cannot absorb.

  **The sharper form of the same trap: `--surface-raised` and `--surface-overlay` are the *same
  value* in light (`#ffffff`), so anything that distinguishes itself from an overlay by being
  "raised" is invisible there.** The modal was the worst case — its header, body and footer all
  resolved to white, held apart only by a 2%-opacity scanline — but so was every dialog *field*:
  `--bgcolor-input` and both dropdown triggers were borderless `--surface-raised` on a white body.
  **A control that distinguishes itself only by fill needs a border as well**, and dialog fields now
  carry `--border-input` / `--border-color-dropdown-input`. Check a surface pair in *both* tones
  before trusting it; the dark values differing is not evidence.

- **A panel that is not a `DataPanel` gets no declared leading, and nothing tells you.** Both
  `Data.module.scss`'s `.dataPanel` and the `side-panel-content` mixin declare
  `line-height: var(--panel-line-height)`; a panel root that sets `font-size: var(--panel-font-size)`
  by hand and nothing else runs on `line-height: normal`, i.e. on the *selected font's* metrics.
  Measured on the Call Stack row: **21.5px on Iosevka, 20px on the ZX Spectrum face, 22.5px on
  JetBrains Mono** — a 12% spread driven entirely by a user font setting, and it collapses furthest
  on exactly the face this app ships for authenticity. With the leading declared it is 23px on all
  three. **Survey for this rather than fixing the reported instance**: grep for stylesheets that name
  `--panel-font-size` but neither set `line-height` nor include `side-panel-content`. That grep is
  now clean: `CallStackPanel`, `NextRegPanel`, `BreakpointsPanel`, `WatchPanel`, `NecUpd765Panel` and
  `ScriptingHistoryPanel` all declare it. **Re-run the grep after adding a panel** — the mandate has
  no test behind it, and a new panel that hand-rolls `font-family` + `font-size` instead of using
  `DataPanel` or the mixin re-opens the hole silently.

  Two notes from fixing the last four. **Declare it where the `font-size` is, not on the panel root
  by reflex**: `ScriptingHistoryPanel` sets its size on `.itemWrapper`, so that is where the leading
  belongs. And **a fix with no visible effect is still the fix** — `BreakpointsPanel` and
  `WatchPanel` measured 26px before and after across all three faces, because their rows carry
  `min-height: --row-size-list`, which exceeds any line box they can produce. They were protected by
  a row height that a later `dense` would remove. Where a panel has no content to measure (an empty
  history, or a panel gated to another machine), verify the *rule* instead: a probe element with the
  hashed class resolving `line-height` to `19px` rather than `normal` proves it applies.

- **Three row heights coexist in the sidebar, and they are not interchangeable.** At a 14px panel:
  `DataRow` default = `--row-size-list` (26px, list chrome — right for Watch and Breakpoints, which
  *are* lists); `dense` = the bare line box (~19px — Z80 CPU, ULA & I/O); and Call Stack's `.item`,
  which is `dense` plus `2px` of block padding (~22.5px). The Next Registers and Next Memory Mapping
  panels were on the 26px list row despite being label/value displays, and now carry `dense` plus
  the same 2px — the author's chosen reference for them is the Call Stack row, not the Z80 one.
  When matching a panel to another panel, **measure both in the running app first**: `dense` alone
  looked like the obvious answer and would have landed 3.5px *under* the target.
- **Add leading with `padding-block`, never a `min-height`.** M3 keeps row heights in
  `rowSizes.ts` so CSS and `VirtualizedList` cannot disagree; a component-private height constant is
  what that mandate forbids. Padding leaves the row measuring its own content, which is what `virtua`
  reads. Check the list does not pass `itemSize` before changing a row's height — where it is
  omitted (as in these two panels) `virtua` measures rows itself and a CSS change is safe; where it
  is passed, the number has to move with the CSS.
- **A class passed through `xclass` ties with `DataRow`'s own `.dense`/`.dataRow` rules.** Both are
  single-class selectors from different CSS Modules, so the cascade falls back to emit order. Double
  the class (`.memMapRow.memMapRow`). This bit *inside this very session*: the first version measured
  correctly in the running app and was still order-dependent — a passing measurement does not prove a
  deterministic rule.
- `DataRow` needs `dense` for register/state rows (15px). The default carries `--row-size-list`
  (22px) and list chrome, which inflates a register panel ~47%. `dense` drops the row *height*, not
  the side padding — see the next trap for why that distinction matters.
- **`DataRow` nests**: the value components each render one, so panel row → component row → cells.
  Anything you add to the row primitive applies once per level. See § "Alignment In The Register
  Panels".
- `DataPanel` needs `autoHeight` whenever the panel's registry entry leaves `useScrollViewer` at its
  default — the host supplies the viewer, and a panel pinned to `height: 100%` hides its own
  overflow before the viewer can scroll it.

## Operational Knowledge

**Type-check.** `npm run build:check` is a no-op (see `AGENTS.md`). Use
`npx tsc --noEmit -p build/tsconfig.web.json`. The count at the end of Phase 9 was **166** errors,
all pre-existing. Treat a rise as your regression; diff by message, not by line, since line numbers
shift:

```bash
npx tsc --noEmit -p build/tsconfig.web.json 2>&1 | grep "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort
```

**Tests.** `npx vitest run --config build/vitest.config.ts --project=jsdom` (509 at end of Phase 9)
and `--project='!perf'` for everything (19714). A bare `npx vitest run` uses the wrong config and
fails ~700 files on module resolution — that is the invocation, not your change.

**Running the app for visual checks.**

```bash
npx electron-vite dev --config build/electron.vite.config.ts --remoteDebuggingPort=9222
```

`.plans/baseline/` holds `drive.mjs` (evaluate JS in a window), `capture.mjs` (screenshots),
`imgdiff.py`, and **before-shots of both windows in both tones**, captured at 2x before any of this
work started. **Keep those scripts in the repo** — they survived a scratchpad wipe between sessions
and saved the work.

**Hunting a visual regression.** The before-shots are the comparison target: re-capture the same view
with `capture.mjs` and diff. Two cautions learned the hard way — capture at the *same window size* as
the baseline (a size mismatch produced a 100+ element diff that was pure noise), and always relaunch
rather than trusting HMR. To A/B a suspect file, `git stash push -- <path>`, relaunch, look, then
`git stash pop`; and `git diff HEAD -- <path>` shows exactly what this work changed in any single
file.

- **Always relaunch for geometry.** HMR after a CSS + several `.tsx` edits has emptied the React root
  and reported all 162 elements as removed.
- **Never `git stash` to A/B a change in a repo you do not own the state of.** `git stash push --
  <paths>` **fails outright if any path is untracked**, and a failed push followed by `git stash
  pop` pops *whatever was on the stack* - in this repo, an unrelated WIP from another branch, which
  landed seven conflicted files across `emu/machines/zxNext/` and looked at first like the type
  errors had improved. The author's stashes survived only because a conflicted pop keeps its entry.
  To A/B a file, copy it aside and copy it back; to isolate one change, disable that one line rather
  than reverting the file. Check `git stash list` before and after anything that touches the stack.
- **Verify no process before launching.** Electron's single-instance lock makes a second instance
  quit with exit code 0, which looks like success.
- **`klive.settings` is rewritten at startup — for the app's *own* settings file.** Editing
  `~/Klive/klive.settings` to set the theme or accent does not work; the app writes its state back
  over your edit. Use the app's own menu for an app you launched yourself.
  **But a scripted launch can seed settings, and this is now the preferred way to pin them.** Point
  `KLIVE_SETTINGS_FILE` (absolute; `src/main/settings-path.ts`) at a file written *before* launch and
  the app honours it: seeding `theme: "light"` took mean window brightness from 26/255 to 246/255,
  and `globalSettings.ideViewOptions.toolPanelHeight` visibly resized the panel. That also pins
  accent, panel sizes and fonts, which is what makes a screenshot comparable across runs. See
  `doc-screenshots-guide.md`.
- **Driving the app menu (macOS) needs one script and an explicit menu-bar click**, or the items are
  not addressable:

```bash
osascript <<'EOF'
tell application "System Events" to tell process "Electron"
  set frontmost to true
  delay 1.5
  click menu bar item "View" of menu bar 1
  delay 0.6
  click menu item "Accent" of menu 1 of menu bar item "View" of menu bar 1
  delay 0.6
  click menu item "Phosphor Green" of menu 1 of menu item "Accent" of menu 1 of menu bar item "View" of menu bar 1
end tell
EOF
```

**Restore anything you change this way** (theme, accent, open tabs) when you are done.

- **Electron exposes neither CDP's `Emulator` domain nor its `Browser` domain**, so
  `setDeviceMetricsOverride` and `Browser.setWindowBounds` are both unavailable, and AppleScript
  resizing of the window does not take either. To test responsive/overflow behaviour, set a
  temporary size on the element in the page (`position: fixed` plus an explicit `width`/`height`);
  it drives the same `ResizeObserver` path a real pane resize would, and it is the only way to see
  a large-pane layout from a small dev window. Put the override back afterwards.
- **Diff type errors by message, but expect false positives from union ordering.** TypeScript prints
  union members in an unstable order (`"start" | "inherit" | …` one run, `"inherit" | "end" | …` the
  next), so a `comm` over sorted messages can report the same error as both added and removed.
  Compare counts per file before believing a diff.
- macOS `screencapture` is permission-blocked here. Use CDP `Page.captureScreenshot`, with `clip`
  and `scale: 2` for readable crops. **For a crop of one component, prefer the Playwright harness**
  (`scripts/doc-shots/`, and `doc-screenshots-guide.md`): `locator.screenshot()` on a
  `[class*="_toolArea_"]`-style prefix selector bounds the image by the element, so it keeps
  following the layout instead of being a pixel rectangle that quietly goes wrong after a reflow.
  It also launches its own isolated instance, so it needs no hand-started dev server on port 9222.

## Affordances On A Drawing Surface

**A shape with `pointer-events: none` cannot carry a cursor.** The sprite editor's selection is
drawn as an outline in that non-interactive layer, so there was nowhere to hang a `grab` cursor and
nothing to tell the user the marked pixels can be dragged. The fix is a separate, invisible hit
rect over the region (`fill="none"` + `pointerEvents="all"`) carrying `cursor: grab` /
`:active { cursor: grabbing }`. It takes the press as well, which is a bonus rather than a cost: the
256 pixel rects underneath stay ignorant of the selection, and the gesture reads its coordinate from
the same `getBoundingClientRect` maths the window listeners use.

**The transparency crosshatch is a pattern of LINES, not an opaque fill.** A transparent pixel looks
the way it does because the canvas ground shows between the strokes. So anything that needs to look
transparent while sitting *over* artwork - the hole a lifted selection leaves behind - has to paint
`var(--bgcolor-sprite-editor)` first and hatch on top. Laid straight over the pixels, the artwork
shows through the gaps, which is exactly the "did it lift or didn't it?" ambiguity the hole exists to
resolve. Because the pattern is `patternUnits="userSpaceOnUse"`, one rect over a region tiles
identically to the individual cells - no need to draw the hole cell by cell.

**Transient display state is not the document.** That hole is a drawing, not an edit: the map the
canvas draws from stays the sprite as it really is, so nothing that commits mid-gesture can make the
gap permanent. The alternative - handing the canvas a doctored copy with the region already cleared
- reads as harmless and puts a pixel-destroying bug one stray `onCommit` away. A test pins it: with
a sprite that has no transparent pixel anywhere, lifting a region must add zero hatched pixels to
the pixel layer.

## Escape, And Other Keys That Back Out

**Whoever cancels a gesture must also undo what the gesture put on screen.** When dragging a
selection began lifting pixels into a floating patch, the grid's existing "Escape cancels the drag"
path left that patch stranded above a hole - the pixels were fine, but invisible until a second
Escape. The `onCancelDrag` callback that had been a `NOOP` since the drag existed is exactly the
hook for this: a lift is abandoned outright, while a paste that was already in the air only returns
to where the grab found it, because destroying it belongs to the next press of the ladder.

**A back-out key needs exactly one handler per level, and the level that acts must stop the event.**
The sprite editor's Escape unwinds four things - an in-flight drag, a floating paste, the selection,
the tool - and the drag lives in the canvas while the rest live in the editor above it. With both
listening and neither stopping, one press collapsed two levels at once. The shape that works: the
inner component handles *only* its own case and calls `stopPropagation()` when it does; everything
else bubbles to one handler that owns the chain. Do not plumb a "did you handle it" boolean back up
instead - that is the same coupling with extra steps, and it was the first thing tried here.

## Method Lessons

These cost real time. They generalize past this codebase.

- **Synthetic drag events need help that `fireEvent` does not give you.** `fireEvent.dragOver` drops
  the pointer coordinates in jsdom, so a "which half of the target am I over" test silently always
  reads the first half — every drop lands one slot early and every assertion about the *other* half
  fails for a reason that looks like application logic. Build the event on `MouseEvent` to keep
  `clientX`, and wrap the raw `dispatchEvent` in `act()`, which `fireEvent` would have done for you.
  In the running app the same events are *batched*: read the DOM in a later evaluate, not the same
  one.
- **A patch script that batches edits in memory and writes once at the end loses every edit when a
  later assertion fails.** This produced two silent no-ops in one session: the file looked edited in
  the transcript, the assertion error scrolled past, and the bug being "fixed" was still there in
  the running app. Either write after each successful replacement, or check the file afterwards
  rather than trusting the script's exit. `grep` for the new text before moving on.

**Automated gates do not see appearance. Look at the pixels, then read the DOM.**
Every gate passed while `--surface-stage` was set within 1% of `--device-bezel` and the emulator
screen had vanished into its own surround. Also caught only by looking: a 38px toolbar with 4px
padding around 32px buttons, and `CON 0LCO 0` where a value ran into the next label.

**And do not trust the screenshot over the DOM.** I read a screenshot as showing unstyled hex
literals and was wrong — querying the computed colour showed they had the correct (deliberately
desaturated) number colour. Screenshots find *classes* of problem; `getComputedStyle` settles them.

**A test written after the fix is worth nothing until you have seen it fail.**
My first remount test drove the parent with a raw `element.click()`, which never flushed the React
update, so it passed against the broken implementation too. `fireEvent` plus an assertion that the
parent actually re-rendered turned it into a real test: 3 mounts before, 1 after. Temporarily
restore the old line and watch red.

**Never merge two things because they resemble each other.** Three planned consolidations turned out
to be pairs of different things — a divider and a spacer (`ToolbarSeparator` vs `LabelSeparator`); a
shared *address gutter*, not a shared row (`DataGridRow`); a tab strip, not a panel header
(`ToolsHeader`). Merging the first would have deleted every group divider in the app. Read both
before combining.

**When you replace a container, check which of its declarations were load-bearing.**
`flex: 0 0 auto` and `height: auto` both looked like noise in the old stylesheets. Dropping the first
let the flex algorithm compress rows to 8px against a 15px line; dropping the second hid 78px of Z80
state behind `overflow: hidden` with no way to scroll to it.

**Never quote a contrast ratio you have not computed — and this repo already exports the
function.** `contrastRatio(a, b)` is exported from `theming/tokens/syntax.ts`; the syntax palette is
built on it. A ratio asserted from a glance at two hexes is a fabricated measurement that reads as
authoritative, survives into code comments, and is repeated back by the next session. Dark neutrals
are the easiest place to be wrong: `#2e3238` on `#17191c` *looks* like nothing and is 1.37:1, not
the ~1.1:1 it appears to be, because WCAG's `(L+0.05)` floor compresses the whole bottom of the
ramp. Run the number.

**And name the right threshold, or none.** A divider, a hairline, a shadow edge is neither text nor
a control, so **no WCAG minimum applies to it** — quoting AA at a 1px rule invents a standard. The
honest claim is the before/after pair plus "visible at a glance on both tones". Reserve 4.5:1 for
text and 3:1 for control boundaries, where they actually bind.

**A semantic HTML element brings a UA stylesheet you did not write.** `<hr>` carries `0.5em` block
margins and `auto` inline margins. Nothing in any project stylesheet said so, so the panel section
rules were silently spaced by a **type-relative** value that drifts with the panel font size (the
thing M1 exists to prevent) and ran the full panel width, ignoring `.dataRow`'s `--space-2` gutter.
When you adopt `<hr>`, `<fieldset>`, `<button>` or `<dialog>` as a design primitive, reset its box
explicitly — the declarations you *don't* see are still load-bearing. Corollary of the existing
"check which declarations were load-bearing" lesson, for declarations that were never in the repo.

**A field can be declared at every layer and populated at none — and the type system will agree
with you all the way down.** `NextRegDevice` documents 73 of its 141 Next registers field by field
(338 slices), `NextRegInfo` declares `slices`, `getDescriptors()` explicitly maps `slices:
reg.slices`, and the IPC response type in `EmuApi.ts` declares it too. It had never reached a
consumer: the private `registerNextReg` destructured `{ id, description, readFn, writeFn }` and
rebuilt the entry from those four, dropping `slices` at the point of registration. Every layer
type-checked, because each was correct about a field that was always `undefined`. **When data
"exists" but nothing shows it, trace the write path before the read path** — and be suspicious of
any constructor that rebuilds an object from a destructured subset rather than spreading it.

**A second wrapper can quietly replace a real implementation with a placeholder.**
`ZxNextWasmV2Machine` — the *production default* backend — assigned
`nextRegDevice.getDescriptors = () => this.nextRegDescriptors`, a locally built table of 256 entries
reading `"WASM NextReg $XX"`. So the panel showed neither register names nor detail, and the symptom
looked like "the feature was never built" rather than "the data is being overwritten". Descriptor
tables are static documentation and do not belong behind a backend switch; only the *values* did
(`getNextRegDeviceState` is still overridden, correctly). Verified by reading the live tooltip over
`Reg 00:` in the running app: `"WASM NextReg $00"` before, `"Machine ID"` after.

**When a visual bug is reported "near X", check whether X is the cause or merely the landmark.**
A user describes where their pointer was, which is evidence about *position*, not about mechanism.
The tooltip flicker above was reported at the scrollbar and caused by the tooltip's own geometry;
chasing the scrollbar would have found nothing, and the two had just been changed in the same area,
which makes the wrong suspect look guilty. Instrument the elements actually involved — log the
anchor's `mouseenter`/`mouseleave`, and read `document.elementFromPoint` along the path the pointer
takes — before believing the label on the report.

**HMR does not just break geometry — it manufactures convincing intermittent *behaviour* bugs.**
The existing rule ("always relaunch for geometry") is too narrow. After an HMR-applied change to a
component that owns a third-party instance, a stale instance can survive alongside the new one: a
scrollbar auto-hide measured 3-of-30 failures and a 2.5s outlier under HMR, and 0-of-30 with a tight
246-284ms spread after a clean relaunch. The HMR numbers were about to be written up as a real race.
**Relaunch before believing any measurement, especially a flaky one** — flakiness is the signature of
this, not evidence against it.

**Electron's single-instance lock will quietly hand you a stale app to measure.** The second instance
exits 0 and the dev server prints its usual "starting electron app..." — so CDP connects, evaluates,
screenshots, and answers about the *old* build. Two separate wrong conclusions came from this in one
session. `pkill` the dev command is not enough; the app processes outlive it. Assert the count is
zero (`ps aux | grep -ci '[k]liveide'`) and that port 9222 is refused *before* launching, every time.

**Reproduce the bug before fixing it, and make the repro's own mechanism suspect.** A first attempt
to reproduce a stuck scrollbar dispatched `new MouseEvent("mouseleave")` from an injected script and
"confirmed" the bug — but React synthesises `onMouseLeave` from **`mouseout`** at the root container,
so a hand-dispatched `mouseleave` never reaches a React handler at all. The apparent confirmation was
the harness, not the app. Drive real input through CDP `Input.dispatchMouseEvent`; a synthetic
`dispatchEvent` tests a different code path than the one users take.

**Measure the timing in the page, not across the debugger.** A pass/fail threshold applied from the
driving script counted CDP round-trips as part of the effect and reported "sometimes stuck" for a
transition that was merely still running. Resolve a `Promise` inside `Runtime.evaluate` off
`requestAnimationFrame` and return elapsed `performance.now()`; then a number means what it says.

**Read the grammar; do not infer a rule from a sample.** I reported the UI's `$` hex prefix as
disagreeing with Klive's Z80 dialect because one project file used `#7C00`. The lexer accepts both
(`compiler-common/common-token-stream.ts`, `#` at ~301, `$` at ~310). Two minutes of reading would
have prevented escalating a non-problem.

**Measure the font; do not derive it from old constants.** Back-inferring `ch` from previously
converted px values reproduced *Menlo's* advance and was wrong by 15%. Measuring the bundled woff2
settled it in one step.

**Make edits count-asserting.** Python's `str.replace` is global: one unbounded call silently
rewrote an unrelated closing tag, and an unbounded `rindex` once deleted 22 of 32 tests — and the
suite went green. Assert the occurrence count before writing, and check test *counts*, not just
colour.

**Survey with the right pattern.** A `const …WIDTH` grep missed seven inline `width={160}` literals,
which a later refactor then silently reinterpreted from px to `ch`. When a survey drives a
mechanical change, verify the survey catches the shapes you are about to change.

**Prefer properties over values in tests.** Six accents × two tones is twelve palettes; asserting a
contrast floor, that errors never take the accent, and that keywords always do, survives a
thirteenth accent. Hand-checked values do not.

**Flag what only a human can settle.** The rainbow stripe order would have looked deliberate whatever
order it used — no test or screenshot could ever have caught a wrong one. That is the class of
question to raise rather than guess at; the author confirmed it in one line.

**An imperative theme read can lag the DOM by exactly one render, and CSS never shows you this.**
`getThemeProperty` resolves a token via `getComputedStyle(root)` *during render*, but `root`'s
`style` attribute only updates at *commit* — one step later. The render that first reacts to a new
accent reads DOM state that still reflects the old one, so `react-switch`/SVG-fill colours lagged
CSS-driven text by however long it took some *unrelated* future render to happen to fix it. Any
`getComputedStyle`/`getBoundingClientRect` read inside a render path that also depends on a style
change from that same update has this bug. Fix: force one more render after commit
(`useLayoutEffect` bumping a tick state), not a bigger `useMemo` dependency list.

**`Array.prototype.map` and `TypedArray.prototype.map` are not interchangeable, and nothing type-
checks the difference if the parameter is typed as `readonly number[]`.** A `Uint8Array` structurally
satisfies that type, but its own `.map` builds a *new typed array*, coercing every callback return
value to a number — return JSX from it and every entry silently becomes `0`. If a prop is typed as
a plain array but a caller might hand it a live buffer view (here: `memory.subarray(...)`, to avoid
copying on every scroll), wrap with `Array.from(...)` before `.map`-ing for anything but numbers.

**A ref that a click handler reads is only as fresh as the last effect that synced it — and effects
run after the handler, not during it.** Two bugs this session had the same shape: a click handler
called an async worker that read `somethingRef.current`, synced by a *different* effect elsewhere,
and the call happened before that effect had run for this update. One symptom was a stale
`autoRefresh` making "Follow PC" silently do a full disassembly instead of the small PC-relative
one; the other was a `ResizeObserver` rebuilt on every render because its setup effect had no
dependency array, invisible in jsdom (no `ResizeObserver` there at all — the test needed its own
stub to see the bug exist). If a value has to be current *inside this same event*, don't route it
through a ref-plus-effect pair; if a value only needs to be current *for the next scheduled work*,
put it in that work's own dependency array instead of calling the work directly from the handler.

**A `border` is part of the box model; an `outline` is not — and that difference is exactly the bug
when a box overlays text it doesn't own.** An absolutely-positioned overlay sized to line up with
real text underneath it stayed positioned correctly at its own edge, but a `border` still pushed its
*content* inward from that edge — invisible until you overlay something whose alignment actually
matters. `outline` paints at the same visual position without participating in layout.

**A shared component's override class and its own base class, from two different CSS Modules
files, are a specificity tie — and ties resolve by stylesheet load order, which is not something to
depend on.** Nest the override under a selector unique to the caller (`.item .foo`) or double the
class (`.foo.foo`) to force a deterministic win instead of an order-dependent one.

**A feature can be fully wired up, running, and drawing nothing — and CSS will not tell you.**
The sidebar looked like it had no scroll affordance. It had one: `ScrollViewer` has always rendered
`AttachedShadow` with real `isScrolled` state. Its colour token was aliased to `--surface-canvas` —
a *surface* used as a *shadow*, three RGB steps from the panel in dark and pure white in light. The
lesson is the diagnostic order: **before building a missing affordance, grep for it.** A token
pointed at the wrong semantic family produces no error, no warning and no visible output, and
looks identical to "never implemented".

**An `em` font-size does not just produce a wrong size — it can invert a hierarchy.** M1 has existed
since Phase 0, and one violation survived every phase: the sidebar's own title was 11px (absolute,
correct) while the panel headers inside it were `0.8em` = 12.8px. A parent heading rendering smaller
than its children is the kind of thing that reads as "someone chose this" for years. When M1 finds a
survivor, check what it is *next to*, not only what it computes to.

**A black gradient is invisible on a dark surface; the edge has to be carried by a line.** A shadow
over `--surface-panel` (`#17191c`) needs a 1px hairline *plus* the gradient — the line carries the
edge, the gradient carries the depth. And the fade-in **ramp has to be chosen with the height**: a
6px shadow on a ramp tuned for 14px spends most of its life half-lit.

**`width: 100%` with `flex-grow: 1` works only until something shares the row.** Both sidebar title
elements had it, and both would have pushed a sibling out of the strip rather than ellipsizing —
latent until a badge and a menu button arrived. `min-width: 0` is the mechanism that actually lets a
flex child shrink below its content size. Same family as the `height: 100000px` → `min-height: 0`
fix recorded earlier: a number standing in for the constraint that was actually meant.

**Unused infrastructure needs tests *because* it is unused.** Two extension points were added ahead
of their consumers. Nothing else holds those to their contract — a break would stay invisible until
the first real menu or badge, and would then look like a bug in *that* feature rather than in the
slot it plugged into.

**`container.firstElementChild` is not your component under `renderWithProviders`.** It is
`ThemeProvider`'s `#themeRoot` wrapper. A test asserting on its `className` compares the same
wrapper every time and passes vacuously — mine "passed" across four distinct tones. Query by role or
text and read the element you actually mean.

**JS block scope will silently shadow a loop variable, with no error.**
`for (const [, , h] of VARIANTS) { const h = document.createElement("p"); … }` is legal: the body is
its own scope. Every later use of `h` got the element, so a CSS custom property was set to
`[object HTMLParagraphElement]`, the rule was dropped, and the element rendered at zero height —
looking exactly like "the design does not work". Found only by asserting on **computed heights**
rather than reading a screenshot, which is the existing "do not trust the screenshot over the DOM"
lesson arriving from a new direction.

**Do not copy the neighbouring component's refresh strategy; ask what makes *its* data stale.**
`BreakpointsPanel` polls on a timer because its disassembly, resolved addresses and PC go stale as
the machine runs. A *count* of breakpoints does not — it changes only when the list does, and every
mutation already bumps `breakpointsVersion`. Copying the panel would have bought nothing and cost an
IPC round trip per tick, per open sidebar, forever. The no-polling property is now a test, because
"make the badge more responsive" is exactly the change that would undo it.

**And ask it per *field*, not per panel: one panel usually has two kinds of staleness.**
`SysVarsPanel` fetched its variable *table* and a 64K memory snapshot on the same tick, and the
table can only ever have returned the descriptors it returned the tick before — it is static per
machine, so `machineId` is what invalidates it, while only the values need the timer. Two round
trips per tick where one was a constant. The shape to look for is a call inside a refresh whose
arguments never mention anything that moves.

**`useEmuStateListener` keys its subscription on the callback's identity**, so a plain inline
`async () => …` unsubscribes and re-subscribes on every render — on a panel that re-renders every
tick, that is every tick. Wrap the refresh in `useCallback` with the state it actually reads, and
the subscription then churns only when that state changes.

**Selector granularity is a re-render budget.** `useSelector((s) => s.watchExpressions || [])`
allocates a fresh `[]` on every state change while the list is empty, so referential equality never
matches. Correct for a panel that needs the items; wrong for a badge that needs the count. Select the
narrowest value that answers the question — a number compares by value.

**Do not use one word family for two different things in a design conversation.** "Shaded header"
for the header band and `.scrollShade` for the overflow shadow cost a full round trip when the author
said "the shade is too tall" and the wrong one was refined. Name the two things apart *before* asking
which one to change.

## A Surface That Declares No Type Inherits The 16px Root

The panel-leading trap has a twin, and the dialog work is where it surfaced: **a container that
declares no `font-size` runs on the 16px `<html>` root**, which is three steps off the top of the
10/11/12/13/15px scale. Dialog bodies are prose and bare `<div>`s — `RenameDialog`'s "Rename <name>
to:", `ConfirmDialog`'s lines, every hint under a field — and none of them set a size, so all of it
rendered a third larger than any other text in the app. `.dialogBody` now declares
`--font-size-300` and a `line-height`, and both belong there rather than in thirteen dialog bodies.

**Fixing the container moves every `em` inside it, which is the point and also the hazard.**
`RadioGroup`'s and `Checkbox`'s `0.9em` measured 14.4px against the root and 11.7px against the new
13px body — two different sizes, neither on the scale, from one unchanged declaration. That is
precisely what M1 exists to prevent, and the fix is the absolute token, never a re-tuned `em`.
**After changing an inherited size, measure the `em`-based descendants in the running app**; they
will have moved, and they will not have moved to anywhere you chose.

The controls that stayed `1em` — `LabeledGroup`, `AddressInput`, `LabeledSwitch` — live in toolbars
and document panels, not dialogs. They are still M1 violations waiting for whoever restyles those.

## One Focus Affordance, Never Two

The command prompt's rule generalizes: a control gets `@include focus-ring` **or** a focused
border/colour swap, not both. `Button` carried the ring *and* a `:focus` border swap; a first pass at
`TextInput` reintroduced exactly the same thing (ring + accent border), which draws a double blue
ring around a focused field. `[data-state="open"]` on a dropdown trigger is *not* a second focus
signal — open and focused are different states — so that pairing is fine.

Related, from the same pass: **`--console-ansi-*` is not a UI palette.** The danger button, four
dialog validation messages and one status badge were all drawing themselves from the ANSI table,
which is deliberately non-semantic *and identical in both tones* — so a light-theme error painted
itself in the dark theme's red. Errors are `--status-error`.

## A Toolbar Of Fixed-Size Controls Wraps; It Never Shrinks

`PanelHeader` was `display: flex` with a fixed `height` and no `flex-wrap`, so a narrow document
squashed its controls instead of overflowing: the NEX bank view's 104px view chooser came out a
character wide and its `$4000` offset dropdown showed `$`. Nothing in a panel header is elastic —
dropdowns, switches, an address box all have a size they need — so shrinking was never the right
answer for any of them.

`.panelHeader` now sets `flex-wrap: wrap` and trades `height` for `min-height`. That pairing is what
makes the change additive rather than a re-layout: a header that already fit one line still measures
exactly `--strip-panelHeader`, verified over CDP at 1800px and 1200px (31px including the border, as
before), and only a header that *was* overflowing grows — 2 lines at 900px, 4 at 700px.

The second half matters as much. **The unit that wraps must be a group, not a control.** Bare flex
children break wherever they like, which strands `Offset` at the end of one line with its dropdown at
the start of the next. `PanelHeaderGroup` (`controls/data`) is a `flex: 0 0 auto` row with
`flex-wrap: nowrap`: a label and the control it names go in one, and the line breaks between groups.
Its `& + &` margin carries the 12px that, with the header's own 4px gap, reproduces the 16px rhythm
the hand-placed `<LabelSeparator width={8} />` used to produce — so the spacers came out of the three
toolbars that had them, and a new toolbar gets the rhythm without remembering to add one.

Two smaller things from the same pass:

- **A group whose contents can vanish needs the group guarded, not just the contents.**
  `NexAnnotationToolbar` returns `null` when it has nothing to show; wrapping it unconditionally left
  an empty flex item still claiming the gap and the group margin.
- **Check a new switch's tooltip against the window edge.** `TooltipFactory` does not reposition, and
  the first wording here ("Show the machine's system variable names instead of 16-bit data
  addresses?") ran off the right of a narrow window. The neighbouring switches are all short
  questions — "Use decimal numbers?", "Disassemble RAM?" — and matching that length is the rule.

## A Menu-Like List With A Header

The navigation history popover (`features/navigation/NavigationHistoryPopover.tsx`) is the pattern for
a list that is chosen from like a menu but carries more than a menu row can: a title, a count, a
command, and two-line rows.

- **Body and frame take the dropdown-menu aliases** (`--bg-color-dropdown-menu`,
  `--border-color-dropdown-menu`, `--shadow-context-menu`, `--radius-md`, `--z-menu`), the same as
  every other portalled menu. Row hover is `--bg-color-dropdown-menu-pointed`.
- **Header and footer take the dialog chrome idiom**: a flat `--surface-chrome` band at
  `--strip-panelHeader`, `--border-default` seams, and an 11px/600 uppercase title. A header in the
  overlay's own colour reads as the first row.
- **The accent lands once**: on the row the list is counted from (the current entry), as
  `--bg-color-dropdown-menu-selected` plus a 2px inset `--accent-solid` edge. The rows on the far side
  (Forward's) are dimmed with opacity on their text and icon only, so they stay choosable and their
  hover still reads.
- **Secondary text in a row is monospace at `--font-size-100`** — a line number, a source line. It
  tells position and preview apart from the title without adding a colour.
- **A reason or kind chip is outlined and neutral** (`--border-default`, `--radius-full`,
  `--font-size-50`). It labels the row; it is not a state, so it takes no hue.

**Do not give a narrow toolbar toggle `IconButton`'s `selected` state.** On a 12px-wide chevron the
selected ring comes out as a tall, thin outlined box that reads heavier than the arrows either side
of it. Open is shown by the popover itself.

## An Accordion Picker With A Detail Sheet

The Select Machine dialog (`appIde/dialogs/machineSelect/`) is the pattern for choosing one item from
a grouped catalogue while reading its facts.

- **The accordion rows take the panel-list idiom**: `--row-size-list` rows, `--surface-hover` on
  hover, and the selection as `--surface-selected` plus a 2px inset `--accent-solid` edge. Group
  headers are 600-weight rows with a `chevron-right` that rotates; a group with a single member is a
  *leaf* (selects, never expands), because a one-item accordion is a click that shows nothing.
- **Facts on the sheet are data values**: label in `--text-secondary`, value in
  `--color-state-value` monospace with tabular numbers, label column in `ch`. A unit conversion
  ("3.5 MHz" under "3,500,000 Hz") is a `--text-tertiary` note on its own line - inline, it wraps
  mid-phrase in a narrow column.
- **A user's mark (a favourite star) has its own fixed hue**: `--color-favorite` → `--mark-favorite`
  (gold, L1 `FAVORITE`). Not the accent, which would make "starred" and "selected" the same colour,
  and not a status hue - nothing is wrong or done.
- **Row actions that appear on hover take no width while hidden** (`display: none`, not
  `visibility: hidden`). Reserved-but-invisible buttons truncate the name in every row, to buy a
  steadier layout in the one row being pointed at.
- **Give every `Icon` in such a row `fill="currentColor"`** and colour it through a parent. Its
  default fill is white, which looks right in dark and vanishes in light; and it sets `color`
  inline on a markup icon's `<svg>`, so a selector on the `svg` itself never wins - colour a wrapper.
- **Variants of one machine are models in its section, never a new section**: the +2A/+3/+2E/+3E
  section holds eleven models (drives × ROM set). The row name carries what tells them apart
  ("ZX Spectrum +3 v4.0 (2 FDDs)", "(Spanish, 1 FDD)"), and the sheet's ROM line names the files, so
  the filter finds them by `v4.0`, `Spanish` or `spp3-41`.
- **A schematic drawing on a sheet uses surfaces, not the accent**: the outer area
  `--surface-canvas`, the inner area `--surface-active`, edges `--border-strong`. `--surface-stage`
  and `--surface-selected` are almost the same value in dark, so that pair draws nothing.

## A Preference Goes To Settings; A Strip's Parts Are Toggled From The Strip

The application menu holds commands; set-once preferences live in the Settings dialog
(`appIde/dialogs/settings/`, `.plans/MENU_REDESIGN_PLAN.md`). A value changed during a session
(sound, speed, the machine) may *also* get a control where the user is already looking, but the menu
keeps the command as the keyboard path.

- **A Settings row is a two-column grid**: label (title, then a `--font-size-200` tertiary
  description) and a control column of `minmax(24ch, 36ch)`. A switch row is one column with the
  box *first* (`Checkbox right`), so a page of switches reads as a checklist, not a ragged edge of
  boxes after labels of different lengths. Group titles reuse the uppercase `--font-size-100`
  secondary style of the Select Machine favourites header.
- **A dialog's scrolling pane scrolls in a `ScrollViewer`**, never with `overflow: auto`: the
  browser's own scrollbar is the one surface in the app that is not themed. Give the pane a
  non-scrolling cell (`display: flex; flex-direction: column; min-height: 0; overflow: hidden`)
  for the `ScrollViewer` to fill, and keep the padding on the content inside it, not on the cell.
- **"Was: <old menu path>" shows only while searching**, in `--accent-text`: it is how a user who
  remembers the old place finds the new one, and noise on a page they navigated to.
- **Accent choices are swatches, not a list**, painted from `ACCENTS[id].solid[tone]` — palette data,
  not a literal — with the selected one ringed in `--text-primary`.
- **A strip's own parts are toggled from that strip's context menu** (the emulator status bar:
  performance info, media strip, Layers strip). **Anchor such a menu to the strip** with
  `showAt(e.currentTarget)` and a `top-*` placement. A menu positioned at the click (`show(e)`)
  ignores the placement and hangs below the pointer — off the bottom of the window for a strip at
  the window's bottom edge.
- **A status-bar value that opens choices is a chip**: a borderless button that looks exactly like
  the label it replaced (`--color-statusbar-label`, `--font-size-100`) until hovered
  (`--surface-hover`). It must not read as a new control competing with the readouts beside it.
- **Judge a modal's fit from a window screenshot, never from `locator.screenshot()` of the dialog.**
  An element shot of the Settings dialog came out clipped on the right while the dialog fitted with
  room to spare; measure with `getBoundingClientRect` or shoot the whole window.

## A Bank Browser Has One Shell

`controls/bankBrowser/BankBrowser.tsx` is the browser for any file that holds banks — or anything
listed and popped out the same way: the tape viewer's blocks use it too. A new one (a `.sna`, a
cartridge) wraps it rather than copying `NexBankBrowser`.

- **An item that is not a bank says so through props, never a fork**: `itemNoun` ("Block") reaches
  the details title, aria labels, tooltips and the empty-filter text; `formatNumber` replaces the
  `$NN` (a caller's own form gets no decimal beside it); `viewsFor` narrows the pop-out views per
  item. **An item with no views has no pop-out controls at all** — not a disabled button — and its
  row keeps a placeholder the icon's width, so the rows' lengths still line up.
- **A problem with an item is a status chip, not an accent one** (`BankChip tone="warning" |
  "error"`: `--status-warning` / `--status-error`). The accent pair marks *kinds* of thing; a bad
  checksum or a block Klive does not play is a *state*, and painting it in the secondary accent would
  read as a third kind of place.
- **Content that belongs between the heading and the list goes in `beforeBody`** (the tape
  timeline), so it stays inside the browser's bounded height instead of pushing it.
- **Stacking is the default, side by side is a per-viewer choice** (`layout="sideBySide"`). The
  author wants the tape viewer's list and details side by side at any width; NEX and Z88 keep
  stacking below 96ch. Side by side keeps the list at a 30ch minimum and gives the details a 44ch
  minimum with horizontal scroll, so a narrow pane scrolls rather than squeezing either column.
  The override lives *after* the container query with one more class, so it wins inside it.
- **The details are a summary, the pop-out is the content.** The tape viewer's details show no
  BASIC listing and no byte preview (the author's call): a program shows its line count and a
  "Pop out the listing" link, code shows nothing of its bytes. A long listing in a side pane is
  neither readable nor scannable; the pop-out has the room and the tools.

- **The shell owns everything a user learns once**: the list's keyboard, double-click and the row's
  pop-out icon, the details' split "Pop out · *last view*" button, the chips, the fact list and the
  hint. Two viewers that differ there teach two habits for one action.
- **A group heading in the list is chrome, not a row** (`.groupHeader`: `--surface-chrome`,
  `--border-default` seam, 600 weight, a quieter `--font-size-100` meta line). It has no
  `role="option"`, takes no hover and is skipped by the keyboard, because it cannot be selected and
  must not look as if it could.
- **A chip names a place, not a state, so the secondary accent marks the second kind**: PC takes
  `--accent-text`; SP and the `.z88` viewer's segment chips (`SR0`–`SR3`, `$0000`) take
  `.chipAlt`. A breakpoint count that is not Klive's own (OZvm's, saved in the snapshot) is a plain
  chip — the `--color-breakpoint-binary` chip means a Klive breakpoint you can act on.
- **The shell imports nothing from a viewer.** If a render prop starts to need NEX or Z88 knowledge,
  the knowledge belongs in that viewer's wrapper.
- **Bounded, with its own scroll — not a sticky pane in a long page.** The browser is as tall as the
  viewer's visible area (`--bank-browser-height`, measured from the scroll viewport), and only the
  list and the details pane scroll, each in a thin-bar `ScrollViewer`. The first version let the list
  grow inside the viewer's scroll with the details `position: sticky`; it never stuck, because the
  body's `overflow: hidden` (for its rounded corners) was the box it stuck to, and scrolling to the
  last of 44 banks carried the selected bank off the top. **`overflow: hidden` on an ancestor kills
  `sticky`; round corners with `overflow: clip`**, which makes no scroll container.
- **A scroll area is a `ScrollViewer`, never bare `overflow: auto`.** The platform's scrollbar is an
  unthemed white strip in the dark tone; nothing in the app styles `::-webkit-scrollbar`.
- **A nested scroller must not hand the wheel on**: `overscroll-behavior: contain` on its overlay
  viewport (`[data-overlayscrollbars-viewport]`, the element that actually scrolls), or reaching the
  end of the list scrolls the viewer and the heading goes with it.
- **When probing a bounded list over CDP, aim the wheel at the pane, not the list.** Inside a
  scroller the listbox is the full-height *content*; its centre can be off screen, and the wheel then
  lands on whatever is there — which read as "the viewer scrolls" when the list was never touched.

## A Proportional Strip Colours By Importance, And Rings The Selection Outside

The tape viewer's timeline (`Tape/TapeTimeline.tsx`, tokens `--color-tape-segment-*` at L4) is a
bar whose segments are as wide as their share of a whole. What carries over to any strip like it:

- **Neutral by default, ordered by how much a segment matters to the reader**: the data a reader came
  for stands out of the track most (`--text-secondary`/`--text-tertiary`), the scaffolding around it
  least (headers `--border-strong`, tones `--border-default`, pauses `--surface-active`). **At most
  two hues**: the accent for the one kind the view decodes (BASIC), and the status error for the one
  kind that is a problem (a block Klive does not play — the same fact as the row's "not played"
  chip, so it takes the chip's colour).
- **A minimum width, paid for by the widest segments**: a 19-byte header next to a 40 KB block is a
  sub-pixel sliver otherwise. Keep the total exact, or the strip stops meaning "the whole".
- **The selection ring is drawn outside the bar and in `--text-primary`, never the accent**: inside
  a 2px segment it would cover the colour it is marking, and an accent ring vanishes on the one
  segment that is already accent.
- **It is not a second control.** No tab stop and `aria-hidden`: the list's keyboard moves the
  selection and the strip follows, so a screen reader is not told the list twice.

### A categorical bar that already spends both accents: fixed hues, named by its tooltip

The NEX bank browser's content mix (`NexBankBrowser.module.scss`, `.mix_*`) is the opposite case to
the tape timeline: every segment is a region *kind* the user chose, so each needs its own hue, and
the accent pair plus the warning hue are already spent on Code, Words and Bytes. New kinds take
**fixed (non-accent) hues aliased at L4** (`--color-nex-mix-copper` → `--status-success`,
`--color-nex-mix-dma` → `--mark-favorite`), never a literal and never `--status-info`, which *is*
the default blue accent's hue to the digit. Any fixed hue sits near some accent (green near teal,
gold near Ember), so the colour is only a cue: the bar's `aria-label`/`title` and the legend name
every segment. **Rare kinds are named only when present** (`mixLegendTypes`), so a typical bank's
legend does not grow a row of `0%` entries for every kind that exists.
When the fixed status hues run out too (text and graphics regions), **borrow the listing's syntax
hues**: `--color-nex-mix-text` → `--syntax-string`, `--color-nex-mix-graphic` → `--syntax-number`. A
string is a string in the bar as in the editor, and the syntax table is already held clear of the
keyword hue under all six accents, so the bar inherits that separation for free.

### A listing column sized for one row kind wraps the next kind into its neighbour

The disassembly row's instruction cell was a fixed `25ch`, which fits every Z80 instruction and a
four-value `.defb`. An annotated `.NEX` listing also lists `.dma`/`.copper` pragma rows up to ~40
characters, and a cell narrower than its text **wraps into the row below and overprints it** (rows
have a fixed height). A shared listing column is sized from the listing's own rows with a floor
(`deriveInstructionWidthCh`, like `deriveLabelWidthCh` and the comment column), so ordinary listings
are unchanged and every row's later columns still start at one x. Unit tests of row text cannot see
this; only the running app showed it.

## An Explainer Links Bytes To Meanings With One Highlight

The tape viewer's header explainer (`Tape/TapeHeaderBytes.tsx`) shows raw bytes above the fields
they form. What carries over to any "these bytes mean this" view:

- **One highlight, used in both places**: the field being explained takes `--accent-subtle` with an
  `--accent-border` edge and `--accent-text` for its bytes and its value — in the byte strip and in
  the field list alike, so the eye links them. Fields are otherwise told apart only by alternating two
  neutral surfaces (`--surface-raised`/`--surface-panel`); a colour per field would be a legend to
  learn for nineteen bytes.
- **Something is explained before anyone points**: start on the field the structure is mostly *for*
  (a program's autostart, code's load address). An empty explanation box teaches nothing and reads as
  broken.
- **The list is the accessible control, the strip is decoration**: field rows are buttons (focus and
  hover both select), the strip is `aria-hidden`, and the explanation is `aria-live="polite"`.
- **Wrap between groups, never inside one**: the strip is a flex-wrap of per-field groups, so a narrow
  pane keeps a ten-byte name or a two-byte word whole.
- **Do not show the same bytes twice**: a view that explains every byte drops the generic hex preview
  and anything that only applies to a payload ("List at", "n of data").

## A Listing Pane Pads Its Rows, Not Its Scroller

The BASIC listings (the live BASIC panel and the tape viewer's BASIC pop-out share
`BasicPanel.module.scss` `.item`) take `--space-4` inline and `--space-0_5` block padding **on each
row**, so every line, including a long line's wrapped continuation, stays clear of the pane's edge.
The virtualized list (`virtua`) measures each row, so the padding is part of the row's height and
needs no row-height constant (M3). **The distance from the pane's top and bottom edges is on the
first and last row** (`.first`/`.last`, `--space-3`), not on the scroller: the shared
`VirtualizedList` has no content padding, and adding one would change every list that uses it. That
way it scrolls with the content, and the gap between lines stays the rows' own.

## The Spectrum's BRIGHT Lifts Ink And Paper Alike

Any renderer of a Spectrum attribute byte takes bit 6 into **both** colours: ink is
`(attr & 7) | ((attr & 0x40) >> 3)`, paper `(attr & 0x78) >> 3`, indexing a 16-entry palette. The
SCR viewer's `createScrPixelData` (now shared with the tape viewer's screen preview) gave it to
paper only, so bright text drew in the normal shade — wrong in a way that looks plausible.

## A Shared Control Can Be Invisible In One Of Its Two Homes

`BankDropdown` is a toolbar control that also appears inside the breakpoint dialog. Its borderless
`--surface-raised` trigger reads fine on a toolbar's `--surface-chrome` ground and disappears
completely on a dialog body, because both are `#ffffff` in light. **When a control has two hosts,
check it against the lighter one** — and note that `Dropdown` and `BankDropdown` are two components
with two stylesheets both exporting `.SelectTrigger`, so fixing one silently leaves the other.
That duplication is also a good way to waste a session: the element carrying the *other* component's
hashed class looks exactly like stale HMR.

## Prototype For Design Decisions, Never For Verification

The Phase 11 prototype loop worked well enough to repeat, and is worth separating from the
verification failure recorded above.

- **Build the replica out of the real tokens.** `sidebar-lab.html` lifted its palette from
  `palette.ts`/`semantic.ts`/`dimensions.ts` rather than eyeballed hexes, so colour judgements
  transferred to the app unchanged.
- **Restyle one markup skeleton per variant.** Every prototype was the same DOM with a different
  `data-v`, which is what made the comparison about the design rather than about the mock-up.
- **Add the controls the decision needs** — tone toggle, accent switcher, a live slider for the value
  under discussion, an A/B toggle for the effect. An author dragging a slider settles in seconds what
  costs several round trips to guess at.
- **Pre-render it; ship no JavaScript.** A prototype gets opened in whatever pane is to hand —
  a `file://` preview, a static snapshot host, a chat attachment — and several of those run no
  scripts and can't be driven by page tools. A JS-built gallery renders as a blank page in exactly
  the moment you need the author to look at it. Generate the variants with a script and write the
  finished HTML.
- **Put every tone on the page instead of behind a toggle.** Same reason, plus the author sees both
  at once, which is when a treatment that works in dark and dies in light becomes obvious.
- **Label each variant with its trade-off, not just its name.** The author is choosing, and the cost
  (vertical space, accent dependence, competition with zebra striping) is the half of the decision a
  picture can't show.
- **Include the current state as a labelled variant.** "A — Current" is what turns a gallery of
  options into a comparison, and it is also the cheapest way to discover the thing is not broken but
  merely invisible.
- **Draw "A — Current" through the real data and the real helpers, not an impression of them.** The
  Next palette panel's colour bug was found this way and by nothing else: the replica rendered the
  actual `PaletteDevice` power-on values through the actual `getCssStringForPaletteCode`, which put
  the app's ULA palette beside the Spectrum colours it is supposed to be, and they were visibly
  different. A screenshot of the shipped panel says nothing — wrong colours still look like colours.
  A replica built from an *idea* of the current state would have reproduced the idea.
- **Do not make the gallery scroll horizontally.** It was unreachable in the author's pane; wrapping
  into rows fixed it. The prototype's own usability is part of the deliverable.
- **Then throw it away.** It is a design artefact, not evidence, and leaving it around invites the
  next session to treat it as a reference.

## The Emulator Screen Is Fitted, Not Zoomed

The machine's picture has no zoom level the user sets. `useEmulatorScreen` measures the panel's
content box, takes the largest multiple of the machine's own screen that still fits on each axis,
and uses the smaller of the two. **The user-facing knob is the granularity of that snap**, which is
why View | Screen Zoom Steps offers *steps* (whole / half / quarter, default half) and names them
with their rungs inline — `Half Steps (1x, 1.5x, 2x)`. A label that said only "Half" would leave the
reader guessing half of *what*, and the menu is the only place it is ever explained. The ladder and
the arithmetic live in `common/settings/zoom-steps.ts` so the menu and the renderer cannot drift;
whole steps are that hook's original `Math.floor`, expressed as the coarsest rung rather than as a
separate path.

Two things follow for any later change here:

- **Only whole steps are pixel-exact on every display.** Half steps are exact at a device pixel
  ratio of 2, quarter steps only at 4; below that the intermediate rungs resample and read softer.
  That is the trade the finer steps exist to offer, so keep the whole-step option listed first as
  the one that never resamples — do not "improve" the default into a continuous fit.
- **Snap the ratio the user sees, not the machine's buffer.** `getAspectRatio` is not decoration:
  the Next's buffer is 640 pixels wide at an `xRatio` of 0.5, so its picture occupies 320. Snapping
  the raw buffer multiple and dividing the aspect out afterwards multiplies the grid by `1/xRatio`
  — half steps came out as whole ones on every Next machine, and the plain Spectrum (`[1, 1]`) was
  the one place the bug could not be seen. Fold the aspect ratio in *before* the snap. Any later
  quantization of this fit has the same trap waiting.
- **A fractional rung must be rounded before it reaches the canvas.** `canvasWidth`/`canvasHeight`
  become the element's `width`/`height` *attributes*, which are integers; an odd screen size or a
  non-unit aspect ratio can land a half or quarter step on a fraction, and an attribute that has to
  be parsed rather than scaled is a bug that only shows on one machine. Round at the point of
  setting state, never at the point of drawing.
- **The rounded display clip must never land on picture pixels.** `.display` has `--radius-md`
  corners and `overflow: hidden`. On a Spectrum the clip only eats emulated border, because the
  border is part of the picture. A picture with no border of its own (the Cambridge Z88's LCD) lost
  its corner pixels. Such a machine implements `getScreenSurroundColor()`. The display is then
  padded by `--radius-md` itself (`.surround`), the one amount that keeps the curve off the picture
  at any radius, in the colour the machine reports. `calculateDimensions` reads the same token and
  keeps the padding out of the fit. **Recordings carry it too**, as `RECORDING_SURROUND` machine
  pixels (`RecordingManager`), because video players round their windows' corners as well. The
  file's frame is what gets clipped there, so the surround has to be part of it.
- **`.display` is `content-box`, and must stay so.** Its inline `width`/`height` are the canvas's.
  Under the app-wide `border-box`, its 1px bezel border and any padding went *inside* that size, and
  the canvas overflowed its own clipping box. On every machine one picture pixel was lost on each
  edge, unnoticed for as long as the border was 1px. Anything added around the canvas goes outside
  the canvas size and is subtracted in the fit. The fit reads the border from the element; it is
  not a constant.
- **Reset per-machine display state to a sentinel, not to "none".** The surround colour is
  remembered so the DOM is only touched on a change. Resetting it to `undefined` on a machine switch
  meant a Spectrum, whose colour *is* `undefined`, never cleared the Z88's green. Only the running
  app showed it, in the Spectrum's corners. A value that can legitimately be absent needs a
  distinct "unknown".
- **The emulator window is sized from what the renderer measures; never pin it to a constant.**
  The old fixed 640x480 minimum kept a Z88 (a 640x64 LCD) from ever being compact. After each fit,
  `calculateDimensions` reports *hints*: the content needed for the picture at 1x (the
  minimum, since the fit never drops below 1x) and at the ratio just chosen (the *fit*). The chrome
  is the viewport minus the room the picture has now, so the toolbar, status bar, keyboard and slot
  strip are *measured*, and toggling any of them needs no code here. The main process adds page
  zoom and frame (`common/utils/emu-window-size.ts`, `main/emu-window-sizing.ts`) and uses the hints
  for the window's minimum, for View | Fit Window to Screen (the fit) and Fit Window to Screen at 1x
  (the minimum), and for per-machine sizes. Only the width keeps a floor (640, for the toolbar).
  - **The hints carry the machine ID, and a change of ID is the machine switch.** Main saves the
    window's normal size for the old machine and restores the new one's
    (`windowStates.emuMachineSizes`, also written on close). Switch detection lives on the report,
    not on a store subscription: only the report knows the renderer has laid the new machine out.
    So the hook re-reports on every `updateScreenDimensions` even when the sizes did not change.
  - **Hints are debounced.** A switch fits the new picture while the old machine's slot strip is
    still mounted, then refits. Sending the first fit would size the window for a strip about to go.
  - Electron sets a minimum but never grows a window already below it, so main grows it, and keeps
    any grown or restored window inside the display's work area.
- **Each machine has its own keyboard height** (`emuOptions.keyboardPanelHeights`, falling back to
  the last height set on any machine). `SplitPanel` takes a changed `initialPrimarySize` as the
  size to *restore* to as well: a size arriving while the panel is hidden used to be dropped.
- **A ref-held element that mounts late is invisible to `useResizeObserver`.** The hook depends on
  `[ref.current]`, read *during* render, so an element that first mounts in that same commit (the
  Z88 slot strip, set after the machine initializes) is not observed until some later re-render.
  The fit and the minimum ignored the strip until the user resized. `EmulatorPanel` refits in an
  effect keyed on the strip's content *and* on whether it is shown. Do the same for anything else
  conditionally rendered into the measured area.
- **Machine tool strips live in `appEmu/tool-registry.tsx` and share one card surface.** The Z88
  slot cards and the Spectrum media strip (`SpectrumMediaToolArea`) are the same device-surface card:
  `--bgcolor-display`, `--font-size-50`, the file or size in `--color-display-hilite`, an empty slot
  in dimmed `--color-display`, and insert/eject/replace as the 14px `@upload` / `@eject` / `@replace`
  images at the right (eject left of insert). A media card is a single line: the medium is named by
  its icon (`cassette-tape`; `floppy` plus the drive letter; `chip` for the Timex 2068's cartridge),
  not a caption. The letter badge is for disk drives only: a medium that is the only one of its kind
  shows its icon alone (deriving the badge from the card's title put a stray "e" after the cartridge).
- **A file name truncates at its start, not its end** — the end and the extension are what tell
  files apart. `direction: rtl` + `text-overflow: ellipsis` on the box puts the ellipsis on the left;
  the name goes inside a `<bdi>` so its own text stays left to right (without it, trailing brackets
  and dots get reordered by the bidi algorithm).
- **A strip the user can switch off names its setting in the registry entry** (`visibilitySetting`);
  `EmulatorPanel` then leaves the `.toolArea` wrapper out entirely rather than rendering it empty,
  because the wrapper's top margin is part of the height the screen fit reserves.

## Capturing The Mouse Over The Emulator Screen

**A control that captures the pointer cannot release it, and must not be labelled as if it could.**
While the pointer is locked every mouse event is delivered to the locked element, so the toolbar
button is physically unclickable at that moment — the click lands on the machine's screen. The
button captures and reports state; Esc and `Ctrl+M` release. Word it "Capture the mouse (Esc
releases it)", never as a toggle, and keep the on-screen pill naming Esc for as long as the lock is
held: with the cursor hidden and the toolbar out of reach, that pill is the only thing telling the
user how to get out.

**Where the capture can be triggered from is fixed by the browser, not by taste.** Pointer lock
needs transient activation, so only a real DOM event in the emulator renderer can start it — the
toolbar button or a renderer `keydown`. **And taking the cursor is never incidental:** capturing on
a click on the emulator picture was built and then removed, because clicking the picture is what
someone does to focus the window or dismiss an overlay. An action that hides the user's cursor has
to be one they aimed at. An Electron menu item or a main-process accelerator arrives
over IPC with no activation and can never capture, however convenient it would be to put it there.
For the same reason the toolbar reaches the screen through a module-level registration
(`features/emulator/mouseCaptureBridge.ts`, the shape `controls/overlay/dialogRequestBridge.ts`
already uses) rather than a store round trip: the request has to run inside the click being handled.

**Surface the re-capture lockout.** The spec rejects a capture made right after the user released
one with Esc, for about a second, *even with a fresh activation* — so Esc followed immediately by a
click always fails the first time. Swallowing that silently is what makes the app look broken; the
pill says "try again in a moment" instead.

**An indicator drawn over the screen goes in its own inert layer, never in `.overlayStack`.** That
stack is a flex column of pills anchored top-left whose children re-enable `pointer-events`; a freely
positioned marker cannot live there, and putting one there would let it swallow the clicks meant for
the screen underneath. Give it `position: absolute; inset: 0; pointer-events: none` of its own, and write
its position straight to the node's `transform` — it updates at display rate and must not re-render
React.

**Klive's pointer is not the machine's pointer, and must not be dressed as one.** While captured
there is no host cursor position at all, only deltas, so the indicator is a position Klive invents.
Software that reads the mouse draws its own pointer from its own counters and the two drift apart
within seconds — the machine scales by its DPI register, starts from its own origin, and its
counters wrap where this indicator clamps. Draw it as a ring and crosshair in the accent colour, not
as an arrow, and keep it switchable off; the intended end state is that it hides itself whenever
software is actually reading the mouse ports.

**Two state rules that can both be true need an explicit winner — the specificity tie recorded
above, in its visible form.** The captured-pointer indicator has "software is using the mouse, fade
out" and "a button is held, fill in"; both are one class plus one attribute selector, so with the
fade written first a hidden indicator reappeared for exactly as long as a button was held. Worth
knowing because of how it presents: *the pointer only shows while I click*, which sounds like an
event-handling bug and sends you to the wrong file. Order the rules by which state should outrank
the other.

**A clever default that hides information is usually the wrong default.** That same indicator
originally hid itself whenever a program read the mouse ports, on the reasoning that the program
draws its own pointer and two pointers that disagree are worse than one. But the disagreement is the
thing a person is looking for when they suspect movement is being delivered wrongly, and an
indicator that disappears whenever software runs cannot be told from a broken one. Ship the visible
behaviour as the default and make the clever one an option.

**A dialog earns MVC by having async orchestration, not by being big.** The joystick bindings
dialog has two columns and twenty-four capture rows, which looks like the largest dialog in the app
and is still a plain one: it reads a setting, captures keystrokes and writes once on Save, with no
service calls to interleave or fail. `.docs/dialog-mvc-pattern.md` says the Intent/Event split is
"pure ceremony" for such a dialog, and it is right. What *did* deserve isolating was the rules —
which pin loses a key to which, what a binding costs the emulated keyboard, how far a reset reaches
— and those are pure functions in `common/settings/`, tested in the fast `node` project. That gets
the component down to a form with no decisions in it, which is what MVC is for, without the four
extra files.

**UI for a device belongs only to machines that have one.** The capture button is gated on
`MF_MOUSE_SUPPORT` in the machine registry, beside `MF_TAPE_SUPPORT`, rather than on a machine id.
A ZX Spectrum 48 has no pointing device, and a toolbar button offering to capture a mouse for it is
a promise the machine cannot keep.

## An Editor Diagnostic Marks The Text Its Compiler Can Vouch For

A compile error's squiggle covers the exact range only when the language says its compiler's
columns are exact (`exactErrorColumns` on the language provider, today `zxbas` for Klive BASIC) and
the error carries a real range (`endColumn > startColumn`). Every other error keeps the whole-line
mark, from the first non-blank character to the line's end: the Z80 assembler and the external
tools fill the column fields with values of mixed meaning (zero, end-inclusive, end-exclusive), and
a squiggle under the wrong token misleads more than one under the whole line. The inline message
badge is an `after` decoration and always sits at the line's end, whatever the squiggle covers — a
badge anchored to a narrowed range lands in the middle of the code.

**Monaco cuts any text run longer than 50 characters into separate spans**
(`splitLargeTokens` in `viewLineRenderer.js`, unconditional for left-to-right text), and every
piece carries the decoration's class. Styled as a pill, a long message therefore renders as several
pills, split mid-word. The stylesheet joins a piece to the same-class piece before it (no gap,
padding or rounding at the joint, via `+` and `:has(+ …)`), which is only safe because a line gets
**one badge per severity**, its messages joined with " • ": two separate badges of the same
severity side by side would fuse into one pill with no separator. Any inline decoration that styles
its text as a shape has the same problem.

## Recommended First Reading For UI Work

1. `../AGENTS.md`
2. This file.
3. `.plans/UI_MODERNIZATION_PLAN.md` §3 (token architecture and the five mandates), then the
   retrospective for whatever area you are touching — §10 for the secondary accent or the memory
   dump/disassembly colour, §11 for the sidebar, the overflow shadow, or either of the two sidebar
   extension points (`Activity.commands`, `SideBarPanelInfo.badge`).
4. `src/renderer/theming/tokens/` — the four layers, in order.

## Non-Negotiable Handoff Message

- Do not add a colour literal to a stylesheet or a `.tsx`. Alias it in L4 or add it to L1/L2.
- Do not add a hand-copied light-theme value. Light is derived.
- Do not add a component-private row height, `em` font-size, or px column width. M1/M2/M3 have tests.
- Do not let a container render prose without declaring its own `font-size` and `line-height`. The
  fallback is the 16px root, three steps off the scale, and nothing tells you.
- Do not give a control two focus affordances. `@include focus-ring` **or** a focused border swap.
- Do not trust a surface pair you have only checked in dark. `--surface-raised` and
  `--surface-overlay` are both `#ffffff` in light, and so is `--surface-canvas`.
- Do not reach for the secondary accent because something "needs more colour". It exists for one
  case: two things in the same view that must both read as accent-tied and clearly apart from each
  other. One accent-worthy thing in a view is `--accent-*`.
- Do not give a data panel colour beyond §5.2's neutral hierarchy on your own initiative. The memory
  dump, the disassembly view and the converted register/state panels are the exceptions, and **each
  one was asked for by the author, panel by panel** — none of them by drift.
- Do not spend the **console's** ANSI palette on a data panel. Two panels did:
  - `WatchPanel` filled its type icons with `--console-ansi-cyan`/`-bright-green`/`-bright-red` —
    three saturated hues marking a *type*, which is not state and which the glyph already says.
    Types went neutral; the one genuinely stateful thing — a watch that will not resolve — took
    `--status-warning`, for both its icon and its `<not found>` placeholder, so an unresolved row
    cannot be mistaken for data.
  - `BreakpointIndicator` painted its five type badges bright blue / green / magenta, where the hues
    were carrying read-versus-write. **Fix the glyphs first and the colour problem dissolves**: once
    the redrawn icons said it themselves (arrow up reads, arrow down writes, body says memory or
    port), one token — `--color-breakpoint-type`, the secondary accent — covered all five.
  - The **document and file-type registries** tinted every tab and tree icon from `--console-ansi-*`
    — 51 live fills across `documentPanelRegistry`, `fileTypeRegistry`, `specialDocuments` and
    `StaticMemoryDump`. This one is worth knowing in detail, because it looked like the one case
    where per-type colour is legitimate — a VS Code file icon theme — and was not one. **Test that
    defence before granting it**: a file icon theme's colour is identity, so it is stable, unique
    per type and consistent everywhere. These were seven hues over fifty entries; the same `vm`
    glyph in five colours; `code`+magenta and `chip`+magenta each used for *two* types; one hue on
    all ten image formats; and the most-opened tab of all, the code editor, neutral — the loudest
    colour on the rarest tabs. Measured with `contrastRatio`, four of the seven fell at or below
    3:1 on the light tab strip (`bright-green` 1.90:1, `bright-yellow` 1.88:1), and pairs sat
    within the 1.04:1 that §10.2 already called "the same colour side by side" (dark
    `bright-blue`/`bright-red` 1.06:1; light `bright-green`/`bright-yellow` 1.01:1). Every fill was
    deleted: the glyph carries the type, the filename beside it carries the rest, and the surface's
    own default — `--color-doc-icon` on tabs, `--fill-explorer-icon` in the tree — carries the
    colour. One neutral, 5.96:1 dark / 6.02:1 light, and it follows the accent where the ANSI
    palette never could. `test/theming/doc-icon-neutrality.test.ts` pins it, source text included,
    so a commented-out entry cannot smuggle the pattern back.
  - **The exemption that *is* real: baked artwork.** `@`-prefixed icons are images and ignore
    `fill` outright; several `assets/icons` SVGs (`file-project`, the `K` source-file badges) carry
    their own hex. Those are a genuine file icon theme and were deliberately left alone — a rule
    against tinting type icons must not be read as licence to strip them.
- **Icons are a system or they are noise.** The breakpoint set was a lightning bolt borrowed from
  another family plus four glyphs mixing solid slabs with hairline outlines, two of them with arrows
  clipped off the top edge. Redrawn on Lucide's grid (24×24, `stroke-width 2`, round caps,
  `currentColor`) as *container + direction*. The sprite editor's 23-glyph set followed the same
  grid. Practical notes for the next set:
  - **A feature-local set takes a feature prefix.** A `.svg` dropped in `renderer/assets/icons/`
    **overrides** the stock `icon-defs.ts` entry of the same name, app-wide. Five of the sprite
    editor's natural names — `pencil`, `circle-filled`, `zoom-in`, `zoom-out`, `copy` — collide with
    stock icons that are *in use elsewhere*, and `circle-filled` is the dirty-file dot in Open
    Editors, so overriding it would have silently redrawn that. `spr-*` makes the collision
    impossible rather than checking each name. Audit with the stock name list before choosing, and
    reuse an existing drop-in (`plus`) rather than drawing a second one.
  - **Lucide's `flip-horizontal`/`flip-vertical` do not survive 18px.** Two bracket outlines either
    side of a dotted axis collapse into "[:]" — unreadable, and worse, *indistinguishable from each
    other*, which is the one thing a pair of flip buttons must not be. A shape beside its mirror
    works: solid triangle one side, outline triangle the other, dashed axis between.
  - **An outline cursor at 18px is mostly empty space.** Fill the pointer glyph.
  - **At 16px a hairline notch disappears** — the memory pins are round dots (`h.01` with a round
    linecap), which survive. Line-tool endpoints needed `r=2.2`, not `1.7`, for the same reason.
  - **Render a contact sheet at the real size, in both tones, before wiring anything up.** Source
    review cannot tell you that a glyph reads as a slash or that two of them look the same; 18px on
    both grounds can, in one screenshot.
- Do not put horizontal padding on `DataRow`/`.dense` without the nested-row reset — the value
  components each render their own row, so it lands twice on register rows. § "Alignment In The
  Register Panels".
- **A prototype is for choosing a design; it is never evidence the change works.** Phase 11 shipped
  on a green suite and a compiled-CSS read, having twice told the author the running app could not
  be driven — while § "Verify Geometry In The Running App, Never In A Replica" documents the recipe.
  If the app is running without `--remoteDebuggingPort=9222`, ask for a relaunch.
- **Every portalled overlay gets `pointer-events: none`** unless it has content to interact with —
  and if it ever does, it needs hover-to-keep-open logic at the same time, because today `Tooltip`
  hides unconditionally on the anchor's `mouseleave`.
- **Verify in the running app, and relaunch it first.** Kill every app process and confirm port
  9222 is refused before launching, or the single-instance lock silently gives you the previous
  build to measure. Flaky measurements are usually HMR, not the code.
- **Compute every contrast ratio with `contrastRatio` from `theming/tokens/syntax.ts`.** Do not
  quote one from inspection, and do not cite a WCAG threshold for a divider, hairline or shadow —
  none applies to a non-text, non-control edge.
- **Do not retune a shared L4 alias to fix one caller.** List the surfaces it lands on; if they
  differ, split the token. `--color-panel-separator` (panels, `--border-strong`) and
  `--color-toolbar-separator` (toolbars, `--border-default`) are the worked example.
- **Before "adding" a visual element, check whether it is already rendered and merely invisible.**
  The panel section rules and `AttachedShadow` were both fully wired up and drawing nothing. Grep
  first; the fix is usually one token, not new markup.
- Before building an affordance that seems to be missing, **grep for it**. `AttachedShadow` had been
  rendering invisibly for the life of the project because its token pointed at a surface.
- **`offsetTop` and `position: absolute` are measured against *different* elements, and a component
  that mixes them will eventually land in the wrong place.** `offsetTop` is relative to the nearest
  ancestor with a `position`; an absolutely positioned box resolves against its *containing block*,
  which `transform`, `filter` and `contain` also establish without becoming an offset parent. They
  coincide by luck, not by rule. `AttachedShadow` copied a scroll container's
  `offsetTop`/`offsetLeft`/`offsetWidth` into inline styles and drew wherever that landed; because
  the shadow is invisible until the region scrolls, the failure presented as *"the fade jumps to the
  wrong place the moment I start scrolling"*. It also tracked size but not position, so a container
  that merely moved left the shadow behind. **If a box belongs to an element's edge, make it a child
  of that element and pin it with `top/left/right: 0`.** No measurement, no `ResizeObserver`, nothing
  to go stale - and a shared control shed one observer per scrollable region.
- **A percentage `max-height` on a grid item resolves against its grid area, not against the
  container you were picturing.** The sprite editor's sheet carried `max-height: 42%` from the flex
  layout that preceded it; as a grid item in a 132px track that became 42% *of 132px* — 55px, less
  than one 63px thumbnail. The row was clipped and a scrollbar appeared over it, which reads as
  broken rather than as scrollable. When a track owns a height, nothing inside it should have a
  second opinion; delete the old constraint rather than leaving both.
- **Scroll through `ScrollViewer`, not a bare `overflow: auto`.** The app's scrollbars are
  auto-hiding overlays that take **no** layout width; a native one is ~15px of permanent width and
  looks like nothing else in the window. In a 132px pane that is a seventh of the space, spent on
  something the rest of the app does not show at all.
- **A fixed-size, empty element in a nowrap flex row needs `flex: 0 0 auto`.** An empty div's
  automatic minimum size is zero, so it is the only item in a row of text labels that *can* shrink
  — and with the default `flex-shrink: 1` it absorbs the whole overflow the moment the pane gets
  narrow, collapsing to 0px while every label keeps its size. The sprite editor's 20px colour
  swatches did exactly this: right background colour, none of it left to see, and only below a
  certain pane width, which is why it survived every wide-window screenshot. Suspect this whenever
  something is "missing" but its row still has a gap where it should be; check the *measured* width,
  not the computed background.
- Do not give a badge a tone louder than `neutral` without a reason. A count is a fact.
- Run the visual check **in the running app over CDP**, not in a standalone replica of the CSS. A
  replica cannot show you the wrapper you did not model; this shipped two wrong "fixes" in one
  session. § "Verify Geometry In The Running App, Never In A Replica".
- Run the visual check. The token contract, row-size and syntax-palette tests catch structure, never
  appearance.
