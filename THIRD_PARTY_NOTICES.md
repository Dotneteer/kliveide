# Third-party notices

Klive IDE includes code derived from, and data from, the projects below. Each notice is reproduced
as its licence requires.

## Clock Signal (CLK) by Thomas Harte — MIT

The Sinclair ZX80/ZX81 emulation ports the ULA logic, the memory map, the tape pulse format, the
program-file recognition, the keyboard mapping and the typer tables of Clock Signal
(<https://github.com/TomHarte/CLK>, commit `096de574…`). The derived files carry this notice too:

- `src/emu/machines/zx8081/wasm/zx8081/zx8081.c` and the `zx8081-*.c` files it includes
- `src/emu/machines/zx8081/ZxPFile.ts`, `Zx8081KeyMappings.ts`, `Zx8081Typer.ts`

```
The MIT License (MIT)

Copyright (c) 2015 Thomas Harte

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

## lkesteloot/trs80 by Lawrence Kesteloot — MIT

The HT-1080Z's tape-file reader (`src/emu/machines/ht1080z/Ht1080zTapeFile.ts`) ports the cassette
header detection of lkesteloot/trs80 (`packages/trs80-base/src/Cassette.ts`, commit 11ed9327): the
500-baud header and sync found at any bit offset, and the 1500-baud header refused.

```
MIT License

Copyright (c) 2021 Lawrence Kesteloot

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## The ZX80 and ZX81 ROMs

`src/public/roms/zx80.rom` and `src/public/roms/zx81.rom` (shipped as `roms/zx80.rom` and
`roms/zx81.rom`) are not covered by the MIT licence above, nor by Klive's own. Their notice, kept
beside them in `zx8081-roms-readme.txt`:

```
The ZX80 and ZX81 ROM files may be used free of charge in any non-commercial (i.e., not paid-for) product.
For information on obtaining a commercial license, please contact John Grant.
This notice must be retained.
```

## The ZX Interface 1 ROM

`src/public/roms/if1-2.rom` (shipped as `roms/if1-2.rom`) is the second edition of the Sinclair ZX
Interface 1's 8K ROM, unmodified. It is not covered by the MIT licence above, nor by Klive's own, nor
by Amstrad's permission for the Spectrum ROMs: its rights stayed with Sinclair Research Ltd. No
explicit permission to redistribute it is known: it is included because emulators and distributions
have published it openly for decades, and it will be removed on request from a rights holder. The
details are kept beside it in `if1-roms-readme.txt`.

## The HT-1080Z ROMs

`src/public/roms/ht1080z-s1*.rom`, `ht1080z-s2*.rom` and `ht1080z-s64*.rom` (shipped under `roms/`)
are the BASIC, extension and character-generator ROMs of the HT-1080Z Series I, Series II and
HT-1080Z/64, unmodified. They are not covered by the MIT licence above, nor by Klive's own. Their
rights belong to Microsoft (Level II BASIC), EACA and Hiradástechnika Szövetkezet. No explicit
permission to redistribute them is known: they are included because the HT preservation group
publishes them openly (https://ht.homeserver.hu/, dumps by Majzik István), and they will be removed
on request from a rights holder. The details and the file list are kept beside them in
`ht1080z-roms-readme.txt`.

## The Videoton TV Computer ROMs

`src/public/roms/tvc12-*.rom` and `tvc22-*.rom` (shipped under `roms/`) are the BASIC 1.2 (TVC 64K)
and BASIC 2.2 (TVC 64K+) system and extension ROMs of the Videoton TV Computer, and `tvc-vtdos.rom`
is the VT-DOS ROM of its HBF floppy interface card, unmodified. They are
not covered by the MIT licence above, nor by Klive's own. Their rights belong to Videoton. No
explicit permission to redistribute them is known: they are included because the TVC community
publishes them openly (taken from the rtvc emulator's repository, each image matching MAME's tvc64
and tvc64p sets), and they will be removed on request from a rights holder. The details and the file
list are kept beside them in `tvc-roms-readme.txt`.

## The ZX Spectrum +2A/+3 ROMs

`src/public/roms/spp3-40-*.rom`, `spp3-41-*.rom` and `spp3-41es-*.rom` (shipped under `roms/`) are
Amstrad's +2A/+3 ROMs (v4.0 English, v4.1 English, v4.1 Spanish), unmodified. They are not covered by
the MIT licence above, nor by Klive's own. Their notice and source are kept beside them in
`spp3-roms-readme.txt`:

```
These ROMs are copyright Amstrad, who allow distribution of the ROMs but
retain the copyright. You may not sell the ROMs or embed the ROMs in
hardware, although it is allowed to sell a product which contains the
ROMs, so long as the charge is being made for the product, not for the
ROMs themselves. The copyright messages in the ROMs must be kept.
```
