# Cambridge Z88 WASM Migration Plan

Created: 2026-09-19

## Goal

Replace the TypeScript Cambridge Z88 emulator with a fast, full-machine C/WASM backend, built the
same way as the ZX Spectrum 48K and 128K backends:

- one `.wasm` artifact holds the whole machine: CPU, Blink, memory and cards, RTC, keyboard, LCD
  and beeper;
- the normal frame path makes one boundary call per frame;
- the CPU is the shared `src/emu/z80/wasm/z80.c` core. **Do not create a second Z80 core.** If the
  Z88 needs something the core lacks, extend `z80.c` (see Step 0.4) and keep all four existing cores
  green.

The TypeScript `Z88Machine` stays the parity oracle for the whole migration. It also stays in the
machine menu for a comparison period after WASM becomes the default. Removing it is a separate,
later plan.

Every existing Z88 test must run against the WASM machine as well as the TypeScript one. New
WASM-specific tests are added on top of that.

## Read First

- `AGENTS.md`
- `.ai/wasm-migration-intent-and-lessons.md`: especially "A WASM machine must not subclass the
  TypeScript machine it replaces", "Parity checks the IDE too", and the debugger section.
- `.ai/wasm-v2-machine-migration-guide.md`
- `.plans/ZX_SPECTRUM_128_WASM_MIGRATION_PLAN.md`: the slice structure this plan copies.
- `.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`: the host/interface separation and the
  compatibility model in the menu.
- `.plans/WASM_PERFORMANCE_TUNING_PLAN.md`
- `src/emu/machines/zxSpectrum48/{ZxSpectrum48WasmHost.ts,ZxSpectrum48WasmV2Machine.ts,wasm/Sp48WasmV2Loader.ts,wasm/sp48/sp48.c}`
- `src/emu/machines/zxNext/{ZxNextWasmHost.ts,IZxNextIdeMachine.ts,ZxNextImplementation.ts,ZxNextMachineFactory.ts}`
- `src/emu/z80/wasm/z80.c`: the hook macro table is in "Shared CPU Contract" below.
- `src/emu/machines/z88/**`: the oracle.

## How The Spectrum WASM Backends Work

The Z88 backend follows these principles, taken from the current 48K/128K code.

1. **Full machine in C.** The frame path is: sync changed inputs (keyboard lines, sample rate,
   clock multiplier) → call `sp48ExecuteFrame()` once → sync frame counters → read typed views of
   pixels and audio. Nothing crosses the JS/WASM boundary per tact, per instruction, per memory
   access or per port access during a normal frame.
2. **One translation unit, no heap.** `sp48.c` `#include`s its parts and the shared `z80.c` after
   defining hook macros. All state is `static`, prefixed globals. There is no `malloc`. Buffers are
   bounded arrays exposed through pointer exports (`*MemoryPtr`, `*PixelBufferPtr`,
   `*AudioSamplesPtr`, …). Only non-`static` functions named in the build script's allow-list are
   exported.
3. **Plain clang, speed profile.** `clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry
   -Wl,--export-memory`, with fixed initial and max memory and one `--export=` per production
   export. The size check has a recorded ceiling. The artifact is not committed; tests build it on
   the fly, so clang with the wasm32 target is required. Vite hashes and ships it through
   `new URL("./dist/<name>.wasm", import.meta.url)`. `extraResources` also copies `dist/`.
4. **A loader validates the module.** `Sp48WasmV2Loader.ts` compiles once (module cache),
   instantiates with no imports, checks every required export, and builds typed views with bounds
   checks. Tests inject `readArtifact`, `compile` and `instantiate`.
5. **A host class that is not the TypeScript machine.**
   `Z80MachineBase → ZxSpectrum48WasmHost → ZxSpectrum48WasmV2Machine`. The host holds only
   plumbing: machine id, clock, partition labels, the injection flow, the keystroke queue and sys
   vars. The adapter owns runtime sync. The TypeScript `Z80Cpu` register fields are a mirror, filled
   only by `syncCpuFromWasmV2` on setup, reset, pause/debug and `getCpuState()`.
6. **The debug path is instruction by instruction in C, with policy in TypeScript.**
   `executeWasmV2DebugLoop` calls `*ExecuteInstruction()`. It imports bus events only when access
   breakpoints exist. Stopping is decided by the shared `DebugStepDecision.shouldStopAtDebugPoint`.
   Step-out comes from the core's shadow stack (`*GetStepOutAddress`).
7. **Guard rails.**
   - `scripts/check-wasm-cpu-contract.cjs` and `test/wasm/wasm-shared-z80-cpu-contract.test.ts`
     prove each artifact includes the shared `z80.c`.
   - The Next has an import-graph separation test proving the WASM machine never loads a
     TypeScript emulation module.
   - `test/wasm/z80/` runs the literal copy of the Z80 instruction corpus against the standalone
     C core.
8. **The TypeScript oracle decides parity. The hardware decides who is right.** Parity tests
   compare both backends through public machine APIs. When they disagree, the real hardware or
   documentation settles it; the TypeScript oracle has been the wrong side before.
9. **Two-value switch, product-oriented menu.** The config key is `"typescript" | "wasm"`. The Next
   kept its TypeScript backend selectable as a separate "Compatibility" model with the key set
   explicitly.

## Current Z88 State (TypeScript Oracle)

This summary is from the 2026-09-19 inventory. Line references are to that day's sources.

- `Z88Machine extends Z80MachineBase` (`src/emu/machines/z88/Z88Machine.ts`). The renderer
  registry constructs it directly: `new Z88Machine(model, config, messenger)`. There is no factory
  or switch.
- **Clock and frame.**
  - The clock is 3,276,800 Hz. A frame is 16,384 tacts (5 ms, so 200 frames/s).
  - `uiFrameFrequency = 8`: the LCD renders and the UI refreshes every 8th frame (25 fps).
  - `softResetOnFirstStart = true`.
- **Per-frame work** (`onInitNewFrame`), in this order:
  1. `blink.incrementRtc()`
  2. KWAIT awake
  3. `screenDevice.renderScreen()`
  4. sleep detection (`halted && I === 0x3F`)
  5. `beeper.onNewFrame()`
- **Per-instruction work** (`afterInstructionExecuted`): awake if any key is pressed, then
  `beeper.calculateOscillatorBit()`.
- **Per-tact work** (`onTactIncremented`): `beeper.setNextAudioSample()`.
- **Interrupts.** `shouldRaiseInterrupt()` returns `blink.interruptSignalActive`. The interrupt
  mode is IM1. There is no NMI and no memory contention.
- **Snooze.**
  - Reading `$B2` with INT.KWAIT set and no key down snoozes the CPU.
  - While snoozed, `MachineFrameRunner` calls `onSnooze()` (+16 tacts) instead of executing.
  - The CPU wakes on a key press, an RTC event, a flap event, or every 3rd TIM0 tick while the flap
    is open.
  - Snooze state lives on the TypeScript `Z80Cpu` (`_snoozed`, `snoozeCpu`, `awakeCpu`,
    `isCpuSnoozed`, `onSnooze`). **`z80.c` has no equivalent.**
- **Ports.**
  - Reads: `$B0` MID, `$B1` STA, `$B2` KBD (high byte selects lines), `$B5` TSTA, `$D0-$D4` TIM,
    `$70/$71` SCW/SCH, `$E0/$E1/$E5` UART stubs; otherwise `$FF`.
  - Writes: `$70-$74` PB0-3/SBR (16-bit, B supplies the high byte), `$D0-$D3` SR0-3, `$B0` COM,
    `$B1` INT, `$B3` EPR, `$B4` TACK, `$B5` TMK, `$B6` ACK. Writes below `$70` are ignored.
- **Memory.**
  - 4 MB physical, with slot N based at `N * 1 MB`. Slot 0 holds the ROM, and internal RAM is
    banks `$20-$3F`.
  - There are 8 × 8K logical pages. Page 0 is `$00` or `$20` (COM.RAMS). SR0 selects the half-bank
    of page 1. SR1-SR3 each cover 16K.
  - Chip-mask mirroring. Empty slots read a pseudo-random LFSR (seed `0xAC23`).
  - Cards: RAM, ROM, UV EPROM (32K/128K), Intel 28F004S5/28F008S5 flash, AMD 29F040B/29F080B flash.
- **LCD.**
  - Sizes 640×64 (default), 640×320, 640×480, 800×320 and 800×480, set by `MC_SCREEN_SIZE` at reset.
  - The screen is rendered all at once from PB0-3/SBR through absolute 4 MB reads, which bypass the
    card handlers.
  - Pixels are `Uint32` ABGR, the same convention as the Spectrum WASM pixel views.
  - Cursor flash follows TIM0; text flash toggles every 200 frames.
- **Beeper.** A 3200 Hz oscillator (toggles every 512 tacts) or a direct SBIT, gated by
  COM.SRUN/SBIT. Samples go through `AudioDeviceBase`, which includes a DC high-pass filter.
- **Host concerns.**
  - Keyboard layout (`MC_Z88_KEYBOARD`, written to the global setting).
  - ROM/card file loading via `FILE_PROVIDER`.
  - Custom commands `press_shifts` (`setTimeout` 400 ms), `battery_low`, `flap_open` and
    `flap_close`.
  - Card hot-plug of slots 1-3 through `dynamicConfig` + `configure()`, without a rebuild.
  - Changing RAM, slot 0 or the LCD size rebuilds the machine.
- **IDE consumers.**
  - `MainToEmuProcessor.getBlinkState()` casts to `any` and reads device fields.
  - `Z88ToolArea`, `z88Cards.applyCardStateChange` and `useZ88Ports` use `IZ88Machine`.
  - The Blink panel, the Z88 keyboard panel, `Z88CustomDisassembler` (renderer-owned; no change
    needed), and the generic memory/disassembly/partition paths.
- **Models.** Ten models (`OZ50`, `OZ47`, `OZ40`, `OZ40FI`, `OZ30`, `OZ323IT`, `OZ326FR`,
  `OZ319ES`, `OZ321DK`, `OZ318DE`) using ten ROMs in `src/public/roms/` (two 512K, eight 128K).
  None of them has save state; code injection is a stub.

### Existing Z88 tests (baseline: 887 passing cases)

The counts are the cases vitest actually runs, measured on 2026-09-19 with
`npx vitest run --config build/vitest.config.ts --project=node test/z88`.

| File | Cases | Covers |
|---|---|---|
| `test/z88/memory-paging.test.ts` | 193 | constructor defaults; SR0/SR0+RAMS/SR1/SR2/SR3/SR3+RAMS offset and type matrices across card sizes |
| `test/z88/memory-read.test.ts` | 162 | ROM after init; empty-slot random reads |
| `test/z88/memory-write.test.ts` | 261 | ROM read-only; RAMS; internal and card RAM; slot 3 EPROM; per-size repeats |
| `test/z88/memory-eprom-io.test.ts` | 209 | 32K/128K EPROM read and blow in slots 2/3 |
| `test/z88/memory-intflash-io.test.ts` | 30 | Intel 004/008 read, byte program, sector erase |
| `test/z88/rtc.test.ts` | 32 | Blink reset; tick/INT/TMK matrix; RESTIM |

Other tests that touch the Z88:

- `test/memory/partition-descriptions.test.ts` (uses `Z88TestMachine`)
- `test/audio/AudioIntegration.test.ts` (`Z88BeeperDevice` with mocks)
- `test/common/machine-inject-support.test.ts`
- the Z88 dialog MVC suites under `test/dialogs/z88/`, which use port fakes and never touch the core

There are **no** AMD flash, keyboard, screen, interrupt/snooze, flap or ROM-boot tests today.

`test/z88/Z88TestMachine.ts` calls `super({} as Store, model, {})`. That does not match
`(model, config, messenger)`, so every test runs with the fallback defaults (512K internal RAM, a
512K placeholder ROM, no ROM loaded). Step 0.3 makes that effective configuration explicit so the
expectations do not move.

### TypeScript oracle defects found by the inventory

Each defect has a decision. **Emulation behaviour is ported verbatim** so parity tests stay
meaningful. It is fixed later in both cores, with hardware evidence (see "Follow-ups"). **Host
defects** that would make tests or the adapter unreliable are fixed in Step 0 for both backends.

| Defect | Kind | Decision |
|---|---|---|
| `checkMaskableInterruptRequested` uses `INT & STA`, but the bits do not line up: STA.TIME (0x01) meets INT.GINT, and STA.FLAPOPEN (0x80) meets INT.KWAIT | emulation | Port verbatim. Record it in `wasm/README.md`. Follow-up F1. |
| `getSelectedRomPage()` / `getSelectedRamBank()` throw; `MainToEmuProcessor.getMemoryContents()` calls them through `?.()`, which does not stop a throw | host | Fix in Step 0.1 (the shared host answer). |
| `configure()` does not await `handleSlot()`; slot cards finish loading after it returns | host | Fix in Step 0.1. The WASM adapter awaits too. |
| `EPROMUV256` is offered by the UI but `createZ88MemoryCard` throws | card catalogue | Keep identical in both. Follow-up F2. |
| `MC_Z88_INTROM` holds a ROM name in config but the ROM size as a machine property | host | Keep; both backends set the property the same way. |
| `getDisassemblySections` uses Spectrum address ranges | host | Move verbatim into shared `z88MachineInfo.ts`. Follow-up F3. |
| Code injection is a stub although `MF_INJECT_SUPPORT` is `true` | host | Keep the stub in the shared host. Follow-up F4. |

## Target Architecture

### Files

```
src/emu/machines/z88/
  Z88Machine.ts                  TypeScript oracle (kept; imports the neutral modules below)
  Z88Implementation.ts           "typescript" | "wasm" switch, DEFAULT_Z88_IMPLEMENTATION
  Z88MachineFactory.ts           createZ88Machine(model, config, messenger)
  z88MachineInfo.ts              neutral: clock, frame, ROM/keyboard defaults, partitions, disassembly sections
  z88CardCatalog.ts              neutral: CardType codes, CT_*/CARD_SIZE_*, card sizes, chip masks, internal RAM size
  memory/CardIds.ts, memory/CardSlotState.ts   neutral already (the dialogs use them); unchanged
  IZ88IdeMachine.ts              neutral IDE interface: getBlinkState(), isZ88IdeMachine()
  IZ88DeviceHost.ts              TypeScript-only: IZ88Machine + memory and devices, for the TS devices/cards
  Z88WasmHost.ts                 abstract host on Z80MachineBase (no TS Z88 device)
  Z88WasmV2Machine.ts            the adapter
  wasm/
    README.md
    Z88WasmV2Loader.ts
    z88/z88.c                    translation unit: state, includes, exports
    z88/z88-memory.c             4 MB physical, page table, SR0-3, RAMS, mirroring, empty-slot LFSR
    z88/z88-cards.c              RAM/ROM/UV EPROM/Intel flash/AMD flash state machines
    z88/z88-blink.c              COM/INT/STA/ACK/TACK/TMK/EPR, interrupt line, RTC
    z88/z88-keyboard.c           8x8 matrix, KBD read, key interrupt, awake
    z88/z88-screen.c             LCD renderer
    z88/z88-beeper.c             oscillator, sample scheduling, DC filter, int16 stereo
    dist/cambridge-z88.wasm      build output (git-ignored)
scripts/build-z88-wasm.cjs, build-z88-wasm.d.cts, check-z88-wasm-size.cjs
```

`CardType.ts` keeps only the TypeScript factory, `createZ88MemoryCard`, which imports the TS card
classes. Everything neutral moves to `z88CardCatalog.ts` (done in Step 0.1). That way the WASM side
can use the card vocabulary without pulling TypeScript emulation into its import graph.

### Class chain

```
Z80Cpu (register mirror only) → Z80MachineBase → Z88WasmHost → Z88WasmV2Machine
Z80Cpu → Z80MachineBase → Z88Machine        (TypeScript oracle, unchanged role)
```

`Z88WasmHost` must not import `Z88Machine`, `Z88BlinkDevice`, `Z88ScreenDevice`,
`Z88KeyboardDevice`, `Z88BeeperDevice`, `Z88BankedMemory` or any `memory/*Card.ts`. It may import
`z88MachineInfo.ts`, `z88CardCatalog.ts`, `Z88KeyCode.ts`, `Z88KeyMappings.ts` and the
`IZ88*` interfaces. A separation test enforces this (Step 2).

`IZ88Machine` (`src/renderer/abstractions/IZ88Machine.ts`) is slimmed so both classes can implement
it:

- **Removed from the interface:** `memory: Z88BankedMemory` and the four device members. They stay
  on `Z88Machine` as class members, and the TypeScript devices and cards reach them through
  `IZ88DeviceHost` (`IZ88Machine` + those members), which only the TypeScript emulation uses.
- **Kept:** `signalFlapOpened`, `signalFlapClosed`, `isInSleepMode`, `isOsInitialized`,
  `directReadMemory`, `getAudioSamples` (`dynamicConfig` and `configure` come from `IAnyMachine`).

### C machine shape (mirrors `sp48.c`)

- **Prefix `z88` everywhere.** `z80.c` defines register macros (`A`, `F`, `HL`, `IX`, …) and fixed
  `z80*` names, so Blink state is named `z88BlinkCom`, `z88BlinkInt`, `z88BlinkSta`, and so on,
  never bare `COM`, `INT` or `STA`.
- **Static state:**
  - `z88Memory[0x400000]` (4 MB physical)
  - `z88PixelBuffer[800 * 480]` (`uint32_t`, sized for the largest LCD)
  - `z88AudioSamples[...]` (int16 stereo)
  - `z88KeyboardLines[8]`
  - the page table (8 entries: physical offset, slot, card kind, fast-path flag)
  - per-slot card descriptors (kind, size, chip mask, flash/EPROM command state)
- **Linear memory.** Start with 8 MiB. That fits 4 MB plus 1.5 MB of pixels plus audio and stack;
  a `_Static_assert` on the summed buffer sizes keeps it honest. Raise it to 16 MiB only if the
  assert fires, and record why in the build script.
- **Frame lifecycle.** `z88BeginFrame()` does the TypeScript `onInitNewFrame` work in the **same
  order**:
  1. RTC increment
  2. KWAIT awake
  3. LCD render, only when `frames % 8 == 0`
  4. sleep detection
  5. beeper new-frame
- **`z88ExecuteInstruction()`:**
  1. Begin a frame if the previous one completed.
  2. `z80SetSigInt(z88BlinkInterruptSignalActive)`.
  3. If snoozed, run one snooze cycle (16 tacts); otherwise run `z80ExecuteCpuCycle()` until
     `z80GetPrefix() == NONE`.
  4. After-instruction work: awake if any key is down, then the oscillator bit.
  5. Detect frame completion and preserve the overshoot.
- **`z88ExecuteFrame()`** loops `z88ExecuteInstruction()` with bus-event capture off. `setTacts`
  never realigns the frame origin.
- **Per-tact audio.** `Z80_TACT_PLUS_N(n)` advances `z88Tacts` and does the TypeScript
  `setNextAudioSample` work. It uses integer sample scheduling with a fast "no sample due" guard;
  see the performance plan's audio lessons, including 64-bit threshold math.
- **Memory hooks.** `Z80_READ_MEMORY` / `Z80_WRITE_MEMORY` go through the page table. The fast path
  is a direct `z88Memory[offset]` access when the page's card is RAM, ROM or flash in read-array
  mode. Anything else, including an empty slot, dispatches to `z88-cards.c` / the LFSR. The default
  3-tact memory delays and 4-tact port delays are kept, because the Z88 has no contention (confirm
  against `Z88Machine`/`Z80MachineBase` in Step 5).
- **Port hooks.** `Z80_READ_PORT(address)` / `Z80_WRITE_PORT(address, value)` receive the full
  16-bit address, which the KBD high-byte select and the PB0-3/SBR high byte need.
- **Screen reads** use absolute `z88Memory` reads, exactly like `directReadMemory`, so flash command
  mode never changes the display.

### Shared CPU Contract (`src/emu/z80/wasm/z80.c`)

The Z88 defines these hooks before `#include "../../../../z80/wasm/z80.c"`:

- `Z80_EXTERNAL_BUS`
- `Z80_MEMORY_PTR()`, `Z80_READ_MEMORY`, `Z80_WRITE_MEMORY`, `Z80_POKE_MEMORY`
- `Z80_READ_PORT`, `Z80_WRITE_PORT`
- `Z80_TACT_PLUS_N`
- `Z80_CAPTURE_BUS_EVENTS()`

It leaves the delay hooks at their defaults unless Step 5 shows the oracle adds delays. It does not
define `Z80_WRITE_TBBLUE`, `Z80_FETCH_CODE_BYTE` or `Z80_AFTER_OPCODE_FETCH` (Next only). It never
calls `z80SetZ80NMode`.

**The only planned core extension is snooze** (Step 0.4, done: `z80SnoozeCpu`, `z80AwakeCpu`,
`z80IsCpuSnoozed`, `z80SnoozeCycle`). Any other gap found later follows the
same rule:

1. Add it to `z80.c` as a generic facility that mirrors `Z80Cpu.ts`.
2. Cover it in `test/wasm/z80/`.
3. Rebuild and test sp48, sp128, spp3e and zxnext.

Never fork the core.

### Adapter shape (mirrors `ZxSpectrum48WasmV2Machine`)

- **`setup()`:**
  1. Load the module.
  2. Set the LCD size from `MC_SCREEN_SIZE` and internal RAM from `MC_Z88_INTRAM`.
  3. Load the slot 0 ROM or card image through the host's `loadRomFromResource` /
     `loadRomFromFile`, copy it into the physical-memory view at slot 0, and call
     `z88InsertCard(0, kind, sizeK)`.
  4. Set the keyboard-layout setting (host).
  5. `await configure()`.
  6. Hard-reset the core.
  7. Sync the CPU.
- **`configure()`** awaits each slot 1-3 file load, uploads the bytes into the slot's physical
  region, and calls `z88InsertCard` / `z88RemoveCard`. It keeps the TypeScript validation: the
  content length must equal the card size, or it throws.
- **Normal frame:**
  1. `emulateKeystroke()` (host queue).
  2. Sync the keyboard lines that changed, using `z88SetKeyStatus`. That call performs the key
     interrupt and awake side effects in C.
  3. Sync the sample rate and clock multiplier.
  4. `z88ExecuteFrame()`.
  5. Sync the frame counters.
- **Debug path.** A copy of `executeWasmV2DebugLoop` that uses `shouldStopAtDebugPoint`,
  `z88GetStepOutAddress` and access-breakpoint-gated bus import. A snooze cycle counts as one
  executed instruction, as it does in `MachineFrameRunner`.
- **Screen.** `getPixelBuffer()` and `getPixelBufferBytes()` are zero-copy views.
  `screenWidthInPixels` / `screenHeightInPixels` come from core exports, not constants.
  `renderInstantScreen` calls `z88RenderScreen`.
- **Audio.** `getAudioSamples()` converts the int16 view (`/ 32768`) into a reused array.
- **IDE.**
  - `getBlinkState()` (`IZ88IdeMachine`) comes from core getters.
  - Partitions, labels, descriptions and disassembly sections come from `z88MachineInfo.ts`.
  - `get64KFlatMemory()` and `getMemoryPartition(i)` come from the core's page table.
  - `directReadMemory` is a view read.
- **Custom commands** stay in the host and call core exports: `z88SignalFlapOpened`,
  `z88SignalFlapClosed`, `z88RaiseBatteryLow`, and key setters for `press_shifts`.

### Machine menu during the comparison period

The machine menu is flat (`src/main/app-menu.ts`, the model loop). Doubling ten Z88 entries would
bury it, so:

- Add an optional `menuGroup?: string` to `MachineModel` (`src/common/machines/info-types.ts`).
  `app-menu.ts` renders models that share a `menuGroup` as one submenu, placed after the ungrouped
  models of that machine. Checked state and `setMachineType` work unchanged.
- **The existing ten model ids never change** and carry no implementation key, so saved projects
  keep working. They follow `DEFAULT_Z88_IMPLEMENTATION`.
- **Before the default flip** (Steps 3-13): `DEFAULT_Z88_IMPLEMENTATION = "typescript"`. A
  `"Cambridge Z88 (WASM preview)"` submenu holds ten twins, `<modelId>-wasm`, with
  `[MC_Z88_IMPLEMENTATION]: "wasm"`.
- **At the flip** (Step 14): the default becomes `"wasm"` and the preview submenu is removed. A
  `"Cambridge Z88 (TypeScript)"` submenu holds ten twins, `<modelId>-ts`, with
  `[MC_Z88_IMPLEMENTATION]: "typescript"`. A saved `<id>-wasm` model id resolves to `<id>`, through
  an alias in `MachineService`'s model lookup plus a test. The TypeScript submenu stays until the
  separate removal plan.
- **The factory reads the key per key, with a fallback:**
  `config?.[MC_Z88_IMPLEMENTATION] ?? model?.config?.[MC_Z88_IMPLEMENTATION]`.

  This matters because the Z88's config paths are varied:
  - the LCD menu rebuilds from `getModelConfig()`;
  - the RAM and slot-0 dialogs pass a whole config to `setMachineType`;
  - hot-plug spreads the store config.

  A per-key fallback makes a backend switch impossible to lose. The Next's `config ?? model.config`
  would lose it as soon as a dialog supplied a config without the key.
- **Machine-specific menus** (cards, LCD, keyboard layout, reset, battery) are keyed by `MI_Z88`,
  so they work for every twin without change.

## Test Strategy

The user requirement is: *"the migrated machine has tests just like the old implementation"*.

1. **Every existing Z88 core suite runs on both backends.**
   - `test/z88/z88-backends.ts` defines `Z88TestSurface`: the members the suites use today. These
     are `chipMask0-3`, `chipMaskIntRam`, `s{0-3}Offset{L,H}`, `s{0-3}Type{L,H}`, `setSR0-3`,
     `directMemoryRead/Write`, the RTC hooks (`resetRtc`, `incrementRtc`) and the Blink register
     get/set members that `rtc.test.ts` touches.
   - It also defines `Z88_BACKENDS = [typescript, wasm]`.
   - The TypeScript implementation wraps `Z88TestMachine` and hands out the real TypeScript card
     classes (`m.cards.ram(size)`, `m.cards.intelFlash(size)`, ...) and Blink device (`m.blink`).
     The WASM one will wrap a `TestZ88WasmMachine` whose card objects are handles on core state,
     using test-only core exports: `z88GetChipMask(slot)`, `z88GetPageOffset(page)`,
     `z88GetPageBank(page)`, `z88GetPageCardType(page)`, `z88GetSlotCardType(slot)`,
     `z88GetFlashReadArrayMode(slot)`, `z88TestIncrementRtc`, and so on. These are in the build
     allow-list but not in the loader's required list, following the `sp48` diagnostic-export
     pattern.
   - Each suite's top-level `describe` becomes `describe.each(Z88_BACKENDS)`. **Assertions do not
     change.** The 887 cases become 1,774.
   - A case that cannot run on WASM must be listed in `test/z88/README.md` with its reason. The
     target is zero.
2. **The other shared suites gain a WASM row.** `partition-descriptions` gets a Z88 WASM machine.
   The `AudioIntegration` Z88 case gets a sibling that drives the real WASM core through COM writes
   instead of mocks.
3. **New behaviour tests run on both backends.** They cover what has no test today: AMD flash
   (unlock sequence, program, sector/chip erase, autoselect, toggle-bit status), keyboard matrix and
   KBD reads, key interrupt, snooze/awake, flap, battery low, sleep detection, LCD rendering per
   size, and beeper samples. Expectations come from the Z88 documentation (Blink/OZ developer notes)
   where it exists; otherwise from the TypeScript oracle, with a comment saying so.
4. **Parity oracle tests** (`test/wasm/z88/`) run the same thing on both backends and compare
   through public APIs:
   - CPU registers, tacts and frames
   - Blink state (`getBlinkState()`)
   - a hash of the 4 MB of physical memory
   - the pixel buffer
   - audio samples, within one LSB of int16
   - the IDE surfaces: partitions, labels, `get64KFlatMemory`, and the Blink panel state (PAR-006
     lesson)

   The scenarios are: each of the ten ROMs booted for N frames; synthetic Z80 programs; card
   hot-plug and flash programming from Z80 code; all five LCD sizes.
5. **WASM infrastructure tests**, the same set the 48K/128K have:
   - build (profile, allow-list, size ceiling, packaged resource path, instantiation)
   - loader (required exports, view bounds, module cache, missing-export rejection)
   - factory and registry (default, explicit values, unknown value, per-key fallback, menu groups,
     `-wasm` alias)
   - adapter (setup, reset, one frame, memory, keyboard sync, pixel view, audio count, debug step,
     `getCpuState` freshness)
   - debug step (step-into, step-over on CALL/RST/HALT, step-out through interrupt, snooze step)
   - the shared-CPU contract entry
   - the import-graph separation test
6. **A dual-backend session helper.** `test/harness/z88/`, patterned after `test/harness/zxnext`:
   `createZ88Session({ backend, model })` with `loadCode`, `runFrames`, `step`, `runTo`,
   `peek/poke`, `physPeek`, `in/out`, `keyDown/keyUp`, `registers`, `blinkState`, `pixel`, `screen`
   and `audio`. Parity and behaviour tests use it rather than reaching into `machine`. It has its
   own self-tests on both backends.

Instantiation cost: many existing cases construct a fresh machine. The WASM test factory reuses the
cached compiled module and instantiates synchronously (`new WebAssembly.Instance`). Measure the
suite time in Step 4. If it is too slow, pool one instance per suite and hard-reset between cases,
but only after one test proves that a hard-reset instance and a fresh instance are byte-identical
(all linear memory except the stack).

## Work Items

Each step compiles on its own, has focused tests, and says what is usable afterwards. The default
stays `"typescript"` until Step 14. Status markers follow the 128K plan.

### Step 0.1 - Neutral modules and host fixes (TypeScript only)

Status: Done on 2026-09-19.

- `z88MachineInfo.ts` and `z88CardCatalog.ts` exist; `Z88Machine`, `CardType.ts`, the card classes
  and `Z88BankedMemory` use them. `CardIds.ts`/`CardSlotState.ts` were already neutral and stay.
  The catalog also owns `z88InternalRamSizeInBytes` (the `MC_Z88_INTRAM` mask rule), which the
  WASM setup needs too.
- `getSelectedRomPage` / `getSelectedRamBank` answer 0, as the ZX Spectrum 48K does.
- `configure()` settles only after every slot has settled (`Promise.allSettled`), then rethrows the
  first failure. So one bad card file no longer leaves the other slots half-loaded, and a failed
  hot-plug now reaches the insert-card dialog's controller instead of being an unhandled
  rejection.
- Tests: `test/z88/z88-host.test.ts`, `test/z88/z88-neutral-modules.test.ts`.

Original scope:

- Extract `z88MachineInfo.ts` (clock, tacts per frame, `uiFrameFrequency`, partition
  labels/groups/descriptions, `parsePartitionLabel`, disassembly sections verbatim) and
  `z88CardCatalog.ts`. `Z88Machine`, `z88Cards.ts` and the dialogs import from them.
- Make `getSelectedRomPage` / `getSelectedRamBank` non-throwing. The Z88 has no Spectrum ROM page
  or RAM bank; return the value `MainToEmuProcessor.getMemoryContents()` treats as "not
  applicable". Add a test that fetches memory contents on a Z88.
- Make `configure()` await slot loading. Add a test that a slot card is readable as soon as
  `configure()` resolves.
- Usable afterwards: the same TypeScript Z88, with two host bugs fixed.
- Validation: `test/z88`, `partition-descriptions`, `test/dialogs/z88`, `build:check`,
  `lint:renderer`.

### Step 0.2 - Backend-neutral IDE surface

Status: Done on 2026-09-19.

- `IZ88IdeMachine` / `isZ88IdeMachine` in `src/emu/machines/z88/IZ88IdeMachine.ts`;
  `Z88Machine.getBlinkState()`; `MainToEmuProcessor.getBlinkState()` uses the guard and keeps the
  "BLINK device is not available" error for other machines.
- `IZ88Machine` no longer exposes memory or devices. The TypeScript devices and cards were typed on
  `IZ88Machine` and reach `memory`/`blinkDevice`/... through it, so they now use the new
  TypeScript-only `IZ88DeviceHost`. The renderer consumers (`Z88ToolArea`, `z88Cards`,
  `useZ88Ports`) needed no change.
- Tests: the Blink-state cases in `test/z88/z88-host.test.ts` (through the real message processor).

Original scope:

- Add `IZ88IdeMachine { getBlinkState(): BlinkState }`, implemented by `Z88Machine`.
  `MainToEmuProcessor.getBlinkState()` uses it instead of the `any` cast.
- Slim `IZ88Machine` as described above. Fix any consumer that relied on the removed members; the
  inventory found only the `any` cast.
- Validation: the Blink panel still shows the same state (test through `getBlinkState` on a machine
  whose registers were set through ports), plus `lint:renderer`.

### Step 0.3 - Backend-parameterized tests and the Z88 session helper

Status: Done on 2026-09-19.

- `test/z88/z88-test-surface.ts` (`Z88TestSurface`) and `test/z88/z88-backends.ts`
  (`Z88_BACKENDS = [typescript]`). The six suites run through `describe.each`; still 887 cases.
  No assertion changed except in the paging suite's "constructor works" test, which inspected
  `instanceof`/`bankData` and now asks `slotCardType`/`pageBank`/`pageOffset`/`pageCardType`.
- `Z88TestMachine` passes `(model, Z88_TEST_CONFIG, undefined)`: the same effective machine as
  before, stated explicitly.
- `test/harness/z88/` (README, `createZ88Session`, `Z88_HARNESS_BACKENDS = ["typescript"]`,
  self-tests). New session suites, each looping over the harness backends: `z88-keyboard` (13),
  `z88-interrupts` (10), `z88-lcd` (19), `z88-beeper` (6), `z88-sleep-and-boot` (14, including
  all ten ROMs booting to the Index screen), plus `memory-amdflash-io` (13) on `Z88_BACKENDS`.
- Z88 cases now: 887 original + 85 per-backend new (these will double when WASM joins) + 56
  host/neutral-module cases = 1,028, all passing on TypeScript. `test/z88/README.md` lists cases
  that do not run on a backend: none.
- The suites pin three oracle behaviours the WASM core must reproduce: defect F1 (an open flap
  with INT.KWAIT keeps the interrupt line active), the unpainted last 4 pixels of a 640-pixel row
  of LORES cells, and the snoozing `$B2` read answering `$FF` at once.

Original scope:

- Add `Z88TestSurface`, with `Z88_BACKENDS` holding only `typescript` for now. Convert the six
  suites to `describe.each`, keeping assertions identical.
- Fix the `Z88TestMachine` constructor call and pass the effective defaults explicitly: 512K
  internal RAM, a 512K placeholder ROM card in slot 0, and no ROM load. The case count stays 887,
  and every assertion is unchanged.
- Add `test/harness/z88/` (TypeScript backend only), its self-tests, and the new behaviour tests
  from Test Strategy item 3, running on TypeScript. This locks the oracle's behaviour before C
  exists.
- Validation: the case count is at least 887 plus the new cases; all pass.

### Step 0.4 - Extend the shared Z80 core with snooze

Status: Done on 2026-09-19.

- `z80.c`: `cpu.snoozed` (cleared by `z80Reset`), `z80SnoozeCpu`, `z80AwakeCpu`,
  `z80IsCpuSnoozed`, `z80SnoozeCycle` (16 tacts through `tactPlusN`, as one step - the TypeScript
  `tactPlusN(16)` also calls `onTactIncremented()` once). The core never sets or checks the flag
  itself.
- `test/z80/snooze.test.ts`, copied literally to `test/wasm/z80/snooze.test.ts`; the standalone
  core exports the four functions and the WASM test CPU wrapper maps them to the `Z80Cpu` names.
- `check-wasm-cpu-contract.cjs` requires the four signatures.
- All four artifacts rebuilt under their ceilings (sp48 201,247; sp128 318,845; spp3e 225,236;
  zxnext 419,586 bytes: the new functions are not exported, so the linker drops them). Green:
  `test/z80`, `test/wasm`, `test/zxSpectrum`, `test/emu` (5,739), `test/zxnext-hw`,
  `test/zxnext`, `test/harness/zxnext` (5,147), and the WASM Z80 corpus (1,470).
- Found on the way: `test/wasm/z80/next-ops.test.ts` was a stale copy (#1355 had updated the
  source to the VHDL carry behaviour of `ADD rr,A` and `LDWS`, and `z80.c` already implemented
  it), so six corpus cases failed on `HEAD`. Re-copied; every corpus file matches its source again.

Original scope:

- In `z80.c`, add `cpu.snoozed` plus `z80SnoozeCpu()`, `z80AwakeCpu()`, `z80IsCpuSnoozed()` and
  `z80SnoozeCycle()`. The snooze cycle adds 16 tacts through the `Z80_TACT_PLUS_N` path, so
  per-tact hooks such as audio fire, exactly as `Z80Cpu.onSnooze()` → `tactPlusN(16)` does.
  `z80Reset` clears the flag, matching `Z80Cpu.reset()`.
- Tests: a new `test/wasm/z80/snooze.test.ts` against the standalone core, plus a TypeScript
  `test/z80/snooze.test.ts` asserting the same contract on `Z80Cpu`.
- Add the snooze symbols to `check-wasm-cpu-contract.cjs`.
- Rebuild sp48, sp128, spp3e and zxnext, and run their WASM test folders and the Z80 corpus
  (`npx vitest run --config test/wasm/vitest.z80.config.ts`). Their sizes must stay under their
  ceilings.

### Step 1 - Build, packaging, loader and C skeleton

Status: Done on 2026-09-19.

- `scripts/build-z88-wasm.cjs` (+ `.d.cts`) builds `src/emu/machines/z88/wasm/z88/z88.c` into
  `src/emu/machines/z88/wasm/dist/cambridge-z88.wasm`: clang wasm32, `speed`/`size`/`lto` profiles,
  8 MiB fixed linear memory (`z88.c` has a `_Static_assert` that 4 MB of memory + the 800x480 pixel
  buffer + audio + 512K of headroom fit), export allow-list, stale-artifact cleanup, packaged to
  `wasm/z88`.
- **Build lock.** Test workers build the artifact in parallel, so real builds of the production
  artifact hold a lock file (`scripts/wasm-build-lock.cjs`, a neutral copy of the Next build's lock
  logic; the Next script keeps its own copy), and readers call `waitForZ88WasmBuildLock()`.
  `z88WasmArtifactBytes()` (in `test/harness/z88/core/machines.ts` since Step 2) builds once per
  worker and reads under the lock.
- `scripts/check-z88-wasm-size.cjs` (+ `.d.cts`): a **provisional** ceiling of 700,000 bytes (the
  Next's) until Step 12 measures the real machine. The skeleton is 1,479 bytes, because nothing
  calls the CPU yet, so the linker drops the shared core. The "larger than the standalone Z80 core"
  sanity rule therefore starts to apply in Step 5, once the frame loop runs the CPU.
- `package.json`: `build:z88-wasm`, `check:z88-wasm-size`, Z88 added to `build:all-wasm` (so every
  platform build compiles it), `extraResources` entry.
- `z88.c` + `z88-memory.c`: static buffers (4 MB physical memory, 800x480 pixels, audio, 8 key
  lines), `z88Reset` (CPU, counters, pixels, key lines, audio; memory kept) and `z88HardReset`
  (also clears memory), `z88SetLcdSize(scw, sch)` with the `Z88ScreenDevice` size rule (invalid
  values select 640x64), clock/frame constants, and the six `z88GetCpu*` getters the contract
  requires. The shared `z80.c` is included behind the `Z80_*` hooks; memory reads `$FF` and ports
  are stubs until Steps 4-6, as the README and file headers say. **Nothing emulates a Z88 yet.**
- `Z88WasmV2Loader.ts`: module cache per artifact name (each load a fresh instance),
  required-export validation (`z88WasmV2RequiredExports`, which the build allow-list must cover),
  bounds-checked views. The pixel view covers the whole 800x480 buffer; the adapter will use the
  first width x height words of it.
- `check-wasm-cpu-contract.cjs`: the list is now `wasmCpuContract` (not Spectrum-only) and includes
  `z88`. New rule `forbiddenIncludeFragments`: every `.c`/`.h` in the Z88 source folder is scanned,
  and any `zxSpectrum/wasm/common/` include fails the contract (checked by planting one). Added
  `check-wasm-cpu-contract.d.cts`, which also cleared the contract test's old implicit-any errors.
- Tests: `test/z88/z88-wasm-build.test.ts` (14), `test/z88/z88-wasm-v2-loader.test.ts` (21), and
  the updated `test/wasm/wasm-shared-z80-cpu-contract.test.ts`.
- Usable afterwards: a loadable, validated Z88 core with nothing behind it. The TypeScript Z88 is
  still the only backend a user can run.

Original scope:

- `scripts/build-z88-wasm.cjs` / `.d.cts`: clang wasm32, speed profile, `size`/`lto` profiles,
  `productionExports` allow-list, stale-artifact cleanup, `packagedResourceDirectory = "wasm/z88"`.
- `scripts/check-z88-wasm-size.cjs`: the ceiling is set from the first real build (Step 12) and the
  reason is recorded. Sanity rule: the artifact must be larger than the standalone Z80 test core.
  A smaller one means a device is stubbed (the Next lesson).
- `package.json`: `build:z88-wasm`, `check:z88-wasm-size`, add Z88 to `build:all-wasm`, and add the
  `extraResources` entry.
- `z88.c`: static buffers, pointer exports, reset, and shape exports (screen width/height from the
  LCD configuration).
- `Z88WasmV2Loader.ts`: artifact `cambridge-z88.wasm`, module cache, required-export validation,
  typed views (`memory` 4 MB physical, `pixelBuffer`, `pixelBufferBytes`, `audioSamples`,
  `keyboardLines`) with bounds checks.
- Add `z88` to the CPU contract list (renamed `wasmCpuContract`). The contract test asserts the Z88 includes the shared
  `z80.c` and **none** of the Spectrum device sources, and the explicit model list becomes
  `["sp48","sp128","spp3e","zxnext","z88"]`. Rename the test's wording from "Spectrum" to "WASM
  machines".
- Tests: `test/z88/z88-wasm-build.test.ts`, `test/z88/z88-wasm-v2-loader.test.ts`.

### Step 2 - Host and adapter skeleton, with the separation guard

Status: Done on 2026-09-19.

- **Neutral rules, shared by both hosts** (and the TypeScript code now uses them too):
  `z88LcdSizeRegisters` (`MC_SCREEN_SIZE` -> SCW/SCH; `Z88ScreenDevice.reset()` calls it),
  `z88CardSpec` (card-type id + size -> kind and byte size, with `createZ88MemoryCard`'s order and
  errors; the factory now switches on it), `z88RomImageCardSpec` and `z88SlotHasCard` (`Z88Machine`
  uses it). A test checks `z88CardSpec` against the TypeScript card factory for every card id and
  size, and `z88LcdSizeRegisters` against the TypeScript screen device.
- `Z88WasmHost` (abstract, on `Z80MachineBase`, implements `IZ88Machine` and `IZ88IdeMachine`):
  identity, clock and frame, `uiFrameFrequency`, `softResetOnFirstStart`, partitions, disassembly
  sections, key codes and mapping, the keystroke queue (anchored to the current tact, as the
  TypeScript Z88's is - not the Next's chained queue), the machine-menu commands, the code-injection
  stub, and the whole setup/configure/hard-reset algorithm of `Z88Machine`: slot 0 (card or ROM
  image), `MC_Z88_INTROM`/`MC_Z88_USE_DEFAULT_ROM`, the keyboard-layout setting, slots 1-3 with
  `allSettled`, and the image-length check. The backend supplies `prepareBackend`,
  `insertCardIntoBackend`, `removeCardFromBackend`, `raiseBatteryLow` and the device surfaces.
- `Z88WasmV2Machine`: loads the core once; a new core starts with the blank 512K ROM card in
  slot 0 (as `Z88BankedMemory` does); sizes the LCD from the configuration and exposes the LCD part
  of the pixel buffer as zero-copy views; places card images in physical memory and records each
  slot's card; records the internal-RAM size from `MC_Z88_INTRAM`; mirrors the registers the core
  exports; `loadBlankCore()` for the harness's blank machines. Everything that needs later steps
  throws `Z88WasmNotMigratedError` naming its step (memory map 4, frame loop 5, Blink/ports/flap/
  battery 6, keyboard 7, instant render 8, beeper 9).
- **Core fix found here:** `z88HardReset` cleared all 4 MB; the TypeScript hard reset clears only
  the internal RAM (`resetInternalRam`: $080000-$0FFFFF) and card contents survive. The core now
  matches, and the loader test says so.
- The harness can create a WASM machine (`createHarnessZ88Machine({ backend: "wasm" })`), but
  `Z88_HARNESS_BACKENDS` stays `["typescript"]` until the core runs code.
- Tests: `test/wasm/z88/wasm-z88-separation.test.ts` (6: prototype chain, import graph from the
  machine, host and loader, type imports included, neutral modules reached, the detector's own
  positive check, no TypeScript device built; checked by planting a type import, which it caught
  with the full chain), `test/wasm/z88/wasm-z88-machine.test.ts` (62: identity and metadata vs the
  TypeScript machine, setup of all ten models vs the TypeScript machine - slot-0 banks, ROM
  properties, keyboard-layout message - the five LCD sizes, card hot-plug/removal/errors vs the
  TypeScript machine, hard reset and reset, keystroke queue and menu commands, and the table of
  not-migrated surfaces), plus the new cases in `z88-neutral-modules.test.ts`.
- Usable afterwards: a WASM Z88 that sets up exactly like the TypeScript one and says clearly what
  it cannot do yet. It still does not run.
- **Consequence for Step 3:** a preview menu entry would now create a machine whose frame loop
  throws. Step 3 should build the switch, the factory and the grouped menu with their tests, but
  register the `-wasm` preview twins only once Step 5 makes the machine run.

Original scope:

- `Z88WasmHost` on `Z80MachineBase`: machine id, clock, `uiFrameFrequency`,
  `softResetOnFirstStart`, partitions via `z88MachineInfo`, the keystroke queue, key code set and
  mapping, the custom-command dispatch, the code-injection stub, and ROM/card file loading.
- `Z88WasmV2Machine`: loads the runtime, then setup/reset/hardReset and a CPU mirror sync.
- `test/wasm/z88/wasm-z88-separation.test.ts`, copied from the Next separation test: walk the import
  graph from `Z88WasmV2Machine.ts`, type imports included, and walk the prototype chain. Fail on any
  TypeScript Z88 emulation module (`Z88Machine`, `Z88*Device`, `Z88BankedMemory`, `memory/*Card*`,
  `CardType.ts`).

### Step 3 - Implementation switch, factory and menu groups

Status: Done on 2026-09-19 (the preview twins were registered with Step 9 - see there).

- `MC_Z88_IMPLEMENTATION = "z88Implementation"` (`constants.ts`). `Z88Implementation.ts`:
  `DEFAULT_Z88_IMPLEMENTATION = "typescript"`, `getZ88Implementation(config, model)` with the
  per-key fallback (configuration's key, else the model's, else the default; unknown values select
  the default). `Z88MachineFactory.ts`: `createZ88Machine(model, config, messenger)`. The renderer
  registry now creates the Z88 through it, so the WASM machine is part of the app bundle. (Vite
  inlines the 1.5 KB skeleton artifact as a data URL - its standard treatment of assets under 4 KB;
  once the core grows past that it is emitted as a hashed file like the other cores, and
  `extraResources` packages `dist/` regardless.)
- `MachineModel.menuGroup` (`info-types.ts`). The machine-type items of the Machine menu moved out of
  `app-menu.ts` into the pure `src/main/machine-types-menu.ts` (`createMachineTypesMenu`), which
  lists models sharing a `menuGroup` in one submenu after the machine's ungrouped models; item ids
  and checked state are unchanged, and `app-menu.ts` keeps its selection behaviour (the scanline
  switch-off only for machines with models). Nothing in the registry has a group yet, so the menu
  looks exactly as before.
- `src/common/machines/model-twins.ts`: `createModelTwins(models, { configKey, implementation,
  menuGroup, idSuffix, nameSuffix })` derives the comparison twins (explicit backend key, own menu
  group, original ids untouched). **Not registered yet**: a preview entry would create a machine
  whose frame loop throws. Step 5 registers the `-wasm` twins ("Cambridge Z88 (WASM preview)");
  Step 14 replaces them with the `-ts` twins.
- The harness's machine helper was renamed `createHarnessZ88Machine`, freeing the name for the
  factory.
- Tests: `test/z88/Z88MachineFactory.test.ts` (16: default, explicit values, unknown values,
  per-key fallback, model/config handed to the WASM machine, the renderer registry, the key
  surviving the slot-0 dialog (`configWithSlot0`), hot-plug (`applyCardStateChange`), the RAM
  dialog and LCD menu spreads, registered models selecting no backend, no `-wasm` model yet, twin
  derivation), `test/main/machine-types-menu.test.ts` (5: layout and ids, group submenus, checked
  state inside groups, selection, the real menu still flat). `machine-inject-support` and the
  other `test/main`, `test/common`, `test/controls`, `test/dialogs` suites pass.
- Found on the way (not fixed here, offered as a separate task): the Z88 LCD menu mutates the
  registered model's configuration object (`getModelConfig` returns it, and the handler assigns
  `MC_SCREEN_SIZE` into it).
- Usable afterwards: the app creates every Z88 through the factory, still on TypeScript; the
  machinery to list and select the WASM backend exists and is tested.

Original scope:

- `MC_Z88_IMPLEMENTATION = "z88Implementation"` in `constants.ts`. `Z88Implementation.ts` sets
  `DEFAULT_Z88_IMPLEMENTATION = "typescript"`. `Z88MachineFactory.ts` uses the per-key fallback.
  The renderer registry uses the factory.
- `MachineModel.menuGroup` and the grouped rendering in `app-menu.ts`. Add ten `<id>-wasm` twins in
  the `"Cambridge Z88 (WASM preview)"` group.
- Tests:
  - factory selection: default, explicit `"wasm"`, explicit `"typescript"`, unknown value, and the
    key present only in the model config
  - the key surviving each config path: LCD menu, change RAM, insert card in slot 0, hot-plug slot 2
  - the grouped menu build
  - `machine-inject-support` still passes
- Usable afterwards: the preview entries appear and instantiate a machine that does not run yet.

### Step 4 - Memory, paging and cards (RAM/ROM)

Status: Done on 2026-09-19.

- `z88-memory.c`: the 8-page table (offset, bank, card), `z88SetMemoryPageInfo` /
  `z88RecalculatePages` / `z88BankOffset` ported from `Z88BankedMemory` (COM.RAMS page 0 at a fixed
  $080000, SR0's half-bank page 1, chip-mask mirroring), the empty-slot LFSR (seed $AC23, never
  reset), RAM (read/write) and ROM (read-only) cards; UV EPROM and flash cards read like ROM and are
  erased ($FF) on insertion, programming is Step 10. Card kind codes 1-6; the TypeScript `CardType`
  code each card reports (`z88GetSlotCardType`, `z88GetPageCardType`). `z88SetInternalRamSize` does
  not re-page, like `setRamCard`. Memory bus events are recorded for the debugger.
- **Test backends are feature-gated.** `Z88_WASM_FEATURES` (`test/harness/z88/core/machines.ts`)
  lists what the core emulates; `z88Backends(...features)` (core suites) and
  `z88HarnessBackends(...features)` (session suites) add the WASM backend once every feature a suite
  needs is listed. Steps 4-6 added `memory`, `cpu`, `blink`. The WASM core-suite backend
  (`WasmZ88Surface` in `test/z88/z88-backends.ts`) drives a fresh core instance through its exports,
  compiled synchronously once per worker.
- **`memory-paging`, `memory-read`, `memory-write` (and `rtc`, Step 6) pass on both backends: 648
  cases on WASM, unchanged.** The flash suites wait for `flashCards` (Step 10).

Original scope:

- `z88-memory.c`:
  - 4 MB physical memory and internal RAM sizing from the mask
  - the 8-page table, SR0-SR3 and COM.RAMS
  - `calculatePageOffset` mirroring
  - empty-slot LFSR (exact seed and taps)
  - fast-path flags
- `z88-cards.c`: RAM and ROM kinds, `z88InsertCard` / `z88RemoveCard` (removal keeps the bytes, as
  TypeScript does), `onInserted` fills.
- Exports: `z88ReadMemory` / `z88WriteMemory`, `z88SetSR0-3`, and the test surface exports.
- Add `wasm` to `Z88_BACKENDS`. **`memory-paging`, `memory-read` and `memory-write` pass on both
  backends.**

### Step 5 - Z80 integration and the frame lifecycle

Status: Done on 2026-09-19.

- `z88.c`: `z88CpuTactPlusN` keeps `Z80Cpu.tactPlusN`'s frame accounting (a frame completes the
  moment its last tact passes, mid-instruction if so); `z88BeginFrame` applies the clock multiplier,
  then `onInitNewFrame`'s RTC tick and KWAIT wake-up; `z88ExecuteInstruction` is one whole
  instruction as the frame runner executes it (interrupt line, CPU cycles until the prefix is done or
  one 16-tact snooze cycle, then the key-down wake-up); `z88ExecuteFrame` runs to the frame's end with
  bus-event capture off. `z88SetTacts` sets the tact counter only. 107 exports; the build test checks
  that every non-static C function is in the allow-list and nothing else.
- Timing confirmed against the oracle: default 3-tact memory and 4-tact port delays, no contention,
  no delayed address bus - the lockstep parity below matches tact for tact.
- **Core extension found by parity: `z80SoftReset`.** `z80Reset` is `Z80Cpu.hardReset`; the TypeScript
  reset button (`Z80Cpu.reset`) keeps BC, DE, HL, their alternates, IX and IY. The shared core now has
  `z80SoftReset` (mirroring `Z80Cpu.reset`, keeping the Z80N mode), in the CPU contract, with
  `test/z80/soft-reset.test.ts` copied literally to `test/wasm/z80/` (the corpus wrapper's `reset()`
  now runs the soft reset and `hardReset()` the full one, as the TypeScript `Z80Cpu` does).
  `z88Reset` uses it; `z88HardReset` uses `z80Reset`.
- Adapter: every register setter (pairs, alternates, IX/IY/IR/WZ/PC/SP, IFF1/2, IM), `setTacts` and
  the snooze methods push into the core; mirrors are refreshed through `super` so they are not echoed
  back. The normal frame is one `z88ExecuteFrame` call; the debug loop is the 48K's (shared
  `shouldStopAtDebugPoint`, `z88GetStepOutAddress`, access-breakpoint-gated bus import).
- The harness reads registers through `getCpuState()` (a lazily mirrored backend syncs first) and
  gained `breakpoint()` and `debug(...)` (the IDE's `MachineController.run`, including the wake-up
  before a step).
- Tests: `test/wasm/z88/wasm-z88-debug-step.test.ts` (step-into incl. a prefixed instruction,
  step-over on a CALL and landing on one, step-out incl. across RTC interrupts, breakpoints, snooze
  stepping, the IDE step's wake-up - on both backends - plus four cases checking both backends stop at
  the same PCs with identical registers and tacts); `test/wasm/z88/wasm-z88-parity.test.ts`: **all ten
  OZ ROMs boot identically on both backends** (registers, tacts, frames, Blink state, snooze, all
  4 MB, at frames 1-1700), a mixed program matches after each of 30,000 instructions, in whole
  frames, and across mid-frame stops.
- **Preview menu entries: deferred again, to after Step 9** (registered then). The WASM machine runs, but the app's
  emulator loop also takes audio samples every frame and the keyboard panel sets keys, and those
  surfaces still throw `Z88WasmNotMigratedError` (Steps 7 and 9); without the LCD (Step 8) a preview
  would show nothing. Register the ten `-wasm` twins with `createModelTwins` once Steps 7-9 are done,
  and flip the "no WASM preview entry" test in `Z88MachineFactory.test.ts` then.

Original scope:

- Include `z80.c` with the hook set above. Implement tacts/frames, the 16,384-tact frame,
  `z88ExecuteFrame` / `z88ExecuteInstruction`, overshoot, `z88SetTacts`, the snooze cycle, the
  interrupt line and the clock multiplier.
- Confirm the Z88 timing against the oracle. Compare TypeScript `Z80MachineBase` delay behaviour
  for the Z88 (`delayedAddressBus = false`, no contention) with an instruction-timing parity test
  over a mixed program.
- Adapter: the normal frame path, the debug loop, `markStepOutAddress`, bus-event import, and the
  `pc`/`sp` setters pushing into the core.
- Tests:
  - adapter frame/memory/`getCpuState` tests
  - `test/wasm/z88/wasm-z88-debug-step.test.ts`: step-into, step-over landing on
    CALL/RST/HALT (the `imminentJustCreated` guard), step-out across an interrupt, and stepping
    while snoozed
  - a CPU parity test running synthetic programs for a fixed instruction count on both backends

### Step 6 - Blink ports, interrupts and RTC

Status: Done on 2026-09-19.

- `z88-blink.c`: SR0-SR3 (with the RAMS re-page), COM (RESTIM, the SRUN/SBIT ear bit, re-page), INT,
  STA, ACK, TACK, TMK, EPR, the interrupt line (defect F1 kept), the RTC tick with its gating order,
  wrap values and wake-ups, the flap, battery low, the LCD registers PB0-PB3/SBR (B supplies the high
  byte), and the whole `doReadPort`/`doWritePort` decoding, including the `$B2` keyboard read with
  its snooze (the matrix is read from the key lines; the key interrupt itself is Step 7). Quirks kept
  and named in the file: F1; the reset re-pages with the old COM and can leave the interrupt line
  active; the ear bit survives a reset; the oscillator bit is computed from the tact count as the
  TypeScript beeper computes it after each instruction.
- Adapter: `getBlinkState()` from the core (the Blink panel works on WASM), ports, flap, battery,
  partitions and the flat 64K view (with `get64KFlatMemory`'s bank-start quirk).
- Tests: `rtc.test.ts` on both backends (32 WASM cases); `z88-interrupts.test.ts` on both (11 WASM
  cases, including a new one: an enabled RTC event wakes a snoozing CPU, without INT.TIME it sleeps
  on); the harness self-tests (8 WASM cases).
- Usable afterwards: a WASM Z88 that boots OZ exactly like the TypeScript one, as far as CPU, memory
  and Blink are concerned - but with no picture, keyboard or sound yet, so not in the menu.

Original scope:

- `z88-blink.c`: every port in the table above, with COM side effects (RESTIM, SRUN/SBIT → ear
  bit, SR0 re-apply), `setTACK`, `setACK`, `setINT`, `setSTA`, and the interrupt check **verbatim**
  (defect F1 is preserved). RTC `incrementRtc` has exact gating order, TIM wrap values and awake
  cadence. Also `z88SignalFlapOpened/Closed` and `z88RaiseBatteryLow`.
- Tests: **`rtc.test.ts` passes on both backends.** New flap, battery and interrupt tests pass on
  both.

### Step 7 - Keyboard, snooze and sleep

Status: Done on 2026-09-19 (together with Steps 8 and 9).

- `z88-keyboard.c`: `z88SetKeyStatus` (the matrix bit, the shift flags, "a key is pressed", then the
  key interrupt - INT.KEY sets STA.KEY - and the KWAIT wake-up), `z88GetKeyLine`,
  `z88GetKeyPressed`, and the sleep check of `onInitNewFrame` (`z88CheckSleepMode`, exported as
  `z88GetSleepMode`). Kept for parity: the keyboard reset clears the matrix but not the "pressed"
  and shift flags. The KBD read and its snooze were already in `z88-blink.c` (Step 6).
- The frame start is the TypeScript order: RTC, the KWAIT wake-up while a key is down, the LCD, then
  the sleep check - which, when both shifts wake the machine, returns before the beeper's new frame.
- Adapter: `setKeyStatus` is one export call per key change (the app changes one key at a time, so
  the "write only changed lines" batching was not needed); `isInSleepMode` is refreshed with the
  frame counters after every frame and every debugger stop. `press_shifts` stays the host's timer.
- Tests: `z88-keyboard.test.ts` and `z88-sleep-and-boot.test.ts` on both backends (the "keyboard"
  feature); the harness key self-tests; adapter tests (the key reaches the core's matrix, the sleep
  flag follows the core); parity: OZ50 and OZ40 driven by a 22-step typing script, compared after
  every frame (registers, memory, Blink, picture, samples).

Original scope:

- `z88-keyboard.c`: the 8×8 matrix, `getKeyLineStatus(highByte)`, and `z88SetKeyStatus` with the
  STA.KEY interrupt and KWAIT awake. The `$B2` read snoozes the CPU when KWAIT is set and no key is
  down. Sleep detection (`halted && I == 0x3F`, cleared after both shifts are released and pressed
  again) is exported for `isInSleepMode`.
- Adapter keyboard sync writes only lines that changed. `press_shifts` stays a host timer that calls
  key setters.
- Tests: keyboard/snooze behaviour tests on both backends; the ROM enters snooze and wakes on a key
  on both.

### Step 8 - LCD

Status: Done on 2026-09-19.

- `z88-screen.c`: a port of `Z88ScreenDevice.renderScreen` - the PB0-PB3/SBR address shuffles,
  LORES/HIRES/UDG cells, REV/FLS/GRY/UND, the cursor from TIM0, the null cell, the 200-frame text
  flash, the right-edge fill, the one-off LCD-off fill, all five sizes. Every byte is read from
  physical memory directly, so a flash card's command state never affects the picture. Kept: the
  unpainted 4 pixels at the right of a LORES row.
- `z88RenderScreen` is not exported: the instant render (`renderInstantScreen`) answers the current
  picture, as the TypeScript machine's does (it returns its buffer without rendering).
- The renderer's zero-copy byte path (`getPixelBufferBytes`) works unchanged: the buffer starts at
  offset 0 with the LCD width as its stride, and the ABGR words are the TypeScript ones.
- Tests: `z88-lcd.test.ts` on both backends (the "lcd" feature); parity: the ten OZ boots now
  compare the picture at every checkpoint, and 64K of random screen memory and fonts renders
  identically at all five sizes through two text-flash toggles, the cursor phases and LCD off/on.

Original scope:

- `z88-screen.c`, ported from `Z88ScreenDevice`:
  - address shuffles for PB0-3/SBR
  - LORES and HIRES cells, UDGs
  - attribute bits (HRS, REV, FLS, GRY, UND, NUL/CUR masks)
  - cursor from TIM0, text flash every 200 frames
  - grey as a separate colour
  - underline replacing row 7
  - right-edge fill
  - LCD-off fill
  - all five sizes
- The render happens in `z88BeginFrame` on `frames % 8 == 0`. `z88RenderScreen` is exported for
  instant render.
- The renderer uses the zero-copy byte path, as on the 48K. Check `useEmulatorScreen` with a
  640-wide, 64-line buffer and each larger size.
- Tests: pixel parity per size on synthetic screen memory covering every attribute combination,
  plus ROM-boot pixel parity at fixed frames.

### Step 9 - Beeper

Status: Done on 2026-09-19.

- `z88-beeper.c`: the oscillator bit (after each instruction, from the tact count), the SRUN/SBIT/
  ear selection, and the `AudioDeviceBase` sampler - one sample at most per clock step, the DC
  high-pass filter, the clamp - **in doubles**. The decision: the samples are the oracle's numbers
  exactly (the parity test compares with `toBe`), not int16. The loader's view is a `Float64Array`;
  the adapter copies into a reused `AudioSample[]`. The host computes the filter alpha (no `exp` in
  the core) and hands the rate over at reset, when `AUDIO_SAMPLE_RATE` holds a number - where the
  TypeScript machine hands it to its beeper.
- **Not shared with `zx-spectrum-beeper.c`**: its EAR/MIC semantics and `sp48*` names would need
  aliasing, and the Z88 sampler is 40 lines. Kept local, per the "do not over-share" rule.
- Kept different, on purpose: without a sample rate the TypeScript beeper emits a sample per clock
  step, the core none (the app always sets one; the harness README says so).
- The tact hook became `noinline` (`Z88_CPU_NOINLINE`, as `sp48CpuTactPlusN`): with the sampler
  inlined into every opcode the artifact was 710 KB; now it is 198 KB.
- Tests: `z88-beeper.test.ts` and the harness audio self-tests on both backends (the "beeper"
  feature); adapter tests (the reused array, the rate at reset); parity: the OZ boots and the typing
  sessions compare each frame's samples, and a Z80 beeper program (oscillator, SBIT gating, ear-bit
  toggles at growing periods) matches exactly at 11,025-96,000 Hz and across rate changes.
- **The preview entries are registered**: `machine-registry.ts` holds the ten models as `Z88_MODELS`
  and adds their `createModelTwins` twins, `<modelId>-wasm`, in the "Cambridge Z88 (WASM preview)"
  submenu. The tests that pinned "no preview entry yet" now pin the twins: their ids, names, group
  and backend (`Z88MachineFactory.test.ts`), the submenu and its checked state
  (`machine-types-menu.test.ts`). Tests that iterate the models filter the originals
  (`menuGroup === undefined`). The twins also appear in the New Project dialog's model list.
- `Z88WasmNotMigratedError` is gone: no surface throws it any more. EPROM and flash cards read like
  ROM on the WASM core, and writes to them are ignored until Step 10.
- Usable afterwards: the WASM Z88 in the machine menu, with picture, keyboard and sound, for side by
  side comparison with the TypeScript one - except for programming EPROM/flash cards.

Original scope:

- `z88-beeper.c`: the oscillator (`floor(tacts / floor(clock * mult / 6400)) & 1`), SRUN/SBIT/ear
  selection, and per-tact sample scheduling matching `AudioDeviceBase` including its DC high-pass
  filter, producing int16 stereo.
- **Decision to make here:** `zx-spectrum-beeper.c` is written against `sp48*` names and Spectrum
  EAR/MIC semantics. Share code with it only if a neutral sampler/DC-filter unit can be extracted
  with all Spectrum audio tests unchanged and green. Otherwise keep the Z88 sampler local. Do not
  alias dozens of `sp48*` macros just to reuse it (the "do not over-share" rule).
- Tests: the WASM `AudioIntegration` sibling, and sample parity against the TypeScript oracle
  (within 1/32768) for silence, a 3200 Hz tone, SBIT toggling and a sample-rate change.

### Step 10 - EPROM and flash cards, and hot-plug

Status: Not started.

- In `z88-cards.c`:
  - **UV EPROM:** slot-3-only programming, VPPON + PROGRAM/OVERP, EPR 0x48/0x69, `old & new`.
  - **Intel 28F00xS5:** program, block erase, status, id, read-array.
  - **AMD 29F0x0B:** the 3-cycle unlock on A0-A10, program, chip/sector erase, autoselect, reset,
    and toggle-bit status sequences.

  These run only on the slow path; the read-array state stays on the fast path.
- Adapter `configure()` does hot-plug for slots 1-3, and slot 0 on rebuild.
- Tests: **`memory-eprom-io` and `memory-intflash-io` pass on both backends**, plus the new AMD
  flash suite on both. A parity scenario inserts each card type into slots 1-3 while running,
  programs and erases it from Z80 code, and compares memory hashes.

### Step 11 - IDE surfaces

Status: Not started.

- The WASM machine implements `IZ88IdeMachine.getBlinkState()` from core getters: SR0-3, TIM0-4,
  TSTA, TMK, INT, STA, COM, EPR, key lines, oscillator/ear bit, PB0-3, SBR, SCW and SCH. It also
  provides `get64KFlatMemory`, `getMemoryPartition`, `getCurrentPartitions`,
  `getCurrentPartitionLabels`, `directReadMemory`, `getRomFlags` and `getDisassemblySections`, and
  the custom commands.
- Tests: an IDE-state parity test on both backends after the same program; a memory-panel contents
  test; Blink panel data equality.
- Manual check: the Blink panel, memory panel, disassembly with `Z88CustomDisassembler`, the
  keyboard panel, and the slot tool strip all work with the preview model.

### Step 12 - Full parity pass and benchmark

Status: Not started.

- `test/wasm/z88/wasm-z88-rom-parity.test.ts`: for each of the ten models, boot N frames (long
  enough to reach the OZ index), compare the state at checkpoints, then type a keystroke sequence
  and compare again.
- LCD-size parity for all five sizes, and card scenarios.
- Record the artifact size and set the size ceiling. Add Z88 scenarios to
  `benchmark-spectrum-wasm.cjs` or a sibling. Record TypeScript vs WASM ms/frame in `wasm/README.md`.
- Every disagreement is resolved against hardware documentation, not by assuming TypeScript is
  right. Fixing it in TypeScript too is allowed, with a test.

### Step 13 - Manual app pass

Status: Not started.

Use `scripts/doc-shots/harness.cjs` (read `.ai/doc-screenshots-guide.md`) to drive each preview
model:

- boot and screenshot
- typing
- flap open, card insert and remove
- change RAM, LCD sizes, keyboard layouts
- F6/F8/F9, battery low
- breakpoint, step-over and step-out on OZ code

Compare against the TypeScript model side by side, and record the results in this plan.

### Step 14 - Flip the default and keep TypeScript in the menu

Status: Not started.

- Set `DEFAULT_Z88_IMPLEMENTATION = "wasm"`. Replace the WASM preview group with the
  `"Cambridge Z88 (TypeScript)"` group (`<id>-ts`). Add the `<id>-wasm` → `<id>` alias with a test.
- Update `.ai/wasm-migration-intent-and-lessons.md` and `.ai/wasm-v2-machine-migration-guide.md`
  with the Z88 lessons (non-Spectrum machine, snooze in the shared core, per-key backend fallback,
  grouped comparison menu). Add a pointer in `.ai/README.md`.
- Gate: every item in "Rollout Criteria" is met and the author has signed off.

### Step 15 - Comparison period and handover

Status: Not started.

- New machine-owned Z88 behaviour is implemented in WASM first, or in both cores while TypeScript
  is still the oracle.
- Resolve follow-ups F1-F4 in both cores.
- When the author ends the comparison period, write
  `.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`: tag first, then remove the TypeScript group and
  the switch, map `<id>-ts` → `<id>`, and convert parity tests to fixed WASM assertions. **Not part
  of this plan.**

## Rollout Criteria (gate for Step 14)

- All 887 original cases, and every new behaviour case, pass on both backends, with zero cases
  excluded from WASM.
- ROM-boot parity passes for all ten models; LCD parity for all five sizes; card parity for every
  card type in slots 1-3.
- The separation test passes: no TypeScript Z88 emulation module is in the WASM machine's graph or
  prototype chain.
- The debugger works on WASM: breakpoints, step-into, step-over, step-out, and stepping while
  snoozed.
- The IDE panels show identical data on both backends.
- The shared-CPU contract lists `z88`. The sp48/sp128/spp3e/zxnext tests and the Z80 corpus are
  still green after the snooze extension.
- The artifact is under its recorded ceiling, and the benchmark shows WASM faster than TypeScript.
- The manual pass (Step 13) is complete, with no open blocker.

## Validation Commands

```sh
npm test -- --project node test/z88 test/wasm/z88 test/harness/z88
npm test -- --project node test/memory/partition-descriptions.test.ts test/audio test/wasm/wasm-shared-z80-cpu-contract.test.ts
npm test -- --project jsdom test/dialogs/z88
npx vitest run --config test/wasm/vitest.z80.config.ts
npm run build:z88-wasm
npm run check:z88-wasm-size
npm run check:wasm-cpu-contract
npm run build:check
npm run lint:renderer
npx electron-vite build --config build/electron.vite.config.ts
git diff --check
```

After touching `z80.c`, also run `npm run build:all-wasm` and the sp48/sp128/spp3e/zxnext test
folders (`test/zxSpectrum`, `test/wasm/zxSpectrum`, `test/wasm/zxNext`, `test/zxnext-hw`).

## Risks

- **Test runtime.** 1,774+ cases with per-case instantiation of an 8 MiB module. Mitigate with the
  cached module and synchronous instantiation, and pool only with the proven-equivalent reset.
- **Audio parity** through a float DC filter versus int16 output. Compare within one LSB, and keep
  the filter math in the same order as `AudioDeviceBase`.
- **Hidden TypeScript timing.** `MachineFrameRunner` hooks (`beforeInstructionExecuted`,
  `consumeEvents`, `afterInstructionExecuted`) and base-class delays may add tacts the inventory did
  not list. Step 5's instruction-timing parity test must find them before Step 6 builds on the
  timing.
- **Menu grouping** is new app-menu behaviour. Keep it generic, tested and small, so the removal
  plan can drop the Z88 twins without touching it.
- **Host setup side effects**, such as the keyboard-layout global setting and ROM-size machine
  property, must happen identically on both backends. Keep them in shared host code, not in each
  class.

## Follow-ups (outside the parity scope, fixed in both cores later)

- **F1:** the Blink interrupt check pairs STA and INT bits that do not correspond (STA.TIME vs
  INT.GINT, STA.FLAPOPEN vs INT.KWAIT). Verify against Blink documentation, fix in both cores, and
  add tests.
- **F2:** `EPROMUV256` is offered but not constructible. Either implement a 256K UV EPROM in both
  cores or remove it from the catalogue.
- **F3:** Z88 disassembly sections use Spectrum address ranges.
- **F4:** code injection is a stub while `MF_INJECT_SUPPORT` is `true`. Either implement a Z88
  injection flow or turn the feature flag off.
