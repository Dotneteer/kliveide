# Multi-System Architecture Plan

## Goal

Restructure `rtvc` so the application can run three Z80 systems:

- Videoton TV Computer;
- Zx82 (ZX Spectrum 48K);
- Cpc (Amstrad CPC 464).

The purpose is to provide agent-friendly source and target emulators for game
conversion work. The architecture only needs to support these systems cleanly.
It is not intended to become a plugin platform, a general hardware framework,
or a front end for arbitrary emulators.

The common application should provide:

- run, pause, reset, frame execution, and instruction stepping;
- deterministic snapshots;
- keyboard/text input;
- framebuffer and screenshot access;
- audio delivery where useful;
- media/file loading;
- a shared debugger and TCP automation surface;
- native, full-web, and lightweight WASM entry points where applicable.

Each system remains responsible for its own memory map, video, keyboard,
timers, interrupts, I/O ports, media formats, devices, and snapshot payload.

This implements the [Multi-System Architecture TODO](../../TODO.md) while
preserving current TVC behavior and performance.

## Scope Decisions

Keep the design deliberately closed and explicit:

1. One machine runs at a time.
2. The supported systems are represented by Rust enums, not a dynamic registry.
3. All three machines use the existing concrete Z80 core.
4. Machine buses remain concrete so memory and I/O hot paths do not use dynamic
   dispatch.
5. Shared APIs exist only for operations needed by the application, debugger,
   automation, or conversion workflow.
6. Machine-specific UI is allowed to use a small `match` on the active system.
   Three clear branches are preferable to a descriptor framework.
7. Zx82 initially means Spectrum 48K only.
8. Cpc initially means CPC 464 only.
9. Zx82 initially loads deterministic injected state; Cpc initially supports
   tape media only.
10. Existing TVC snapshots and WASM APIs remain compatible during extraction.

## Non-Goals

- Runtime plugins or third-party machine registration.
- Arbitrary CPU support.
- Generic traits for every hardware device.
- A universal machine-topology or help-description model.
- Simultaneous source and target emulation in one process.
- A universal media-slot abstraction covering hypothetical systems.
- A universal snapshot format shared by TVC, Zx82, and CPC.
- Implementing every historical model before the first conversion needs it.
- Zx82 or Cpc disk-drive emulation in the initial implementation.
- Raw ROM-bank mapping or bank-aware debugging for Zx82 and Cpc in the initial
  implementation.

## Naming And File Layout

The current generic-looking module names are mostly TVC-specific. Rename them
early so agents can identify ownership from filenames and imports.

Suggested flat layout:

| Current | Proposed |
| --- | --- |
| `src/tvc.rs` | `src/tvc_emu.rs` |
| `src/mmu.rs` | `src/tvc_mmu.rs` |
| `src/vid.rs` | `src/tvc_vid.rs` |
| `src/key.rs` | `src/tvc_key.rs` |
| `src/sound.rs` | `src/tvc_sound.rs` |
| `src/tape.rs` | `src/tvc_tape.rs` |
| `src/cas.rs` | `src/tvc_cas.rs` |
| `src/expansion.rs` | `src/tvc_expansion.rs` |
| `src/hbf.rs` | `src/tvc_hbf.rs` |
| `src/fd1793.rs` | `src/tvc_fd1793.rs` |
| `src/tvc_snapshot.rs` | unchanged |

Keep genuinely shared modules unprefixed:

- `z80.rs`;
- `bus.rs`;
- `asm.rs`;
- `disasm.rs`;
- `audio.rs`;
- `log.rs`;
- `emu.rs`;
- `debug_core.rs`;
- `ui.rs`;
- `workspace.rs`.

Add Zx82 modules with `zx82_` prefixes and CPC modules with `cpc_`
prefixes. A flat prefix is intentionally easy to search and avoids a large
module-tree migration.

Rename the concrete `Tvc` type to `TvcEmu`. It already owns the complete TVC
machine and does not need another wrapper merely to satisfy the architecture.

## Simple Machine Boundary

Use explicit enums for system identity, configuration, and storage:

```rust
pub enum System {
    Tvc,
    Zx82,
    Cpc,
}

pub enum MachineConfig {
    Tvc(TvcConfig),
    Zx82(Zx82Config),
    Cpc(CpcConfig),
}

pub enum Machine {
    Tvc(TvcEmu),
    Zx82(Zx82Emu),
    Cpc(CpcEmu),
}
```

`Machine` provides a small set of methods implemented with `match`:

```rust
impl Machine {
    pub fn system(&self) -> System;
    pub fn config(&self) -> MachineConfig;
    pub fn reset(&mut self);
    pub fn run_frame(&mut self) -> FrameOutcome;
    pub fn step_instruction(&mut self) -> StepOutcome;
    pub fn frame_rate(&self) -> f64;
    pub fn framebuffer(&self) -> FramebufferRef<'_>;
    pub fn take_audio_samples(&mut self) -> AudioSamples;
    pub fn input(&mut self, event: InputEvent);
    pub fn load_media(&mut self, name: &str, bytes: &[u8]) -> MediaResult;
    pub fn save_snapshot(&self) -> Result<Vec<u8>, SnapshotError>;
    pub fn load_snapshot(&mut self, bytes: &[u8]) -> Result<(), SnapshotError>;
    pub fn debug(&mut self) -> DebugMachine<'_>;
}
```

Do not introduce `MachineFactory`, `MachineRegistry`, `MachineTopology`,
capability descriptors, generic pane providers, or machine plugin traits.
Construction and snapshot probing are small functions matching the three
systems.

`FrameOutcome` should distinguish a completed frame, breakpoint stop, and
other future stop reasons. `FramebufferRef` supplies dimensions, aspect ratio,
and packed RGBA pixels so the UI no longer assumes TVC's `608x288` buffer.

## Shared Application Runtime

[emu.rs](../../src/emu.rs) remains the application runtime and owns a private
`Machine`.

It owns:

- running state and host-time scheduling;
- active `MachineConfig`;
- typed-text automation;
- snapshot file compression and decompression;
- native paths and browser-owned bytes;
- recent files;
- screenshot conversion;
- machine switching;
- forwarding shared debugger operations.

It does not own:

- TVC ROM selection rules;
- Zx82 or CPC model internals;
- machine memory maps;
- machine-specific media parsing;
- machine-specific debugger bank definitions.

The UI and debugger must stop reaching through `Emu` into concrete TVC fields.
Narrow `Emu` methods should cover common operations. A few explicit
system-specific accessors are acceptable for genuinely system-specific menus:

```rust
pub fn tvc_mut(&mut self) -> Option<&mut TvcEmu>;
pub fn zx82_mut(&mut self) -> Option<&mut Zx82Emu>;
pub fn cpc_mut(&mut self) -> Option<&mut CpcEmu>;
```

These accessors should not be used by the common scheduler or debugger.

## Agent-Friendly Debugger

The debugger boundary is the most important shared abstraction for conversion
work. Add `src/debug_core.rs` with concrete, Z80-oriented types rather than a
universal CPU debugger.

Required shared operations:

- read Z80 registers, flags, interrupt state, halt state, and cycle count;
- mapped CPU-memory read and write;
- disassemble and assemble Z80 code;
- add, remove, enable, disable, and list mapped-address breakpoints;
- step one or many instructions;
- continue, pause, reset, and run to interrupt;
- report structured breakpoint and trace events;
- send physical-key and text input;
- save/load snapshots and screenshots.

Use a simple mapped CPU address initially:

```rust
pub struct DebugAddress {
    pub address: u16,
}
```

Each machine supplies:

- mapped-memory access;
- an optional current mapping summary where already useful;
- optional symbols and trace landmarks;
- optional I/O log entries.

TVC may retain its existing raw RAM/video/ROM views as a TVC-only debugger
extension. Zx82 and Cpc initially expose only the currently mapped 64K CPU
address space. Add raw ROM/RAM banks or bank-qualified addresses later only
when a conversion demonstrates a need.

TVC BASIC symbols remain TVC-specific. Zx82 and Cpc symbol maps can be added
when useful for a conversion.

Both [debug_ui.rs](../../src/debug_ui.rs) and
[debugger.rs](../../src/debugger.rs) call this shared debugger API. Preserve
existing TCP command names and mapped-memory address behavior where possible.

The protocol should favor deterministic, structured responses because it is an
agent interface, not merely an interactive monitor.

## Media And Snapshots

Keep media handling simple:

- `Machine::load_media(name, bytes)` lets the active machine recognize its
  supported formats.
- The shared application owns file dialogs, filesystem reads, uploads,
  downloads, recents, and zip extraction where enabled.
- TVC-specific Play, Stop, and Inject actions remain explicit TVC operations.
- Zx82 initially supports debugger/project-state injection. A later limited
  instant loader may consume TAP or TZX standard-speed blocks through verified
  Spectrum ROM-loader semantics; general tape waveform playback is deferred.
- Cpc supports tape load/play only in the initial implementation.
- Zx82 and Cpc disk support is deferred.
- Gamebase remains TVC-only.

Each machine owns its snapshot contents and validation. The shared application
may compress snapshot bytes but should not interpret machine state.

Snapshot selection can use a small probe:

```rust
pub fn detect_snapshot(bytes: &[u8]) -> Option<MachineConfig>;
```

Preserve TVC snapshot version 2 and `.rtvcsnap(.zip)` behavior. Zx82 and Cpc
may initially use project-owned deterministic snapshots; historical `.z80`
import support remains machine-specific.

## UI And Workspace

Keep common UI limited to:

- system/profile selection;
- run, pause, reset, and stepping;
- screen;
- snapshots and screenshots;
- debugger panes;
- file status and timing.

Use explicit system branches for machine-specific menus:

- TVC: fast boot, video model, tape, disk, Gamebase, ROM symbols, IO log;
- Zx82: Spectrum 48K state injection and optional standard-block instant load;
- Cpc: CPC 464 tape controls needed by the conversion flow.

The workspace may keep a fixed common set of debugger panes. Unsupported
content can show a concise unavailable message or hide the corresponding menu
entry. Do not build a generic pane registry.

Change TVC-specific names such as `accepts_tvc_input` and `release_tvc_keys` to
machine-neutral input-capture names.

## Lightweight WASM

Preserve the existing `WasmTvc` JavaScript API as a compatibility facade over
`Machine::Tvc`.

Do not require all three systems in every lightweight bundle. Use Cargo
features for compile-time inclusion:

```text
system-tvc
system-zx82
system-cpc
```

Gate the corresponding `Machine` variants with the same features. Keep the
existing lightweight commands working by making the current `wasm` feature
include `system-tvc`.

The default native/full-web application may include all implemented systems.
A lightweight build selects one system and must continue to exclude egui,
eframe, cpal, zip, and browser-storage code.

Generic multi-system WASM bindings are optional and should be added only if a
conversion workflow needs them.

## Implementation Phases

### Phase 0: Baseline

- Add focused regression tests around TVC frames, input, audio, debugger stops,
  snapshots, media restore, and screenshots.
- Record `perf_test` and native frame-generation baselines.
- Confirm checked-in TVC snapshots load before restructuring.

### Phase 1: Rename TVC-Owned Modules

- Apply the `tvc_` file/module prefixes listed above.
- Rename `Tvc` to `TvcEmu`.
- Update imports, documentation links, and the development skill.
- Make no behavioral changes in this phase.

Exit gate:

- native and all WASM checks compile;
- FUSE and TVC library tests pass;
- TVC performance remains unchanged.

### Phase 2: Add The Explicit Machine Enum

- Add `System`, `MachineConfig`, `Machine`, frame, audio, and input value types.
- Implement the `Machine::Tvc` branch entirely by delegation.
- Change `Emu` to own `Machine` privately.
- Move TVC configuration and ROM-loading rules into TVC-owned code.
- Remove direct `emu.tvc` use from native startup, UI scheduling, audio,
  framebuffer updates, keyboard input, headless execution, and WASM.

Exit gate:

- the application behaves exactly as before with `Machine::Tvc`;
- shared code does not import TVC MMU, video, keyboard, or bus types.

### Phase 3: Extract The Shared Z80 Debugger API

- Add `debug_core.rs`.
- Move common breakpoint and event ownership out of the dock UI.
- Adapt TVC mapped memory, MMU summary, symbols, IO log, stepping, and
  run-to-interrupt to the shared API.
- Keep TVC raw-bank views as an optional TVC extension rather than a
  requirement for every machine.
- Migrate dock and TCP debuggers.
- Add mapped-memory write and mapped-address breakpoint support needed by
  conversion agents.
- Keep the protocol backward-compatible for existing TVC scripts.

Exit gate:

- dock and TCP debugging use the same operations;
- neither debugger imports TVC internals;
- debugger tests cover structured reads, writes, stepping, breakpoints, and
  snapshots.

### Phase 4: Add Zx82

- Implement the ZX Spectrum 48K model under `Zx82`.
- Use the scoped hardware and implementation boundary in
  [info/zx82.md](../../info/zx82.md).
- Add 48K memory, ULA/video, keyboard, interrupts, mapped memory/state
  injection, and deterministic project snapshots.
- Reuse the Z80 core and shared debugger.
- Expose only mapped CPU memory through the initial debug API.
- Defer contention, general tape waveform playback, raw ROM/RAM bank views,
  disk support, and additional Spectrum models.
- Optionally add standard ROM-loader acceleration for TAP and TZX ID `0x10`
  blocks after the injected-state workflow is stable.
- Validate deterministic frame stepping, memory injection, and snapshot round
  trips before adding optional instant loading or sound accuracy.

Exit gate:

- an agent can load a Zx82 game state, inspect and modify memory, set
  breakpoints, step code, send input, and capture frames through the same TCP
  interface used for TVC.

### Phase 5: Add Cpc

- Implement the Amstrad CPC 464 model under `Cpc`.
- Add CPC 464 memory, Gate Array/video, CRTC integration, keyboard, interrupts,
  tape loading/playback, and deterministic project snapshots.
- Reuse the Z80 core, shared debugger, and existing MC6845 knowledge where the
  hardware behavior actually overlaps; do not force TVC video code into a
  shared abstraction.
- Expose only mapped CPU memory through the initial debug API.
- Defer raw ROM/RAM bank views, disk support, and additional CPC models.

Exit gate:

- an agent can perform the same deterministic
  inspect/modify/step/input/frame workflow on Cpc, Zx82, and TVC, with
  machine-appropriate tape or state-loading operations.

### Phase 6: Cleanup And Documentation

- Remove temporary TVC compatibility accessors from common paths.
- Keep explicit system-specific UI branches small and local.
- Update [rtvc.md](../../info/rtvc.md), [tvc.md](../../info/tvc.md),
  [zx82.md](../../info/zx82.md), [README.md](../../README.md), and
  [development/SKILL.md](../skills/development/SKILL.md).
- Add source-system build and debugger examples for conversion agents.
- Review naming after all three systems exist; only introduce a new shared
  abstraction where real duplication is visible.

## Validation

Run throughout:

```bash
cargo check
cargo check --bins
cargo test --lib
cargo run --bin fuse_test
cargo run --bin perf_test
cargo check --lib --no-default-features --features wasm,web-vid-simple --target wasm32-unknown-unknown
cargo check --lib --no-default-features --features wasm,web-vid-realistic --target wasm32-unknown-unknown
cargo check --lib --no-default-features --features wasm-full --target wasm32-unknown-unknown
cargo check --manifest-path xtask/Cargo.toml
cargo tree --no-default-features --features wasm,web-vid-simple -e normal --target wasm32-unknown-unknown
```

Add per-system tests for:

- deterministic instruction and frame stepping;
- snapshot round trips;
- framebuffer dimensions and stable output;
- mapped memory access;
- breakpoint stop addresses;
- keyboard/input release;
- machine-specific interrupt timing used by games;
- media injection, tape where supported, and project snapshot fixtures.

## Completion Criteria

- `Emu` owns a private `Machine` with explicit TVC, Zx82, and Cpc variants.
- TVC-specific modules and types have clear `tvc_` names.
- Shared scheduling, input, screenshots, snapshots, and debugger code contain
  no TVC hardware assumptions.
- All three systems use the same structured agent/debugger operations.
- An agent can load a source-game state on Zx82 or Cpc, inspect and modify
  it deterministically, and perform the equivalent workflow on TVC.
- Existing TVC behavior, snapshots, native/full-web UI, lightweight WASM API,
  and performance remain intact.
