# Targets Klive builds for

Observed with v2.4 on 2026-10-18 (`zcc <target> -debug -m -create-app -o p m.c`, sccz80, classic
library). Each target option is a **separate argument** (`+zx`, `-subtype=plus3`).

| Klive machine | Arguments | Outputs | `CRT_ORG_CODE` | Notes |
|---|---|---|---|---|
| sp48, sp128, scorpion | `+zx` | `p`, `p.tap` (BASIC loader + code) | `$8000` | `printf` needs `-lndos` (else `undefined symbol: writebyte`) |
| spp3e | `+zx -subtype=plus3` | `p`, `p.dsk` | `$8000` | a +3 disk image |
| timex | `+ts2068` | `p`, `p.tap` | `$9C40` | |
| zxnext | `+zxn -subtype=nex -clib=classic` | `p`, `p.nex` | `$8000` | the default `+zxn` library is `sdcc_iy`, which cannot `-debug` |
| zx81 | `+zx81` | `p`, `p.P` | `$4082` | the `.P` is a complete program file |
| zx80 | `+zx80` | `p`, `p.O` | `$408D` | |
| z88 | `+z88 -subtype=app` | `p`, `p.epr` (32K), `p.63`, `p.ap0` | `$C000` | the source must define the application DOR (below) |

- `p` (no extension) is the raw image that starts at `CRT_ORG_CODE`.
- `-clib=new` (`+zx`) writes `p_CODE.bin` and leaves `p` empty; Klive builds with the classic
  library unless the project asks otherwise.

## Entry and exit

- **`+zx` classic**: the crt0 saves SP on entry (`__restore_sp_onexit`) and on exit restores it,
  sets `HL'` to 10072 for the ROM and executes `ret`. Started as a subroutine (Klive's inject with
  `subroutine: true`, and `RANDOMIZE USR` from the tape's loader) it returns to its caller.
  The crt0 calls `_main` with `call` and runs `crt0_exit` after it.
- **`+ts2068`** uses the same crt0 (`lib/config/ts2068.cfg` names `target/zx/classic/spec_crt0`).
  **`+zxn -subtype=nex -clib=classic`** links `target/zxn/classic/ram_crt0.asm`, which has the same
  shape (`ld (__restore_sp_onexit+1),sp`, `call _main`, restore SP, `ret`).
- **A `.nex` must not return from `main`.** `.nexload` (`_input/nexload.asm`, `.go`) loads SP from the
  NEX header, discards its own stack and enters the program with `rst $20`; it pushes no return
  address. Its only way back to BASIC is a header PC of 0 (load without running). The classic Next
  crt0 above restores the entry SP and `ret`s, which under `.nexload` jumps to a garbage address
  (observed: SP `$0001`, then a reset). End a Next program with an endless loop, or soft-reset
  (NextReg `$02` bit 0) to go back to NextZXOS: `ZXN_WRITE_REG(0x02, 1)` (`<arch/zxn.h>`) builds with the
  classic library and resets the Next core (checked); `ZXN_NEXTREG(0x02, 1)` does not link there
  (`undefined symbol: _ZXN_NEXTREG_0x02_1`). The Next template does the former, with
  `while (1) {}`: **`for (;;) {}` after a loop fails to link at `-O2`** (`undefined symbol: i_5`,
  sccz80's optimiser drops labels the code still uses); `while (1)` and a `goto` loop link at every level.
- **z88dk v2.4 bug - `+zxn -clib=classic` programs that use `printf` may not start.** The Next's
  classic crt (`target/zxn/classic/ram_crt0.asm`) leaves `SECTION code_crt_init` current before
  `zxn_crt0.asm` includes `crt/classic/crt_runtime_selection.inc`, which has no `SECTION` of its own,
  so `__printf_format_table` (a `'d'` byte and the `%d` handler's address, ...) is linked into
  `crt0_init`'s fall-through path and **executed as code**. `crt0_init` begins with `xor a`, so
  carry is clear: when the `%d` handler's low byte is `$D0` (`ret nc`), `crt0_init` returns before
  it sets the console's print vector `__zx_print_routine`, and the first `printf` jumps to 0
  (observed: the template built `-O2` without `-debug`, handler `$85D0`). With another low byte
  (`-debug`, handler `$8604`: `inc b`) it runs on and works - by luck. A program without `printf`
  gets no table. On `+zx` and `+ts2068` the table follows `ret`/`jp (hl)` (`C9 E9`) and is never
  executed (`spec_crt0.asm` includes the runtime selection before it opens `code_crt_init`).
  Klive's build warns (`ZCC-PRINTF`) when the map shows the table in `code_crt_init`; the Next
  template prints with `putchar` instead.
- **sccz80's line look-ahead and Step Out**: in `f(g(x));` the code after `g` returns is recorded on
  the next line, so Step Out from `g` shows the following line. Keep a call whose return the user
  will step out to in a statement of its own (`y = g(x);`), as the Next template does.
- **`+zx81` / `+zx80`**: the `.P`/`.O` holds a BASIC program whose `REM` line carries the code; the
  program is started by `RUN`. Klive loads it as a program file (Run and Debug do what
  `tape-load -r`/`-d` does). The ZX80's `CRT_ORG_CODE` (`$408D`) is not Klive's REM body (`$402B`), so
  Klive's own REM-line injection cannot place z88dk code: Inject is refused on both machines.
- **Checked on the real cores** (`test/z88dk/z88dk-run.core.test.ts`): the `+zx` image poked at `$8000`
  and called returns to the 48K's BASIC loop with `main`'s results in memory; the ZX81 `.P` loads and
  runs. The classic `+zx` console draws its **own font**, not the ROM's characters, so a screen test
  looks for ink rather than ROM text.
- **`+z88 -subtype=app`**: a card application; OZ starts it from the Index. It cannot be injected.

## Run on every Spectrum family model (checked 2026-10-22)

The shipped `z88-dk` templates run, return to BASIC and keep the ROM's interrupt going on: the 48K
(PAL, NTSC); the 128K and the Pentagon 128; every +2A/+3/+2E/+3E model; the Scorpion on the 128K ROMs;
the TC2048 (`+zx`, on the shipped 48K ROM and on its own); the TS2068 (`+ts2068`, its own ROM). The Next's
`.nex` runs its program when loaded directly. With its own ROM the Scorpion refuses Run: Klive does not
know that ROM's editor. Tests: `test/z88dk/z88dk-templates-run*.core.test.ts`. Not checked: the TC2068
(no ROM to hand).

Source-level debugging of the templates (a breakpoint in `square`, Step Over/Out, Continue, the Call
Stack and Variables) works the same on the 48K, the 128K through the 48 BASIC injection, the TS2068
(`+ts2068`, `$9C40`) and the Next's `.nex`: `test/z88dk/z88dk-templates-debug.core.test.ts`.

## Z88 applications

The application's DOR comes from `<application.h>`, included after defining its fields:

```c
#include <dor.h>
#define APP_NAME "KliveC"
#define APP_INFO "Made with Klive"
#define APP_KEY  'K'
#include <application.h>
```

Without it the link fails with `undefined symbol: applname`. `-create-app` writes a ready 32K
EPROM image `p.epr` (no conversion from `.63`/`.62` is needed on v2.4); the Insert Card dialog
loads `.epr` files.

## The 128K family

- Klive's **128 BASIC** injection flow starts injected code from the editor loop with **ROM 0** (the
  128 editor ROM) paged in. A real `USR` from 128 BASIC runs machine code with the 48K ROM paged, and
  the classic crt0 calls 48K ROM routines, so a z88dk program injected that way crashes into the ROM
  (seen at `$05EF`). Klive therefore injects non-banked z88dk builds on the 128K, +3 and Scorpion
  through the **48 BASIC** flow (model `sp48`), checked on the 128K and +3 cores.
- 48 BASIC locks the paging, so a **banked** build cannot run that way. appmake's `.tap` for a banked
  build carries a BASIC loader that loads and pages the banks; loaded through the Tape Loader it runs
  and the banked call returns (checked on the 128K core). Run uses that tape for banked builds on the
  128K and the Scorpion. The +3 target writes only a `.dsk`, so banked +3 builds are export-only.

## Banked code

See `map-format.md`, "Banked code": `p_BANK_n.bin` per used bank, map addresses `n << 16 | addr`.
