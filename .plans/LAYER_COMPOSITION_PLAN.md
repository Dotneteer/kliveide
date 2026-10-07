# Layer Composition Plan: Toggling, Isolating and Probing the Next's Video Layers

Status: **done** (2026-10-06): Phases 1–7 implemented. Decisions D1–D11 and the §8 questions taken as
proposed. §9 records where the implementation departs from the text below, and the measurements
Phases 1 and 4 asked for.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.6**: toggle individual layers (ULA,
  Layer 2, sprites, tilemap) on and off in the emulator screen; show the priority order, the clip
  windows and transparency.
- A **pixel probe** that answers "which layer produced this pixel, and why did it win?", which is
  the question the toggles exist to answer.

Depends on [BEAM_POSITION_OVERLAY_PLAN.md](BEAM_POSITION_OVERLAY_PLAN.md) (G3.7) for the
emulator-screen overlay component (its D10). Benefits from, but does not need, the shared pieces of
[TILEMAP_INSPECTOR_PLAN.md](TILEMAP_INSPECTOR_PLAN.md) §4.6 (`clipWindows.ts`, `IndexedImageCanvas`).
The probe links to the Sprite, Tilemap and Layer 2 inspectors when they exist.

Hardware reference: `_input/next-fpga/` (`zxnext.vhd` for the mixer, the per-layer `.vhd` files).
The core's mixer is `zxnextUlaCompose` in `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`; the
independent mixer model is `test/zxnext-hw/layers/_mixer-model.ts`.

---

## 1. What is being added, and why

A Next picture is four layers mixed by one of eight priority modes (`$15` bits 4–2), two of them
blend modes, with the ULA/tilemap pair combined first (stencil, `$68` bit 0; tilemap above or below
per cell), the Layer 2 priority bit, a fallback colour (`$4A`), global transparency (`$14`) and four
clip windows (`$1A`, `$18`, `$19`, `$1B`). When a pixel is wrong, the user cannot tell which layer
produced it. ZEsarUX can switch layers off; nothing in Klive can.

### 1.1 What the core already gives (and what the roadmap's "L" assumed it did not)

The roadmap rated G3.6 **L** because "the C renderer must compose selectively". Research for this
plan found the core is closer than that:
- each layer is rendered into **its own buffer** (`zxnextLayerUla`, `zxnextLayerTm`, `zxnextLayerL2`,
  `zxnextLayerSpr`, `zxnext-ula.c:64-67`; 0 = transparent, else `0x8000 | RGB333` plus flags);
- **one function mixes them**, `zxnextUlaCompose` (`:1034-1186`), which already reads per-layer
  enables (`:1040-1043`).

So hiding a layer in the *live* picture is a mask in one place. What remains genuinely hard is the
*paused* picture (T3) and the per-pixel explanation (T5). The estimate below is **M for the live
toggles plus the panel, M for exact paused recompose and the probe**: M–L overall.

### 1.2 Decisions (proposed)

| # | Decision |
| --- | --- |
| D1 | **A debug layer mask in the mixer, never in the renderers.** Hiding a layer makes the mixer treat its pixels as transparent. The layer renderers still run, so **sprite collision and "too many sprites"**, which the sprite renderer computes, are unaffected (T1). |
| D2 | **The mask is debugging state, not machine state.** It lives in a volatile symbol (`ZXNEXT_VOLATILE_SYMBOLS`), is never saved in `.kls` state files, RZX recordings or snapshots, and resets when the IDE restarts. It survives machine reset and stop/start within a session (Q2). |
| D3 | **A hidden layer is always announced.** While any layer is hidden, the emulator screen shows a pill (`Layers: sprites hidden`), so a forgotten toggle is never mistaken for a program bug (T2). |
| D4 | **Three ways to toggle, one state:** a **Layers strip** under the emulator screen (the machine tool registry, `tool-registry.tsx`), a **Machine → ZX Spectrum Next → Layers** submenu, and an IDE command `layers [ula|l2|spr|tm|all] [on|off|solo]`. |
| D5 | **Solo, not just hide.** *Solo* shows one layer alone over a checker (transparent pixels visible), which is how users actually inspect a layer. *Show transparency* paints transparent pixels in a flag colour instead of the layer below. |
| D6 | **Paused toggles are exact.** While paused, a toggle recomposes the *current* picture — including mid-frame Copper changes — from **capture buffers** recorded while the frame was rendered (§4.3), not from the current registers. Without capture (§4.3 disabled), the next frame shows the change and the pill says *applies from the next frame*. |
| D7 | **A pixel probe.** With the probe on, hovering the paused screen shows, for that pixel: each layer's value (colour, transparent, or clipped), the mixer mode and blend in force *for that pixel*, the winner and the rule that chose it (`L2 priority bit`, `SLU: sprite over layer 2`, `stencil`, `fallback $4A`). Clicking opens the owning inspector at that point when it exists (tilemap cell, Layer 2 pixel, sprite list). |
| D8 | **Clip windows on the screen.** The four effective clip windows can be drawn on the emulator screen through the G3.7 overlay, each in its layer's colour, from the shared `clipWindows.ts`. |
| D9 | **A Layers document for the static picture.** A singleton `$layers` document shows the priority stack as a diagram for the current `$15` (and the blend mode), per-layer cards (enabled, clip, transparency, palette, the reason it might be invisible), and **one thumbnail per layer** from the capture buffers. |
| D10 | **One composition function, not two.** The per-pixel mixer body is factored out of `zxnextUlaCompose` into `zxnextComposePixel(params, ula, tm, l2, spr, &why)`; the live mixer, the paused recompose and the probe all call it. The TypeScript side never re-implements the mixer. |
| D11 | **The mixer refactor is guarded by what exists.** `test/zxnext-hw/layers/` (compositing, blend-and-border, fallback colour, against `_mixer-model.ts`) and the `test/visual/copper/` layer cases (`P01-layer-priorities`, `L01-layer2-transparency`, `P02-tilemap-merge`, `C10-transparency-per-line`) must pass unchanged before any UI exists. |

### 1.3 Out of scope

- Changing what the machine does: the mask never touches `$15`, `$68`, `$6B`, `$123B`, or the
  state-changing `zxnextSetLayer2Enabled` export.
- The 48K/128K cores (one layer) and the Timex modes.
- Recording a video with layers hidden is allowed (the recorder captures what is shown) and is not
  specially handled; the D3 pill is not part of the picture.

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Per-layer buffers and encoding | `zxnext-ula.c:58-67` (`OPAQUE 0x8000`, RGB333, `L2_PRIORITY 0x200`, `TM_BELOW 0x400`, `BORDER 0x800`); render target and row range `:42-48` |
| Layer renderers | ULA `:330/359/389` (clip `zxnextUlaIsClipped :308-310`, `$1A`); Layer 2 `:451/487/523` (`$18`); sprites `:728`, `:789-916` (`$19`); tilemap `:955-1023` (`$1B`) |
| Render driver | `zxnextUlaRenderInstantScreen :1206-1247` (ULA always rendered; others only when enabled, so a disabled layer's buffer is stale) |
| Mixer | `zxnextUlaCompose :1034-1186`: inputs `:1037-1046`, fast path `:1050-1061`, ULA/tilemap combination and stencil `:1069-1089`, border rule `:1100`, priority switch `:1102-1183` (blend 110/111 at `:1137-1182`), write-out `:1184` |
| Raster | `zxnextRasterRenderSpan :1436-1452` (renders whole rows into `zxnextRasterScratch`, copies the span), `zxnextRasterFinishFrame :1508`, video-NextReg catch-up `zxnext-nextreg.c:489-492` |
| Enables | tilemap `zxnext-tilemap.c:53-54`; sprites `zxnext-sprites.c:92-97`; Layer 2 `zxnext-layer2.c:85-86, 129`; `$68` `zxnext-ula.c:1278-1289` |
| Clip exports | `zxnext.c`: `zxnextGetUlaClip :611`, `...Layer2Clip :626`, `...TilemapClip :643`, `...SpriteClip :658` |
| Volatile symbols | `scripts/build-zxnext-wasm.cjs:18-43`; the per-layer buffers and `zxnextRasterScratch` are **not** volatile today |
| Host-pushed debug tables (precedent) | NextReg/Copper watch arrays and pointer exports, `zxnext.c:57-105`, `zxnextCopperWatchPtr :539` |
| Emulator window | `EmulatorPanel.tsx` (`EmulatorOverlay` pills `:457`), `appEmu/tool-registry.tsx:25-38` (no Next entry yet), Next menus `main/machine-menus/zx-next-menus.ts` |
| Tests | `test/zxnext-hw/layers/` (`_mixer-model.ts`, `compositing`, `blend-and-border`, `fallback-colour`); `test/visual/copper/` layer cases; `test/wasm/state/machine-state-determinism.test.ts` |

---

## 3. The traps

1. **T1: Masking in the renderers would change the program.** The sprite renderer computes the
   collision and "too many" flags the program reads through `$303B`. Skipping a renderer to hide a
   layer would change machine behaviour. The mask is applied only in `zxnextComposePixel` (D1); a
   harness test reads `$303B` with sprites hidden and shown.
2. **T2: A forgotten toggle looks like a bug.** Hence D3's pill, the strip's highlighted state, and
   the mask being session-only (D2).
3. **T3: Recomposing from the current state is wrong after mid-frame changes.** The per-layer buffers
   hold, per row, the render of that row's *last* span, and the mixer reads `$15`, `$4A`, `$14`,
   `$68` and the enables from the current state. A Copper split that changes the priority mode or a
   palette mid-frame would be recomposed with the end-of-span values. Hence the capture (§4.3): the
   mixer inputs are recorded **per span**, and the layer pixels **per pixel**, as the raster renders.
4. **T4: Hiding the tilemap must not change the ULA/tilemap rules.** Clearing `tmEn` also switches
   "tilemap below" to `$6B` bit 0 and disables stencil (`:1044, :1078`). Hiding is "its pixels are
   transparent", not "the tilemap is disabled". Likewise the ULA mask is separate from `ulaEn`,
   because the blend modes read the ULA mix even when `$68` bit 7 is set (`:1069-1071`).
5. **T5: "Why did it win" depends on the per-pixel mode.** The winner rule differs by mode, by the
   Layer 2 priority bit, by the border exception and by stencil. The probe takes the `why` code from
   `zxnextComposePixel` itself (D10), never from a TypeScript guess.
6. **T6: The capture costs memory and time.** Four `uint16` layers of 720×288 are about 1.6 MB plus a
   span table. It is allocated in the WASM heap as volatile statics, and **filled only while
   capture is on** — that is, while the Layers strip, the `$layers` document or the probe is open.
   Phase 1 measures the frame-time cost with capture on and off.
7. **T7: The span table can overflow.** A Copper program writing a video register every line produces
   hundreds of spans per frame; a pathological one, thousands. The table is bounded (e.g. 4,096
   spans); on overflow the remaining pixels are tagged *approximate* and the probe and pill say so.
8. **T8: State-image hygiene.** The mask, the capture buffers, the span table and the probe output are
   all added to `ZXNEXT_VOLATILE_SYMBOLS`; `machine-state-determinism.test.ts` must pass with capture
   on and with a layer hidden, comparing everything except the output pixel buffer.
9. **T9: The fast path.** The mixer's fast path (`:1050`) skips the per-pixel switch when only the
   ULA can be opaque. With a mask, it must also respect "ULA hidden" (output the fallback colour) and
   "show transparency".

---

## 4. Design

### 4.1 Core: mask and the factored mixer (D1, D10)

- `zxnextLayerDebugMask` (volatile `uint8`): bits for ULA, tilemap, Layer 2, sprites; plus
  `zxnextLayerDebugSolo` and `zxnextLayerDebugShowTransparent`. Set through
  `zxnextSetLayerDebug(mask, solo, flags)`; read with `zxnextGetLayerDebug()`.
- `zxnextComposePixel(const ZxnextMixParams*, ula, tm, l2, spr, uint8_t* why)` holds the body of the
  priority switch; `zxnextUlaCompose` builds `ZxnextMixParams` once per call (as today) and loops.
  The mask turns a hidden layer's pixel into 0 *before* the call (T4); solo bypasses the mixer and
  outputs the layer over a checker index; show-transparency substitutes a flag colour for
  transparent results.
- `why` codes: `ULA`, `TM`, `L2`, `L2_PRIORITY`, `SPR`, `BORDER`, `STENCIL`, `BLEND_ADD`,
  `BLEND_SUB`, `FALLBACK`, `HIDDEN_BY_MASK`.

### 4.2 Paused recompose without capture (Phase 2 fallback)

`zxnextRecomposeForDebug()` re-runs the mixer over the existing per-layer buffers with the current
registers and the mask, into a **volatile preview buffer** (the one G3.7 introduces), never into
`zxnextPixelBuffer`. The result is labelled *approximate* (T3). This is what ships before §4.3, and
what is used when capture is off.

### 4.3 Capture (D6, T3, T6, T7)

When `zxnextLayerCaptureOn`:
- `zxnextRasterRenderSpan` also copies `[start, end)` of each per-layer buffer into
  `zxnextCapUla/Tm/L2/Spr` (volatile), and appends `{ startPixel, ZxnextMixParams }` to
  `zxnextCapSpans` (bounded, T7);
- `zxnextRecomposeForDebug()` then recomposes **exactly**: for each span, its own params. The
  pixels past the last span still hold the previous frame's capture (a span overwrites only its own
  range), so only the **span table** is double-buffered: the previous frame's spans are kept for the
  pixels not yet re-rendered. A paused picture is then exact on both sides of the beam, matching
  G3.7's fresh/stale split, with no extra pixel memory.
- `zxnextProbePixel(i)` returns the four layer values, the span's params and the `why` code into a
  small volatile struct.
- `zxnextGetLayerCapture(layer)` returns a pointer for the D9 thumbnails.

### 4.4 Machine and APIs

- `IZxNextIdeMachine`: `setLayerDebug`, `getLayerDebug`, `setLayerCapture(on)`,
  `recomposeForDebug()`, `probePixel(x, y)`, `getLayerThumbnails()`.
- The emulator window calls the machine directly (it owns it); the IDE goes through `EmuApi`
  (`setNextLayerDebug`, `getNextLayerState`, `probeNextPixel`) and `MainToEmuProcessor`.
- The mask and solo state are mirrored into the app state so the strip, the menu (checked items)
  and the command stay in sync. They are **not** global settings (D2).

### 4.5 UI

- **Layers strip** (emulator window, a Next entry in `machineEmuToolRegistry`, visibility via a
  setting): four toggle chips in priority order for the current `$15` (`S › L › U`, re-ordered live),
  each with hide/solo; a *transparency* toggle; a *clips* toggle (D8); a *probe* toggle (D7); and the
  blend mode name when `$15` selects 110/111.
- **Pill** (D3) through `EmulatorOverlay`.
- **Overlay** (through G3.7's `EmulatorScreenOverlay`): clip windows (D8) and the probe tooltip (D7).
- **`$layers` document** (D9): the priority diagram, per-layer cards with "why it might be
  invisible" (disabled, clipped to nothing, all transparent, hidden by the debug mask), and the four
  thumbnails plus the composite, each clickable to solo that layer on the screen. Opened by
  `show-layers` (`shly`) and the Next submenu.
- Theme tokens for the four layer colours (used by the strip, the clip outlines and the thumbnails'
  frames) as L4 aliases; `.ai/ui-theming-intent-and-lessons.md` records them (standing rule).

---

## 5. Phases

**Phase 1: factor the mixer (no behaviour change).** D10: `ZxnextMixParams` and
`zxnextComposePixel`, `why` codes computed but unused. Guard: D11's suites pass unchanged; frame-time
benchmark before and after (the mixer is hot; the refactor must not slow it measurably).

**Phase 2: the mask and approximate paused recompose.** §4.1, §4.2. Harness tests in
`test/zxnext-hw/layers/debug-mask.test.ts` (registered in `build/e2e-tests.ts`), with
`session.setLayerDebug()`:
- hiding each layer gives the same picture as the program with that layer disabled — except the
  T4 cases, which are tested explicitly (stencil, tilemap below);
- `$303B` collision and *too many* are identical with sprites hidden (T1);
- the determinism test passes with a layer hidden (T8);
- `_mixer-model.ts` gains a mask parameter and agrees with the core.

**Phase 3: emulator-window UI.** The strip, the pill, the menu, the `layers` command, clip outlines
(needs G3.7's overlay). jsdom tests for the strip's model (priority order per `$15`, blend names) and
command parsing. Verify in the running app (CDP recipe); update the theming notes.

**Phase 4: capture and exact recompose.** §4.3. Harness tests: a Copper program that changes `$15`,
`$4A` and the Layer 2 palette offset mid-frame; stop mid-frame; the recompose with an empty mask
equals `zxnextPixelBuffer` **pixel for pixel** on both sides of the beam; span overflow is reported
(T7); frame-time cost with capture on is measured and recorded here.

**Phase 5: the probe.** §4.3 `probePixel`, the overlay tooltip, links into the inspectors that exist.
Tests: the `why` code for each mixer mode against `_mixer-model.ts`.

**Phase 6: the `$layers` document.** D9, with jsdom tests of the card model.

**Phase 7: docs, roadmap and verification.** A "Layers" section with generated screenshots (solo
Layer 2, a probe tooltip on a Copper-split frame), `commands-reference`, `doc:build`/`doc:check`;
mark G3.6 done and correct its size note in `CLOSING_THE_GAPS_PLAN.md`; update §2/§4 of
`LANDING_PAGE_COMPETITIVE_ANALYSIS.md`; `build:check`, `lint:renderer`, the Vite build.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| Mixer refactor | 1 | S |
| Mask, approximate recompose | 2 | S |
| Emulator-window UI | 3 | S–M |
| Capture and exact recompose | 4 | M |
| Probe | 5 | S–M |
| Layers document | 6 | S–M |
| Docs and verification | 7 | S |

About **M–L**. Phases 1–3 alone (live toggles, solo, clip outlines) are an **M** milestone that
delivers the roadmap's headline and can ship on their own.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| The mixer refactor changes pixels or slows frames | Phase 1 is refactor-only, guarded by the layer suites, the visual cases and a benchmark |
| Debugging changes the program (collisions, state files) | D1/T1 mask in the mixer only; D2/T8 volatile state and determinism tests |
| Capture is too slow or too large | On only while a consumer is open (T6); measured in Phase 4; bounded spans (T7) |
| Users forget a hidden layer | D3 pill; session-only state |
| The probe's explanation drifts from the mixer | D10: the `why` comes from the same function |

---

## 8. Open questions (proposed answers)

| # | Question | Proposed answer |
| --- | --- | --- |
| Q1 | Ship Phases 1–3 as their own release before capture? | Yes; it is the visible feature, and capture is an exactness upgrade |
| Q2 | Should the mask survive a machine reset? | Yes within the session (the user is debugging the same program); never across IDE restarts |
| Q3 | Is the Layers strip shown by default on the Next? | No; it appears when the user toggles a layer or opens it from the menu, and its visibility is a setting |
| Q4 | Let the probe also name the sprite slot under a sprite pixel? | Later: the sprite buffer holds colours, not slots; it needs a per-pixel slot capture, a Sprite Inspector follow-up |
| Q5 | Capture always on while paused, or only with a consumer open? | Only with a consumer open (T6) |

---

## 9. Implementation notes (2026-10-06)

Where the shipped code differs from §1–§5, and why:

- **G3.6 landed before G3.7.** The plan assumed G3.7's paused-preview buffer and screen overlay
  (§4.2, D8). They did not exist, so this plan built them: `zxnextLayerPreview` (volatile), shown by
  `ZxNextWasmV2Machine.getPixelBuffer()` / `getPixelBufferBytes()` from a recompose until the machine
  next executes (`dropLayerPreview()`, any frame or instruction, a reset, a state load), and
  `NextLayersScreenOverlay`, an SVG in buffer coordinates over the canvas. G3.7 should reuse both
  (a note in `BEAM_POSITION_OVERLAY_PLAN.md` says so).
- **The "why" travels in `zxnextComposePixel`'s return value** (bits 12-15), not through a pointer.
  An out parameter whose address is taken lives on the shadow stack, which is in the state image: the
  T8 determinism test caught the probe leaving a byte there. For the same reason the debug functions
  use statics (`zxnextDebugMixParams`, `zxnextLayerAtSpanStart`) and never address-taken locals. A
  constant `withWhy` argument lets the live mixer fold the bookkeeping away.
- **Phase 1 benchmark** (all four layers on, 100-frame median, the harness): 2.05 ms/frame before,
  2.03 after. The first version with the packed "why" cost 2.17; the constant `withWhy` removed that.
- **Phase 4 cost**: capture on adds about 0.13 ms/frame (2.03 → 2.16 all layers; 1.06 → 1.20 ULA
  only), roughly 6-13%; a hidden layer costs about 0.1 ms (the debug loop masks every pixel, and
  with only the ULA on it gives up the fast path, T9).
- **Capture** dedups consecutive spans with identical mixer inputs, so a memory-write catch-up or a
  latch adds no span. The span table is double-buffered as planned; a table is "complete" only when
  capture was on from its frame's first pixel, so switching capture on mid-frame (or while paused)
  gives an *approximate* recompose until one whole frame is captured, and the pill says so. A
  reset or a state load/checkpoint restore invalidates the capture (`reapplyLayerDebug`). T7: 4,096
  spans a frame; a CPU loop writing `$4A` at 28 MHz overflows it in the test.
- **`HIDDEN_BY_MASK` is not a "why" code.** The probe composes each pixel twice, with and without the
  mask, and reports both winners (`why` / `machineWhy`); the tooltip says what the machine shows when
  they differ.
- **"Show transparency"** paints the pixels whose winner is the fallback (`$4A`) magenta; with a solo
  layer, that layer's transparent pixels instead of the checker. **Solo** shows the layer as the
  renderer drew it: the ULA even with `$68` bit 7 set (the blend modes read it), the other layers only
  while enabled (their buffers are not re-rendered while disabled).
- **Hiding is "transparent", exactly (T4)**: a hidden tile keeps its below bit, and stencil stays on,
  so hiding the tilemap in stencil mode hides the ULA too. Both are tested and documented.
- **The Layers document's composite** is composed by the core from the capture with no mask
  (`zxnextRenderLayerComposite`, 360 x 288: every other column, every row, which with square pixels
  is the screen's shape, since a buffer pixel is 0.5:1), not copied from the screen, which while running carries
  the mask.
- **The probe's click** opens the owning inspector through a narrow `MainApi.openNextInspector`
  (sprites, tilemap, Layer 2, or the Layers document for the ULA/fallback), never an arbitrary command.
  It opens the inspector, but does not yet select the tile cell or Layer 2 pixel under the probe
  (D7's "at that point"): the inspectors' reveal channels (`layer2Reveal`, the tilemap's) take a
  source, not a position. A follow-up, like Q4's sprite slot.
- **The strip has no "open document" button**: the emulator window cannot run IDE commands; the
  Machine → Layers submenu and `show-layers` do it.
- **Layer colours** are L4 aliases of the four status hues (`--color-layers-*`); see
  `.ai/ui-theming-intent-and-lessons.md`.
- **Tests**: `test/zxnext-hw/layers/debug-mask.test.ts` (Phase 2: the model with a mask for every
  order, hide = disable outside T4, both T4 cases, T1 `$303B`, solo, transparency, reset, approximate
  recompose), `capture-and-probe.test.ts` (Phases 4-6: exact recompose on both sides of the beam under
  a Copper split, its absence without capture, T7, state restore, the probe's colour and rule against
  `_mixer-model.ts`'s new `mixPixelExplained` for all eight orders with and without a mask, the
  composite), the T8 case in `machine-state-determinism.test.ts`, and the unit tier's
  `layerView.test.ts`, `layersDocumentModel.test.ts`, `LayersCommands.test.ts`. The running-app check
  and the screenshots are `scripts/doc-shots/recipes/layers.cjs`.

