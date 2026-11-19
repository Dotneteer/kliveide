# ZX Spectrum Next graphics assets: other tools, formats and build support

Research for two planned Klive features (2026-11-19):

1. editors for Next bitmaps (Layer 2, tiles and tilemaps, sprites, palettes), and
2. Klive Z80 Assembler pragmas that load an image file and emit it in the format the program uses.

The report covers how other Next tools design, save, manage and compile these assets. It also says
what Klive already has and what that suggests for the design. Facts about other tools come from the
sources linked inline. Items marked *unverified* could not be confirmed from a primary source.

## 1. Summary

- **No Next-targeting assembler converts images into sprites, tiles, maps or palettes at build
  time.** The usual pipeline is: draw in a general paint tool, run a separate converter (mostly
  Gfx2Next), then `INCBIN` the raw output. The only exception is sjasmplus's `SAVENEX SCREEN BMP`,
  which covers NEX *loading screens* only. Build-time conversion would be new ground for Klive.
- **The de facto formats are headerless, hardware-native dumps:**
  - `.spr` (pattern RAM)
  - `.nxt` (tile definitions)
  - `.nxm` (map)
  - `.nxi` (Layer 2 pixels, optionally with a 512-byte palette first)
  - `.pal`/`.nxp` (palette, 512 bytes; 256 in the RGB332 variant)

  None of them records its dimensions or bit depth. Tools infer these from the file size or take
  them as options.
- **Gfx2Next's option set is the de facto spec** for conversion choices: tile deduplication with
  mirror/rotate, 4-bit colours, palette embed/external/min/std, map 8/16-bit, bank splitting, ZX0
  compression and asm output. A Klive pragma family should cover the same ground with Klive syntax.
- **No IDE combines asset editing with the live machine.** DeZog shows sprites only. Klive already
  has Sprite, Tilemap and Layer 2 Inspectors plus `.spr` and palette editors, so it is well placed.

## 2. What Klive already has

| Extension | Panel (`src/renderer/registry.ts`) | Notes |
|---|---|---|
| `.spr` | `SPR_EDITOR`: full editor (`src/renderer/features/sprite-editor/`) | 8-bit and 4-bit patterns; the format and palette offset are view settings (`dev/plans/SPRITE_EDITOR_4BIT_PLAN.md`) |
| `.pal`, `.npl` | `PAL_EDITOR` / `NPL_EDITOR` (`PaletteEditor.tsx`) | 256 x 2 bytes; `.npl` adds a transparency byte |
| `.nxi`, `.sl2` | `NXI_EDITOR` / `SL2_VIEWER`: both are the **viewer** `Layer2FileViewerPanel` | Parsed by `src/common/zxnext/layer2/layer2File.ts`: 49,152 or 81,920 bytes, optionally after a 512-byte palette |
| `.scr`, `.shc`, `.shr`, `.slr` | Viewers | |
| `.png`, `.bmp`, `.gif`, ... | `IMAGE_VIEWER` | |

Assembler: `.includebin "file"[, offset[, length]]`, `.defg`/`.defgx` (1-bit pattern strings),
`.copper` and `.savenex` (with screen/palette subcommands). See
`docs/content/en/reference/z80-assembler/pragmas.mdx`.

> **Fixed during this research:** the wiki defines `.sl2` as a **128-byte +3DOS header plus 49,152
> bytes** with no palette (https://wiki.specnext.dev/File_Formats). `parseLayer2File` accepted only
> the bare sizes, so it rejected such a file (49,280 bytes). It now skips a valid PLUS3DOS header
> (signature and checksum, `parseHeader` in `src/common/diskfs/plus3dos.ts`) before judging the size.
> No `.sl2` exists on the bundled SD cards, so the test uses a header built by `withHeader`. The
> `.scr` viewer had the same gap (a headed `.scr` is 7,040 bytes) and now skips the header too.

## 3. Tools other developers use

### Converters (the build step everyone runs outside the assembler)

**Gfx2Next**, by Ben Baker (headkaze / benbaker76)
- MIT licence, cross-platform CLI: https://github.com/headkaze/Gfx2Next
- Input: uncompressed 8-bit BMP, PNG or Aseprite file.
- Outputs:
  - `.nxi` bitmap
  - `.spr` sprites or font
  - `.nxt` tiles
  - `.nxm` map
  - `.nxb` blocks/metatiles
  - `.nxp` palette
  - `.scr`
  - `.tmx` Tiled
- Usage: `gfx2next [options] <srcfile> [<dstfile>]`. Option groups (README, spot-checked):
  - **Mode:** `-font`, `-screen` (with ULA attribute-clash heuristics), `-bitmap`, `-bitmap-y`,
    `-bitmap-size=XxY`, `-sprites`, `-frame=n` (Aseprite frame).
  - **Tiles:** `-tile-size=XxY`, `-tile-norepeat`, `-tile-nomirror`, `-tile-norotate`, `-tile-y`,
    `-tile-offset=n`, `-tile-offset-auto`, `-tile-pal=n`, `-tile-pal-auto`, `-tile-none`,
    `-tile-planar4`.
  - **Tiled:** `-tiled`, `-tiled-tsx`, `-tiled-file=`, `-tiled-blank=n`, `-tiled-width=n`.
  - **Blocks:** `-block-size=XxY|n`, `-block-norepeat`, `-block-16bit`.
  - **Map:** `-map-none`, `-map-16bit`, `-map-y`, `-map-sms`.
  - **Banks:** `-bank-8k`, `-bank-16k`, `-bank-48k`, `-bank-size=n`, `-bank-sections=...`.
  - **Colour:** `-color-distance` (default), `-color-floor`, `-color-ceil`, `-color-round`,
    `-colors-4bit`, `-colors-1bit`.
  - **Palette:** `-pal-file=`, `-pal-embed` (prepend), `-pal-ext` (separate `.nxp`, default),
    `-pal-min`, `-pal-full`, `-pal-std`, `-pal-none`, `-pal-rgb332`, `-pal-bgr222`, `-pal-zx`.
  - **Compression:** `-zx0` and per-asset `-zx0-*`.
  - **Asm:** `-asm-z80asm`, `-asm-sjasm`, `-asm-file=`, `-asm-start`, `-asm-end`, `-asm-sequence`.
  - **Debug:** `-preview` (PNG previews), `-debug`.

**zxnext_bmp_tools**, by Stefan Bylund
- MIT licence, C: https://github.com/stefanbylund/zxnext_bmp_tools
- `nextbmp` rewrites an 8-bit BMP's palette into Next colours: `-round`/`-ceil`/`-floor`,
  `-min-palette`, `-std-palette`, `-4bit`.
- `nextraw` writes `.nxi`, prepending the palette by default: `-sep-palette` (separate `.nxp`),
  `-no-palette`, `-4bit`, `-columns` (column-major, for 320/640).

**Spectrum Asset Maker** (spectiledtool), by Chris Owen
- MIT licence: https://github.com/clebin/spectiledtool
- One JSON config drives every asset.
- Input: Tiled `.tmj`/`.tsj` and indexed PNG/GIF.
- Output: `.nxt`, 1- or 2-byte maps, `.pal` at 1 or 2 bytes per entry, 4/8-bit `.spr`, and `.nxi`
  by rows or columns. Optional RLE/ZX0, with asm, bin or C output.
- This is the closest thing to a declarative "asset manifest" in the ecosystem.

**Jim Bagley's tools**
- `convert2NextSpr`, `nextpal` (a Photoshop `.act`), BMPtoNext and NextGrab:
  https://www.specnext.com/jim-bagleys-sprite-tools/
- His `.BMPCONV` dot command (2018) ships with NextZXOS. It converts BMP to NextBASIC tiles/maps,
  with switches `-i -b -8 -t -2 -r`:
  https://gitlab.com/thesmog358/tbblue/-/raw/master/docs/dotcommands/BMPCONVreadme.txt

### Editors

| Tool | Where | Edits | Files | Source |
|---|---|---|---|---|
| Remy Sharp's sprite / palette / map editor | Web | 8/4-bit sprites (16x16, 8x8), palette with priority bit and offset, a tile map editor, animation preview, PNG import | Reads and writes `.spr`, `.pal` (512 bytes) and `.map` (1 byte per cell, no header; *exact serialisation unverified*). Imports JASC `.pal`, `.gpl`, `.act`, `.aco` and indexed PNG/BMP. Exports asm/BASIC data, PNG, BMP, `.piskel`, `.gpl` | https://zx.remysharp.com/sprites/, https://github.com/remy/zx-tools (MIT) |
| `.SPREDIT` | On the Next (NextZXOS) | Sprites | `.spr` (the Browser association) | https://gitlab.com/thesmog358/tbblue (`dot/`) |
| NXPaint (shrek128) | On the Next | L2 256x192, 320x256, 640x256x4, ULA | Loads `.nxi` with or without a palette, `.sl2`, `.scr`, `.npr`. Saves `.nxi` with a palette, `.scr`, `.npr` | https://shrek128.itch.io/nxpaint |
| Krystle Designs (Leeorg) | On the Next, with a mouse | Sprites, tiles, tilemaps, fonts, palettes, screens | Only `.spr` is documented | https://leeorg.itch.io/krystle-designs |
| ZX Next Studio (Serdjuk) | Windows | Maps, metatiles, conversion: 4/8-bit sprites and tiles, all L2 modes | Banked 8K/16K binaries plus an asm address map; project file `.zxngc` | https://serdjuk.itch.io/zxnextstudio |
| UDGeedNext (em00k) | Windows, bundled with NextBuild | Sprites and UDGs with the full Next palette | *unverified* | https://www.specnext.com/udgee-sprite-editor/ |
| Aseprite / Tiled plus plugins | Desktop | Everything, via export | Spectre's Plugins export "direct to Next formats" (*formats unverified*). Gfx2Next reads `.aseprite` and writes `.tmx` | https://spectrepaul.itch.io/spectres-plugins |

No dedicated editor was found for relative/anchor sprite composition, for copper lists, or for
Radastan. A search found no evidence that "NextGraphics", "img2nxi" or a standalone "NextPal"
exist.

## 4. File formats (byte layouts)

| Format | Layout | Defined by |
|---|---|---|
| Sprite pattern | 8bpp: 256 bytes per 16x16 pattern, 64 in 16K. 4bpp: 128 bytes, high nibble on the left, 128 patterns. Row-major. Transparent = NextReg `$4B` (default `$E3`; its low nibble for 4bpp) | https://wiki.specnext.dev/Sprites |
| `.spr` | Headerless pattern dump. `SPRITE BANK` takes 16K | Convention (no spec) |
| Tile definition (`.nxt`) | 32 bytes per 8x8 4bpp tile; 8 bytes per 1bpp text-mode tile. Headerless | Hardware: https://wiki.specnext.dev/Tilemap; file: Gfx2Next convention |
| Tilemap (`.nxm`) | 40x32 or 80x32 cells. Each is a tile byte plus an attribute byte, or the tile byte only when NextReg `$6B` bit 5 is set. Attribute: b7-4 palette offset, b3 X mirror, b2 Y mirror, b1 rotate, b0 ULA-over or tile bit 8. Gfx2Next writes 8- or 16-bit (`-map-16bit`; its bit layout is not documented in the README) | Wiki Tilemap; Gfx2Next |
| Layer 2 | 256x192: 48K, row-major, banks 9-11 by default (NextReg `$12`). 320x256 and 640x256x4: 80K, **column-major**, 4bpp high nibble on the left. NextReg `$70` sets mode and palette offset | https://wiki.specnext.dev/Layer_2 |
| `.nxi` | 49,152 bytes of pixels, or 49,664 with a 512-byte palette first. Bylund's `nextraw` prepends the palette by default; Gfx2Next writes a separate `.nxp` unless `-pal-embed` | https://wiki.specnext.dev/File_Formats |
| `.sl2` | 128-byte +3DOS header plus 49,152 bytes, no palette | Same page |
| `.slr` / `.shc` / `.shr` | LoRes 128x96 8bpp, 12,288 bytes / Timex hi-colour / Timex hi-res 512x192 (6,144 + 6,144 bytes) | Same page; sjasmplus docs |
| Palette entry | 9-bit via NextReg `$44`: `RRRGGGBB`, then `P000000B` (P = Layer 2 priority). 8-bit via `$41`: `RRRGGGBB` | https://wiki.specnext.dev/Palettes |
| `.pal` / `.npl` / `.nxp` | `.pal` is 512 bytes. `.npl` is 512 bytes plus 1 transparency byte. `.nxp` is 512 bytes, or 256 (Gfx2Next `-pal-rgb332`), or 32 (Bylund `-4bit`) | Wiki File_Formats; tool READMEs |
| `.nex` screens | Header byte 10 flags: 1 = L2, 2 = ULA, 4 = LoRes, 8 = HiRes, 16 = HiColour, 128 = no palette. After the 512-byte header, in order: palette, L2, ULA, LoRes, HiRes, HiColour, 320/640 (V1.3), copper, banks | https://wiki.specnext.dev/NEX_file_format; sjasmplus docs |

NextBASIC consumes these raw files through the following commands
(https://gitlab.com/thesmog358/tbblue/-/tree/master/docs/nextzxos):
- `LOAD f$ BANK n[,off,len]`
- `LOAD f$ LAYER`, which loads 6.75K, 12K or 48K by the current layer, so it cannot load 320/640
  screens
- `SPRITE BANK`
- `LAYER/SPRITE PALETTE n BANK b,off`, which reads 256 or 512 bytes according to `PALETTE DIM 8|9`
- `TILE BANK`/`TILE DIM`, which are software tiles drawn on Layer 2, not the hardware tilemap

## 5. Assembler-side support elsewhere

**sjasmplus**: https://z00m128.github.io/sjasmplus/documentation.html, checked directly.
- `INCBIN <file>[,<offset>[,<length>]]`; a negative value counts from the end of the file.
- Loading screens:
  - `SAVENEX SCREEN L2|LR [page,off[,palPage,palOff]]`
  - `SAVENEX SCREEN L2_320|L2_640` (80K, already transposed)
  - `SAVENEX SCREEN BMP <file>[,savePal[,palOffset]]`
  - `SAVENEX SCREEN (SCR|SHC|SHR) [hiResColour]`
  - `SAVENEX SCREEN TILE <$6B>,<$6C>,<$6E>,<$6F>[,storeBank5]`
- Palette: `SAVENEX PALETTE NONE|DEFAULT|MEM page,off|BMP file`.
- The BMP form is the only image import. It takes uncompressed 8-bit indexed BMPs only, at 256x192,
  128x96, 320x256 or 640x256 (the top 4 bits are used). Colours are **truncated** to 3:3:3, with no
  quantisation or dithering.
- No sprite or tile import. Its embedded Lua is statically linked, so it cannot load a native PNG
  decoder.

**Other assemblers**
- z88dk `z80asm` has `BINARY`/`INCBIN`; Gfx2Next can write z80asm-style asm.
- RASM has `INCBIN` with on-the-fly crunching and no image import:
  https://github.com/EdouardBERGE/rasm
- Pasmo and zasm: binary include only (*detail unverified*).

**NextBuild / Boriel BASIC**: https://github.com/em00k/NextBuild
- Runtime NextLib calls: `LoadSDBank("file",addr,len,off,bank)`, `LoadBMP`, `InitSprites`,
  `PalUpload`.
- `nextbuild.py` scans the source for `LoadSDBank(` and packs those files into the NEX.
- `'!bmp=<file>` sets the NEX loading screen.

**DeZog** (VS Code) shows sprite attributes and patterns only: https://github.com/maziac/DeZog

## 6. The typical workflow today

1. Draw in Aseprite, GIMP, Photoshop or Tiled using a Next palette (`nextpal.act`, or Remy's
   `.gpl`).
2. Convert with Gfx2Next, zxnext_bmp_tools or Spectrum Asset Maker. The output is often split into
   8K banks and ZX0-compressed.
3. `INCBIN` the result in sjasmplus, place it with `MMU`/`SAVENEX BANK`, and add a loading screen
   with `SAVENEX SCREEN BMP`.
4. Round-trip on the machine with `.SPREDIT`, NXPaint or Krystle Designs.

Steps 1-2 sit outside the build. Change the PNG, forget to re-run the converter, and the program
silently uses stale data.

## 7. Implications for Klive

### Editors

- **Save the hardware-native, headerless formats** (`.spr`, `.nxt`, `.nxm`, `.nxi`, `.pal`/`.nxp`)
  so files round-trip with Gfx2Next output, NextBASIC `LOAD ... BANK` and the on-device editors.
  Keep what the file cannot carry (dimensions, bpp, palette offset, tile size, map width, linked
  palette or tileset) the way the `.spr` editor already does: in view state, or in an optional
  sidecar.
- **One editor model for every indexed raster**, as in the `.spr` plan's D1: values per pixel, with
  packing (4bpp nibbles, column-major L2) only at the file boundary. Sprites, tiles, Layer 2 and
  LoRes then share the raster tools.
- **The tilemap editor needs two documents at once**: a tileset (`.nxt`) and a map (`.nxm`) with
  per-cell attributes (palette offset, mirror, rotate). Neither file names the other.
- **The Layer 2 editor should cover 320x256 and 640x256x4.** The on-device tools and NextBASIC
  barely support them, so this is a differentiator.
- **Links to the live machine** are what no competitor has: "send to pattern RAM / tilemap / L2
  banks" and "capture from the machine into a file". The Sprite, Tilemap and Layer 2 Inspectors
  already decode the live data.
- **Import paths others expect:** indexed PNG/BMP, Aseprite, Tiled `.tmx`/`.tmj`, and the palette
  formats `.gpl`, `.act` and JASC `.pal`.

### Pragmas: a sketch for discussion, not a decision

The aim is to make the conversion part of the build, so a changed PNG rebuilds:

```z80klive
.incsprites  "hero.png"   [, bpp: 8|4] [, size: 16x16] [, transparent: $E3]
.inctiles    "level.png"  [, bpp: 4] [, dedupe] [, mirror] [, rotate]   ; tile definitions
.inctilemap  "level.png"  [, attr] [, tileOffset: n]                      ; map from the same image
.inclayer2   "title.png"  [, mode: 256x192|320x256|640x256]               ; column-major when needed
.incpalette  "title.png"  [, bits: 8|9] [, first, count]
```

Questions to settle in a plan:
- **Banking.** A 48K/80K Layer 2 picture does not fit one `.org` window. Should the pragma spill
  across `.bank`s, or emit a slice (`offset, length`, as `.includebin` does)?
- **Colour matching.** Should source colours be exact indices only (an indexed image whose palette
  must already be Next colours), or quantised? sjasmplus truncates; Gfx2Next offers
  distance/floor/ceil/round. Exact-or-error is the safer default.
- **Symbols.** Should the pragmas define labels such as `hero_count` and `level_width`, or should a
  plain-expression query (`imagewidth("x.png")`) cover that?
- **Input set.** PNG and BMP only, or also Klive's own `.spr`/`.nxt`/`.nxi`? `.includebin` already
  covers raw files.
- **Compression** (ZX0), as Gfx2Next and RASM offer it.
- **Dependency tracking**, so the IDE rebuilds when an image changes.
- **Shared code.** The same conversion code should serve the editors' import and the pragmas.

## Sources

The primary sources are linked inline. The web survey was done by a research agent and
spot-checked for this report against these sources:
- the Gfx2Next README (options and formats confirmed)
- the sjasmplus documentation (`SAVENEX SCREEN`/`PALETTE`, `INCBIN`, no image import confirmed)
- wiki.specnext.dev File_Formats (`.sl2`, `.nxi`, `.pal`, `.npl` confirmed)
