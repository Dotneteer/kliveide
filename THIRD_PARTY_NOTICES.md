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

## The ZX80 and ZX81 ROMs

`src/public/roms/zx80.rom` and `src/public/roms/zx81.rom` (shipped as `roms/zx80.rom` and
`roms/zx81.rom`) are not covered by the MIT licence above, nor by Klive's own. Their notice, kept
beside them in `zx8081-roms-readme.txt`:

```
The ZX80 and ZX81 ROM files may be used free of charge in any non-commercial (i.e., not paid-for) product.
For information on obtaining a commercial license, please contact John Grant.
This notice must be retained.
```
