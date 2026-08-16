# ZX Spectrum Next WASM Migration Plan

Created: 2026-08-16

Status: Steps 1-10 done; WASM artifact, loader, adapter skeleton, Z80N CPU
baseline, core memory/MMU reset layout, and 128K/+3/Next memory-port paging in
place

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
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sdcard.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.c`
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

Status: Done on 2026-08-16

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

Status: Done on 2026-08-16

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

Status: Not started

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

### Step 12 - ULA Port And Keyboard Matrix

Status: Not started

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

### Step 13 - Standard ULA Screen Timing And Rendering

Status: Not started

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

### Step 14 - Minimal Frame Execution

Status: Not started

Execute normal frames fully inside WASM for CPU, memory, ports, keyboard, and
standard ULA screen.

Implementation:

- Implement `zxnextExecuteFrame()`.
- Preserve instruction overshoot across frame boundaries.
- Sync only frame counters after a normal frame.
- Avoid full register sync in normal running.
- Keep TypeScript debug policy but use C-owned single-instruction stepping when
  debug mode requests it.

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

### Step 15 - Early Boot Smoke Without Storage

Status: Not started

Boot far enough to prove ROM execution and ULA rendering are alive, even if
storage still returns inert values.

Implementation:

- Use fixed ROM fixtures or real resource ROMs through `setup()`.
- Stub unsupported ports to TypeScript-equivalent `0xff` or documented open bus
  values.
- Add diagnostics for first unimplemented port/device hit to guide next steps.

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

### Step 16 - DivMMC Automap And Memory Side Effects

Status: Not started

Implement the DivMMC behavior required by NextZXOS boot and storage access.

Implementation:

- Port DivMMC enable, `0xe3`, CONMEM, MAPRAM, bank selection, and automap
  entry/exit points.
- Implement RST trap fields and NextReg `0x83`, `0xB8..0xBB` effects.
- Implement DivMMC NMI hold pieces that affect memory mapping.
- Keep app-level NMI button policy in TypeScript if needed, but C must own hot
  memory-map effects.

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

### Step 17 - SD Card SPI State Machine

Status: Not started

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

### Step 18 - Early Storage Boot Milestone

Status: Not started

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

### Step 18A - Early IDE Inspection Baseline

Status: Not started

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

### Step 19 - Contention And CPU Speed Parity

Status: Not started

Implement Next contention and speed behavior.

Implementation:

- Port CPU speed effective/programmed speed.
- Implement 3.5/7/14/28 MHz tact scaling.
- Implement RAM/port contention disable flags and 128K-style contended ranges.
- Preserve write-delay behavior currently modeled by TypeScript.

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

### Step 20 - Interrupts And NMI State Machine

Status: Not started

Move interrupt/NMI hot state into WASM.

Implementation:

- Port ULA interrupt pulse capture.
- Port line interrupt capture.
- Port IM2 daisy chain state used by Next.
- Port DMA/CTC interrupt inputs as those devices come online.
- Port stackless NMI, Multiface NMI, DivMMC NMI, expansion-bus NMI, hold/end
  states, and RETN side effects.

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

### Step 21 - Palette And ULA+/Timex Modes

Status: Not started

Implement the palette and classic enhanced video pieces before Next layers.

Implementation:

- Port `PaletteDevice` state and NextReg side effects.
- Port Timex port `0xff`.
- Port ULA+ register/data ports.
- Apply palette changes in the ULA renderer.

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

### Step 22 - Layer 2 And LoRes Rendering

Status: Not started

Implement Layer 2 and LoRes rendering after standard ULA is stable.

Implementation:

- Port Layer 2 memory mapping and port `0x123b`.
- Port Layer 2 registers and scroll/clip controls.
- Port LoRes behavior used by current tests.
- Compose Layer 2 with ULA according to current priority rules.

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

### Step 23 - Tilemap Rendering

Status: Not started

Implement tilemap device state and rendering.

Implementation:

- Port `TilemapDevice` registers and defaults.
- Port tilemap base address, attributes, scroll, clipping, palette, and priority
  interactions used by current TypeScript rendering.
- Integrate tilemap into composed screen rendering.

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

### Step 24 - Sprite Rendering

Status: Not started

Implement sprite state and rendering.

Implementation:

- Port sprite slot, status, attributes, pattern RAM, anchor behavior, clipping,
  dimensions, priority, and collision/status flags.
- Integrate sprites into the composed screen pipeline.

Tests:

- Add `test/wasm/zxNext/wasm-next-sprites.test.ts`.
- Migrate focused groups from:
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

Definition of done:

- Sprite registers, pattern writes, status flags, and representative pixels
  match TypeScript.

### Step 25 - Full Screen Composition Parity

Status: Not started

Bring ULA, Layer 2, LoRes, Tilemap, Sprites, palettes, clips, and priority
together.

Implementation:

- Port the final composition pipeline from `NextComposedScreenDevice`.
- Preserve 50/60 Hz timing and interrupt pulses while rendering all layers.
- Avoid copying full buffers between JS and WASM each frame.

Tests:

- Add `test/wasm/zxNext/wasm-next-screen-composition.test.ts`.
- Migrate representative integrated fixtures from
  `test/zxnext/NextComposedScreenDevice.test.ts`.
- Compare full pixel samples, not necessarily every pixel for every case.
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
