# Klive build options → zxbc arguments

The mapping `src/main/boriel-integration/boriel-options.ts` implements
(`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §4.2). Options come from Klive's own pipeline: the
`zxbasic.*` settings (`optionsFromSettings`), then the build root's `'@name value` header (NextBuild's
`'!` aliases included), so one source file builds under both compilers. A unit test
(`test/main/boriel-compiler.test.ts`) fails when a header option is missing from all three groups below.

## Mapped

| Klive option | zxbc |
| --- | --- |
| machine / `target` | `--arch zx48k` (48K, Timex), `zx128k` (128K, Scorpion, **+3**), `zxnext` |
| `optimize` | `-O n` (a debug build: at most 1 unless the header sets it) |
| `optimize-for` | `--opt-strategy speed / size / auto` (balanced) |
| `origin` | `-S` |
| `heap-size` / `heap-address` | `-H` / `--heap-address` |
| `array-base`, `string-base` | `--array-base`, `--string-base` |
| `case-insensitive` | `-i` |
| `sinclair-compatible` | `-Z` (sets both bases to 1 and case-insensitivity, so the base flags are left out) |
| `require-declarations` / `require-types` | `--explicit` / `--strict` |
| `check-memory` / `check-bounds` | `--debug-memory` / `--debug-array` |
| `break-key` / `headerless` | `--enable-break` / `--headerless` |
| `zxnext` | `-N` (not on the Next, where it is implied) |
| `define` | one `-D NAME[=value]` each |
| `include-path` | **one** `-I` with the folders joined by `path.delimiter` (a repeated `-I` keeps only the last one; Windows' `;` is assumed, not yet verified) |
| `disable-warning` / `enable-warning` | `-W n` / `+W n` (the code without its `W`) |
| `expect-warnings` | `--expect-warnings` |
| `nex-stack` | `--set:nex:sp` (Next only) |
| `split-modules` | `--split-modules` on the 128K and the Next (the build then writes `-f z80 -B -a` or `-f nex`); on the 48K a warning, no flag |
| `emit-map` / `emit-asm` / `emit-ir` | the build's `-M` map copied beside the source / an extra `-f asm` / `-f ir` run |

## Export options (no zxbc argument for a build)

`output`, `basic-loader`, `autorun`, `append-block` decide how the IDE exports or starts the program, the
same for both compilers.

## Klive-only (a warning, no effect)

`asm-dialect klive` (zxbasm is Boriel's only dialect; `asm-dialect zxbasm` is silent), `debug-info`
(Boriel builds always write the `.dbg`), `default-byref`, the `codebank-*` options (CODEBANK is Klive
BASIC syntax; Boriel banks MODULEs with `--split-modules`), `nex-entry`, `nex-loading-screen`, `nex-core`.

## Always added by the compiler

`<absolute source path>`, `-f bin -o …`, `--debug=…`, `-M …`, `-e …`, and on the Next a second run with
`-f nex -o …`. Every run after the first (the `.nex`, `@emit-asm`, `@emit-ir`) passes
`--debug=<build folder>/<name>.same-code.dbg` too, deleted afterwards, because the flag changes the
code (`cli-and-diagnostics.md`). `-m <source folder>[:<include folders>]` on every run. `-F <project>/project.ini` only when the project has one. Never `--hide-warning-codes`.
zxbc runs with `cwd` = `<project>/_klive/boriel`.
