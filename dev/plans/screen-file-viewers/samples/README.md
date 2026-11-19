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

**Today**, before the plan is implemented:
- every `.scr`, `.sl2` and `.nxi` above opens, except `BROKEN.SCR`, which is refused;
- `HIRES.NXI` opens as 320×256 until you switch it to 640×256;
- the `.slr`, `.shc` and `.shr` viewers say "not implemented".

## Files the Next writes itself

NextBASIC saves the current picture of a layer with `SAVE "name" LAYER`. To get one file of each
kind written by NextZXOS:

1. In Klive, start the ZX Spectrum Next machine and wait for NextBASIC.
2. For each layer, select it, draw something, and save it to the SD card. Draw with `PLOT`/`CIRCLE`,
   or load one of the samples above with `LOAD "..." LAYER`.

   | Format | Commands |
   |---|---|
   | ULA | `LAYER 0: CIRCLE 128,88,60: SAVE "ula.scr" LAYER` |
   | LoRes | `LAYER 1,0: CIRCLE 64,48,40: SAVE "lores.slr" LAYER` |
   | Hi-res | `LAYER 1,2: CIRCLE 256,96,80: SAVE "hires.shr" LAYER` |
   | Hi-colour | `LAYER 1,3: CIRCLE 128,96,60: SAVE "hicol.shc" LAYER` |
   | Layer 2 | `LAYER 2,1: CIRCLE 128,96,60: SAVE "l2.sl2" LAYER` |

3. Copy the files out of the SD card image (the Disk Explorer or the file manager) and open them in
   Klive.
4. Compare each with what the machine showed. Check the file sizes: does NextZXOS write a PLUS3DOS
   header?

The exact `LAYER` mode numbers and `PLOT`/`CIRCLE` coordinate ranges are from the NextZXOS
documentation as summarised in `dev/research/next-graphics-assets/README.md`. They have not been
tried yet; correct this table when you do.
