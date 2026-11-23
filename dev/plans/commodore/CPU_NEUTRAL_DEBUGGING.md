# Making Klive's debugger machinery CPU-neutral

Part of `COMMODORE_PLAN.md` (decision D8). Read `src/emu/z80/wasm/README.md` and `dev/ai/wasm-core-debug.md`
first: their rule — **the core decides whether to stop; TypeScript decides what a stop means** — and their
traps (T1 determinism, T2 saved state, T6 in-core stops equal per-instruction ones, T9 volatile debug
state) apply unchanged to the 6502.

**The gate for every commit in this file: every existing Z80 core rebuilds byte-identical** (compare the
`.wasm` artifacts before and after; the TVC's H1 rule), and the existing cross-core suites pass untouched.

## 1. Where Klive assumes a Z80 (survey, 2026-11-23)

Effort: T trivial, M moderate, H hard.

| Area | Z80-specific today | Effort |
|---|---|---|
| `src/emu/z80/wasm/z80-debug-loop.c` | Nearly neutral: the stop table, `ExecuteUntilStop`, the condition plan. Reads `cpu.pc`, `z80HistoryStopNow()`, the default `AccessHit` (Z80 access log + port event). Override macros exist. | T–M |
| `z80-cpu-exports.c` | Z80 register list, `GetCpuPrefix`, `RetExecuted`/`RetnExecuted`, last port | M (a 6502 twin) |
| Step-out shadow stack, interrupt depth | Inside `z80.c` (`stepOutStack`, `pushStepOutEntry`, …) | M (re-implemented in `m6502.c`) |
| `z80-condition.c` | VM and slots neutral; register ids `COND_REG_*` and `condCpuRegister()` Z80; `COND_REGISTER`/`COND_TSTATES` hooks exist | M |
| `z80-history.*` | 64-byte record of Z80 registers; begin/commit at M1/prefix points; `targetPhase` = inside a prefixed instruction | **H** (record format, readers, UI) |
| `z80-profile.*` | Coverage/heat map neutral; call events CALL/RST/RET/INT/NMI; Z80 time buckets | M |
| Build scripts | `z80-cpu-exports.cjs` (Z80 register list), `check-wasm-cpu-contract.cjs` (`mode: "z80" \| "z80n"`, Z80 source checks) | T–M |
| One CPU per TU | `static Z80State cpu`; every debug module reads `cpu.` directly; one 64K space | **H** for C128 (Z80 + 8502) and any machine + drive |
| `Z80MachineBase extends Z80Cpu` | Every WASM host inherits the 8.8k-line TypeScript Z80 interpreter and overrides its registers | **H** |
| `IAnyCpu` / `IAnyMachine` | Z80-flavoured: ports, `stepOutStack`, snooze, `retExecuted`, `getCallInstructionLength` | M |
| `EmuApi.ts` `CpuState` | `Z80CpuState \| M6510CpuState` with no discriminant | M |
| Machine registry | No CPU field; only the flags `MF_Z80`/`MF_M6510`; `condition-machine.ts` tests `machineId !== "c64"` | T–M |
| Disassembly | Per-machine factory exists, but ~10 places construct `Z80Disassembler` directly (history, breakpoints panel, memory inspector, static dump, annotations, reverse export, skool, branch info) | M |
| Breakpoints | I/O breakpoints are Z80 ports | T (gate by CPU) |
| Conditions / watch | Register vocabulary, primed names, flags (`condition-types.ts`, `-lexer`, `-parser`, `-bytecode`, DeZog printer) | M |
| History & reverse | `historyRecord.ts`, `flowKind.ts` (Z80 opcode tables), `registerDiff`, `historyCondition`, export columns, `reverseStep.ts`, the panel | **H** |
| Profile | `z80InstructionLength.ts` for coverage, `classify.ts`, `reach.ts` | M |
| Register writes | `SetZ80RegisterCommand`, automation `cpu.ts`, CLI `registersOf`/flag letters | M |
| `MachineController` | `SetReturn` pushes a Z80 return address | M |
| State files, `.klr`, reverse engine | Memory-image based, neutral apart from per-core lists | T |
| Source-level debugging (`SourceDebugInfo`) | Z80 back end only; out of scope (COMMODORE_PLAN §1 non-goals) | — |

## 2. The C side

### 2.1 Rename nothing; add twins and lift the neutral parts
Renaming the Z80 files would rebuild every core and touch the contract checker, the export lists and the
tests at once (wasm-core-debug's note on editing shared sources). Instead:
- **The debug loop becomes a CPU-parametrised include.** `z80-debug-loop.c` gains macros for what it
  reads from the CPU (`DEBUG_LOOP_PC()`, `DEBUG_LOOP_HISTORY_STOP_NOW()`, `DEBUG_LOOP_STEP()`), defaulting to
  today's Z80 expressions, so Z80 cores compile exactly the same code. The 6502 cores define them for an
  instance (`DEBUG_LOOP_STEP()` runs ticks until the next SYNC, serving the bus each cycle). Whether the
  file is later moved to a neutral path is decided after M1, when nothing else is changing.
- **`m6502-cpu-exports.c`** exports, with the same export-name pattern as the Z80's
  (`<prefix>GetCpuPc`, `GetStepOutAddress`, `GetInterruptDepth`, the access log), the 6502 registers A, X,
  Y, S, P, PC, plus `GetCpuKind`, the opcode-start PC, the cycle count and `jammed`. Machines with several
  CPUs export them **per CPU index** (`<prefix>GetCpuPc(cpuIndex)` for 6502 instances; the C128's Z80
  keeps the Z80 export names) (§4).
- **Conditions:** a second register-id range in `z80-condition.c` (`COND_REG_6502_A`… ) read through the
  existing `COND_REGISTER` hook, so the bytecode VM is shared; the Z80 ids keep their numbers.
- **History:** a **6502 record** (`m6502-history.c`): PC, A, X, Y, S, P, opcode bytes, cycle count, the
  CPU index, interrupt kind, and the machine context (banking) through the same `*_HISTORY_CONTEXT` hook;
  the ring, header, sequence, rewind and verify logic shared with the Z80's (lifted into a neutral
  `history-ring.c` only if that keeps the Z80 cores byte-identical; otherwise duplicated and noted as debt).
  The header carries a **record kind** so readers decode either.
- **Profile:** the coverage, heat map and physical-address funnel are shared; the 6502 call tracker maps
  JSR/RTS/BRK/IRQ/NMI/RTI onto the same event codes (CALL, RET, RST→BRK, INT, NMI); the Z80-only time
  buckets read zero.
- **Contract checker:** `check-wasm-cpu-contract.cjs` gets `mode: "m6502"` with its own include and
  export requirements (and a combined mode for the C128).

### 2.2 Volatile state
Everything the 6502 debug path writes that a fast frame does not (the access log, the capture flag, the
debug op start) is listed volatile in the build scripts, exactly as `debugLoopVolatileSymbols` does today
(trap T9), and the state-determinism test covers the new cores.

## 3. The TypeScript side

### 3.1 A CPU descriptor
`MachineInfo` gains `cpus: CpuDescriptor[]` (`{ kind: "z80" | "z80n" | "m6502", variant?: string, label:
string, index: number, addressSpace: string }`), with one entry for every Z80 machine (derived, so no
registry entry needs editing by hand) and two or three for the Commodore machines (C64: `cpu0` 6510,
`drive8` 6502; C128: `z80`, `m8502`, `drive8`). `MF_Z80` stays, derived from `cpus[0].kind`, so its
consumers keep working; new code asks the descriptor.

### 3.2 A neutral WASM machine base
- Split `IAnyCpu` into a neutral part (PC, SP, cycle/tact counters, frame data, opcode-start, step-out,
  interrupt depth, the access log) and `IZ80CpuExtras` (ports, snooze, `retExecuted`, prefixes). `IAnyMachine`
  extends the neutral part.
- `WasmMachineBase` holds what every WASM host shares today in `Z80MachineBase` minus `Z80Cpu`: the frame
  loop driver, `runWasmDebugLoop`, history/profile sources, memory and partitions, state. `Z80MachineBase`
  becomes `WasmMachineBase` + the Z80 register mirror, so Z80 hosts change only their base import.
  This is the largest TypeScript change; it lands in small commits, each with the full test tier green.
- `M6502WasmMachineBase` adds the 6502 register mirror, `getCallStack` from the core's shadow stack (not by
  reading words at SP), `getCallInstructionLength` (JSR = 3, BRK = 2) for step-over, and `SetReturn` for the
  6502 stack layout ($0100+S, return − 1, high byte first).

### 3.3 Messaging and panels
- `CpuState` becomes a discriminated union (`cpuKind`), with a `cpuIndex`. `getCpuState(cpuIndex?)`,
  `setRegister(cpuIndex, name, value)`; the Z80 path unchanged when the index is omitted.
- A **6502 CPU panel** (A, X, Y, S, P with flag letters NV-BDIZC, PC, the port $00/$01 with direction,
  the cycle counter, interrupt lines, `jammed`) on `@renderer/controls/data`, `ch` widths, row-size
  tokens, `--color-state-value`.
- A **new 6502 disassembler** (`disassemblers/m6502-disassembler/`), written fresh: all opcodes with the
  undocumented ones under an option, the same constructor signature as the Z80's, partition labels,
  custom per-machine hooks (KERNAL vectors as labels from Klive's own names, never from a commented
  disassembly). Every direct `new Z80Disassembler` (§1) goes through a `createDisassembler(machine)` helper.
- **Breakpoints panel:** memory and execution breakpoints are shared; the I/O kinds are hidden for a CPU
  without ports; on multi-CPU machines a breakpoint names its CPU (`drive8:$EB4B`).
- **Conditions and watch:** `ConditionEnvironment.cpu` replaces `isZ80`; the lexer/parser/bytecode take
  the register and flag vocabulary from the CPU kind (6502: `a x y s p pc` and flags `n v d i z c`);
  `debug.condition.z80Only` disappears.
- **History:** `historyRecord.ts` decodes both record kinds; `flowKind.ts` gets a 6502 table (JSR, RTS, RTI,
  BRK, branches, JMP); register diff, history conditions, CSV export and the panel take columns from the
  CPU descriptor; reverse step-over/out use the 6502 flow kinds.
- **Profile:** `z80InstructionLength.ts` gets a 6502 sibling chosen by CPU kind; `classify`/`reach` too.
- **Register writes:** `SetRegisterCommand` (renamed from the Z80 one, keeping the old command name as an
  alias), automation and CLI register lists from the descriptor.

## 4. Several CPUs in one machine

- **One debug target at a time.** The debugger acts on the machine's *current debug CPU* (a selector in
  the CPU panel's header and the Debug menu; default `cpu0`). Breakpoints may be set on any CPU; the core's
  stop table is per CPU (one 64K flag table per CPU address space), so a drive breakpoint stops the whole
  machine on the drive's instruction boundary.
- **Stepping:** step-into/over/out run the machine until the *selected* CPU reaches the next decision
  point; the other CPUs keep running cycle by cycle in between (they are one machine). On the C128 a step
  across an MMU write that switches CPUs ends on the other CPU, and the selector follows (C128 §10).
- **Time units:** the debugger shows the master tick count and each CPU's own cycle count; the existing
  "T-states" label becomes per-CPU text ("cycles" for a 6502, "T-states" for the Z80).
- **History** records the CPU index per record; the panel filters by CPU (default: the selected one).
- **Memory views** offer each CPU's address space (C64 `C:`, drive `8:`, as VICE's monitor names them,
  EXISTING §6.2).

## 5. Cross-core suites that must list the new cores
`test/wasm/debug-loop-equivalence.test.ts` (with 6502 programs and per-CPU stops), `wasm-shared-z80-cpu-contract`
(and a 6502 twin), `test/wasm/reverse/export-contract.test.ts`, `state/machine-state-determinism`,
`state/wasm-layout`, `audio-mixer-cores`, `history/*` (`historyCoreSuite.ts`, drivers), `profile/*`,
`condition/condition-cores`, `test/emu/debug-recording-cores`, `test/unit-tests/runner-machines`,
`test/machines/hardware-specs`, machine-select, new-project, menu-structure, CLI e2e. `test/vitest.setup.ts`
`CORE_EXPORT` gains the prefixes (`m6502`, `c64`, `vic20`, `c264`, `c128`).

## 6. The old TypeScript C64 (decision D4)
**Done on 2026-11-23** (branch `commodore-plan`), with every Commodore 64 mention in the app, the
docs and the live developer notes; closed plans keep theirs as history. `MI_C64` went too: the new
core adds it back. What was removed:
- **Code:** `src/emu/m6510Va/`, `src/emu/machines/c64/**`, `src/emu/abstractions/IM6510Cpu.ts`,
  `IM6510VaCpu.ts`, `FlagSetMask6510.ts`, `src/renderer/abstractions/IM6510Machine.ts`,
  `src/main/m6510-compiler/`, the M6510 error codes in `compiler-common/assembler-errors.ts`,
  `disassemblers/6510-disassembler/`, `asm6510LanguageProvider.ts`, `M6510CpuPanel.tsx`, `VicPanel.tsx`,
  `MachineFrameRunner.ts` if nothing else uses it, and `src/public/roms/c64-*.rom` (D2).
- **Wiring:** `src/renderer/registry.ts` (imports, the two panels, the `.6510.asm` file type, the language
  list), `image-defs.ts` (`file-6510-asm`), `src/cli/project.ts`, `constants.ts` (`MI_C64`, `MF_VIC`, `MF_M6510`), `machine-registry.ts`, `machine-renderer-registry.ts`, `hardware-specs.ts`
  (C64 entry rewritten in Phase 3), `headlessMachines.ts`, `unitTestMachines.ts`, `z88dk-targets.ts`,
  `condition-machine.ts`, `EmuApi.ts` (`getVicState`, `M6510CpuState`, `VicState`), `MainToEmuProcessor.ts`,
  the i18n keys (then `npm run i18n:keys`), `build/type-errors-baseline.json`, comment mentions.
- **Kept:** the TZX C64 block types (`TzxC64RomTypeBlock.ts`, `TzxC64TurboTapeBlock.ts`): tape-format
  support, not the machine.
- **Tests:** `test/c64/`, `test/m6510Va/`, `test/6510-assembler/`, `test/6510-disassembler/`, and the
  individual references (hardware specs, inject support, state commands, tape load, unit-test plumbing,
  condition tests, bank space, label breakpoints, history and profile layout lists, the project tests that
  use `"c64"` as the "no templates" case, which move to another machine without templates).
- **Docs:** the mentions in `docs/content/en/` (wasm cores, file types, state panels, disassembly, syntax
  colours, project explorer, z88dk, the book's introduction).
- Gate: `build:check`, `lint:renderer`, `i18n:check`, `test:fast`, the Vite build
  (`npx electron-vite build --config build/electron.vite.config.ts`), `doc:build` + `doc:check`.

## 7. Commit order (Phase 2)
1. Debug-loop CPU macros (Z80 defaults; byte-identical).
2. `m6502-cpu-exports.c`, conditions range, history and profile twins on the bare machine; contract
   checker mode.
3. `cpus` descriptor and derived `MF_Z80`.
4. `IAnyCpu` split; `WasmMachineBase`; Z80 hosts moved onto it (one commit per family if needed).
5. `M6502WasmMachineBase`; the bare machine as a test-only host.
6. `CpuState` discriminant, the 6502 panel, the disassembler and `createDisassembler`.
7. Conditions vocabulary; breakpoints panel; history/profile/reverse readers and UI.
8. Multi-CPU addressing (§4), proven on a two-CPU bare machine (two cores on one RAM, test-only).
9. Equivalence, budgets (wasm-core-debug D14) and determinism on the bare cores.
