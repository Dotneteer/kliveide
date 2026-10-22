# Clock Signal — Enterprise 64/128 sources (input for a Klive port)

Extracted from **Clock Signal (CLK)** by Thomas Harte — <https://github.com/TomHarte/CLK>

- Upstream branch: `main`
- Upstream commit: `0f49993b4d0992ebba1fad5032d96637f3a84d1f` (2026-10-21), also recorded in `COMMIT`
- Licence: **MIT**. See [`LICENCE`](LICENCE), copied unchanged from upstream. The per-file headers
  still read "All rights reserved", as they do in the ZX80/81 sources in `_input/clk-zx8081/`; the
  repository `LICENCE` is the grant. Any Klive file ported from these sources must carry the
  copyright notice.

The files keep their upstream paths, so they can be diffed against a later CLK checkout. They are
**input only**: Klive does not compile or import anything in this folder.

## The Enterprise machine (`Machines/Enterprise/`)

| File | What it is |
|---|---|
| `Enterprise.cpp/.hpp` | The machine. It covers the Z80 bus, paging through B0h–B3h, the segment map and ROM loading, the DAVE wait states and NICK video-RAM contention, the I/O port decoding, interrupts and the host-file trap. |
| `Nick.cpp/.hpp` | NICK. It walks the Line Parameter Table, renders each mode and colour mode per 16-cycle window, and handles palette, FIXBIAS, border and VINT. |
| `Dave.cpp/.hpp` | DAVE. It has the tone and noise channels, the polynomial counters, the filters and ring modulation, D/A mode, and the interrupt timers. |
| `EXDos.cpp/.hpp` | The EXDOS floppy card, built on the WD1770 component below. |
| `HostFSHandler.cpp/.hpp`, `HostFS/hostfs.z80s`, `HostFS/compile.sh` | The `FILE:` device: a small EXOS extension ROM (its Z80 source) that traps to the host with `ED FE FE nn`. |
| `Keyboard.cpp/.hpp` | Maps host keys onto the 10×8 matrix. |
| `EXOSCodes.hpp` | EXOS function and error code enums. |

## Shared CLK code the machine depends on

| File | Why it is here |
|---|---|
| `Components/1770/1770.cpp/.hpp` | The WD1770/1772 FDC that EXDOS uses. |
| `Numeric/LFSR.hpp` | The LFSR helper. |
| `Analyser/Static/Enterprise/*` | The machine configuration: model, EXOS/BASIC/EXDOS versions, RAM size, speed. It also chooses the configuration from a loaded file. |

Not copied: the Z80 (`Processors/Z80/`), whose bus-cycle model is already described in
`_input/clk-zx8081/reference/`, and the generic CRT, speaker, clocking and file infrastructure.
Klive has its own versions of these.

**Known limitations** (from `../EXISTING_EMULATORS.md`): there is no tape, joystick, printer or
serial port. The author's comments call the wait-state and contention timing a guess. The Dave
mixing is a plain sum.
