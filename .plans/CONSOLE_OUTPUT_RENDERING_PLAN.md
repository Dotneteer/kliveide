# Console / Output Panel — Rendering Overhaul

**Status:** Complete — all three phases done, §3 bar met. Two follow-ups in §10.
**Created:** 2026-09-08
**Scope:** The shared console renderer `ConsoleOutput`, the buffer model behind it, and the IPC path
that feeds it. Four panels use the renderer — **Output**, **Command** (interactive), **Script
Output**, **Command Result**.
**Out of scope:** Monaco, the emulator canvas, the data panels, the ZX-BASIC look-alike buffer
(`BasicLine.ts`).

---

## 1. Decision

The work started from a request for a canvas console renderer, modelled on VS Code. **That approach
was evaluated and rejected.** Recorded here so it is not re-litigated:

- **The VS Code premise was half right.** Only the *Terminal* is GPU-rendered (xterm.js + WebGL; the
  2D-canvas renderer was superseded and is being removed). The *Output panel* is a read-only Monaco
  editor, and the *Debug Console* is a DOM tree widget (`vs/workbench/contrib/debug/browser/repl.ts`)
  that turns ANSI into DOM spans styled from `--vscode-repl-font-family` and friends. **The two
  surfaces Klive's Output panel is analogous to are DOM in VS Code too.** What makes them look right
  is not the paint technology — it is a strict cell grid on an integer line height, no mid-token
  wrapping, real ANSI handling, and spaces that are actually spaces.
- **Canvas would not have fixed the slowness**, because the slowness is upstream of paint (§2.3,
  §2.5). Feed a canvas renderer the same N synchronous change events and it repaints N times.
- **Canvas would have cost real accessibility.** Actionable navigation spans are currently real
  `<button>`s with the app's `focus-ring` mixin, asserted by an existing test. A canvas renderer
  loses keyboard reachability and screen-reader access unless both are hand-rebuilt.
- **xterm.js was rejected too**: its value is the escape-sequence state machine and PTY semantics,
  which Klive does not need, while its costs — bundle size, a cell buffer with nowhere to keep the
  `data`/`actionable` payloads behind navigation links, a second theming system to hold in sync with
  the token layer — all land on us.

**Chosen approach: fix the pipe and the DOM renderer.** It meets the whole acceptance bar in §3.

Two further decisions, settled at the same time:

- **Long lines wrap, terminal-style** — *revised 2026-09-08, after seeing it.* The first decision
  here was horizontal scrolling, on the reasoning that a wrapped hex dump is harder to scan than one
  you scroll. In the running app that was wrong: a console is read top-to-bottom, and a line you
  have to scroll sideways to finish is a line you do not read. So the console wraps the way a
  terminal does — every space preserved, and the break taken at the overflow column, inside a word
  if that is where the edge falls.
- **No ANSI/SGR parser.** Colour from external tools is *stripped at the source* (Phase 0), not
  preserved. Klive's own output is coloured structurally through the buffer API, which is richer than
  SGR and already works; a parser would exist solely to re-import colour we just chose to remove.

---

## 2. What is actually wrong today

Every item is read out of the source, not a style opinion.

### 2.1 Spaces are not spaces — the single biggest cause of the bad look

[`OutputPaneBuffer.write()`](src/renderer/appIde/ToolArea/OutputPaneBuffer.ts) does
`text: message.replaceAll(" ", "\xa0")`. Every space in every console line is U+00A0.

- **Copy emits NBSP.** And inconsistently: `CommandResult.tsx:47` **does** `replaceAll("\xa0", " ")`;
  the Output panel ([OutputPanel.tsx:75](src/renderer/appIde/ToolArea/OutputPanel.tsx:75)) and the
  Script Output panel (`:146`) do **not**. Two of the three copy buttons produce text that pastes
  into a shell or an editor as invisible non-breaking spaces.
- **Alignment depends on the fallback font.** NBSP only shares the space advance in a true monospace
  face. The stack is `Iosevka, Menlo, Monaco, Courier New, monospace`
  ([staticTokens.ts:26](src/renderer/theming/tokens/staticTokens.ts:26)); the moment a glyph falls
  back, columns drift.
- It exists to defeat HTML whitespace collapsing. The correct fix is `white-space: pre` — one CSS
  declaration, no data corruption.

### 2.2 Long lines are shredded, not wrapped or scrolled

`.outputLine { overflow-x: hidden; word-break: break-all; }` — `break-all` breaks **inside tokens at
arbitrary characters**, so a path, a hex-dump row or a diagnostic wraps into ragged fragments; and
`overflow-x: hidden` means there is no horizontal scroll to escape to. A terminal wraps at a *cell*
boundary or scrolls. Neither is on offer.

### 2.3 `contentsChanged` fires per span, and nothing batches it

`write()` fires on every call — per styled run, not per line. `LiteEvent.fire` is synchronous with
no coalescing. `refresh` then does `getContents().slice()` + `setLines` + `scrollToIndex`. Emitting
*N* runs costs **N O(n) array copies and N React commits**: O(N²).

`ScriptOutputPanel` compounds it with `onContentsChanged={() => setVersion(version + 1)}` (`:185`) —
a second full-panel re-render per span, from a stale closure, where `version` is never read for
anything but forcing the render. `ConsoleOutput` also recomputes `contentLength` every render and
uses it as an effect dependency (`:75-81`), so a second refresh path exists.

**Worst case is concrete:** `DisassemblyCommand.ts:103` allocates `new OutputPaneBuffer(0x1_0000)`
and writes **4 spans per instruction** (`:104-123`) — a full 64 K disassembly is ~80,000 change
events, each copying an array that grows toward 65,536 entries.

### 2.4 Latent bugs in the model

- **`CompositeOutputBuffer.contentsChanged` is a fresh `LiteEvent` that is never fired**
  ([CompositeOutputBuffer.ts:53](src/renderer/appIde/ToolArea/CompositeOutputBuffer.ts:53)). It only
  works today because composites are transient (`MainToIdeProcessor.ts:171`) and the underlying pane
  buffers fire their own events.
- **`maxLineLenght` (sic) is dead** — [OutputPaneBuffer.ts:31](src/renderer/appIde/ToolArea/OutputPaneBuffer.ts:31)
  is stored and never read. A single megabyte `write()` is kept verbatim; with `break-all` it becomes
  one virtualizer row thousands of pixels tall.
- **Ring-buffer trim uses `Array.shift()`** per line past the cap, and `_currentLineIndex` is never
  decremented, so after the cap it no longer tracks the true index.
- `getContents()` returns the **live internal array**, which is why the subscriber defensively
  `.slice()`s it on every event (§2.3).

### 2.5 The pipe: producers, IPC, and ANSI

**Producers.** Buffers are instantiated in only six places — `OuputPaneService.ts:20` (one per
registered pane: `emu`, `build`, `scripting`), `IdeCommandService.ts:24` and `:122`,
`ScriptService.ts:45,89`, `DisassemblyCommand.ts:103`. Writers group as:

- **Command infrastructure** — `ide-commands.ts:150-186` (`writeMessage`/`writeInfoMessage`/
  `writeSuccessMessage`, the most-used façade), `IdeCommandService.ts` (`help` at `:318-355` is many
  `write`/`bold`/`color`), `output-utils.ts` (`outputNavigateAction`, `writeErrorMessageWithLinks`).
- **~20 IDE commands** — Breakpoint/Watch/Setting/Machine/Document/Disassembly and friends. Several
  emit 3–7 spans per row of a list.
- **Build/compiler** — `CompilerCommand.ts:110-175` and `KliveCompilerCommands.ts:1064-1128` spend
  **7 buffer calls per diagnostic**; `Pasta80Commands.ts`; `script-packages/z88dk/Z88DK.ts` (runs in
  *main*, so its 7 calls are 7 IPC round trips).
- **Scripting** — `src/main/ksx-runner/ScriptConsole.ts`, every method an awaited
  `ideApi.scriptOutput`.
- **Emulator** — `MachineController.sendOutput` (`:731-749`, two messages per line),
  `registeredMachines.ts:49-64`, the Z88 port dialogs.

**IPC shape.** Two families on the generic API proxy, no dedicated output channel.
`displayOutput(OutputSpecification)` = one span, style re-sent in full each time (not sticky) —
`MainToIdeProcessor.ts:56-73`. `scriptOutput(id, operation, args)` = one `BufferOperation` per
message, style *is* stateful, so a styled line costs several — `:80-87` → `:256-301`. Neither is in
`UNBOUNDED_IDE_METHODS` (`IdeApi.ts:102-108`), so each allocates and clears a 60 s timer
([MessengerBase.ts:17](src/common/messaging/MessengerBase.ts:17)). A single `ScriptConsole.error("x")`
is **seven serial awaited round trips** (`pushStyle`, `resetStyle`, `color`, `write`, `write`,
`writeLine`, `popStyle`).

**ANSI: no decoder, encoder, or stripper exists anywhere.** No `strip-ansi`, no `chalk`; the only
`ansi` hits are the `--console-ansi-*` variable names. Colour is expressed structurally as
`OutputColor` strings on spans. But raw escape bytes **can** reach a buffer, through exactly one
door: [`CliRunner.ts`](src/main/cli-integration/CliRunner.ts).

- `:61` `await execa(...)` — fully buffered, no `FORCE_COLOR`/`NO_COLOR` handling, no TTY. Most tools
  self-disable colour without a TTY, but **nothing guarantees it**.
- On failure, `:91`/`:93` put execa's `error.message` into `failed` — and that message embeds the
  child's stdout *and* stderr verbatim. That flows to `Z88DK.ts:44-51` (`writeLine` per line) and to
  `CompilerCommand.ts:154` → `IdeCommandService.ts:241` `writeLines(...)`.
- SjasmPlus `DISPLAY` lines are lifted straight out of **stderr**
  (`script-packages/sjasm/sjasm.ts:252-281` → `SjasmPCompiler.ts:177` → `CompilerCommand.ts:137-146`).

So when a tool does emit colour, the escape bytes land in `OutputSpan.text`, render as literal
mojibake, **and `write()` NBSP-substitutes their spaces on the way in.**

### 2.6 Cosmetic / dead code

- [OutputPanel.module.scss](src/renderer/appIde/ToolArea/OutputPanel.module.scss) sets
  `font-size: 0.8em`, which **violates the repo's own M1 rule** (AGENTS.md: no `em` font sizes) and
  is silently overridden by `ConsoleOutput.module.scss`'s `--font-size-200`. It also defines an
  `.outputLine` nothing uses — the live one is in `ConsoleOutput.module.scss`.
- `spanStyle()` allocates a fresh style object per span per render; no memoisation.
- Rows are **dynamically measured** — `VirtualizedList` gets no `itemSize`, so every row goes through
  ResizeObserver despite a monospace console having one fixed row height.
- Only the **16 named colours** exist (`abstractions.ts` `OutputColor`) — no 256-colour, truecolour,
  dim, inverse or blink. **Accepted as-is**: every producer is Klive's own code choosing from that
  set, and with no SGR parser nothing else can ask for more.
- The palette itself is fine — [palette.ts:297](src/renderer/theming/tokens/palette.ts:297) is
  VS Code's own ANSI table, per tone. **Do not touch it.** The colours are not the problem.

---

## 3. Acceptance bar

Done means:

1. Copying console text yields ordinary U+0020 spaces, from **all three** copy buttons.
2. A line longer than the viewport wraps at the overflow column, terminal-style — never clipped,
   never scrolled sideways.
3. A column of digits down 40 lines aligns exactly, whatever font the stack resolves to.
4. A 64 K disassembly (~80,000 spans) renders without blocking the UI thread for more than a frame
   at a time, in time linear in the line count.
5. Bold/italic/underline/strikethrough/background all render.
6. Clickable navigation spans still work, still as real `<button>`s with the focus ring.
7. Light and dark both correct, and a theme switch repaints.
8. No garbled `ESC[...m` sequences in compiler or script output.

---

## 4. The seam

`ConsoleOutput` ([ConsoleOutput.tsx](src/renderer/appIde/DocumentPanels/helpers/ConsoleOutput.tsx))
is one component with exactly four consumers and a documented prop API:

| Consumer | Props |
|---|---|
| [OutputPanel.tsx:34](src/renderer/appIde/ToolArea/OutputPanel.tsx:34) | `buffer`, `followTail` |
| [CommandPanel.tsx:36](src/renderer/appIde/ToolArea/CommandPanel.tsx:36) | `buffer`, `followTail` |
| [CommandResult.tsx:59](src/renderer/appIde/DocumentPanels/CommandResult.tsx:59) | `buffer`, `initialTopPosition`, `onTopPositionChanged` |
| [ScriptOutputPanel.tsx:175](src/renderer/appIde/DocumentPanels/ScriptOutputPanel.tsx:175) | all six |

**This is why the work is affordable.** The prop surface stays byte-identical; only the inside of
`ConsoleOutput` changes, and no consumer needs a rewrite.

Precedence worth preserving ([ConsoleOutput.tsx:105-111](src/renderer/appIde/DocumentPanels/helpers/ConsoleOutput.tsx:105)):
a defined `initialTopPosition` beats `followTail`, and the first scroll is issued from `apiLoaded`,
not from the refresh effect.

`ScriptOutputPanel` and `CommandResult` persist `initialTopPosition` as a pixel offset from
`virtua`'s `getItemOffset(0)` into `documentHubService` view state. Keeping the DOM renderer means
those saved values stay valid — **no view-state migration is needed.**

---

## 5. Phases

Each is independently shippable.

### Phase 0 — Kill ANSI mojibake at the source — **DONE** *(2026-09-08)*

Satisfies §3.8.

- **`src/main/cli-integration/ansi.ts`** (new) — `stripAnsi`, covering three ECMA-48 families: CSI
  (the general grammar, so cursor/erase sequences go too, not only SGR), OSC (titles and `ESC]8`
  hyperlinks), and the general escape sequence. That last one is **wider than the popular
  `ansi-regex` package**, whose `0x40-0x5F` class lets the `ESC 7` / `ESC 8` cursor save-restore
  pair through — a progress indicator emits exactly that. There is a test for it.
- **`CliRunner.execute`** — child env gets `NO_COLOR=1` + `FORCE_COLOR=0`, merged over any `env` the
  caller passed (`ZxBasicCompiler` passes a `PATH`, which survives). Belt and braces: execa gives
  the child no TTY, but nothing guarantees a tool honours that.
- **The strip happens before the split, not on the way out.** `errorLineSplitterFn` and
  `parseErrorMessage` run the per-compiler regex over `stdout`/`stderr` to recover the filename,
  line and column behind a navigation link; a colourised filename silently stops matching. So the
  execa error is sanitized into a copy *once*, ahead of `errorDetectorFn`.
- **`failed: error.message` → `errorInfo.message`.** execa embeds the child's stdout and stderr
  verbatim in that message, which made it the widest of the three leak paths.

*Tests:* `test/main/cli-runner-ansi.test.ts` — 17 passing (14 new), running real child processes
rather than mocking execa, since what crosses the process boundary is the point. Covers SGR,
256-colour, truecolour, cursor/erase, `ESC 7`/`ESC 8`, OSC, the `NO_COLOR`/`FORCE_COLOR` env
actually reaching the child, caller env preservation, and an end-to-end case asserting a colourised
`main.asm:12:4: error:` still parses into a navigable diagnostic.

*Not run:* ESLint does not cover `src/main` (`lint:renderer` is scoped to `src/renderer`). Full node
project is green apart from a pre-existing, unrelated `test/theming/icon-registry.test.ts` failure,
verified to fail identically without this change.

### Phase 1 — The pipe — **DONE** *(2026-09-08)*

Satisfies §3.1 and §3.4; §3.3 and §3.5–3.7 are unchanged and still hold.

**1a. Model** — `OutputPaneBuffer.ts`, `CompositeOutputBuffer.ts`, `abstractions.ts`, new
`output-style-table.ts`

1. **Spaces are spaces.** `replaceAll(" ", "\xa0")` gone; `white-space` moved to the stylesheet.
2. **`contentsChanged` is coalesced** — `requestAnimationFrame` where there is one, a macrotask in
   the `node` test project. A burst of N writes is one notification. `revision` exposes the change
   count for consumers that need to know they are current, and `flushChanges()` forces a pending
   notification.
3. **`CompositeOutputBuffer` fires its own event.** Deliberately *not* by subscribing to children: a
   composite wraps long-lived pane buffers, so a subscription would keep it alive as long as the
   panes and would need a `dispose()` no caller has.
4. **`maxLineLength` enforced** (and spelled), with a visible `…[line truncated]` notice — the cut
   is announced, not silent.
5. **Block trimming** replaces the per-line `shift()`; `_currentLineIndex` is gone entirely, so the
   index can no longer drift from the buffer.
6. **Styles interned** into a module-level table. Ids are global, not per-buffer, because the
   renderer's memo cache is shared across all four panels — a per-buffer counter would have made id
   3 mean "red" in one pane and "bold cyan" in another.
7. **`getContents()` returns a stable snapshot**, so the consumer's defensive `.slice()` could go.

**1b. IPC** — `IdeApi.ts`, `MainToIdeProcessor.ts`, `ScriptConsole.ts`, `MachineController.ts`,
`registeredMachines.ts`

8. `displayOutputBatch` and `scriptOutputBatch` added. `ScriptConsole` now queues operations and
   flushes one batch per microtask: **a coloured line of script output went from seven awaited round
   trips to one.** The composite helpers (`error`, `warn`, `info`, `success`, `log`) had to stop
   awaiting mid-line to get this — an `await` in the middle yields to the microtask queue and flushes
   early. Both emulator log paths went from two messages to one.
9. **Not done: adding these to `UNBOUNDED_IDE_METHODS`.** The per-request timer was a symptom of the
   message *count*, which batching fixes; removing the timeout would drop a safety net to no further
   benefit.

**1c. Consumers**

10. `ScriptOutputPanel`'s counter kept but fixed. The plan said drop it; it turns out to feed the
    "Lines:" readout, so dropping it would have frozen that. It was a stale-closure `version + 1`,
    now `v => v + 1` — and with notifications coalesced it is a cheap counter rather than a
    per-span re-render pump. `saveViewState` on scroll is debounced (250 ms).

*Deviations worth knowing:*

- **`getBufferText()` now reads the same snapshot the renderer draws.** It walked the raw buffer,
  including the trailing line the cursor sits on, so every copy ended with a blank line that was
  never displayed. Copy and display now agree.
- **`getContents()` drops that trailing line**, which is what lets an explicitly blank line be
  `spans: []` and still get a height from CSS without a phantom row appearing at the end of every
  pane.
- **The blank-line height is `min-height: 1lh`, not a `rowSizes.ts` entry.** M3 governs heights that
  CSS *and JS* must agree on, and nothing in JS needs this until Phase 2's `itemSize`. Its floor is
  18px besides — right for a padded data row, ~20% too tall for a line of console text, and
  `test/theming/row-size-contract.test.ts` enforces it.

*Tests:* `test/controls/OutputPaneBuffer.test.ts` (21) and `test/main/script-console-batching.test.ts`
(9). Full node project 19,252 passing, jsdom 515 passing, `electron-vite build` clean. The one
failure, `test/theming/icon-registry.test.ts`, is pre-existing and unrelated (untracked `bp-*.svg`
icons in the working tree shadow stock entries).

### Phase 2 — Renderer — **DONE** *(2026-09-08, wrapping revised same day)*

Satisfies §3.2, §3.3 and §3.5. With Phases 0 and 1, the whole §3 bar is met.

1. **Terminal wrapping**: `white-space: pre-wrap` + `word-break: break-all` on `.outputLine`.
   Both are needed and they do different jobs — `pre-wrap` keeps runs of spaces and indentation
   while still allowing breaks (`pre` forbids breaking, `normal` collapses the spaces); `break-all`
   is what puts the break at the overflow column instead of the last word boundary.
   **`overflow-wrap: anywhere` is the near-miss**: it only splits a word that cannot fit on a line
   of its own, so `hello world` in eight columns gives `hello` / `world` where a terminal gives
   `hello wo` / `rld`.
2. **No horizontal scrolling**, and `overflow-x: hidden` stays off. These are mutually exclusive
   with wrapping — see the correction below.
3. **`line-height` and `min-height` pinned** to `--row-size-console`, so a wrapped line's rows are
   evenly spaced and an explicitly blank line still has a height. `min-height`, not `height`: a
   wrapped line is legitimately taller than one row.
4. Style memoisation — **already landed in Phase 1**.
5. Dead CSS deleted from `OutputPanel.module.scss`: the `em` font size (M1) and an `.outputLine`
   rule nothing used.

*Corrections to this plan's own claims:*

- **`scrollRowsHorizontally` and wrapping cannot coexist.** It sets `min-width: max-content` on
  virtua's row wrapper, so the row grows to whatever its content needs — the text never reaches a
  right edge and `break-all` never fires. Turning wrapping on meant turning that flag off, not
  adding to it.
- **`itemSize` is now omitted entirely.** It is virtua's hint for *unmeasured* rows, and it never
  stopped the per-row measurement the plan claimed it would. It was worth setting while every line
  was exactly one line box; with wrapping, a long line occupies several, so a flat hint would be
  wrong for exactly the lines whose height matters most. virtua's own guidance is to omit it and let
  sizes be estimated from measurements.
- **`rowSizes.console` stays** despite `itemSize` going: CSS uses it for the line height and JS uses
  it for the pixel overscan, so it is still the M3 CSS/JS pair. The contract test still separates
  padded rows (≥18px) from line-box-only rows (≥16px).
- **The sticky line-number gutter is moot** now that nothing scrolls horizontally.
- **`overscan` is in pixels, not rows.** `VirtualizedList` documents it as a row count but passes it
  to virtua's `bufferSize`, which is pixels — so the shared default of 25 is a 25-*pixel* buffer,
  under virtua's own 200px default and about 1.5 console lines. The console passes an explicit pixel
  value; the shared prop affects ~15 lists and is filed separately.

*Verified in the running app* (CDP recipe from `.ai/ui-theming-intent-and-lessons.md`), because none
of this is visible to a DOM test:

- A 404-character unbreakable token occupies **4 line boxes** (64px at 16px each) with
  `anyHorizontalOverflow: false` and row `scrollWidth` equal to the container's `clientWidth`.
- Computed style reads `white-space: pre-wrap`, `word-break: break-all`.
- A long multi-word line breaks **inside** a word — `…romeo sierra tang` / `o uniform victor…` —
  rather than moving `tango` whole to the next row. That is the behaviour `break-all` was chosen for.
- `?` help output keeps its two-space `usage:` indentation, confirming spaces survive the round trip
  through the buffer with no NBSP substitution.

*Tests:* `test/controls/ConsoleOutput.test.tsx` at 10 (4 new: that rows do **not** size to content,
that no `itemSize` is passed, the pixel overscan, and shared style objects for equal `styleId`s).
`test/theming/row-size-contract.test.ts` split into padded-row and line-box floors.

---

## 6. Testing

- **Model: pure unit tests** in the node project. Most new coverage lives here, and there is none
  today for `OutputPaneBuffer`, `CompositeOutputBuffer` or `writeErrorMessageWithLinks`.
- Extend [`test/controls/ConsoleOutput.test.tsx`](test/controls/ConsoleOutput.test.tsx) — its 6 tests
  cover `followTail`, the actionable `<button>`, the 1-based nav column, the `var(transparent)`
  regression and unmount cleanup, but **not** `showLineNo`, `initialTopPosition`,
  `onTopPositionChanged`, `onContentsChanged`, multi-span styling or large buffers.
- Add a batching test: N `write()` calls produce **one** `contentsChanged` flush, not N.
- Add a copy test asserting U+0020 from all three copy buttons.
- Add a `CliRunner` test asserting `ESC[...m` is stripped from `stdout`, `stderr` and the failure
  `error.message` (Phase 0).
- Add a no-wrap test: a row wider than the viewport keeps its full width rather than breaking.
- Fix `test/commands/test-helpers/mock-context.ts:15-26` — `createMockOutputBuffer()` is missing
  `writeLines`, `backgroundColor`, `strikethru`, `pushStyle`, `popStyle`, `getContents`,
  `getBufferText`, `contentsChanged`, and invents a non-existent `writeMessage`; it survives only via
  `as any`. The Phase 1 interface changes will surface this.
- Visual check in the running app via the CDP recipe in `.ai/ui-theming-intent-and-lessons.md`.

Type-check with `npx tsc --noEmit -p build/tsconfig.web.json` — **not** `npm run build:check`, which
AGENTS.md documents as a no-op. `npm run lint:renderer` for the React changes.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| IPC batching changes ordering between `displayOutput` and `scriptOutput` | Flush per pane in write order; add a test for interleaved emulator + script output |
| Batched `contentsChanged` makes `followTail` land a frame late, or miss the last line | Flush on rAF and re-evaluate sticky-bottom after the flush, not per write |
| Removing NBSP changes layout in panels tuned around it | Phase 2 lands `white-space: pre` in the same change; verify all four panels, not just Output |
| Style interning changes `OutputSpan` shape used by IPC and tests | Keep `OutputSpan` as the wire type; intern only inside the buffer |
| `maxLineLength` truncation hides output someone relied on | Explicit visible truncation marker, generous cap |
| `scrollRowsHorizontally` sets `minWidth: max-content` on the row wrapper, which its own doc comment warns changes how a row containing a `width: 100%` or flex-grow child measures | The console line has no such child today (`.lineNo` is `inline-block` with a `ch` min-width) — verify in the running app for all four panels before shipping |
| With no wrapping, the `showLineNo` gutter scrolls off to the left | Only `ScriptOutputPanel` sets `showLineNo`. Decide there: `position: sticky; left: 0` on `.lineNo` with an opaque background, matching how an editor gutter behaves |
| Palette churn | Do not touch `palette.ts`; the ANSI table is VS Code's and is already right |

---

## 8. Out of scope

A canvas or WebGL renderer, and xterm.js (§1). **An ANSI/SGR parser** — external colour is stripped
at the source, not preserved (§1), so 256-colour and truecolour stay out of `OutputColor` too.
Find-within-console; sixel/image output; a real PTY; changing the ANSI
colour values; Monaco; `BasicLine.ts`.

---

## 9. References a fresh session needs

- Renderer: `src/renderer/appIde/DocumentPanels/helpers/ConsoleOutput.tsx` (+ `.module.scss`)
- Model: `ToolArea/OutputPaneBuffer.ts`, `ToolArea/CompositeOutputBuffer.ts`, `ToolArea/abstractions.ts`
- Consumers: `ToolArea/OutputPanel.tsx`, `ToolArea/CommandPanel.tsx`,
  `DocumentPanels/ScriptOutputPanel.tsx`, `DocumentPanels/CommandResult.tsx`
- Pipe: `src/common/messaging/IdeApi.ts`, `MessageProxy.ts`, `MessengerBase.ts`,
  `src/renderer/appIde/MainToIdeProcessor.ts`, `src/main/ksx-runner/ScriptConsole.ts`
- External processes: `src/main/cli-integration/CliRunner.ts`
- Links: `src/common/utils/output-utils.ts` (`@navigate` payloads)
- Palette: `theming/tokens/palette.ts` §ANSI, `tokens/semantic.ts`
- Scrolling: `controls/VirtualizedList.tsx`, `controls/ScrollViewer.tsx`
- Tests: `test/controls/ConsoleOutput.test.tsx`, `test/commands/test-helpers/mock-context.ts`
- House rules: `AGENTS.md` (M1/M2/M3, token layers), `.ai/ui-theming-intent-and-lessons.md`

---

## 10. Follow-ups

The three decisions in §1 stand: DOM renderer (not canvas or xterm.js), horizontal scroll (not
wrapping), strip-at-source (not an SGR parser). Two things this work found but did not fix:

1. **`VirtualizedList`'s `overscan` is in pixels while its name and doc comment say rows.** Affects
   ~15 lists, not just the console. Filed as its own task.
2. **A per-panel wrap mode**, if the Commands panel or Command Result should ever differ from the
   Output panel. All four share `ConsoleOutput` and therefore wrap identically today; the earlier
   draft of this plan had wrapping as a prop, and reinstating it is a small change.
