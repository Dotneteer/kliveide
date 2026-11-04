# zx-go machine frame and device weaving

Created: 2026-08-29

## Scope

This note summarizes how `/Users/dotneteer/source/zx_go` weaves Z80/Z80N CPU
execution with the rest of the emulated hardware. It focuses on technique and
mental model, not on porting exact source code.

Primary source landmarks:

- `/Users/dotneteer/source/zx_go/pkg/z80/z80.go`
- `/Users/dotneteer/source/zx_go/pkg/memory/memory.go`
- `/Users/dotneteer/source/zx_go/pkg/ula/ula.go`
- `/Users/dotneteer/source/zx_go/cmd/zx_go/main.go`
- `/Users/dotneteer/source/zx_go/cmd/zx_go/next.go`
- `/Users/dotneteer/source/zx_go/pkg/next/wire.go`
- `/Users/dotneteer/source/zx_go/pkg/next/divmmc/divmmc.go`
- `/Users/dotneteer/source/zx_go/pkg/next/dma/dma.go`
- `/Users/dotneteer/source/zx_go/pkg/next/ctc/bank.go`
- `/Users/dotneteer/source/zx_go/pkg/zx8x/machine.go`

## High-level model

zx-go's normal Spectrum/Next execution model is CPU-centered. The CPU is the
clock source, and a machine frame is primarily "run this many T-states through
the CPU." Hardware devices are not driven by one global per-T-state scheduler.
Instead, they are attached at the points where the real hardware observes the
machine:

- Memory reads/writes route through `memory.Memory`.
- I/O instructions route through the CPU's `ULA` interface, after port
  contention is charged by memory.
- Opcode fetches expose pre-fetch, post-fetch, and M1-replacement hooks.
- Some devices receive a lightweight per-frame pulse after the CPU frame.
- Video and most audio are produced once per frame from state/events recorded
  during CPU execution.

The result is a hybrid design: accurate enough where bus timing matters, but
without a full central event queue for every hardware clock.

## Frame concept

The GUI loop in `cmd/zx_go/main.go` is wall-clock paced by model-specific frame
duration. Each tick locks the current machine core, executes one emulated frame,
does per-frame housekeeping, and renders if enough wall time has elapsed.

Frame lengths are model-specific:

- 48K: 69888 T-states.
- 128K family and Next: 70908 T-states.
- Pentagon: 71680 T-states.

`z80.CPU.ExecuteFrame(tstatesPerFrame)` multiplies the frame budget by the
current CPU speed multiplier. This is especially important for the Next: at
7/14/28 MHz the CPU executes 2/4/8 times as many CPU T-states during the same
video frame.

At the end of `ExecuteFrame`, the CPU subtracts the frame end target from its
internal `tstates`. In practice, `CPU.Tstates()` is usually treated as
frame-relative in the bulk-frame path. Callers that need absolute guest time
track it separately, as the test harness does with its own elapsed counter.

Single-step/debug execution uses `StepInstructionWithIRQ()`, whose body mirrors
the per-iteration logic of `ExecuteFrame`: frame interrupt scheduling, line
interrupt scheduling, IRQ sampling at M1 boundaries, HALT handling, NMI
delivery, and finally one instruction. There is also plain `StepInstruction()`
for CPU conformance tests where interrupts should stay out of the picture.

## CPU-to-device coupling

The CPU knows only two abstract devices:

- `Memory`: read, write, and port-contention timing.
- `ULA`: read port and write port.

That sounds narrow, but the concrete ULA and memory implementations fan out to
the rest of the machine.

The CPU also provides hook points:

- `PreFetchHook` and named `AddPreFetchHook`: run before each opcode fetch.
- `PostFetchHook` and named `AddPostFetchHook`: run just after the opcode fetch.
- `M1FetchHook`: can replace the fetched opcode byte, used by ZX80/ZX81 video.
- RETN/RETI/INT/NMI callbacks for interrupt-related hardware behavior.
- Breakpoint/trap hooks used by debugger, tape traps, RZX, and diagnostics.

This makes M1 fetches a first-class integration boundary. That is important for
hardware such as Interface 1, divMMC, Multiface, and ZX80/ZX81 display logic,
where the mapping or bus value must change exactly around an opcode fetch.

## Memory and contention

`memory.Memory` owns ROM/RAM paging and dispatch priority. It also owns
contention timing because contention depends on both current T-state and the
memory/port address being accessed.

The CPU gives memory a pointer to its T-state counter when the memory backend
implements `SetTStatePtr`. Then:

- Converted CPU cycle helpers call `ContendMemory(addr)` before charging memory
  read/write cycles.
- I/O opcodes call `ContendPort(port)` before entering the port dispatcher.
- Memory computes display-window-dependent delays from the current T-state,
  machine timing, and whether the relevant bank/port is contended.

The design keeps contention local to the bus implementation. CPU opcodes either
use coarse `tstates += N` timing or more accurate cycle helpers for converted
instructions; both can coexist.

For Next memory, the read/write path implements the hardware priority stack:
FPGA boot ROM, divMMC, Multiface, Alt ROM, config mode, MMU slots, Layer 2
mapping, classic ROM/RAM paging, and fallback RAM/ROM. Peripheral overlays are
callbacks (`PeripheralRead`/`PeripheralWrite`) rather than hard dependencies.

## Port dispatch

All CPU I/O reaches `ULA.ReadPort`/`ULA.WritePort`. Despite the name, this is
really the port bus dispatcher for the machine. It handles or delegates:

- ULA port `$FE`: keyboard, tape EAR, border, MIC, beeper.
- AY/TurboSound ports.
- NextReg select/data ports `$243B`/`$253B`.
- Next Layer 2, sprite, ULA+, I2C/RTC, DMA, DAC, divMMC, memory paging ports.
- Classic peripherals via `PeripheralManager`.
- Floating bus fallback for classic models.

The dispatch style is ordered "claim or fall through." Devices return whether
they handled a port read; writes use early returns or delegate onward. This
lets overlapping ports be resolved by explicit priority, which is essential for
Spectrum/Next hardware.

## NextReg wiring

The Next register file is implemented by `nextregs.Dispatcher`: a 256-byte
register backing store plus per-register read/write callbacks.

`pkg/next/wire.go` installs side effects register by register. Examples:

- CPU speed register writes call `cpu.SetSpeedSelect`.
- Line interrupt registers recompute `cpu.LineIntOffsetTstates`.
- MMU registers call `mem.SetMMU`.
- ROM/Alt-ROM registers call memory banking methods.
- Palette, Layer 2, sprites, tilemap, Copper, RTC, UART, keymap, and reset all
  install their own handlers.

So NextRegs are not passive state. They are a side-effect bus whose handlers are
part of the machine wiring.

## Video generation

For Spectrum/Next, CPU execution does not draw the bitmap pixel by pixel. During
the frame it records timing-sensitive state:

- Border color changes are stored with scanline positions.
- Beeper/tape/DAC writes are stored with T-state offsets.
- Visual NextReg changes that can affect raster splits can be journaled with
  the current display row.

`ULA.Render()` then composes exactly one frame:

1. Flush audio for the just-finished frame.
2. Build border colors from the recorded border-change list.
3. Render classic ULA screen RAM into a 320x240 image.
4. For Next, apply the compositor for Layer 2, tilemap, sprites, palette,
   priority, fallback color, LoRes/Timex modes, and related layers.
5. During the Next compositor pass, step the Copper across raster columns so
   Copper writes affect the rest of the frame at the right horizontal position.

`Render()` is intentionally not just an observation. On the Next it advances
observable device state, especially Copper state. `LastFrame()` exists for
screenshots/debugger views that must look without composing another frame.

ZX80/ZX81 are different: there is no normal framebuffer ULA. Their machine uses
`M1FetchHook` to turn selected opcode fetches into NOPs and interpret fetched
bytes as display characters. HALTs advance display lines, and vertical sync
presents the built frame. Their `RunFrame()` also drives per-scanline INT/NMI
behavior from a line T-state clock.

## Audio generation

Audio is mostly event-timed per frame:

- `$FE` speaker bit changes append `(frame offset, state)` events.
- Tape EAR changes are advanced on `$FE` reads and recorded as audio events.
- Classic SpecDrum/Covox and Next DAC writes record timed level changes.
- At render/frame flush, the ULA integrates those event timelines into
  `SamplesPerFrame` samples using box filtering.

The audio system has a stereo ring buffer consumed by the host audio callback.
AY/TurboSound is mixed at sample rate by its own engine interface. Beeper,
tape, and DAC paths are reconstructed from per-frame event lists, which gives
good timing precision without ticking a mixer at every CPU cycle.

## Storage and expansion hardware

Classic expansion devices are coordinated by `PeripheralManager`. It owns
DISCiPLE, Multiface, Interface 1/2, +3 FDC, Kempston mouse, and ZX Printer
instances, and exposes handlers for:

- Port reads/writes.
- Memory overlays.
- NMI handling.
- Opcode-read side effects.
- A small per-frame `Frame()` pulse, currently for ZX Printer drum timing.

The +3 FDC and DISCiPLE controllers are synchronous port-state machines from
the CPU's perspective: command/status/data ports mutate internal controller
state and media state. Media bytes are not treated as rewindable machine state;
controller state is.

Next SD storage is modeled through divMMC:

- The divMMC pager is a CPU M1 pre/post-fetch hook for automapping.
- Memory overlays route `$0000-$3FFF` to divMMC ROM/RAM when active.
- Ports `$E3`, `$E7`, and `$EB` handle control, SPI chip-select, and SPI data.
- The SD card object is attached to the pager as a small `CardSlot` interface.

There is no separate storage scheduler. The guest advances storage by reading
and writing the relevant ports, just as the hardware bus would.

## DMA, Copper, CTC

DMA is partly time-aware and partly bus-synchronous:

- Command bytes arrive through DMA ports.
- Continuous transfers can charge cycles directly to the CPU clock through a
  cycle sink.
- Burst/prescaled transfers are stepped from a CPU pre-fetch hook using the
  current CPU T-state, so bytes become due along the CPU timeline.
- DMA I/O endpoints read/write through the same ULA port dispatcher.

Copper is video-clocked, not CPU-clocked. zx-go steps it during `ULA.Render()`
while walking scanlines/columns. This is why `Render()` is non-idempotent for
Next and why `LastFrame()` matters.

CTC is an important negative example. There is a `pkg/next/ctc` implementation
with per-channel `Tick()`, but the Next wiring deliberately does not attach it
yet. The comments explain that the real CTC is clocked by fixed 28 MHz hardware,
has channel chaining, and has interrupt enables from NextRegs; ticking it from
CPU instruction hooks would be badly wrong. zx-go prefers leaving it unwired to
inventing a plausible but inaccurate integration.

## Practical takeaways for comparing with Klive

- Treat the CPU T-state counter as the main time axis.
- Put hardware hooks where the bus sees them: memory access, port access,
  opcode fetch, interrupt acceptance, reset, and frame boundary.
- Use a frame as a budget and a commit point, not necessarily as a giant device
  tick.
- Record sub-frame events cheaply during CPU execution, then render/mix once
  per frame from those events.
- Be explicit about read/write priority when many devices can claim the same
  memory window or port.
- Separate "compose a new frame" from "inspect the last frame." If composition
  advances Copper-like devices, it must not be used as a read-only operation.
- Avoid wiring a partially modeled device into the live machine if its clock
  domain or interrupt path is not understood yet.

## One-sentence mental model

zx-go is a bus-hooked, CPU-clocked emulator: the CPU advances T-states, bus
accesses mutate and time-stamp hardware state, and the frame boundary commits
the accumulated video/audio/peripheral effects into host-visible output.
