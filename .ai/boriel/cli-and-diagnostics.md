# zxbc 2.0.0-beta29: command line and diagnostics

## The command line Klive uses

```
zxbc <abs>/program.zxbas --arch <zx48k|zx128k|zxnext> -f <bin|z80|nex>
     -o <abs>/out.<ext> --debug=<abs>/out.dbg -M <abs>/out.map -e <abs>/out.err
     -S <org> -O <level> [-H heap] [other option flags]
```

Run it with `cwd` = an empty Klive-owned folder (see `project.ini` below), no shell, stdin closed,
and a timeout that kills the process.

- **`--debug=FILE` changes the generated code**, not only what is written about it (verified
  2026-10-17): the same program built with and without it gives images of different lengths
  (5869 vs 5867 bytes on a Next program; the first difference is a `CALL` target at offset 13), on
  zx48k and zxnext alike. So **every output that must match the debugged code is built with
  `--debug`**: the `.nex`, and the `asm`/`ir` listings. The `.dbg` written beside a `-f nex` run is
  byte-identical to the `-f bin` run's.
- **`USE` searches only the module path (`-m`), which defaults to the cwd**, not the source's
  folder, with or without `--split-modules`. `-m` takes a `:`-separated list. Klive passes the
  source's folder, then the include folders.
- **`--split-modules` on zx48k is an argument error** (exit 2: "architecture 'zx48k' declares no
  banks to split into").
- `--version` prints `zxbc 2.0.0-beta29` and exits 0. It takes about 1 s on a cold launch.
- **`-d` takes no value. Only `--debug=FILE` sets the path.** `-d=FILE` is an argument error, and so is
  `-d FILE`, because the path is read as the program.
- `--parse-only` checks the program, writes **no** files (it leaves earlier outputs untouched), and
  reports errors and warnings as a build does. Exit 0 when there are only warnings.
- The source extension does not matter: `.zxbas` and `.bas` both compile.

## Output formats

| Build | Formats accepted |
| --- | --- |
| Unbanked (all archs) | `bin`, `tap`, `tzx`, `sna`, `z80`, `nex` (zxnext only) |
| `--split-modules`, zx128k | **`tap`, `tzx`, `z80` only.** `bin` → "needs a bank-aware output format"; `sna` → `BankedFormatUnsupported`. |
| `--split-modules`, zxnext | `nex` |

- `sna`/`z80` (and banked z80) require **both** `-B` and `-a` ("Options --BASIC and --autorun are both
  required for snapshot formats").
- The `.dbg` is the same whichever format is written. For zxnext, `-f bin` and `-f nex` give identical
  `.dbg` files.
- A `.nex` contains the code image unchanged. For an unbanked zxnext program at `$8000` it sits at
  file offset 16896 (header 512 + one 16K bank). Default header SP and PC are the org.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success, possibly with warnings |
| 1 | Compile errors (diagnostics in the `-e` file) |
| 2 | Argument errors. The usage text and `zxbc: error: …` go to **stderr even when `-e` is given**, because `-e` has not been applied yet. Klive must capture stderr too. |

## Diagnostics (the `-e` file, or stderr)

One per line:

```
<file>:<line>: error: [E342] Unexpected end of line
<file>:<line>: warning: [W150] Variable 'grid' is never used
<file>:<line>: error: file 'missing.bas' not found
```

- Regex: `^(.*?):(\d+): (error|warning): (?:\[([EW]\d+)\] )?(.*)$`. The code is absent on some
  errors (missing include).
- **No column.** Markers cover the whole line.
- `<file>` is written in the form the compiler was given it. Pass an absolute path → an absolute
  path comes back. A relative path stays relative to the cwd, also for included files
  (`../inc/part.bas`). Always pass absolute paths.
- `--hide-warning-codes` drops the `[Wnnn]` part. Klive must not pass it.
- Errors seen: `E241`, `E302`, `E305`, `E313`, `E342`, `E343`. Warnings: `W150` (never used).
- `W150` is sometimes wrong: an array that is read later (`PRINT a(0)`) was reported as never used.

## The `project.ini` trap

`-F/--config-file` defaults to **`./project.ini` in the working directory**. With a
`[zxbc]` / `org = 40000` file in the cwd, the program silently compiled at 40000, with no
message. Klive runs zxbc in its own empty folder, and passes a project's `project.ini` explicitly
with `-F` only if the user has one (plan §4.1).
