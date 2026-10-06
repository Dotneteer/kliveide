# Layer 2 Inspector Plan: the Live Layer 2 Image, Its Banks and Its Windows

Status: **done** (2026-10-06): Phases 1–7 implemented. Decisions D1–D10 and the §8 questions taken as
proposed. §9 records where the implementation departs from the text below, including two corrections
to the traps (T4, T7) and a core bug found on the way.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.5**: the current Layer 2 banks as an
  image at their resolution (256×192, 320×256, 640×256), with scroll and clip shown.
- A **correction to the roadmap**: G3.5 says it "reuses the `.sl2`/`.shr` viewers". Those viewers do
  not exist; `Sl2FileViewerPanel.tsx`, `ShrFileViewerPanel.tsx`, `ShcFileViewerPanel.tsx`,
  `SlrFileViewerPanel.tsx`, `VidFileViewerPanel.tsx` and `NxiFileEditorPanel.tsx` are 16-line stubs
  that show "Not implemented yet". Only `.sl2` and `.nxi` are Layer 2 formats (`.shr`/`.shc` are
  Timex ULA modes, `.slr` is LoRes). This plan builds the Layer 2 decoder once, and Phase 7 uses it to
  replace the `.sl2` and `.nxi` stubs (Q4).

Not in scope: the tilemap (G3.4, [TILEMAP_INSPECTOR_PLAN.md](TILEMAP_INSPECTOR_PLAN.md)), the
layer composition view (G3.6, [LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md)), the beam
overlay (G3.7, [BEAM_POSITION_OVERLAY_PLAN.md](BEAM_POSITION_OVERLAY_PLAN.md)), LoRes, and editing.

Related plans: the sibling G3 inspectors ([SPRITE_INSPECTOR_PLAN.md](SPRITE_INSPECTOR_PLAN.md),
[COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md), [TILEMAP_INSPECTOR_PLAN.md](TILEMAP_INSPECTOR_PLAN.md)).
This plan reuses the shared pieces listed in TILEMAP_INSPECTOR_PLAN.md §4.6 (the Next document
scaffolding and submenu, `clipWindows.ts`, `useNextDevicePalette`, `IndexedImageCanvas`);
whichever G3 inspector lands first creates them.

Hardware reference: `_input/next-fpga/src/video/layer2.vhd`. The C engine
`src/emu/machines/zxNext/wasm/zxnext/zxnext-layer2.c` (registers, port `$123B`) and the three Layer 2
passes in `zxnext-ula.c` already mirror it, and `test/zxnext-hw/layer2/_layer2-helpers.ts` is an
independent VHDL-derived model. The core is not changed except for the read-only exports in §4.2.

---

## 1. What is being added, and why

Layer 2 is the Next's bitmap layer: up to 80K of pixels in consecutive 16K banks, chosen by `$12`
(displayed) and `$13` (shadow), written through port `$123B`'s paging window or MMU. When the
picture is wrong, the usual causes are:
- **double buffering the wrong way round**: drawing into the displayed bank, or flipping `$12` and
  `$13` at the wrong time;
- the `$123B` write window mapped to the wrong 16K segment, or to the shadow bank when the program
  thinks it is the displayed one (bit 3), or the bank offset (bit 4 writes);
- the 320×256 and 640×256 modes being **column-major**, which surprises code written for 256×192;
- the palette offset (`$70` bits 3–0) and the second Layer 2 palette (`$43` bit 2);
- global transparency (`$14`) compared with the **RGB** of the palette entry, not with the index;
- the clip window (`$18`), whose X is doubled in the wide modes, and scroll (`$16`/`$71`, `$17`).

Klive shows **no runtime Layer 2 state**: the NEX viewer draws a 256×192 loading screen
(`controls/Next/Layer2Screen.tsx`), and the file viewers are stubs. `zxnextSetLayer2Enabled` exists
but changes machine state; nothing reads Layer 2 for the IDE.

### 1.1 Decisions (proposed)

| # | Decision |
| --- | --- |
| D1 | **One document.** A singleton special document `$layer2`, "Layer 2 Inspector", with an **Image** view, a **Banks** strip and an inspector pane. No side-bar panel. |
| D2 | **One snapshot, one read.** `NextLayer2State` carries the registers and **copies of the five 16K banks from `$12` and the five from `$13`** (up to 160K), read in one `getNextLayer2State()` call. It never goes through 8K `getMemoryContents` calls. |
| D3 | **Decoding is TypeScript, cross-checked twice**, as in the Tilemap plan: a pure `src/common/zxnext/layer2/layer2Decode.ts`, compared in a harness test with the core's Layer 2 pixels and with `_layer2-helpers.ts`. |
| D4 | **The Image view has three sources: *Displayed* (`$12`), *Shadow* (`$13`) and *Write window*** (the bank `$123B` currently maps for writes). Showing the shadow bank and the write target beside the displayed one is the point of the inspector: it answers "where are my writes going?" |
| D5 | **Two geometries: *Whole layer* and *As displayed*.** *Whole layer* shows the bank image unscrolled with the scroll and clip windows as outlines (default); *As displayed* applies scroll, wrap and clip so it matches the layer as it reaches the mixer. |
| D6 | **Every pixel resolves to an address.** Hover and selection give the pixel's byte as bank:offset, 8K page, physical address, and the Z80 address if it is currently mapped (MMU or the `$123B` window); the context menu opens the memory view there. |
| D7 | **The live palette comes from `useNextDevicePalette("layer2")`**, following `$43` bit 2, with pinning; transparency is shown by comparing the entry's RGB with `$14`, as the core does. No fallback palette. |
| D8 | **Read-only, and reading never disturbs the machine.** The `$123B` state comes from a peek export, not the port read. |
| D9 | **Refresh follows the state-panel cadence**, hidden-document gate, and a hash over the banks actually shown, so an idle program costs one hash per refresh. |
| D10 | **Priority pixels are visible.** Palette entries with the Layer 2 priority bit (which beats sprites and the ULA in most mixer modes) can be highlighted, because "why is this pixel on top of my sprite?" has no other answer in the IDE. |

### 1.2 Out of scope, and the hooks left for later

- **Per-line register changes (Copper splits of scroll, palette offset or `$12`).** The inspector
  shows the state at the stop; *As displayed* says so when the Copper is running. The exact per-row
  picture comes from G3.6's capture ([LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md) §4.3),
  whose pixel probe links back here.
- **Editing pixels**, and **export of the live layer** to a file (Q5).
- **LoRes**, whose state lives in the same C module but is a ULA-layer mode.

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Register state | `zxnext-layer2.c:3-23`: enable, `$12` active bank (reset 8), `$13` shadow (reset 11), port `$123B` fields (`UseShadowBank`, `Bank`, `BankOffset`, read/write mapping enables), `$70` resolution and palette offset, scroll X (9 bits, `$16` + `$71` bit 0) and Y (`$17`), clip window and index (`$18`, reset 0,255,0,191). Writes `:52-98` (`$69` bit 7 also enables, `:85-87`); reads `:100-121`; port `$123B` write `:123-134` (bit 4 selects the bank-offset write), read `:136-142`. |
| Global transparency, palette select | `$14` raw in `zxnextNextRegs[0x14]`, used at `zxnext-ula.c:463, 499, 535`; `$43` in `zxnext-palette.c:90-98` (bit 2 → palette 1 or 5, `GetLayer2Entry :167-169`); priority bit `0x200` at `:107-110` |
| Rendering | `zxnext-ula.c`: `zxnextUlaLayer2WrappedY :427`, `zxnextUlaLayer2WideWrappedX :431-438` (not a plain modulo, T4), `zxnextUlaReadLayer2Pixel :443-449` (2 MB limit, T5), 256×192 `:451-485`, 320×256 `:487-521` (column-major), 640×256 `:523-560` (4-bit, high nibble first); always displays `$12` (`:452`); dispatch `:1233-1239` |
| Existing exports | `zxnext.c:620-626`: `zxnextSetLayer2Enabled` (state-changing, never used here), `zxnextGetLayer2Enabled`, `...Resolution`, `...PaletteOffset`, `...ScrollX/Y`, `...Clip(i)`. No export for `$12`, `$13` or `$123B`. `ZxNextWasmV2Machine.ts:1690` hard-codes `portLayer2: 0` in the memory-mapping data. |
| Export plumbing | `build-zxnext-wasm.cjs` Layer 2 block `:234-240`; `ZxNextWasmV2Loader.ts` types `:177-183` |
| Physical memory | `runtime.memory`; Layer 2 RAM at `ZXNEXT_LAYER2_RAM_OFFSET` = `0x040000` (bank 0 of RAM) |
| Machine / Emu API | as in the Tilemap plan: `IZxNextIdeMachine.ts`, `EmuApi.ts`, `MainToEmuProcessor.ts` (`requireZxNextIdeMachine`) |
| Existing drawing | `controls/Next/Layer2Screen.tsx` (`createLayer2PixelData :12-18`, 256×192 only), `controls/Next/ScreenCanvas.tsx`; `NexFileViewerPanel.tsx:177-179, 495-498` |
| File viewer stubs | `appIde/DocumentPanels/Next/Sl2FileViewerPanel.tsx`, `NxiFileEditorPanel.tsx`; registered `registry.ts:860-970` (`.sl2 :915`, `.nxi :940`, `SL2_VIEWER :516`) |
| Tests | `test/zxnext-hw/layer2/` (`layer2.test.ts` L2-001…024; model `_layer2-helpers.ts`: `layer2Index :33`, `layer2Screen :85`); `test/visual/copper/L01-layer2-transparency` |

---

## 3. The traps

1. **T1: Displayed, shadow and write window are three different things.** The display always uses
   `$12`. Port `$123B` bit 3 maps `$13` instead of `$12` into the write window, and bits 7–6 pick the
   16K segment (or all 48K); bit 4 set means the write sets the *bank offset* instead. Programs also
   write Layer 2 through MMU. The inspector shows all three and says, in the globals strip, which
   physical bank a write to `$0000–$3FFF` lands in right now.
2. **T2: Column-major wide modes.** 320×256 is `(x << 8) | y`; 640×256 packs two 4-bit pixels per
   byte, high nibble first, also column-major. A 256×192 program that switches `$70` without
   re-laying-out its data shows a transposed image; the inspector's *Whole layer* view makes that
   recognisable rather than hiding it.
3. **T3: Bank count depends on resolution.** 256×192 uses 3 banks (48K); the wide modes use 5
   (80K). The Banks strip shows bank boundaries on the image: in 256×192 they are horizontal
   (64 rows per bank); in the wide modes they are **vertical** (64 columns per bank). A test covers
   both.
4. **T4: Wide-mode X scroll does not wrap modulo 320.** `zxnextUlaLayer2WideWrappedX` maps
   `x ≥ 320` with a VHDL quirk (`((x>>6)&7)+3`). `layer2Geometry` copies it, with a test that
   compares every X 0–1023 with the core.
5. **T5: The 2 MB limit.** A pixel whose 16K bank `$12 + segment + 16 ≥ 128` has no pixel
   (`zxnextUlaReadLayer2Pixel`). With `$12` near the top of RAM the image is partly empty; the
   inspector draws those banks as "outside RAM", not as transparent.
6. **T6: Transparency compares RGB, not the index.** A pixel is transparent when its palette entry's
   RGB (the top 8 bits of the 9-bit colour) equals `$14`. Two different indices can both be
   transparent, and a palette change can make a pixel transparent without touching the bitmap. The
   checker follows the core's rule, and the inspector's pixel text says which.
7. **T7: The palette offset is added to the high nibble** of each 8-bit index (`((hi + off) & 15)
   << 4 | lo`), and in 640×256 to the 4-bit index. The decoder applies it; the inspector shows both
   the stored byte and the resulting palette index.
8. **T8: Clip X is doubled in the wide modes** (`x1*2 .. x2*2+1`), and the 256×192 layer sits at
   paper (32,32) in the 320×256 layer space. All clip geometry goes through the shared
   `clipWindows.ts`.
9. **T9: The snapshot is large.** Up to 160K (both bank sets). Over IPC at the panel cadence this is
   acceptable while paused and every 750 ms while running, but the hidden-document gate matters, and
   only the source being shown is decoded. The *Shadow* source is not read until selected (the
   snapshot carries the `$13` banks only when asked: `getNextLayer2State({ shadow })`).
10. **T10: Registers can change after the picture**, exactly as in the Tilemap plan's T10.

---

## 4. Design

### 4.1 Pure modules (`node` tests)

**`src/common/zxnext/layer2/layer2Decode.ts`** (D3)

```ts
export type Layer2Regs = {
  enabled: boolean;
  activeBank: number; shadowBank: number;        // $12, $13
  port123B: number; bankOffset: number;          // peek, T1
  resolution: 0 | 1 | 2; paletteOffset: number;  // $70
  scrollX: number; scrollY: number;              // $16/$71, $17
  clip: [number, number, number, number]; clipIndex: number;  // $18, $1C
  globalTransparency: number;                    // $14
  secondPalette: boolean;                        // $43 bit 2
};

export function layer2Size(res): { width: number; height: number; bytes: number; banks: 3 | 5 };
export function layer2Index(res, data: Uint8Array, x: number, y: number, paletteOffset: number): number | undefined; // T2, T5, T7
export function layer2Image(res, data, paletteOffset): Uint8Array;   // indices, one per pixel
export function pixelAddress(res, bank16: number, x: number, y: number): { bank16: number; offset: number; page8k: number; physical: number; nibble?: "hi" | "lo" };
export function writeTarget(regs, mmu: number[]): { segment: number[]; physicalBanks: number[]; mappedForReads: boolean; mappedForWrites: boolean }; // T1
```

**`src/common/zxnext/layer2/layer2Geometry.ts`**: scroll mapping with the wide-mode quirk (T4), the
visible window on the unscrolled layer (wrapping), bank-boundary lines per resolution (T3), and
`clipWindows.ts` for the clip (T8).

**`src/common/zxnext/layer2/layer2Diagnostics.ts`**: one-line states for the globals strip —
`Layer 2 off`, `displayed and write window are the same bank` (info: no double buffering, or a
tearing risk), `write window maps the shadow bank`, `banks past 2 MB` (T5), `all visible pixels
transparent` (T6), `clip window empty`.

### 4.2 Core exports (D8)

| Export | Returns |
| --- | --- |
| `zxnextGetLayer2ActiveBank()` | `$12` |
| `zxnextGetLayer2ShadowBank()` | `$13` |
| `zxnextGetLayer2Port123BPeek()` | the `$123B` read value, from the module state, without a port access |
| `zxnextGetLayer2BankOffset()` | the bit-4 bank offset |
| `zxnextGetLayer2ClipIndex()` | the `$18` write index |

`$14`, `$43` and the MMU slots come from existing side-effect-free getters. Also fix
`ZxNextWasmV2Machine.ts:1690` to report the real `$123B` value in the memory-mapping data, so the
Next Memory Mapping panel stops showing 0 (a one-line bug fix found by this plan).

### 4.3 Machine and Emu API

```ts
export type NextLayer2State = {
  regs: Layer2Regs;
  displayed: Uint8Array;     // 80K from $12 (the wide size, so a resolution switch needs no re-read)
  shadow?: Uint8Array;       // 80K from $13, only when requested (T9)
  outsideRam: number;        // count of 16K banks past 2 MB in each set (T5)
  mmu: number[];             // for Z80 addresses (D6)
  copperRunning: boolean;    // for the T10 wording
};
```

`IZxNextIdeMachine.getNextLayer2State({ shadow })`, `EmuApi`/`MainToEmuProcessor` as in the Tilemap
plan, and `useNextLayer2State({ enabled, shadow })` with the hash gate (D9).

### 4.4 The Layer 2 Inspector document

- **Opening:** `LAYER2_PANEL_ID = "$layer2"` / `LAYER2_EDITOR`; `show-layer2` (alias `shl2`), with
  `show-layer2 shadow` opening on the shadow source; the Machine → ZX Spectrum Next submenu.
- **Empty state** for a non-Next machine; the document survives a machine switch.
- **Layout:**

  ```
  ┌ toolbar: Source [Displayed|Shadow|Write window]  [Whole layer|As displayed]  Banks ▦  Priority ◆  Transparent ▣  Palette: live(1)▾  Zoom ┐
  ├ globals strip: Layer 2 ON · 320×256 · $12=9 (banks 9-13) · $13=14 · $123B=$03: writes → bank 9 seg 0 ($0000-$3FFF) · │
  │   offset +0 · scroll (0,0) · clip (0,159,0,255)→(0..319,0..255) · $14=$E3 · palette 1, offset 0                      │
  ├──────────────────────────────── Image view ──────────────────────────┬──── inspector ────┤
  │ (IndexedImageCanvas at zoom, with overlays)                           │ pixel / bank      │
  └───────────────────────────────────────────────────────────────────────┴───────────────────┘
  ```

### 4.5 The views

- **Image view.** One `IndexedImageCanvas` per source. Overlays, each a toolbar toggle:
  - the scroll window (wrapping, T4) and the effective clip window (T8) in *Whole layer*;
  - bank boundaries with bank numbers (T3), and the write-window segment highlighted (T1);
  - priority pixels (D10);
  - transparent pixels as a checker or a flat highlight colour (T6);
  - "outside RAM" banks hatched (T5).
- **Banks strip.** The 3 or 5 banks of the source as labelled chips (`bank 9 · pages 18–19`),
  marked *displayed*, *shadow*, *write window*; clicking one scrolls the image to it.
- **Inspector pane.**
  - *Pixel:* coordinates in layer space and screen space, the stored byte or nibble, the palette
    index after the offset (T7), the colour with its priority bit, transparent or not and why (T6),
    and the four addresses (D6). Context menu: *Show in memory*, *Break on write to this pixel*
    (an ordinary memory breakpoint on the mapped Z80 address, when mapped), *Copy coordinates*.
  - *Bank:* its role, physical range, and a 16K thumbnail.

---

## 5. Phases

**Phase 1: pure modules.** `layer2Decode`, `layer2Geometry`, `layer2Diagnostics` (and
`clipWindows.ts` if absent). Tests: T2 in all three modes including nibble order, T3 boundaries,
T4 all 1024 X values, T5, T6 (two indices, one transparent colour), T7, T8, and `writeTarget` for
every `$123B` combination (T1).

**Phase 2: core exports and the read path.** §4.2, §4.3, `useNextLayer2State`; the
`portLayer2` fix. Harness tests in `test/zxnext-hw/layer2/inspector-state.test.ts` (registered in
`build/e2e-tests.ts`), with `session.layer2State()`: for the L2-001…024 configurations, the image
`layer2Decode` produces equals the core's Layer 2 pixels and `_layer2-helpers.layer2Screen`; a
program that writes through `$123B` with bit 3 set shows its bytes in the shadow source and
`writeTarget` names that bank; the state-determinism test still passes.

**Phase 3: the document shell** (shared pieces if absent): `$layer2`, registry, `show-layer2`/`shl2`,
submenu item, IdeApi, workspace restore, empty state, toolbar, globals strip. jsdom tests for the
command, the empty state and the globals-strip model.

**Phase 4: the Image view and Banks strip.** §4.5, with pure tests for the overlay geometry and the
hover-to-address mapping. Verify in the running IDE (CDP recipe), and update
`.ai/ui-theming-intent-and-lessons.md` (the overlay colours are new tokens; a standing rule).

**Phase 5: the inspector pane** and the memory-view link.

**Phase 6: docs, roadmap and verification.** A "Layer 2 Inspector" docs section with generated
screenshots, `commands-reference`, `doc:build`/`doc:check`; mark G3.5 done and correct its "reuses
the `.sl2`/`.shr` viewers" note in `CLOSING_THE_GAPS_PLAN.md`; update §2/§4 of
`LANDING_PAGE_COMPETITIVE_ANALYSIS.md`; `build:check`, `lint:renderer`, the Vite build; a manual pass
on a double-buffered 320×256 program, stepping across the `$12`/`$13` flip.

**Phase 7: `.sl2` and `.nxi` file viewers (Q4).** Replace the two stubs with a viewer built from
`layer2Decode` and `IndexedImageCanvas`: resolution from the file size (49,152 → 256×192; 81,920 →
320×256 or 640×256, with a toolbar switch, since the size alone cannot tell them apart), and for
`.nxi` an optional 512-byte palette header (to be confirmed against the format's documentation when
the phase starts). Without a palette in the file, the default Layer 2 palette is used and labelled as
such. jsdom tests with fixture files. `.shr`/`.shc`/`.slr`/`.vid` stay stubs: they are not Layer 2.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| Pure decode and geometry | 1 | S |
| Exports and read path | 2 | S |
| Document, views, inspector | 3–5 | S–M (less if the Tilemap plan built the shared pieces) |
| Docs and verification | 6 | S |
| `.sl2`/`.nxi` viewers | 7 | S |

About **S–M**, as the roadmap estimated, though not for the reason it gave (there was nothing to
reuse; the decoder is small).

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Decode disagrees with the core in the wide modes | D3 cross-check; T4 tested over every X |
| 160K snapshots slow the IDE while running | Shadow only on demand, hidden gate, hash (T9) |
| Register-at-stop confusion with Copper splits | T10 wording; G3.6's capture for the exact picture |
| Users mistake *Write window* for *Displayed* | The globals strip states the write target in words (T1) |

---

## 8. Open questions (proposed answers)

| # | Question | Proposed answer |
| --- | --- | --- |
| Q1 | Default source: *Displayed* only, or *Displayed* and *Shadow* side by side? | *Displayed*; *Shadow* one click away (T9) |
| Q2 | Default geometry? | *Whole layer*, so the scroll and clip windows are visible (D5) |
| Q3 | Show bank boundaries by default? | Yes; they explain column-major data at a glance (T2/T3) |
| Q4 | Include the `.sl2`/`.nxi` file viewers (Phase 7)? | Yes, since the decoder is the same and the stubs are a visible gap |
| Q5 | Export the live layer as `.sl2`/`.nxi`? | Not now; revisit with Q4's viewers in place |

---

## 9. Implementation notes (2026-10-06)

Where the shipped code differs from §1–§5, and why:

- **T4 was incomplete: a scroll reads past the layer's own banks.** The wide modes' X wrap is not a
  modulo of 320: display column + scroll reaches 830, and 640-830 map to source columns 320-511, which
  are banks +5 to +7 of the set. The 256×192 fold-back likewise reaches rows 192-254 (bank +3). The
  harness test caught it (the decode read past the 80K copy). So the snapshot copies **128K per set**
  (`LAYER2_READ_BYTES`, eight banks), `displayedImage` decodes from the bytes rather than from the
  whole-layer image, and a `scroll reads past the layer` warning (`readsPastLayer`) says so.
- **T7 was wrong for 640×256.** The palette offset is not added to the 4-bit pixel: it *becomes* the
  high nibble (`(offset << 4) | nibble`), as `zxnextUlaRenderLayer2_640x256Screen` and the
  `layer2.vhd` transcription in `_layer2-helpers.ts` both do. `layer2PaletteIndex` follows them.
- **Core fix: `$70` resolution `%11` drew nothing.** `layer2.vhd` takes `1X` as 640×256; the core's
  dispatch tested `== 2`. It now renders 640×256 for both, with a harness test. `layer2Resolution`
  maps 3 to 640×256. Together with the planned `portLayer2` fix, these are the only core changes
  besides the five exports.
- **`mmu` is `slotOffsets`**, as in the Tilemap Inspector (the physical read offset of each 8K slot).
  A pixel's Z80 address is given twice: through the MMU, and through the `$123B` window
  (`windowZ80Address`).
- **The pixel actions never depend on the byte being mapped** (the first version disabled them unless
  it was, which for Layer 2 banks is nearly always). *Show in memory* opens the Memory view at the Z80
  address when the MMU maps the byte, otherwise in its 8K page (the view's partition mode;
  `memoryLocation`). *Break on write* sets a bank-relative write breakpoint (`<bank>:+<offset> -w`),
  which fires wherever the MMU pages the bank in, plus a plain write breakpoint on the `$123B` window
  address when the window maps writes (`breakOnWriteCommands`), since window writes bypass the MMU's
  pages. Checked in the running app: the breakpoint stopped a write to bank 9 through MMU slot 6.
- **The *Write window* source shows the set `$123B` bit 3 picks** (`$12`'s or `$13`'s), with the
  window's bank(s) outlined and tagged in the Banks strip; it reads the shadow banks only when bit 3 is
  set (`needsShadow`). `writeTarget` copies `zxnextMemoryResolveLayer2Offset`, including the bank
  offset added modulo 8 and the bank wrapped at 128. The low overlay (DivMMC) that wins over the
  window at `$0000-$3FFF` is not modelled.
- **No `outsideRam` count in the snapshot**: banks past 2 MB read as zeros and the decode leaves their
  pixels out given the set's first bank; the view hatches them.
- **Transparency and priority are view options over the palette**, since the decode is palette-free:
  *Show transparent pixels as transparent* clears the entries whose RGB equals `$14`, *Highlight
  priority pixels* dims every pixel without the priority bit (D10). `paletteFlags` builds both from the
  live palette's device values, which carry bit 9.
- **Layout**: one breakpoint (`RAIL_FROM_CH`): the inspector is a band under the image, or a rail
  beside it. Palette and zoom move into the **⋯** menu in the band layout. As with the other
  inspectors, no submenu: **Show Layer 2 Inspector** joins the flat Next group and runs
  `show-layer2`; no `IdeApi` method.
- **`show-layer2` takes `displayed`, `shadow` or `window`**, not only `shadow`.
- **The `.sl2`/`.nxi` viewer** (`Layer2FileViewerPanel`) replaces both stubs; the stub files are
  deleted. A file 512 bytes longer than 48K or 80K starts with a palette (`RRRGGGBB`, `0000000B`,
  NextReg `$44` order); otherwise the default Layer 2 palette (`zxnextPaletteHardReset`) is used and
  the toolbar says so. An 80K file offers 320×256 and 640×256.
- **Verification in the running app** is `scripts/doc-shots/recipes/layer2-inspector.cjs`: it pokes
  `layer2-demo.kz80.asm` into a paused Next (a 320×256 ramp with a transparent band in `$12`'s banks,
  the shadow's first bank drawn through `$123B` with bit 3 set, a scroll), checks the strips, the
  inspector's decode, canvas pixels for all three sources and *As displayed*, then photographs. It
  found that the firmware leaves `$14` at `$00`, not the reset `$E3`, so the demo sets it.

