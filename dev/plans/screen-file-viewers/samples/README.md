# Screen file samples for manual tests

Sample files for `dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`: one or more of every screen format Klive
opens, with and without a PLUS3DOS header, and the cases a viewer must refuse or warn about.

They are **generated**, not drawn. To regenerate them, run:

```bash
node dev/plans/screen-file-viewers/generate-samples.cjs
```

The generator is `../samples.js`. The plan's mockup uses the same code, so the files and the mockup
always show the same pictures. Text in the pictures is drawn with the 48K ROM's character set.

The layouts come from Klive's Next core, which follows the VHDL (see the plan, §3). They are
**Klive's own reading of the formats**, so also test with files the Next writes itself (last
section).

## The files

| File | Bytes | What it tests | A viewer should show |
|---|---:|---|---|
| `SCREEN.SCR` | 6,912 | A bare 48K screen | Rainbow bars, a BRIGHT yellow "KLIVE IDE", a green circle, and a red-on-white "PRESS ANY KEY" line with FLASH set (14 cells) |
| `SCREEN-HEADER.SCR` | 7,040 | The same screen after a PLUS3DOS header (CODE, 6,912 bytes at `$4000`) | The same picture; a Header section |
| `SCREEN-AT-8000.SCR` | 7,040 | A header whose load address is `$8000` | The same picture, with a warning (not an error) that it does not load at the screen |
| `BROKEN.SCR` | 7,000 | A size no format has | Refused, with the file's size and the sizes allowed |
| `TITLE.SL2` | 49,280 | Layer 2 256×192 after a PLUS3DOS header, the form the wiki gives for `.sl2` | Sky, a sun, hills and "LAYER 2"; the Next's default palette |
| `TITLE-BARE.SL2` | 49,152 | The same, with no header | The same picture |
| `TITLE.NXI` | 49,152 | `.nxi` 256×192 with no palette | The same picture, "Next default palette" |
| `TITLE-PALETTE.NXI` | 49,664 | `.nxi` with its own 512-byte palette (the default with red and blue swapped) | The same shapes, but a **red** sky and a **blue** sun: proof that the file's palette is used |
| `CITY.NXI` | 82,432 | 320×256 (column-major) with its own palette | A dusk skyline with lit windows and "320x256" in the corner. Switched to 640×256 it is garbage |
| `HIRES.NXI` | 81,920 | 640×256 4-bit with no palette (the size cannot tell it from 320×256) | Shown as 640×256: a checkerboard, an ellipse and "640x256 4BPP". Shown as 320×256 (the default today) it is garbage |
| `LORES.SLR` | 12,288 | LoRes 128×96, one byte per pixel | Colour rings, "LORES" and "128x96". A white line, then a red line, mark rows 47 and 48, where the `$4000` half meets the `$6000` half |
| `LORES-HEADER.SLR` | 12,416 | The same after a PLUS3DOS header | The same picture |
| `HICOLOUR.SHC` | 12,288 | Timex hi-colour, one attribute per 8×1 strip | "HI-COLOUR" with a different colour on every pixel row, which a 48K screen cannot do |
| `HICOLOUR-HEADER.SHC` | 12,416 | The same after a PLUS3DOS header | The same picture |
| `HIRES.SHR` | 12,288 | Timex hi-res 512×192, one colour pair | A large "TIMEX HI-RES", a line of 64-column text, one-pixel stripes, then 8-pixel bars. A layout error shows as letters split or swapped in 8-pixel slices |
| `HIRES-HEADER.SHR` | 12,416 | The same after a PLUS3DOS header | The same picture |

All of them open in the screen file viewer. Two things to know when checking them:

- `HIRES.NXI` opens as 320×256 (garbage) until you switch it to 640×256: the size cannot tell.
- `LORES.SLR` is drawn for RGB332. With the default **ULA palette** (what NextBASIC shows after
  `LOAD ... LAYER`) only the low 4 bits of each index count, so it shows 16 colours; switch to
  **RGB332** to see the rings as drawn.

## Files the Next writes itself

NextBASIC saves the current picture of a layer with `SAVE "name" LAYER`. The slow-tier test SPI-014
(`test/zxnext-hw/sd/nextzxos-save-layer.test.ts`) does this for every layer in the harness and reads
the files back; to do it by hand in Klive's emulated Next:

1. Start the ZX Spectrum Next machine and choose NextBASIC from the menu.
2. Select a layer, then draw and save **on one line**: NextBASIC's editor clears the screen when you
   start typing a new line after a report, so a `SAVE` on its own line saves an empty picture.

   | Format | First line | Second line |
   |---|---|---|
   | ULA | `LAYER 0` | `INK 2: CIRCLE 40,40,30: SAVE "ULA.SCR" LAYER` |
   | LoRes | `LAYER 1,0` | `CIRCLE 40,40,30: SAVE "LORES.SLR" LAYER` |
   | Timex hi-res | `LAYER 1,2` | `CIRCLE 40,40,30: SAVE "HIRES.SHR" LAYER` |
   | Timex hi-colour | `LAYER 1,3` | `INK 4: CIRCLE 40,40,30: SAVE "HICOL.SHC" LAYER` |
   | Layer 2 | `LAYER 2,1` | `CIRCLE 40,40,30: SAVE "L2.SL2" LAYER` |

3. Copy the files off the SD card image (the Disk Explorer or the file manager) and open them.

What NextZXOS 2.08 writes (checked): a 128-byte PLUS3DOS header on every file. The ULA screen's is
CODE, 6,912 bytes at `$4000`. LoRes, hi-res and hi-colour have header type 4 and Layer 2 type 5,
with load address 0; the viewer names them `LAYER 1` and `LAYER 2`. The pictures after the header are
the layouts above.
