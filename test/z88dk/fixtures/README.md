# z88dk fixtures

Compiler output, committed and **never edited by hand** (`.plans/Z88DK_INTEGRATION_PLAN.md` §0.1).
Each folder holds C sources and a `fixture.json` (`args`: the target arguments, `sources`, and
`"map": false` where the map is too big to commit). `npm run z88dk:fixtures [-- <z88dk root>]`
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
