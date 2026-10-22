# z88dk fixtures

Compiler output, committed and **never edited by hand** (`.plans/Z88DK_INTEGRATION_PLAN.md` §0.1).
Each folder holds C sources and a `fixture.json` (`args`: the target arguments, `sources`, and
`"map": false` where the map is too big to commit, `"map": "gzip"` to commit it as `program.map.gz`).

The `tpl-*` folders are the **shipped project templates** (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`):
`"template"` names the machine whose `z88-dk/code/main.c` the script copies in before compiling, and
`"zccArgs"` is the complete argument list Klive's debug build passes, used verbatim.
`test/z88dk/templates.test.ts` fails when a template's source or Klive's arguments drift from them. `npm run z88dk:fixtures [-- <z88dk root>]`
rebuilds every folder with `zcc <args> -debug -m -create-app -o program <sources>`; read the header
of `scripts/z88dk-fixtures.cjs` for the two path normalisations it applies to the maps.

Generated with z88dk v2.4 (build 23854).

| Folder | Target | Outputs |
|---|---|---|
| `zx-hello` | `+zx -lndos` | `program`, `program.map`, `program.tap` |
| `zx-banked` | `+zx`, code in `BANK_1` | `program`, `program.map`, `program.tap`, `program_BANK_1.bin` |
| `zxn-hello` | `+zxn -subtype=nex -clib=classic` | `program`, `program.nex` |
| `zx81-hello` | `+zx81` | `program`, `program.map`, `program.P` |
| `z88-app` | `+z88 -subtype=app` | `program`, `program.map`, `program.epr`, `program.63`, `program.ap0` |
| `zxn-printf` | `+zxn -subtype=nex -clib=classic -lndos`, uses printf | `program`, `program.map.gz`, `program.nex` (the printf-table warning) |
| `tpl-sp48` | 48K template, `+zx` | `program`, `program.map.gz`, `program.tap` |
| `tpl-sp128` | 128K template (also the Pentagon 128), `+zx` | `program`, `program.map.gz`, `program.tap` |
| `tpl-scorpion` | Scorpion ZS-256 template, `+zx` | `program`, `program.map.gz`, `program.tap` |
| `tpl-spp3e` | +2A/+3/+2E/+3E template, `+zx -subtype=plus3` | `program`, `program.map.gz`, `program.dsk` |
| `tpl-timex-tc2048` | Timex template on the TC2048, `+zx` | `program`, `program.map.gz`, `program.tap` |
| `tpl-timex-ts2068` | Timex template on the TC2068/TS2068, `+ts2068` | `program`, `program.map.gz`, `program.tap` |
| `tpl-zxnext` | Next template, `+zxn -subtype=nex -clib=classic` | `program`, `program.map.gz`, `program.nex` |

Each `tpl-<x>` (Debug's build: `-debug -O0`) has a `tpl-<x>-build` twin made as Run and Export build
(`-O2`, no `-debug`): a construct only the optimised build breaks is caught (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`, T5).
