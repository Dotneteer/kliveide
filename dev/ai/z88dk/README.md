# z88dk — what Klive relies on

Facts about z88dk that the C integration (`.plans/Z88DK_INTEGRATION_PLAN.md`) depends on, recorded in
Klive's own words from **observed output** of the released binaries (v2.4 and v2.3, macOS) and the
public wiki. No z88dk source is translated into Klive (plan §0.1): Klive runs `zcc` and parses the
files it writes.

| File | What it records |
|---|---|
| `releases.md` | GitHub release assets per platform, the archive layout, digests |
| `map-format.md` | The linker map (`-m`), with `-debug`: line records, symbols, sections |
| `cdb-records.md` | The `__CDBINFO__` records: functions, variables, struct types, frame offsets |
| `targets.md` | Per-target command lines, outputs, origins and entry/exit conventions |

## Versions

| Release | `zcc` banner (no arguments) | Build |
|---|---|---|
| v2.4 (2025-10-02) | `zcc - Frontend for the z88dk Cross-C Compiler - v23854-4d530b6eb7-20251002` | 23854 |
| v2.3 (2023-12-20) | `... - v22110-51889e5300-20231220` | 22110 |

- `zcc` has **no `--version`** option. Running it with no arguments prints the banner as the first
  line of **stderr** (the usage text follows) and **exits 0**. The version is `v<build>-<hash>-<yyyymmdd>`; Klive
  compares the build number. **Supported: build 23854 (v2.4) and newer** (decision C3).
- A release folder installed by Klive carries `.klive-z88dk.json` (`{ releaseTag, assetName, installedAt }`).

## Layout of an install

```
<root>/bin/zcc[.exe]           the driver
<root>/bin/z88dk-*             the tools zcc runs (ucpp, sccz80, zsdcc, copt, z80asm, appmake, ...)
<root>/lib/config/<target>.cfg one file per target; zcc reads it through ZCCCFG
<root>/include, <root>/lib     headers and libraries
```

- **Every zcc run needs `ZCCCFG=<root>/lib/config`** (otherwise: `Can't find configuration file for
  target ...`), and `<root>/bin` first on `PATH` (zcc runs its tools by name). Klive's resolver
  (`z88dk-resolver.ts`) builds that environment; the dialog's test and the compiler both use it.
- The same message appears when an argument is malformed: a target string containing spaces (for
  example `"+zx -subtype=plus3"` passed as one argument) is read as the target name.
- The installed tree is ~410 MB (v2.4 macOS), 28 920 files.

## macOS

- The binaries are **universal** (x86_64 + arm64): one asset serves both architectures.
- Downloaded files carry `com.apple.quarantine` when a browser downloaded them; Klive's own download
  does not set it, but the installer still runs `xattr -dr com.apple.quarantine <root>` (harmless when
  absent) so a folder copied from a browser download works too.
- The zip records Unix modes (made-by 3); every file in `bin/` has its executable bit, so extracting
  with modes is enough. No symlinks; compression methods 0 and 8 only.

## Detection (where an existing install is looked for)

Checked by `getZ88dkPathSuggestions`, in this order; an entry counts only when `bin/zcc` and
`lib/config` both exist:

1. `zcc` on `PATH` → its parent's parent;
2. the `Z88DK` environment variable (a root), and `ZCCCFG` (`<root>/lib/config`);
3. `~/z88dk`, `~/KliveTools/z88dk/*`, `/opt/z88dk`, `/usr/local/share/z88dk`, `/usr/share/z88dk`,
   `/opt/homebrew/share/z88dk`, `/snap/z88dk/current`, `C:\z88dk`, `C:\Program Files\z88dk`.

Only `~/z88dk` (an unzipped release) and Klive's own download folder were verified. The distro, snap
and Homebrew locations are best guesses; a package that splits `bin/` from `lib/config` is not
detected and is set up through *Choose folder…* only if it has both under one root.

## Debug information (summary)

`zcc -debug -m` (sccz80) writes, into the map, a record for every C line, every assembly line of the
crt0, every symbol, and SDCC-CDB-style type records. With `-debug`, sccz80 also **keeps a frame
pointer chain**: every function starts with `call l_debug_push_frame` and leaves through
`call l_debug_pop_frame` (details in `cdb-records.md`, "Frames"). SDCC (`-compiler=sdcc`, and the
`+zxn` default `-clib=sdcc_iy`) **cannot build with `-debug`** on v2.3 and v2.4: z80asm rejects
`defc Gname0_00==.` (decision C4 stands).
