# Beam Position Overlay Plan: Where the Raster Is on a Paused Screen

Status: **done** (2026-10-06). Phases 1–6 implemented; D1–D10 taken as proposed and the §8 questions
answered as proposed (on by default, render to the beam, redrawn at every stop, no "run to raster
position", no ZX80/81 or Z88). See "Outcome" below for where the implementation differs from the text.

## Outcome

What was built, and the places the design changed on contact with the code:

- **Next core (§4.2).** `zxnextGetBeamInfo()` (12 words: vc, hc, the timing, `zxnextRasterPixel`, the
  beam's pixel) and `zxnextRenderPreviewToBeam(keep)`, which renders `[zxnextRasterPixel, beam)` into
  the existing `zxnextLayerPreview` (`keep` 1 draws over a layer debug recompose). **T2 is settled by
  save and restore**, not by separate layer buffers: the rows of the four layer buffers the preview
  renders, the sprite line cuts and resolve cache and the latched ULA values are copied to volatile
  save areas and put back, and pending latches are applied at their own pixel without being consumed.
  The determinism test found one more leak: `zxnextUlaCompose` took the address of a local
  `ZxnextMixParams`, which lives on the shadow stack (linear memory, in the state image), and the
  preview composes from another call depth. It now uses the volatile static `zxnextLastMixParams`.
- **Spectrum cores (§4.3).** One `ulaBeamInfo(field)` in `zx-spectrum-ula.c` and two exports per
  core: `<core>GetBeamInfo(field)` and `<core>RenderToBeam()` (the ULA's own catch-up, neutral as T2
  says). The **Pentagon's tables are rotated 62 T** so that frame tact 0 is its interrupt; field 8
  reports that shift (`BeamTiming.lineStartTact`), or its raster would be 62 T off.
- **The contract (§4.1)** is `src/common/utils/beamGeometry.ts`: every machine's raster is linear in
  the *displayed* buffer (`firstVisibleTact`, `tactsPerLine`, `tactsPerBufferPixel`), the Spectrum's
  "left border drawn at the end of the line before" included. The Next's paper is at buffer y 48 at
  50 Hz but **24 at 60 Hz**: the paper position is reported, never assumed.
- **The overlay (§4.4, D10).** `EmulatorScreenOverlay` (an SVG in buffer pixels plus HTML labels)
  now carries both the beam overlay and G3.6's clip outlines and probe. The pill sits in the overlay
  stack (`BeamPositionPill`), not on the screen.
- **D7, the Copper marker**, uses the Copper's **breakpoint hit** (`getCopperState().lastHit`), not
  `beam`: the core advances the Copper to the CPU's tact after every instruction, so the Copper's
  "now" is always the CPU's beam. The hit is where it differs (Copper plan T1).
- **A paused picture is no longer overwritten.** `EmulatorPanel` restored the last full frame *into
  the machine's pixel buffer* at every pause (the Instant Screen toggle's restore ran on every
  machine-state change), which both hid T1 and changed the machine. It now restores only when Instant
  Screen is switched off while paused, from a snapshot taken when it was switched on; the per-frame
  copy that fed it is gone.
- **T6.** `MainToEmuProcessor.getUlaState` takes RAS/POS from `getBeamPosition` (`ulaRasterPosition`);
  `tactsInDisplayLine` is documented as not being a line length and left alone.
- **Tests.** `test/zxnext-hw/video/beam-position.test.ts` (every timing, render to the beam against
  the frame the machine then draws, byte-equal state images), `test/spectrum-hw/beam-position.test.ts`
  (48K, 128K, Pentagon, +2A, +3E, Timex: the linear raster against each core's tact → pixel table,
  render to the beam, determinism, and the ULA panel's RAS/POS through the real request path),
  `test/common/beamGeometry.test.ts`, `test/renderer/beamOverlayModel.test.ts`,
  `test/renderer/BeamPositionOverlay.test.tsx`, `test/commands/BeamCommands.test.ts`. The ULA panel
  check runs on the cores through `processMainToEmuMessages` rather than as a jsdom panel test.
- **Running app and docs.** `scripts/doc-shots/recipes/beam.cjs` (program `beam-demo.kz80.asm`)
  checks the overlay on the Next (pill, beam line at its row, hatch and legend, hover readout,
  `beam off`/`on`, the Copper marker at a `cu:` breakpoint) and the 48K (T-states, VBLANK) and takes
  the screenshot for the new page `docs/content/working-with-ide/beam-position.mdx`.

> **Note (2026-10-06):** G3.6 ([LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md)) landed first and
> brought two pieces this plan meant to introduce on the Next: a volatile paused-preview buffer
> (`zxnextLayerPreview`, shown through `ZxNextWasmV2Machine.getPixelBuffer()` until the machine runs)
> and an overlay over the emulator screen (`NextLayersScreenOverlay`, buffer coordinates through an
> SVG `viewBox`). The beam overlay should build on those rather than add a second of each, and the
> layer capture's `zxnextGetRasterPixel()` already reports the fresh/stale split for the Next.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.7**: show the raster position on the
  paused emulator screen, useful with the Copper and with the ULA panel's beam phase.
- It covers the **ZX Spectrum Next first** and then **the Spectrum family that shares
  `zx-spectrum-ula.c`** (48K, 128K, +2E/+3E, +2A/+3, Pentagon, Timex, Scorpion). ZX80/81 and Z88 are
  out of scope (Q5).
- It fixes the **ULA panel's RAS/POS values for the non-Next machines**, which are wrong today (T6).

This plan should land **before** [LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md) (G3.6): it
creates the emulator-screen overlay layer that G3.6 reuses for clip windows and the pixel probe.

Related plans:
- [COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md) §4.5, the raster ruler. That ruler lives in
  the Copper document and is "deliberately self-contained, so G3.7 can later reuse its beam data".
  This plan reuses the same `getCopperState().beam` for its Copper marker (§4.4) and adds no second
  Copper-position export.
- [SPRITE_INSPECTOR_PLAN.md](SPRITE_INSPECTOR_PLAN.md), [TILEMAP_INSPECTOR_PLAN.md](TILEMAP_INSPECTOR_PLAN.md),
  [LAYER2_INSPECTOR_PLAN.md](LAYER2_INSPECTOR_PLAN.md): no dependency either way.

Hardware references: `_input/next-fpga/src/video/zxula_timing.vhd` for the Next. The cores already
model timing; nothing about it changes.

---

## 1. What is being added, and why

Mid-frame effects — border stripes, Copper splits, palette changes per line, racing the beam to
update a sprite before it is drawn — are about *where the beam is* when an instruction runs. At a
breakpoint today the user sees:
- the ULA panel's FCL/RAS/POS numbers (on the Next; wrong on the other machines, T6);
- a picture that is **misleading in a way nothing indicates**: on every WASM core the screen is one
  buffer rendered lazily, so a paused frame shows *this* frame up to the last screen-changing write,
  then the *previous* frame's pixels for the rest, including the part the beam has already passed
  (T1).

ZEsarUX and Fuse-derived debuggers show the beam; DeZog shows it through ZEsarUX. Klive's
competitive analysis lists the Next inspectors (including this) as a gap.

### 1.1 Decisions (proposed)

| # | Decision |
| --- | --- |
| D1 | **An overlay on the emulator screen, shown while paused.** A thin horizontal line across the beam's row, a marker at its pixel, and a label pill (`line 123 · paper row 75 · hc 210 · T 56,088`). Hidden while running (the beam moves every frame; drawing it is noise). |
| D2 | **Fresh and stale are shown, not hidden.** The part of the picture past the beam belongs to the previous frame; the overlay dims it with a hatch. This is the most important thing the overlay says. |
| D3 | **"Render to beam" while paused.** Before drawing the overlay, the screen is brought up to the beam *without changing machine state* (T2), so "fresh" is exactly "everything the beam has drawn this frame". This is a third paused-picture mode beside the existing two ("as rendered", "Show Instant Screen"). |
| D4 | **One generic machine method.** `getBeamPosition?(): BeamPosition` on `IAnyMachine`, implemented by the Next and the shared Spectrum ULA. Machines without it simply show no overlay. The overlay never computes timing itself. |
| D5 | **Blanking is shown as an edge marker.** When the beam is in horizontal or vertical blanking (outside the visible buffer), the overlay pins a marker to the nearest edge with the region named (`HBLANK`, `VBLANK · 12 lines to the top border`). |
| D6 | **Hovering the paused screen answers "when will the beam get here?"** With the overlay on, the pointer shows that pixel's line, hc and frame tact, and the distance from the beam in T-states (or "already drawn"). This is the inverse mapping, a pure function of the `BeamPosition` timing fields. |
| D7 | **On the Next, the Copper gets a second marker** when it is running and its position differs from the CPU's (the Copper runs behind the CPU; Copper plan T1), using the Copper plan's beam data, in the secondary accent. |
| D8 | **A view setting, on by default.** `emuViewOptions.showBeamPosition`, in the View menu, the emulator toolbar, and a `beam on|off` IDE command. Saved with the IDE like the other view options. |
| D9 | **Colours are theme tokens.** The beam, the Copper marker, the hatch and the pill are L4 aliases in `theming/tokens/`, recorded in `.ai/ui-theming-intent-and-lessons.md`; no literals. |
| D10 | **The overlay layer is a reusable component.** `EmulatorScreenOverlay` takes buffer-space shapes (lines, rectangles, markers, hatches, labels) and maps them to the canvas; G3.6 adds its clip windows and probe through the same component. |

### 1.2 Out of scope, and the hooks left for later

- **"Run to this raster position"** (click the screen, run until the beam reaches it). It needs a
  frame-tact breakpoint in each core; D6's hover readout is its UI precursor. Proposed as a follow-up
  (Q4).
- **Copper WAIT lines on the screen**: the Copper plan's ruler shows them; drawing them over the
  picture is a later option on this overlay (the shapes API supports it).
- **ZX80/81 and Z88** (Q5).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Next beam counters | `zxnext.c:127-131` (`currentFrameTact` in 7 MHz HC units, `vc = fct / totalHc`, `hc = fct % totalHc`); timing table `zxnext.c:16-28`, chosen per frame in `zxnext-nextreg.c:229-259` (48K 448×312, 128K/+3 456×311, Pentagon 448×320; 60 Hz variants) |
| Next tact → pixel | `zxnextRasterTactToPixel`, `zxnext-ula.c:1420-1428` (row = `vc - firstVc`, x = `(hc - firstHc) * 2`); `zxnextTimingFirstVc`/`FirstHc`/`DisplayX/YStart` are **not exported** |
| Next raster | lazy beam-racing raster `zxnext-ula.c:1386-1558`: `zxnextRasterPixel` (first unrendered pixel), `zxnextRasterRenderSpan :1436-1452`, `zxnextRasterFinishFrame :1508`, `zxnextRasterMemoryWrite :1519-1531` (catches up only to the start of the beam's row) |
| Next exports | `zxnextGetCurrentFrameTact :377`, `zxnextGetTactsInFrame :378` (28 MHz units), `zxnextGetTimingTotalHc/Vc :380/384`, `zxnextGetUlaScanlineForTact`/`ColumnForTact :607-608`, `zxnextGetCopperBeam :686`, `zxnextGetCopperTiming :688`, `zxnextRenderInstantScreen :302-312` |
| Next TS | `ZxNextWasmV2Machine.getNextUlaState :1493-1517` (`nextRasterPosition`, `IZxNextIdeMachine.ts:71-74`), `getCopperState :1519-1535`, `renderInstantScreen :1402-1411`; trap: `tactsInDisplayLine :1383-1385` returns 720 pixels |
| Spectrum cores | `zxSpectrum/wasm/common/zx-spectrum-ula.c`: `renderUlaTact :374`, `renderUlaUntilCurrentTact :430-443` (static), `currentFrameTact :90-103`, the tact → pixel table `sp48RenderingPixelIndex` (`:303`, `calculateTimingBufferIndex :114-125`), exported as `sp48GetRenderingPixelIndex` (`sp48.c:962`), `sp128GetRenderingPixelIndex` (`sp128.c:2348`); `sp48GetScreenLineTime :918`, `GetRasterLines :914`, `GetFirstDisplayLine :930`, `GetFirstVisibleLine :934`, `GetFirstVisibleBorderTact :938`, `GetRenderingPhase :950`; loader `Sp48WasmV2Loader.ts:58-71, 249-262` |
| Generic interfaces | `IAnyCpu` (`currentFrameTact :58`, `tactsInFrame :63`, `tactsInDisplayLine :80`, unreliable as "per line", T6); `IAnyMachine` (`screenWidthInPixels :116`, `getAspectRatio :127`, `getPixelBuffer :144`, `renderInstantScreen :156`, `getBufferStartOffset :161`) |
| ULA panel | `appIde/SideBarPanels/UlaPanel.tsx:47-80` (FCL, FRM, RAS, POS, PIX); `MainToEmuProcessor.getUlaState :615-670` (Next branch `:622`; the RAS/POS bug at `:639-650`) |
| Emulator screen | `features/emulator/EmulatorPanel.tsx` (canvas `:465` in `.display` `:440-466`, `position: relative`; `EmulatorOverlay` pills `:457`; paused redraws on `frameCompleted` `:276-282`, instant screen `:230-245, 392-409`, `emuViewVersion :428-434`); `useEmulatorScreen.ts` (`calculateDimensions :146-249`, `displayScreenData :335-408`); stop path `MachineController.ts:1176-1182` (`fullFrame: false`) |
| Settings and menus | `setting-const.ts:1-30`, `setting-definitions.ts` (show instant screen `:113`); View menu `app-menu.ts:682-695`; toolbar `controls/ViewControls.tsx` (instant-screen button `:70-79`) |

---

## 3. The traps

1. **T1: A paused picture is not "pixels up to the beam".** It is this frame up to the last
   catch-up, followed by the previous frame. Plain CPU execution leaves the catch-up behind the beam
   by up to a whole frame. Drawing a beam line over that picture without D2/D3 would point at a row
   whose pixels are from the previous frame and so lie about what has been drawn.
2. **T2: Rendering to the beam must not change what the machine renders later.**
   - **Next:** advancing the real raster (`zxnextRasterCatchUp`) is *not* neutral. A later screen-
     memory write in the same row catches up only to the row start, so a mid-row catch-up by the IDE
     would make the rest of that row differ from an undebugged run. D3 therefore renders into a
     **separate, volatile preview buffer**: copy `zxnextPixelBuffer`, render
     `[zxnextRasterPixel, beamPixel)` into the copy with the current state, never touching
     `zxnextRasterPixel`. The renderers also rewrite the per-layer buffers (`zxnextLayerUla/Tm/L2/Spr`)
     and `zxnextRasterScratch`; those are rewritten by the next real span before they are read, but
     they are part of the state image today, so Phase 1 either renders the preview through separate
     layer buffers or proves (determinism test) that leaving them rewritten is harmless, and lists
     whichever buffers it touches in `ZXNEXT_VOLATILE_SYMBOLS`.
   - **Spectrum cores:** `renderUlaUntilCurrentTact` *is* neutral — rendering tact by tact uses the
     memory as it is now, which is what the beam saw, and any later write catches up first anyway. A
     new export calls it; a determinism test proves it.
3. **T3: Units differ per core.** The Next frame tact is in 7 MHz HC units, `tactsInFrame` in
   28 MHz units (`frameTactMultiplier = 8`); the Spectrum cores count 3.5 MHz T-states with 224 or
   228 per line. `BeamPosition` carries its own `tactsPerLine` and `linesPerFrame` and a unit label,
   and the overlay never mixes them.
4. **T4: Timing changes at run time on the Next.** The timing table is chosen per frame (48K, 128K,
   Pentagon, 50/60 Hz). The `BeamPosition` is read fresh at every stop; nothing is cached across a
   timing change. Never hard-code 311 lines or 456 HC.
5. **T5: Buffer pixels are not screen pixels.** The Next buffer is 720×288 shown at aspect
   `[0.5, 1]`; the Spectrum buffers start at `getBufferStartOffset()`. The overlay maps buffer space to
   canvas space with the same dimensions `useEmulatorScreen.calculateDimensions` uses (one shared
   function), so a zoom or resize can never misplace the line.
6. **T6: `tactsInDisplayLine` is not "tacts per line".** The Spectrum WASM machines return
   `screenWidthInPixels / 2` (176, not 224), `ZxSpectrumBase` returns `screenWidth`, the Next 720.
   `MainToEmuProcessor.getUlaState` divides by `screenWidthInPixels`, so the ULA panel's RAS/POS are
   wrong on every non-Next machine today. Phase 3 switches the panel to `getBeamPosition` and leaves
   `tactsInDisplayLine` alone (other code relies on it), with a comment saying what it is.
7. **T7: The Copper's position is not the CPU's.** The Copper runs behind the CPU and may have been
   stopped by its own breakpoint at an earlier tact. The second marker (D7) uses the Copper's own beam
   and is labelled, never merged with the CPU's.
8. **T8: Instant Screen wins.** With "Show Instant Screen" on, the picture is a whole-frame render of
   the current state, so "fresh/stale" means nothing. The overlay then draws the beam line only and
   says *instant screen* in the pill; D3 does not run.
9. **T9: Redraw only when paused state changes.** The paused screen is redrawn on `frameCompleted`
   and on `emuViewVersion`; the preview and overlay hook into the same points, not a timer.

---

## 4. Design

### 4.1 The `BeamPosition` contract (D4)

```ts
// src/renderer/abstractions/IAnyMachine.ts (optional method)
export type BeamPosition = {
  frameTact: number; unit: "T" | "HC";            // T3
  line: number; lineTact: number;                  // raster line and position in it
  tactsPerLine: number; linesPerFrame: number;
  firstVisibleLine: number; firstVisibleTact: number; tactsPerBufferPixel: number; // the inverse map (D6)
  paperTop: number; paperLeft: number;             // buffer pixels, for "paper row n"
  bufferX?: number; bufferY?: number;              // absent in blanking
  region: "paper" | "border" | "hblank" | "vblank";
  renderedUpTo: number;                            // buffer pixel index: fresh below, stale above (T1)
};
getBeamPosition?(): BeamPosition;
renderToBeamPreview?(): void;                      // D3; pixel buffer getters then return the preview
```

Pure helpers in `src/common/utils/beamGeometry.ts`: `pixelToTact`, `tactToPixel`, `regionOf`,
`tactsUntil(beam, pixel)` (D6), with tests per timing.

### 4.2 Next (core)

| Export | Purpose |
| --- | --- |
| `zxnextGetBeamInfo()` | Pointer to a small volatile struct: vc, hc, firstVc, firstHc, displayXStart, displayYStart, totalHc, totalVc, `zxnextRasterPixel` |
| `zxnextRenderPreviewToBeam()` | D3/T2: copy the pixel buffer to `zxnextPreviewBuffer` (volatile) and render `[zxnextRasterPixel, beam)` into it; returns its pointer. Does not touch `zxnextRasterPixel`. |

`ZxNextWasmV2Machine.getBeamPosition()` builds the contract from `zxnextGetBeamInfo`;
`renderToBeamPreview()` points the pixel-buffer view at the preview until the machine runs again.
`getNextUlaState` reuses the same struct.

### 4.3 Spectrum family (core)

`zx-spectrum-ula.c` gains a public `ulaRenderToCurrentTact()` export per machine (`sp48`, `sp128`,
`spp3e`, and the Timex core if it does not share the symbol) wrapping `renderUlaUntilCurrentTact`
(T2), and a `getBeamInfo` with the line time, raster lines, first display/visible line and first
visible border tact (most are already exported individually). `renderedUpTo` comes from
`sp48RenderingPixelIndex[lastRenderedTact]`.

### 4.4 The overlay (D1, D2, D5–D7, D10)

- **`EmulatorScreenOverlay`**: an absolutely positioned SVG over the canvas inside `.display`. It
  takes shapes in buffer space and maps them with the shared dimension function (T5). It ignores
  pointer events except where a feature asks for hover.
- **`useBeamOverlay`**: on pause (`frameCompleted` with the machine paused, and `emuViewVersion`),
  it calls `renderToBeamPreview()` (unless Instant Screen is on, T8), redraws the screen, reads
  `getBeamPosition()`, and produces shapes:
  - the beam row line and pixel marker (or the edge marker in blanking, D5);
  - the hatch over `[renderedUpTo, end)` (D2), with a small legend `previous frame`;
  - the pill (`line 123 · paper row 75 · hc 210 · T 56,088`, or with *instant screen*);
  - on the Next, the Copper marker when its beam differs (D7, T7).
- **Hover readout (D6)**: pointer position → buffer pixel → `pixelToTact` → `line · hc · T · in
  3,210 T` or `drawn`. Disabled when the pointer is captured for the Kempston mouse.
- **Resuming** removes the overlay and lets the normal frame loop overwrite the preview.

### 4.5 Settings, menu, command (D8)

`SETTING_EMU_SHOW_BEAM_POSITION` (`emuViewOptions.showBeamPosition`, default `true`, `saveWithIde`,
`boundTo: "emu"`); a View-menu checkbox beside *Show Instant Screen*; a toolbar toggle in
`ViewControls.tsx`; the IDE command `beam [on|off]`.

---

## 5. Phases

**Phase 1: Next core.** §4.2. Harness tests in `test/zxnext-hw/video/beam-position.test.ts`
(registered in `build/e2e-tests.ts`), with `session.beamPosition()`:
- `zxnextGetBeamInfo` agrees with the existing scanline/column exports and with
  `test/zxnext-hw/_timing-helpers.ts` for every timing (T4);
- the preview equals a full undebugged render of the same pixels when the run continues to the end
  of the frame — for a program that writes screen memory mid-row after the stop (T2);
- running a frame after a preview produces a state image identical to running it without one
  (`machine-state-determinism.test.ts` pattern), which settles the volatile-symbol question in T2.

**Phase 2: Spectrum cores.** §4.3, with harness tests in `test/harness/sp48/` (and 128K/+3E): the
same three properties.

**Phase 3: the contract and the ULA panel fix.** §4.1 on all implementing machines; `beamGeometry`
with `node` tests per timing; `MainToEmuProcessor.getUlaState` uses `getBeamPosition` for RAS/POS on
every machine (T6), with a jsdom test of the panel values for the 48K and the Next.

**Phase 4: the overlay.** `EmulatorScreenOverlay`, `useBeamOverlay`, the setting, menu item, toolbar
toggle and `beam` command. jsdom tests of the shape model (fresh/stale split, blanking edge marker,
Instant Screen case) and of the buffer → canvas mapping at several zooms. Verify in the running app
(CDP recipe) on the Next and the 48K; record the new tokens and the "stale picture" rule in
`.ai/ui-theming-intent-and-lessons.md` (a standing rule).

**Phase 5: hover readout and the Copper marker.** D6, D7, with pure tests for the readout text.

**Phase 6: docs, roadmap and verification.** A "Beam position" section in the emulator docs with a
generated screenshot (a Copper split stopped mid-frame), the `beam` command in `commands-reference`,
`doc:build`/`doc:check`; mark G3.7 done; update §2/§4 of `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`;
`build:check`, `lint:renderer`, the Vite build.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| Next exports and preview render | 1 | S |
| Spectrum exports | 2 | S |
| Contract, geometry, ULA panel fix | 3 | S |
| Overlay, setting, command | 4 | S–M |
| Hover readout, Copper marker | 5 | S |
| Docs and verification | 6 | S |

About **S–M**, as the roadmap estimated.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| The preview changes a later frame's picture (debugging changes the result) | T2: a separate volatile buffer on the Next; determinism and "continue to frame end" tests in Phases 1–2 |
| The overlay misaligns at some zoom or on one machine | One shared dimension function (T5); tests at several zooms |
| The hatch is mistaken for an emulator bug | The legend `previous frame` and a docs paragraph |
| Timing-dependent maths duplicated per machine | The core reports its timing (D4); TypeScript only maps |

---

## 8. Open questions (proposed answers)

| # | Question | Proposed answer |
| --- | --- | --- |
| Q1 | On by default? | Yes; it only appears when paused |
| Q2 | Render to the beam (D3) by default, or keep today's picture and only hatch? | Render to the beam: then "fresh" means exactly what the beam drew |
| Q3 | Show the overlay while stepping in quick succession (F10 held)? | Yes; it is redrawn per stop, which is the same cost as today's paused redraw |
| Q4 | Add "Run to this raster position" here? | No; a follow-up needing a frame-tact breakpoint in each core |
| Q5 | ZX80/81 (its display is CPU-generated) and Z88 (LCD, no beam)? | Out of scope; the ZX81's "beam" is a different concept and gets its own design if wanted |
