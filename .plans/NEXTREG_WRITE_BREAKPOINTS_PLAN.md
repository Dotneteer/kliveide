# NextReg Write Breakpoints Plan

Status: **implemented** — Phases 1-8 complete. See §9 for what the work changed about the plan.
Scope: the ZX Spectrum Next WASM core (`src/emu/machines/zxNext/wasm/zxnext/`), `DebugSupport`,
`ZxNextWasmV2Machine`, the breakpoint commands, the breakpoint dialog, the Breakpoints panel, and
two docs pages.
Related plans: `.plans/BREAKPOINT_MANAGEMENT_UI_PLAN.md` (the dialog and panel this extends),
`.plans/NEX_DEBUGGING_PLAN.md` §4 and §13 (the two previous new breakpoint *shapes*).

---

## 1. What is being added, and why it is not like anything already here

Every breakpoint Klive has ever had names **a place**: a Z80 address, an address inside a 16K bank,
a label that resolves to one of those, or a source line that resolves to one of those. Even the
watchpoints do — `bp-set $9000 -w` watches *address* `$9000`, and `bp-set $7ffd -o` watches *port*
`$7ffd`, which is an address in the I/O space. `getBreakpointKey` says so structurally: it throws
unless the breakpoint carries an address, a bank site, a label or a resource
(`src/common/utils/breakpoints.ts:101`).

A **NextReg write breakpoint names a machine event instead**: "stop when Next Register `$07` is
written." There is no address to put in a gutter, no partition to page in, nothing for the
disassembler to annotate. It is the first breakpoint in Klive that is not a location, and that is
the single fact every design decision below follows from.

Why it is worth having. The Next's 141 documented registers are where the machine's behaviour
actually lives — the CPU speed, the MMU slots, the Layer 2 base, sprite control, the palette
autoincrement, the interrupt configuration. When a program misbehaves because something wrote `$07`
or clobbered an MMU slot, the only tools today are an I/O write breakpoint on port `$253B` — which
fires on *every* NextReg write in the system, including NextZXOS's own — or reading the disassembly
until you find the `NEXTREG` opcode by eye. Neither works on a `.nex` file you did not write.

### 1.1 The three decisions taken before drafting

These were settled with the project author and are not open:

1. **Timing.** The breakpoint stops the machine at the end of the instruction that performed the
   write, and the IDE reports **both the previous and the written value**. §3 explains why literal
   "stop before the register changes" is not implementable here, and why the old/new pair gives the
   user everything that semantics would have.
2. **Write sources.** A breakpoint arms on **CPU writes by default** — port `$253B` and the
   `NEXTREG` opcodes. **Copper writes are opt-in per breakpoint**, through a `-c` command option and
   a dialog checkbox.
3. **Value filter.** A breakpoint may optionally match **only a particular written value**, with an
   optional mask: `bp-set nr:$07 -v $03 -m $0f`.

---

## 2. The write paths in the core

The Next core is C compiled to WASM (`src/emu/machines/zxNext/wasm/zxnext/*.c`, built by
`scripts/build-zxnext-wasm.cjs`). Every NextReg write in the machine funnels through two functions in
`zxnext-nextreg.c`:

| Function | Line | Reached from |
| --- | --- | --- |
| `zxnextNextRegCpuWrite(reg, value)` | `zxnext-nextreg.c:431` | **CPU writes only.** Records `zxnextNextRegLastWrite[reg]` for the Next Registers panel, then calls `SetDirect` |
| `zxnextNextRegSetDirect(reg, value)` | `zxnext-nextreg.c:437` | **Everything.** The device fan-out and the actual store |

Who reaches `CpuWrite`:

- **Port `$253B`** — `zxnextNextRegSetValue` (`zxnext-nextreg.c:267`) ← `zxnextPortsWrite`
  (`zxnext-ports.c:160`) ← `zxnextCpuSharedWritePort` (`zxnext-cpu.c:314`).
- **`NEXTREG n,n` / `NEXTREG n,A`** (`ED 91` / `ED 92`) — `zxnextCpuSharedWriteTbBlue`
  (`zxnext-cpu.c:318-322`), bound to the CPU's `Z80_WRITE_TBBLUE` macro at `zxnext-cpu.c:38`. These
  do **not** go through the ports layer and do **not** move the `$243B` selection.
- **DMA** — `zxnext-dma.c:400` calls `zxnextPortsWrite`, so a DMA whose destination port is `$253B`
  writes NextRegs through the same door. It therefore counts as a CPU write, which is right: it is
  a transfer the program set up.
- The host exports `zxnextSetNextRegisterValue` / `zxnextWriteNextRegister` (`zxnext.c:413-414`).

Who bypasses `CpuWrite` and goes straight to `SetDirect`:

- **The Copper** — `zxnext-copper.c:286-290`, wrapping the call in
  `zxnextNextRegWriteTactOverride` so the raster catch-up uses the copper's own tact.
- **Reset branches** — `zxnextNextRegApplyResetBranch` (`:112`) and `zxnextNextRegSoftReset`
  (`:187`), and the power-on defaults in `zxnextNextRegHardReset` (`:38`).
- **The app's own hotkeys** — `zxnextSetNextRegisterDirect` (`zxnext.c:431`), used by
  `ZxNextWasmV2Machine` for the speed key (`:942`), the expansion bus (`:946`) and the
  `$05`/`$09` toggles (`:973`, `:978`, `:984`, `:992`).

**This plan hooks `CpuWrite` and `SetDirect` both**, with a write-origin discriminator (§4.2), so the
per-breakpoint Copper opt-in is one bit rather than a second hook site. Reset branches and the app's
own hotkeys are deliberately *never* reported: a soft reset writes a dozen registers, and an
IDE hotkey writing `$07` because the user pressed a key is not a program event worth stopping for.

---

## 3. Timing: why "stop after the instruction" is the honest reading of "before"

The debug loop (`ZxNextWasmV2Machine.executeWasmV2DebugLoop`, `:672-751`) drives the core one whole
instruction at a time — `wasm.zxnextExecuteInstruction()` at `:709` — and there is no way to
re-enter it mid-instruction. Literal before-semantics would therefore require the core to **withhold**
a watched write and apply it on resume. That was considered and rejected for one decisive reason:

> **Many NextReg writes can happen inside one Z80 instruction.** Two real cases, both verified in
> the core rather than assumed:
>
> - **DMA.** `zxnext-dma.c:391-403` performs its read/write cycles inside the tact window the CPU
>   instruction is spending, and a write cycle whose destination is an I/O port goes through
>   `zxnextPortsWrite` — so a DMA burst with a fixed destination of `$253B`, the documented way to
>   upload a palette or Layer 2 data, writes a NextReg over and over without the CPU executing
>   anything.
> - **The Copper.** `zxnextCopperExecuteTick` runs `ZXNEXT_COPPER_TICKS_PER_HC` = 4 times per
>   horizontal cycle (`zxnext-copper.c:227`, `:55`), so a copper list can execute several `MOVE`s
>   while one Z80 instruction is in flight.
>
> A deferral scheme has exactly one pending slot and the loop cannot stop part-way through an
> instruction, so those writes would be silently dropped or silently duplicated.

**What this argument is *not*.** An earlier draft claimed `OTIR` to `$253B` was the offending idiom.
It is not: `zxnext-ports.c:157-160` decodes `$243B` and `$253B` on all sixteen bits, and `OTIR` puts
the decrementing `B` in the port's high byte, so at most one iteration of a block write can ever
reach `$253B`. The conclusion survives — DMA and the Copper are both more common than the case that
was imagined — but the reasoning had to be replaced rather than patched.

Deferral would also move the write's side effects to a later tact. `zxnextNextRegWriteTactOverride`
(`zxnext-nextreg.c:439-443`) could restore the raster catch-up's tact, but not the contention and
port timing the instruction has already spent.

**So the machine stops at the end of the writing instruction, exactly as memory and I/O watchpoints
already do** — the header of `test/wasm/zxNext/wasm-next-access-breakpoint.test.ts` documents that
contract, and users already read it in the Breakpoints panel, which reports a watchpoint hit against
`opStartAddress`, the first byte of the accessing instruction.

What makes this *feel* like "before" costs nothing: **the core has the previous value in its hand at
the moment of the write**, so it records it alongside the new one. The user sees

```
NR:$07   CPU Speed          $00 → $03   at $8002: NEXTREG $07,$03
```

which is strictly more than a true-before stop would have shown, because a true-before stop would
have shown only the old value and left the user to work out what was about to be written.

**This is a contract to write down, not a detail.** The docs (§5, Phase 8) and the row tooltip must both say
"stops after the instruction that wrote the register", so nobody reads the feature as a
write-veto.

---

## 4. Design

### 4.1 The model — `BreakpointInfo`

Four new optional fields in `src/common/abstractions/BreakpointInfo.ts`, documented in the style of
`bank`/`label`.

**There is deliberately no `nextRegWrite` kind flag.** An earlier draft carried one, on the reasoning
that a future NextReg *read* breakpoint should be a new flag rather than a new shape. NextReg read
breakpoints are now ruled out (§8, decision 2), which removes that justification entirely — and a
flag that is true for every breakpoint carrying a `nextReg` is not a discriminator, it is a second
copy of one that can fall out of step with the first. So **`nextReg !== undefined` is the
discriminator**, exactly as `bank` + `bankOffset` is for a bank-relative breakpoint, and it gets a
named predicate beside that one in `src/common/utils/breakpoint-scope.ts` — the zero-dependency
module, so the main process can use it when filtering a project save:

```ts
/** True for a NextReg write breakpoint. The register is the binding, so there is no separate flag. */
export function isNextRegBreakpoint(bp: BreakpointInfo): boolean {
  return bp?.nextReg !== undefined;
}
```

```ts
  /**
   * The Next Register this breakpoint watches, `$00..$FF`. ZX Spectrum Next only.
   *
   * The fifth binding shape, and the first that is not a *place*. An address breakpoint, a
   * bank-relative one and a label-anchored one all name somewhere in memory; this one names a
   * machine event — "whenever register $07 is written" — and has no address, no partition and no
   * disassembly. `getBreakpointKey` branches on it before the address branch for the same reason
   * the label branch comes first: the register is the identity.
   */
  nextReg?: number;

  /**
   * Break only when the written value, masked by `nextRegMask`, equals this. Absent means any write.
   *
   * **Part of the breakpoint's identity** (§4.3), unlike `ioMask` — which is the older and worse
   * precedent, because it means two I/O breakpoints on the same port with different masks cannot
   * coexist.
   */
  nextRegValue?: number;

  /** The mask applied to both the written value and `nextRegValue` before comparing. Default $FF. */
  nextRegMask?: number;

  /**
   * Also break when the **Copper** writes this register, not only when the CPU does.
   *
   * Deliberately *not* part of the identity: a CPU-only and a CPU-plus-Copper breakpoint on the
   * same register are not two useful breakpoints, the second simply subsumes the first. It behaves
   * like `disabled` — a property `bp-set` updates in place.
   */
  nextRegCopper?: boolean;
```

**The "not an exec breakpoint" test must learn about it** — in `DebugSupport.addBreakpoint`
(`src/emu/machines/DebugSupport.ts:296`) and in all three commands' `bpDef` literals
(`BreakpointCommands.ts:290`, `:326`, `:376`), which today read
`exec: !(args["-r"] || args["-w"] || args["-i"] || args["-o"])` and must become
`exec: !(… || isNextRegBreakpoint(bpDef))`. This is the one place where dropping the flag costs
something: the expression now mixes a binding predicate in with four kind flags. It is worth it —
the alternative is a redundant field that can disagree with `nextReg` — but a missed site here is
the most likely first bug, because a NextReg breakpoint that also claims to be an exec breakpoint
would be armed at address `undefined`.

`addBreakpoint` rebuilds its stored definition field by field (`DebugSupport.ts:282-327`), and its
own comments record three separate bugs caused by forgetting a field there. **All four new fields
must be listed in that literal.**

### 4.2 The core — a watch table, not a bus mirror

The obvious implementation is to mirror the last NextReg write out of the core each instruction, as
`importWasmV2BusAccess` (`ZxNextWasmV2Machine.ts:1527-1553`) does for memory and ports, and match it
on the TypeScript side. **Do not do that**, for the multi-write reason in §3: that mirror holds one
access per instruction (`lastMemoryWritesCount` never exceeds 1), so a DMA burst or a busy copper
list would report only its last write, and a breakpoint on any earlier register in the run would
never fire.

Instead the **core does the matching**, following the one precedent the codebase already has for an
in-WASM breakpoint table: Z88's `z88BreakpointFlags` (`src/emu/machines/z88/wasm/z88/z88.c:207`),
pushed whole from TypeScript with a single `.set()` (`Z88WasmV2Machine.ts:455-463`) and read by the
core's own loop.

Add to `zxnext-nextreg.c` (or a new `zxnext-nextreg-watch.c` if that file's size argues for it):

```c
/* Per-register watch, pushed from the host. Index is the register number. */
static uint8_t  zxnextNextRegWatchFlags[256];   /* bit0 CPU, bit1 Copper */
static uint8_t  zxnextNextRegWatchValue[256];
static uint8_t  zxnextNextRegWatchMask[256];    /* 0 = match any value */

/* The latched hit, cleared by the host when it takes it. */
static uint8_t  zxnextNextRegHit;               /* 0 = none, else 1 */
static uint8_t  zxnextNextRegHitReg;
static uint8_t  zxnextNextRegHitOld;
static uint8_t  zxnextNextRegHitNew;
static uint8_t  zxnextNextRegHitOrigin;         /* 1 CPU, 2 Copper */

/* Set around a write so SetDirect knows who is writing. 0 = internal (reset, host hotkey). */
static uint8_t  zxnextNextRegWriteOrigin;
```

- `zxnextNextRegCpuWrite` sets `zxnextNextRegWriteOrigin = 1` around its call to `SetDirect` and
  restores it to `0`; the Copper site (`zxnext-copper.c:286-290`) sets `2` around its call, beside
  the `zxnextNextRegWriteTactOverride` it already sets there.
- `zxnextNextRegSetDirect` tests the watch **at its top, before the read-only rejections at
  `:446-447`**, so a watched write to `$00`/`$01`/`$0E`/`$0F`/`$DA` still reports — a program
  writing a read-only register is exactly the kind of bug this feature is for. It reads the previous
  value with `zxnextNextRegGetDirect(reg)` (`:570`) — the *stored* value, not
  `zxnextNextRegPeek`, which applies the `$253B` read mux's zero/one masks and would report a
  "previous value" the register never held.
- **Latch first, do not overwrite.** A burst that hits two watched registers reports the
  first; the loop stops after that instruction and the second is reported on the next run. This is
  the only place where the mechanism is lossy, it is bounded and recoverable, and it is much better
  than the last-write-wins the bus mirror would have given.

New exports in `zxnext.c`, added to `scripts/build-zxnext-wasm.cjs`'s export list and to
`ZxNextWasmV2Loader.ts` (interface at `:129-140`, required-exports assertion at `:483-490`):

```c
uint32_t zxnextNextRegWatchPtr(void);       /* base of the three 256-byte arrays, laid out contiguously */
void     zxnextClearNextRegWatch(void);
uint32_t zxnextTakeNextRegHit(void);        /* returns 0, or a packed word; clears the latch */
```

`zxnextTakeNextRegHit` packs `reg | old<<8 | new<<16 | origin<<24` plus a presence bit, so a hit
costs the loop **one** boundary crossing rather than five. The loader exposes the watch arrays as a
`Uint8Array` view over the core's linear memory, exactly as `Z88WasmV2Loader.ts:287` does for the
Z88 flags.

**Checkpointing already covers this for free**: `captureCheckpoint`
(`ZxNextWasmV2Machine.ts:594`) copies the whole linear memory, so the watch table and the latch
travel with a checkpoint without any new code.

### 4.3 The key

`buildBreakpointKey` (`src/common/utils/breakpoints.ts:57`) gains a branch, placed **after** the
label branch and **before** the address branch — a NextReg breakpoint has no address, so order only
has to be stable, and grouping it with the other non-address shapes reads best:

```
NR:$07                 any write to $07
NR:$07=$03             a write of $03
NR:$07=$03/$0F         a write whose low nibble is $3
```

The kind suffix (`:R`, `:W`, ...) is not appended: as with the bank-relative and label branches, the
shape *is* the kind. The storage key and the display key coincide, because no partition is involved
— so `getBreakpointDisplayKey`'s label map is unused on this path, and
`getBreakpointAddressSpec` returns the same string, which is what `BreakpointIndicator` builds
`bp-del` / `bp-en` from.

`nextRegCopper` is **not** in the key (§4.1). `nextRegValue`/`nextRegMask` **are**, so
`NR:$07=$00` and `NR:$07=$03` can both exist — the case that motivates a filter at all. This
diverges from `ioMask`, which is not in the key; the divergence is deliberate and `ioMask` is the
one that is wrong. Do not "fix" `ioMask` in this change.

`NR:` cannot collide with a partition label: `parseNextPartitionLabel`
(`src/emu/machines/zxNext/nextMachineInfo.ts:46`) accepts `R0`–`R3`, `X0`/`X1`, `Q0`/`Q1`, `DM`,
`M0`–`MF` and one-or-two hex digits, none of which is `NR`. Verify the same for every other machine's
label parser when implementing, even though the form is Next-gated — the gate is a validation rule,
and key building runs everywhere.

### 4.4 `DebugSupport`

`breakpointFlags` is a `Uint16Array(0x10000)` indexed by address (`DebugSupport.ts:49`). A NextReg
breakpoint has no address, so it gets **its own registry** rather than squatting on that one:

```ts
  /** Per-register watch state, the NextReg counterpart of `breakpointFlags`. */
  nextRegWatch = new Uint8Array(256);          // WATCH_CPU | WATCH_COPPER | DIS_NEXTREG
  nextRegWatchValue = new Uint8Array(256);
  nextRegWatchMask = new Uint8Array(256);
```

Authored by a `refreshNextRegWatch()` that mirrors `refreshFlagsAt` (`:846-866`): the **single
authority** that rebuilds the three arrays by walking every definition claiming a register. Called
from `addBreakpoint`, `removeBreakpoint`, `enableBreakpoint`, `eraseAllBreakpoints` and
`resetBreakpointsTo`, at the same points those already call `refreshFlagsAt`.

**The core's table over-approximates; `DebugSupport` decides.** When two breakpoints watch the same
register with different filters, one slot cannot hold both, so `refreshNextRegWatch` writes
`mask = 0` (match any) for that register and the exact test happens on the TypeScript side. This is
the same deferral `PART_BP` already uses — the flag says "something here, ask properly" (`:116`).

Two new interface members on `IDebugSupport` (`src/renderer/abstractions/IDebugSupport.ts`):

```ts
  /** Does any breakpoint watch a Next Register write? The loop asks once, as with hasAccessBreakpoints(). */
  hasNextRegBreakpoints(): boolean;

  /** The exact test, against a hit the core latched. */
  hasNextRegWrite(reg: number, value: number, origin: "cpu" | "copper"): boolean;

  readonly nextRegWatch?: Uint8Array;
  readonly nextRegWatchValue?: Uint8Array;
  readonly nextRegWatchMask?: Uint8Array;
```

Optional, like `breakpointFlags`, so nothing outside the Next has to grow a field.

`DebugSupport` is shared by every machine and survives a machine switch
(`MachineService.ts:103`). A NextReg breakpoint on a 48K therefore sits inert and comes back to life
when the user switches back — the same behaviour bank-relative breakpoints already have, and the
right one.

### 4.5 The debug loop

In `executeWasmV2DebugLoop` (`ZxNextWasmV2Machine.ts:672-751`), beside the existing
`watchesBusAccess` gate at `:694`:

```ts
const watchesNextReg = debugSupport?.hasNextRegBreakpoints() ?? false;
if (watchesNextReg) {
  runtime.nextRegWatch.set(debugSupport.nextRegWatch);
  runtime.nextRegWatchValue.set(debugSupport.nextRegWatchValue);
  runtime.nextRegWatchMask.set(debugSupport.nextRegWatchMask);
} else {
  wasm.zxnextClearNextRegWatch();
}
```

Pushed once per loop entry, not per breakpoint edit — the Z88 fast path's rule
(`Z88WasmV2Machine.ts:455-463`), and correct because every breakpoint edit pauses or precedes the
next run. The `else` branch matters: a stale table left in the core after the last NextReg
breakpoint is removed would keep stopping the machine.

Inside the loop, after `zxnextExecuteInstruction()` and beside the access-breakpoint test at `:733`:

```ts
if (watchesNextReg) {
  const hit = wasm.zxnextTakeNextRegHit();
  if (hit !== 0 && this.acceptNextRegHit(hit)) {
    return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
  }
}
```

`acceptNextRegHit` unpacks the word, calls `debugSupport.hasNextRegWrite(...)`, and on a match
stores `this.lastNextRegWrite = { reg, oldValue, newValue, origin }` for the UI. On a non-match —
which happens when the core's table was over-approximated (§4.4) — it returns false and the loop
continues, having cost one boundary crossing.

Ordering relative to the other tests: **after** the exec-point test and **beside** the access test,
both of which already precede the exec-breakpoint test. A single instruction that both writes a
watched register and lands on an execution breakpoint reports the NextReg write, which is the more
specific event.

`opStartAddress` is already tracked for watchpoints (`:708`) under the `watchesBusAccess` gate; that
gate must become `watchesBusAccess || watchesNextReg`, or the panel will report the NextReg hit
against a stale instruction address.

### 4.6 Reporting the hit to the IDE

`CpuState` (returned by `emuApi.getCpuState()`, consumed at `BreakpointsPanel.tsx:167`) gains

```ts
  /** The NextReg write the machine last stopped on. ZX Spectrum Next only. */
  lastNextRegWrite?: { reg: number; oldValue: number; newValue: number; origin: "cpu" | "copper" };
```

filled from `ZxNextWasmV2Machine.lastNextRegWrite` and cleared when the machine resumes. This is the
same channel `lastMemoryWrites` / `lastIoWritePort` already use to let the panel highlight the row
that just fired, so nothing new is plumbed.

`MachineController` (`:768-779`) prints `"Breakpoint reached at PC=…"` on a `DebugEvent`. Extend that
message for a NextReg stop: `"NextReg breakpoint: $07 CPU Speed $00 → $03 at PC=$8005"`. The
register's human name comes from `NEXT_REG_DESCRIPTORS`
(`src/emu/machines/zxNext/nextRegDescriptors.ts:43`), which is already the neutral documentation
table for exactly this.

### 4.7 The command grammar

No new command. The new form joins the shared `<address-spec>` that `bp-set`, `bp-del` and `bp-en`
all take through `BreakpointWithAddressCommand.validateCommandArgs`
(`BreakpointCommands.ts:120-277`), so all five commands and `bp-list` get it at once.

```
bp-set nr:$07                  break on any CPU write to NextReg $07
bp-set nr:7                    the same — the register accepts every literal form
bp-set nr:$07 -v $03           only when $03 is written
bp-set nr:$07 -v $03 -m $0f    only when the low nibble is $3
bp-set nr:$07 -c               also break on Copper writes
bp-del nr:$07
bp-en  nr:$07 -d
```

Parsing lives in the two-segment `default:` branch (`:153`), and **must come before the
`MF_ROM`/`MF_BANK` partition-support check at `:156-167`** — a NextReg breakpoint needs no
partitions, and falling into that gate would reject it on a hypothetical Next configuration with the
wrong message. The structure mirrors the bank-relative branch immediately below it (`:173-220`),
including its machine gate:

```ts
if (segments[0] === "nr") {
  if (machine.machineId !== MI_ZXNEXT) {
    messages = [validationError("NextReg breakpoints are supported on the ZX Spectrum Next only")];
    break;
  }
  // --- The register number through `parseCommand` + `getNumericTokenValue`, in its own try/catch
  // --- so garbage reports as an invalid *register* rather than the generic "Invalid numeric value".
  // --- Range $00..$FF.
  args.nextReg = …;
  break;
}
```

Two new options on `argumentInfo` (`:103-116`): `-c` in `commandOptions`, `-v` in `namedOptions`
with `type: "number"`. The existing `-m` is reused as the value mask, which needs the
cross-check at `:266` widened:

```
-m without -i, -o or an nr: spec   →  "You can use the -m option only with the -i, -o or nr: forms"
-v without an nr: spec             →  "You can use the -v option only with a NextReg breakpoint"
-c without an nr: spec             →  "You can use the -c option only with a NextReg breakpoint"
-r / -w / -i / -o with an nr: spec →  "A NextReg breakpoint watches a register, not memory or a port"
-m with an nr: spec but no -v      →  "The -m option needs a -v value to mask"
partition with an nr: spec         →  unreachable by construction (the branch never sets one)
```

Every one of those is an early `return [validationError(...)]`, matching the four rules already
there.

`bp-en`'s not-found error formats `$${toHexa4(args.address)}` (`:399`) and already prints nonsense
for a bank-relative spec. Fix it to use `getBreakpointDisplayKey` while in the file — it is two
lines and this change adds a third shape that would trip it.

`BreakpointIndicator.runToHere` (`BreakpointIndicator.tsx:161`) builds `run-to ${addrLabel}`. With a
NextReg breakpoint that would emit `run-to NR:$07`, which is meaningless. The modifier-click gesture
must be suppressed for this shape, and the tooltip line that advertises it (`:107`) dropped.

### 4.8 The dialog

`BreakpointDialog.tsx` already has the right skeleton: a radio group whose selection changes which
other fields exist, and a pure rule module behind it.

**Type radio group** (`KIND_OPTIONS`, `:40-46`) gains a sixth option, **"NextReg write"**, rendered
only when `env.supportsNextRegBreakpoints`. `BreakpointKind` in `breakpoint-form.ts:37` becomes

```ts
export type BreakpointKind = "exec" | "memRead" | "memWrite" | "ioRead" | "ioWrite" | "nextRegWrite";
```

and `applyKindChange` (`:189-199`) — which exists precisely because switching type used to leave a
stale value in a field the user could no longer see — must clear `partition`, `ioMask` **and** the
three new fields appropriately. This is the single most likely place to leave a bug.

**When the kind is `nextRegWrite`, the form is a different four rows:**

```
┌─ Add breakpoint ─────────────────────────────────────────┐
│ Type   ( ) Execution      ( ) Memory read                │
│        ( ) Memory write   ( ) I/O read                   │
│        ( ) I/O write      (•) NextReg write              │
│                                                          │
│ Register [ $07                                        ]  │
│          $07 — CPU Speed                                 │
│                                                          │
│ [x] Break only on a specific value                       │
│     Value [ $03 ]   Mask [ $0f ]                         │
│                                                          │
│ [ ] Also break on Copper writes                          │
│                                                          │
│ [x] Enabled                                              │
│                                                          │
│ Stops after the instruction that wrote the register.     │
│                          [ Cancel ]  [ Add ]             │
└──────────────────────────────────────────────────────────┘
```

- **Register** is a `TextInput`, not a `Dropdown`. All 256 registers are addressable but only 141 are
  documented (`NEXT_REG_DESCRIPTORS`), and a 256-row dropdown is worse to use than typing `$07`. The
  line beneath it is a live hint — the register's `description` from the descriptor table, or
  *"Undocumented register"* — which gives the dropdown's whole benefit (naming the register) without
  its cost. The field accepts the same literals every other numeric field does, through
  `parseNumericInput` (`breakpoint-form.ts:208`), which wraps the command tokenizer so the dialog and
  the command never drift.
- **Partition row is hidden entirely** when the kind is `nextRegWrite`. It is hidden, not disabled
  with a hint: a NextReg has no location, so there is no "why not" worth explaining, unlike the I/O
  case where a user might reasonably expect a partition to apply.
- **The value filter** is a checkbox revealing two fields, the same disclosure pattern the partition
  row already uses (`:135-180`). Mask defaults to `$FF` and is only meaningful with a value.
- **The footnote** carries the §3 contract. It is the one place a user will read it.

`BreakpointEnvironment` (`breakpoint-form.ts:68-89`) gains

```ts
  /** Whether `nr:<register>` means anything on this machine — the ZX Spectrum Next only. */
  supportsNextRegBreakpoints?: boolean;
```

filled in `useBreakpointDialog.ts` beside the existing `supportsBankRelative: machineId === MI_ZXNEXT`
(`:92`). Those two gates and `BreakpointCommands.ts:174` must stay in sync; the comment at
`breakpoint-form.ts:74-81` already explains why (a dialog that authored what the command layer
rejects is a bypass, not a convenience).

New rules in `validateBreakpointForm` (`:316-398`):

| Rule | Message |
| --- | --- |
| kind is `nextRegWrite` on a non-Next machine | "NextReg breakpoints are supported on the ZX Spectrum Next only." |
| register empty | "Enter a Next Register number." |
| register unparseable | "Enter a valid register, for example \$07, 7, or %00000111." |
| register outside `$00..$FF` | "A Next Register number is between \$00 and \$FF." |
| value/mask outside `$00..$FF` | "A value is between \$00 and \$FF." |
| mask set with no value | "A mask needs a value to mask." |
| duplicate key | the existing form-level rule, unchanged — it works off `breakpointKeyOf` |

`formToBreakpointInfo` (`:236`) and `breakpointToForm` (`:281`) each gain a `nextRegWrite` branch —
that name is the *form's* kind, the radio group's value, and is unaffected by there being no such
field on `BreakpointInfo` (§4.1).

**`isBinaryBreakpoint` is renamed to `isAuthorableBreakpoint` in this change**, not in a follow-up.
It is the predicate that gates *every* editing affordance in the panel, and it has to change anyway
to accept the new shape, so renaming at the same moment is cheaper than touching the same call sites
twice:

```ts
/**
 * True for a breakpoint the dialog can author. False only for source-bound ones, which the
 * editor's glyph margin owns.
 */
export function isAuthorableBreakpoint(bp?: BreakpointInfo): boolean {
  return bp?.address !== undefined || isNextRegBreakpoint(bp ?? {}) || isBankRelative(bp ?? {});
}
```

"Binary" meant "bound to an address rather than to source", which stopped being true the moment a
bank-relative breakpoint qualified and is plainly wrong now that a register does. The new name says
what the predicate is actually consulted for at all six call sites: may this breakpoint be opened in
the dialog. 23 references across six files — `DisassemblyRow.tsx` (3),
`BreakpointsPanel.tsx` (6), `BreakpointDialog.tsx` (1), `useBreakpointDialog.ts` (1),
`breakpoint-form.ts` (1) and `test/debug/breakpoint-form.test.ts` (11) — all mechanical.

### 4.9 The Breakpoints panel

The panel renders every shape through one `addrKey` string and has no per-shape branch
(`BreakpointsPanel.tsx:339-442`), which is why the new shape mostly lands for free. Four things do
not:

1. **The indicator's colour is inferred from the *type* of the address prop.**
   `BreakpointIndicator.tsx:120-127` picks `--color-breakpoint-binary` when
   `typeof address === "number"`, and otherwise falls to `--color-breakpoint-code` or
   `--color-debug-unreachable-bp`. A NextReg breakpoint passes the string `"NR:$07"`, so it would be
   painted as an *unresolved source breakpoint* — orange, meaning "this cannot fire yet", when it is
   fully armed.
   **Fix by making the distinction explicit rather than inferred**: add a `resolved?: boolean` prop,
   pass `true` for address-bound and NextReg breakpoints, and keep the inference only as the
   fallback. Bank-relative breakpoints have the same latent problem today; this fixes them too.
2. **A type icon and a type name.** `bpType = "NextReg write"`, `typeIcon = "bp-nextreg"`
   (`:78-95`). **`src/renderer/assets/icons/bp-nextreg.svg` is already written** — a sliders glyph
   under the family's standard downward write arrow:

   ```svg
   <path d="M12 2v8.5"/><path d="m7.5 6 4.5 4.5 4.5-4.5"/>
   <path d="M3 15.5h5M12 15.5h9"/><path d="M10 13.5v4"/>
   <path d="M3 20h9M16 20h5"/><path d="M14 18v4"/>
   ```

   The arrow is the same one `bp-mem-write` and `bp-io-write` carry, so "write" reads without
   learning a new sign; only the target glyph is new. Sliders because a NextReg is a *configuration*
   register — the machine's settings, not its memory — and because a striped silhouette is
   unmistakable beside the memory bar and the I/O cup at 16px. It is a composite in Lucide's grammar
   rather than a verbatim Lucide file, which is what the whole `bp-*` set already is. The shared
   `--color-breakpoint-type` applies unchanged.

   **Checked at 16px, and adjusted.** The first draft's arrow was shortened to make room for the
   sliders, and at panel size it read as a small mark above a dense block — legible, but with the
   weakest arrow in a family whose whole grammar rests on that arrow meaning "write". Rasterising it
   beside `bp-mem-write` and `bp-io-write` at 16 and 32px settled it: the arrow is now 8.5 units
   with a 9-wide head, matching the family, and the tracks moved down to suit. The tick knobs do not
   mush, so the dial fallback was not needed.

   What that check does and does not establish: it rasterises the same SVG at the same size in the
   same engine Electron uses, so it answers the glyph question faithfully. It says nothing about the
   row's geometry in the real panel, which `.ai/ui-theming-intent-and-lessons.md` insists is checked
   in the running app — still outstanding, and the one thing left to look at before this phase is
   truly closed.
3. **Row content.** The `bp.exec` instruction cell (`:412`) and the watchpoint
   `opStartAddress` + instruction pair (`:418-432`) are both wrong for this shape. Add a third,
   parallel block:

   ```tsx
   {isNextRegBreakpoint(bp) && (
     <>
       <Secondary text={nextRegName(bp.nextReg)} width="auto" />
       {machineState === MachineControllerState.Paused && hit?.reg === bp.nextReg && (
         <Value
           text={`$${toHexa2(hit.oldValue)} → $${toHexa2(hit.newValue)}`}
           className={regStyles.stateValueAlt}
         />
       )}
     </>
   )}
   ```

   The register's name takes `Secondary`'s neutral treatment; the old → new pair takes
   `--color-state-value-alt`, the secondary accent, which is what the panel already uses for the
   *supporting* value beside a headline (the resolved address at `:404`, the op address at `:421`).
   The headline — `NR:$07` — keeps `.bpLabel`'s primary `--color-state-value`. This follows the
   established rule rather than introducing a hue.
4. **`isCurrent`.** The `else if (machineState === Paused)` chain at `:359-367` gains
   `else if (isNextRegBreakpoint(bp)) { isCurrent = lastCpuState?.lastNextRegWrite?.reg === bp.nextReg; }`.

`refreshBreakpoints` disassembles only when `bp.address !== undefined` (`:188`), so a NextReg row
gets `instruction === ""` and no instruction cell renders — correct, and no change needed.

`breakpointTooltip` (`:52-88`) gains the kind name, the register's description, the Copper state when
set, and **the §3 timing sentence**.

### 4.9a Grouping the panel by kind

The panel has no sorting and no grouping today: rows come out in `breakpointDefs` insertion order
(`DebugSupport.ts:101`), so **the list reshuffles as breakpoints are added and removed**. A sixth
kind makes that worse, and grouping fixes both problems in one pass. It is designed here as its own
phase (§5, Phase 7) because it is independently shippable and touches no emulator code.

**Six groups, in the dialog's radio-group order** — Execution, Memory read, Memory write, I/O read,
I/O write, NextReg write. An empty group renders nothing at all, header included, so a machine with
three execution breakpoints looks exactly as it does today plus one header.

**The list stays one flat array.** `VirtualizedList` takes `items` and `renderItem(index, item)`
(`src/renderer/controls/VirtualizedList.tsx:38`, `:59`) and wraps `virtua`, which measures every row
itself — the panel passes no `itemSize` (`BreakpointsPanel.tsx:339-341`), so a header of a different
height from a row needs no special handling. Headers therefore become items:

```ts
type BreakpointListItem =
  | { kind: "header"; group: BreakpointGroup; count: number }
  | { kind: "row"; bp: BreakpointRowModel };
```

built by a **pure function in a new `src/renderer/appIde/utils/breakpoint-grouping.ts`**:

```ts
export function groupBreakpoints(
  bps: BreakpointRowModel[],
  partitionLabels: Record<number, string>
): BreakpointListItem[];
```

Pure and React-free so it runs in the fast `node` project, following the precedent
`breakpoint-form.ts` set for exactly this reason (§5.1 of the companion plan). The sort rule is the
part worth testing, and it is not testable through a mounted virtualized list.

**Sort within a group by `(shapeRank, displayKey)`**, where `shapeRank` is address-bound 0,
bank-relative 1, label-anchored 2, source-bound 3. NextReg breakpoints are alone in their group, so
their rank never comes up.

Ranking by shape first keeps source-bound breakpoints clustered at the foot of the Execution group
rather than interleaved among `$`-addresses — they are a different thing to look at, and the
resolved-address column only appears on them.

**A plain `localeCompare` on the display key is correct here, and that is a fact about the key
format, not laziness.** Display keys are fixed-width hex within a shape — `$8000`, `05:+$0100`,
`NR:$07` — so lexicographic order *is* numeric order. It would be wrong the moment a key rendered an
address as variable-width decimal. Say so at the comparator, because the next reader's instinct will
be to "fix" it into a numeric compare on `bp.address`, which cannot order the four shapes against
each other.

**The header** is `SectionHeader` from `@renderer/controls/data` (`index.tsx:161`) — purpose-built
for "a heading *within* panel content", and its own doc comment warns against using `PanelHeader`
here, which is a panel's chrome and reads as a second title. It carries the kind's type icon, its
name, and the count: a sliders glyph, then `NextReg write · 2`. Putting the type icon in the header
is what makes the icon set learnable; the per-row indicator keeps `showType` regardless, because a
virtualized list scrolls rows away from their header.

**What grouping breaks, and what it does not:**

- `renderItem` currently does `bps[idx]` and assumes every index is a breakpoint. Every index use
  moves behind the item union. The existing `try/catch` around the row body (`:342`, `:437`) stays.
- Headers bind no `onContextMenu` and no `onDoubleClick`, so the row menu cannot open on one.
- **`menuTarget` needs no change.** It already holds the row's `BreakpointInfo` object rather than an
  index, precisely because a breakpoint has no id (`:147` and its comment) — so re-grouping between
  a right-click and a menu click cannot retarget the menu. This is the one place the existing design
  saves us.
- The `EmptyState` test (`:337`) runs on the ungrouped source array, not on the flattened items, or
  a list of six headers and no rows would count as non-empty.

#### Grouping is a toggle, not a behaviour change

A third `IconButton` joins the panel's toolbar strip (`BreakpointsPanel.tsx:286-306`), beside Add
and Remove all. Grouping is **on by default** and the button turns it off, which restores today's
flat list.

Why it is a toggle at all: grouping is the right default for a mixed set, but it is the wrong shape
for someone watching four execution breakpoints in one routine, where the header costs a row and
tells them nothing. A flat list is also how the panel has always looked, and silently changing that
for everyone is a worse default than offering the switch.

**The state is a persisted global setting, not component state.** A view preference that resets
every time the panel remounts is an annoyance, not a preference:

- `SETTING_IDE_BP_GROUP_BY_KIND = "ideViewOptions.breakpointsGroupByKind"` in
  `src/common/settings/setting-const.ts`.
- A definition in `setting-definitions.ts` with `type: "boolean"`, `defaultValue: true`,
  `saveWithIde: true`, `boundTo: "ide"` — copy the shape of `SETTING_IDE_SYNC_BREAKPOINTS`
  (`:260-267`), which is the closest existing analogue.
- Read with `useGlobalSetting(...)`, written with
  `mainApi.setGlobalSettingsValue(SETTING_IDE_BP_GROUP_BY_KIND, !value)`. `Toolbar.tsx:25` and
  `:53-62` are the reference for both halves.

`IconButton` already carries `selected`, which it renders as a pressed style *and* as
`aria-pressed` (`IconButton.tsx:17`, `:53`, `:62`), so the toggle needs no new control — unlike the
radio group §4.8's predecessor had to add.

**Icon: the stock `list-tree`, which already exists** — a vertical spine with branches
(`theming/icon-defs.ts:473`), which is what grouping does to a list. An earlier draft said to save a
Lucide `list-tree.svg` into `assets/icons/`; that was wrong and
`test/theming/icon-registry.test.ts` catches it, because a file icon shadowing a stock entry of the
same name means one of the two should not exist. Reuse the stock name; add no file.

Two consequences worth stating, because both are cheap and both would otherwise be missed:

- **When grouping is off, `groupBreakpoints` still sorts.** The toggle controls headers, not order.
  Reverting to `breakpointDefs` insertion order when the user turns grouping off would restore the
  reshuffling bug along with the flat list, which is not what they asked for. The function takes a
  `grouped: boolean` and emits either a headered list or a flat sorted one.
- **The setting is `boundTo: "ide"` and `saveWithIde: true`**, so it belongs to the IDE window, not
  to a project. A grouping preference that travelled in `.kliveproject` would be shared through
  source control, which is wrong for a view preference.

`createBooleanSettingsMenu(SETTING_IDE_BP_GROUP_BY_KIND)` would also give it an app-menu entry
(`src/main/app-menu.ts:622` shows the call). Not planned — the toolbar button is where a user
already is when they want it — but it is a one-line addition if the menu is wanted later.

### 4.10 Persistence

- **`.kliveproject`** — `BreakpointInfo` objects are written verbatim (`src/main/projects.ts:394`),
  so the four new fields round-trip with no change. **No schema bump**: the rule at `projects.ts:521`
  is explicit that the version moves when the *meaning* of a stored breakpoint changes, not when a
  field is added, because every reader already tolerates absent fields. A project written by this
  build opens in an older one with the NextReg breakpoints silently dropped, which is the correct
  outcome — the older build cannot honour them.
- **`.nex.dis` sidecars** — a NextReg breakpoint belongs to the *machine*, not to a `.nex` file, so
  it must not be written there. This needs no code: `toSidecarBreakpoints`
  (`nexBreakpointSync.ts:40-67`) already keeps only breakpoints with stated `bank`/`bankOffset` and
  a `nex` owner. Add a test asserting the exclusion, because the filter's silence is easy to break.

---

## 5. Phases

### Phase 1 — the model and the key (nothing user-visible)

1. The four fields in `BreakpointInfo.ts`, documented in the house style, plus
   `isNextRegBreakpoint` in `breakpoint-scope.ts` (§4.1).
2. The `NR:` branch in `buildBreakpointKey`, plus the `nextRegValue`/`nextRegMask` rendering.
3. `test/debug/breakpoint-keys.test.ts`: the three key forms, that `nextRegCopper` does **not**
   change the key, that `getBreakpointAddressSpec` returns the same string, and that a NextReg
   breakpoint with no register still throws.

### Phase 2 — the core

4. The watch arrays, the origin discriminator and the latch in `zxnext-nextreg.c`; the
   origin set at the Copper site in `zxnext-copper.c`.
5. The three exports in `zxnext.c`, `scripts/build-zxnext-wasm.cjs` and `ZxNextWasmV2Loader.ts`
   (interface, required-exports list, and the `Uint8Array` views).
6. `npm run build:zxnext-wasm` and `npm run check:zxnext-wasm-size`.
7. `test/zxnext-hw/nextreg/write-watch.test.ts` through the harness: the watch table alone, driven
   by `out`/`nextreg`, asserting the latch's contents. Adding a session method for it follows
   `test/harness/zxnext/README.md` → "Adding a method" — the watch is core state the IDE has no path
   to, so it goes through `machine.wasmV2Runtime!.exports` as `readNextRegDirect` does.

### Phase 3 — `DebugSupport` and the debug loop

8. `nextRegWatch` + the two value arrays, `refreshNextRegWatch()`, `hasNextRegBreakpoints()`,
   `hasNextRegWrite()`; the four new fields in `addBreakpoint`'s literal; `isNextRegBreakpoint`
   folded into the `exec:` negation. The `IDebugSupport` members.
9. The loop changes in `ZxNextWasmV2Machine` (§4.5), including widening the `opStartAddress` gate.
10. `lastNextRegWrite` on the machine and on `CpuState`; the `MachineController` stop message.
11. `test/debug/nextRegBreakpoints.test.ts` (node): watch-table authoring, including the
    two-filters-on-one-register collapse to `mask = 0` and the exact test still rejecting the
    non-matching one.
12. `test/wasm/zxNext/wasm-next-nextreg-breakpoint.test.ts`, modelled on
    `wasm-next-access-breakpoint.test.ts`: a stop on `OUT ($253B),A`; a stop on `NEXTREG $07,$03`; a
    stop on the first of a copper burst inside one instruction; a value filter that matches and one that does not;
    a Copper write ignored without `-c` and caught with it; a reset branch never reported; and the
    unwatched-frame case that proves the gate actually skips the work.

### Phase 4 — the command grammar

13. The `nr:` branch, the `-c` and `-v` options, the six cross-check rules, `isNextRegBreakpoint`
    in all three `bpDef` literals' `exec:` negation, the `bp-en` not-found message fix, and the
    `runToHere` suppression in `BreakpointIndicator`.
14. `test/commands/BreakpointCommands.test.ts`: each accepted spelling, each rejection, the
    non-Next rejection, and a round trip `bp-set nr:$07 -v $03 -m $0f` → `bp-list` → `bp-del` using
    the printed key.

### Phase 5 — the dialog

15. The sixth kind, the register field with its live description, the value-filter disclosure, the
    Copper checkbox, the hidden partition row, the footnote.
16. `applyKindChange`, `formToBreakpointInfo`, `breakpointToForm`, `validateBreakpointForm`, and
    the `isBinaryBreakpoint` → `isAuthorableBreakpoint` rename across all 23 references (§4.8).
    Do the rename as its own commit *within* this phase, so the mechanical diff stays separable from
    the behavioural one in review.
17. `test/debug/breakpoint-form.test.ts`: one case per new rule, and a round trip
    `breakpointToForm ∘ formToBreakpointInfo` for the new kind with and without a filter. Extend the
    existing command-parser cross-check table to the register field.
18. `test/controls/BreakpointDialog.test.tsx`: field visibility per kind (the register field appears
    and the partition row disappears), the description hint, and the emitted
    `BreakpointDialogResult`. Do not re-test validation here — it belongs to step 17.

### Phase 6 — the panel

19. The `resolved` prop on `BreakpointIndicator` and its use for both NextReg and bank-relative
    breakpoints; the type name and icon (`bp-nextreg.svg` is already committed); the row's name +
    old → new cells; `isCurrent`; the tooltip. Check the icon at 16px in the running panel and fall
    back to the dial glyph if the knobs mush (§4.9 item 2).
20. `test/controls/BreakpointsPanelActions.test.tsx`: a NextReg row offers Edit and honours
    double-click; `test/renderer/`-style assertions for the row's cells and the indicator's colour.
21. The `.nex.dis` exclusion test (§4.10).

### Phase 7 — grouping the panel by kind

Independent of everything above: it touches no emulator code and would be worth doing with five
kinds. Sequenced last so it has the sixth group to place.

22. `src/renderer/appIde/utils/breakpoint-grouping.ts` per §4.9a — the item union, the group order,
    the `grouped: boolean` parameter, and the `(shapeRank, displayKey)` comparator with its comment
    about why a string compare is correct.
23. `test/debug/breakpoint-grouping.test.ts` (node): empty groups produce no header; counts are
    right; the four shapes order by rank within the Execution group; two addresses in one group
    order numerically; a list of only headers is not mistaken for a non-empty list; **and
    `grouped: false` still sorts, emitting the same rows in the same order with no headers.**
24. `SETTING_IDE_BP_GROUP_BY_KIND` in `setting-const.ts` and `setting-definitions.ts`. **No new
    icon**: the stock `list-tree` already exists (§4.9a).
25. `BreakpointsPanel.tsx`: the toolbar toggle wired to `useGlobalSetting` +
    `setGlobalSettingsValue`; flatten through `groupBreakpoints`, render `SectionHeader` for header
    items, move the `EmptyState` test onto the ungrouped array, and bind no gestures on headers.
    Extend `test/controls/BreakpointsPanelActions.test.tsx` to assert a right-click on a header
    opens nothing, and that the toggle flips the setting rather than local state.

### Phase 8 — docs and lessons

26. `docs/content/commands-reference.mdx`: the `nr:` form added to the `address-spec` list in
    **all three** of `bp-set`, `bp-del` and `bp-en` (they are separate copies today), plus `-v`,
    `-m` and `-c` on `bp-set`, and the §3 timing sentence.
27. `docs/content/working-with-ide/breakpoints.mdx`: a short section on the new type, what the
    panel row shows, the timing contract, and the fact that the view is now grouped by kind with a toolbar toggle to turn that off.
    Regenerate the panel screenshot with `scripts/doc-shots/` per `.ai/doc-screenshots-guide.md`
    rather than hand-capturing it — the grouping changes it, so the existing shot is stale whether
    or not a NextReg breakpoint is in frame.
28. `npm run doc:build && npm run doc:check`; update `.plans/docs-*.golden.txt` only if a route or
    asset is genuinely added. Note the pre-existing `/contribute/wasm-toolchain/index.html` drift
    recorded in `.plans/BREAKPOINT_MANAGEMENT_UI_PLAN.md` §11 — do not absorb it.
29. **`.ai/ui-theming-intent-and-lessons.md`**: record the durable rules this change teaches — that
    a breakpoint indicator's colour must be told whether the breakpoint is armed rather than
    inferring it from the *type* of its address prop; that a new panel row reuses
    `--color-state-value` for the headline and `--color-state-value-alt` for the supporting pair
    rather than introducing a hue; and that a heading inside panel content is `SectionHeader`, never
    `PanelHeader`. Fold them into the existing sections; keep no history.

---

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| `exec:` negation missed in one of the four sites, arming a NextReg breakpoint as an execution breakpoint at `undefined` | Phase 3 step 8 lists all four; a test asserts `exec === false` for a NextReg breakpoint out of `listBreakpoints` |
| A field dropped from `addBreakpoint`'s field-by-field literal — the bug that file's comments record three times already | Phase 3 test reads the definition back through `listBreakpoints` and compares all four fields |
| A burst of watched writes inside one instruction reports only the first | Documented and deliberate (§4.2); `test/zxnext-hw/nextreg/write-watch.test.ts` pins the copper-burst case so it cannot silently become last-write-wins |
| Stale watch table left in the core after the last NextReg breakpoint is removed | The `else` branch calling `zxnextClearNextRegWatch` at loop entry (§4.5), with a test that removes the breakpoint and runs an unwatched frame |
| The previous value read through `zxnextNextRegPeek` instead of `GetDirect`, reporting a value the register never held | §4.2 names the function; the Phase 2 test asserts the old value for a register whose read mux masks bits (`$02`, whose mask is `$60`) |
| The indicator paints an armed NextReg breakpoint as an unresolved source breakpoint | §4.9 item 1 replaces the inference with an explicit prop; Phase 6 test asserts the fill |
| The dialog's `applyKindChange` leaves a stale field the user cannot see, failing validation against an invisible control | The function exists precisely because this happened before (`BREAKPOINT_MANAGEMENT_UI_PLAN.md` §11 item 2); Phase 5 step 17 tests every kind transition |
| `nr:` shadows a partition label on some machine | Verified for the Next (§4.3); implementation must check the other machines' `parsePartitionLabel` implementations, and the branch is Next-gated anyway |
| A Copper-heavy program stops constantly with `-c` set | `-c` is opt-in and off by default, and the panel row shows `(CPU + Copper)` so the setting is visible |
| The `isAuthorableBreakpoint` rename collides with concurrent work touching the same six files | Its own commit inside Phase 5 (§5 step 16), purely mechanical, so a rebase is trivial |
| The sliders icon mushes at 16px — six strokes, 2.7px knobs | Checked in the running panel in Phase 6 step 19; the dial glyph is the named fallback (§4.9 item 2) |
| Someone later "fixes" the grouping comparator into a numeric compare on `bp.address` | The comparator carries the reason a string compare is correct, and `breakpoint-grouping.test.ts` orders all four shapes against each other, which a numeric compare on one field cannot do |
| Grouping makes an all-header list look non-empty | §4.9a puts the `EmptyState` test on the ungrouped array; Phase 7 step 23 asserts it |

---

## 7. Verification

```bash
npm test -- --project node test/debug/breakpoint-keys.test.ts test/debug/breakpoint-form.test.ts test/debug/nextRegBreakpoints.test.ts test/debug/breakpoint-grouping.test.ts
```

```bash
npm run build:zxnext-wasm && npm run check:zxnext-wasm-size
```

```bash
npm test -- --project node test/wasm/zxNext/wasm-next-nextreg-breakpoint.test.ts test/commands/BreakpointCommands.test.ts
```

```bash
npm test -- --project jsdom test/controls/BreakpointDialog.test.tsx test/controls/BreakpointsPanelActions.test.tsx
```

```bash
npx tsc --noEmit -p build/tsconfig.web.json && npm run build:check && npm run lint:renderer
```

```bash
npx electron-vite build --config build/electron.vite.config.ts
```

```bash
npm run doc:build && npm run doc:check
```

Finally, run the app and set `bp-set nr:$07` against a `.nex` that changes CPU speed — §4.9's
colour bug and the row layout are both things `.ai/ui-theming-intent-and-lessons.md` says to verify
in the running app rather than in a replica.

---

## 8. Decisions

Everything that was open is settled. Recorded here rather than deleted, because each one shaped the
design above and a future reader will otherwise re-open it.

1. **`nr:` takes a register number only, never a name.** `NEXT_REG_DESCRIPTORS` carries
   descriptions ("CPU Speed"), not short identifiers, so there is nothing to parse without first
   adding a `name` field to 141 descriptors. The dialog's live description hint (§4.8) carries the
   discoverability instead: you type `$07` and the form tells you it is the CPU speed register.
2. **There are no NextReg read breakpoints**, now or later. This is what removed `nextRegWrite`
   from the model (§4.1): its only justification was leaving room for a read flag, and without that
   it is a second copy of a discriminator `nextReg` already provides. The register *is* the binding.
   Memory read and I/O read breakpoints are untouched.
3. **The panel is grouped by kind**, designed in §4.9a and sequenced as Phase 7. It also fixes the
   pre-existing reshuffling caused by rendering in `breakpointDefs` insertion order.
4. **`isBinaryBreakpoint` is renamed to `isAuthorableBreakpoint` in this change**, not deferred
   (§4.8). "Binary" meant "bound to an address rather than to source", which already stopped being
   true for bank-relative breakpoints; the new name states what all six call sites actually ask.

### Still genuinely open

- **The sliders icon at 16px.** Chosen from a rendered grid, which is not evidence
  (`.ai/ui-theming-intent-and-lessons.md`). Phase 6 step 19 checks it in the running panel, with the
  dial glyph as the named fallback. This is the only decision above that a verification step can
  still overturn.

---

## 9. Implementation notes

Five deviations from the plan as written, all deliberate, plus two defects the work uncovered in
code that predates it.

1. **`nr:` accepts its filter inline**, `nr:$07=$03/$0F`, not just `nr:<register>`. The plan
   specified only the register; the round-trip test showed the display key of a *filtered*
   breakpoint is what `BreakpointIndicator` splices into `bp-del <spec>`, so a parser that stopped
   at the register would leave a dot the user could not click away — the same bug
   `getBreakpointAddressSpec` exists to have fixed for bank-relative watchpoints.

2. **`buildNextRegWatch()` rebuilds on every call** rather than being invalidated from the fifteen
   sites that mutate the breakpoint set. The debug loop asks once per entry, over a handful of
   definitions; paying for the rebuild buys away a class of missed-invalidation bug that
   `DebugSupport`'s own comments record three instances of.

3. **The three `bp-*` commands share one `breakpointFromArgs`.** They held three identical literals
   that each had to gain four fields, and the breakpoint a command builds is also the key it looks
   up by — so a field added to two of three is not a compile error, it is `bp-del` silently removing
   nothing.

4. **A spec that fails to parse now returns before the option cross-checks.** `bp-set nr:$07=$03/zz`
   answered "you can use the -v option only with a NextReg breakpoint", because the half-parsed tail
   had set `-v` and left `nextReg` unset. The parsed parts now commit only once the whole spec is
   good, and the early return fixes the same class for every shape.

5. **No `list-tree.svg` was added.** The stock icon of that name already exists, and
   `test/theming/icon-registry.test.ts` refuses a file icon that shadows one.

**Two pre-existing defects, both found by looking at the running app:**

- **`BreakpointIndicator` inferred "armed" from the type of its `address` prop.** Bank-relative
  breakpoints have been painted as unresolved source breakpoints — amber, meaning "cannot fire yet"
  — since they were introduced. Fixed with an explicit `armed` prop.
- **`.bpLabel`'s `min-width: 9ch` was doing duty as a gap.** A key longer than the box abutted the
  next cell; `NR:$4C=$0B` ran into the register's name. Split into `min-width: 8ch` plus a 1ch
  margin.

Both rules are recorded in `.ai/ui-theming-intent-and-lessons.md`, along with the distinction
between rasterisation checks (a browser at the target size is valid evidence for a glyph) and
geometry checks (only the running app will do).

**A NextReg breakpoint stops *before* a reset request is carried out** (§4.5), which the plan did
not anticipate. Writing `$02` asks the machine to reset, and `applyWasmV2ResetRequest` ran before
the hit test — so a soft reset lost the PC and the paging the breakpoint existed to report, and a
**hard reset cleared the core's latch and the breakpoint never fired at all**. The hit test now runs
first and the request is honoured at the next loop entry, so the machine is left standing where the
write happened. `NextRegWriteEvent` also carries `pc` and `partition`, captured at that moment,
because the output pane is the only record that survives the user resuming.

**`scripts/doc-shots/recipes/breakpoints.cjs` is new** and regenerates `bp-view.png`. Note the trap
it hit: the panel's list is virtualized and shares the sidebar's height with the other Debug panels,
so rows past the fold are *absent from the DOM*, not merely clipped — a fixture with one breakpoint
of every kind scrolled the NextReg rows, the point of the shot, out of the capture entirely.

`npm run doc:check` still reports the pre-existing `/contribute/wasm-toolchain/index.html` route
drift (committed in `f176f2398`); the golden was left alone rather than absorbing someone else's.
