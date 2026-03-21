# pasta80 — Command Line Reference

## Usage

```
pasta80 { <option> } <input>
```

`<input>` is the path to the source `.pas` file. The `.pas` extension is added automatically if omitted.

Options must appear **before** the input file. They can be combined freely unless noted otherwise.

---

## Target options

Exactly one target may be active at a time. The default is `--cpm`.

| Option | Target | Load origin | Address limit |
|--------|--------|-------------|---------------|
| `--cpm` | CP/M (default) | `$0100` | `$F000` |
| `--zx48` | ZX Spectrum 48K | `32768` | `65536` |
| `--zx128` | ZX Spectrum 128K | `32768` | `65536` |
| `--zxnext` | ZX Spectrum Next | `32768` | `65536` |
| `--agon` | Agon Light / Console8 | `$0000` | `$10000` |

---

## Output format options

Exactly one format may be active at a time. The default is `--bin`.

| Option | Format |
|--------|--------|
| `--bin` | Raw binary file (default) |
| `--3dos` | Binary with a +3DOS header |
| `--tap` | `.tap` tape file with BASIC loader |
| `--sna` | `.sna` 48K snapshot file |
| `--run` | `.run` runnable directory (Agon) |

> **Compatibility notes**
> - `--3dos`, `--tap`, `--sna` require a ZX Spectrum target (`--zx48`, `--zx128`, or `--zxnext`).
> - `--sna` is not supported with `--zxnext`.
> - `--run` requires `--agon`.
> - CP/M only supports `--bin`.

---

## Code-generation options

| Option | Effect |
|--------|--------|
| `--opt` | Enable peephole optimizer |
| `--dep` | Enable dependency (smart-link) analysis — strips unused units |
| `--ovr` | Enable bank-switched overlays (requires `--zx128` or `--zxnext`) |
| `--release` | Disable `Assert` and `Debug` breakpoint code |

> When `--ovr` is used the addressable limit is reduced: `$C000` for `--zx128`, `$E000` for `--zxnext`.

---

## Utility / informational options

These options do not compile a file.

| Option | Effect |
|--------|--------|
| `--ide` | Launch the interactive mini-IDE |
| `--config` | Show and validate the current configuration (`~/.pasta80.cfg`) |
| `--version` | Print the compiler version number and exit |

---

## Configuration file

pasta80 reads `~/.pasta80.cfg` at startup. A sample file is provided in [misc/.pasta80.cfg](misc/.pasta80.cfg). Run `pasta80 --config` to inspect all resolved paths and verify that each tool can be found.

Lines beginning with `#` are comments. Each entry has the form `key = value`. A leading `~` in a value is expanded to the user's home directory.

| Key | Default | Purpose |
|-----|---------|---------|
| `home` | directory of the `pasta80` binary | pasta80 installation directory (must contain `rtl/`) |
| `assembler` | `sjasmplus` | Path to the **sjasmplus** assembler executable |
| `editor` | `nano` | Text editor used by the mini-IDE |
| `vscode` | `code` | VS Code CLI used when running inside a VS Code terminal |
| `tnylpo` | `tnylpo` | CP/M emulator used to run programs from the mini-IDE |
| `fuse` | `fuse` / `Fuse.app` (macOS) | ZX Spectrum 48K/128K emulator |
| `cspect` | `CSpect.exe` | ZX Spectrum Next emulator (requires `mono` on non-Windows) |
| `image` | `tbblue.mmc` | Full path to the SD card image used by CSpect |
| `hdfmonkey` | `hdfmonkey` | Tool for writing files into the CSpect SD card image |
| `agon` | _(none)_ | Directory of the fab-agon-emulator (not the binary itself) |

All tools default to their bare command name and are resolved from `PATH`, so you only need to set a key when the tool is not in your `PATH` or you want to override it.

### Specifying the sjasmplus executable

Yes, pasta80 uses **sjasmplus** as its assembler backend. If `sjasmplus` is already in your `PATH`, no configuration is needed. Otherwise, add an `assembler` line to `~/.pasta80.cfg`:

```ini
assembler = /usr/local/bin/sjasmplus
# or, using a home-relative path:
assembler = ~/tools/sjasmplus
```

---

## Program entry address

The compiled binary's very first byte is always at the **load origin** (`AddrOrigin`). That byte starts a `jp __init` instruction, so the entry address equals the load origin — there is no separate entry-point offset.

| Target | Entry / load address |
|--------|----------------------|
| CP/M | `$0100` |
| ZX Spectrum 48K / 128K / Next | `$8000` (32768) |
| Agon Light / Console8 | `$0000` |

The `__init` stub (from the target's RTL file in `rtl/`) performs target-specific setup before calling the Pascal program's `main` block:

1. Saves system registers and the OS stack pointer.
2. Sets the Pascal stack to the top of the address limit (`LIMIT - StackSize`, default stack 4 KB).
3. Initialises the heap immediately after the code/data segment.
4. Jumps to `main` — the first instruction of the compiled Pascal program body.

For binary formats that carry header metadata (`--3dos`, `--tap`, `--sna`) the correct entry address is embedded in the header automatically, so loaders start execution at the right place without any manual configuration.

---

## Examples

```sh
# Compile hello.pas for CP/M (defaults)
pasta80 hello.pas

# ZX Spectrum 48K, generate a .tap tape file
pasta80 --zx48 --tap hello.pas

# ZX Spectrum 128K with overlays and peephole optimiser
pasta80 --zx128 --ovr --opt game.pas

# Agon, produce a .run directory
pasta80 --agon --run demo.pas

# Release build (no assertions/breakpoints), ZX Next
pasta80 --zxnext --bin --release --opt app.pas

# Show compiler version
pasta80 --version
```
