# Boriel BASIC test fixtures

Output of **Boriel BASIC `zxbc` 2.0.0-beta29** (the version `vendor/boriel-basic/kit.json` pins) for
Klive's own small test programs, committed so CI can test the `.dbg` adapter and the debugger without
running zxbc (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`, decision B-T1).

Each folder holds:

| File | What it is |
| --- | --- |
| `program.bas` | the program (Klive's own) |
| `fixture.json` | its zxbc arguments and what it covers |
| `program.bin` | the code image |
| `program.dbg` | the debug file (format `zx-source-debug` 1) |
| `program.map` | the `-M` memory map |
| `program.err` | zxbc's warnings, when it gave any |
| `program.nex` | the Next's `.nex` (`"nex": true`, built with `--debug` too: the flag changes the code) |
| `program.z80` / `program.nex` | instead of `program.bin` for a banked build (`"banked": true`, `--split-modules`): zxbc writes no `bin` then |

`"from": "../other"` builds another fixture's sources (`banked-next` shares `banked-128`'s modules).

## Rules

- **This folder is an exception to D12** ("no zxbc output in Klive"), limited to these fixtures and to
  testing the Boriel BASIC integration. Nobody reads these files, or the kit's runtime, to design
  Klive BASIC (`.plans/ZXBASIC_COMPILER_PLAN.md` §0.1).
- **Licence.** The binaries contain zxbc's runtime library, which its `lib/NOTICE.md` describes as MIT
  (216 runtime files carry no header; see `lib/UNLICENSED_FILES.txt` in the kit). Klive redistributes
  this beta with Boriel's written permission.
- **Never edit the generated files by hand.** Regenerate them:

  ```
  npm run boriel:fixtures -- <path to zxbc>
  ```

  The zxbc comes from that argument, else `BORIEL_ZXBC`, else `~/zxbasic2/zxbc`, and must be the pinned
  version. zxbc runs inside each folder with a relative program name, so the `.dbg` holds no absolute
  path.
- A new fixture is a folder with `program.bas` and `fixture.json`; run the script to build it.
