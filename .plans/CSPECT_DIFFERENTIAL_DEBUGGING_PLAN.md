# CSpect Differential Debugging Plan

> **Note 2026-09-19:** the TypeScript Next core, one of this proposal's comparison tiers, is being
> retired by `ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`; plan any new tier against the WASM core and
> the VHDL.

Created: 2026-09-14

**Status:** proposal. No implementation started. **§12 carries the decisions the project author still
owes**, and three of them change the shape of the work rather than its details, so §10 should not be
read as an agreed sequence until §12 is answered.

**Update 2026-09-14 — §15 records the first real reproducer (the ScrollNutter demo) and the first
confirmed divergence from the FPGA VHDL.** It answers Q2 and Q7, narrows Q1, and demonstrates §13.1
the hard way: the defect it found is invisible to the existing TypeScript↔WASM harness.

The idea in one line: find ZX Spectrum Next emulation defects by running the *same* code in Klive and
in CSpect and locating the point where the two disagree.

The conclusion in one line: **Klive already owns most of the machinery** (§2), **CSpect is scriptable
enough to be the second implementation** (§3), and the two hard problems are not the plumbing — they
are that **CSpect cannot fill Klive's instruction record** (§4) and that **naive power-on comparison
diverges on storage emulation long before it diverges on anything worth fixing** (§5). §6 proposes a
layering that defers both problems instead of solving them up front.

This document separates, as the other plans in this folder do:

- **§2–§3 Facts** — verified. Klive facts carry `file:line`; CSpect facts carry a source URL and were
  read from the interface sources, not recalled.
- **§4–§5 The central problems** — where the idea meets something neither side can currently express.
- **§6–§10 Proposals** — each with its cost.
- **§12 Open decisions**, **§13 Risks**.

---

## 1. Goal

Make "the same program, two emulators, find the first disagreement" a repeatable, automatable
workflow, and turn every disagreement it finds into a permanent regression test.

The workflow must answer three questions in this order:

1. **Do Klive and CSpect disagree at all** on a given program?
2. **Where** — at which instruction, on which observable field?
3. **Which one is wrong** — because this is the question a two-way diff cannot answer (§13.1).

The primary targets are, in descending order of expected yield:

- **Z80N** opcode semantics, which has no public conformance suite (§6, layer 0).
- **NextReg** read/write semantics, including read-only, write-only, and partially decoded registers.
- **MMU / paging** interactions, especially DivMMC and ALTROM overlays.
- **DMA, Copper, sprites, tilemap** — device state machines.

Timing (T-state-exact contention, interrupt phase) is an explicit **non-target for the CSpect route**,
because the CSpect plugin API exposes no cycle counter (§4.2). It stays a target for layer 0.

---

## 2. What Klive already has

This is the load-bearing section. The work below is **not** "build a differential debugger" — it is
"add a third trace producer to a differential debugger that already works".

### 2.1 A headless, display-free, audio-free machine runner

`scripts/run-zxnext-frame-diff.cjs` (66 lines) rebuilds the WASM artifact when the C sources are
newer, then loads `scripts/run-zxnext-frame-diff.ts` through a Vite SSR server. No Electron window, no
renderer, no audio device. Driven by:

```text
npm run diff:zxnext-machine -- --model zxnext
```

with `--frames`, `--stop-pc`, `--fixture`, `--verbose` already parsed
(`scripts/run-zxnext-frame-diff.ts`, `parseArgs`).

### 2.2 A versioned binary per-instruction trace ABI

`src/emu/machines/zxNext/diagnostics/ZxNextFrameTrace.ts:14-18`:

```ts
export const ZXNEXT_FRAME_TRACE_MAGIC = 0x5854465a;
export const ZXNEXT_FRAME_TRACE_VERSION = 1;
export const ZXNEXT_FRAME_TRACE_HEADER_SIZE = 64;
export const ZXNEXT_FRAME_TRACE_RECORD_SIZE = 128;
export const ZXNEXT_FRAME_TRACE_CAPACITY = 160_000;
```

The 128-byte record layout is `ZxNextTraceRecordOffset` (`ZxNextFrameTrace.ts:39-79`): PC before and
after, all main and alternate register pairs, `IR`, `WZ`, `SP`, packed CPU flags, executed-instruction
and contention counters, last memory/port access, effective CPU speed, the raw MMU bytes, 16-byte read
and write maps, paging registers, and an extension hash.

Capacity is already justified against the 28 MHz frame domain: 560,000 ticks per 50 Hz frame, ~4 ticks
minimum per instruction, so ~140,000 records worst case, with 160,000 as the guard band
(`.plans/ZX_SPECTRUM_NEXT_FRAME_DIFF_RUNNER_PLAN.md` §"Diagnostics Capacity").

### 2.3 A comparator and a first-divergence report

- `compareZxNextFrameTraces` — `ZxNextFrameTrace.ts:375`
- `formatZxNextFrameTraceDifference` — `ZxNextFrameTrace.ts:427`
- `readTraceHeader` / `readTraceRecord` — `ZxNextFrameTrace.ts:314` / `:330`

The report shape is already the one this plan needs: last matching record, first differing field, PC
before and both PCs after, plus recent NextReg and port history.

### 2.4 A per-instruction hook that costs nothing when unused

Declared at `src/renderer/abstractions/IAnyMachine.ts:416`, called at
`src/emu/machines/MachineFrameRunner.ts:93` and `:193`, and assigned only for the traced frame at
`scripts/run-zxnext-frame-diff.ts:63`:

```ts
oracle.traceInstructionExecuted = pcBefore => oracleTrace.recordInstruction(pcBefore);
```

### 2.5 A repro fixture format

`scripts/run-zxnext-frame-diff.ts:25-36` — `FrameDiffFixture` with startup `registers`,
`memoryPatches`, and frame-indexed `keyEvents`. **This is already the state-seeding primitive §5 needs**;
it simply has not been pointed at a second process.

### 2.6 A track record

`.plans/ZX_SPECTRUM_NEXT_FRAME_DIFF_RUNNER_PLAN.md` records the defects this harness found against the
WASM core: NextReg `$06` hotkey/DivMMC-NMI bits, the `sigINT` rendered-tact phase, the DivMMC slot-0
overlay leaking into exported page maps, and port `$E3` gated on NextReg `$83` bit 4 instead of bit 0.
The method works. This plan changes only the second implementation.

### 2.7 Klive already knows where CSpect lives

`src/main/pasta80-integration/cli.md:88-90` documents `cspect` (noting `mono` is required off
Windows), `image` (the `tbblue.mmc` SD card image), and `hdfmonkey` (writing files into that image) as
configuration keys. A CSpect path setting therefore does not need inventing from scratch.

### 2.8 And how it launches a NEX today

`src/renderer/appIde/commands/NexLaunchCommand.ts` (`nex-run`) copies the file into the emulated SD
card under `_klive/` (`src/common/utils/nex-launch-paths.ts`, `NEX_SD_FOLDER`) and then drives
NextZXOS to **type** `.nexload <path>`. That is a deliberate decision — "a NEX is a program run *under*
NextZXOS, not a firmware image" — but it is also a determinism hazard for this plan, and CSpect offers
a way around it (§3.3).

---

## 3. What was established about CSpect

Read from the published plugin interface sources, not from memory.

### 3.1 Three levels of scriptability

**Level A — command line.** `CSpect -zxnext -nextrom -mmc=<path> file.nex` and similar. Sufficient to
launch, insufficient for instruction-level comparison. The published switch documentation is scattered
and inconsistent across versions; **take the authoritative list from the installed build**, not from
this document.

**Level B — the built-in DZRP socket, no code required.** Maziac's DeZog plugin has been *integrated
into CSpect* since **v2.19.0.3**. It listens on TCP **11000** and speaks DZRP v2.2.0: continue,
step-into, step-over, step-out, read registers, read memory, set breakpoints, read sprite patterns and
attributes. Port configurable via `DeZogPlugin.dll.config`.
Source: <https://github.com/maziac/DeZogPlugin/blob/main/Readme.md>

Cost: one socket round-trip per step. Acceptable for a bounded window, not for bulk tracing.

**Level C — a custom in-process plugin.** The route this plan recommends.
Sources: <https://github.com/mikedailly/CSpectPlugins/blob/master/Plugin/iPlugin.cs> and
<https://github.com/mikedailly/CSpectPlugins/blob/master/Plugin/iCSpect.cs>

### 3.2 The plugin lifecycle (`iPlugin`)

```csharp
List<sIO> Init(iCSpect _CSpect);   // returns the IO/address/key registrations
void Tick();                       // "once an emulation frame from the emulator thread"
void OSTick();                     // once a frame on the OS thread — for windows
bool Write(eAccess _type, int _port, int _id, byte _value);
byte Read(eAccess _type, int _port, int _id, out bool _isvalid);
bool KeyPressed(int _id);
void Reset();
void Quit();
```

`eAccess` registrations are `Port_Read`, `Port_Write`, `Memory_Read`, `Memory_Write`,
`NextReg_Write`, `NextReg_Read`, `Memory_EXE` ("CPU Execute (16bit address)"), `KeyPress`.

Two notes that matter:

- **`Memory_EXE` is a per-instruction execute hook**, and in that mode the byte returned from `Read`
  is "TStates to add". Registration is per-address through `sIO`, so tracing everything means
  registering 65,536 entries. **Unverified for practicality or cost** — treat as an optimization to
  measure, not as the design.
- `Tick()` is documented as once per frame, but CSpect's release notes state the plugin `Tick()` is
  also called while in debugger mode, which is what makes a plugin-driven step loop possible. The
  step loop therefore belongs in `Tick()`.

### 3.3 What a plugin can read and do (`iCSpect`)

```csharp
Z80Regs GetRegs();  void SetRegs(Z80Regs _regs);
int  Debugger(eDebugCommand _cmd, int _value = 0);
byte GetNextRegister(byte _reg, int _regindex = -1);
void SetNextRegister(byte _reg, byte _value, int _regindex = -1);
byte Peek(ushort _address);          byte[] Peek(ushort, int, byte[] = null);
byte PeekPhysical(int _address);     byte[] PeekPhysical(int, int, byte[] = null);
void Poke(ushort, byte);             void PokePhysical(int, byte);
byte InPort(ushort _port);           void OutPort(ushort _port, byte _value);
byte[] PeekSprite(...);  SSprite GetSprite(int);  void SetSprite(int, SSprite);
byte CopperRead(int);    void CopperWrite(int, byte);  bool CopperIsWritten(int);
uint GetColour(int _palette, int _index);  void SetColour(int, int, int);
object GetGlobal(eGlobal _item);  bool SetGlobal(eGlobal _item, object _value);
byte[] LoadFile(string _name);
void   LoadNex(string _name);
object Execute(string _command, params object[] args);
DissassemblyLine DissasembleMemory(int _address, bool _is24bit);
```

`eDebugCommand`: `none, SetRemote, GetState, Enter, Run, Step, StepOver, UnStep, SetBreakpoint,
ClearBreakpoint, ClearAllBreakpoints, GetBreakpoint, SetPhysicalBreakpoint, ClearPhysicalBreakpoint,
GetPhysicalBreakpoint, SetReadBreakpoint, ClearReadBreakpoint, GetReadBreakpoint, SetWriteBreakpoint,
ClearWriteBreakpoint, GetWriteBreakpoint`.

`eGlobal` includes `MMCPath, ZXNextMode, NextRom, ExitOpcode, BRKOpcode, DoQuit, pause, freerun,
last_frame, profile_read, profile_write, profile_exe`.

Four items deserve calling out:

1. **`LoadNex(string)`** — the plugin loads the NEX directly. No `.nexload` typing, no emulated
   keyboard, no NextZXOS command-line timing to reproduce. This removes the largest single source of
   run-to-run variance that §2.8 would otherwise impose.
2. **`Debugger(eDebugCommand.Step)` runs in-process** — no IPC per instruction. This is the only
   reason bulk tracing is viable at all.
3. **`GetNextRegister`** reads a NextReg *without* the side effects an `InPort` would cause. Required,
   not merely convenient, for a tracer that must not perturb the thing it measures.
4. **`UnStep` exists.** If it is a genuine step-back, a divergence could be inspected by reversing into
   it rather than re-running from a checkpoint. **Unverified** — worth an early experiment because it
   would materially simplify §10 M6.

### 3.4 The register set CSpect exposes

`Plugin/Z80Regs.cs` in full, for the fields that matter:

```csharp
UInt16 AF, BC, DE, HL, _AF, _BC, _DE, _HL, IX, IY, PC, SP;
byte R, I;  bool IFF1, IFF2;  byte IM;
```

That is the whole set. §4 is the consequence.

---

## 4. Central problem 1: CSpect cannot fill Klive's record

### 4.1 The field intersection

| Klive record field (`ZxNextTraceRecordOffset`) | Available from CSpect? |
|---|---|
| `PcBefore`, `PcAfter` | yes — `GetRegs()` around the step |
| `Af`…`HlAlt`, `Ix`, `Iy`, `Sp` | yes — `GetRegs()` |
| `Ir` | partly — `R` and `I` separately; recompose |
| `CpuFlagsPacked` (IFF1/IFF2/IM part) | yes — `GetRegs()` |
| `MmuRaw`, `ReadMap`, `WriteMap`, `PagingRegs` | **reconstruct** from `GetNextRegister($50–$57)` and friends — not a direct read |
| physical RAM, palette, sprites, copper | yes — `PeekPhysical`, `GetColour`, `GetSprite`, `CopperRead` |
| **`Wz`** (MEMPTR) | **no** |
| **`MachineTactsLow/High`, `FrameTact28After`** | **no** |
| `TotalContentionDelay`, `ContentionDelaySincePause` | **no** |
| `LastMemoryAddress/Value/Flags`, `LastPortAddress/Value/Flags` | **no** (short of `Memory_Read`/`Write` registrations, §3.2) |
| `CpuEffectiveSpeed`, `CpuTactScale` | partly — infer from NextReg `$07` |

### 4.2 There is no cycle counter in `iCSpect`

This is worth stating flatly because it bounds the whole approach: **the interface in §3.3 contains no
T-state or tick accessor.** `DissasembleMemory` returns static `TStates1`/`TStates2` from a table, and
`Memory_EXE`'s return value *adds* T-states rather than reading them. `eGlobal` offers `last_frame`
but nothing sub-frame.

Therefore **CSpect cannot be a timing oracle through this API.** Contention bugs, interrupt-phase
bugs, and `CpuTactScale` bugs are out of reach of a CSpect diff and must be pursued through layer 0
(§6) or against hardware.

**Partial mitigation.** NextReg `$1E`/`$1F` are the active-video-line registers, and Klive already
implements them as read-only (`src/emu/machines/zxNext/NextRegDevice.ts:62`, defined at `:964` and
`:976`). Sampling them through `GetNextRegister` on each traced instruction yields a
**scanline-resolution clock** on the CSpect side. That will not catch a 4-tick contention error, but it
will catch accumulated drift and gross interrupt-timing divergence — which is the class that actually
breaks real NEX files.

### 4.3 The consequence for the design

Do **not** widen or weaken the existing 128-byte record to accommodate CSpect. Define a **separate,
narrower record** — the *co-trace* record — holding only fields both sides can produce, plus the
`$1E`/`$1F` raster sample. Run two independent diffs:

- **full record**, TypeScript ↔ WASM — the existing `npm run diff:zxnext-machine`, unchanged;
- **co-trace record**, Klive ↔ CSpect — new.

One diff engine, two schemas. Sharing a schema across three producers would drag CSpect's limitations
into a comparison that does not have them.

---

## 5. Central problem 2: alignment

"Boot both, diff at instruction N" fails, and it fails expensively — the divergences it produces are
real but are almost all in the wrong subsystem.

### 5.1 Why power-on comparison does not work

1. **ROM and card contents.** One differing byte between CSpect's ROM/NextZXOS set and Klive's
   `src/public/roms`, or between the two SD images (`config.ini`, `.nextos` files, autoexec), and
   every instruction after that point diverges. The comparison is only meaningful if both sides are
   forced onto **byte-identical** ROM and card images.
2. **Boot is the worst available test case.** It is dominated by SD/FAT/esxDOS emulation, RTC reads,
   and keyboard scanning. The first several hundred divergences will be storage differences, not the
   Z80N and NextReg defects this plan targets.
3. **Uninitialised RAM fill patterns differ** between the two emulators.
4. **`R` drift** is an early and prolific false-positive generator whenever refresh accounting differs
   by a cycle.
5. **§2.8's `.nexload` typing route** injects keyboard timing into the very thing being measured.
   `LoadNex` (§3.3) removes this on the CSpect side; Klive would need an equivalent deterministic
   entry to match, which §2.8 records as a decision previously taken *against*.

### 5.2 The fix: never diff from power-on

Diff a **seeded window**. Capture a state from Klive, *impose* it on CSpect through `SetRegs`,
`PokePhysical`, and `SetNextRegister`, then step a bounded number of instructions and compare.

This is the same trick `FrameDiffFixture` (§2.5) already performs within one process; the work is to
make the fixture crossable. "Seed identically, compare a window, bisect" is tractable. "Boot both and
hope" is not.

### 5.3 The better fix, for most defects: remove alignment from the problem

See §7. A self-describing test payload needs no alignment at all.

---

## 6. Strategy: four layers, cheapest first

Ordering matters more than tooling. Each layer should be exhausted before the next is built, because
each later layer is an order of magnitude more expensive per defect found.

**Layer 0 — deterministic CPU conformance. No CSpect.** Public suites with known-good expected
output:

- **FUSE `tests.in` / `tests.expected`** — per-opcode, cycle-by-cycle bus activity, and
  MEMPTR-sensitive flag results. Cheap to wire into vitest, and **it covers the `Wz` field CSpect
  cannot report at all** (§4.1).
- **`SingleStepTests/z80`** — ~1000 randomized cases per opcode with full bus cycle lists.
- **ZEXALL / ZEXDOC** and raxoft **`z80test`** as ROM-level runs.

Rationale: if a base Z80 defect exists, a CSpect diff will rediscover it slowly and one divergence at
a time. Layer 0 finds the same defect in one run with an unambiguous expected value. **Z80N has no
public suite** — that gap is precisely what layers 1 and 2 are for.

**Layer 1 — a self-describing conformance payload run in both emulators.** §7. Recommended as the
first CSpect-involving work.

**Layer 2 — instruction-level co-execution tracing.** §8. The scalpel for what layer 1 cannot express.

**Layer 3 — regression capture.** Every confirmed defect becomes a fixture plus a vitest case, in the
format §2.5 already defines.

---

## 7. Layer 1: the conformance payload

**The proposal.** Rather than diffing execution traces, write a Z80/Z80N program that *is* the test: a
table of experiments, each writing its result into an output buffer, terminated by a sentinel. Run the
same NEX in both emulators. Compare **only the output buffer**.

Each experiment covers one narrow question — a Z80N opcode with edge-case operands, a NextReg
write-then-read-back, an MMU paging combination, a DMA descriptor, a short Copper program — and writes
a fixed-width record: experiment id, inputs, observed outputs.

**Why this should be built before §8:**

- **The alignment problem of §5 disappears entirely.** No seeding, no instruction counting, no ROM
  byte-identity requirement, no timing sensitivity.
- **Divergences are self-describing.** "Experiment 417: `MUL D,E` with `D=$FF, E=$FF` → Klive `$FE01`,
  CSpect `$0001`" instead of "frame 9, instruction 6618, field `af`".
- **It runs at full speed.** The entire Z80N and NextReg surface can be swept in seconds, so it is
  cheap to re-run on every change.
- **It is the natural host for seeded random differential fuzzing** — generate random opcode and
  NextReg sequences from a fixed seed, compare the final state hash. That finds the defects nobody
  would think to write a test for, and the self-describing record format makes the results actionable.
- **It needs no plugin at minimum.** A first version can dump the buffer by any means both emulators
  already support.

**The sentinel.** Use a **NextReg write to an agreed register/value** as the done-marker, *not*
CSpect's `exit`/`break` fake opcodes. sjasmplus exposes those under `--zxnext=cspect`
(`src/script-packages/sjasm/sjasm.ts:31` already documents "exit", "break", "clrbrk" and "setbrk"),
but **Klive does not implement them** — a grep for the pseudo-opcodes across `src/emu` finds nothing.
A NextReg sentinel keeps one payload binary portable to both emulators. Implementing the CSpect fakes
in Klive is a reasonable alternative, but it is extra work for no extra signal.

**Buffer extraction.** On the CSpect side, `PeekPhysical` in a plugin, or `SetGlobal(eGlobal.DoQuit)`
after writing the buffer to a file. On the Klive side, the headless runner already has full machine
access.

**Cost.** Moderate and mostly in the payload, not the tooling: the assembler integration, the runners,
and the differ are small. The experiment table is the real investment, and it is the part that keeps
paying.

---

## 8. Layer 2: the co-execution tracer

For defects layer 1 cannot express: timing-dependent behaviour, interrupt-dependent behaviour, and
long-running real software whose failure cannot be reduced to a table entry.

### 8.1 Shape

Record-then-compare, **not** lock-step. Mirror the decision already taken for the WASM diff — run each
side independently over a bounded window, write records, compare the buffers offline
(`.plans/ZX_SPECTRUM_NEXT_FRAME_DIFF_RUNNER_PLAN.md` §"Runner Shape": "Run the two implementations
sequentially, not interleaved instruction by instruction"). Lock-step adds synchronization cost and
buys nothing that a bounded window does not already give.

### 8.2 The CSpect-side producer

A `KliveTrace` CSpect plugin:

1. `Init` registers a trigger — a hotkey via `eAccess.KeyPress`, or a NextReg write via
   `eAccess.NextReg_Write` so the payload itself can start and stop tracing.
2. On trigger: `LoadNex` if required, apply the seed state (`SetRegs`, `PokePhysical`,
   `SetNextRegister`), then enter the step loop in `Tick()`.
3. Step loop: `Debugger(eDebugCommand.Step)`, then `GetRegs()`, the NextReg samples including
   `$1E`/`$1F`, and append one co-trace record to a preallocated buffer.
4. On window end or record-count limit: flush the buffer to a file and `SetGlobal(eGlobal.DoQuit)`.

**Build wrinkle, macOS.** CSpect runs under **mono** off Windows (already noted in
`src/main/pasta80-integration/cli.md:88`). The plugin must target .NET Framework 4.x; `dotnet build`
against `net48` works on macOS via the `Microsoft.NETFramework.ReferenceAssemblies` package. Verify
this before committing to the plugin route — if it proves painful, Level B (§3.1, DZRP on port 11000)
provides a no-C# fallback at reduced window size.

### 8.3 The Klive-side producer

A co-trace mode on the existing runner (`--co-trace-out <file>`), or a sibling
`scripts/run-zxnext-cotrace.ts`, reusing `traceInstructionExecuted` (§2.4) with a recorder that emits
co-trace records rather than full ones.

### 8.4 The differ

A new comparator over the co-trace schema, reusing the report shape of
`formatZxNextFrameTraceDifference` (`ZxNextFrameTrace.ts:427`) verbatim — same "last matching record /
first differing field / PC before and both PCs after" output, so one set of eyes reads both diffs.

---

## 9. Non-goals

- Do not widen `ZXNEXT_FRAME_TRACE_RECORD_SIZE` or weaken the existing full record to fit CSpect (§4.3).
- Do not change the behaviour of `npm run diff:zxnext-machine`.
- Do not build a renderer-facing UI in any slice of this plan.
- Do not attempt T-state-exact comparison against CSpect (§4.2). Raster-line granularity is the ceiling.
- Do not diff from power-on until §7 is exhausted (§5.1).
- Do not treat a CSpect disagreement as a Klive defect without adjudication (§13.1).
- Do not lock-step the two emulators instruction by instruction (§8.1).
- Do not implement CSpect's `exit`/`break` fake opcodes in Klive as a prerequisite (§7).

---

## 10. Milestones

Layer 0 and layer 1 are independent of each other and of the CSpect plugin, so M1–M3 can proceed in
parallel with M4–M6.

**M1 — Layer 0: FUSE test suite harness.** Import `tests.in`/`tests.expected`, run against both Z80
cores, report per-opcode failures. Closes the `Wz`/MEMPTR gap and establishes a base-Z80 clean sheet
before any cross-emulator work begins.

**M2 — Layer 0: `SingleStepTests/z80` harness.** Same shape, randomized coverage, bus cycle lists.

**M3 — Layer 0: ZEXALL/ZEXDOC and `z80test` as headless ROM runs** on the existing runner.

**M4 — Layer 1: the conformance payload.** Assembler integration, the experiment record format, the
NextReg sentinel, an initial Z80N experiment table, buffer extraction on both sides, and the differ.
**This is the milestone most likely to find real defects per unit of effort.**

**M5 — Layer 1: seeded random differential fuzzing** on top of M4's payload and differ.

**M6 — Layer 2a: the co-trace schema and the Klive producer.** Own magic and version, little-endian,
fixed-size, word-aligned, same conventions as §2.2. Plus the differ (§8.4). Testable and useful before
CSpect exists — Klive can co-trace against itself to validate the schema and the report.

**M7 — Layer 2b: the CSpect `KliveTrace` plugin** (§8.2). Gate this on the `net48`/mono build spike.

**M8 — Layer 2c: the cross-process seed handshake.** Klive exports a state snapshot; the plugin
imposes it. **This is the milestone that decides whether layer 2 works at all**, and it should be
attempted on a deliberately trivial case before M7 is polished.

**M9 — Layer 2d: the bisect driver.** On divergence at instruction *k*, re-run from the prior
checkpoint with full per-instruction capture. If `eDebugCommand.UnStep` (§3.4) is a real step-back,
this milestone shrinks considerably — spike it during M7.

**M10 — Layer 3: regression capture.** Every confirmed defect becomes a fixture plus a vitest case.

---

## 11. Acceptance criteria

- **M1–M3:** each suite runs headless, in CI, with a recorded baseline of known failures in the style
  of `build/type-errors-baseline.json` — failing on *new* failures, not on the existing backlog.
- **M4:** one command runs the payload in both emulators and prints either "N experiments, all agree"
  or a self-describing list of disagreements. Adding an experiment requires touching one table.
- **M6:** Klive co-traces against itself with zero divergences over a full frame, proving the schema
  and comparator before a second process is involved.
- **M8:** a state seeded from Klive into CSpect reproduces identical co-trace records for at least
  1,000 instructions on a payload with interrupts disabled and no storage access.
- **M9:** given a known divergence, the driver localizes it to a single instruction with full state on
  both sides, without a human editing the fixture.
- **Overall:** at least one defect found, adjudicated against a third reference (§13.1), fixed, and
  captured as a regression test — before the plan is considered validated.

---

## 12. Open decisions

These are the project author's, and the first three change the shape of §10.

**Q1 — Which defect class is actually being chased?** **Narrowed by §15** — the first confirmed defect
is a device state machine (copper), which the VHDL adjudicates and CSpect's API largely cannot (§4.2).
 Z80N semantics, NextReg/MMU semantics,
DMA/Copper/sprites, or timing? If the answer is **timing**, CSpect is a weak oracle (§4.2) and the plan
should tilt almost entirely to layer 0 plus hardware comparison, deferring §8 indefinitely.

**Q2 — Is there a reproducer NEX that misbehaves today, or is this fishing?** **Answered: yes — see
§15.** ScrollNutter renders its loading screen and then goes black.
 A concrete failing NEX
justifies jumping to a seeded window (M6–M8). Fishing argues strongly for M4 first.

**Q3 — Is a maintained C# plugin acceptable?** If not, Level B (DZRP on port 11000) caps window size
but needs no C#, and §8.2 collapses into a Node client. This is a maintenance-appetite question, not a
technical one.

**Q4 — Layer ordering: accept §6, or go straight to §8?** This plan argues for layer 1 first on the
grounds that it is roughly a tenth of the work and likely finds more defects per week. That argument
should be accepted or rejected explicitly, because it is the plan's main claim.

**Q5 — Does Klive get a deterministic direct NEX load** to match CSpect's `LoadNex`, reopening the
decision recorded in §2.8 (`.plans/NEX_DEBUGGING_IDEAS.md` §5.4, marked out of scope)? Layer 1 does
not need it. Layer 2 wants it. It can stay a debug-only path that the product does not expose.

**Q6 — Where do the ROM and SD card images come from?** §5.1 requires byte-identity. Is there an
agreed pinned ROM set and card image both emulators can be pointed at, and does it live in the repo,
in `artifacts/`, or outside version control?

**Q7 — What is the third reference** for adjudication (§13.1)? **Answered: the FPGA VHDL** at
<https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA>, proven decisive on first use (§15.5).
 The open-source Next FPGA core VHDL,
real hardware, or the specification text?

---

## 13. Risks

**13.1 CSpect is not ground truth — and this is the central risk.** It is closed-source and it is a
second opinion, not a specification. Every divergence requires adjudication against a third reference,
and **"CSpect is wrong" is a real and not-rare outcome**, especially on timing and obscure NextReg
corners. A two-way diff answers *where* but never *which*. Budget for the third reference from the
start (Q7) rather than discovering the need after the first ten divergences.

**13.2 The false-positive flood.** Without §5.2 seeding and §5.1 byte-identity, early runs will produce
many divergences, nearly all uninteresting. The risk is not that the tool fails but that it succeeds
loudly enough to waste weeks. Mitigation: §6 ordering, and an explicit triage rule — a divergence in a
subsystem outside Q1's answer gets recorded and deferred, not investigated.

**13.3 CSpect version drift.** The plugin API has grown across versions (debugger control in
`eDebugCommand`, `Tick()` during debug mode, `LoadNex`). Pin an exact CSpect version in the harness
and record it in every report, or divergences will become unreproducible.

**13.4 Step-loop throughput.** Unmeasured. A Next frame is ~140,000 instructions worst case (§2.2), so
a multi-frame window is millions of steps through `Debugger(Step)` plus a `GetRegs()` allocation each
— note `Z80Regs` is a **class**, so `GetRegs()` allocates per call and the loop will produce GC
pressure. Measure before designing around it; consider whether `Memory_EXE` (§3.2) avoids the step
loop entirely.

**13.5 `net48` under mono on macOS.** Plugin build viability is unverified (§8.2). Spike it before M7.

**13.6 Scope.** Layers 0 and 1 are self-contained and independently valuable. Layer 2 is a
multi-milestone investment whose payoff depends on Q1 and Q2. The plan is deliberately structured so
that stopping after M5 still leaves Klive materially better tested.

---

## 14. Implementation Log

**2026-09-14** — §15 investigation; the copper vertical-origin fix in both cores (§15.9); the WASM
core's copper tick wired into the C tact loop (§15.10); the frame-1 initialization gap in
`Z80MachineBase.reset()` (§15.11); the lost-keystroke and OS-readiness defects in the NEX launch flow
(§15.12), and two further defects in the same flow — capitals encoded with the wrong shift, and a
sync point that matched instantly (§15.13), and finally the root cause — `$1202` is a generic key-wait loop, not a prompt marker
(§15.14); the entry-point reveal (§15.15); NEX banks opening as code (§15.16); following the PC rather than the entry point (§15.17); three defects in the revealed document
(§15.18); branch prediction in a popped-out bank (§15.19); and a bank breakpoint with no sign of itself
(§15.20). NextReg `$7F` being write-only in the TypeScript core
(§15.10a) remains open, as do the two items in §15.12d.

---

## 15. First reproducer: ScrollNutter

Added 2026-09-14, after the plan's first draft. This section is **evidence, not speculation** — it
records what was measured, what was compared against the VHDL, and which of the two findings is
confirmed. It answers Q2 and Q7 and narrows Q1.

### 15.1 The symptom

`_experiments/testprojects/disann/ScrollNutter.nex` (410,624 bytes) runs correctly under CSpect. Under
Klive: **the Layer 2 loading screen appears and is correct, then a few seconds later it disappears and
the screen stays black.**

That the loading screen renders is itself a strong result — it means the `.nexload` path, Layer 2
display, the palette, and bank loading all work. The defect is at or after the handoff from `.nexload`
to the demo, and the loading screen actively *going away* means something reconfigured the display
rather than the demo simply crashing (a crash into ROM would leave the BASIC screen visible, not
black).

### 15.2 What the NEX declares

Parsed with Klive's own field offsets (`src/renderer/appIde/DocumentPanels/Next/nexFileLoader.ts:40-70`),
cross-checked against the authoritative `_input/nexload.asm` (`HEADER_ENTRYBANK = 139`, `:95`):

| Field | Value |
|---|---|
| Version | NEX **V1.1** |
| RAM required | 768K |
| Banks | 22 — banks 0, 2, 5, 12, 13, 14–30 |
| `screenBlockFlags` | `0x01` — **Layer 2 loading screen**, with a 256-entry palette block |
| `SP` / `PC` | `$BF2D` / `$5C50` |
| Entry bank | 0 |

Layout check: header 512 + palette 512 + Layer 2 screen `0xC000` = bank data begins at file offset
`0xC400`; laying the 22 banks down in NEX load order (5, 2, 0, 1, 3, 4, 6…) ends at exactly 410,624 =
the actual file size. The offsets are therefore trustworthy. `PC=$5C50` lives in bank 5, at file
offset `0xE050`.

### 15.3 The measurement: a NextReg write histogram

Scanning the whole file for the Z80N NextReg opcodes — `ED 91 rr nn` (`nextreg rr,nn`) and
`ED 92 rr` (`nextreg rr,a`) — and attributing each hit to its bank gives a picture of which devices
the demo drives.

**Written by Z80 code:**

```
$54 $55 $56 $57   MMU slots 4-7        $40 $41 $43 $44   palette index/value/control
$34 $35 $36 $37 $38   sprite attrs     $18 $19 $1A       clip windows (L2 / sprites / ULA)
$61 $62           COPPER address + COPPER control
```

**Never written by Z80 code:**

```
$12 $13   Layer 2 active/shadow page      $16 $17 $71   Layer 2 X/Y scroll
$69       display control 1               $70           Layer 2 resolution/control
$6B $6E $6F $2F $30 $31   tilemap         $22 $23       line interrupt
```

**Every register that would put a picture on the screen is absent from the Z80 code.** They are inside
the copper list. The demo uploads a copper program, points `$61`/`$62` at it, and hands the display to
the copper for the remainder of the run.

Caveat, stated honestly: the scan sees only the Z80N opcodes. There are 3 `ld bc,$243B` occurrences, so
a small number of writes could go through the port path with a computed register number. The
distribution is lopsided enough to be convincing, but it is evidence, not proof.

**This technique is reusable and cheap**, and it belongs in the toolbox: a NextReg histogram of any NEX
says which devices it exercises before a single instruction is emulated. Consider promoting it to a
small script under `scripts/` — it is a natural companion to the §7 conformance payload and costs
almost nothing.

### 15.4 The diagnosis

A copper defect produces exactly this symptom, including the part that looked confusing:

1. `.nexload` sets Layer 2 up with plain Z80 `NEXTREG` writes (`_input/nexload.asm:367-432`:
   `NEXTREG_nn 18,9`, `19,12`, `22,0`, `23,0`, clip window `24,…`, palette `67,16`). **That works** —
   hence a correct loading screen.
2. The demo starts, tears the loading screen configuration down, uploads its copper list, starts the
   copper.
3. If the copper does not run, nothing ever reprograms the display again. **Black screen.**

### 15.5 The VHDL comparison

Source: `cores/zxnext/src/device/copper.vhd`, 125 lines, at
<https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA>. Compared line by line against
`src/emu/machines/zxNext/CopperDevice.ts` and
`src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.c`.

**Klive's copper logic is a faithful translation of the hardware.** Verified equivalent: the
mode-change reset (reset the list pointer on a change to `01`/`11`, clear `dout` on any change), the
two-phase MOVE via `dout`, the WAIT compare `vcount = data(8 downto 0) and hcount >= data(14 downto
9)&"000" + 12`, NOP suppression when `data(14 downto 8) = "0000000"`, the 10-bit list-address wrap,
the big-endian word fetch from the 2 KB byte memory, and the `$63` byte-pair commit. This search was
looking for a logic defect and did not find one.

Two divergences did fall out.

#### 15.5a Correction: the earlier reading of NextReg `$64` was wrong

**The first draft of this section claimed the hardware copper compares raw `vcount` and that Klive's
use of NextReg `$64` inside the copper was therefore spurious. That was wrong, and it is corrected
here rather than quietly edited away.**

It is true that the `copper.vhd` entity has no offset input — its entire port list is `clock_i,
reset_i, copper_en_i, hcount_i, vcount_i, copper_list_addr_o, copper_list_data_i, copper_dout_o,
copper_data_o`. But the offset is applied **upstream**. `zxnext.vhd:3950` wires the copper as
`vcount_i => cvc`, not `=> vc`, and `cvc` is built in `zxula_timing.vhd:458-472`:

```vhdl
if ula_max_hc = '1' then
   if ula_min_vactive = '1' then
      cvc <= unsigned ('0' & i_cu_offset);   -- load NextReg $64 at the first active line
   elsif cvc = c_max_vc then
      cvc <= (others => '0');
   else
      cvc <= cvc + 1;
   end if;
end if;
```

with `i_cu_offset => nr_64_copper_offset` (`zxnext.vhd:6723`). So the copper *does* see an offset
vertical counter; the offset simply lives in the timing module rather than the copper.

That counter is equivalent to:

```
cvc = (vc - displayYStart + copperOffset) mod totalVC
```

because it is loaded with the offset at the first active video line and wraps at `c_max_vc` — which is
310 at 50Hz and 263 at 60Hz (`zxula_timing.vhd:204,238`), exactly `totalVC - 1` for Klive's 311 / 264
(`screen/TimingConfig.ts:39,58`). The moduli agree.

`NextComposedScreenDevice`'s use of the offset is therefore **correct and required**, not a double
application: the hardware feeds the same `cvc` to the line interrupt (`zxula_timing.vhd:577`) and to
NextRegs `$1E`/`$1F` (`zxnext.vhd:5983-5986`).

#### 15.5b Confirmed: the copper's vertical origin was wrong by `displayYStart`

§15.5b of the first draft hypothesized a counter-origin error. **It is confirmed, and the VHDL gives
its exact size.** Both cores computed:

```
adjustedVC = (vc + copperOffset) mod totalVC
```

omitting the `- displayYStart` rebasing. `displayYStart` is **64** lines at 50Hz and **40** at 60Hz
(`screen/TimingConfig.ts:35,54`), so every copper WAIT was evaluated against a line number 64 off from
the hardware's — permanently, even with NextReg `$64` at zero.

The counters feeding it were verified to be the genuine ULA `vc`/`hc`: `_copperCurrentLine` /
`_copperCurrentColumn` (`ZxNextMachine.ts:1633-1637`) reset per frame and count rendered tacts, which
is exactly `tactToVC[tact] = (tact / totalHC) | 0` and `tactToHC[tact] = tact % totalHC`
(`NextComposedScreenDevice.ts:4550-4552`).

A copper program that sets its display registers at specific raster lines therefore ran every one of
them 64 lines away from where the demo intended.

#### 15.5c The larger defect: the WASM core never ticks the copper at all

Found while wiring the fix, and **more serious than the offset error**.

`zxnextCopperTick` is exported (`wasm/zxnext/zxnext.c:470`, and listed in
`wasm/ZxNextWasmV2Loader.ts:565` and `scripts/build-zxnext-wasm.cjs:197`), and
`zxnext-nextreg.c:132` correctly routes `$60`-`$64` writes into the copper, so copper lists upload and
control registers take effect. But **nothing calls the tick during emulation**. Its only caller in the
entire repository is `test/wasm/zxNext/wasm-next-copper.test.ts`, which drives it by hand.
`ZxNextWasmV2Machine.ts` contains **zero** references to the copper.

The architectural reason is visible in `wasm/zxnext/zxnext-frame.c`: `zxnextFrameExecute` is just
`while (!frameCompleted) zxnextCpuExecuteInstruction();`, and the screen is produced by
`zxnextUlaRenderInstantScreen` (`wasm/zxnext/zxnext-ula.c:900`) — a whole-frame renderer. **There is no
per-tact beam in the WASM core to hang a raster device off.** A copper is inherently a beam-position
device, so wiring it requires introducing a per-tact or per-line advance that the instant renderer
deliberately avoids for performance.

**Resolved in §15.10.**

### 15.6 The observation that remains

With §15.5b fixed in the TypeScript core, the remaining question is **which core the run used**.
`ZxNextMachineFactory.ts:16-18` selects between `ZxNextWasmV2Machine` and `ZxNextMachine` on the
`implementation` config value.

- **TypeScript core** — re-run ScrollNutter. The 64-line copper error is gone; if the demo still fails,
  break and read `copperDevice.getState()`. A frozen list address with `listData & 0x8000` means the
  copper is still stalled on a WAIT; a cycling address means the copper runs and the defect is
  downstream, at which point `cores/zxnext/src/video/layer2.vhd` is the next module to read.
- **WASM core** — the demo cannot work regardless, because the copper never executes (§15.5c). Confirm
  by running the same NEX on the TypeScript core.

### 15.7 Why the existing TS↔WASM harness cannot find this

`npm run diff:zxnext-machine` reports a **match** on this defect. The TypeScript and C coppers are
line-for-line ports of each other — the same `adjustedVC`, the same everything — so they are wrong
*identically* and agree perfectly.

This is a concrete demonstration of §13.1 and it is the strongest single argument in this plan: **a
self-consistent pair of implementations validates nothing.** CSpect and the VHDL are the only oracles
that can see this class of defect, and the first real reproducer landed squarely in it.

### 15.8 What this changes about the plan

- **Q2 is answered** — there is a reproducer, so the layer-1 fishing expedition (§7, M4) is no longer
  the obvious first move for *this* defect. It remains the right investment for breadth.
- **Q7 is answered** — the FPGA VHDL is the third reference, and it proved decisive on first contact:
  125 lines settled a question CSpect could only have hinted at.
- **Q1 is narrowed** — the first real defect is a **device state machine** (copper), not Z80N
  semantics and not timing-in-the-contention-sense. But note that it *is* timing-adjacent: it is about
  the beam-position domain the device compares against, which CSpect's plugin API cannot report
  (§4.2). The VHDL, not CSpect, is the tool for this class.
- **The §7 payload gains an obvious first experiment group**: copper programs with known WAIT targets
  and known MOVE effects, verifiable from the Z80 side by reading back the registers the copper wrote.
  That is a self-describing test for exactly the subsystem that just failed.
- **A method worth keeping** (§15.3): histogram a NEX's NextReg writes to find which devices it
  exercises, *before* debugging it. It turned "black screen, no idea" into "the display is
  copper-driven" in one pass.

### 15.9 The copper origin fix

**Applied (2026-09-14).** The copper vertical origin, in both cores, mirroring the hardware's own
decomposition — `zxula_timing.vhd` computes `cvc`, `copper.vhd` consumes it and owns no offset logic:

- `screen/NextComposedScreenDevice.ts` — new `vcToCopperLine(vc)` holding the single `cvc` formula;
  `activeVideoLine` now derives from it, so the copper, the line interrupt and NextRegs `$1E`/`$1F`
  cannot drift apart.
- `CopperDevice.ts` — `executeTick(cvc, hc)` now takes an already-rebased copper line and performs no
  offset arithmetic, matching `copper.vhd`.
- `ZxNextMachine.ts` — the call site converts, guarded on `startMode` so a stopped copper still costs
  nothing in the per-tact loop.
- `wasm/zxnext/zxnext-copper.c` / `.h`, `wasm/zxnext/zxnext.c` — the same change in C;
  `zxnextCopperTick(cvc, hc)` loses its `totalVc` parameter.
- Tests — "Step 7" rewritten to exercise the offset at the new seam; a new
  "copper vertical line (hardware `cvc`)" block asserts the rebasing directly, including that a WAIT
  for copper line *N* fires at ULA line `displayYStart + N` and **not** at ULA line *N*. That last
  assertion is the one that would have caught this.

Verification: `test/zxnext` + `test/wasm/zxNext` — 131 files, 5,443 tests pass; `npm run build:check`
reports no new type errors; `npm run check:zxnext-wasm-size` within budget.

**Then open, now resolved.** §15.5c is addressed in §15.10.

### 15.10 Wiring the copper into the WASM core

Of the three options §15.9 listed, the middle one was taken: **a per-tact copper beam inside the C
core**, alongside the instant renderer. Driving the tick from `ZxNextWasmV2Machine` would have put a
WASM-boundary crossing on every memory and port access, and converting the core to per-tact rendering
is a far larger change that nothing yet requires.

**Where it hooks.** `zxnextCpuTactPlusN` in `wasm/zxnext/zxnext-cpu.c` is the C equivalent of
`ZxNextMachine.onTactIncremented`: it is called for every tact group and maintains
`currentFrameTact = frameTacts28 >> 2`, which is the same ULA tact domain the TypeScript counters use.
The copper advance goes immediately after that assignment.

**The beam.** `zxnext-copper.c` gains `zxnextCopperFrameTact` / `zxnextCopperCurrentLine` /
`zxnextCopperCurrentColumn`, mirroring `_copperCurrentLine` / `_copperCurrentColumn` — same domain,
same per-frame reset — so the two cores stay comparable. `ZXNEXT_COPPER_TOTAL_VC` is derived as
`ZXNEXT_RENDERING_TACTS_IN_FRAME / ZXNEXT_SCREEN_TOTAL_HC` rather than restated, so the geometry
cannot disagree with itself.

**Three details that matter:**

1. **A stopped copper costs one compare.** `zxnextCopperAdvanceTo` returns immediately when the start
   mode is zero rather than maintaining counters, because it sits on the hottest path in the core and
   the overwhelmingly common case is software that never touches the copper. The counters are brought
   back to the present by `zxnextCopperResyncBeam` at the moment `$62` starts the copper.
2. **The frame boundary resets the beam**, via `zxnextCopperOnFrameCompleted` called from
   `zxnextCpuMarkFrameCompleted` — equivalent to `onInitNewFrame` resetting the counters at frame
   start, since nothing ticks in between.
3. **`if (frameCompleted == 0u)` guards the advance**, mirroring `onTactIncremented`'s early return. A
   frame can complete part-way through an instruction, and the remaining tact groups of that
   instruction must not tick the copper into the next frame.

**The test that was missing.** `test/wasm/zxNext/wasm-next-copper-integration.test.ts` drives real
frames rather than calling the tick by hand, and asserts the copper advances its own program counter
and delivers a MOVE to a NextReg. The pre-existing `wasm-next-copper.test.ts` passed throughout the
entire period the copper was inert, because it called `zxnextCopperTick` directly — **a component test
that cannot fail when the integration is missing.** The probe register is NextReg `$7F` (user register
0), which nothing in the boot sequence writes.

**Verification:** `test/zxnext` + `test/wasm/zxNext` — 132 files, 5,446 tests pass;
`npm run build:check` no new type errors; `npm run check:zxnext-wasm-size` within budget;
`npm run diff:zxnext-machine -- --frames 1` still reports no differences;
`npm run benchmark:zxnext-wasm` meets every threshold, the stopped-copper fast path doing its job.

#### 15.10a Two unrelated defects found while testing

Neither is fixed — both are recorded here rather than folded silently into this change.

- **NextReg `$7F` is write-only in the TypeScript core.** `NextRegDevice.ts:1692-1695` registers a
  `writeFn` storing to `userRegister0` but no `readFn`, so reading `$7F` back yields `$FF` while the
  WASM core returns what was written. User register 0 is read/write on hardware.
- **The TypeScript core renders nothing on frame 1 after construction or reset.** **Fixed — §15.11.**
  `lastRenderedFrameTact` is assigned only in `onInitNewFrame` (`ZxNextMachine.ts:1570`), and
  `MachineFrameRunner.ts:46` calls that only once a *previous* frame has completed. On a fresh machine
  the field is `undefined`, so `while (this.lastRenderedFrameTact < this.currentFrameTact)`
  (`ZxNextMachine.ts:1632`) never runs — **neither the copper nor `renderTact` executes for the whole
  of frame 1.** The WASM core has no equivalent gap, so this is also a live TS↔WASM divergence. The fix
  looks like a one-line initialisation, but it will move the rendering baseline, so it wants its own
  change and its own verification.

### 15.11 The frame-1 initialization gap

The second defect in §15.10a turned out to be broader than "the copper does not tick on frame 1", and
the fix reaches every Z80 machine, not just the ZX Next.

**The contract.** `MachineFrameRunner` (`MachineFrameRunner.ts:46-63`, and the same shape in the debug
loop at `:162`) begins each iteration with:

```ts
if (machine.frameCompleted) {
  // ... clock multiplier update ...
  machine.onInitNewFrame(clockMultiplierChanged);
  machine.frameCompleted = false;
  machine.emulateKeystroke();
}
```

So `frameCompleted` is not a statement about history — it is the runner's **"start a new frame"**
signal, and `onInitNewFrame()` is the only place per-frame setup happens.

**The defect.** `Z80MachineBase.reset()` set `this.frameCompleted = false`. After a reset no frame is
in progress, so the next execution must begin one; `false` made the runner treat the very first frame
as the continuation of a frame that had never started. **Everything in `onInitNewFrame()` was skipped
for frame 1** — on the ZX Next that is `lastRenderedFrameTact = 0`, the copper beam counters, the
screen/beeper/CTC/audio/I²C/UART/floppy per-frame hooks, and the queued-keystroke emulation.

The symptom that exposed it: `lastRenderedFrameTact` is declared without an initializer
(`Z80MachineBase.ts:197`), so it was `undefined`, and `while (this.lastRenderedFrameTact <
this.currentFrameTact)` (`ZxNextMachine.ts:1632`) is silently `false` rather than an error. **An entire
frame rendered nothing and no test noticed.**

**The fix.**

- `Z80MachineBase.reset()` now sets `frameCompleted = true` — "no frame in progress, begin one".
- `lastRenderedFrameTact` is defaulted to `0` at its declaration, so the `undefined <` failure mode
  cannot recur silently.

Both were checked against every consumer of the flag before changing it: `MachineController.ts:669`
reads `frameJustCompleted` only *after* a frame has executed, and both WASM loops
(`ZxNextWasmV2Machine.ts:714-716` and the `zxnextExecuteFrame` fast path) clear or ignore the flag
before their own `while (!frameCompleted)`, so none of them can be short-circuited by the new initial
value.

**The behavioural change this causes, stated plainly.** Per-frame device hooks now fire **once per
executed frame** instead of once per frame-after-the-first. `test/disk/FloppyControllerDevice.test.ts`
measured the old count directly: 11 frames of motor acceleration at 2 units per frame produced 20
rather than 22. Those expectations were updated to the correct count, not silenced — 11 frames should
advance the motor 11 times. Floppy motor spin-up therefore now begins one frame earlier.

`test/disk/TestUpd765Machine.ts` also needed a real `readScreenMemory`: it had thrown
"Method not implemented" behind a comment saying the method was not needed, which was only true while
frame 1 rendered nothing. That it started being called is direct evidence the fix does what it claims.

**Verification:** the full suite — **735 files, 21,465 tests pass**; `npm run build:check` no new type
errors; `npm run diff:zxnext-machine -- --frames 1` still reports no TS↔WASM differences;
`npm run check:zxnext-wasm-size` within budget.

**Not fixed, noted in passing:** `C64Machine.ts:143-144` defines
`get frameJustCompleted() { return this.frameJustCompleted; }` — an unconditional infinite recursion
if anything ever reads it. Unrelated to this change and left alone.

### 15.12 Lost keystrokes when launching a NEX

Reported while testing the copper work: launching `ScrollNutter.nex` from the NEX viewer typed only
`,utter.nex` instead of `.nexload ScrollNutter.nex`. Sixteen of twenty-five characters lost, always a
prefix, with the first surviving character corrupted.

**Not caused by §15.11.** On the WASM core `emulateKeystroke()` is called from
`ZxNextWasmV2Machine`'s own overrides — unconditionally at `:578` in the `zxnextExecuteFrame` fast
path and at `:722` in the debug loop — not from the frame-init block that §15.11 changed. Keystroke
cadence there is untouched by `frameCompleted = true`.

#### 15.12a Root cause: two clocks with nothing between them

Keystrokes **expire in emulated tacts**: `queueKeystroke` set `startTact = this.tacts` and
`endTact = startTact + frames * tactsPerFrame`, a five-frame window anchored to the moment of
queueing. They are **played back on the machine's clock**: `emulateKeystroke` touches only the head
of the queue and performs at most one action per call — press, *or* release-and-shift — once per
frame. But they are **enqueued on the host's wall clock**: `MachineController` does
`queueKeystroke(0, 5, …)` then `await delay(step.wait)`, roughly 100 ms of real time per character.

Nothing couples the two. Whenever the emulated machine is not advancing at real time — and right
after the boot-menu `Enter`, NextZXOS is loading from the SD card, which repeatedly exits the frame
loop for a host round trip — `this.tacts` crawls while keys keep arriving. They all land in nearly
the same five-frame window, and this branch then throws them away:

```ts
if (keyStroke.endTact < this.tacts) {
  this.keyboardDevice.setKeyStatus(keyStroke.primaryCode, false);
  ...
  this.emulatedKeyStrokes.shift();
  return;
}
```

**It releases and discards without ever having pressed.** Hence a lost prefix. The stray `,`
(Symbol-Shift + N, where `N` of `ScrollNutter` belonged) is shift state leaking across the expiry
cascade, which the one-action-per-call design makes fragile once entries pile up.

#### 15.12b Fix A — chain the queue

`queueKeystroke` now starts each keystroke where the previous one ends:

```ts
const lastEndTact = queue.length > 0 ? queue[queue.length - 1].endTact : this.tacts;
const startTact = Math.max(this.tacts, lastEndTact) + frameOffset * tactsPerFrame;
```

The queue becomes a true sequence: it plays back at the machine's own pace however fast it was
filled, and nothing can expire unplayed. Applied to both `ZxNextMachine` and `ZxSpectrumBase`, which
had the identical flaw.

Interactive typing is unaffected — the on-screen keyboards enqueue only when the queue has already
drained (`Sp48Keyboard.tsx:486` and siblings), so `lastEnd` is in the past and the expression reduces
to the old behaviour. `test/zxnext/KeystrokeQueue.test.ts` asserts that explicitly.

**The regression test was verified to fail without the fix**, which is the only thing that makes it
worth having: with the old anchoring, **one of eight queued keystrokes was delivered**. Seven were
discarded unpressed.

#### 15.12c Fix B — wait for the OS, not the wall clock

The flow synchronises on `ReachExecPoint` at ROM0/`$1202` three times — after the cold boot, after
the following `Start`, and after the autoexec `Space`. The only transition that lacked it was the
boot-menu `Enter`, which had a bare `Wait 100` (wall clock) before typing began. That step now waits
for the machine to reach the same main waiting loop, then `Start`s, before `...promptQueue`.

**The evidence for `$1202` being the right point is strong but indirect**: the flow already treats it
as "the OS is idle and ready" after the autoexec `Space`, which is reached at the command prompt. It
has *not* been confirmed empirically that the loop is entered after the menu `Enter` on every boot
configuration. **If it is not, the flow will wait at "Command prompt ready" instead of typing** —
that symptom, rather than lost characters, is the signal the address needs revisiting.

#### 15.12d Two things noticed in passing, not fixed

- **`ternaryCode` is dropped on the ZX Next.** `MachineController` calls
  `m.queueKeystroke(0, 5, step.primary, step.secondary, step.ternary)`, but `ZxNextMachine`'s
  signature takes four parameters and its `emulateKeystroke` only handles primary and secondary.
  Three-key combinations therefore cannot be injected on the Next.
- **Why build-and-run behaved better than the viewer launch.** `captureCheckpoint` documents that the
  SD card is deliberately outside the checkpoint, so *the machine writing to the card drops it*. A
  host-side `copyToSdCard` — which is what `nex-run` does before launching — does not go through that
  path, so it can leave a checkpoint whose cached view of the filesystem predates the new file. Worth
  a look on its own; it is not what caused the lost keystrokes.

**Verification:** full suite — **736 files, 21,468 tests pass**; `npm run build:check` no new type
errors. The new suite is registered in `wasm-next-full-matrix.test.ts` as a TypeScript-owned
boundary, since the keystroke queue lives in the machine class and only key rows reach the core.

### 15.13 Why §15.12 was not enough: two more defects

After §15.12 the injected command came out as `roll,nutter.nex` rather than
`.nexload ScrollNutter.nex`. Fix A had worked — more characters survived — but two separate defects
were still in play, one of which §15.12c had misdiagnosed.

#### 15.13a Capitals were encoded with the wrong shift

`asciiToNextKeyCodeMap` in `NextKeyboardDevice.ts` encoded all 26 capitals as
`{ primaryCode: <letter>, secondaryCode: SShift }`. **SYMBOL SHIFT + letter is not a capital** — it is
the symbol printed on the key. SYMBOL SHIFT + N is `,` and SYMBOL SHIFT + M is `.`.

So the `,` in `,utter.nex` and `roll,nutter.nex` was never corruption or a timing artefact: it is
literally what the flow asked the machine to type where `ScrollNutter`'s `N` belonged. The earlier
reading of it as "shift state leaking across the expiry cascade" (§15.12a) was wrong.

Capitals now use `CShift`. SYMBOL SHIFT remains correct for the punctuation entries, where the symbol
*is* what is wanted — `.` really is SYMBOL SHIFT + M, and that entry was never at fault. Covered by
`test/zxnext/NextKeyCodeMapping.test.ts`, including the specific assertion that a capital `N` and a
`,` do not encode identically.

#### 15.13b The new sync point matched instantly

§15.12c added a `ReachExecPoint` on ROM0/`$1202` after the boot-menu `Enter`. It changed almost
nothing, for a reason the flow makes obvious in hindsight: **`$1202` is where the machine already
was.** The boot menu idles in the same waiting loop, and `QueueKey` only *queues* a key —
`emulateKeystroke()` plays it back over the following frames. The step therefore ran while the
machine was still sitting in the menu loop, matched on the first instruction, and typing began
regardless.

You cannot wait to *reach* an address you have not left.

The fix is a new flow step, `WaitKeyQueue`, which polls `getKeyQueueLength()` until the machine has
actually played back everything queued. It is paced by the machine rather than the host, so it works
whatever speed the emulation is running at. Placed between the `Enter` and the `ReachExecPoint`, it
guarantees the key has been delivered — and by the time the queue drains the OS has long since left
the waiting loop to act on it, so the `ReachExecPoint` that follows now measures the real return to
the command prompt.

A 5 s timeout keeps a flow from hanging if the queue never drains; it reports and continues.

**Verification:** full suite — **737 files, 21,473 tests pass**; `npm run build:check` no new type
errors.

**Still unconfirmed.** As in §15.12c, that `$1202` is the address NextZXOS idles at when the command
prompt is ready has not been shown empirically — only that the flow already treats it that way after
the autoexec `Space`. `WaitKeyQueue` removes the instant-match failure, so the `ReachExecPoint` now
genuinely waits; if `$1202` is the wrong address the symptom will be the flow stalling at
"Command prompt ready" rather than mistyping.

### 15.14 The root cause, found by reading the ROM

Three attempts at synchronising the NEX launch flow failed because all three rested on an assumption
nobody had checked. §15.12c and §15.13b both reasoned *about* `ZXNEXT_MAIN_WAITING_LOOP` without ever
looking at what is there. Disassembling `src/public/roms/enNextZX.rom` settles it:

```
$1200: 18 E3        JR   $11E5
$1202: 76           HALT
$1203: 21 3B 5C     LD   HL,$5C3B     ; FLAGS
$1206: CB 6E        BIT  5,(HL)       ; is a key available?
$1208: 28 EA        JR   Z,$11F4      ; no - keep waiting
$120A: CB AE        RES  5,(HL)       ; consume it
```

**`$1202` is NextZXOS's generic wait-for-a-keypress loop.** The OS parks there whenever it wants a
key: during boot, at the boot menu, at the BASIC prompt, inside the Calculator. So
`ReachExecPoint ROM0/$1202` never meant "the command prompt is ready" — it meant **"something wants a
key"**, which is equally true of the boot menu.

That single fact explains every symptom in this thread:

- The flow pressed *arrow down* and *Enter* as soon as the loop was touched once, which happens during
  startup — before the boot menu is drawn. Those keys were thrown away.
- The `.nexload …` text that followed was therefore typed **into the boot menu**, where the characters
  navigate it. The `c` of `ScrollNutter` starts the **Calculator** — exactly what was observed.
- The remaining `rollNutter.nex` was typed into the Calculator, and the trailing Enter produced a
  syntax error.
- §15.13b's `ReachExecPoint` after the Enter matched instantly for the same reason: the machine had
  never left the loop.

#### 15.14a The fix: parked, not passed through

A new step, `WaitIdle`, samples the program counter and completes only after finding the machine
inside the key-wait loop (`$11E5`–`$120B`) on N consecutive polls. While NextZXOS is loading
something it is doing real work and cannot satisfy that; once it is genuinely sitting at a prompt it
satisfies it immediately. That is the difference between "something wants a key" and "the program you
were waiting for is up".

It is used twice, which matters — the earlier attempts only addressed the second half:

1. **Before the menu keys**, so the boot menu is actually drawn and waiting before arrow-down/Enter
   are sent.
2. **After the Enter**, so the command line is up before `.nexload` is typed.

`WaitKeyQueue` (§15.13b) is kept between them: it proves the Enter was *delivered*, which is what lets
the second `WaitIdle` mean anything — the OS must go busy before it can settle again.

**Verification:** full suite — 737 files, 21,473 tests pass; `npm run build:check` no new type errors.

#### 15.14b The lesson

Three fixes were reasoned from what the flow *appeared* to assume, and each was wrong in the same
way. The disassembly took one command and would have prevented all of them. When a plan's own
premise is an address in somebody else's ROM, read the ROM first — the "§2 Facts, verified against
the source" discipline this document opens with applies to the binaries too, not only to the
TypeScript.

### 15.15 Revealing where the entry-point stop landed

With the launch flow working (§15.14), `nex-run -e` pauses correctly at the NEX's entry point but says
nothing about *where* that is. Requested: the bank's dump should open, based at the address the bank
is seen at, scrolled to the entry point.

**The timing problem that shapes the design.** `nex-run -e` arms a one-shot bank breakpoint and
returns. The stop fires seconds later — after NextZXOS boots, `.nexload` is typed, and the program
loads — through no call the command is still waiting on. So the command cannot do the reveal itself.

`nexEntryReveal.ts` records the intent (path, bank, entry address, and the offset the bank is seen
at); `IdeEventsHandler` consumes it on the next pause. It is **consumed**, not read: the reveal must
fire for the pause it was armed for and no other, or a later breakpoint of the user's own would have
the entry point's bank yanked open underneath them. A launch without `-e` clears any pending reveal
for the same reason.

**What each of the three requests needed.**

- *Bank 5, based at `$4000`* — `getDefaultDisassemblyOffsetForBank` already returned this
  (`$4000` for bank 5, `$8000` for bank 2, `$C000` for the entry bank); it is passed as the dump's
  `disassOffset`, which is what makes the listing agree with the address the breakpoint was reported
  at.
- *The dump pops up* — via `openStaticMemoryDump` with **the same document id the NEX viewer's
  pop-out uses**, so this focuses that document rather than opening a second view of the same bank.
- *Scrolled to `$5C50`* — a new `topAddress` option, honoured on mount and preferred over a
  remembered scroll position, since it is only ever set when something opened the document *at* an
  address.

The row spotlight §6.6 of `NEX_DEBUGGING_IDEAS.md` describes already exists (`pcSpotlightAddress`), so
once the document is open at the right offset the entry-point row highlights itself.

#### 15.15a A pre-existing bug found on the way

"Go to address" in a bank dump was broken for any bank shown at a non-zero offset. The jump did:

```ts
memoryVlApi.current.scrollToIndex(Math.floor(memoryJumpAddress / 16), { align: "start" });
```

but the rows are addressed by `disassOffset` while the virtual list is indexed from the start of the
dump. In bank 5 at `$4000`, asking for `$5C50` requested row 1477 of a 1024-row list and simply hit
the bottom. It now subtracts `disassOffset` and clamps. Nothing in the viewer's own pop-out path had
exercised this, because the feature that needed it did not exist yet.

**Verification:** full suite — 737 files, **21,478 tests pass**; `npm run build:check` no new type
errors; `npm run lint:renderer` adds no new warning (the one on the pause effect already existed and
merely names one more function).

**Not verified end to end.** The record/consume logic and the launch command's arming are covered by
unit tests; the document actually appearing and scrolling is reasoned from the existing pop-out path,
not observed.

### 15.16 NEX banks open as code

The §15.15 reveal worked but opened the bank as a hex dump. Three related requests followed: the slot
offsets should follow the file's mapping, the entry point's bank should open as a disassembly, and
NEX banks generally should probably default to one.

**The offsets were already right.** `docs/content/book/app-A-nex-file-format.md` gives the file order
(5, 2, 0, 1, 3, 4, 6…111 — the order that made the earlier byte-exact layout check succeed) and the
slot mapping: bank 5 at `$4000`, bank 2 at `$8000`, the header's entry bank at `$C000`, everything
else not paged in at hand-over. `getDefaultDisassemblyOffsetForBank` implements exactly that and is
used both by the viewer's pop-out (as the fallback under a remembered offset) and by the reveal.
Nothing needed changing; it is recorded here because "check the offsets" was part of the request and
the answer is that they already follow the document.

**The view mode did need changing.** `StaticMemoryDump` defaulted every document to `"memory"`. It now
defaults a **NEX bank document** — one carrying a `nexAnnotationBank` — to `"disassembly"`, because a
bank of a NEX is a 16K slice of a program and the reason to open one is to read the code in it. A
plain dump of some other binary keeps the hex default, and a remembered choice in the annotation
sidecar still wins, so a bank last read as hex opens as hex.

The entry-point reveal additionally passes `viewMode: "disassembly"` explicitly rather than relying on
that default, since it is opening the document to show the instruction the machine stopped on — and
an explicit mode now also applies to a document that is **already open**, which a preference must not.

**`topAddress` had to reach the other list.** §15.15 taught only the memory list to open at an
address. The disassembly list now honours it too, by seeding the jump address rather than scrolling
directly: the listing is disassembled asynchronously, so the row for an address may not exist when
the list mounts, and the existing jump effect re-runs when it does.

**Verification:** full suite — 737 files, **21,482 tests pass**; `npm run build:check` no new type
errors. The new cases cover the disassembly default, a plain dump keeping the memory default, a
remembered view still winning, and the §15.15a offset bug in both directions (an address inside the
bank, and one below it that has to clamp).

### 15.17 Following the program counter, not the entry point

The §15.15 reveal was wrong twice over, and the report that exposed it named both:

1. **It fired too early.** The one-shot record was consumed by the *first* pause after arming — and
   the injection flow pauses the machine itself, since `ReachExecPoint` pauses before it runs. So
   bank 5 appeared while NextZXOS was still booting, well before the entry point was reached.
2. **It answered only the first question.** Once stopped, stepping on into another bank left the
   wrong document open. A jump to `$A624` — bank 2 — still showed bank 5.

**The fix is to stop treating the entry point as special.** On every pause, find the bank the program
counter is in and bring that document forward, scrolled to the PC. The entry-point stop is then simply
the first pause whose PC is inside a bank of the file, and it needs no record of its own — so
`nexEntryReveal.ts` is deleted rather than fixed.

It also solves the premature pop-out *by construction* rather than by another guard: the launch
flow's own pauses happen with the PC in the ROM, where there is no RAM bank to name.

**The live MMU decides, not the header.** `bank16kAtAddress` is the inverse of `locateBank16k`: it
reads the 8K page map and answers which 16K bank is visible at an address and where that bank's byte
0 sits. Using the header's start-up mapping instead would be a statement about a moment that has
passed — a program is free to page something else in, and after it has, the header is a lie. ROM
slots return nothing, which is what keeps the reveal quiet during the launch.

`revealNexBankAtPc` takes its machine and document operations as injected functions and returns *why*
it did nothing — `no-nex-session`, `not-in-ram`, `not-a-bank-of-this-nex`, `bank-not-in-file`, or
`revealed`. That is deliberate: four quite different causes hide behind "nothing happened", and the
whole decision is then testable without a machine, an IDE, or a React tree — which matters here,
because the UI behaviour of everything in §15.15-§15.17 is the part this plan's author cannot observe.

**One efficiency point.** Every step is a pause, so the parsed file is cached, keyed by path. Without
it each step would re-read and re-parse a file that for a bank-heavy NEX runs to megabytes.

**Verification:** full suite — 738 files, **21,489 tests pass**; `npm run build:check` no new type
errors; `npm run lint:renderer` no new warnings. The new cases cover the `$5C50`→bank 5 and
`$A624`→bank 2 mappings, an address in a bank's high half still basing its listing on the low half,
ROM staying silent, split (non-contiguous) placements, a bank the file never carried, and the cache
being used across pauses but dropped when a different NEX is launched.

### 15.18 Three defects in the revealed document

Reported together, with three unrelated causes.

#### 15.18a "Annotation file contains validation errors"

The reveal passed the **NEX's own path** as `nexAnnotationPath`. That field wants the annotation
*sidecar* — `<name>.nex.dis` — which is what the viewer's pop-out passes
(`annotationPath = sidecarPaths?.fullPath`). So the annotation session read a 400 KB binary as its
JSON and said the only true thing it could.

Fixed by deriving `getNexAnnotationPath(session.path)`. The derivation was moved **into**
`nexBankReveal`, so it is covered by a test, rather than left in the handler where getting it wrong
is silent.

#### 15.18b The execution-point marker took ~5 seconds

`useNexBankPcOffset` computes the marker from the bank's placements, which
`useNexBankLocation` fetches asynchronously. Both refresh through `useEmuStateListener`, which fires
once on registration and thereafter only when the machine's state, PC or tact count **changes** — and
on a machine that is paused and idle, none of them do. Its fallback for "nothing changed" is
**5 seconds**.

On a freshly opened bank document the single registration-time run therefore found `placements` still
`undefined`, gave up, and nothing recomputed until that fallback. Everything else on screen — the
listing, the scroll position — was already right, which is exactly what made it look like a rendering
delay rather than a missed update.

`useNexBankPcOffset` now also recomputes in an effect keyed on the placements and the machine state,
so the marker appears as soon as the data it needs exists. The listener stays for ongoing updates.

#### 15.18c An open document did not follow the program counter

Stepping within a bank already on screen — `$A624` to `$A600` — did not scroll. `openStaticMemoryDump`
wrote the new `topAddress` into the document's view state, but **view state is read once, when a
document mounts**, so writing to a mounted document does nothing.

`DocumentApi` gains `revealAddress(address)`; the dump registers it, and `openStaticMemoryDump` calls
it whenever the caller asked for an address. The initial-mount path is unchanged and still handles a
document being opened for the first time.

This is why §15.15's "scroll to the entry point" worked while §15.17's "follow the PC" did not: the
first only ever needed the mount path.

**Verification:** full suite — 738 files, **21,490 tests pass**; `npm run build:check` no new type
errors; `npm run lint:renderer` no new warnings. New cases cover the sidecar path and re-pointing an
already-open document (asserting the row index accounts for `disassOffset`, so it cannot regress into
§15.15a).

### 15.19 Branch prediction in a popped-out NEX bank

The Disassembly panel's conditional-branch gutter now also works in a popped-out bank's disassembly.

Most of it was already reusable. `DisassemblyRow` — the same component both views render — already
takes `showBranchGutter` and `verdict`, and `Z80Disassembler` already fills `DisassemblyItem.branch`,
so the bank listing carried the branch metadata all along. What was missing was a register snapshot
and the decision of when a verdict is meaningful.

**The snapshot.** `useNexBranchCpuSnapshot` reads the registers the gutter evaluates against. It
supplies **no `readByte`**, which is deliberate: this document holds one 16K bank, not the flat 64K
map, so an absolute `SP` cannot be resolved in it. `createBranchCpuSnapshot` withholds the reader for
exactly this reason in the panel's partition mode, and a `RET cc` then reports `unobtainable` rather
than a byte of whichever bank happens to sit at the same offset. It refreshes on the shared ticker
*and* in an effect, per §15.18b.

**The gate, which is the part the Disassembly panel never needs.** That panel's addresses are always
real. A popped-out bank's are not: its listing offset is a **dropdown**, so a bank can be numbered
`$8000` while sitting at `$4000`, or while not paged in at all. The flags would still be genuine, but
every destination the gutter resolved would name a place this code is not — a confident wrong answer,
which is the one thing this feature is otherwise careful never to give.

So `isListedWhereItIsPaged` gates it: verdicts appear only while the bank is paged as one contiguous
16K block at exactly the offset the listing is numbered by. In the debugger's own flow that is always
true, because §15.17 opens the bank at the address it is actually paged at. Choosing a different
offset from the dropdown turns the gutter off rather than making it lie.

**Verification:** full suite — 738 files, **21,495 tests pass**; `npm run build:check` no new type
errors; `npm run lint:renderer` no new warnings. The predicate is covered without a DOM — agreeing,
numbered elsewhere, not paged at all, split across non-adjacent slots, and half-paged — in the file
this component's other paging questions are already delegated to.

### 15.20 A bank breakpoint with no sign of itself

Right-clicking a row of a popped-out bank made a breakpoint that appeared in the Breakpoints panel
but left no mark on the row that made it. One cause, two symptoms.

**Rows took their bank offset only from their annotation.** The listing is built two ways: with a
sidecar, `createAnnotatedNexDisassemblyItems` gives every row an `annotation.bankOffset`; without
one, the plain `Z80Disassembler` output has no annotations at all. The gutter looked up
`item.annotation?.bankOffset` and nothing else, so **a bank with no sidecar had no offsets** — which
is the ordinary case for a NEX launched straight from the Explorer, and exactly what the debugger's
own reveal opens.

That made the display miss existing breakpoints. It also made the creation wrong, which is the more
serious half and the one that hid the first: `BreakpointIndicator` builds its `bp-set` from
`DisassemblyRowViewModel.breakpointAddress`, whose fallback for a row with no breakpoint was the
row's **Z80 address**. In a bank listing that arms a breakpoint at wherever the bank happens to be
paged rather than at an offset inside it — a plain address breakpoint, which the Breakpoints panel
duly showed and the bank gutter, looking up by offset, could never find.

So the breakpoint was real, was in the panel, and was of the wrong kind.

**The fix** gives a row its bank identity from the listing itself. `listedBankOffset` inverts the
listing's numbering, and the dump uses `item.annotation?.bankOffset ?? listedBankOffset(...)` both to
look up the gutter's breakpoint and to fill a new `bankScope` prop. `DisassemblyRow` uses that scope
only when the row has no breakpoint yet, to name the site an unarmed gutter would create — so an
empty gutter in a bank listing now creates `02:+$2624` where it used to create `$A624`.

The 64K Disassembly view passes no scope and keeps the address fallback, which is right there: its
addresses *are* the identity.

**Verification:** full suite — 738 files, **21,501 tests pass**; `npm run build:check` no new type
errors; `npm run lint:renderer` no new warnings. The new cases pin the offset inversion and — the one
that matters — that an unarmed row in a bank listing is named by bank and offset, that a row outside
one still falls back to its address, and that an existing breakpoint's own identity still wins.
