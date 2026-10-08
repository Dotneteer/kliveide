# Sprite Inspector Plan: Sprite Table and Pattern Memory in One Document

Status: **done** (2026-10-05): Phases 1–9 implemented. Decisions D1–D9 accepted and the §8
questions answered as proposed (D10–D17) on 2026-10-04. §9 records where the implementation departs
from the text below.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.2**, the sprite table inspector: all 128
  attribute slots, decoded, with the pattern each one shows.
- **G3.3**, the pattern memory viewer: all 16K of sprite pattern RAM as 8-bit or 4-bit images in the
  live sprite palette.
- Both are delivered as **one document, the Sprite Inspector**, because the two questions users ask
  are linked: "what is sprite 12 showing?" and "who uses pattern 40?".

Mockup: [mockups/sprite-inspector.html](mockups/sprite-inspector.html). It is interactive and shows:
- the document paused mid-frame: the globals strip, the Sprites table with the diagnostic chips and
  the "changed" markers, and the Pattern sheet in *As used* mode with usage badges, the mixed-use
  warning and the upload cursor;
- the inspector, with the *as stored* and *as shown* previews, "slot bytes say" against
  "effective", and the sprite-space map;
- the selected-pattern inspector, the row context menu with the reserved G3.8 slot, the chip
  vocabulary, and the empty state.

Not in scope: sprite-attribute breakpoints (the sprite half of G3.8), the layer composition view
(G3.6) and the beam overlay (G3.7). §1.2 lists the hooks this plan leaves for them.

Related plans:
- [COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md) is the sibling G3 inspector. It is planned but
  not yet implemented. This plan copies its shape: a pure decoder, a snapshot type read through
  `IZxNextIdeMachine`, and a singleton special document. **Whichever of the two lands first creates
  the shared pieces** (`src/common/zxnext/`, the Machine → ZX Spectrum Next menu group, the
  `show-*` command pattern for a Next special document). The second reuses them.
- [NEXTREG_WRITE_BREAKPOINTS_PLAN.md](NEXTREG_WRITE_BREAKPOINTS_PLAN.md) gives `nr:$35`–`$39`/`$75`–`$79`
  breakpoints today. They were the stop-gap for "break when sprite attributes change" until G3.8,
  whose sprite half is now done: [SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md](SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md).

Hardware reference: `_input/next-fpga/src/video/sprites.vhd`. The C engine
`src/emu/machines/zxNext/wasm/zxnext/zxnext-sprites.c` (storage, ports, NextRegs) and the sprite
pass in `zxnext-ula.c` (resolution, clipping, drawing) already mirror it. They are not changed
except for the read-only exports and one refactor in §4.2.

---

## 1. What is being added, and why

A Next program typically uploads patterns once, then moves sprites every frame by writing 4 or 5
attribute bytes per sprite. When the picture is wrong, the usual causes are:
- the wrong pattern number, including a misplaced N6 bit for 4-bit patterns;
- a 4-byte/5-byte attribute mix-up, which leaves a stale attr4 in play;
- relative sprites attached to the wrong anchor;
- the X or Y ninth bit;
- the palette offset;
- the clip window;
- patterns uploaded to the wrong slot, or in the wrong format.

None of this is visible from the Z80 side. The attribute and pattern memories are write-only through
ports `$57`/`$5B`, and the NextReg mirrors expose only one sprite at a time.

Today Klive shows **no runtime sprite state**:
- The renderer draws sprites only for files: the NEX bank Sprites view (`NexBankSpritesView`) and the
  `.spr` editor.
- The Next Palettes panel shows the sprite palette, but nothing that uses it.
- The core exports per-byte getters (`zxnextGetSpriteAttribute`, `zxnextGetSpritePatternByte8`, ...),
  which only `test/wasm/zxNext/wasm-next-sprites.test.ts` calls.

The competitive analysis rates "live Next sprite / Copper / layer inspectors" as ✗ for Klive and ✅
for ZEsarUX (§2, W4). DeZog shows sprites too. This plan closes the sprite half of that row.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **One document, two linked views.** A singleton special document `$sprites`, "Sprite Inspector", like `$memory`. It holds a **Sprites** view (G3.2), a **Patterns** view (G3.3) and an **inspector** pane for the current selection. There is no side-bar panel in this plan (D10). |
| D2 | **One snapshot, one read.** `SpriteState` carries the raw 5×128 attribute bytes, the raw 16K pattern RAM, the core-resolved table (D4) and the global sprite registers. Each refresh reads it in one `getSpriteState()` call, and both views and the inspector render from it. |
| D3 | **Raw bytes are the truth; decoded fields are derived.** The views decode the raw bytes with a pure module, `src/common/zxnext/sprites/spriteAttributes.ts`, which has no React and no Node dependency. The table can always show the raw bytes beside the decoded fields, because most sprite bugs are an encoding mistake. |
| D4 | **The core resolves relative sprites; TypeScript does not duplicate it.** Anchor composition (`zxnextUlaResolveSprites`, `zxnext-ula.c:615-724`) is subtle: inherited transforms, the rotated and mirrored offsets, the pattern and palette add-ons. A second implementation would drift. The core gets an IDE entry point that resolves into a **separate, volatile buffer** (trap T3), and the inspector shows those *effective* values. `spriteAttributes.ts` decodes only what one slot's own bytes say. |
| D5 | **Reuse the NEX sprite drawing, do not fork it.** `patternPixels` and the `SpriteCanvas`/`SpriteCell` grid already draw a 16K bank as 8-bit or 4-bit patterns, which is exactly what pattern RAM is. They move to a shared home (§4.6), and both the NEX view and the inspector import them from there. |
| D6 | **The live sprite palette comes from `useSpritePalette`.** It follows `$43` bit 3, and the user can pin bank 1 or 2. The transparency index is `$4B`, from the same snapshot. With no Next running, the document shows an empty state; it does not fall back to a default palette. |
| D7 | **Read-only.** The inspector does not edit attributes, patterns or registers, like the Next Registers panel. Editing is a separate feature if users ask for it. |
| D8 | **Reading never disturbs the machine.** Every value comes from a side-effect-free getter. In particular, the `$303B` status (*too many*, *collision*) comes from a new peek export, never from the port read, which clears it (trap T1). |
| D9 | **Refresh follows the existing state-panel cadence** (`useEmuStateListener`), but skips work: no read while the document is hidden, and no re-decode of the pattern canvases when the pattern RAM is unchanged (trap T9). |
| D10 | (Q1) **No side-bar panel.** The document's globals strip covers the global state; revisit after use. |
| D11 | (Q2) **Two commands, one document:** `show-sprites`/`shspr [n]` and `show-patterns`/`shpat [n]` both open `$sprites`, focused on the named view. |
| D12 | (Q3) **The default layout is *Both*,** side by side, because the cross-link is the reason for one document. |
| D13 | (Q4) **A 4-byte slot whose stale attr4 would change something is flagged** with an info-level chip, not a warning (T4). |
| D14 | (Q5) **No per-line overtime display in this plan.** The `$303B` *too many* flag is shown now; "sprites dropped on line N" is a later addition with its own export. |
| D15 | (Q6) **"Export pattern RAM as `.spr`" is in scope as Phase 9,** a small follow-up that reuses `serializeSprFile` and opens the result in the sprite editor. |
| D16 | (Q7) **Rows whose bytes changed since the previous stop get a marker.** It is a new treatment, defined once so other state panels can adopt it, and recorded in `.ai/ui-theming-intent-and-lessons.md`. |
| D17 | (Q8) **The Patterns view defaults to *As used*,** falling back to 8-bit for unreferenced slots. |

### 1.2 Out of scope, and the hooks left for later

- **G3.8 (sprite half): stop when a sprite attribute is written.** The Sprites view's row context
  menu leaves a slot for "Break on attribute write" so that G3.8 can add it without a layout change.
  (Done: `sp:` breakpoints fill the slot; see SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md.)
  Until then, the docs point at `nr:` breakpoints on the attribute mirrors.
- **G3.6 layer composition.** The inspector's sprite-space map (§4.5.3) shows *where* sprites are,
  not the composed picture.
- **Editing.** (Exporting pattern RAM to a `.spr` file is in scope, as Phase 9; D15.)
- **The per-line overtime cut** (`zxnextUlaSpriteLineCut`) and the collision coverage map. They are
  per-frame render artefacts. "Too many on line N" is a later addition (D14).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Attribute storage | `zxnext-sprites.c:17` `zxnextSpriteAttributes[128][5]`, raw bytes only. Port `$57` writes at `:149-163` skip attr4 when attr3 bit 6 is clear. NextReg mirrors `$34`–`$39`, `$75`–`$79` at `:47-50, 99-118`. Lockstep (`$09` bit 4) at `:28-43`. |
| Pattern storage | `zxnext-sprites.c:18-19`: `zxnextSpritePatternMemory8[512][256]` and `...Memory4[1024][256]`, **8 pre-transformed variants per pattern**, no raw 16K array. The variant mapping is at `:178-192` (`rotate<<2 \| xmirror<<1 \| ymirror`), and the fan-out on a port `$5B` write at `:207-235`. |
| Globals | `zxnext-sprites.c:3-16`: the clip window and index (`$19`), transparency (`$4B`), the `$15` flags decoded at `:92-98`, the upload indices, the status flags (cleared on read at `:249-254`). |
| Resolution | `zxnext-ula.c:569-585` `ZxnextResolvedSprite` / `zxnextUlaResolvedSprites[128]` (part of the state image); `zxnextUlaResolveSprites` at `:615-724`. |
| Drawing rules | `zxnext-ula.c:788-900`: the clip window per over-border mode, the sprite-0-on-top order, 9-bit wrap (`x > 319 → x - 512`), scale in screen space, not swapped by rotation, the 8-bit palette offset added to the high nibble (`:892-894`), the 4-bit transparency on the low nibble of `$4B`. |
| Sprite palette | `zxnext-palette.c:93` (`$43` bit 3), `:171-173` `zxnextPaletteGetSpriteEntry`. |
| Existing exports | `zxnext.c:614-633` (per-byte sprite getters); pointer-export pattern at `zxnext.c:181-184, 488`. **A new export goes in three places:** `zxnext.c`, `scripts/build-zxnext-wasm.cjs` (`productionExports`, sprites at `:252-265`; `ZXNEXT_VOLATILE_SYMBOLS` at `:18`), and `ZxNextWasmV2Loader.ts` (types `:199-221`, `requiredV2Exports` `:566ff`, views in `createZxNextWasmV2Views` `:752ff`). |
| Machine contract | `IZxNextIdeMachine.ts:19-55`; template `getPaletteDeviceInfo` (`ZxNextWasmV2Machine.ts:1454-1476`) |
| Emu API | `EmuApi.ts` `getPalettedDeviceInfo` `:537` (sic), `PaletteDeviceInfo` `:953-976`. **Note:** `SpriteInfo` at `:822` is the C64 VIC type; the Next type needs a distinct name. Handler `MainToEmuProcessor.ts:1059-1065` via `requireZxNextIdeMachine` `:1533`. |
| Pattern decoding (reuse) | `renderer/appIde/DocumentPanels/Next/nexBankSprites.ts` (`patternPixels` `:88`, `patternSize`, `patternCount`, `isBlankPattern`, `patternColours`) |
| Pattern drawing (reuse) | `NexBankSpritesView.tsx`: `NexBankSpritesToolbar` `:144`, zoom type `:59`, `SpriteCell` `:601`, `SpriteCanvas` `:658` (a 16×16 canvas + `putImageData`, scaled with `image-rendering: pixelated`), `SpriteInspector` `:718`, `toAbgrTable` `:870`, `abgrToCss` `:876`, the checker style |
| Live palette | `renderer/features/sprite-editor/useSpritePalette.ts:68` (`{bank?, enabled?}` → `{palette, transparencyIndex, shownBank, liveBank, pinBank}`); helpers in `emu/machines/zxNext/palette.ts` |
| Palette swatches | `controls/NextPaletteViewer.tsx` (for the inspector's colour-use strip) |
| Special documents | `features/documents/specialDocuments.ts:11-59`; ids in `common/state/common-ids.ts:4-9`; `documentPanelRegistry` `registry.ts:388` (`MEMORY_EDITOR` at `:405`); `ShowMemoryCommand` `appIde/commands/ToolCommands.ts:49`; commands registered in `appIde/IdeCommands.ts:149`; menu `main/app-menu.ts:1225-1239`; `IdeApi.ts:68-84`; `MainToIdeProcessor.ts:155`; restore `restoreLastOpenDocuments.ts:167` |
| Harness | `test/harness/zxnext/README.md:147-165` ("Adding a method"); `script/session.ts` has no sprite method; `test/zxnext-hw/sprites/` (with the VHDL line model `_sprite-model.ts`) |

---

## 3. The traps

1. **T1: The status read clears the status.** `zxnextSpriteReadPort303b` is a port read with
   hardware side effects (`zxnext-sprites.c:249-254`). If the inspector called it, opening the
   document would swallow the program's own collision check. Add
   `zxnextGetSpriteStatusPeek()`, and test that two snapshots in a row leave the flags set.
2. **T2: There is no raw pattern RAM.** The core keeps 8 transformed copies per pattern. Raw byte
   `N*256+i` equals `zxnextSpritePatternMemory8[N*8][i]`, because variant 0 is the identity layout.
   So the 16K is 64 rows of 256 bytes at a **stride of 2048**, not one contiguous block. The machine
   method hides that: it reads through `zxnextSpritePatternMemory8Ptr()` and copies the 64 rows.
   Two things must **not** happen:
   - a new 16K raw array in C. It would change the state-file memory layout (G2.6) and duplicate the
     data a third time;
   - 16,384 per-byte export calls per refresh.

   A harness test asserts that the reconstructed RAM equals the bytes a program uploaded through
   `$5B`, including the 4-bit nibble order.
3. **T3: Do not resolve into the render cache.** `zxnextUlaResolvedSprites` is a static, so it is
   part of the state image that `machine-state-determinism.test.ts` compares. An IDE read that
   writes it would make "debugging changes the state" possible in principle, even though the render
   recomputes it. Refactor `zxnextUlaResolveSprites(lastVisible)` into
   `zxnextUlaResolveSpritesInto(out, count)`. The render passes its own array; the IDE export passes
   a separate buffer, `zxnextIdeResolvedSprites`, listed in `ZXNEXT_VOLATILE_SYMBOLS`. The IDE
   resolves **all 128** slots: the render stops at the last visible sprite, but the inspector shows
   every slot.
4. **T4: 4-byte sprites keep a stale attr4.** When attr3 bit 6 is clear, port `$57` never writes
   attr4, so the stored byte is left over from an earlier upload and ignored. The table shows it
   greyed and struck through, with the tooltip "ignored: 4-byte sprite". It must never be decoded as
   scale or a Y ninth bit. This is a classic bug, so the inspector also flags a 4-byte slot whose
   stale attr4 *would* change something if bit 6 were set, with an info-level chip (D13).
5. **T5: A relative sprite's meaning depends on the slots before it.** A relative takes the nearest
   preceding non-relative slot as its anchor, **visible or not**. It is visible only if that anchor
   is. A relative in slot 0, or one after only relatives, composes onto an all-zero anchor. The
   inspector shows the anchor index on every relative, and an invisible anchor explains a missing
   sprite: "hidden: anchor #7 is not visible".
6. **T6: Two attribute bits change meaning with the sprite type.**
   - attr2 bit 0 is X bit 8 for an anchor, but "palette offset is relative" for a relative.
   - attr4 bit 0 is Y bit 8 for an anchor, but "pattern is relative" for a relative.
   - attr4 bits 5 and 6 are N6 and T on an anchor, but N6 alone on a relative.

   `spriteAttributes.ts` decodes per type and never shows "X8" on a relative. Tests cover every
   field in both readings.
7. **T7: N6 only exists for 4-bit sprites.** The 7-bit pattern number names a 4-bit pattern
   (`pattern7`, 0–127, 128 bytes each). An 8-bit sprite uses `pattern7 >> 1` (0–63, 256 bytes). The
   Sprites view shows `40` for an 8-bit sprite and `81 (40·hi)` for a 4-bit one, so the 4-bit half
   is explicit. The Patterns view uses the same numbering in each format.
8. **T8: Coordinates and the clip window are in different spaces.**
   - Sprite space is 320×256, and the paper's top left is (32, 32).
   - A 9-bit X above 319, or a Y above 255, wraps to negative.
   - The `$19` clip window is in **different units per mode** (`zxnext-ula.c:798-818`). With
     over-border on and clipping enabled, X is doubled (`x1<<1`, `x2<<1|1`). With over-border on and
     clipping off, there is no clip. With over-border off, it is paper-relative (+32), and Y is
     capped at 223.

   The inspector shows both the raw `$19` values and the **effective** rectangle in sprite space,
   computed by a pure function whose tests copy those three branches.
9. **T9: The refresh must stay cheap.** Each snapshot is about 17.7K: 640 bytes of attributes, 16K
   of patterns, 1K of resolved table and the globals. At the state-panel cadence that is fine over
   IPC, but redrawing 64–128 canvases on every refresh is not.
   - The view hashes the pattern RAM (a cheap FNV over the 16K) and re-decodes the sheet only when
     it changes.
   - The sprite table is a `VirtualizedList`, so only the visible rows re-render.
   - The document does not read at all while hidden. This also lets `useSpritePalette`'s `enabled`
     flag stay false.
10. **T10: Rotate comes before mirror.** The hardware rotates 90° clockwise first, then mirrors in
    screen space, so rotation inverts the X mirror (`zxnext-sprites.c:166-192`). The inspector's
    *as shown* preview applies the transform in TypeScript (`transformPattern`). A test compares it
    with all 8 core variants of a known pattern, through `zxnextGetSpritePatternByte8(variant, off)`,
    so the two can never disagree. Scale is applied afterwards and is **not** swapped by rotation
    (`zxnext-ula.c:851-856`).
11. **T11: The 8-bit palette offset is not in `patternPixels` today.** The NEX view's decoder adds
    the palette offset only for 4-bit patterns. The core also adds it to the **high nibble** of an
    8-bit pixel: `((p>>4)+off)&15)<<4 | p&15` (`zxnext-ula.c:892-894`). Extend `patternPixels` with
    the 8-bit rule (default offset 0, so the NEX view is unchanged) and test it against the core.
12. **T12: The upload pointers are part of the state, and lockstep links them.** Ports
    `$303B`/`$57`/`$5B` use the attribute and pattern indices and sub-indices; NextRegs `$34`–`$39`
    use the mirror index. With `$09` bit 4 set, the two are tied. "My uploads go to the wrong slot"
    is a common bug, so the globals strip shows all of them, and says *tied* when they are.

---

## 4. Design

### 4.1 Pure modules (no React, `node` project tests)

**`src/common/zxnext/sprites/spriteAttributes.ts`** (D3)

```ts
export type SpriteSlotKind = "anchor4" | "anchor5" | "relativeComposite" | "relativeUnified";

export type DecodedSpriteSlot = {
  index: number;
  raw: [number, number, number, number, number];
  kind: SpriteSlotKind;             // from attr3 bit 6 and attr4 bits 7:6
  attr4Ignored: boolean;            // T4
  visibleBit: boolean;              // attr3 bit 7, the slot's own bit
  // --- anchor reading (T6)
  x?: number; y?: number;           // 9-bit
  fourBit?: boolean; n6?: boolean; relType?: "composite" | "unified";
  // --- relative reading (T6)
  dx?: number; dy?: number;         // signed 8-bit offsets
  paletteRelative?: boolean; patternRelative?: boolean;
  // --- both
  pattern6: number;                 // attr3 bits 5..0
  paletteOffset: number;            // attr2 bits 7..4
  xmirror: boolean; ymirror: boolean; rotate: boolean;
  scaleX: 0 | 1 | 2 | 3; scaleY: 0 | 1 | 2 | 3;
};

export function decodeSpriteSlot(index: number, raw: ArrayLike<number>): DecodedSpriteSlot;
export function findAnchor(slots: DecodedSpriteSlot[], index: number): number | undefined; // T5
export function formatSpritePattern(fourBit: boolean, pattern7: number): string;            // T7
```

**`src/common/zxnext/sprites/spriteGeometry.ts`**
- `effectiveClipWindow(clip, overBorder, clippingEnabled)`, which mirrors `zxnext-ula.c:798-818`
  (T8).
- `spriteRect(resolved)`: the on-screen rectangle with the 9-bit wrap and `16 << scale`.
- `isOnScreen` / `clippedFraction`, which answer "why can't I see it".
- `transformPattern(pixels, rotate, xmirror, ymirror)`, using the same mapping as
  `zxnextSpritesVariantScreenOffset` (T10).

**`src/common/zxnext/sprites/spriteDiagnostics.ts`** returns one short reason per slot, shown as a
chip in the table and as a sentence in the inspector:
- `hidden: visible bit clear` / `hidden: anchor #7 not visible` (T5)
- `off screen` / `outside clip window` / `partly clipped` (T8)
- `sprites disabled ($15 bit 0)`
- `4-byte: attr4 ignored` (T4; info level, D13)
- `pattern is blank` / `pattern is all transparent` (via `isBlankPattern`)

### 4.2 Core exports (D4, D8, T1–T3)

These go in `zxnext.c`, `build-zxnext-wasm.cjs` and the loader:

| Export | Returns |
| --- | --- |
| `zxnextSpriteAttributesPtr()` | Pointer to `zxnextSpriteAttributes[128][5]` (640 contiguous bytes) |
| `zxnextSpritePatternMemory8Ptr()` | Pointer to `zxnextSpritePatternMemory8`; the host reads rows `N*8`, stride 2048 (T2) |
| `zxnextResolveSpritesForIde()` | Resolves all 128 slots into `zxnextIdeResolvedSprites[128*8]` (volatile, T3) and returns its pointer. 8 bytes per sprite: `0` flags (bit 0 visible, 1 xmirror, 2 ymirror, 3 rotate, 4 four-bit), `1–2` X (LE, 9-bit), `3–4` Y (LE, 9-bit), `5` palette offset, `6` scale (`sx<<2 \| sy`), `7` `pattern7`. The layout is documented beside the buffer and decoded by one TS function. |
| `zxnextGetSpriteControl()` | The `$15` value re-encoded (it is already read that way at `zxnext-sprites.c:128-133`) |
| `zxnextGetSpriteStatusPeek()` | *too many* and *collision*, **without** clearing them (T1) |
| `zxnextGetSpriteMirrorIndex()` | The `$34` mirror index (`zxnextSpriteMirrorQ`) |

The refactor `zxnextUlaResolveSprites(lastVisible)` → `zxnextUlaResolveSpritesInto(out, count)` has
one regression guard: the whole `test/zxnext-hw/sprites/` suite and the sprite screen cases in
`test/visual/` must pass unchanged.

Existing exports reused: `zxnextGetSpriteClip(i)`, `zxnextGetSpriteTransparencyIndex`,
`zxnextGetSpriteIndex`, `...SubIndex`, `...PatternIndex`, `...PatternSubIndex`,
`zxnextGetLastVisibleSpriteIndex`.

### 4.3 Machine and Emu API (D2)

```ts
// src/common/messaging/EmuApi.ts  (NOT "SpriteInfo": that name is the C64 VIC type)
export type NextSpriteState = {
  attributes: Uint8Array;        // 640 bytes, a copy
  patterns: Uint8Array;          // 16384 bytes, raw layout (T2)
  resolved: Uint8Array;          // 128 × 8, the core's effective values (D4)
  lastVisible: number;           // -1 when none
  control: number;               // $15
  clip: [number, number, number, number]; clipIndex: number;  // $19, $1C
  transparencyIndex: number;     // $4B
  status: { tooMany: boolean; collision: boolean };           // peek (T1)
  upload: { spriteIndex: number; spriteSub: number; patternIndex: number; patternSub: number;
            mirrorIndex: number; tied: boolean };              // T12
  spritePaletteBank: 0 | 1;      // $43 bit 3, convenience for the toolbar
};
```

- `IZxNextIdeMachine.getNextSpriteState()` is implemented in `ZxNextWasmV2Machine`. It copies the
  attribute and resolved views with `slice()`, and the 64 pattern rows with `set()` into one
  `Uint8Array(0x4000)`.
- Add it to `isZxNextIdeMachine`'s checks.
- `EmuApiImpl.getNextSpriteState()` is a proxy stub. `MainToEmuProcessor` handles it through
  `requireZxNextIdeMachine`, as `getPalettedDeviceInfo` does.
- A small renderer hook, `useNextSpriteState({ enabled })`, wraps the call with
  `useEmuStateListener`, the hidden-document gate and the pattern-RAM hash (T9). It returns the
  snapshot plus `patternsVersion`, which bumps only when the hash changes.

### 4.4 The Sprite Inspector document (D1)

- **Opening:** a singleton special document, `SPRITES_PANEL_ID = "$sprites"` / `SPRITES_EDITOR`, in
  `specialDocuments.ts`. It is workspace-restorable. It is opened by:
  - `show-sprites` (alias `shspr`). `show-sprites <n>` selects sprite *n* in the Sprites view.
  - `show-patterns` (alias `shpat`). `show-patterns <n>` opens the same document on the Patterns view
    with pattern *n* selected (D11).
  - the **Machine → ZX Spectrum Next** menu (shared with the Copper plan).
- **Non-Next machine, or no machine:** an `EmptyState` ("The Sprite Inspector shows a running ZX
  Spectrum Next"). The document stays open, so it survives a machine switch.
- **Layout:**

  ```
  ┌ toolbar: [Sprites|Patterns|Both]  Filter ▾  Palette: live(1)▾  Zoom 1-4  ▦ checker  ⟳ Follow ┐
  ├ globals strip: Sprites ON · over border · clip ON (32,32)-(287,223) · order SLU · #0 on top ·    ┤
  │   $4B=$E3 · last visible #23 · status: collision · upload #24.0 pat 12.$80 · mirror #24 (tied) │
  ├──────────── Sprites table ────────────┬──────────── Pattern sheet ─────────────┤
  │ (VirtualizedList, 128 rows)           │ (CSS grid of SpriteCells, 64 or 128)   │
  ├───────────────────────────────────────┴────────────────────────────────────────┤
  │ inspector: the selected sprite or pattern                                       │
  └─────────────────────────────────────────────────────────────────────────────────┘
  ```

  - **Both** is the default (D12). It splits side by side, and stacks below about 90ch.
  - The panes are resizable with the existing splitter primitive, and the sizes persist in the
    document's view state.

### 4.5 The views

#### 4.5.1 Sprites view (G3.2)

| Column | Shows |
| --- | --- |
| `#` | `0`–`127`. An `↳7` badge on a relative names its anchor (T5). |
| vis | ● visible (effective), ○ visible bit set but hidden by the anchor, blank when clear |
| pattern | a 16×16 thumbnail (as stored, untransformed) + `formatSpritePattern` (T7) |
| X, Y | the effective 9-bit position. A relative also shows `Δ+12,−4` in the secondary style. |
| fmt | `8` / `4` |
| pal | the palette offset (`+3` when relative, T6) |
| xform | `R` `X` `Y` glyphs, lit when set |
| scale | `1×`, `2×`, `4×`, `8×` per axis, e.g. `2×1` |
| type | `anchor`, `anchor·4B`, `rel·composite`, `rel·unified` |
| raw | `$20 $40 $00 $C5 $80`, with an ignored attr4 struck through (T4); hidden by default |
| note | the `spriteDiagnostics` chip |

- **Filter:** *All 128*, *Up to last visible*, *Visible only*, *Non-empty* (any non-zero byte). The
  default is *Up to last visible*, falling back to *All* when nothing is visible.
- **Values** use the `--color-state-value` treatment of the converted state panels (AGENTS.md).
- **Changed rows (D16):** rows whose raw bytes changed since the previous stop get a marker. No state
  panel has a "changed since last stop" treatment today (Next Registers shows only the last written
  value, `NextRegPanel.tsx:23-31`). This would be a new style, so it must be recorded in
  `.ai/ui-theming-intent-and-lessons.md`.
- **Row actions:** select (updates the inspector, and highlights the pattern cell in the sheet);
  double-click on the pattern cell, which goes to that pattern in the Patterns view; a context menu
  with *Copy attributes as `nextreg`/`.db`*, *Show pattern*, and the reserved G3.8 slot.

#### 4.5.2 Patterns view (G3.3)

- The 16K is shown as **64 8-bit** or **128 4-bit** patterns, with `NexBankSpritesView`'s grid,
  canvases, zoom and checker (D5).
- **Format:**
  - *8-bit*, *4-bit*, or **As used** (D17, the default).
  - In *As used*, each 256-byte slot is drawn as the sprites that reference it read it: as one
    8-bit pattern, or as two 4-bit halves.
  - An unreferenced slot is drawn in the toolbar's fallback format.
  - A slot that sprites read **both** ways gets a warning corner. That is almost always a bug.
- **Palette offset** (for 4-bit, and for 8-bit per T11): *Fixed n*, or **From sprite**. *From
  sprite* uses the offset of the first visible sprite that references the pattern, so the sheet
  looks like the screen.
- **Usage badge** on each cell: the number of sprites that reference it (visible ones in the accent,
  others muted). Hovering lists them.
- Unreferenced and blank patterns are dimmed, as in the NEX view (`isBlankPattern`).
- The **upload cursor** (pattern index and sub-index, T12) is drawn as a marker on the cell and row
  the next `$5B` byte will write.

#### 4.5.3 Inspector pane

**For a selected sprite:**
- **As stored**: the pattern untransformed, at zoom.
- **As shown**: `transformPattern` with scale applied, at the true aspect (T10).
- A field-by-field decode, showing both the slot's own reading and the effective value when they
  differ (relatives).
- The diagnostic sentence.
- The colours used (`patternColours` → `NextPaletteViewer` swatches in the live bank).
- A **sprite-space map**: 320×256 at a small scale, with these overlays:
  - the paper rectangle;
  - the effective clip window (T8);
  - every visible sprite as an outline, with the selected one filled.

  Clicking an outline selects that sprite. This answers "where is it and is it clipped" without
  G3.6.

**For a selected pattern:**
- the pattern large, with the hint text the NEX inspector already produces (`describeHint`);
- the byte range in pattern RAM (`$1400–$14FF`);
- the sprites that use it.

### 4.6 Reuse and file moves (D5)

AGENTS.md: import from the owning file, and keep no re-export shims.

| Today | Moves to | Used by |
| --- | --- | --- |
| `appIde/DocumentPanels/Next/nexBankSprites.ts` (pure) | `src/common/zxnext/sprites/spritePatterns.ts`, plus the 8-bit offset (T11) | NEX view, inspector, `spriteDiagnostics` |
| `SpriteCanvas`, `SpriteCell`, `toAbgrTable`, `abgrToCss`, the checker CSS, the zoom type and buttons, in `NexBankSpritesView.tsx` | `renderer/controls/Next/sprites/SpritePatternSheet.tsx` (the grid with cell, canvas and zoom) and `spriteAbgr.ts` | NEX view, inspector |
| `NEX_RESET_PALETTE` | stays with the NEX view (the inspector never uses a fallback palette, D6) | NEX view |

`SpritePatternSheet` gets the props the inspector needs and the NEX view does not use:
- `badges` (usage counts);
- `markers` (the upload cursor and the selected sprite's pattern);
- `formatPerSlot` (*As used*);
- `paletteOffsetPerPattern`.

These are additive, so the NEX view's behaviour and tests stay unchanged. Phase 3 proves that
before any inspector code exists.

---

## 5. Phases

**Phase 1: pure modules (nothing user-visible).**
- Work: `spriteAttributes.ts`, `spriteGeometry.ts`, `spriteDiagnostics.ts`; move `nexBankSprites.ts`
  to `spritePatterns.ts` and add the 8-bit palette offset (T11).
- Tests (`node`):
  - every field in both the anchor and the relative reading (T6);
  - the 4-byte case with a stale attr4 (T4);
  - `findAnchor` with a leading relative and with chains (T5);
  - all three clip branches (T8);
  - the 9-bit wrap;
  - pattern numbering in each format (T7).
- Update the NEX tests' imports; their assertions are unchanged.

**Phase 2: core exports and the read path.**
- Work: §4.2 (including the resolve refactor, T3) and §4.3; `useNextSpriteState`.
- Tests: harness tests in `test/zxnext-hw/sprites/inspector-state.test.ts`, registered in
  `build/e2e-tests.ts`. Add `session.spriteState()` (harness README, "Adding a method", with a row
  in its API table). Then:
  - upload patterns through `$5B` and assert the raw 16K, including the 4-bit nibble order (T2);
  - write anchors and relatives through `$57` and the `$75`–`$79` mirrors; assert `resolved` equals
    what `_sprite-model.ts` and the screen show;
  - two snapshots leave *collision* set (T1);
  - `transformPattern` equals all 8 core variants (T10);
  - the 8-bit palette offset matches the drawn pixels (T11);
  - the state-determinism test still passes, which proves the IDE resolve is volatile (T3).
- Run the full `test/zxnext-hw/sprites/` suite and the sprite visual cases unchanged after the
  refactor.

**Phase 3: extract the shared sheet (no behaviour change).**
- Work: §4.6. The NEX Sprites view now renders through `SpritePatternSheet`.
- Tests: the existing NEX view tests pass. Then run
  `npx electron-vite build --config build/electron.vite.config.ts` to catch the moved imports.

**Phase 4: the document shell.**
- Work: `$sprites` in `specialDocuments.ts`, the registry entry, `show-sprites`/`shspr` and
  `show-patterns`/`shpat`, the Next menu item, the IdeApi visibility, workspace restore, the empty
  state, the toolbar, the globals strip and the split layout.
- Tests: jsdom for the command, the empty state and the globals-strip model (the effective clip
  text and *tied*).

**Phase 5: the Sprites view.**
- Work: §4.5.1 (table, filters, raw column, diagnostics chips, change markers, context menu).
- Tests: a row model as a pure function (`spriteRows(state, filter)`) and the jsdom list rendering.
- Verify in the running IDE with the CDP recipe from `.ai/ui-theming-intent-and-lessons.md`, and
  update that file in the same change (a standing rule).

**Phase 6: the Patterns view.**
- Work: §4.5.2 (format modes including *As used*, palette offset modes, usage badges, upload cursor,
  mixed-use warning).
- Tests: the usage index (`patternUsage(resolved)`), the *As used* slot formats, and the mixed-use
  detection, all pure.

**Phase 7: the inspector pane and cross-linking.**
- Work: §4.5.3, including the sprite-space map. Selecting in either view updates the other.
- Tests: the map geometry, which reuses `spriteGeometry`; the selection-sync model.

**Phase 8: docs, roadmap and verification.**
- Docs: a "Sprite Inspector" section in `docs/content/working-with-ide`, with screenshots generated
  by `scripts/doc-shots/` (read `.ai/doc-screenshots-guide.md`); `show-sprites` and `show-patterns`
  in `commands-reference`. Check with `npm run doc:build && npm run doc:check`.
- Roadmap: mark G3.2 and G3.3 as done in `CLOSING_THE_GAPS_PLAN.md`.
- Competitive analysis: update §2 (the inspectors row) and §4 (W4) of
  `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (a standing rule).
- Checks:
  - `npm run build:check`, `npm run lint:renderer`, and the Vite build check.
  - A manual pass on a sprite-heavy NEX: stop mid-frame, and confirm that the table, the sheet, the
    map and the emulator screen agree.
  - Toggle 4-bit/8-bit on a mixed-format program.

**Phase 9: export pattern RAM as `.spr` (D15).**
- Work: an *Export as .spr…* toolbar action in the Patterns view. It writes the 16K snapshot with
  `serializeSprFile` (64 8-bit patterns; the bytes are the same whatever format the sheet shows) and
  offers to open the file in the sprite editor.
- Tests: a jsdom test that the exported bytes equal the snapshot's pattern RAM and parse back with
  `parseSprFile`.
- Docs: one paragraph in the Sprite Inspector section.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| Pure decode, geometry, diagnostics | 1 | S |
| Core exports, resolve refactor, read path | 2 | S |
| Shared sheet extraction | 3 | S |
| Document shell + Sprites view (G3.2) | 4–5 | M |
| Patterns view (G3.3) | 6 | S (the drawing is reused) |
| Inspector pane, map, cross-linking | 7 | S–M |
| Docs, roadmap, verification | 8 | S |
| Export pattern RAM as `.spr` | 9 | S |

The total is about **M**, in line with the roadmap's M for G3.2 plus S for G3.3. Building both in one
document saves the second view's shell, refresh path and palette wiring.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| The TypeScript decode and the core disagree on a relative sprite | The core resolves (D4); TypeScript only decodes one slot's own bytes, and a harness test cross-checks the screen |
| Opening the inspector changes program behaviour | Peek-only getters (T1), a volatile resolve buffer (T3), and the determinism test in Phase 2 |
| Refresh cost while running | Hidden-document gate, pattern hash, virtualised table (T9) |
| Extracting the sheet regresses the NEX view | Phase 3 is a pure refactor with the NEX tests as the guard, before any new UI |
| The resolve refactor changes rendering | The full sprite hardware suite and the visual cases must pass unchanged in Phase 2 |
| The Copper plan and this plan both create the shared Next-document scaffolding | Whichever lands first owns it; the second reuses it (see Related plans) |

---

## 8. Questions answered (2026-10-04)

All eight were accepted as proposed and are recorded as D10–D17 in §1.1.

| # | Question | Answer |
| --- | --- | --- |
| Q1 | Also add a compact side-bar panel beside Next Registers? | No; the globals strip covers it, revisit after use (D10) |
| Q2 | One command with a view switch, or `show-sprites` / `show-patterns`? | Two commands, one document (D11) |
| Q3 | Default layout: *Both*, or *Sprites* only? | *Both* (D12) |
| Q4 | Flag a 4-byte sprite whose stale attr4 would matter? | Yes, info level (D13) |
| Q5 | Show the per-line overtime cut? | Later; show the *too many* flag now (D14) |
| Q6 | Export pattern RAM as `.spr`? | Yes, Phase 9 (D15) |
| Q7 | "Changed since the last stop" markers? | Yes, a new treatment defined once (D16) |
| Q8 | Default pattern format? | *As used*, 8-bit fallback (D17) |

---

## 9. Implementation notes (2026-10-05)

Where the shipped code differs from §1–§5, and why:

- **`SpriteSlotKind` is `anchor4 | anchor5 | relative`**, not four kinds. Whether a relative is
  composite or unified is its *anchor's* T bit, which one slot's bytes cannot say (D3);
  `relativeTypeOf(slots, i)` answers it, and the table's type column shows `rel·composite` /
  `rel·unified` as planned.
- **The IDE resolve uses a static scratch table, `zxnextIdeResolveScratch`, also volatile.** A
  1.8K local array lived on the WASM shadow stack, which is in linear memory and so in the state
  image: the T3 harness test (snapshot image before and after `spriteState()`) caught reading the
  sprites changing the image.
- **One more export, `zxnextGetSpriteClipIndex`,** for the globals strip's "next `$19` write sets".
- **`SpritePatternSheet` takes per-cell data, not `formatPerSlot` / `paletteOffsetPerPattern`.**
  Each caller turns bytes into pixels itself, so a per-slot format or a per-pattern palette offset
  is the caller's business; the sheet adds only the presentation (`badge`, `markers`, `warning`,
  `fold`, `dimmed`). The NEX view passes its palette offset for 4-bit only, so T11's 8-bit offset
  leaves it unchanged.
- **No `IdeApi` visibility method.** As in the Copper plan, the menu item runs the command
  (`show-sprites`) through `executeCommand`; workspace restore is the generic special-document path.
- **The hidden-document gate is structural.** The document area mounts only the active document,
  so a hidden Sprite Inspector is unmounted and reads nothing; `enabled` covers a non-Next machine.
- **"Changed since the previous stop" baselines** on the attributes at the previous stop while
  paused (a new stop is a new tact count), and on the last stop while running.
- **`show-patterns <n>` takes an 8-bit slot number (0–63)**; a 4-bit half is reached from the
  sheet or from a sprite.
- **Phase 9 is the `export-patterns [<file>] [-f] [-o]` command** (alias `exppat`); the toolbar's
  **Export as .spr** runs `export-patterns -o`, which writes the next free `pattern-ram.spr` in the
  project and opens it in the sprite editor. There is no save dialog in the IDE to offer a name.
- **The colour-use strip draws its own swatches** (as the NEX inspector does) rather than
  `NextPaletteViewer`, which renders a whole 256-entry palette.
- **Verification in the running app** is `scripts/doc-shots/recipes/sprite-inspector.cjs`: it pokes
  `sprite-demo.kz80.asm` into a paused Next (no NextZXOS needed), checks the table, the strip, the
  sheet and the export from the DOM, and produces the two documentation screenshots.

- **Pattern snapshots (2026-10-06, after the plan).** *Open in sprite editor* (the inspector, for a
  sprite or a pattern, and the table's row menu) opens the pattern, as its sprite shows it, in a
  read-only sprite editor: an in-memory `SpritePatternSnapshot` document (`patternSnapshot.ts`,
  `PatternSnapshotPanel.tsx`), one 8-bit sprite with the palette offset applied and transparent pixels
  as `$4B`. `SpriteEditor` takes `readOnly`; its `commit` and save are no-ops then. One tab per pattern
  and format, retaken in place; not restored with the workspace.

### 9.1 Layout redesign (2026-10-06)

The first layout put the toolbar, the globals, the table beside the sheet and a bottom inspector in
one grid; in a narrow document each was too small, the toolbar and the globals wrapped to two lines
each, and the table's header did not scroll with its columns. The redesign
([mockups/sprite-inspector-layout.html](mockups/sprite-inspector-layout.html)) replaces §4.4's
layout:

- **Three layouts by the document's own width**, in `ch` of the panel font (`layoutForWidth`):
  narrow (< 114ch) — Sprites and Patterns as tabs, the inspector a band under the list with the
  details and the sprite-space map side by side; medium — tabs, the inspector a rail; wide (≥ 180ch)
  — *Both* offered, with the rail. D12's default *Both* is kept: where it does not fit, the view's
  `tab` decides (`chooseView`), and a reveal never discards it.
- **One-line toolbar and globals strip**; the Patterns pane's controls moved into the toolbar, and
  zoom, checker, raw bytes, the unused-slot format and the export into a `⋯` menu as width drops.
- **The table** is one scroller with a sticky header and three pinned columns (#, vis, pattern), and
  is no longer virtualized (128 rows at most). The pinned pattern cell shows the number alone; the
  4-bit half moved to `fmt` (`4·hi`).
- **The inspector** shows two columns of fields (effective, then the slot's own reading where it
  differs, `spriteFields`), a one-line summary in its header (`spriteSummary`), a sentence only for
  a problem, and the map of a selected pattern's users.
- Verified in the running app at all three widths by `scripts/doc-shots/recipes/sprite-inspector.cjs`,
  which also checks that the pinned columns keep their place and width while the table scrolls.

