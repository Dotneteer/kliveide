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
- **`+zx81` / `+zx80`**: the `.P`/`.O` holds a BASIC program whose `REM` line carries the code; the
  program is started by `RUN`. Klive loads it as a program file (Run and Debug do what
  `tape-load -r`/`-d` does). The ZX80's `CRT_ORG_CODE` (`$408D`) is not Klive's REM body (`$402B`), so
  Klive's own REM-line injection cannot place z88dk code: Inject is refused on both machines.
- **Checked on the real cores** (`test/z88dk/z88dk-run.core.test.ts`): the `+zx` image poked at `$8000`
  and called returns to the 48K's BASIC loop with `main`'s results in memory; the ZX81 `.P` loads and
  runs. The classic `+zx` console draws its **own font**, not the ROM's characters, so a screen test
  looks for ink rather than ROM text.
- **`+z88 -subtype=app`**: a card application; OZ starts it from the Index. It cannot be injected.

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

## Banked code

See `map-format.md`, "Banked code": `p_BANK_n.bin` per used bank, map addresses `n << 16 | addr`.
