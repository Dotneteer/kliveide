# rtvc

Language: [English](README.md) | [Magyar](README.hu.md)

`rtvc` is an open source, cross-platform emulator for the Videoton TV Computer
(TVC), a Hungarian 8-bit home and school computer from the 1980s.

The emulator is still in active development. It can already run TVC 64K and
64K+ machines with keyboard input, video, sound, cassette loading, HBF/VT-DOS
disk images, snapshots, and a native desktop UI.

Try the browser demo: [teki.one/rtvc](https://teki.one/rtvc/)

## About the TVC

The Videoton TV Computer, usually shortened to TVC, was a Hungarian 8-bit home
and school computer produced by Videoton in the second half of the 1980s. It
used a Z80 CPU, built-in BASIC, cassette storage, graphics modes instead of a
separate text-only display mode, and optional expansions such as floppy disk
support.

More historical background is available on the
[VIDEOTON TVC website](http://tvc.hu/html/tvc_attekintes.html) (Hungarian).

## Features

- TVC 64K and 64K+ machine variants.
- ROM 1.2 and ROM 2.2 machine selections, with optional VT-DOS/HBF extension.
- Z80 CPU emulation with FUSE and ZEX validation test harnesses.
- MC6845-based video output with fast-frame and interleaved rendering modes.
- Native keyboard, video, and sound through the desktop UI.
- CAS cassette loading and DSK disk image support.
- Snapshot save/load using `.rtvcsnap` and `.rtvcsnap.zip`.
- Full browser-based egui web application, plus lightweight snapshot bundles
  for standalone demos.
- TCP socket debugger for native GUI and headless use.

## Documentation

- [TVC Technical Reference](info/tvc.md) — detailed machine specification for
  emulator authors and low-level developers.
- [TVC BASIC Reference](info/basic.md) — TVC BASIC language commands,
  statements, functions, graphics, sound, and system variables.
- [VT-DOS Compatible Floppy Disk System](info/vt-dos.md) — user guide for
  the TVC floppy disk subsystem: setup, BASIC usage, and CLI commands.
- [rtvc Implementation and Usage Reference](info/rtvc.md) — emulator
  architecture, media, snapshots, debugger, UI, and build targets.
- [rtvc Assembler Reference](info/assembler.md) — helper assembler and
  disassembler syntax, formats, and debugger workflow.

## Download

Download the latest release from the
[GitHub Releases page](https://github.com/teki/rtvc/releases).

Release archives are available for:

- Windows x64
- macOS x64
- macOS Apple Silicon

Extract the archive and run:

- `rtvc.exe` on Windows
- `RTVC.app` on macOS

The release packages include the emulator, ROM files, bundled programs, the
complete English and Hungarian documentation trees under `info/` and
`info.hu/`, and a full browser version in `web/`.

### Command-line tools

The Windows and macOS packages also include these small utilities. They are in
the package root with an `.exe` suffix on Windows and under `bin/` on macOS;
run any tool with `--help` for its complete options:

| Tool | Purpose | Example |
| --- | --- | --- |
| `rtvc-dsk` | Create, inspect, and modify TVC FAT12 disk images. | `rtvc-dsk dir disk.dsk` |
| `rtvc-asm` | Assemble small Z80 sources to TOML, CAS, or raw binary. | `rtvc-asm --format cas demo.asm -o demo.cas` |
| `rtvc-basic` | Compile numbered TVC BASIC source to CAS or raw program bytes. | `rtvc-basic demo.bas -o demo.cas` |
| `rtvc-tocas` | Convert `.bas` and `.asm` sources to sibling `.cas` files. | `rtvc-tocas demo.bas helper.asm` |
| `rtvc-disasm` | Convert binary or ROM bytes to round-trippable assembler source. | `rtvc-disasm --origin C000H rom.bin -o rom.asm` |
| `rtvc-cas2wav` | Convert a TVC CAS cassette image to a 44.1 kHz WAV file. | `rtvc-cas2wav input.cas output.wav` |
| `rtvc-tap2toml` | Convert a ZX Spectrum TAP image to structured TOML for analysis and porting tools. | `rtvc-tap2toml game.tap -o game.toml` |

See the [assembler reference](info/assembler.md) for the assembler and
disassembler syntax and output formats, and the
[TVC BASIC reference](info/basic.md#tokenized-program-format) for `rtvc-basic`.
`rtvc-tocas` converts `.bas` and `.asm` files to sibling `.cas` images.

### macOS First Launch

The macOS app is ad hoc signed, not notarized. If macOS blocks it after
download, remove the browser quarantine flag from the extracted directory:

```bash
xattr -dr com.apple.quarantine rtvc-macos-arm64
```

Use `rtvc-macos-x64` instead when you downloaded the Intel build. Applying the
command to the containing directory also covers the command-line tools.

You can also download the archive from Terminal, which usually avoids the
browser quarantine flag:

```bash
curl -L https://github.com/teki/rtvc/releases/latest/download/rtvc-macos-arm64.zip | ditto -x -k - $HOME/Downloads/rtvc
```

## Using the Emulator

The native app provides menus for selecting the machine type, loading cassette
or disk images, saving and loading snapshots, and saving screenshots. The
default Simple view stays focused on the TVC screen. Enable **View > Developer
Workspace** to use dockable Screen and IO Log panes; reopen the log through
**View > Panes > IO Log** or restore the defaults with **Reset Workspace**.
Click the Screen pane to capture TVC keyboard input and press Escape to release
it.

Choose **View > Debugger Layout** for integrated CPU, disassembly, memory,
breakpoint, BASIC 1.2 ROM-symbol, event, screen, and IO-log panes. The debugger
is available in both the native app and full browser app; each pane can also be
opened individually through **View > Panes**.

Supported user files:

| File type | Purpose |
| --- | --- |
| `.cas` | TVC cassette image. |
| `.dsk` | Floppy disk image for HBF/VT-DOS. |
| `.zip` | Program archive containing a `.cas` or `.dsk` file. |
| `.rtvcsnap` | Raw rtvc snapshot. |
| `.rtvcsnap.zip` | Compressed rtvc snapshot. |

Snapshots are the easiest way to preserve the current machine state. The native
app can save compressed `.rtvcsnap.zip` files, load `.rtvcsnap` or
`.rtvcsnap.zip` files, and start directly from a snapshot path.

## Run From Source

Install a recent Rust toolchain, then run:

```bash
cargo run --bin rtvc
```

Start from a snapshot:

```bash
cargo run --bin rtvc -- snapshots/boot12dos.rtvcsnap.zip
```

`snapshots/boot12dos.rtvcsnap.zip` contains a clean, fully booted TVC 1.2
VT-DOS machine. It is useful for testing when waiting for the normal machine
boot is unnecessary.

Load media on startup:

```bash
# Mount a floppy disk image
cargo run --bin rtvc -- -d path/to/disk.dsk

# Mount a cassette tape for standard loading
cargo run --bin rtvc -- -t path/to/tape.cas

# Inject a cassette tape directly into memory
cargo run --bin rtvc -- -i path/to/tape.cas
```

When running from source, place ROM files in `roms/`. Optional program archives
and media files can go in `progs/`.

## Web Emulator

The release archive includes a full browser version of the emulator. To use it,
serve the `web/` directory and open it in a browser:

```bash
cd web
python -m http.server 8000
```

Developers can build the same web application and serve it locally with:

```bash
cargo install wasm-bindgen-cli --version 0.2.122
# Build the web bundle into docs/
cargo xtask bundle-web-full docs
# Serve the docs/ directory (on macOS/Linux)
python scripts/serve_docs.py
# Or serve the docs/ directory (on Windows)
scripts\serve_docs.bat
```

The native and web File menus provide a TVC Gamebase browser whose catalog,
screenshots, and selected game archive are fetched on demand. Its name filter is
case-insensitive and treats Hungarian accented vowels as their unaccented
equivalents; press Escape to close the dialog. The web emulator can also open
local CAS, DSK, ZIP, and snapshot files. Small web preferences use
`localStorage`; recent tape and disk bytes use IndexedDB. Native Gamebase media
is cached under `rtvc-media/` beside the active `rtvc.toml`. Loading a Gamebase
title automatically starts from the clean, embedded TVC 1.2 VT-DOS snapshot,
attaches or injects its media, and types `RUN` for CAS or `LOAD "*"` for DSK.

## Developer Notes

Useful commands:

```bash
cargo build
cargo run --bin fuse_test
cargo run --bin perf_test
```

The socket debugger is available in both native GUI and headless modes:

```bash
# Native UI with debugger on port 8089
cargo run --bin rtvc -- -p 8089

# Headless emulator with debugger on port 8080
cargo run --bin rtvc -- -H -p 8080
```

For the full development workflow, see
[.agents/skills/development/SKILL.md](.agents/skills/development/SKILL.md).

## Contributing

Issues and pull requests are welcome. Emulator accuracy reports are most useful
when they include a small reproduction: the machine type, media file, snapshot,
command typed on the TVC, and any relevant port or interrupt logs.

Please keep emulator behavior changes covered by focused tests where practical,
and update the appropriate consolidated reference in `info/` when changing TVC
behavior, core architecture, snapshot format, media handling, or build
workflows.

## Acknowledgements

`rtvc` was ported from the earlier JavaScript implementation
[teki/jstvc](https://github.com/teki/jstvc). The CPU test flow uses public Z80
validation material such as FUSE and ZEX test programs. The project also relies
on historical TVC hardware information and preservation material.

## License

The emulator code is licensed under the [MIT License](LICENSE).

ROMs, cassette/disk images, snapshots, screenshots, manuals, and other
historical or third-party machine materials are included for preservation,
compatibility testing, or convenience where present. They are not covered by the
MIT license unless explicitly stated.
