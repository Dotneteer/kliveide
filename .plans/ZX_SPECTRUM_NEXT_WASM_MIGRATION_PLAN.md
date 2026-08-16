# ZX Spectrum Next WASM Migration Plan

Created: 2026-08-16

Status: Steps 1-8, Step 13A, and Steps 14-21 done. Steps 9-13 have useful WASM
baselines whose audited gaps are now either fixed or explicitly deferred to
later owning steps. The current baselines cover core memory/MMU reset layout,
128K/+3/Next memory-port paging, NextReg core/gating, keyboard matrix sync, ULA
`0xfe` behavior, standard ULA instant screen rendering, minimal WASM-owned
normal frame execution, early storage-less boot/ULA smoke with unsupported-port
diagnostics, and WASM-owned DivMMC control/memory-overlay behavior needed
before SD-card SPI. SD-card SPI command parsing and read/write sector journals
now live in WASM while storage persistence remains in TypeScript. The first
deterministic storage-backed boot smoke now proves CPU-driven SPI, sector
frame-command servicing, and storage-backed ULA pixels; real NextZXOS
start-menu/manual smoke still waits for a checked-in SD image fixture and later
boot-time device slices. The early IDE inspection baseline now proves public
register, memory, port, NextReg, screen, and code-injection reads come from
WASM-owned state, CPU speed NR `$07` plus the current 28 MHz read wait-state
rule match TypeScript for the migrated timing cases, and WASM now owns the
first interrupt/IM2 daisy-chain state plus Next palette, Timex, and ULA+ port
state needed by the current standard ULA renderer.

## Goal

Migrate the current ZX Spectrum Next TypeScript implementation to a full-machine
C/WASM backend while keeping the TypeScript implementation available for oracle
comparison and fallback.

The migration must follow the established WASM V2 architecture used by the
already migrated ZX Spectrum machines:

- keep normal frame execution inside C/WASM;
- sync only changed app-owned inputs into WASM;
- expose stable typed views for high-volume buffers;
- keep app-owned file/media/project/UI policy in TypeScript;
- preserve TypeScript and WASM behavioral parity with oracle tests;
- preserve IDE-visible emulator internals with the same public API semantics as
  the TypeScript implementation;
- add WASM-side tests as sibling coverage without deleting TypeScript tests.

The desired first runnable milestone is intentionally narrower than full
hardware parity: boot the ZX Spectrum Next far enough to see the start menu,
read files from storage, and display the standard ULA screen. Later milestones
then complete Next-specific video, audio, DMA, interrupts, peripherals, and
debug/IDE parity.

## Update Rules

Future implementation work should update this file after every completed slice:

- change the step status from `Not started` to `In progress`, `Done`, or
  `Blocked`;
- add completion date and exact validation commands;
- record any deviation from the plan under the step's notes;
- add durable implementation lessons to
  `.ai/zx-spectrum-next-wasm-migration-learnings.md`.

Do not mark a step done without at least the focused tests listed for that step.

Do not mark a step `Done` merely because a narrow smoke test or shortcut works.
Before marking a migration step done, add a completion checklist that names:

- every TypeScript source file audited for that step;
- every destination C/WASM or adapter file changed for that step;
- every source behavior migrated with a raw WASM test and a public-machine API
  parity test;
- every source behavior intentionally deferred, with the later step that owns
  it.

If any expected source behavior is neither migrated nor explicitly deferred, the
step status must remain `Partial` and a correction step must be added before
continuing.

When a step migrates C/WASM device behavior, implement that behavior in the
device slice named in `Proposed Files`. Keep `zxnext.c` limited to shared state,
includes, reset/frame entry points, ROM upload, CPU exports, and generic
diagnostics. Keep `zxnext-ports.c` limited to port decoding and routing into the
owning device slices.

Every step must include a step-local guardrail. The guardrail must state which
destination slice owns the behavior, which TypeScript file is the oracle, and
which public adapter API proves the IDE sees WASM-owned state. Future work must
update that guardrail before implementation if the ownership boundary changes.

## Required Reading

Read these before changing code:

- `AGENTS.md`
- `.ai/wasm-v2-machine-migration-guide.md`
- `.plans/ZX_SPECTRUM_128_WASM_MIGRATION_PLAN.md`
- `.plans/ZX_SPECTRUM_PLUS3_WASM_MIGRATION_PLAN.md`
- `.plans/ZX_SPECTRUM_WASM_TEST_MIGRATION_PLAN.md`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `test/zxnext/TestNextMachine.ts`
- `test/wasm/zxSpectrum/wasm-test-helpers.ts`
- `test/wasm/z80/README.md`
- `test/wasm/zxSpectrum/README.md`

## Full ZX Spectrum Next Device Inventory

The current TypeScript machine composes these devices and surfaces for full
functionality. The WASM migration must account for every item, even when a later
step leaves a device TypeScript-owned by design.

- Z80N CPU and machine frame runner, including Z80/Z80N instruction semantics,
  frame counters, tact counters, interrupt signals, HALT, NMI, RETN handling,
  debug stepping, and last bus-event diagnostics.
- CPU speed control through `CpuSpeedDevice`, including 3.5/7/14/28 MHz modes,
  effective speed, hotkeys, tact scaling, and contention gating.
- Configurable Next memory through `MemoryDevice`, including current 512 KB,
  1 MB, 1.5 MB, and 2 MB models plus planned 4 MB ZX Spectrum Next KS3
  support. This includes Next ROM, DivMMC ROM, Multiface memory, Alternate ROM,
  DivMMC RAM, main SRAM, sentinel page, 8K MMU registers, 16K bank view,
  128K/+3 paging ports, Pentagon extension port, all-RAM mode, special config,
  Layer 2 read/write mapping, and current partition reporting.
- `NextRegDevice`, including register index/data ports, reset/config mode,
  descriptors, read/write handlers, port-enable gates, device side effects, and
  IDE-visible register state.
- `NextIoPortManager`, including ULA, Timex, 128K/+3/Next memory ports, NextReg
  ports, I2C, UART, CTC, ULA+, Z80 DMA, ZXN DMA, AY, DAC, SPI SD, DivMMC,
  Kempston mouse, Kempston joysticks, Multiface, Layer 2, and sprite ports.
- `UlaDevice`, including `0xfe` keyboard/border/EAR/MIC/beeper behavior and
  issue 2/3 keyboard mode.
- `NextKeyboardDevice`, including Spectrum matrix rows, extended keyboard
  behavior, key queues, NextReg `0xB0..0xB2`, and hotkey interactions.
- `NextComposedScreenDevice`, including standard ULA rendering, Timex modes,
  ULA Next modes, Layer 2, LoRes, HiRes, Tilemap, Sprites, ULA+, palette
  selection, scroll registers, clip windows, priority/compositing, 50/60 Hz
  timing, interrupts, and direct pixel buffer access.
- `PaletteDevice`, including palette control registers, auto-increment, ULA,
  Layer 2, sprite, tilemap, and ULA+ palette state.
- `TilemapDevice`, including tilemap control/default attribute/base-address
  registers and tilemap rendering inputs.
- `SpriteDevice`, including sprite slot/status ports, sprite attributes,
  sprite pattern RAM, anchor/clip/status behavior, and sprite layer rendering.
- `CopperDevice`, including copper program memory, NextReg `0x60..0x63`, raster
  tick execution, and register writes during rendering.
- `InterruptDevice`, including ULA interrupts, line interrupts, CTC interrupt
  inputs, DMA interrupt input, stackless NMI, IM2 daisy chain state, NextReg
  interrupt registers, and interrupt acknowledgement/RETN behavior.
- NMI state machine in `ZxNextMachine`, including Multiface, DivMMC, expansion
  bus NMI causes, NMI hold/end states, stackless NMI, and suppressing DivMMC
  RETN while Multiface is active.
- `DivMmcDevice`, including DivMMC enable, CONMEM, MAPRAM, bank selection,
  automap entry/exit points, RST traps, button NMI latch, and memory-map side
  effects.
- `SdCardDevice`, including SPI chip select, SD command state machines for two
  cards, card info, read/write sector frame commands, response readiness, write
  failure reporting, multi-block read/write, CRC handling, and reset retention.
- `MultifaceDevice`, including enable gates, Multiface memory/ports, NMI entry,
  active state, and memory-map side effects.
- `ExpansionBusDevice`, including expansion enable, ROMCS replacement,
  I/O/memory cycle propagation flags, NMI debounce, max-speed propagation, and
  bus-visible persistence bits.
- `FloppyControllerDevice`, including +3 FDC ports, motor control, drive count,
  disk read/write/status behavior, logs, and disk-change persistence hooks.
- `CtcDevice`, including eight CTC channels, lazy sync on port reads/writes,
  interrupt outputs, prescalers, counters, and channel control words.
- `DmaDevice`, including Z80 DMA and ZXN DMA command parsing, bus request and
  acknowledge state, memory/port transfers, timing, auto-restart, interrupts,
  register reads, and machine integration.
- `I2cDevice`, including RTC-style DS1307 behavior, SCL/SDA port state,
  per-frame 1 Hz clock advance, and config-mode constraints.
- `UartDevice`, including channels, Tx/Rx/select/frame ports, FIFOs, status,
  and per-frame auto-drain.
- `JoystickDevice`, including Kempston joystick 1, joystick 1 alias, joystick 2,
  MD selection, and port-enable gating.
- `MouseDevice`, including Kempston mouse X/Y/wheel/buttons and mouse enable.
- `NextSoundDevice`, including audio NextReg configuration flags.
- `AudioControlDevice`, including TurboSound, DAC, audio mixer configuration,
  state save/restore, mono/stereo/routing/scaling controls.
- `TurboSoundDevice`, including three PSG chips, AY/YM behavior, panning,
  selected chip/register behavior, audio generation, and diagnostic state.
- `DacDevice`, `DacNextRegDevice`, and `DacPortDevice`, including four DAC
  channels, SoundDrive/SpecDrum/Covox/Pentagon port mappings, NextReg writes,
  reset, and sample conversion.
- `AudioMixerDevice`, including mixing of beeper, PSG, DAC, input levels,
  output scaling, clipping, and state persistence.
- `SpectrumBeeperDevice`, including EAR/MIC driven beeper samples, frame sample
  collection, sample rate, and normalized adapter output.
- IDE/debug integration, including register display, CPU state, memory
  contents, memory mapping panel, disassembly view, ULA/screen information,
  NextReg panel, palette panel, debugger bus-event state, memory partition
  labels, code injection, file provider access, frame commands, and renderer
  pixel-buffer access.

## Architecture Direction

Use a full-machine C/WASM backend named `zxnext`, not a hybrid CPU-only bridge.

Normal frame path:

1. Sync changed app-owned inputs: keyboard, joystick, mouse, audio sample rate,
   target clock multiplier, SD-card command responses, and any attached media
   metadata still owned by TypeScript.
2. Call one exported frame function, for example `zxnextExecuteFrame()`.
3. Read stable typed views for memory, pixels, audio samples, keyboard rows,
   NextReg diagnostics, and dirty media journals.
4. Publish app-owned side effects such as SD card read/write frame commands and
   disk/media changes from the adapter.

Do not cross JS/WASM per tact, per memory access, per port access, per rendered
scanline, per audio sample, or per DMA byte during normal running.

TypeScript remains the owner of:

- project files and IDE messaging;
- ROM/resource loading;
- SD-card backing file reads and writes;
- optional disk/DSK parsing unless the hot FDC path needs a bounded WASM upload;
- model picker labels and settings;
- high-level debugger policy and UI state.

WASM owns hot deterministic state:

- Z80N execution and registers;
- memory map and port decode;
- NextReg side effects;
- screen/audio timing;
- storage command state machines once inputs are uploaded;
- DMA/Copper/CTC/interrupt timing;
- last bus events and inspection snapshots.

## IDE Internal Inspection Contract

The WASM backend must support the IDE's emulator-inspection features with the
same observable semantics as the TypeScript backend. This is not optional polish:
the IDE uses machine APIs to show and edit internals while the emulator is
running or paused.

The adapter must keep these public surfaces coherent with WASM-owned state:

- CPU register panels and `getCpuState()`, including alternate registers,
  interrupt flip-flops, interrupt mode, PC/SP/IX/IY/IR/WZ, HALT state, current
  opcode prefix, frame/tact counters, and snooze/debug flags.
- Memory views and watch/disassembly reads through `doReadMemory`,
  `doWriteMemory`, `get64KFlatMemory`, partition reads, direct RAM/ROM bank
  helpers, and current partition labels.
- Disassembly context, including partition lookup, bank-aware code injection,
  execution point, last memory reads/writes, and stable reads that do not
  accidentally inspect stale TypeScript memory.
- Port/debug views, including `doReadPort`, `doWritePort`, last I/O read/write
  port/value, floating/open bus diagnostics where exposed, and contention
  counters used by debugger/status panes.
- ULA and screen inspection, including standard ULA memory reads, current screen
  bank, timing dimensions, pixel buffers, buffer byte views, border state,
  ULA Next format, palette selection, and layer state as each layer migrates.
- Next-specific panels, including NextReg descriptors plus live values, memory
  mapping state, palette state, sprite/tilemap/copper state, DMA/CTC/interrupt
  status, SD-card/DivMMC state, and audio diagnostic state as those devices
  become WASM-owned.
- Lifecycle/debug operations, including pause, reset, restart, step into,
  step over/out policy, breakpoints, code injection, media/storage flush hooks,
  and frame-command processing.

For each migrated slice, add at least one test through public IDE-facing machine
APIs, not only through raw WASM exports. Raw exports are useful for isolating C
logic, but they do not prove the IDE sees the same state.

## Proposed Files

- `src/emu/machines/zxNext/ZxNextImplementation.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`
- `src/emu/machines/zxNext/wasm/README.md`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-speed.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-layer2.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-lores.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sdcard.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-multiface.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-expansion.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-audio.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-psg.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dac.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ctc.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tilemap.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sprites.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-floppy.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-i2c.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-input.c`
- `scripts/build-zxnext-wasm.cjs`
- `scripts/build-zxnext-wasm.d.cts`
- `scripts/check-zxnext-wasm-size.cjs`
- `test/zxnext/ZxNextMachineFactory.test.ts`
- `test/zxnext/ZxNextWasmV2Machine.test.ts`
- `test/zxnext/zxnext-wasm-v2-loader.test.ts`
- `test/zxnext/zxnext-wasm-build.test.ts`
- `test/wasm/zxNext/wasm-next-test-helpers.ts`
- `test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
- `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
- `test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`
- `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`
- `test/wasm/zxNext/wasm-next-ide-inspection.test.ts`
- `test/wasm/zxNext/wasm-next-screen-composition.test.ts`
- `test/wasm/zxNext/wasm-next-audio.test.ts`
- `test/wasm/zxNext/wasm-next-storage.test.ts`
- `test/wasm/zxNext/wasm-next-dma.test.ts`
- `test/wasm/zxNext/wasm-next-interrupts.test.ts`
- `test/wasm/zxNext/wasm-next-peripherals.test.ts`
- `test/wasm/zxNext/wasm-next-oracle-programs.test.ts`

Reuse shared C/WASM code only when behavior is genuinely shared. Good reuse
candidates are Z80 base operations, Spectrum ULA/keyboard/beeper helpers, PSG
core ideas, and +3 FDC lessons. Next-specific MMU, NextRegs, composed video,
SD-card SPI, DMA, Copper, CTC, and Z80N behavior should live in `zxnext`.

Architecture correction on 2026-08-16:

- Steps 9-11 originally placed too much implementation into `zxnext.c`.
- This was corrected before Step 12 by splitting the C code according to this
  section:
  - `zxnext.c` is now the composition/glue file with shared state, Z80
    integration, reset/frame entry points, ROM upload, CPU exports, and generic
    diagnostics.
  - `zxnext-memory.c` owns physical memory, MMU, partitions, sentinel handling,
    memory sizing, and memory inspection exports.
  - `zxnext-ports.c` owns Next memory-port and NextReg port decoding.
  - `zxnext-nextreg.c` owns NextReg storage, reset defaults, index/data helpers,
    config mode, and port-enable gates.
  - `zxnext.h` owns shared constants and cross-slice prototypes.
- The project follows the existing Spectrum WASM include style: device `.c`
  slices are included by `zxnext.c`, rather than compiled as separate object
  files, so they can share bounded static state without linker-level plumbing.
- Future migration steps must treat this as a guardrail: when adding ULA,
  keyboard, screen, storage, audio, or peripheral behavior, add the logic to the
  matching planned slice and update `zxnext.c` only for includes or tiny shared
  state declarations.

## Test Migration Strategy

Follow the pattern from `.plans/ZX_SPECTRUM_WASM_TEST_MIGRATION_PLAN.md`.

- Keep every original TypeScript test under `test/zxnext`, `test/audio`,
  `test/disk`, and `test/z80`.
- Add WASM tests as sibling coverage under `test/wasm/zxNext`.
- Use `ZxNextMachine` and `TestZxNextMachine` as TypeScript oracles.
- For CPU semantics, preserve the literal copied Z80/Z80N tests where a wrapper
  can keep the original test-facing contract. Adapt through harnesses, aliases,
  and wrappers, not by editing copied test cases.
- For device tests, migrate semantics in small groups rather than copy huge
  fixtures blindly. Each new WASM test should name the TypeScript source test
  it mirrors.
- Prefer public machine APIs and port/NextReg writes over test-only helpers
  when the behavior is user-visible.
- Use test-only WASM exports only for deterministic setup, single-instruction
  stepping, timing probes, and snapshots that TypeScript tests already inspect.

## Detailed Migration Steps

### Step 1 - Establish Tracking Documents

Status: Done on 2026-08-16.

Create this plan and the separate learnings log.

Implementation:

- Add `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`.
- Add `.ai/zx-spectrum-next-wasm-migration-learnings.md`.
- Link the learnings log from this plan.

Tests:

- `git diff --check`

Definition of done:

- Both files exist.
- Future update rules are present.

Completion notes:

- Added this migration plan.
- Added `.ai/zx-spectrum-next-wasm-migration-learnings.md`.
- Validation for this slice is tracked together with Steps 2-3 because the
  files were updated again when executing the initial plan steps.

### Step 2 - Inventory Current Next Contracts

Status: Done on 2026-08-16.

Create a machine contract inventory before writing WASM code.

Implementation:

- Review `ZxNextMachine`, `Z80NMachineBase`, `MemoryDevice`,
  `NextRegDevice`, `NextIoPortManager`, and `NextComposedScreenDevice`.
- Record exported public methods and IDE-facing fields that the WASM adapter
  must override instead of inheriting stale TypeScript state.
- Build a checklist table in this plan or a companion note covering memory,
  ports, screen, audio, storage, debug, and frame commands.

Tests:

- No code tests; documentation-only step.
- `git diff --check`

Definition of done:

- The checklist identifies every inherited API that must become WASM-owned.
- Known TypeScript-only app-owned surfaces are explicitly excluded.

Completion notes:

- Added the contract inventory below.
- The inventory separates WASM-owned deterministic state from TypeScript-owned
  app, file, project, and UI policy surfaces.
- Validation:
  - `git diff --check`

#### Step 2 Contract Inventory

The WASM adapter must not inherit public methods that read stale TypeScript
device state after the corresponding device moves into WASM. For each contract,
prefer parity tests through public machine APIs first, then add raw WASM tests
for isolated C behavior.

| Contract area | Current TypeScript surface | WASM-owned state | Adapter requirement | First tests |
| --- | --- | --- | --- | --- |
| CPU/register inspection | `getCpuState()`, debug execution, breakpoint flow, register mutation helpers inherited from `Z80NMachineBase` | Z80N registers, alternates, flags, IM/IFF, WZ, HALT, prefix, PC/SP/IX/IY/IR, frame/tact counters, last bus events | Override every CPU-state read/write path used by debugger panels and code injection so the IDE never reads the dormant TypeScript CPU | Copied Z80N opcode tests plus public `getCpuState()` parity after setup, single step, reset, and interrupt |
| Memory reads and writes | `doReadMemory`, `doWriteMemory`, `get64KFlatMemory`, partition helpers, RAM/ROM bank helpers, code-injection reads | 8K MMU slots, 16K paging view, ROM selection, DivMMC/Multiface/Alt ROM overlays, Layer 2 mapping, all-RAM mode, configured RAM size up to 4 MB KS3 | All debugger, memory panel, watch, and disassembly reads must bridge to WASM memory and WASM partition labels | Oracle memory-map table tests and IDE-facing reads for each mapped partition |
| Memory partition metadata | `getCurrentPartitions`, `getMemoryPartition`, `getPartitionLabels` style helpers used by memory/disassembly UI | Active MMU pages, ROM page, SRAM page, overlay source, sentinel page | Keep labels and section types identical to TypeScript; 4 MB models must label pages beyond current 2 MB range | Partition parsing snapshots for 512 KB, 1 MB, 1.5 MB, 2 MB, and 4 MB KS3 |
| Port I/O and bus diagnostics | `doReadPort`, `doWritePort`, `portManager`, last I/O read/write event fields | Port decode gates, floating/open bus value, contention, device side effects, TBBlue/NextReg bus events | Override port methods and diagnostics together; no TypeScript device should observe a port write after its target is WASM-owned | Port matrix parity for ULA, NextReg, memory, SPI, AY, DAC, DMA, CTC, joystick, mouse |
| NextReg inspection | `nextRegDevice`, descriptors, live register values, indexed read/write ports | NextReg values, reset/config mode, port enables, side effects on devices | Keep descriptor metadata in TypeScript if useful, but live values and side effects must come from WASM | Public NextReg read/write parity plus IDE panel snapshot tests |
| Standard ULA screen | `UlaDevice`, `NextComposedScreenDevice`, pixel buffer, buffer bytes, border, screen dimensions | ULA memory fetches, attributes, flash, border color, timing, scanline pixel output | Expose stable typed pixel views and identical dimensions; `getPixelBuffer()` must not expose stale TypeScript rendering | ULA render parity for standard 256x192 screen, border, flash, and timing |
| Advanced video layers | `PaletteDevice`, `TilemapDevice`, `SpriteDevice`, Layer 2/LoRes/Timex/ULA+ state in screen device | Palette RAM, ULA+/Timex modes, Layer 2 RAM windows, tilemap config, sprite attributes/pattern RAM, composition priority | Migrate in layers and override inspection methods as each layer moves; unmigrated layers may remain TypeScript-owned only while the frame path is still explicit about it | Existing layer/sprite/tilemap tests cloned as WASM sibling tests |
| Interrupts and NMI | `InterruptDevice`, NMI state fields in `ZxNextMachine`, `onInterruptAcknowledged`, `onRetnExecuted` | ULA line interrupts, CTC/DMA interrupt inputs, IM2 daisy chain, stackless NMI, Multiface/DivMMC/expansion NMI causes | Keep debugger stepping, interrupt acknowledge, RETN, and bus-event state coherent with WASM CPU/device state | Interrupt, daisy-chain, stackless-NMI, and NMI-state-machine parity |
| Storage and DivMMC | `DivMmcDevice`, `SdCardDevice`, frame commands, `processFrameCommand`, main API sector I/O | DivMMC automap and banks, SD SPI command state, sector command queues, card response state | WASM owns protocol/state machines; TypeScript remains file/backing-store owner and services frame commands | DivMMC automap parity and SD read/write command tests with TypeScript-backed sectors |
| Floppy/FDC | `FloppyControllerDevice`, disk media properties, disk-change hooks | FDC registers, motor state, command execution, optional bounded disk buffer state | Keep attached media and DSK parsing TypeScript-owned unless a hot path is uploaded; expose diagnostics from WASM when migrated | Existing floppy tests as WASM sibling tests after storage milestone |
| Keyboard, joystick, mouse | `NextKeyboardDevice`, `JoystickDevice`, `MouseDevice`, key queues and matrix APIs | Matrix rows, Next extended keyboard regs, Kempston joystick/mouse state, hotkey-visible gates | Sync changed input state once per frame/debug step and expose keyboard/mouse/joystick inspection through adapter | Public input matrix and port-read parity |
| Audio | `SpectrumBeeperDevice`, `NextSoundDevice`, `AudioControlDevice`, `TurboSoundDevice`, `DacDevice`, `AudioMixerDevice` | Beeper, PSG/TurboSound, DAC, mixer routing, sample timing, audio diagnostics | Expose audio sample typed views and diagnostic state; TypeScript may keep WebAudio/app playback ownership | Existing audio tests ported as WASM sibling tests with sample-count and sample-value parity |
| DMA, Copper, CTC | `DmaDevice`, `CopperDevice`, `CtcDevice` | Timing counters, command parsing, memory/port transfers, register state, interrupts | Keep execution inside WASM during frames; expose device state for IDE panels and debug assertions | Device-specific copied tests plus frame-level interaction tests |
| UART and I2C | `UartDevice`, `I2cDevice` | UART FIFOs/status, DS1307-like clock/SCL/SDA state | Sync external data/clock policy from TypeScript, but keep port-visible device state in WASM once migrated | Existing UART/I2C tests as WASM sibling tests |
| Expansion and Multiface | `ExpansionBusDevice`, `MultifaceDevice` | ROMCS, NMI debounce, persistence bits, Multiface active/memory/ports | WASM owns memory/port/NMI effects; TypeScript keeps external expansion policy if needed | Expansion bus and Multiface parity |
| Lifecycle and IDE commands | `reset`, `hardReset`, frame execution, debug stepping, code injection, media flushes, machine properties | Deterministic machine state, pending frame commands, dirty media journals, inspection snapshots | Reset/start/step APIs must reset and read WASM state; app-owned properties remain in TypeScript and are synced deliberately | Public lifecycle tests with CPU, memory, screen, storage, and IDE snapshot assertions |
| App-owned surfaces | ROM/resource loading, project files, SD image file I/O, disk/tape backing files, renderer UI state, debugger policy, menus/model picker | None, except uploaded immutable resources or bounded media buffers | Keep in TypeScript; only sync byte buffers, configuration values, and command responses into WASM | Tests verify app-owned media survives reset and model picker remains product-oriented |

### Step 3 - Add Implementation Switch And Factory

Status: Done on 2026-08-16.

Mirror the 48K/128K two-value switch pattern.

Implementation:

- Add `MC_ZXNEXT_IMPLEMENTATION = "zxnextImplementation"` to machine constants.
- Add `ZxNextImplementation.ts` with:
  - `type ZxNextImplementation = "typescript" | "wasm"`;
  - `ZXNEXT_IMPLEMENTATION`;
  - `DEFAULT_ZXNEXT_IMPLEMENTATION = "typescript"` until the boot/storage/ULA
    milestone passes;
  - `getZxNextImplementation(config?: Record<string, unknown>)`.
- Add `createZxNextMachine(model?, config?, messenger?)`.
- Route the renderer registry through the factory.
- Keep model picker entries product-oriented. Do not add "ZX Next WASM" models.

Tests:

- Add `test/zxnext/ZxNextMachineFactory.test.ts`.
- Cover default TypeScript, explicit TypeScript, explicit WASM placeholder, and
  unknown value fallback.
- Run:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts`
  - `npm run build:check`

Definition of done:

- Explicit `"wasm"` selection is testable even before the real adapter exists.

Completion notes:

- Added `MC_ZXNEXT_IMPLEMENTATION`.
- Added `ZxNextImplementation.ts`.
- Added `ZxNextMachineFactory.ts`.
- Routed `MI_ZXNEXT` through the centralized factory.
- Added focused factory/registry tests while keeping the product model list free
  of backend-specific entries.
- Step 6 replaced the explicit `"wasm"` placeholder branch with
  `ZxNextWasmV2Machine`.
- Validation:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts`
  - `npm run build:check`
  - `git diff --check`

### Step 4 - Create Build Script And Empty WASM Artifact

Status: Done on 2026-08-16.

Create the standalone production artifact pipeline.

Implementation:

- Add `scripts/build-zxnext-wasm.cjs`.
- Add `scripts/build-zxnext-wasm.d.cts`.
- Add `scripts/check-zxnext-wasm-size.cjs`.
- Add `src/emu/machines/zxNext/wasm/zxnext/zxnext.c` with static memory and
  minimal exports.
- Build to `src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm`.
- Add package resource copy from the Next WASM dist folder to
  `wasm/zxNext`.
- Do not emit test-only artifacts from the production build script.

Tests:

- Add `test/zxnext/zxnext-wasm-build.test.ts`.
- Cover compiler args, production artifact path, exported symbol list, package
  resource path, size limit parsing, and instantiation.
- Run:
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size`

Definition of done:

- The artifact builds and instantiates with only production exports.

Completion notes:

- Added `scripts/build-zxnext-wasm.cjs`.
- Added `scripts/build-zxnext-wasm.d.cts`.
- Added `scripts/check-zxnext-wasm-size.cjs`.
- Added `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`.
- Added package scripts `build:zxnext-wasm` and `check:zxnext-wasm-size`.
- Added Electron package resource copy from
  `src/emu/machines/zxNext/wasm/dist` to `wasm/zxNext`.
- Built `src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm`.
- Initial skeleton artifact size was 2,169 bytes, below the original 80,000
  byte Step 4 ceiling.
- Step 8 links the shared Z80N core into the same production artifact; the
  current artifact size is 117,934 bytes under the 360,000 byte Z80N-baseline
  ceiling.
- Validation:
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size`

### Step 5 - Add Loader And Typed View Validation

Status: Done on 2026-08-16.

Add the TypeScript loader before the adapter.

Implementation:

- Add `ZxNextWasmV2Loader.ts`.
- Validate:
  - `memory`;
  - required function exports;
  - typed views against `memory.buffer`;
  - artifact name in load errors.
- Initial views:
  - 64K flat memory view;
  - configured SRAM/ROM buffer views, prepared for both current 2 MB models and
    the 4 MB ZX Spectrum Next KS3 edition;
  - keyboard rows;
  - NextReg byte array;
  - pixel buffer bytes/words;
  - audio sample buffer;
  - SD-card command/response buffers;
  - diagnostic snapshots.

Tests:

- Add `test/zxnext/zxnext-wasm-v2-loader.test.ts`.
- Cover successful loading, missing exports, out-of-range views, module cache
  reset, artifact name, and initial pointer lengths.
- Run:
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-v2-loader.test.ts`
  - `npm run build:zxnext-wasm`

Definition of done:

- Loader tests fail clearly if any required export or view is missing.

Completion notes:

- Added `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`.
- Validates required production exports and includes the artifact name in
  missing-export and out-of-range-view errors.
- Exposes typed views for:
  - 64K flat memory;
  - 4 MB SRAM capacity for current and KS3-sized models;
  - packed ROM area for NextZXOS, DivMMC, Multiface, and Alternate ROM bytes;
  - keyboard rows;
  - 256 NextReg bytes;
  - 720x288 pixel buffer as words and bytes;
  - stereo audio sample buffer;
  - SD-card command and response buffers;
  - diagnostic buffer.
- Added `test/zxnext/zxnext-wasm-v2-loader.test.ts`.
- Validation:
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-v2-loader.test.ts`
  - `npm run build:zxnext-wasm`

### Step 6 - Add Minimal WASM Adapter Skeleton

Status: Done on 2026-08-16.

Create `ZxNextWasmV2Machine` with no hot-path delegation yet.

Implementation:

- Extend `ZxNextMachine` initially to preserve UI contract while replacing
  internals slice by slice.
- Add `implementation = "wasm"`.
- Load runtime in `setup()`.
- Upload the four ROM resources:
  - `roms/enNextZX.rom`;
  - `roms/enNxtmmc.rom`;
  - `roms/enNextMf.rom`;
  - `roms/enAltZX.rom`.
- Override `hardReset()` and `reset()` to initialize C state and replay ROMs.
- Expose `getWasmV2Diagnostics()`.

Tests:

- Add `test/zxnext/ZxNextWasmV2Machine.test.ts`.
- Cover setup, artifact name, ROM upload, reset state, implementation marker,
  diagnostics, and factory creation.
- Run:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm run build:check`

Definition of done:

- A WASM-selected machine can set up and reset without executing a frame.

Completion notes:

- Added `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.
- The adapter extends `ZxNextMachine`, exposes `implementation = "wasm"`, loads
  the v2 runtime in `setup()`, and uploads the same four ROM resources used by
  the TypeScript machine:
  - `roms/enNextZX.rom`;
  - `roms/enNxtmmc.rom`;
  - `roms/enNextMf.rom`;
  - `roms/enAltZX.rom`.
- `setup()` uploads ROM bytes both into the TypeScript memory device and into
  the C ROM buffer so inherited UI surfaces remain coherent until later steps
  replace them.
- `reset()` and `hardReset()` initialize C reset state and replay the uploaded
  ROM bytes.
- Added `getWasmV2Diagnostics()`.
- Updated `createZxNextMachine()` so explicit `"wasm"` creates
  `ZxNextWasmV2Machine`; the default remains TypeScript.
- Added `test/zxnext/ZxNextWasmV2Machine.test.ts`.
- Updated `test/zxnext/ZxNextMachineFactory.test.ts` for the Step 6 WASM
  skeleton branch.
- Validation:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm run build:check`

### Step 7 - Shared Next WASM Test Helper

Status: Done on 2026-08-16.

Create a dedicated helper for small, cheap-model-friendly test slices.

Implementation:

- Add `test/wasm/zxNext/wasm-next-test-helpers.ts`.
- Provide:
  - `buildZxNextWasmArtifact()`;
  - deterministic ROM page helpers;
  - `createTestZxNextWasmMachine()`;
  - `createOracleZxNextMachine()`;
  - code initialization helpers;
  - single-instruction execution helpers;
  - port and NextReg write/read helpers;
  - memory/MMU assertions;
  - pixel/audio/storage assertions.

Tests:

- Add a helper smoke test that creates TypeScript and WASM machines with fixed
  ROM bytes.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts`

Definition of done:

- New WASM tests can use helpers without duplicating loader setup.

Completion notes:

- Added `test/wasm/zxNext/wasm-next-test-helpers.ts`.
- Provides:
  - `buildZxNextWasmArtifact()`;
  - deterministic ROM set helpers;
  - `createTestZxNextWasmMachine()`;
  - `createOracleZxNextMachine()`;
  - code initialization and single-instruction helpers;
  - memory, port, NextReg, CPU register, pixel/audio assertion helpers.
- Added `test/wasm/zxNext/wasm-next-test-helpers.test.ts`.
- Validation:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts`

### Step 8 - Z80N CPU Baseline

Status: Done on 2026-08-16.

Wire the existing Z80N-capable C/WASM CPU core into the ZX Spectrum Next
full-machine backend and prove it can execute simple Next ROM code.

Finding on 2026-08-16:

- The shared C core at `src/emu/z80/wasm/z80.c` already contains Z80N mode via
  `z80SetZ80NMode()`.
- The C core implements the Next ED-opcode subset covered by the current tests,
  including `SWAPNIB`, `MIRROR A`, `TEST N`, barrel shifts/rotates, `MUL`,
  `ADD xx,A`, `PUSH NN`, `OUTINB`, `NEXTREG`, `PIXELDN`, `PIXELAD`, `SETAE`,
  `JP (C)`, and the block-copy variants.
- The copied WASM test `test/wasm/z80/next-ops.test.ts` passed with
  `npx vitest run --config test/wasm/vitest.z80.config.ts test/wasm/z80/next-ops.test.ts`
  on 2026-08-16: 95 tests passed.
- Therefore this step should not port Z80N from scratch. It should reuse the
  existing core, enable Z80N mode in the ZX Next C machine, and wire the
  machine-specific callbacks/events.

Implementation:

- Reuse the existing `src/emu/z80/wasm/z80.c` core.
- Enable Z80N mode during ZX Next hard reset/setup.
- Wire Z80N `NEXTREG`/TBBlue operations to the ZX Next WASM NextReg
  implementation instead of leaving them as standalone test bus events.
- Wire Z80N memory, port, interrupt, NMI, RETN, tact, and last bus-event hooks
  into the ZX Next C machine state.
- Export CPU register getters/setters needed by test helpers.
- Export `zxnextExecuteInstruction()`.
- Preserve frame lifecycle invariants from the Spectrum V2 guide.

Tests:

- Add or extend `test/wasm/zxNext/wasm-next-cpu.test.ts`.
- Keep running the existing copied standalone Z80N WASM suite:
  `test/wasm/z80/next-ops.test.ts`.
- Add ZX Next machine-level tests for selected Z80N opcodes that need machine
  integration:
  - `NEXTREG N,N`;
  - `NEXTREG N,A`;
  - `OUTINB`;
  - `JP (C)`;
  - at least one block-copy variant that crosses the memory callback path.
- Add simple programs:
  - NOP;
  - LD/JP loop;
  - memory read/write;
  - port IN/OUT.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-cpu.test.ts`
  - `npx vitest run --config test/wasm/vitest.z80.config.ts test/wasm/z80/next-ops.test.ts`

Definition of done:

- WASM and TypeScript agree on PC, tacts, registers, memory effects, and port
  effects for the migrated CPU subset.

Completion notes:

- Reused `src/emu/z80/wasm/z80.c` from the production Next C module.
- Enabled Z80N mode during `zxnextReset()` and `zxnextHardReset()`.
- Added a full-instruction wrapper `zxnextExecuteInstruction()` that advances
  through prefix cycles until the Z80 core prefix state clears.
- Wired CPU memory callbacks to the current 64K flat memory view.
- Wired CPU port callbacks to the initial Next WASM port latch and bus-event
  diagnostics.
- Wired Z80N TBBlue `NEXTREG` bus events into the WASM `nextRegs` byte array.
- Exported CPU register/tact getters and setters for tests and adapter sync.
- Updated the loader to require the CPU exports.
- Updated `ZxNextWasmV2Machine.getCpuState()` to sync WASM-owned CPU registers,
  tacts, and last bus events into the public IDE-facing CPU state surface.
- Added `test/wasm/zxNext/wasm-next-cpu.test.ts`.
- Base Z80 instructions are compared against the TypeScript ZX Next oracle.
  Next-only Z80N ED opcodes are currently asserted against the reused C core's
  established semantics and machine-level side effects because the TypeScript
  CPU oracle does not expose the same Z80N ED-op subset.
- Current artifact size after linking the Z80N core: 117,934 bytes.
- Validation:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-cpu.test.ts`
  - `npx vitest run --config test/wasm/vitest.z80.config.ts test/wasm/z80/next-ops.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm run check:zxnext-wasm-size`
  - `npm run build:check`

### Step 9 - Core Memory And Reset Layout

Status: Partial baseline completed on 2026-08-16; parity gaps audited in Step 13A

Move the configurable Next memory map into C, prepared for the 4 MB ZX Spectrum
Next KS3 edition.

Implementation:

- Allocate bounded static memory with a compile-time maximum large enough for
  the ZX Spectrum Next KS3 4 MB edition.
- Keep the active memory size configurable per model/config. Do not hard-code
  the current TypeScript `OFFS_ERR_PAGE = 2048 * 1024` limit into the WASM
  ABI.
- Place the sentinel/invalid page after the configured active memory region,
  not permanently after 2 MB.
- Export memory-capacity and active-memory-size helpers so the loader and IDE
  can validate typed views and model-specific bounds.
- Preserve offsets:
  - Next ROM;
  - DivMMC ROM;
  - Multiface memory;
  - Alternate ROM;
  - DivMMC RAM;
  - main Next RAM;
  - sentinel page.
- Define the SRAM bank/page numbering contract for 512 KB, 1 MB, 1.5 MB, 2 MB,
  and 4 MB configurations before porting MMU logic.
- Audit whether the current TypeScript `MemoryDevice` needs a 4 MB follow-up;
  if TypeScript is not yet KS3-ready, add oracle tests for the intended
  contract and keep the WASM ABI future-proof.
- Implement reset and hard-reset clearing rules.
- Export flat 64K reads/writes and partition/memory-page inspection helpers.

Tests:

- Add `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`.
- Migrate reset layout expectations from `test/zxnext/MemoryDevice.test.ts`.
- Add model-size cases for 512 KB, 1 MB, 1.5 MB, 2 MB, and a 4 MB KS3
  configuration.
- Compare TypeScript and WASM:
  - MMU registers after reset;
  - slot read/write offsets;
  - ROM write protection;
  - hard-reset preservation/clearing;
  - active memory size, sentinel page location, highest valid SRAM page, and
    invalid-page behavior.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts`

Definition of done:

- Public `doReadMemory`, `doWriteMemory`, `get64KFlatMemory`,
  `getCurrentPartitions`, and partition helpers observe WASM-owned state.
- The WASM memory ABI can represent the planned 4 MB KS3 edition without a
  breaking loader or adapter redesign.

Completion notes:

- Added a C-owned physical memory layout with Next ROM, DivMMC ROM, Multiface
  ROM, Alternate ROM, DivMMC RAM, main Next RAM, and a sentinel page after the
  configured active memory region.
- Kept the SRAM typed view at 4 MB capacity while making active main RAM pages
  configurable for 512 KB, 1 MB, 1.5 MB, 2 MB, and the future 4 MB KS3 shape.
- Defined the WASM page-count contract as 32, 96, 160, 224, and 480 active 8K
  main RAM pages respectively, matching TypeScript for current sizes and
  reserving 4 MB behavior in WASM.
- Added MMU register/page metadata in C and reset the default layout to
  `ff ff 0a 0b 04 05 00 01`.
- Changed CPU memory callbacks to use the mapped WASM memory path instead of
  directly reading/writing the flat 64K projection.
- Added exports for configured memory size, active memory size, sentinel
  location, physical reads/writes, SRAM page reads/writes, MMU registers, page
  offsets, and current partition inspection.
- Updated `ZxNextWasmV2Machine` so public `doReadMemory`, `doWriteMemory`,
  `get64KFlatMemory`, `getMemoryPartition`, `getCurrentPartitions`,
  `getPartition`, and `readScreenMemory` observe WASM-owned memory state after
  setup.
- Added optional model-config memory sizing through `MC_MEM_SIZE`; a model
  using `4096` configures the WASM backend for 4 MB without changing the
  TypeScript default.
- Added `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`.
- Current artifact size after the memory/MMU baseline: 217,244 bytes.
- Validation:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`

### Step 10 - 128K/+3/Next MMU Ports

Status: Partial baseline completed on 2026-08-16; parity gaps audited in Step 13A

Implement memory ports and MMU register effects required for boot.

Implementation:

- Port `0x7ffd`, `0xdffd`, `0x1ffd`, and `0xeff7` behavior.
- Implement all-RAM mode, special config, shadow screen, selected ROM/bank, and
  mapping mode.
- Implement 8K MMU register writes through NextRegs `0x50..0x57` if currently
  handled in `NextRegDevice`.
- Keep current partition labels synchronized into the adapter.

Tests:

- Extend `wasm-next-memory-mmu.test.ts`.
- Migrate relevant expectations from:
  - `test/zxnext/MemoryDevice.test.ts`;
  - `test/memory/partition-parsing.test.ts` only where WASM owns labels.
- Add TypeScript oracle comparisons for port writes and NextReg MMU writes.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/MemoryDevice.test.ts`

Definition of done:

- Banked code injection and IDE memory mapping can read coherent WASM-owned
  state.

Completion notes:

- Implemented WASM-side writes for `0x7ffd`, `0xdffd`, `0x1ffd`, and `0xeff7`
  using the same port masks as `NextIoPortManager`.
- Added C-owned paging state for paging lock, shadow screen selection,
  all-RAM mode, special config, selected ROM bits, selected RAM bank bits, and
  the Pentagon `0xeff7` bank-0 override.
- Implemented normal-mode, all-RAM, restore-from-all-RAM, paging-lock, and
  `0xeff7` slot-0/1 mapping behavior.
- Implemented direct MMU NextReg side effects for `0x50..0x57`, including
  CPU-driven Z80N `NEXTREG` instructions.
- Matched the TypeScript priority-decode behavior where MMU values `224..255`
  map through system-region decode on any slot, not only slots 0 and 1.
- Added inspection exports for port latch values, selected ROM/RAM,
  selected-bank parts, paging/all-RAM flags, special config, and shadow-screen
  state.
- Updated `ZxNextWasmV2Machine.doWritePort()` to keep TypeScript-owned
  not-yet-migrated side effects alive while updating WASM-owned memory mapping.
- Updated `ZxNextWasmV2Machine.tbblueOut()` and selected ROM/RAM getters to use
  WASM-owned state once the runtime is available.
- Extended `test/wasm/zxNext/wasm-next-memory-mmu.test.ts` with TypeScript
  oracle comparisons for `0x7ffd`, `0xdffd`, `0x1ffd`, `0xeff7`, paging lock,
  all-RAM mappings/restoration, MMU NextRegs, and CPU `NEXTREG` MMU side
  effects.
- Current artifact size after port/MMU paging: 218,617 bytes.
- Validation:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/MemoryDevice.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`

### Step 11 - NextReg Core And Port Enable Gates

Status: Partial baseline completed on 2026-08-16; parity gaps audited in Step 13A

Move NextReg storage and side effects needed by boot into WASM.

Implementation:

- Implement NextReg index/data ports `0x243b` and `0x253b`.
- Implement register reset defaults.
- Implement config mode and hard reset behavior.
- Implement port-enable gates `0x82..0x85` and bus/expansion controls enough
  for port manager parity.
- Expose descriptors through the existing TypeScript descriptor metadata while
  values come from WASM.

Tests:

- Add `test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/NextRegDevice.test.ts`;
  - `test/zxnext/PortEnableGating.test.ts`.
- Compare register reads/writes and side effects against TypeScript oracle.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`

Definition of done:

- NextReg panel state reads WASM-owned values through public machine APIs.

Completion notes:

- Implemented WASM NextReg index/data ports `0x243b` and `0x253b`.
- Added boot-relevant NextReg hard/soft reset defaults, including MMU
  registers, common video/palette/storage defaults, expansion-bus defaults, and
  internal port-enable defaults.
- Added WASM state for NextReg index, last read value, last write values,
  config mode, internal port enables `0x82..0x85`, expansion-bus port enables
  `0x86..0x89`, and IO propagate register `0x8a`.
- Implemented effective port-enable checks with expansion-bus AND masking when
  `NR 0x80` enables the bus.
- Updated WASM memory-port writes so `0x7ffd`, `0xdffd`, `0x1ffd`, and
  `0xeff7` obey the migrated gates.
- Bridged the existing TypeScript `nextRegDevice` instance in
  `ZxNextWasmV2Machine`: descriptor metadata remains TypeScript-owned, while
  value reads, last-register index, last-write state, direct reads/writes,
  hard/soft reset helpers, and `isPortGroupEnabled()` observe WASM-owned state
  once the runtime is loaded.
- Added a narrow adapter `doReadPort()` override for the NextReg index/data
  ports.
- Added `test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`.
- Current artifact size after NextReg core/gating: 223,577 bytes.
- Validation:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/NextRegDevice.test.ts test/zxnext/PortEnableGating.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`

### Step 12 - ULA Port And Keyboard Matrix

Status: Partial baseline completed on 2026-08-16; parity gaps audited in Step 13A

Implement enough input and ULA port behavior to interact with the boot menu.

Implementation:

- Add keyboard row buffer exports and changed-row sync.
- Implement `0xfe` reads and writes:
  - border color;
  - keyboard rows;
  - EAR/MIC bits;
  - issue 2/3 behavior;
  - beeper latch.
- Preserve hotkey behavior in TypeScript if it remains app-owned.

Tests:

- Add `test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`.
- Migrate focused expectations from:
  - `test/zxnext/NextKeyboardDevice.test.ts`;
  - ULA keyboard portions of current machine tests.
- Test each keyboard row, unchanged-row upload count, `0xfe` border and input
  combinations, and oracle parity for port reads.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`

Definition of done:

- Keyboard state affects WASM port reads before frame execution and before
  direct `doReadPort()` calls.

Completion notes:

- Added `zxnext-keyboard.c` for pressed-bit keyboard row storage, active-low row
  reads, changed-row export updates, and row-write diagnostics.
- Added `zxnext-ula.c` for ULA `0xfe` reads/writes, including border color,
  EAR/MIC latch state, issue 2/3 bit 6 behavior, and beeper latch diagnostics.
- Updated `zxnext-ports.c` to route all low-bit-zero ports to ULA behavior
  before generic fallback reads.
- Updated `ZxNextWasmV2Machine` so public `doReadPort()` syncs only changed
  keyboard rows before WASM-owned ULA reads, while hotkey and key queue policy
  remains TypeScript-owned.
- Extended WASM loader/build exports and diagnostics with keyboard row and ULA
  state needed by tests and IDE-facing inspection.
- Added `test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`.
- Adjusted the Z80N CPU callback test to use a non-ULA odd dummy port now that
  even ports are hardware-owned.
- Current artifact size after keyboard/ULA: 224,808 bytes.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm test -- --project jsdom test/zxnext/NextRegDevice.test.ts test/zxnext/PortEnableGating.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`
  - `git diff --check`

### Step 13 - Standard ULA Screen Timing And Rendering

Status: Partial baseline completed on 2026-08-16; parity gaps audited in Step 13A

Implement the standard ULA screen path before Layer 2, sprites, or tilemap.

Implementation:

- Port 50 Hz and 60 Hz timing from `TimingConfig.ts`.
- Implement visible dimensions, frame length, interrupt pulse timing, and ULA
  pixel/attribute fetches.
- Render standard ULA into a direct pixel buffer.
- Expose `getPixelBuffer()`, `getPixelBufferBytes()`, `screenWidthInPixels`,
  `screenHeightInPixels`, and buffer start offset from WASM.
- Read screen memory from the selected screen bank.

Tests:

- Add `test/wasm/zxNext/wasm-next-screen-ula.test.ts`.
- Migrate standard ULA expectations from:
  - `test/zxnext/UlaRendering.test.ts`;
  - `test/zxnext/ula-rendering.test.ts`;
  - standard-screen portions of `test/zxnext/NextComposedScreenDevice.test.ts`.
- Compare dimensions, timing probes, border color, black/white pixel examples,
  attribute decoding, shadow screen selection, and 50/60 Hz changes.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-ula.test.ts`

Definition of done:

- A WASM frame can display the standard ULA screen through the renderer fast
  pixel path.

Completion notes:

- Added `zxnext-screen.c` as the dedicated screen slice for Step 13.
- Implemented 720x288 pixel-buffer instant rendering for the standard ULA
  layer, including default ULA palette mapping, border fill, active display
  placement, doubled horizontal pixels, pixel-byte and attribute decoding, and
  screen-bank selection.
- Added WASM-side ULA standard rendering tact tables for both 50 Hz and 60 Hz:
  per-tact HC, VC, bitmap offset, and ULA rendering flags. The instant renderer
  now iterates this table instead of using an ad hoc row loop.
- Added screen timing state and probes for the Next +3 50 Hz and 60 Hz timing
  configurations from `TimingConfig.ts`, including frame tact count and INT
  pulse start/end.
- Wired NextReg `0x05` bit 2 into WASM screen timing so public
  `nextRegDevice` writes update both TypeScript oracle state and WASM state.
- Added WASM screen-memory reads from the selected screen bank, so
  `readScreenMemory()` no longer depends on the currently mapped `0x4000`
  window.
- Updated the adapter to expose WASM-owned `screenWidthInPixels`,
  `screenHeightInPixels`, `getPixelBuffer()`, `getPixelBufferBytes()`,
  `renderInstantScreen()`, and `getBufferStartOffset()`.
- Added `test/wasm/zxNext/wasm-next-screen-ula.test.ts`.
- Scope note: Step 13 implements instant standard ULA rendering. CPU-driven
  frame execution and per-frame render scheduling remain Step 14.
- Correction note: The first Step 13 pass rendered correct basic pixels but did
  not implement the ULA standard rendering tact table. This was corrected before
  moving to Step 14, and `wasm-next-screen-ula.test.ts` now probes the table
  directly.
- Current artifact size after standard ULA screen rendering: 228,096 bytes.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-ula.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm test -- --project jsdom test/zxnext/NextComposedScreenDevice.test.ts test/zxnext/UlaRendering.test.ts test/zxnext/NextRegDevice.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`
  - `git diff --check`

### Step 13A - Audit And Fix Steps 9-13 Parity Gaps

Status: Done on 2026-08-16; Step 14 may start after the validations below stay
green

Do not continue to Step 14 until this step is complete. This step exists
because Steps 9-13 were marked too optimistically: they established useful
baselines, but did not migrate every TypeScript contract implied by their
original descriptions.

Audit method:

- For each TypeScript source listed below, create a checklist of public fields,
  public methods, port handlers, NextReg side effects, reset side effects, and
  IDE-visible adapter APIs touched by Steps 9-13.
- Mark each item as:
  - `Migrated and tested`;
  - `Implemented but missing public API parity test`;
  - `Missing and must fix in Step 13A`;
  - `Intentionally deferred`, with the owning later step.
- Add the checklist to this plan before marking Step 13A done.

Source TypeScript files to audit:

- Memory and reset:
  - `src/emu/machines/zxNext/MemoryDevice.ts`;
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/Z80NMachineBase.ts`.
- Ports and NextRegs:
  - `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
  - `src/emu/machines/zxNext/NextRegDevice.ts`;
  - all currently used port handlers under
    `src/emu/machines/zxNext/io-ports/` whose ports overlap Steps 9-13.
- ULA port and keyboard:
  - `src/emu/machines/zxNext/UlaDevice.ts`;
  - `src/emu/machines/zxNext/NextKeyboardDevice.ts`;
  - `src/emu/machines/zxSpectrum/SpectrumKeyboardDevice.ts`.
- Standard ULA screen:
  - `src/emu/machines/zxNext/screen/TimingConfig.ts`;
  - `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
  - `src/emu/machines/zxNext/screen/screen_rendering.md`;
  - `src/emu/machines/zxNext/PaletteDevice.ts` only for default standard ULA
    palette behavior; full palette mutation remains Step 21.
- Adapter/IDE surface:
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `src/renderer/abstractions/IAnyMachine.ts`;
  - `src/renderer/features/emulator/useEmulatorScreen.ts`.

Destination files for fixes:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
- `scripts/build-zxnext-wasm.cjs`;
- tests under `test/wasm/zxNext/`.

Known missing or questionable items from the first audit pass:

Current audit result: Steps 9-13 are not parity-complete. Do not treat any of
the baseline completion notes above as sufficient proof of full migration until
the items below have either been fixed and tested or explicitly deferred with an
owning later step.

- Step 9 memory/reset:
  - Missing explicit audit/test that WASM reset and hard reset match
    `MemoryDevice.reset()` and full-machine setup for every state Step 9
    claimed to own.
  - Missing explicit public-API 4 MB KS3 adapter coverage for highest valid
    page, sentinel page, `getMemoryPartition()`, and invalid partitions.
  - Missing explicit deferred list for TypeScript memory features that are not
    Step 9-owned, including DivMMC automap mapping, Multiface mapping, config
    ROM/RAM mapping, Layer 2 mapping, ROMCS replacement, and fast-path flag
    updates. These must be documented as Step 16, Step 22, or Step 30 owners
    rather than being silently omitted.
- Step 10 memory ports:
  - Need source-contract parity for all read/write side effects of
    `0x7ffd`, `0xdffd`, `0x1ffd`, and `0xeff7`, including public latch getters
    and any readable port behavior TypeScript exposes.
  - Missing `NextReg 0x69` ULA shadow-display alias behavior. TypeScript can
    set `memoryDevice.useShadowScreen` through `NextRegDevice`; WASM currently
    covers the `0x7ffd` path only.
  - Need explicit tests proving shadow-screen selection affects both
    `readScreenMemory()` and rendering through public APIs after every migrated
    path, not only direct `0x7ffd` writes.
- Step 11 NextReg core:
  - The current WASM core is a boot-relevant subset, not a full
    `NextRegDevice` migration. The plan must say this plainly and list every
    deferred register range with its owner step.
  - Missing or partial side effects for many registers in `NextRegDevice.ts`
    that Steps 9-13 already touch indirectly: `0x03`, `0x04`, `0x05`,
    `0x06`, `0x07`, `0x09`, `0x11`, `0x42`, `0x43`, `0x4a`, `0x4b`,
    `0x68`, `0x69`, and screen clip/video-line registers.
  - The adapter bridge currently calls original TypeScript methods for some
    reads before returning WASM values. Audit whether those calls mutate
    TypeScript-owned state or hide missing WASM side effects.
- Step 12 ULA port and keyboard:
  - Missing TypeScript ULA analog EAR behavior from `UlaDevice.readPort0xfe()`,
    including tact-based capacitor-style decay after bit 4 transitions.
  - Missing parity tests for ULA read behavior across tact deltas, not only
    static EAR/MIC latch values.
  - Missing WASM-owned extended keyboard NextReg values `0xB0..0xB2`, or an
    explicit statement that they stay TypeScript-owned until a later input
    step.
  - Missing public parity tests for hotkey/key-queue preservation and extended
    Next keyboard flags.
  - Beeper latch is present, but audio sample generation and timing must be
    explicitly deferred to Step 26.
- Step 13 standard ULA screen:
  - Corrected after review: ULA standard rendering tact tables now exist.
    Keep them under Step 13A verification so they cannot regress.
  - Missing exact Stage-1 standard ULA fetch/shift-register pipeline parity:
    the current renderer iterates the tact table but still reads current
    pixel/attribute bytes per visible pixel rather than reproducing the
    TypeScript prefetch/shift-register path used for floating-bus and later
    contention/debug behavior.
  - Missing scroll X/Y, ULA clip window, ULA disable output, global
    transparency/fallback handling, flash attribute timing, ULANext default
    format rendering, ULA+ rendering, Timex hi-res/hi-color, LoRes replacement,
    and palette mutation. Assign each explicitly to Step 13A, Step 21, or
    Step 22.
  - `getBufferStartOffset()` currently returns the WASM pixel-buffer pointer,
    but the renderer contract expects a pixel-buffer start index. For ZX
    Spectrum Next the TypeScript implementation returns `0`; fix this before
    Step 14.
  - Need public API tests for `getBufferStartOffset()` against the renderer
    contract, not only raw WASM pointer validation.

Implementation tasks:

- Add the audit checklist described above to this plan.
- Fix all items marked `Missing and must fix in Step 13A`.
- For every item deferred to later steps, add the later step number and the
  destination file that will own it.
- Add tests that fail on the known mistakes:
  - `getBufferStartOffset()` returns a renderer pixel index, not a pointer;
  - `NextReg 0x69` shadow-screen alias affects memory and rendering;
  - ULA analog EAR timing matches TypeScript for representative tact deltas;
  - Step 13 renderer exposes and uses the ULA standard rendering tact table;
  - public adapter APIs, not only raw exports, observe WASM-owned state.

Tests:

- Extend `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`.
- Extend `test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`.
- Extend `test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`.
- Extend `test/wasm/zxNext/wasm-next-screen-ula.test.ts`.
- Add `test/wasm/zxNext/wasm-next-steps-9-13-audit.test.ts` if the audit
  coverage does not fit cleanly into the existing files.
- Run:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts`
  - `npm test -- --project jsdom test/zxnext/MemoryDevice.test.ts test/zxnext/NextRegDevice.test.ts test/zxnext/NextComposedScreenDevice.test.ts test/zxnext/UlaRendering.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`
  - `git diff --check`

Definition of done:

- Steps 9-13 have an explicit source-contract checklist in this plan.
- Every Step 9-13 behavior is either migrated and tested through raw exports
  plus public APIs, or explicitly deferred to a later numbered step.
- No Step 9-13 status says `Done` without a complete checklist and deferred
  list.
- Step 14 remains blocked until this step is done.

Guardrail:

- Do not implement Step 14 while any Step 13A audit item remains undecided.
- Do not mark Step 13A done if the only proof is raw WASM exports; each fix must
  have at least one public `ZxNextWasmV2Machine` API assertion.

#### Step 13A Source-Contract Checklist

Audited source TypeScript files:

- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/Z80NMachineBase.ts`;
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`;
- `src/emu/machines/zxNext/UlaDevice.ts`;
- `src/emu/machines/zxNext/NextKeyboardDevice.ts`;
- `src/emu/machines/zxSpectrum/SpectrumKeyboardDevice.ts`;
- `src/emu/machines/zxNext/screen/TimingConfig.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/screen/screen_rendering.md`;
- `src/emu/machines/zxNext/PaletteDevice.ts` for default standard ULA palette
  behavior only;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
- `src/renderer/abstractions/IAnyMachine.ts`;
- `src/renderer/features/emulator/useEmulatorScreen.ts`.

Destination files changed in Step 13A:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`;
- `scripts/build-zxnext-wasm.cjs`;
- `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`;
- `test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`;
- `test/wasm/zxNext/wasm-next-screen-ula.test.ts`.

Migrated and tested in Step 13A:

- Step 9: 4 MB KS3 public adapter coverage now includes highest valid page,
  sentinel-backed invalid partition, `getMemoryPartition()`, diagnostics, and
  current partition assertions in `wasm-next-memory-mmu.test.ts`.
- Step 10/13: `NextReg 0x69` bit 6 now aliases ULA shadow display selection in
  WASM and affects `readScreenMemory()` plus public `renderInstantScreen()`.
- Step 11/12: extended keyboard read-only NextRegs `0xB0..0xB2` now sync from
  `NextKeyboardDevice` into WASM before public NextReg reads and index/data
  port reads.
- Step 12: ULA analog EAR timing now follows `UlaDevice.readPort0xfe()` using
  bit-4 rise/fall tacts and capacitor-style decay.
- Step 13: `ZxNextWasmV2Machine.getBufferStartOffset()` now returns the
  renderer pixel-buffer start index `0`, while the raw WASM pointer remains a
  loader/view detail.
- Step 13: ULA standard rendering tact-table probes remain covered so future
  frame work cannot silently replace the table with a row-loop shortcut.

Explicitly deferred after audit:

- DivMMC automap, MAPRAM, CONMEM, DivMMC RAM/ROM overlays, and DivMMC NMI
  mapping are Step 16, owned by `zxnext-divmmc.c`,
  `zxnext-memory.c`, `zxnext-nextreg.c`, and `zxnext-ports.c`.
- SD-card SPI protocol and sector frame-command bridging are Step 17, owned by
  `zxnext-sdcard.c`, `zxnext-ports.c`, and `ZxNextWasmV2Machine.ts`.
- Multiface, expansion-bus ROMCS replacement, expansion NMI, and related memory
  overlays are Step 30, owned by `zxnext-multiface.c`,
  `zxnext-expansion.c`, `zxnext-memory.c`, `zxnext-interrupt.c`, and
  `zxnext-ports.c`.
- Layer 2 memory windows, LoRes, ULA scroll X/Y, ULA clip windows, ULA disable
  output, global transparency/fallback, ULANext default format rendering,
  Timex hi-res/hi-color, ULA+, and palette mutation are Steps 21 and 22, owned
  by `zxnext-palette.c`, `zxnext-screen.c`, `zxnext-layer2.c`, and
  `zxnext-lores.c`.
- Exact Stage-1 standard ULA prefetch/shift-register and floating-bus parity is
  deferred to Step 14/19 where CPU-driven frame timing, contention, and bus
  diagnostics are introduced. The existing Step 13 table remains the required
  foundation.
- Beeper/audio sample generation, audio timing, PSG, DAC, and mixer behavior
  are Step 26, owned by `zxnext-audio.c`, `zxnext-psg.c`, and `zxnext-dac.c`.
- Remaining full `NextRegDevice` side-effect ranges outside Steps 9-13 stay
  with their owning device steps: speed/contention in Step 19, interrupts/NMI in
  Step 20, palette/video in Steps 21-25, audio in Step 26, DMA/Copper/CTC in
  Steps 27-29, peripherals in Steps 31-33, and complete IDE diagnostics in Step
  34.

Completion validation:

- `npm run build:zxnext-wasm`
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts`
- `npm test -- --project jsdom test/zxnext/MemoryDevice.test.ts test/zxnext/NextRegDevice.test.ts test/zxnext/PortEnableGating.test.ts test/zxnext/NextComposedScreenDevice.test.ts test/zxnext/UlaRendering.test.ts`
- `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts`
- `npm run build:check`
- `npm run check:zxnext-wasm-size`
- `git diff --check`

### Step 14 - Minimal Frame Execution

Status: Done on 2026-08-16

Execute normal frames fully inside WASM for CPU, memory, ports, keyboard, and
standard ULA screen.

Implementation:

- Implement `zxnextExecuteFrame()`.
- Preserve instruction overshoot across frame boundaries.
- Sync only frame counters after a normal frame.
- Avoid full register sync in normal running.
- Keep TypeScript debug policy but use C-owned single-instruction stepping when
  debug mode requests it.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/Z80NMachineBase.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/InterruptDevice.ts` for the early ULA interrupt
  surface only.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c` if interrupt pulse
  state needs a slice before Step 20;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.

Guardrail:

- Do not call TypeScript `executeMachineFrame()` or per-tact TypeScript
  rendering from the WASM normal frame path.
- Do not mark done until diagnostics prove one frame call crosses JS/WASM once
  plus bounded changed-input sync.

Tests:

- Extend `ZxNextWasmV2Machine.test.ts`.
- Add `test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`.
- Cover setup, reset, one frame, consecutive frames, frame counters, current
  frame tact, debug step-into, and no per-frame full-register sync.
- Run:
  - `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`

Definition of done:

- The normal frame path no longer uses TypeScript CPU/memory/port/rendering for
  this early subset.

Completion notes:

- Added `zxnextExecuteFrame()` to the C backend.
- Added WASM-owned frame state:
  - total completed frames;
  - current frame residual in 28 MHz ticks;
  - current frame tact in the screen timing domain;
  - CPU tacts per frame derived from the active 50/60 Hz standard ULA timing;
  - frame-call count;
  - instructions executed in the last frame.
- The normal frame path now:
  - syncs changed keyboard rows and extended keyboard NextRegs before the frame;
  - crosses JS/WASM once through `zxnextExecuteFrame()`;
  - executes CPU instructions inside WASM until the frame completes;
  - preserves instruction overshoot into the next frame;
  - renders the standard ULA screen in WASM at frame end;
  - syncs only frame counters and bus diagnostics back to the adapter.
- `ZxNextWasmV2Machine.executeMachineFrame()` now bypasses the TypeScript
  `MachineFrameRunner` for the WASM backend.
- Debug StepInto uses C-owned `zxnextExecuteInstruction()` and then imports CPU
  registers for public debugger state.
- Normal running deliberately does not sync the full CPU register set; explicit
  `getCpuState()` still pulls registers from WASM for IDE inspection.
- Timing scope note: Step 14 uses the 3.5 MHz CPU-tact baseline derived from
  the standard ULA rendering table. CPU speed, contention, and exact
  multi-speed timing remain Step 19.
- Deferred: full interrupt/NMI timing remains Step 20; per-tact Stage-1 ULA
  prefetch/floating-bus behavior remains Step 14/19 follow-up work as recorded
  in Step 13A; storage boot remains Steps 15-18.
- Added `test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size`
  - `git diff --check`

### Step 15 - Early Boot Smoke Without Storage

Status: Done on 2026-08-16

Boot far enough to prove ROM execution and ULA rendering are alive, even if
storage still returns inert values.

Implementation:

- Use fixed ROM fixtures or real resource ROMs through `setup()`.
- Stub unsupported ports to TypeScript-equivalent `0xff` or documented open bus
  values.
- Add diagnostics for first unimplemented port/device hit to guide next steps.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
- `src/emu/machines/zxNext/bootsequence.txt`;
- `src/emu/machines/zxNext/debug.txt`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`.

Guardrail:

- Every unsupported boot-time port must be logged with a source owner and later
  migration step. Do not silently return `0xff` without a diagnostic counter.

Tests:

- Add a boot smoke in `wasm-next-boot-storage-ula.test.ts`.
- Execute enough frames to leave PC at a non-reset value and produce non-blank
  pixels.
- Compare a TypeScript oracle smoke for the same ROM/setup when deterministic.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`

Definition of done:

- The WASM machine can execute ROM frames and produce a visible standard ULA
  pixel buffer without crashing on missing devices.

Completion checklist:

- Audited TypeScript source files:
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
  - `src/emu/machines/zxNext/bootsequence.txt`;
  - `src/emu/machines/zxNext/debug.txt`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`.
- Migrated and tested behavior:
  - unsupported WASM port reads/writes are counted during normal frame
    execution, including first unsupported address, value, read/write flag, and
    owning later step;
  - unsupported port diagnostics are exposed through raw WASM exports, the
    diagnostic buffer, and `ZxNextWasmV2Machine.getWasmV2Diagnostics()`;
  - port `0x123b` returns the same inert read value as the TypeScript oracle
    while being recorded as Layer 2 Step 22 work;
  - a deterministic ROM fixture can execute a WASM frame, write standard ULA
    screen bytes, render visible pixels, and record unsupported boot-time port
    reads/writes without TypeScript frame execution.
- Intentionally deferred behavior:
  - DivMMC automap and memory overlays remain Step 16, owned by
    `zxnext-divmmc.c`, `zxnext-memory.c`, `zxnext-nextreg.c`, and
    `zxnext-ports.c`;
  - SD-card SPI protocol and sector frame-command bridging remain Step 17,
    owned by `zxnext-sdcard.c`, `zxnext-ports.c`, and
    `ZxNextWasmV2Machine.ts`;
  - the real storage boot milestone remains Step 18;
  - Layer 2 port behavior behind `0x123b` remains Step 22, owned by
    `zxnext-layer2.c`, `zxnext-screen.c`, `zxnext-memory.c`, and
    `zxnext-ports.c`;
  - unclassified port-manager diagnostics are retained for Step 34 IDE/debug
    inspection.

Completion notes:

- Added unsupported-port diagnostics to the WASM port slice instead of silently
  falling back to `0xff`.
- Used owner-step classification so early boot smoke failures identify the
  later migration slice that must own the missing device behavior.
- Added `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (228,082 bytes against 360,000)
  - `git diff --check`

### Step 16 - DivMMC Automap And Memory Side Effects

Status: Done on 2026-08-16

Implement the DivMMC behavior required by NextZXOS boot and storage access.

Implementation:

- Port DivMMC enable, `0xe3`, CONMEM, MAPRAM, bank selection, and automap
  entry/exit points.
- Implement RST trap fields and NextReg `0x83`, `0xB8..0xBB` effects.
- Implement DivMMC NMI hold pieces that affect memory mapping.
- Keep app-level NMI button policy in TypeScript if needed, but C must own hot
  memory-map effects.

Source TypeScript:

- `src/emu/machines/zxNext/storage/DivMmcDevice.ts`;
- `src/emu/machines/zxNext/storage/IDivMmcDevice.ts`;
- `src/emu/machines/zxNext/DivMmcDevice.ts` if still referenced by legacy
  code paths;
- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`;
- `src/emu/machines/zxNext/ZxNextMachine.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.

Guardrail:

- Do not implement DivMMC as a TypeScript callback on every memory access. The
  active memory-map decision must be C-owned and covered by public memory API
  tests.

Tests:

- Add `test/wasm/zxNext/wasm-next-divmmc.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/DivMmcDevice-fpga.test.ts`;
  - `test/zxnext/DivMmcDevice-regression.test.ts`;
  - `test/zxnext/DivMmmc.test.ts`.
- Compare automap activation/deactivation, `0xe3` reads/writes, MAPRAM reset,
  memory page changes, and NMI hold flags against TypeScript.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-divmmc.test.ts`

Definition of done:

- DivMMC ROM/RAM mapping during boot is WASM-owned and public memory APIs remain
  coherent.

Completion checklist:

- Audited TypeScript source files:
  - `src/emu/machines/zxNext/DivMmcDevice.ts`;
  - `src/emu/machines/zxNext/storage/DivMmcDevice.ts`;
  - `src/emu/machines/zxNext/storage/IDivMmcDevice.ts`;
  - `src/emu/machines/zxNext/MemoryDevice.ts`;
  - `src/emu/machines/zxNext/NextRegDevice.ts`;
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
  - `test/zxnext/DivMmcDevice-fpga.test.ts`;
  - `test/zxnext/DivMmcDevice-regression.test.ts`;
  - `test/zxnext/DivMmmc.test.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-divmmc.test.ts`.
- Migrated and tested behavior:
  - C-owned DivMMC enable state, `0xe3` CONMEM/MAPRAM/bank state, sticky
    MAPRAM behavior, and port-enable gating;
  - lower-16K DivMMC ROM/RAM read overlays and DivMMC RAM write/protection
    behavior for CONMEM and automap-active states;
  - NextReg `0x09`, `0x0a`, `0x83`, and `0xb8..0xbb` DivMMC side effects;
  - delayed RST automap activation and RETN automap clearing during C-owned
    instruction execution;
  - public `doReadPort`, `doWritePort`, `doReadMemory`, `doWriteMemory`,
    `get64KFlatMemory`, and `getWasmV2Diagnostics()` assertions, plus raw WASM
    physical-memory checks.
- Intentionally deferred behavior:
  - SD-card SPI byte protocol and sector frame-command bridging remain Step
    17, owned by `zxnext-sdcard.c`, `zxnext-ports.c`, and
    `ZxNextWasmV2Machine.ts`;
  - the real storage-backed boot milestone remains Step 18;
  - DivMMC NMI button acceptance, stackless NMI integration, Multiface
    suppression of DivMMC RETN, and expansion-bus NMI interactions remain Step
    20 and Step 30, owned by `zxnext-interrupt.c`, `zxnext-divmmc.c`,
    `zxnext-multiface.c`, and `zxnext-expansion.c`;
  - ROMCS replacement from DivMMC banks 14/15 remains Step 30 with expansion bus
    ROMCS ownership;
  - full IDE/debug diagnostic panels for DivMMC state remain Step 34 after the
    storage path is complete.

Completion notes:

- Added `zxnext-divmmc.c` as the owning C slice for DivMMC control state and
  automap state.
- Updated the normal C instruction wrapper to call DivMMC before/after
  opcode-fetch hooks once per whole instruction, keeping normal frames inside
  WASM.
- Updated `zxnext-memory.c` so DivMMC overlays are consumed by the C-owned
  mapped read/write path and reflected in the 64K flat typed view.
- Updated `zxnext-ports.c` so port `0xe3` is handled rather than counted as an
  unsupported boot-time port.
- Updated the loader, build exports, and adapter diagnostics with DivMMC state.
- Added `test/wasm/zxNext/wasm-next-divmmc.test.ts`.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-divmmc.test.ts`
  - `npm test -- --project jsdom test/zxnext/DivMmmc.test.ts test/zxnext/DivMmcDevice-fpga.test.ts test/zxnext/DivMmcDevice-regression.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (169,407 bytes against 360,000)
  - `git diff --check`

### Step 17 - SD Card SPI State Machine

Status: Done on 2026-08-16

Implement SD-card command state inside WASM while keeping sector persistence in
TypeScript/main process.

Implementation:

- Port SPI chip-select behavior for card 0 and card 1.
- Port SD command parsing, idle/ready/tran/data states, response readiness, CSD,
  CID, OCR, single/multi-block read/write, and CRC behavior.
- Expose frame-command journals for sector reads and writes.
- Adapter converts WASM journals to current `readSdCardSector`,
  `writeSdCardSector`, and `getSdCardInfo` frame-command flows.
- Adapter feeds read/write responses back into WASM.
- Preserve response timing race protections.

Source TypeScript:

- `src/emu/machines/zxNext/SdCardDevice.ts`;
- `src/emu/machines/zxNext/ZxNextMachine.ts` frame-command handling;
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
- `src/emu/machines/zxNext/mmc.txt`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sdcard.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`.

Guardrail:

- Keep sector persistence and project/file-provider policy in TypeScript, but
  keep command parsing, response state, and SPI byte behavior in WASM. Do not
  cross JS/WASM for every SPI bit/byte during normal frame execution.

Tests:

- Add `test/wasm/zxNext/wasm-next-storage.test.ts`.
- Migrate focused groups from `test/zxnext/SdCardDevice.test.ts`.
- Cover CMD0, ACMD41, CMD9/CSD, CMD10/CID, CMD17 read, CMD24 write, response
  readiness, failed write response, card 1 selection, and reset retention.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-storage.test.ts`

Definition of done:

- The WASM machine can request sector reads/writes through the same TypeScript
  frame-command contract as the current machine.

Completion checklist:

- Audited TypeScript sources:
  - `src/emu/machines/zxNext/SdCardDevice.ts`;
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
  - `src/emu/machines/zxNext/mmc.txt`;
  - `test/zxnext/SdCardDevice.test.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-sdcard.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-storage.test.ts`.
- Migrated and tested:
  - SPI chip-select decoding for card 0, card 1, and deselect paths;
  - SPI data-port routing through WASM-owned public ports;
  - SD command byte parsing and idle/ready/tran/data/write-wait states;
  - CMD0, CMD8, CMD55, ACMD41, CMD58, CMD9/CSD, CMD10/CID, CMD13, CMD16,
    CMD17, CMD24, and CMD59 responses needed by current boot/storage flows;
  - CSD/CID/OCR payload construction and CRC16 for CID/read payloads;
  - lazy adapter `getSdCardInfo` upload before SD frame-command processing;
  - CMD17 read journals converted to `sd-read`/`sd-read-card1` frame commands;
  - CMD24 write journals converted to `sd-write`/`sd-write-card1` frame
    commands with 512-byte payloads;
  - successful read responses, successful write responses, and failed write
    responses fed back into WASM;
  - mounted-card reset retention.
- Raw WASM/public adapter coverage:
  - `test/wasm/zxNext/wasm-next-storage.test.ts` exercises raw exports for card
    info and diagnostics, and public `ZxNextWasmV2Machine` port/frame-command
    APIs for SPI, read, write, failed write, lazy card-info, and reset
    retention.
  - `test/zxnext/SdCardDevice.test.ts` remains the TypeScript oracle suite.
- Deferred behaviors:
  - exact `READ_DELAY` tact timing and response race timing beyond frame-command
    timeout protection stay with Step 18/Step 19 timing work;
  - multi-block streaming commands beyond the single-block read/write boot path
    stay with Step 34 storage robustness unless Step 18 proves they are needed
    for the start-menu milestone;
  - full card-1 media-mount policy and UI surfacing stay TypeScript-owned until
    the later IDE/media integration steps;
  - storage-backed boot success, sector contents from a real image, and
    non-blank start-menu proof stay with Step 18.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-storage.test.ts`
  - `npm test -- --project jsdom test/zxnext/SdCardDevice.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-storage.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (175,276 bytes against 360,000)
  - `git diff --check`

### Step 18 - Early Storage Boot Milestone

Status: Done on 2026-08-16 for the deterministic storage-backed boot fixture

Reach the first user-visible milestone: start menu, storage reads, standard ULA
screen.

Implementation:

- Combine Steps 9 through 17 in the adapter.
- Add boot diagnostics that report:
  - frames executed;
  - SD commands issued;
  - sectors read;
  - unimplemented port hits;
  - non-blank pixel count.
- Keep unimplemented devices inert but parity-compatible.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/storage/DivMmcDevice.ts`;
- `src/emu/machines/zxNext/SdCardDevice.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`.

Destination files:

- integration of existing WASM slices from Steps 9-17;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`.

Guardrail:

- This is a milestone test, not a place to add large new device logic. If boot
  requires new behavior, add it to the owning device step or Step 13A first.

Tests:

- Extend `wasm-next-boot-storage-ula.test.ts`.
- Use a deterministic test file provider or SD-card fixture.
- Assert:
  - ROM boot executes beyond the initial reset loop;
  - at least one SD sector read command is issued and completed;
  - standard ULA pixel buffer is non-blank;
  - keyboard input can move/select in the boot/start menu where deterministic.
- Manual smoke:
  - `npm run dev`
  - select ZX Spectrum Next with explicit WASM config;
  - verify the start menu/boot screen, storage file listing, and ULA screen.

Definition of done:

- This is the first acceptable early-start milestone even though Layer 2,
  sprites, tilemap, DMA, Copper, CTC, and full audio may still be incomplete.

Completion checklist:

- Audited TypeScript sources:
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/MemoryDevice.ts`;
  - `src/emu/machines/zxNext/storage/DivMmcDevice.ts`;
  - `src/emu/machines/zxNext/SdCardDevice.ts`;
  - `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
  - `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`.
- Migrated/tested milestone behavior:
  - a CPU-driven ROM fixture draws standard ULA pixels through WASM memory;
  - the same ROM selects SD card 0 and issues CMD17 through real SPI ports;
  - WASM publishes an `sd-read` frame command for sector 2;
  - the adapter lazily loads card info, services the read through the
    TypeScript/main-process frame-command API, clears the frame command, and
    feeds the sector response back into WASM;
  - the CPU consumes the returned SD response and writes the first sector byte
    into ULA screen memory;
  - the next rendered frame proves storage-backed pixels and reports frames,
    SD command/read counts, unsupported-port counts, and non-blank rendered
    pixel count through public diagnostics.
- Raw WASM/public adapter coverage:
  - `test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts` now covers
    unsupported boot-time diagnostics, deterministic ROM frame rendering, and
    CPU-driven storage-backed boot flow through public `executeMachineFrame`,
    `getFrameCommand`, `processFrameCommand`, `getWasmV2Diagnostics`, and
    `getPixelBuffer` APIs.
- Deferred behaviors:
  - real NextZXOS start-menu/file-listing smoke is deferred until a checked-in
    SD-card image fixture or equivalent deterministic file-provider fixture is
    available;
  - keyboard navigation in the real boot/start menu remains deferred with the
    real start-menu smoke;
  - any missing hardware behavior discovered by real ROM boot should be added
    to the owning later device step rather than hidden in Step 18.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-storage.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (175,368 bytes against 360,000)
  - `git diff --check`

### Step 18A - Early IDE Inspection Baseline

Status: Done on 2026-08-16

Before migrating the heavier Next devices, prove that the WASM machine supports
the IDE's core internal-inspection features through the same public machine APIs
as the TypeScript implementation.

Implementation:

- Audit the public calls used by the emulator shell and IDE panels for:
  - CPU register display;
  - disassembly reads;
  - memory contents and memory mapping;
  - NextReg values;
  - ULA/screen information;
  - last memory and I/O bus events;
  - code injection and execution point state.
- Override inherited adapter methods that would otherwise read TypeScript-owned
  device state after the WASM backend owns CPU, memory, ports, and ULA state.
- Add typed snapshot exports if public APIs need structured state that is too
  expensive to reconstruct through many tiny calls.
- Keep high-level debugger policy in TypeScript, but ensure every displayed
  value comes from WASM-owned state while the WASM backend is selected.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/Z80NMachineBase.ts`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/renderer/abstractions/IAnyMachine.ts`;
- `src/renderer/features/emulator/useEmulatorScreen.ts`;
- IDE panels or services that read machine internals, discovered with `rg`
  before implementation.

Destination files:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
- relevant C slices for structured diagnostic snapshots;
- `test/wasm/zxNext/wasm-next-ide-inspection.test.ts`.

Guardrail:

- Every IDE-visible value must have a public API parity assertion. Do not rely
  on raw exports as proof that the renderer/debugger panels see the right data.

Tests:

- Add `test/wasm/zxNext/wasm-next-ide-inspection.test.ts`.
- Use both a TypeScript oracle and a WASM machine with deterministic ROM/RAM.
- Assert parity through public APIs for:
  - `getCpuState()` before and after one instruction;
  - `doReadMemory`, `doWriteMemory`, `get64KFlatMemory`, and partition helpers;
  - disassembly-style reads from currently mapped ROM/RAM banks;
  - `doReadPort` and `doWritePort` plus last I/O diagnostics;
  - NextReg index/data reads and live values;
  - screen dimensions, `readScreenMemory`, pixel buffer, and ULA/border state;
  - code injection into normal and banked memory.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-inspection.test.ts`
  - `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts`

Definition of done:

- The IDE can inspect registers, memory, disassembly bytes, NextRegs, and ULA
  screen state from the WASM backend without reading stale TypeScript internals.
- Any intentionally TypeScript-owned inspection surface is documented with a
  parity test that proves the mixed ownership is coherent.

Completion checklist:

- Audited TypeScript/renderer sources:
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/Z80NMachineBase.ts`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `src/renderer/abstractions/IAnyMachine.ts`;
  - `src/renderer/features/emulator/useEmulatorScreen.ts`;
  - `src/emu/machines/MachineFrameRunner.ts`;
  - `src/emu/z80/Z80Cpu.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `test/wasm/zxNext/wasm-next-ide-inspection.test.ts`.
- Migrated/tested:
  - public `getCpuState()` before and after instruction execution;
  - public memory reads/writes, flat 64K view, mapped page slices, partition
    lookup, partition parsing, and partition labels;
  - disassembly-style byte reads from mapped RAM;
  - public port read/write state, including last I/O diagnostics;
  - public NextReg index/data port access and live `nextRegDevice` reads;
  - screen dimensions, screen memory reads, pixel buffer, and non-blank
    rendering diagnostics;
  - normal mapped-memory `injectCodeToRun`.
- Raw WASM/public adapter coverage:
  - `test/wasm/zxNext/wasm-next-ide-inspection.test.ts` uses public
    `ZxNextWasmV2Machine` APIs and a TypeScript oracle for parity where the
    TypeScript public surface already exposes the value.
- Deferred behaviors:
  - banked `injectCodeToRun` remains deferred because the inherited
    `ZxNextMachine.injectCodeToRun` implementation still has a `TODO` for
    banked segments;
  - richer IDE panels for later devices remain with the owning device steps.
- Adapter correction:
  - known WASM diagnostic fallback reads, currently Layer 2 port `0x123b`, now
    route through WASM so public last-I/O state and unsupported-port
    diagnostics do not stay stale.
- Validation:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-inspection.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - broader Next WASM suite listed under Step 19 validation
  - `npm run build:check`
  - `git diff --check`

### Step 19 - Contention And CPU Speed Parity

Status: Done on 2026-08-16 for CPU speed NR `$07` and the current 28 MHz memory-read wait-state rule

Implement Next contention and speed behavior.

Implementation:

- Port CPU speed effective/programmed speed.
- Implement 3.5/7/14/28 MHz tact scaling.
- Implement RAM/port contention disable flags and 128K-style contended ranges.
- Preserve write-delay behavior currently modeled by TypeScript.

Source TypeScript:

- `src/emu/machines/zxNext/CpuSpeedDevice.ts`;
- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`;
- `src/emu/machines/zxNext/Z80NMachineBase.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
- add `src/emu/machines/zxNext/wasm/zxnext/zxnext-speed.c` if speed logic
  grows beyond tiny shared helpers.

Guardrail:

- Do not hide speed/contended timing behind arbitrary tact constants. Every
  timing constant must point back to a TypeScript source or documented hardware
  timing note, and tacts must be compared through public CPU/frame APIs.

Tests:

- Add `test/wasm/zxNext/wasm-next-contention-speed.test.ts`.
- Migrate focused expectations from CPU speed and contention sections of
  `test/zxnext/MemoryDevice.test.ts`, `test/zxnext/NextRegDevice.test.ts`, and
  any current contention tests.
- Compare tacts, total contention delays, and speed NextReg side effects.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-contention-speed.test.ts`

Definition of done:

- CPU speed changes and contention gates match TypeScript under public port and
  NextReg operations.

Completion checklist:

- Audited TypeScript sources:
  - `src/emu/machines/zxNext/CpuSpeedDevice.ts`;
  - `src/emu/machines/zxNext/MemoryDevice.ts`;
  - `src/emu/machines/zxNext/NextRegDevice.ts`;
  - `src/emu/machines/zxNext/Z80NMachineBase.ts`;
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `test/zxnext/MemoryDevice.test.ts`;
  - `test/zxnext/NextRegDevice.test.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-contention-speed.test.ts`.
- Migrated/tested:
  - CPU speed programmed/effective values through NR `$07`;
  - effective clock multiplier and CPU tact scale diagnostics;
  - hard reset clears speed to 3.5 MHz and soft reset preserves speed;
  - CPU-read 28 MHz extra wait state for non-bank-7 reads;
  - bank-7 page `0x0e` exception at 28 MHz;
  - public CPU tacts compared against the TypeScript oracle for speed
    `0..3`.
- Raw WASM/public adapter coverage:
  - `test/wasm/zxNext/wasm-next-contention-speed.test.ts` uses public
    NextReg/device APIs, public `getCpuState()` tacts, and public diagnostics.
- Deferred behaviors:
  - expansion-bus forced 3.5 MHz effective speed remains with the expansion-bus
    migration step because the expansion bus is not WASM-owned yet;
  - full 128K-style port-contention timing and NR `$08` contention-disable
    gates remain deferred until the port/contention implementation is extended
    beyond the current tested memory-read wait-state rule;
  - write-delay accounting remains TypeScript-only until a migrated test
    requires a WASM diagnostic equivalent.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-contention-speed.test.ts`
  - `npm test -- --project jsdom test/zxnext/MemoryDevice.test.ts test/zxnext/NextRegDevice.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-storage.test.ts test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/wasm/zxNext/wasm-next-contention-speed.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (208,562 bytes against 360,000)
  - `git diff --check`

### Step 20 - Interrupts And NMI State Machine

Status: Done on 2026-08-16 for NextReg-backed interrupt state, pulse capture,
DMA/status masks, and HW IM2 daisy-chain behavior

Move interrupt/NMI hot state into WASM.

Implementation:

- Port ULA interrupt pulse capture.
- Port line interrupt capture.
- Port IM2 daisy chain state used by Next.
- Port DMA/CTC interrupt inputs as those devices come online.
- Port stackless NMI, Multiface NMI, DivMMC NMI, expansion-bus NMI, hold/end
  states, and RETN side effects.

Source TypeScript:

- `src/emu/machines/zxNext/InterruptDevice.ts`;
- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/MultifaceDevice.ts`;
- `src/emu/machines/zxNext/ExpansionBusDevice.ts`;
- `src/emu/machines/zxNext/storage/DivMmcDevice.ts`;
- `src/emu/machines/zxNext/DmaDevice.ts`;
- `src/emu/machines/zxNext/CtcDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-multiface.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-expansion.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ctc.c`.

Guardrail:

- Interrupt/NMI causes must be represented as structured WASM state, not as
  scattered booleans in unrelated slices. Public RETN/NMI/debug-step tests must
  prove the adapter imports the WASM state.

Tests:

- Add `test/wasm/zxNext/wasm-next-interrupts.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/InterruptDevice.test.ts`;
  - `test/zxnext/NextInterrupts.test.ts`;
  - `test/zxnext/DaisyChain.test.ts`;
  - `test/zxnext/NmiSoftware.test.ts`;
  - `test/zxnext/NmiStateMachine.test.ts`;
  - `test/zxnext/StacklessNmi.test.ts`;
  - `test/zxnext/ExpansionBusNmi.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-interrupts.test.ts`

Definition of done:

- Public `shouldRaiseInterrupt`, NMI entry, interrupt vector, acknowledgement,
  and RETN behavior match TypeScript for migrated cases.

Completion checklist:

- Audited TypeScript sources:
  - `src/emu/machines/zxNext/InterruptDevice.ts`;
  - `src/emu/machines/zxNext/ZxNextMachine.ts`;
  - `src/emu/machines/zxNext/NextRegDevice.ts`;
  - `test/zxnext/InterruptDevice.test.ts`;
  - `test/zxnext/DaisyChain.test.ts`;
  - `test/zxnext/NextInterrupts.test.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-interrupts.test.ts`.
- Migrated/tested:
  - NR `$02`, `$20`, `$22`, `$23`, `$c0`, `$c2`, `$c3`, `$c4`, `$c5`, `$c6`,
    `$c8`, `$c9`, `$ca`, `$cc`, `$cd`, and `$ce` interrupt state;
  - ULA and line interrupt pulse capture;
  - CTC and UART interrupt status masks used by status/DMA registers;
  - HW IM2 daisy `Requesting`/`InService` walk, peek vector, acknowledge, and
    RETI-style service clear;
  - public `shouldRaiseInterrupt()` routed to WASM daisy state in HW IM2 mode;
  - diagnostics for line value, IM2 flags, CTC masks, daisy mask, and DMA
    request state.
- Deferred behaviors:
  - full CPU NMI entry/hold/end, stackless NMI RETN fixups, Multiface NMI,
    DivMMC NMI, and expansion-bus NMI remain deferred until those device
    ownership slices migrate;
  - DMA/CTC live device interrupt generation remains deferred beyond the
    migrated status-mask inputs.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-interrupts.test.ts`
  - broader validation listed under Step 21 validation

### Step 21 - Palette And ULA+/Timex Modes

Status: Done on 2026-08-16 for Next palette registers, standard ULA palette
rendering, Timex port state, and ULA+ port state

Implement the palette and classic enhanced video pieces before Next layers.

Implementation:

- Port `PaletteDevice` state and NextReg side effects.
- Port Timex port `0xff`.
- Port ULA+ register/data ports.
- Apply palette changes in the ULA renderer.

Source TypeScript:

- `src/emu/machines/zxNext/PaletteDevice.ts`;
- `src/emu/machines/zxNext/palette.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/io-ports/UlaPlusDataPortHandler.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`.

Guardrail:

- Do not keep using the hard-coded default ULA palette after this step. Palette
  reads/writes must affect rendering through WASM-owned palette arrays and
  public pixel-buffer tests.

Tests:

- Add `test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/PaletteDevice.test.ts`;
  - `test/zxnext/PaletteDeviceFpgaFixes.test.ts`;
  - Timex/ULA+ portions of `NextComposedScreenDevice.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`

Definition of done:

- Palette reads/writes and ULA+/Timex rendering agree with TypeScript for
  migrated fixtures.

Completion checklist:

- Audited TypeScript sources:
  - `src/emu/machines/zxNext/PaletteDevice.ts`;
  - `src/emu/machines/zxNext/palette.ts`;
  - `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
  - `src/emu/machines/zxNext/io-ports/UlaPlusDataPortHandler.ts`;
  - `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`;
  - `src/emu/machines/zxNext/NextRegDevice.ts`;
  - `test/zxnext/PaletteDevice.test.ts`;
  - `test/zxnext/PaletteDeviceFpgaFixes.test.ts`;
  - `test/zxnext/NextComposedScreenDevice.test.ts`.
- Changed destination files:
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
  - `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
  - `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
  - `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
  - `scripts/build-zxnext-wasm.cjs`;
  - `test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`.
- Migrated/tested:
  - palette arrays for ULA, Layer 2, sprite, and tilemap first/second palettes;
  - NR `$28`, `$40`, `$41`, `$43`, and `$44` read/write behavior;
  - 8-bit and 9-bit palette writes, auto-increment, second-write latch, and
    priority-bit storage;
  - standard ULA rendering through WASM palette arrays instead of the former
    hard-coded default palette;
  - Timex port `$00ff` value/bits and ULA interrupt-disable side effect;
  - ULA+ mode/index port `$bf3b` and data/control port `$ff3b` with the current
    port-enable gate.
- Deferred behaviors:
  - full Timex Hi-Res/Hi-Color pixel rendering remains with the later composed
    video slices;
  - full ULA+ pixel-selection composition is deferred beyond this port/palette
    state slice.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-ide-inspection.test.ts`
  - `npm test -- --project jsdom test/zxnext/InterruptDevice.test.ts test/zxnext/DaisyChain.test.ts test/zxnext/PaletteDevice.test.ts test/zxnext/PaletteDeviceFpgaFixes.test.ts test/zxnext/NextComposedScreenDevice.test.ts`
  - `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-storage.test.ts test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/wasm/zxNext/wasm-next-contention-speed.test.ts test/wasm/zxNext/wasm-next-interrupts.test.ts test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (218,684 bytes against 360,000)

### Step 22 - Layer 2 And LoRes Rendering

Status: Completed on 2026-08-16

Implement Layer 2 and LoRes rendering after standard ULA is stable.

Implementation:

- Port Layer 2 memory mapping and port `0x123b`.
- Port Layer 2 registers and scroll/clip controls.
- Port LoRes behavior used by current tests.
- Compose Layer 2 with ULA according to current priority rules.

Source TypeScript:

- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/PaletteDevice.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`;
- `src/emu/machines/zxNext/screen/screen_rendering.md`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- add `src/emu/machines/zxNext/wasm/zxnext/zxnext-layer2.c` if Layer 2 state
  would make `zxnext-screen.c` too large;
- add `src/emu/machines/zxNext/wasm/zxnext/zxnext-lores.c` if LoRes state
  would make `zxnext-screen.c` too large;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`.

Guardrail:

- Split Layer 2/LoRes state out of `zxnext-screen.c` if the file stops being a
  composition/timing owner. Every mapped-memory mode must have public memory
  and pixel tests.

Tests:

- Add `test/wasm/zxNext/wasm-next-layer2-lores.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/Layer2Fixes.test.ts`;
  - `test/zxnext/LoResFixes.test.ts`;
  - Layer 2 portions of `NextComposedScreenDevice.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-layer2-lores.test.ts`

Definition of done:

- Layer 2/LoRes pixels match TypeScript oracle for fixed fixtures.

Completed notes:

- Added `zxnext-layer2.c` for Layer 2/LoRes state, NextRegs `$12`, `$13`,
  `$14`, `$15`, `$16`, `$17`, `$18`, `$1c`, `$32`, `$33`, `$69`, `$6a`,
  `$70`, and `$71`, plus owned port `0x123b`.
- Threaded Layer 2 CPU read/write windows into `zxnext-memory.c` after DivMMC
  precedence and before normal MMU pages.
- Extended instant screen rendering with LoRes replacement pixels and
  transparent Layer 2 overlay for 256x192, 320x256, and 640x256 fixed
  fixtures.
- Added adapter diagnostics/exports for Layer 2 and LoRes state, and updated
  older fallback tests now that `0x123b` and Layer 2 NextRegs are owned.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-layer2-lores.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-contention-speed.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/wasm/zxNext/wasm-next-interrupts.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-storage.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (223,985 bytes against 360,000)
  - `git diff --check`

### Step 23 - Tilemap Rendering

Status: Completed on 2026-08-16

Implement tilemap device state and rendering.

Implementation:

- Port `TilemapDevice` registers and defaults.
- Port tilemap base address, attributes, scroll, clipping, palette, and priority
  interactions used by current TypeScript rendering.
- Integrate tilemap into composed screen rendering.

Source TypeScript:

- `src/emu/machines/zxNext/TilemapDevice.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/tilemap-plan.md`;
- `src/emu/machines/zxNext/PaletteDevice.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tilemap.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`.

Guardrail:

- Tilemap register/state ownership belongs in `zxnext-tilemap.c`; only final
  layer composition belongs in `zxnext-screen.c`.

Tests:

- Add `test/wasm/zxNext/wasm-next-tilemap.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/TilemapDevice.test.ts`;
  - `test/zxnext/TilemapDevice-compositing.test.ts`;
  - `test/zxnext/TilemapDevice-d1d2.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-tilemap.test.ts`

Definition of done:

- Tilemap control, rendering, and compositing match TypeScript for selected
  fixtures.

Completed notes:

- Added `zxnext-tilemap.c` for tilemap state, NextRegs `$1b`, `$2f`, `$30`,
  `$31`, `$4c`, `$6b`, `$6c`, `$6e`, and `$6f`.
- Integrated shared `$1c` clip-index reset dispatch so Layer 2 and tilemap can
  both observe the same write.
- Added direct tilemap VRAM addressing with bank-7 five-bit map-base masking,
  40x32 and 80x32 graphics/text pixel decoding, palette selection, clipping,
  transparency, and per-tile ULA priority/force-on-top composition.
- Added adapter diagnostics/exports for tilemap state and a VRAM-address helper.
- Added `test/wasm/zxNext/wasm-next-tilemap.test.ts`.
- Validation:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-tilemap.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-tilemap.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-contention-speed.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/wasm/zxNext/wasm-next-interrupts.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-storage.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-tilemap.test.ts`
  - `npm test -- --project jsdom test/zxnext/TilemapDevice-compositing.test.ts test/zxnext/TilemapDevice-d1d2.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (228,032 bytes against 360,000)
  - `git diff --check`

### Step 24 - Sprite Rendering

Status: Completed on 2026-08-16 for sprite registers, pattern memory,
attributes, clipping, dimensions, priority, collision/status, and
representative non-relative sprite pixels. Relative sprite-chain resolution and
cycle/overtime-accurate sprite buffering remain a Step 25 composition-parity
boundary.

Implement sprite state and rendering.

Implementation:

- Added `zxnext-sprites.c` for sprite slot/status ports, NextRegs, direct and
  sequential attributes, 8-bit/4-bit pattern RAM variants, clip windows,
  dimensions, palette selection, priority, and collision/status readback.
- Integrated representative sprite pixels into the instant composed-screen
  pipeline after existing ULA/tilemap/Layer 2 overlays.
- Taught the WASM adapter that sprite ports `$303b`, `$57`, and `$5b` are
  runtime-owned so reads/writes no longer fall through unsupported-port
  diagnostics or TypeScript status state.

Source TypeScript:

- `src/emu/machines/zxNext/SpriteDevice.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/screen/sprites.md`;
- `src/emu/machines/zxNext/PaletteDevice.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sprites.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`.

Guardrail:

- Sprite slot, pattern RAM, and status state must not live in
  `zxnext-screen.c`. Screen composition may consume sprite output, but
  `zxnext-sprites.c` owns the device.

Tests:

- Added `test/wasm/zxNext/wasm-next-sprites.test.ts`.
- Migrated focused coverage from:
  - `test/zxnext/SpriteDevice.test.ts`;
  - `test/zxnext/SpriteDevice-anchor.test.ts`;
  - `test/zxnext/SpriteDevice-clip.test.ts`;
  - `test/zxnext/SpriteDevice-d4d6d7.test.ts`;
  - `test/zxnext/SpriteDevice-dimensions.test.ts`;
  - `test/zxnext/SpriteDevice-index.test.ts`;
  - `test/zxnext/SpriteDevice-patterns.test.ts`;
  - `test/zxnext/SpriteDevice-resolve.test.ts`;
  - `test/zxnext/SpriteDevice-status.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-sprites.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-sprites.test.ts test/wasm/zxNext/wasm-next-tilemap.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (233,754 bytes against 360,000)
  - `git diff --check`

Definition of done:

- Sprite registers, pattern writes, status flags, and representative pixels
  match TypeScript.

### Step 25 - Full Screen Composition Parity

Status: Completed on 2026-08-16 for the instant-renderer composition priority
matrix across ULA/LoRes+tilemap, Layer 2, sprites, Layer 2 priority bit,
fallback color, and blend modes 6/7. Cycle-accurate sprite line buffering,
complete border composition, and stencil/ULA-control edge cases remain later
video-polish boundaries.

Bring ULA, Layer 2, LoRes, Tilemap, Sprites, palettes, clips, and priority
together.

Implementation:

- Added packed layer-pixel metadata in WASM so the compositor can distinguish
  opaque black from transparency and preserve the Layer 2 priority bit.
- Ported the `NextComposedScreenDevice.composeSinglePixel` priority switch for
  NR `$15` modes `SLU`, `LSU`, `SUL`, `LUS`, `USL`, `ULS`, plus blend modes
  `6` and `7`.
- Routed ULA/LoRes plus tilemap, Layer 2, and sprite outputs through the final
  composition helper instead of a fixed overlay order.
- Added fallback-color state from NR `$4a` and exposed `layerPriority` and
  `fallbackColor` through WASM diagnostics.

Source TypeScript:

- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`;
- `src/emu/machines/zxNext/screen/screen_rendering.md`;
- `src/emu/machines/zxNext/PaletteDevice.ts`;
- `src/emu/machines/zxNext/TilemapDevice.ts`;
- `src/emu/machines/zxNext/SpriteDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tilemap.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sprites.c`.

Guardrail:

- This step is integration/composition only. If a layer device still lacks
  state parity, return to that layer's owning step instead of hiding it in the
  composition pipeline.

Tests:

- Added `test/wasm/zxNext/wasm-next-screen-composition.test.ts`.
- Migrated representative integrated fixtures from
  `test/zxnext/NextComposedScreenDevice.test.ts`.
- Compare full pixel samples, not necessarily every pixel for every case.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-composition.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-composition.test.ts test/wasm/zxNext/wasm-next-sprites.test.ts test/wasm/zxNext/wasm-next-tilemap.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext`
  - `npm test -- --project jsdom test/zxnext/NextComposedScreenDevice.test.ts test/zxnext/Layer2Fixes.test.ts test/zxnext/UlaRendering.test.ts`
  - `npm run build:check`
  - `npm run check:zxnext-wasm-size` (234,532 bytes against 360,000)
  - `git diff --check`
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-composition.test.ts`

Definition of done:

- The full composed screen has oracle parity for the selected regression set.

### Step 26 - Beeper, TurboSound, PSG, DAC, And Mixer

Status: Not started

Move normal-frame audio generation into WASM.

Implementation:

- Port beeper generation.
- Port TurboSound with three PSG chips.
- Reuse PSG lessons from 128K/+3E and MAME-compatible behavior.
- Port DAC channels and NextReg/port mappings.
- Port audio mixer, mono/stereo routing, scaling, clipping, and state.
- Expose raw `int16_t` stereo samples and normalized adapter samples.

Source TypeScript:

- `src/emu/machines/BeeperDevice.ts` and the current beeper usage from
  `src/emu/machines/zxNext/UlaDevice.ts`;
- `src/emu/machines/zxNext/TurboSoundDevice.ts`;
- `src/emu/machines/zxNext/DacDevice.ts`;
- `src/emu/machines/zxNext/DacNextRegDevice.ts`;
- `src/emu/machines/zxNext/DacPortDevice.ts`;
- `src/emu/machines/zxNext/AudioControlDevice.ts`;
- `src/emu/machines/zxNext/AudioMixerDevice.ts`;
- `src/emu/machines/zxNext/NextSoundDevice.ts`;
- `src/emu/machines/zxNext/io-ports/AyRegPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/AyDatPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/DacPortHandler.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-audio.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-psg.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dac.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.

Guardrail:

- Audio device state belongs in audio/PSG/DAC slices, not in ULA or port glue.
  Public `getAudioSamples()` must read normalized samples derived from the WASM
  int16 buffer.

Tests:

- Add `test/wasm/zxNext/wasm-next-audio.test.ts`.
- Migrate focused groups from:
  - `test/audio/BeeperDevice.test.ts`;
  - `test/audio/BeeperMameCompat.test.ts`;
  - `test/audio/TurboSoundDevice.step*.test.ts`;
  - `test/audio/DacDevice.step5.test.ts`;
  - `test/audio/DacPortDevice.step6.test.ts`;
  - `test/audio/DacNextRegDevice.step7.test.ts`;
  - `test/audio/AudioMixerDevice.step8.test.ts`;
  - `test/audio/AudioControlDevice.step9.test.ts`;
  - `test/audio/PortHandlers.step10.test.ts`;
  - `test/audio/AudioIntegration.test.ts`;
  - `test/audio/AudioMixing.step17.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-audio.test.ts test/audio`

Definition of done:

- Representative beeper, PSG, DAC, TurboSound, and mixer behavior matches
  TypeScript or documented improved PSG semantics.

### Step 27 - DMA

Status: Not started

Port Z80 DMA and ZXN DMA.

Implementation:

- Port command parsing, registers, follow-byte queues, bus request/acknowledge,
  read/write cycles, port transfers, memory transfers, timing, auto-restart,
  and status reads.
- Integrate DMA with C-owned memory and port manager.
- Integrate DMA interrupt signal with `InterruptDevice`.

Source TypeScript:

- `src/emu/machines/zxNext/DmaDevice.ts`;
- `src/emu/machines/zxNext/io-ports/Z80DmaPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/ZxnDmaPortHandler.ts`;
- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/InterruptDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c`.

Guardrail:

- DMA must use C-owned memory and port functions. Do not route each DMA byte
  through TypeScript callbacks.

Tests:

- Add `test/wasm/zxNext/wasm-next-dma.test.ts`.
- Migrate focused groups from all `test/zxnext/DmaDevice*.test.ts` files in
  small batches:
  - basic commands;
  - read/write cycles;
  - transfers;
  - bus control;
  - timing;
  - auto-restart;
  - interrupts/status.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-dma.test.ts`

Definition of done:

- DMA-visible memory, port, bus, and status behavior matches TypeScript for the
  migrated suite.

### Step 28 - Copper

Status: Not started

Port raster Copper execution.

Implementation:

- Port Copper program memory and NextReg `0x60..0x63`.
- Execute Copper ticks during screen rendering in WASM.
- Apply Copper writes to WASM-owned NextRegs and rendering state.

Source TypeScript:

- `src/emu/machines/zxNext/CopperDevice.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`;
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-screen.c`.

Guardrail:

- Copper writes must go through the same WASM NextReg write path as CPU and
  port writes. Do not special-case direct field mutations that bypass register
  side effects.

Tests:

- Add `test/wasm/zxNext/wasm-next-copper.test.ts`.
- Migrate focused groups from `test/zxnext/CopperDevice.test.ts`.
- Compare register effects at raster positions and frame boundaries.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-copper.test.ts`

Definition of done:

- Copper timing and register-write effects match TypeScript oracle.

### Step 29 - CTC

Status: Not started

Port the eight-channel CTC.

Implementation:

- Port channel control words, prescalers, counters, trigger/interrupt behavior,
  and lazy sync on port reads/writes.
- Connect CTC interrupt outputs to the WASM interrupt device.

Source TypeScript:

- `src/emu/machines/zxNext/CtcDevice.ts`;
- `src/emu/machines/zxNext/io-ports/CtcPortHandler.ts`;
- `src/emu/machines/zxNext/InterruptDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ctc.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c`.

Guardrail:

- Lazy sync semantics from TypeScript must be represented explicitly in WASM
  state and tests. Do not replace CTC with simple fixed read values.

Tests:

- Add `test/wasm/zxNext/wasm-next-ctc.test.ts`.
- Migrate focused groups from `test/zxnext/CtcDevice.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ctc.test.ts`

Definition of done:

- CTC ports, counters, and interrupts match TypeScript.

### Step 30 - Multiface And Expansion Bus

Status: Not started

Port external memory/port/NMI devices that alter hot machine state.

Implementation:

- Port Multiface enable gates, ports, memory mapping, active state, and NMI
  entry.
- Port expansion bus registers, ROMCS replacement flags, propagation flags, and
  NMI debounce/causes.

Source TypeScript:

- `src/emu/machines/zxNext/MultifaceDevice.ts`;
- `src/emu/machines/zxNext/ExpansionBusDevice.ts`;
- `src/emu/machines/zxNext/MemoryDevice.ts`;
- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/io-ports/MultifacePortHandler.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-multiface.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-expansion.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupt.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`.

Guardrail:

- ROMCS and NMI cause state must be owned by the memory/interrupt-affecting
  device slices. Do not leave TypeScript memory selection active when WASM owns
  memory reads.

Tests:

- Add `test/wasm/zxNext/wasm-next-multiface-expansion.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/MultifaceDevice.test.ts`;
  - `test/zxnext/MultifaceMemory.test.ts`;
  - `test/zxnext/ExpansionBusDevice.test.ts`;
  - `test/zxnext/ExpansionBusNmi.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-multiface-expansion.test.ts`

Definition of done:

- Multiface/expansion bus memory, ports, and NMI behavior match TypeScript for
  migrated cases.

### Step 31 - Joystick And Mouse

Status: Not started

Port game input devices.

Implementation:

- Sync changed joystick and mouse state into WASM.
- Port Kempston joystick 1, joystick 1 alias, joystick 2, and MD selection.
- Port Kempston mouse X/Y/wheel/buttons and enable gates.

Source TypeScript:

- `src/emu/machines/zxNext/JoystickDevice.ts`;
- `src/emu/machines/zxNext/MouseDevice.ts`;
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts`;
- `src/emu/machines/zxNext/NextRegDevice.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-input.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.

Guardrail:

- Input state may be app-owned, but port decode and mode selection must be
  WASM-owned once migrated. Sync changed state only, following the keyboard
  pattern.

Tests:

- Add `test/wasm/zxNext/wasm-next-input.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/KempstonJoystick.test.ts`;
  - `test/zxnext/KempstonMouse.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-input.test.ts`

Definition of done:

- Input ports and port-enable gates match TypeScript.

### Step 32 - UART And I2C

Status: Not started

Port serial and I2C/RTC behavior.

Implementation:

- Port UART channels, FIFOs, Tx/Rx/select/frame ports, status, and per-frame
  auto-drain.
- Port I2C SCL/SDA behavior and DS1307-style per-frame clock advance.

Source TypeScript:

- `src/emu/machines/zxNext/UartDevice.ts`;
- `src/emu/machines/zxNext/I2cDevice.ts`;
- `src/emu/machines/zxNext/io-ports/UartTxPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/UartRxPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/UartSelectPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/UartFramePortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/I2cSclPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/I2cSdaPortHandler.ts`.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-i2c.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`.

Guardrail:

- RTC/current-time policy must be explicit. If real host time remains
  TypeScript-owned, WASM must receive bounded sync events rather than calling
  out during every I2C transition.

Tests:

- Add `test/wasm/zxNext/wasm-next-peripherals.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/UartDevice.test.ts`;
  - `test/zxnext/I2cDevice.test.ts`.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-peripherals.test.ts`

Definition of done:

- UART and I2C ports match TypeScript for migrated scenarios.

### Step 33 - +3 Floppy/FDC Hook

Status: Not started

Decide whether the Next FDC path remains TypeScript-owned or moves into WASM.

Implementation:

- If the hot path is active for Next software, port the +3E WASM FDC lessons:
  parsed disk upload, bounded sector buffer, dirty journal, lifecycle flush.
- If it is currently a compatibility side path, keep app-owned disk parsing in
  TypeScript but make public port behavior and motor/status state parity tests
  explicit.
- Preserve current `DISK_*_CHANGES` persistence semantics if writes are moved.

Source TypeScript:

- `src/emu/machines/zxNext/io-ports/SpectrumP3FdcStatusPortHandler.ts`;
- `src/emu/machines/zxNext/io-ports/SpectrumP3FdcControlPortHandler.ts`;
- current floppy controller implementation used by the Next machine;
- disk persistence code used by existing `DISK_*_CHANGES` properties.

Destination files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-floppy.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.

Guardrail:

- This step must first decide ownership. Do not half-port FDC state: either
  document TypeScript ownership with parity tests, or move the hot port/status
  state into `zxnext-floppy.c`.

Tests:

- Add FDC cases to `wasm-next-storage.test.ts` or a separate
  `wasm-next-floppy.test.ts`.
- Migrate focused groups from:
  - `test/zxnext/FloppyControllerDevice.test.ts`;
  - relevant `test/disk/FloppyControllerDevice.test.ts` behavior if WASM owns
    FDC internals.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-floppy.test.ts`

Definition of done:

- The plan records whether FDC is WASM-owned or TypeScript-owned, and tests
  cover the chosen public contract.

### Step 34 - Debug, IDE, And Public Adapter Surface

Status: Not started

Complete the public adapter surface for all remaining devices. Step 18A proves
the early IDE baseline; this step closes parity after the rest of the machine is
WASM-owned.

Implementation:

- Override all inherited APIs that would otherwise read stale TypeScript
  device state:
  - `getCpuState`;
  - memory read/write helpers;
  - port read/write helpers;
  - partition helpers;
  - NextReg state;
  - palette state;
  - ULA, Layer 2, tilemap, sprite, Copper, DMA, CTC, interrupt, audio, storage,
    joystick, mouse, UART, I2C, Multiface, expansion bus, and FDC inspection
    surfaces;
  - pixel/audio buffer access;
  - debug stepping;
  - code injection;
  - frame-command processing and flush hooks.
- Pull CPU registers only in debug/inspection paths.
- Sync last bus events after debug steps.
- Add diagnostics for JS/WASM crossing counts.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/Z80NMachineBase.ts`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/renderer/abstractions/IAnyMachine.ts`;
- IDE/debugger renderer files discovered with:
  `rg "getCpuState|readScreenMemory|getPixelBuffer|getMemoryPartition|directGetRegValue|lastIo" src/renderer src/emu`.

Destination files:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
- relevant device slices for diagnostic snapshot exports;
- `test/wasm/zxNext/wasm-next-ide-inspection.test.ts`.

Guardrail:

- No IDE-visible value may come from stale TypeScript device state after its
  owning device has moved to WASM. Each public surface needs an assertion
  through the adapter, not just a raw export.

Tests:

- Add public adapter parity tests to `ZxNextWasmV2Machine.test.ts` and
  `wasm-next-oracle-programs.test.ts`.
- Extend `wasm-next-ide-inspection.test.ts` for every newly migrated device
  that has an IDE-visible panel, status view, or diagnostic snapshot.
- Cover direct public APIs, not only raw WASM exports.
- Run:
  - `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-oracle-programs.test.ts test/wasm/zxNext/wasm-next-ide-inspection.test.ts`

Definition of done:

- IDE/debugger-facing APIs report WASM-owned state when the WASM backend is
  selected.

### Step 35 - Oracle Program Matrix

Status: Not started

Add small end-to-end CPU programs that exercise multiple devices together.

Implementation:

- Add deterministic ROM snippets for:
  - memory bank switch and read/write;
  - keyboard port read;
  - ULA border/screen write;
  - NextReg write/read;
  - SD command sequence;
  - PSG/DAC output setup;
  - DMA transfer;
  - interrupt acknowledgement.
- Run each against TypeScript and WASM where TypeScript determinism allows.

Source TypeScript:

- The source files for every device exercised by each program;
- `src/emu/machines/zxNext/ZxNextMachine.ts`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- existing `test/wasm/zxNext/wasm-next-*.test.ts` helpers.

Destination files:

- `test/wasm/zxNext/wasm-next-oracle-programs.test.ts`;
- `test/wasm/zxNext/wasm-next-test-helpers.ts`;
- device slices only when a test exposes a real migration gap assigned to a
  previous owning step.

Guardrail:

- Oracle programs are regression tests, not a place to add hidden emulator
  behavior. If a program fails because a device is incomplete, return to the
  owning step and update its checklist.

Tests:

- Add `test/wasm/zxNext/wasm-next-oracle-programs.test.ts`.
- Compare PC, tacts, memory, port values, NextReg snapshots, pixel samples, and
  audio/storage side effects.
- Run:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-oracle-programs.test.ts`

Definition of done:

- Cross-device regressions are covered by short, readable programs.

### Step 36 - Performance And Boundary Audit

Status: Not started

Verify the migration did not accidentally become a hybrid backend.

Implementation:

- Add diagnostics for:
  - frame calls;
  - instruction calls;
  - keyboard/audio/storage syncs;
  - full-buffer copies;
  - register syncs;
  - port/memory calls crossing JS/WASM during normal frames.
- Add a benchmark script or extend the Spectrum WASM benchmark pattern for
  Next.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- migrated Spectrum WASM diagnostics/benchmark patterns;
- build scripts under `scripts/`.

Destination files:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`;
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.h`;
- `scripts/benchmark-zxnext-wasm.cjs` if created;
- `test/zxnext/ZxNextWasmV2Machine.test.ts`.

Guardrail:

- Performance diagnostics must count JS/WASM crossings during normal frames.
  Do not accept a frame path that works by doing per-tact or per-port
  TypeScript calls.

Tests:

- Add a diagnostics assertion to `ZxNextWasmV2Machine.test.ts`.
- Add `npm run benchmark:zxnext-wasm` if a benchmark script is created.
- Run:
  - `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts`
  - `npm run benchmark:zxnext-wasm -- --frames 120 --warmup 20 --runs 5`

Definition of done:

- Normal frame execution performs one WASM frame call plus bounded changed-input
  sync and no per-tact JS/WASM traffic.

### Step 37 - Rollout Default

Status: Not started

Switch the default only after parity and manual boot/storage smoke pass.

Implementation:

- Change `DEFAULT_ZXNEXT_IMPLEMENTATION` to `"wasm"`.
- Keep explicit `"typescript"` fallback.
- Ensure model picker remains implementation-neutral.
- Update README/wasm folder notes.

Source TypeScript:

- `src/emu/machines/zxNext/ZxNextImplementation.ts`;
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`;
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`;
- WASM README/docs under `src/emu/machines/zxNext/wasm/` if present;
- project docs that mention ZX Spectrum Next implementation defaults.

Destination files:

- `src/emu/machines/zxNext/ZxNextImplementation.ts`;
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`;
- `src/emu/machines/zxNext/wasm/README.md`;
- `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`.

Guardrail:

- Do not switch the default until Step 13A, boot/storage milestone, IDE
  inspection, performance audit, and manual smoke are all complete and recorded
  with exact dates/commands.

Tests:

- Run focused Next WASM suite:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/zxnext-wasm-build.test.ts test/wasm/zxNext`
- Run broader regression:
  - `npm run build:check`
  - `npm run lint:renderer`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size`
  - `npx electron-vite build --config build/electron.vite.config.ts`
- Manual smoke:
  - boot ZX Spectrum Next;
  - see start menu;
  - read storage file listing;
  - display standard ULA screen;
  - type on keyboard;
  - verify basic audio does not clip;
  - restart machine without stale storage state.

Definition of done:

- `"wasm"` is the default and `"typescript"` remains a working fallback.

### Step 38 - Cleanup Obsolete Migration Scaffolding

Status: Not started

Remove only scaffolding that is no longer needed.

Implementation:

- Remove placeholder adapter branches.
- Remove stale experimental build artifacts.
- Keep test helpers that protect production contracts.
- Do not remove TypeScript implementation or TypeScript tests.

Source TypeScript:

- Migration-specific WASM scaffolding files discovered with `git grep` and
  plan references;
- TypeScript implementation and tests only for reference, not deletion.

Destination files:

- obsolete migration scaffolding identified in the cleanup audit;
- `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`;
- `.ai/zx-spectrum-next-wasm-migration-learnings.md`.

Guardrail:

- Cleanup must be deletion-only or documentation-only unless a test fails.
  Never delete the TypeScript implementation or original TypeScript tests.

Tests:

- Run:
  - `npm test -- --project jsdom test/zxnext test/wasm/zxNext`
  - `npm run build:check`
  - `git diff --check`

Definition of done:

- The codebase contains only production WASM paths, TypeScript fallback paths,
  and durable tests.

## Milestone Gates

### Gate A - Selectable WASM Backend

Required steps: 1 through 7.

Acceptance:

- Factory can create explicit WASM machine.
- Loader/build tests pass.
- Adapter setup/reset passes.

### Gate B - ROM Execution And Standard ULA Screen

Required steps: 8 through 15.

Acceptance:

- WASM executes frames.
- Standard ULA screen renders non-blank pixels.
- Keyboard/ULA port basics work.

### Gate C - Start Menu And Storage Read

Required steps: 16 through 18A.

Acceptance:

- Boot/start menu is visible.
- SD-card sector reads complete through the existing frame-command contract.
- Storage file listing is readable in manual smoke.
- Step 18A IDE inspection baseline passes for registers, memory, disassembly
  reads, NextRegs, and standard ULA state.

### Gate D - Full Core Next Parity

Required steps: 19 through 35.

Acceptance:

- Next-specific video, audio, DMA, interrupts, storage, and peripherals have
  migrated WASM tests or documented TypeScript-owned contracts.

### Gate E - Default Rollout

Required steps: 36 through 38.

Acceptance:

- WASM is default.
- TypeScript fallback remains.
- Full validation commands and manual smoke are recorded.

## Running Commands

Focused first:

```sh
npm test -- --project jsdom <focused test files>
npm run build:zxnext-wasm
npm run check:zxnext-wasm-size
```

Before rollout:

```sh
npm test -- --project jsdom test/zxnext test/wasm/zxNext
npm run build:check
npm run lint:renderer
npx electron-vite build --config build/electron.vite.config.ts
git diff --check
```

Manual smoke after each runnable milestone:

```sh
npm run dev
```

## Open Risks

- Z80N support may require extending the existing WASM CPU core beyond the Z80
  subset currently proven by Spectrum migrations.
- NextReg side effects are broad; missing public adapter overrides can make the
  IDE read stale TypeScript device state while WASM runs correctly internally.
- SD-card persistence has asynchronous app-owned responses. The WASM adapter
  must preserve the current response-readiness contract.
- Full composed video is large. Standard ULA must land first so early boot is
  visible before Layer 2, tilemap, and sprites are complete.
- DMA and Copper interact with memory, ports, interrupts, and rendering; migrate
  them after those foundations are stable.
- Audio shares code and semantics with Spectrum PSG work but Next TurboSound and
  DAC routing are broader than 128K/+3E.

## Learnings Log

Durable learnings belong in:

`./.ai/zx-spectrum-next-wasm-migration-learnings.md`

Add entries whenever implementation discovers a parity trap, missing adapter
override, test harness constraint, or performance issue that future slices
should remember.
