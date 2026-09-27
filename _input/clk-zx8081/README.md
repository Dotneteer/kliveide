# Clock Signal — ZX80 / ZX81 sources (input for the Klive port)

Extracted from **Clock Signal (CLK)** by Thomas Harte — <https://github.com/TomHarte/CLK>

- Upstream branch: `master`
- Upstream commit: `096de57445920ecf16cf066979422e34aceb843a` (2026-07-28)
- Licence: **MIT** — see [`LICENCE`](LICENCE) (copied verbatim from upstream). Any Klive file that is
  ported from these sources must carry the copyright notice (see the plan,
  `.plans/ZX8081_WASM_PLAN.md`, §0).

The files keep their upstream paths so they can be diffed against a later CLK checkout.
They are **input only**: nothing in this folder is compiled or imported by Klive.

## `core/` — the ZX80/81 implementation (the part being ported)

| File | What it is |
|---|---|
| `Machines/Sinclair/ZX8081/ZX8081.cpp/.hpp` | The machine: memory map (1K/16K/64K), ULA emulation (M1 NOP-forcing above 32K, refresh-cycle character fetch, INT on A6 during refresh, NMI generator + WAIT, HSYNC counter, VSYNC via port FE read/write), keyboard/EAR port, fast-load trap, auto tape motor, auto-RUN, ZonX AY. |
| `Machines/Sinclair/ZX8081/Video.cpp/.hpp` | Turns the sync level and the shifted-out pixel bytes into a CRT waveform (CLK's `Outputs::CRT`, not ported — Klive needs its own frame builder). |
| `Machines/Sinclair/Keyboard/Keyboard.cpp/.hpp` | 8×5 matrix shared by the ZX80, ZX81 and Spectrum, host-key mapping, the character→key-sequence tables used by the auto-typer. |
| `Storage/Data/ZX8081.cpp/.hpp` | Recognises a `.O` (ZX80) / `.P` (ZX81) memory image; ZX80/ZX81 character-set → Unicode tables. |
| `Storage/Tape/Formats/ZX80O81P.cpp/.hpp` | Synthesises the real tape pulse train (150 µs pulses, 4 waves = 0, 9 waves = 1, 1300 µs gap) from a `.O`/`.P` file. |
| `Storage/Tape/Parsers/ZX8081.cpp/.hpp` | Classifies tape pulses back into bits/bytes/files (used by the fast-load trap and the file analyser). |
| `Analyser/Static/ZX8081/*` | Chooses ZX80 vs ZX81, the memory model, and the auto-load command (`W` / `J""`) from a tape. |

## `reference/` — CLK infrastructure, read-only context

Not to be ported. These define the semantics the machine code relies on:

- `Processors/Z80/Z80.hpp` — `PartialMachineCycle` (the bus-cycle model: `ReadOpcode`, `Refresh`,
  `Interrupt`, `Input`, `Output`, half-cycle lengths, `is_terminal()`), the `BusHandler` contract,
  `set_wait_line`, `set_interrupt_line(value, offset)`, `get_halt_line`.
- `Processors/Z80/Implementation/Z80Storage.cpp` — the NMI micro-program with the ZX81 WAIT
  cycles inserted between T2 and T3 (justified by Wilf Rigter's ZX81 WAIT analysis).
- `Processors/Z80/Implementation/Z80Implementation.hpp` — how the wait line stretches a cycle and
  how a *retroactive* interrupt-line change (`offset <= -2` half-cycles) updates the last sample.
- `Storage/Tape/Parsers/TapeParser.hpp` — the pulse-classification parser base class.

## `roms/` — NOT MIT

`zx80.rom` (4 KB, CRC32 `4c7fc597`) and `zx81.rom` (8 KB, CRC32 `4b1dd6eb`) and `readme.txt` are
copied from CLK's `ROMImages/ZX8081/`. They are **not** covered by CLK's MIT licence: they may be
used free of charge in non-commercial products only, and the notice in `readme.txt` must be
retained wherever the ROMs are shipped.

## Known points to verify during the port

- `ZX8081.cpp`, refresh cycle: for a character address at or above `ram_base_` it reads
  `ram_[address & ram_mask_]` (the refresh address) instead of `ram_[char_address & ram_mask_]`.
  That looks wrong for character sets in RAM (UDG/CHR$128 boards); check against hardware docs and
  a test program before carrying it over.
- The ZX80 horizontal counter is never wrapped (only the ZX81 does `% 207`), and the ZX80's
  VSYNC/NMI handling differs; the ZX80 path is less exercised upstream than the ZX81 one.
- `DataFromString` is an unimplemented stub upstream.
