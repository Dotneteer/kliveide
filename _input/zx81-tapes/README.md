# ZX81 tape files for testing the Klive ZX80/81 machine

Collected 2026-09-27 as test input for `.plans/ZX8081_WASM_PLAN.md` (§9 files and tape, §12 tests).

**Every file here is the repository owner's own work, published under a permissive licence
(MIT, the Unlicense).** Each is pinned to the commit it was taken from. The full licence text of
every source repository is in [`licenses/`](licenses/). MIT requires the copyright notice to travel
with the file, so keep `licenses/` next to the files wherever they are copied (a test fixture folder
included).

Deliberately **not** included:
- Commercial or "abandonware" titles. Their copyright is still held, whatever archive sites say.
- Anything whose licence could not be confirmed.
- NollKollTroll's Zeddy Audio/Video Jukebox (CC0). They need a ZXpand interface (an SD card), which
  the plan does not emulate.

## Files

Columns: *Needs* is the RAM the file itself requires, computed from its end address (`E_LINE`)
against 1K = `$4400`. *Autorun*: whether the file starts itself after loading (from the `NXTLIN`
system variable).

### `1k/` — programs for the unexpanded 1K ZX81
| File | Bytes | Needs | What it exercises | Source (repo @ commit : path) | Licence |
|---|---|---|---|---|---|
| `byteForever.p` | 222 | 1K | A tiny demo. **The system variables hold code/garbage** (VERSN = 38, D_FILE = `$EC14`), a common 1K trick. The loader must not "validate" the system variables beyond E_LINE. | [AdrianPilko/zx81-byte-forever](https://github.com/AdrianPilko/zx81-byte-forever) @ `5bf9d1123837` : `byteForever.p` | MIT |
| `rcar.p` | 863 | 1K | A 1K machine-code game ("Runaway Car"); VERSN = 195 (code in the system variables). Optional ZXpand+AY joystick. | [LardoBoffin/ZX81-Runaway-Car](https://github.com/LardoBoffin/ZX81-Runaway-Car) @ `f3d572d56721` : `rcar.p` | MIT |
| `chess.p` | 1127 | **ends at `$4470`** | "1K chess" in 961 bytes of Z80 code, but the file runs past `$4400`. **A test for the memory-model heuristic** (CLK picks 16K above 1K) and for what a real 1K machine does with it. | [Cronan/zx81-chess](https://github.com/Cronan/zx81-chess) @ `bd766b9995b0` : `chess.p` | MIT |

### `basic/` — BASIC programs
| File | Bytes | Needs | What it exercises | Source | Licence |
|---|---|---|---|---|---|
| `BASE.p` | 943 | 1K | A BASIC listing. **It has 4 bytes after the E_LINE end**, so the loader must tolerate trailing bytes. | [sebastienboisvert/ZX81QuickLook](https://github.com/sebastienboisvert/ZX81QuickLook) @ `ffb278e9d37f` : `Example Programs/BASE.p` | MIT |
| `POKE1.p` | 944 | 1K | Same as above (5 trailing bytes); uses POKE. | same repo : `Example Programs/POKE1.p` | MIT |
| `Characters.P` | 1064 | 16K | Prints the character set. Useful for the **screen golden of every character** (normal and inverse). Upper-case `.P` extension. | same repo : `Example Programs/Characters.P` | MIT |
| `DEC-TO-FP-2.p` | 1729 | 16K | Decimal to floating-point conversion in BASIC (exercises the ROM calculator); autoruns at line 5. | [vegagak/ZXList](https://github.com/vegagak/ZXList) @ `c4e453c7a6b4` : `Test/DEC-TO-FP-2.p` | Unlicense |

### `machine-code/` — machine-code programs (usually a REM-line loader + `RAND USR`)
| File | Bytes | Needs | What it exercises | Source | Licence |
|---|---|---|---|---|---|
| `dezog-sample.p` | 980 | 1K | **Known behaviour, best first test:** waits for **S**, then fills the screen with characters (screenshots in the source repo's `documentation/images/`). Autoruns. | [maziac/zx81-sample-program](https://github.com/maziac/zx81-sample-program) @ `c0298a7d61f7` : `zx81-program.p` | MIT |
| `jump.p` | 8772 | 16K | A platform game. | [AdrianPilko/ZX81-Jump-game](https://github.com/AdrianPilko/ZX81-Jump-game) @ `b3bb3370208b` : `jump.p` | MIT |
| `crazyroids.p` | 6158 | 16K | An asteroids-style game. | [AdrianPilko/zx81-crazy-roids](https://github.com/AdrianPilko/zx81-crazy-roids) @ `cd6ea52546f9` : `crazyroids.p` | MIT |
| `pivaders.p` | 4450 | 16K | An invaders-style game. | [AdrianPilko/zx81-pirate-invaders](https://github.com/AdrianPilko/zx81-pirate-invaders) @ `1a037430b632` : `pivaders.p` | MIT |
| `spaceShooter.p` | 4796 | 16K | A shooter. | [AdrianPilko/zx81-space-shoot](https://github.com/AdrianPilko/zx81-space-shoot) @ `b3dab188fb05` : `spaceShooter.p` | MIT |
| `maze1.p` | 4136 | 16K | A maze game. | [AdrianPilko/zx81-mazes](https://github.com/AdrianPilko/zx81-mazes) @ `4fd3aeebc673` : `maze1.p` | MIT |
| `3d.p` | 2727 | 16K | 3D drawing. | [AdrianPilko/zx81-3d](https://github.com/AdrianPilko/zx81-3d) @ `3f5849f99c4a` : `3d.p` | MIT |

### `display-effects/` — programs that stress the display
| File | Bytes | Needs | What it exercises | Source | Licence |
|---|---|---|---|---|---|
| `LFSR.P` | 1416 | 16K | A full-screen LFSR dissolve effect: exercises the display file and speed. | [cleberjean/LFSR-ZX81](https://github.com/cleberjean/LFSR-ZX81) @ `20cfefebdbf7` : `LFSR.P` | MIT |
| `LFSR3.P` | 1539 | 16K | Version 3 of the same effect; autoruns. | same repo : `LFSR3.P` | MIT |
| `pixelscroll.P` | 1193 | 16K | Plots with block graphics and scrolls the screen up by one pixel, as fast as possible. Checks the block-graphic character mapping. | [developer500/pixelScroll](https://github.com/developer500/pixelScroll) @ `0a743fa07b9f` : `build/test.P` (renamed) | MIT |

### `hi-res/` — hi-res graphics (z88dk-built)
The source README says: *"the hires stuff may need support for WRX graphics on emulator or real zx81"*.
These are the tests for the ULA mechanism in plan §6 (I pointing into RAM, refresh-cycle fetch) and
for the CLK RAM-address question it records.

| File | Bytes | Needs | What it exercises | Source | Licence |
|---|---|---|---|---|---|
| `hrg.p` | 3311 | 16K | Hi-res graphics (z88dk HRG) | [AdrianPilko/zx81-z88dk-experiments](https://github.com/AdrianPilko/zx81-z88dk-experiments) @ `1df1fa3c6ef9` : `hrg.p` | MIT |
| `scroller.p` | 5070 | 16K | A scroller, possibly hi-res | same repo : `scroller.p` | MIT |
| `roids.p` | 7572 | 16K | An asteroids-style game, possibly hi-res | same repo : `roids.p` | MIT |

Which of these actually need WRX (the RAM-pack modification) is not confirmed. Record it when they
are first run against an oracle (EightyOne or CLK).

### `z88dk/`
| File | Bytes | Needs | What it exercises | Source | Licence |
|---|---|---|---|---|---|
| `hello.p` | 3401 | 16K | A z88dk C "hello" (a C runtime start-up on the ZX81). | same z88dk-experiments repo : `hello.p` | MIT |

### `p-and-tzx/` — the same program as `.P` and as `.TZX`
| File | Bytes | What it exercises | Source | Licence |
|---|---|---|---|---|
| `tw_zx81.p` | 6379 | TurboWieszcz, a Polish poem generator (text output). 16K, autoruns. | [monstergdc/TurboWieszcz-ZX81](https://github.com/monstergdc/TurboWieszcz-ZX81) @ `db3f566e260a` : `bin/tw_zx81.p` | MIT |
| `tw_zx81-ok.tzx` | 6506 | **The same program as TZX 1.20**: block `$30` (text description) plus block `$19` (generalized data), the standard ZX81 TZX layout. It is the test for the "TZX ZX81 blocks" follow-up (plan §14). Loading both must end in identical RAM. | same repo : `bin/tw_zx81-ok.tzx` | MIT |

### `edge-cases/` — loader robustness
| File | Bytes | What it exercises | Source | Licence |
|---|---|---|---|---|
| `minimal.p` | 142 | The smallest valid program (system variables, an empty display, no lines). | [vegagak/ZXList](https://github.com/vegagak/ZXList) @ `c4e453c7a6b4` : `Test/minimal.p` | Unlicense |
| `10-REM.p` | 148 | A single `10 REM` line. | same : `Test/10-REM.p` | Unlicense |
| `zero.p` | **0** | **An empty file: must be rejected cleanly**, with no crash and a clear error. | same : `Test/zero.p` | Unlicense |

## How the checks above were made
Each `.P` file is a memory image starting at `$4009` (no name, no header). The checks: file size ==
`E_LINE − $4009`; `D_FILE`/`VARS`/`E_LINE` read from the system variables; the RAM need is
`$4009 + size` against `$4400`. The TZX was walked block by block. The script is in the session
that created this folder. To reproduce it, read the 16-bit values at file offsets `$0B` (E_LINE),
`$03` (D_FILE) and `$07` (VARS).

## Refreshing
All sources are on GitHub and pinned by commit. To update a file, fetch
`https://raw.githubusercontent.com/<repo>/<commit>/<path>`, update the commit column, and check
that the licence in `licenses/` has not changed.
