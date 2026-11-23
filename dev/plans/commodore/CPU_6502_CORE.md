# The shared 6502-family core

Part of `COMMODORE_PLAN.md` (decision D5). Research: `dev/research/commodore/CPU_6502_FAMILY.md` (cited
as CPU §n).

## 1. What it must model

All the CPUs in scope run the NMOS 6502's instruction set, undocumented opcodes included (CPU §1). The
variants differ outside the decoder:

| Variant | Used by | Differences the core models |
|---|---|---|
| `M6502_NMOS` | VIC-20, 1540/1541/1571 drives | SO pin (falling edge sets V; the 1541's BYTE READY), SYNC |
| `M6502_6510` | C64 (breadbin) | 6-bit port at $00/$01, pull-ups, input bits; floating bits 6/7 holding then fading; the RAM under $00/$01 receives the VIC-II's last φ1 byte on a write (CPU §1.3–§1.4) |
| `M6502_8500` | C64C | as 6510, HMOS (fade constants may differ; one constant) |
| `M6502_8502` | C128 | 7-bit port (bit 6 = CAPS LOCK sense), bit 7 fade; 2 MHz mode is the machine's (the CPU sees more ticks) (CPU §1.6) |
| `M6502_7501` | C16, C116, Plus/4 | 7-bit port without P5, driving the serial bus and tape; **no NMI pin** (CPU §1.7) |

## 2. Design

### 2.1 Cycle-stepped, bus-request style (CPU §8.2)
- State is an instance: `typedef struct M6502 { registers, decoder position, interrupt pipelines, port,
  variant, config } M6502;`. No file-scope CPU state, so a TU can hold several (C64 + drive; C128's
  8502 beside the shared Z80, whose global is `cpu`: the 6502 never uses that name).
- **One call per cycle:** `m6502Tick(M6502 *c, M6502Bus *bus)`. Before the call the bus record holds the
  previous cycle's data (the byte read, or nothing); the call does that cycle's ALU work and sets up the
  next request: `address`, `rw`, `sync` (opcode fetch), plus flags `dummy` (a dummy read/write of the
  addressing mode, CPU §2) and `rmwFirstWrite`. The machine serves the request between calls.
- **RDY:** the machine raises `bus->rdy` low; on a read request the tick returns without advancing (the
  read repeats); writes ignore it (CPU §4). The core records "held last cycle", which the SHx opcodes need
  (CPU §6.4).
- **Interrupts:** IRQ level and NMI edge enter shift-register pipelines that advance one bit per cycle; at
  SYNC the core checks them (the second-to-last-cycle rule, the taken-branch-without-page-cross delay, the
  CLI/SEI/PLP latency, NMI hijacking of BRK/IRQ, CPU §3). RESET is the same path with writes suppressed.
- **SO:** a falling edge sets V at the next cycle (CPU §4.3).
- **Decoder:** a switch on `(opcode << 3) | step`, one case per cycle of every instruction, all 256
  opcodes explicit. The table is **generated** by a Klive script (`dev/scripts/m6502-gen.cjs`) from a
  compact description written from CPU §2 and §6, so the generated C is reviewable and regenerable; the
  generated file is committed and a test checks it matches the generator.
- **Undocumented opcodes:** all of them, with `ANE`/`LXA` magic constants and the `SHx` page-cross
  behaviour as **config fields** (`aneMagic`, `lxaMagic`; defaults $EF/$EE per VICE's game-compatibility
  choice for C64 models, overridable; the Harte run sets $EE/$EE; CPU §6.3, §10). JAM sets a `jammed` flag
  the debugger reports.
- **Decimal mode:** NMOS flag behaviour including invalid BCD (CPU §5).
- **The port** (6510/8500/8502/7501): direction and data registers, per-variant connected-bit masks and
  pull-ups, input pins supplied by the machine, fade timers counted in CPU cycles with one constant per
  variant (CPU §1.3, OQ on fade times). The machine reads the port's output pins after each tick that wrote
  $00/$01.

### 2.2 What the machine sees
- `M6502Bus`: `address`, `data`, `rw`, `sync`, `rdy`, `irq`, `nmi`, `res`, `so`, `dummy`. The machine's
  tick function reads `address/rw`, performs the access through its memory map (PLA, MMU, drive map),
  puts the byte in `data` and calls the next tick.
- The **access log and history hooks** are called by the machine's bus function, not inside the decoder,
  so dummy accesses can be logged with their flag (CPU §9: "do dummy accesses trigger watchpoints" is an
  option, default off).

### 2.3 Debug state kept in the core (the Z80's counterparts; CPU_NEUTRAL_DEBUGGING.md §2)
- **Instruction start:** the PC at the last SYNC cycle (`opStart`), the debugger's decision point.
- **Shadow call stack** (step-out and the Call Stack panel): pushed on JSR (frame kind `jsr`, return =
  pushed address + 1), BRK, IRQ, NMI (kind `brk`/`irq`/`nmi`, return = the pushed PC); popped on RTS/RTI
  when S rises above the frame; re-synchronised when S moves above recorded frames by `TXS`, `PLA`/`PLA`
  drops or RTS-as-jump-table (CPU §9). It lives in the instance and is part of saved state (trap T2).
- **Interrupt depth** from the same stack.

## 3. Files
```
src/emu/m6502/wasm/
  README.md               the core's model, variants, config fields, the bus contract, the debug hooks
  m6502.h                 the instance, bus record, variants, config
  m6502.c                 tick, interrupts, port, the hand-written parts
  m6502-ops.gen.c         the generated per-cycle decoder (from dev/scripts/m6502-gen.cjs)
  m6502-cpu-exports.c     register/step-out/interrupt-depth/access-log exports (CPU_NEUTRAL_DEBUGGING.md)
  m6502-history.h/.c      the 6502 history record
  m6502-profile.h/.c      call events JSR/BRK/IRQ/NMI/RTS/RTI for the profiler
dev/scripts/m6502-gen.cjs, m6502-cpu-exports.cjs, benchmark-m6502.cjs
test/harness/m6502/       bare machine: 64K RAM + one core, a tick loop, load/run helpers, a TS reader
test/m6502-hw/            the tests below
```
The bare machine is built by `dev/scripts/build-m6502-bare-wasm.cjs` into a test-only artifact (not
shipped, not in `extraResources`).

## 4. Tests
1. **Harte's 65x02 SingleStepTests** (MIT; CPU §7): every opcode, each case checking registers, memory and
   **the bus sequence cycle by cycle**. A deterministic subset (for example 50 cases per opcode, chosen by
   a fixed seed) is committed with the MIT notice for the fast tier; the full ~1 GB set is fetched into
   `.local/commodore/harte/` and run in the slow tier. Exit: 0 mismatches with Harte's constants.
2. **Dormann's 6502 functional test** (GPL-3, fetched) and **Bruce Clark's decimal test** (public domain;
   may be committed if its licence is confirmed, else fetched): both on the bare machine, success trap
   reached.
3. **Klive tests for what Harte does not cover:** IRQ/NMI timing (the second-to-last cycle, branch delay,
   CLI/SEI/PLP latency, NMI hijacking BRK and IRQ), RDY on reads only and the SHx RDY interaction, SO edge,
   port fade per variant, the 7501's missing NMI, JAM, RESET sequence (CPU §3–§4, §6.5). Each written from
   the research facts with its section cited.
4. **Lorenz's suite** (public domain, committed): it needs a C64 and its KERNAL, so it runs in Phase 5
   (C64.md §9), not here.
5. **Benchmark** `npm run benchmark:m6502`: bare-machine cycles per second; Phase 1 exit > 50 M cycles/s
   (a C64 at 10× real time needs ~10 M CPU cycles/s plus everything else).
6. **Debug-state tests:** shadow stack and interrupt depth through nested JSR/IRQ/NMI/BRK, stack
   manipulation, TXS; the saved state round-trips them.

## 5. Open questions (the core README records the chosen default of each)
| # | Question | Default | Research |
|---|---|---|---|
| CQ1 | ANE/LXA constants per model | $EF/$EE on C64 models; configurable | CPU §6.3, §10 |
| CQ2 | Port fade time per variant | the measured value the research found most cited; one constant per variant | CPU §1.3, OQ |
| CQ3 | Dummy accesses in watchpoints | not counted (option) | CPU §9 |
| CQ4 | 8500 vs 6510 differences beyond fade | none modelled | CPU §1.5 |
