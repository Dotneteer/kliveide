# ZX80 program files for trying and testing Klive

Sample `.o` files for the ZX80 (4K ROM): the ZX80 counterpart of `../zx81-tapes/`, for the `.O`
viewer and the ZX80 machine.

**The folder follows `../zx81-tapes/`'s rule: only files whose author published them under a
permissive licence (MIT, the Unlicense), or Klive's own.** No third-party file passed it (see below),
so every file here was made in Klive.

## `klive/` — made on Klive's own ZX80

Typed on Klive's ZX80 (the WASM core with the real 4K ROM) and written out as memory from `$4000` up
to `E_LINE`, the bytes a ZX80 `SAVE` writes. They are Klive's own work, under the project's MIT
licence. `test/zx8081-hw/zx80-samples.test.ts` holds the keystrokes, makes them again with
`ZX80_SAMPLES_WRITE=1 npm test -- test/zx8081-hw/zx80-samples.test.ts`, and checks on every run that
each one still loads on the ROM and reads in the viewer.

| File | Bytes | Needs | What it holds |
|---|---|---|---|
| `hello.o` | 69 | 1K | `10 PRINT "HELLO FROM KLIVE"`, `20 GO TO 10`. Made on a 1K ZX80. Not run. |
| `squares.o` | 72 | 1K | A `FOR` loop printing numbers and their squares. Run before saving, so it holds the loop variable `I`. |
| `guess.o` | 142 | 1K | A number-guessing game: `RANDOMISE`, `RND`, `INPUT`, `IF ... THEN`. Not run. |
| `vars.o` | 156 | 1K | One variable of every kind (a number with a long name, a negative number, a string, an array, a `FOR` loop's variable). Run before saving. |

A ZX80 `.O` file has no display file: it lies after `E_LINE` and is not saved. Loading one shows a
cleared screen.

## Third-party files that were considered (2026-10-17)

GitHub was searched for ZX80 `.o`/`.80` files. Only three repositories have any, and none qualifies:

| Repository | Files | Why not |
|---|---|---|
| `markgbeckett/zx80` | 7 (`hexld3.o`, `draughts.O`, `zeller.o`, ...) | No licence: all rights reserved. |
| `tynemouthsoftware/ZX80-4K` | 3 (`AutoBreakout.o`, invaders) | No licence, and conversions of Macronics' commercial games. |
| `nink/sinclair` | `pseudo-hires/examples/DEMO80.o` | The licence could not be confirmed: a one-line MIT note for the converter, the repository's README says "for hobbyist use", and the file is made from a sample photo of unknown origin. |

Every MIT-licensed ZX80 repository found (`abaffa/zx80_emulator`, `xiety/zx80`,
`CodingAP/szx80-emulator`, `manaty/game-zx80`, `cosmindxu/hc91emu`, ...) holds no program files.
Recheck before adding one, and keep a licence file next to any third-party file, as `../zx81-tapes/`
does.
