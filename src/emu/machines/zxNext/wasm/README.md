# ZX Spectrum Next WASM Backend

This is the ZX Spectrum Next emulator. There is no other one: the TypeScript Next machine and its
~25 devices were removed once this core reached parity with them
(`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`; the last commit that still had both is tagged
`pre-zxnext-ts-removal-2026-09-19`). The production artifact is `zx-spectrum-next.wasm`, built from
this folder and loaded by `ZxNextWasmV2Loader.ts`.

## Layout

- `zxnext/`: the freestanding C implementation.
- `dist/`: generated production WASM artifact.
- `ZxNextWasmV2Loader.ts`, `frameTraceLayout.ts`: the loader and the frame-trace ring layout.

## How The Machine Is Put Together

```
Z80Cpu -> Z80MachineBase -> ZxNextWasmHost -> ZxNextWasmV2Machine
```

- `ZxNextWasmHost` is the host-side plumbing that does not depend on how the hardware is emulated:
  frame units for the pacing, the key-stroke queue, code injection, partition names, sysvars.
- Machine facts that are not emulation live in neutral modules next to it - `nextMachineInfo.ts`
  (partition naming, disassembly sections, the NextZXOS code-injection flow, step-over lengths),
  `nextMemoryLayout.ts`, `nextRegDescriptors.ts`, `nextProfiles.ts`, `nextRtc.ts`,
  `nextKeyCodes.ts`, `nextColorTables.ts`, `z80nInstructionLengths.ts`.
- The IDE reads machine state only through `IZxNextIdeMachine`, which `MainToEmuProcessor` talks to;
  host input (joysticks, the Kempston mouse) goes in through `IZxNextHostInputMachine`.

This shape is not incidental. `ZxNextWasmV2Machine` used to *extend* the TypeScript `ZxNextMachine`,
so every WASM machine constructed and reset all of its devices, and several paths - the keyboard,
code injection, frame pacing, four IDE panels - quietly kept running TypeScript emulation while the
core ran beside them. `test/wasm/zxNext/wasm-next-separation.test.ts` fails if an emulated device
class becomes reachable from this machine or its loader again, even through a type import, and if
any of the deleted files reappears. Read
`.ai/wasm-migration-intent-and-lessons.md` before starting the next machine's migration.

`ZxNextWasmV2Machine.getWasmV2Diagnostics()` reports the runtime's sizes, frame and tact counters,
and the last stop reason.

## Maintenance Policy

ZX Spectrum Next emulator behaviour is implemented in C, against the FPGA sources of each Next
model's core version — the VHDL of the profile's version is the reference, and a claim in a test is
expected to cite it. The VHDL is fetched, never committed: `npm run next-fpga:fetch` puts each pinned
version (`vendor/next-fpga/sources.json`) in `vendor/next-fpga/<version>/`, with Klive's own comments
applied (`vendor/next-fpga/comments/`). A citation names the version (`zxnext.vhd@3.02.04 ~5186`);
an unversioned one means 3.02.01. One C tree builds one artifact per model's hardware
(`zxnext-profile.h`, `scripts/zxnext-artifacts.cjs`); a behaviour a later core changed is guarded
with `#if ZXNEXT_CORE_VERSION >= 30204`, and the 3.02.01 artifact's boot traces and goldens prove
the guard leaked nowhere (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`).
TypeScript changes are for behaviour that is host-owned rather than machine-owned: IDE and UI
policy, Electron resource lookup, host file and media persistence, test-harness setup. Those may
call into WASM; they are not a reason to move machine-owned behaviour back out of it.

Tests:

- `test/zxnext-hw/` - the hardware harness: the real core driven only through ports, NextRegs,
  memory, registers, the picture and audio. New device behaviour goes here. Read
  `test/harness/zxnext/README.md` first.
- `test/visual/` - pixel cases judged by probes, goldens and AI review (`npm run test:visual`).
- `test/wasm/zxNext/` - what the harness cannot reach: the loader and memory layout, the machine
  lifecycle, checkpoints, the debug loop, boot traces, IDE-facing state.

When a Next device stays separate from the shared Spectrum WASM devices, keep the reason documented
in `wasm-next-shared-source-contract.test.ts`.

Build with `npm run build:zxnext-wasm`. The compiler defaults to `clang`; set `ZXNEXT_WASM_CC` to
select another C compiler. The build script uses the portable `wasm32` target and `wasm-ld`, so it
does not require Emscripten.

## Known Differences From The Hardware

The "Under the hood" chapters describe the machine, not Klive (`.ai/hardware-articles-guide.md`), so a
difference that is not fixed is recorded here. Each is a candidate for a fix.

Memory and I/O (`docs/content/en/under-the-hood/emulator-internals/next-memory-io.mdx`):

- **Banks 5 and 7 are one memory.** The hardware keeps bank 5 and page `$0E` in dual-port block RAM and
  also has SRAM for them: CPU writes through the MMU reach only the block RAM, while Layer 2 is displayed
  from the SRAM and the Layer 2 mapping writes the SRAM (zxnext.vhd ~2994, ~3016, ~3058; layer2.vhd
  ~172). Klive keeps one copy, so Layer 2 in bank 5 shows the CPU's writes and the mapping's writes show
  on the ULA. Bank 7 is also modelled as 16K of display memory where the hardware has 8K of block RAM.
- **I/O cycles are not contended.** `zxnextCpuDelayPortReadHead/Tail` are plain T-states; the hardware
  contends even ports, `$7FFD` (128K/+3 timing) and the ULA+ ports in 48K/128K timing (zxnext.vhd ~4476,
  zxula.vhd ~595).
- **A page of `$E0` or more in slots 2-7** reads ROM bytes; on the hardware the read returns whatever the
  SRAM port last delivered (zxnext.vhd ~1821, ~3016). Writes are dropped in both.
- **Two devices answering one `IN`**: Klive's read decode is a priority chain; the hardware ORs every
  matching device's byte (zxnext.vhd ~2765-2796). Only deliberately overlapping decodes (Kempston 1 and
  the Multiface 1 at `$1F`) can tell.

Sound (the sound series, `docs/content/en/under-the-hood/emulator-internals/next-audio/`; how Klive builds
its one stream is told in its own chapter, `klive-audio.mdx`, "One stream, three outputs"):

- **Samples, not a continuous sum.** The hardware's mixer adds its inputs all the time; Klive adds them only
  when it needs a sample (about every 583 master clocks at 48 kHz). The beeper and the AY chips are averaged
  over the time a sample covers for the jack and the speaker, and taken at the sample's moment for HDMI.
- **The sum keeps the proportions, not the zero.** The DACs and the Pi are added about their rest levels
  (`$80`, 512), EAR and MIC pass a DC filter (a constant falls to about a third in a little over 0.1 s), and
  the AY chips are added as they are, so they keep a steady offset that the real output capacitor would
  remove. Silence is 0 instead of 1,536; the jack's sum is scaled by 12.8 into 16 bits, the speaker's by 6.4
  (the later boards' speaker; the earliest boards bias its word for their transistor), HDMI's by 7.34 and it
  never wraps. The hardware's HDMI words carry a constant 6,144; Klive's are centred on zero. The filter's
  time constant is tuned (the real board's RC values are not part of the design).
- **One output at a time**: jack, speaker or HDMI, chosen by Klive's own setting, which survives a reset.
- **The Raspberry Pi is not emulated.** A sample source (a WAV file or a tone, the IDE's `pi-audio` command)
  feeds the Next's receiving half of the I2S link. Left out: the Pi's software and its serial commands, the
  Next's mix sent back to the Pi, and the half-finished word a real receiver may latch the moment the link
  is switched on.

Screen (the screen series, `docs/content/en/under-the-hood/emulator-internals/next-display/`):

- **Nothing after the pipeline**: the scan doubler, scanlines and the HDMI buffer are not emulated; Klive
  shows the pipeline's own output. At 60 Hz the frame ends after line 263, so the shown window's last 40
  rows stay black.
- **Lazy rendering, one line of difference.** Klive renders what the beam has drawn just before a write
  that can change the picture. Writes to screen memory (bank 5, bank 7, the displayed Layer 2 banks) render
  only up to the start of the beam's row, so that row shows the new bytes from its first dot: at most one
  line of one frame differs from the hardware.
- **Sprites are drawn per frame, not line by line.** Klive resolves the attribute table and works out, per
  line, where the hardware would run out of time, then draws whole sprites; a sprite moved mid-frame can
  land about a line away from the hardware's position (the hardware draws a line ahead from the table). The
  collision and "too many sprites" flags are worked out once a frame, so a port `$303B` read in the middle
  of a frame sees only what earlier frames raised.

Interrupts (`docs/content/en/under-the-hood/emulator-internals/next-interrupts.mdx`):

- **The vector byte outside a device's acknowledge.** The hardware drives `$C0` bits 7-5 & `00000` whenever
  the chain's IEO is low but no device is acknowledging (an IM 0 acknowledge in hardware IM2 mode, an
  external INT during an internal handler; zxnext.vhd ~1826, im2_device.vhd ~155). Klive returns `$FF`, and
  its IM 0 always calls `$0038`.
- **The expansion bus interrupts are not wired in.** Neither the bus /INT (gated by `$C4` bit 7) nor the
  bus NMI (with `$81` bit 5's debounce bypass) reaches the CPU; the registers are only stored.
- **The DMA delay ends with the device**, not after the RETI/RETN tail that im2_control keeps it for
  (im2_control.vhd ~184-189, 238).
- **CTC and UART pulses start at the instruction** in which their event is synchronised, not at the exact
  28 MHz clock; start and end can be late by up to one instruction.
- **An NMI copies IFF1 to IFF2** in the shared Z80; the T80N leaves IFF2 alone (t80n.vhd ~1747). Only a
  nested NMI or other IFF1 != IFF2 cases can tell.

The DMA (`docs/content/en/under-the-hood/emulator-internals/next-dma.mdx`):

- **The bus changes hands between instructions.** The T80N grants BUSRQ at the end of any M-cycle
  (`T_Res`, t80n.vhd ~1718-1727); Klive's CPU loop runs the DMA before an instruction, so a burst-mode byte
  that asks for the bus back waits for the end of the CPU's instruction (up to 23 T) instead of its
  machine cycle. The enable's own case (the next instruction's M1 runs first) is modelled.
- **DMA cycles are not contended.** The DMA runs on the CPU clock, and the ULA's contention looks at the
  bus the DMA drives (zxnext.vhd ~1784-1790, ~4461; zxula.vhd ~595-600), so at 3.5 MHz the hardware
  stretches a DMA byte that touches contended memory or ports in the display area. Klive's DMA bytes take
  their plain clocks.
- **The SD card's port costs a flat 16 clocks.** The SPI master holds the DMA's wait until its byte has
  shifted (spi_master.vhd ~177), so a run of `$EB` accesses comes about 16 CPU clocks apart; Klive adds 16
  clocks to every `$EB` access on top of the read and write cycles.
- **The NMI state machine passes through S_NMI_END at once**; the hardware waits for an I/O write to end.

The CTC (`docs/content/en/under-the-hood/emulator-internals/next-ctc.mdx`):

- **No `$00` at terminal count in 3.02.01.** The hardware holds the count at `$00` for one 28 MHz clock
  before the zero edge reloads it (ctc_chan.vhd@3.02.01 ~142-166); Klive's fast path reloads at once, so a
  read at that clock gives the time constant, as on 3.02.04. Periods and ZC/TO timing are the same.
- **A counter-mode channel is read 2 T early.** A port read samples a running timer 2 T into the I/O cycle
  (`zxnextCtcPeekAhead`), when the CPU latches the data; a counter is read as it is at the start, so an
  upstream zero count in those 2 T is missed by that read.
- **Joystick pin 7 is not an output.** The joystick I/O mode (NextReg `$0B`), and with it channel 3's clock
  on pin 7, is not modelled.

Storage (`docs/content/en/under-the-hood/emulator-internals/next-storage.mdx`):

- **SPI is byte-level, without its clock.** The hardware shifts a byte in 16 CPU clocks and starts a new
  one only from idle or the byte's last clock (spi_master.vhd ~80-95), so a CPU access to `$EB` sooner than
  that is lost; Klive takes every access at once. A read of `$EB` on the hardware returns the byte of the
  previous exchange and starts one with `$FF`; Klive's card hands out its next response byte, which the
  `$FF` bytes before every response make look the same to a program.
- **Only the SD cards answer.** The Raspberry Pi's two SPI selects (`$E7` = `$FB`, `$F7`) and the flash
  (`$7F`) select nothing that answers: reads give `$FF`.
