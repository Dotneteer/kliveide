# Klive BASIC: LIR, instruction selection and register allocation

Design note R11-2 of `.plans/ZXBASIC_COMPILER_PLAN.md` (§3.1, §3.2, §6.7, §7.1, §7.3).
**Status: approved by the project author on 2026-09-26, with every proposal in the decisions table below.**

The LIR (low-level IR) is Z80 code as objects: the output of instruction selection, the input of
the peephole optimiser and of the emitter that hands the program to Klive's assembler. This note
fixes the LIR, how MIR becomes LIR at each optimisation level, the register model, stack frames,
and emission. **Phase 3 implements the LIR, the level-0 scheme (§4) and the emitter (§7); the
register allocator (§5) and most peephole rules are Phase 7.** The allocator is designed here so
that nothing Phase 3 builds has to be undone.

## 1. The ABI this must produce

Fixed by plan §6.7 and `.ai/kbasic/runtime-abi.md` §2–§3 (the user-visible contract):

- STDCALL: arguments pushed last first (8-bit as `push af`, value in the high byte; 32-bit high
  word first; Float as 6 bytes), `call`; the callee builds `push ix; ld ix,0; add ix,sp`, saved IX
  at `(ix+0)`, return address at `(ix+2)`, first parameter at `(ix+4)`, locals at negative offsets
  zeroed at entry; the callee removes its arguments.
- FASTCALL: the first parameter in A / HL / DE:HL / A-E-D-C-B, no frame, no locals.
- Results: A, HL, DE:HL, A-E-D-C-B. Nothing is preserved across a user call except IX. IY is
  `$5C3A` whenever the ROM runs and is never allocated.

## 2. The LIR

```ts
type LirInstr = {
  op: string;                  // "ld", "add", "call", "jp", ... or a pseudo-op
  operands: LirOperand[];      // registers, immediates, (ix+d), (hl), (nn), labels, symbols
  sid: number;                 // the statement id, from the MIR instruction (§4 of kbasic-mir.md)
  uses: Reg[]; defs: Reg[];    // registers read and written, flags included (for liveness)
  size: number;                // bytes, from the instruction-length table
  callSite?: CallSiteRecord;   // on the call that implements a MIR call / gosub (plan §8.4)
};
```

- Registers: `A B C D E H L`, pairs `BC DE HL`, `IX`, `SP`, the flags `F`, and the alternate set
  (used only by epilogues and runtime glue). **IY and I/R are never allocated.**
- Pseudo-ops pass through to the emitter as labels or nothing: `stmt sid`, `label`,
  `prologue.end`, `epilogue.begin`, `vreg` references (before allocation), `spill`/`reload`.
- Target-specific instructions (Z80N: `mul d,e`, `add hl,a`, `push nn`, barrel shifts, …) exist in
  the LIR only when the target is `next`; the instruction-length table already covers them
  (`src/emu/machines/zxNext/z80nInstructionLengths.ts`).
- The size of every instruction is known, so branch shaping (`jp` → `jr`, `djnz`) can be decided
  by the compiler before assembly (plan §7.3).

## 3. Instruction selection

MIR → LIR by **tiling expression trees**. A statement's MIR (levels 0–1), or a block's (level 2+),
is viewed as trees rooted at stores, calls, branches and runtime calls; each tile is a pattern over
MIR nodes with a LIR template and a cost (size and T-states; `optimize-for` weights them). Tiles
are data: a table per target, tested per tile with an execution check on the harness.

Examples of tiles:

| MIR | Z80 |
| --- | --- |
| `store u8 global(x), const 0` | `xor a` / `ld (_x),a` |
| `add u16 %a, const 1` | `inc hl` |
| `cmp.eq u8 %a, const k` + `br` | `cp k` / `jp z,…` |
| `load u8 local(s)` | `ld a,(ix-n)` |
| `mul u16 %a, const 2^n` | `add hl,hl` × n |
| `mul u8` (target `next`) | `ld d,…` / `ld e,…` / `mul d,e` |

Operations with no good inline sequence become `rtcall`s: 16×16 multiply, division, 32-bit
arithmetic (Phase 3/4 runtime modules), Fixed, Float, strings.

**Float expressions** become ROM calculator programs: a whole Float expression tree lowers to one
`rst $28` sequence (operands stacked with `STK-STORE`-style runtime helpers, the tree as calculator
literals, the result fetched into A-E-D-C-B) inside a stub that sets IY. This is what the runtime
note in `rom.kz80.asm` anticipates ("a calculator sequence gets its own stub"), and it keeps Float
temporaries on the calculator stack, not in registers. (Phase 4.)

## 4. Level 0: the stack-machine scheme (Phase 3)

No register allocation. Every expression node leaves its result in the **accumulator** of its
type, and binary operators save the left operand on the Z80 stack:

| Type | Accumulator | Secondary (right operand) | Push / pop |
| --- | --- | --- | --- |
| 8-bit, `bool` | A | L (or `(hl)`/immediate forms) | `push af` / `pop af` |
| 16-bit, `ptr`, `str` | HL | DE | `push hl` / `pop hl` |
| 32-bit, `fix` | DE:HL | via the stack (runtime calls take one operand on the stack) | `push de; push hl` |
| `flt` | A-E-D-C-B | the calculator stack (Phase 4) | 3 words |

`a + b` for 16-bit: evaluate `a` → HL; `push hl`; evaluate `b` → HL; `ex de,hl`; `pop hl`;
`add hl,de`. Constants and simple loads use the short forms (`ld de,k` instead of push/pop).

Properties that matter:

- **Statement boundaries are clean**: every push has its pop within the statement, so SP at every
  statement entry equals the activation's baseline (G4, plan §10.2.2) by construction.
- **Every statement starts at its own address** and no code crosses a boundary.
- It is slow, but it is the reference: every other level must produce the same results (the plan's
  level matrix test, §13.2), and bugs in higher levels are found by comparing with level 0.

## 5. Levels 1–3: linear-scan allocation (Phase 7)

- **Liveness** on the LIR with vregs; intervals per vreg. At level 1, intervals never cross a
  statement (S2 of the MIR note), so allocation is per statement; at level 2 per function.
- **Register classes** with precolouring: most Z80 operations are two-address with fixed
  accumulators (8-bit ALU in A; 16-bit `add`/`sbc` in HL; `ex de,hl` swaps DE and HL for free).
  Instruction selection emits these constraints as fixed-register operands; the allocator assigns
  the remaining vregs from `B C D E H L` (8-bit) and `BC DE HL` (16-bit), trying the hinted
  register first (the one a copy would otherwise need).
- **32-bit and Float values** are not allocated to registers across instructions except in their
  fixed homes (DE:HL, A-E-D-C-B); they live in spill slots between uses.
- **Calls clobber everything but IX**, so an interval live across a call is spilled around it.
- **Spill slots** are in the IX frame for STDCALL functions (extra negative offsets, zeroed with the
  locals). For the main program and FASTCALL routines, which have no frame, spills at level 1 are
  `push`/`pop` pairs within the statement (keeping G4). At level 2 a value in these functions that
  lives across statements is a hidden variable in memory instead of a spill. A static spill area
  is never used, because routines can recurse.
- Coalescing, `ex de,hl` insertion and the peephole rules of plan §7.3 run after allocation.

## 6. Frames

| Function | Frame |
| --- | --- |
| main program | none; the baseline SP is stored by the prologue in `core.ProgramSP` (`mainBaselineSymbol`) |
| STDCALL SUB/FUNCTION | `push ix; ld ix,0; add ix,sp`; locals, hidden locals (FOR limits, the result slot) and spill slots below IX, zeroed at entry; `prologue.end` after the zeroing |
| FASTCALL | **Implementation (Phase 3):** the same IX frame as STDCALL, built inside the routine. The first parameter, which arrives in A or HL, is pushed as the frame's first slot (`(ix-1)` / `(ix-2)`); further parameters are at `(ix+4)`… as for STDCALL, and the epilogue removes them. Callers see exactly the FASTCALL ABI (register parameter, IX preserved, arguments removed by the routine); only the inside changed, so parameters and hidden slots are addressed one way. Locals stay forbidden (E431), as the spec says. |

The epilogue (`_name.leave`, plan §8.4 naming) frees local Strings, by-value String parameters and
local arrays (string note), keeps the result in its registers using the alternate set if needed
(G6), then `ld sp,ix; pop ix`, removes the arguments and returns. Every `RETURN` jumps to it; its
first instruction is `epilogue.begin`.

## 7. Emission: from LIR to the assembler

Plan §3.2 asks for the program to reach the assembler as syntax-tree lines, with no text round
trip. **Proposal: emit text, parse it with `parseSourceUnit`** (the Phase 0 entry point), and keep
direct tree construction as an optimisation for later (question L1):

- The emitter writes one assembler line per LIR instruction into a virtual file
  `<name>.kbasic.asm`, and records for **each line index** its sid (and any call-site record). The
  assembler's list items give each line's address and length, which is how the debug builder
  recovers everything (`kbasic-debug-builder.md` §3).
- The text **is** what `'@emit-asm` shows, so the dump and the build can never disagree.
- The runtime modules are already parsed once and cached (`RuntimeUnitCache`); only the program
  itself is parsed per build. **Measured 2026-09-26** (cloud container, 4 cores): 15,700 lines of
  level-0-style assembly — about what a 2,000-line BASIC program produces — parse in ~200 ms and
  assemble in ~220 ms. That leaves more than half of plan §12.3's one-second budget for the front
  end and code generation, so text emission stays. If a later measurement misses the budget, the
  emitter builds `AssemblyLine` objects directly instead, with the same line-index bookkeeping.

Layout of the emitted program:

```
    .model Spectrum48                 ; or Next (+ .savenex lines, Phase 6)
    .org <origin>
<prologue>                            ; runtime-linker.ts prologueSource(...)
_main:                                ; the main program's statements
    ...
    ld bc,0 / jp core.End             ; falling off the end is END 0
_Fact: ...                            ; routines, in source order
_Fact.leave: ...
<data>                                ; globals, descriptors, string literals, the DATA table
<runtime closure>                     ; one .module core, from runtime-linker.ts
```

Names (plan §8.4): globals and routines `_name`, labels `_label.name` (line numbers
`_label.10`), epilogues `_name.leave`, runtime `core.X`. String literals and compiler temporaries
use a `__k` prefix that BASIC names cannot produce.

## 8. Tests

- Per tile: before/after LIR and an execution check on the 48K harness.
- Level-0 goldens: BASIC → assembly text for each construct (plan §13.1).
- The level matrix (plan §13.2) from Phase 7 on: every corpus program gives the same results at
  every level.
- A G4 check on every compiled test program (debug builder's validator, run with a tracing hook).

## 9. Decisions (approved as proposed)

| # | Question | Proposal |
| --- | --- | --- |
| L1 | Text to the assembler instead of syntax-tree lines (a change to plan §3.2) | Emit text and parse it; measure against §12.3; build trees directly only if needed. Keeps the emitter independent of the assembler's internal node types and makes `'@emit-asm` exact. |
| L2 | Phase 3 scope | LIR + level-0 scheme + emitter only; levels 1–3 fall back to level 0 until Phase 7. The options accept `'@optimize 1..3` from the start; the build output says "code generated at level 0". |
| L3 | Level-0 code for the main program uses `push`/`pop` within statements | Needed for G4 and it is the only frame-free place to keep temporaries; no static temporaries anywhere (recursion). |
| L4 | Float expressions as ROM calculator programs | One `rst $28` sequence per Float expression tree (Phase 4), rather than a runtime call per operation; the constant folder already matches the calculator bit for bit. |
| L5 | FASTCALL routines may not declare locals (spec), but the binder does not check it yet | Add the check to the binder (a new E4xx code with its test) at the start of Phase 3. |
