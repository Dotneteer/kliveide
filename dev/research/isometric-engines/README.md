# Isometric game engines: research pack

Background collected on 2026-11-06 for building a Head over Heels style isometric engine for the ZX
Spectrum Next. Nothing here is a plan. These are the facts from the sources, how two real engines
work, and the design questions a Next engine has to answer.

## Rules of this pack

- Every file cites its sources inline. [SOURCES.md](SOURCES.md) lists them all, with what each one is
  good for and what could not be checked.
- Anything concluded here rather than read in a source is marked *inference*.
- Results from the small simulation described in [02_DEPTH_SORTING.md](02_DEPTH_SORTING.md) are marked
  *simulation*. They use synthetic scenes, not the games' rooms, and nothing here was run on a Next.
- Algorithms are described in this pack's own words. The notes copy no game code, graphics or long
  extracts. The one copy of third-party code is the [head-over-heels-asm/](head-over-heels-asm/) folder.
  See "Using this material" below.

## Read in this order

| File | Covers |
|---|---|
| [01_PROJECTION_AND_COORDINATES.md](01_PROJECTION_AND_COORDINATES.md) | World boxes, the projection formulas of both games, and the "invisible step" every depth rule rests on |
| [02_DEPTH_SORTING.md](02_DEPTH_SORTING.md) | The pair test, why some pairs need no order, cycles, four ways to get a draw order, and how they compare |
| [03_KNIGHT_LORE_ENGINE.md](03_KNIGHT_LORE_ENGINE.md) | Filmation as built: memory, object records, the frame, collision, sprites, room data |
| [04_HEAD_OVER_HEELS_ENGINE.md](04_HEAD_OVER_HEELS_ENGINE.md) | Jon Ritman's engine as seen in the Frankau disassembly: sorted lists, windowed redraw, background columns, room data |
| [05_NEXT_HARDWARE_MAPPING.md](05_NEXT_HARDWARE_MAPPING.md) | What the Next changes: facts, a time budget, three architectures, a prototype order, open questions |
| [06_KNIGHT_LORE_REFERENCE.md](06_KNIGHT_LORE_REFERENCE.md) | Knight Lore at code level: routines by subsystem with links, data tables, sprite drawer details and game systems |
| [SOURCES.md](SOURCES.md) | All sources, with status and reliability |
| [head-over-heels-asm/](head-over-heels-asm/) | Unmodified copies of the 19 Frankau `.asm` files downloaded for this research, in their `src/` layout |
| `binaries/` | Game images to reverse engineer, git-ignored and local only; listed in [SOURCES.md](SOURCES.md#local-copies) |

## The short version

1. The game is a 3D world of axis-aligned boxes. The isometric picture is only how those boxes are
   drawn, and physics never looks at pixels.
2. Depth comes from comparing boxes in pairs, not from a depth buffer. A pair needs an order only when
   one box is behind or level with the other on every axis.
3. Masked sprites are drawn back to front off screen, and only changed rectangles reach the display.
4. Knight Lore re-derives the order among the objects it redraws each frame. Head over Heels keeps a
   sorted list and re-inserts an object when it moves. They also differ in how they rebuild the screen:
   see [the comparison](04_HEAD_OVER_HEELS_ENGINE.md#how-it-differs-from-knight-lore).
5. On the Next, Layer 2 removes the need for masks and hardware sprites can remove pixel copying for
   moving objects. The new problem is occlusion by static scenery, because the layers do not take part
   in the object sort.

## Figures

All in [figures/](figures/) as SVG with a white background, so they read in light and dark viewers.

| Figure | Shows | Used in |
|---|---|---|
| `projection.svg` | Axes and formulas of both games | 01 |
| `depth-table.svg` | Knight Lore's 27-entry comparison table | 02 |
| `sight-lines.svg` | Why boxes separated in opposite senses never overlap on screen | 02 |
| `occlusion-cycle.svg` | A cycle, and splitting a box to break it | 02 |
| `frame-pipelines.svg` | The two frame designs side by side | 03, 04 |
| `masking.svg` | Mask and image on the Spectrum, skip-value copy on the Next | 03, 05 |
| `hoh-draw-order.svg` | The order Head over Heels fills its view window in | 04 |
| `next-options.svg` | Three layer arrangements for a Next engine | 05 |

## Using this material

The disassemblies document copyrighted games. Knight Lore is copyright 1984 Ultimate Play the Game and
Head over Heels is credited to Ritman, Drummond, Stevens, Thorpe and Ocean in the
[CPC disassembly's README](https://github.com/fphenix/headoverheels_cpc). Jon Sole's project keeps none
of the game's bytes in its repository, and neither of the code maps it builds on carries a licence
([its provenance page](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Provenance.html)).
Frankau's README states no licence either.

*Inference:* learn the method from these sources and write your own engine, code, data and graphics. Do
not paste their Z80 or artwork into something you release. This is a working practice, not legal advice.
