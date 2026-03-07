# F9 Multiface NMI — Known Issues & Debugging Guide

> Companion to `nmi-plan.md`. Written to preserve all debugging knowledge for a new AI
> session. The 10 tasks in `nmi-plan.md` are all complete and all tests pass, but the
> runtime behaviour is still broken.

---

## 1. What Should Happen (Happy Path)

When F9 is pressed in the emulator:
1. `executeCustomCommand("multifaceNmi")` sets `_pendingMfNmi = true`.
2. `updateNmiSources()` latches `_nmiSourceMf = true` and calls
   `multifaceDevice.pressNmiButton()` → `nmiActive = nmiHold = true`.
3. NMI state machine: IDLE → FETCH (`sigNMI = true`).
4. Z80 CPU acknowledges NMI → `processNmi()` → CPU jumps to **0x0066**.
5. State machine: FETCH → HOLD; `multifaceDevice.onFetch0066()` → `mfEnabled = true`
   (MF ROM paged in at slot 0, 0x0000–0x3FFF).
6. MF ROM runs (at 0x006d onwards), shows a menu, user interacts.
7. MF ROM reads the **disable port** → pages out MF memory (`mfEnabled = false`,
   `nmiActive = false`).
8. MF ROM executes **RETN** → `onRetnExecuted()` fires → `multifaceDevice.handleRetn()`
   clears `nmiHold`, PC is restored (or returned by RETN from stack).
9. `nmiHold = false` → HOLD → END → IDLE; sources cleared.
10. CPU resumes the interrupted program from the correct return address.

---

## 2. Observed Behaviour

Pressing F9:
- MF ROM IS loaded and reached (MF_ROM[0x0066] = 0xC3 ✓).
- State machine reaches HOLD ✓.
- The machine **effectively resets** — PC goes to **0x0168** (ZX Spectrum Next ROM boot
  area) and loops there indefinitely.
- The HOLD state **never transitions to END**.

### Diagnostic Log Output (most recent session)

```
[NMI] multifaceNmi hotkey: ...nmiState=IDLE nmiAcceptCause=true
[NMI] MF NMI accepted → _nmiSourceMf=true (pc=...)
[NMI] IDLE→FETCH: sigNMI=true sourceMf=true ...
[NMI] processNmi() acknowledged: stacklessNmi=true pc=0x...
[NMI] FETCH→HOLD: fetched 0x0066 sourceMf=true
[NMI] onFetch0066: mfEnabled=true MF_ROM[0x0066]=0xc3 (ROM loaded ✓)

[NMI] HOLD tick=1     pc=0x006d  sp=0x5bf1  mfEnabled=true   nmiHold=true
readDisablePort: modeP3=false mode128=true  pc=0x00e7 → no page-out (read-only for mode128/48)
readDisablePort: modeP3=false mode128=true  pc=0x00ef → no page-out
readDisablePort: modeP3=false mode128=true  pc=0x00f7 → no page-out
readDisablePort: modeP3=false mode128=true  pc=0x0104 → no page-out
readDisablePort: modeP3=false mode128=true  pc=0x0111 → no page-out
readDisablePort: modeP3=true               pc=0x5b8d → paging out      ← mfEnabled cleared here

[NMI] HOLD tick=50001  pc=0x5cd8  sp=0x5dfe  mfEnabled=false  nmiHold=true   ← STUCK
readDisablePort: modeP3=true  pc=0x5cf5 → paging out
readDisablePort: modeP3=true  pc=0x5d26 → paging out
readDisablePort: modeP3=true  pc=0x5d39 → paging out

[NMI] HOLD tick=100001  pc=0x0168  mfEnabled=false  nmiHold=true
[NMI] HOLD tick=150001  pc=0x0168  mfEnabled=false  nmiHold=true
... (loops forever at 0x0168)
```

**Notably absent from the log:**
- `[NMI] HOLD→END (after N ticks)` — never printed
- `[NMI] onRetnExecuted:` — never printed
- `[NMI] handleRetn:` — never printed

---

## 3. Root Cause Analysis

### Bug A — `nmiHold` never clears (primary blocker)

**Location:** `MultifaceDevice.ts`

In the VHDL (`multiface.vhd`), `mf_nmi_hold` is directly wired to `nmi_active`:
```vhdl
mf_nmi_hold = nmi_active
```

In the emulator, `nmiHold` is a **separate boolean field** that is:
- Set by `pressNmiButton()` alongside `nmiActive`.
- Cleared only by `handleRetn()`.

`readDisablePort()` (in P3 mode) correctly clears `nmiActive = false` and `mfEnabled = false`,
but it does **NOT** clear `nmiHold`. Because `nmiHold` is a separate field, it remains
`true` indefinitely.

The HOLD state checks `!this.nmiHold` where:
```ts
// ZxNextMachine.ts
get nmiHold(): boolean {
  if (this._nmiSourceMf) return this.multifaceDevice.nmiHold;  // ← always true
  ...
}
```

**Fix:** Make `nmiHold` a getter that returns `nmiActive` (making them identical), or clear
`nmiHold` in `readDisablePort()` and `writeDisablePort()` / `writeEnablePort()` wherever
`nmiActive` is cleared.

The cleanest approach is to remove the `nmiHold` field and replace it with:
```ts
// MultifaceDevice.ts
get nmiHold(): boolean {
  return this.nmiActive;  // mirrors VHDL: mf_nmi_hold = nmi_active
}
```
Then clean up all places that set `nmiHold` (since it no longer needs explicit setting).

---

### Bug B — Stackless NMI corrupts the return address for MF NMI

**Location:** `ZxNextMachine.processNmi()`

When `enableStacklessNmi` (NR 0xC0 bit 3) is active, `processNmi()` does:
```ts
this.sp = (this.sp - 2) & 0xffff;
this.interruptDevice.nmiReturnAddress = this.pc;   // saved, not written to stack
this._stacklessNmiProcessed = true;
this.pc = 0x0066;
```

SP is moved down by 2 but **nothing is written to the stack**. The MF ROM then runs with
a corrupt stack — the 2-byte "slot" below SP contains whatever was there before, not the
return address.

When the MF ROM eventually executes **RETN**, `ret(cpu)` pops garbage from `[SP]` → PC
is set to a random (probably 0x0168 based on logs) address. `onRetnExecuted()` is supposed
to fire next and restore PC, but if the garbage PC lands in the ROM boot area (0x0168) and
causes a re-initialization before RETN-related cleanup completes, the machine is hijacked.

The VHDL spec in `nmi-plan.md` § 1.8 says:
> The RETN instruction **reads the return address from nextreg 0xC2/C3** instead of the stack.

This means on real hardware, RETN with stackless NMI reads from an NR register, not from
the stack — so there is no corruption. The emulator's `onRetnExecuted()` hook attempts to
fix this (overwriting PC after the stack pop), but it never fires because RETN is never
reached (the machine resets before then due to the corrupt PC from the first RET/RETN
encountered in system code).

**Fix:** In `processNmi()`, skip stackless NMI behaviour when `_nmiSourceMf = true`:
```ts
protected override processNmi(): void {
  this.sigNMI = false;
  // MF hardware predates stackless NMI — always use standard push for MF NMI.
  const useStackless = this.interruptDevice.enableStacklessNmi && !this._nmiSourceMf;
  if (useStackless) {
    // existing stackless path...
  } else {
    super.processNmi();   // standard: push PC to stack, jump to 0x0066
  }
}
```

Additionally, a more complete fix would be to actually write the return address to the two
stack bytes when `_nmiSourceMf = true` and `enableStacklessNmi = true`:
```ts
// After SP -= 2:
this.writeMemory(this.sp,     this.pc & 0xff);
this.writeMemory(this.sp + 1, this.pc >> 8);
```
This gives RETN a valid address to pop, without changing the stackless NMI behavior for
other NMI types (DivMMC, ExpBus).

---

### Bug C — Mode switch during MF NMI execution (observational)

The log shows:
- Early disable-port reads (0xe7–0x111): **modeP3=false, mode128=true**
- Later disable-port read (0x5b8d): **modeP3=true**

`modeP3` / `mode128` are derived from `divMmcDevice.multifaceType` (NR 0x0A bits 7:6).
`hardReset()` sets `multifaceType = 1` (MF128 v87.2). At some point during the MF NMI
execution, `multifaceType` changes to 0 (P3 mode).

This mode change happens because, once the corrupt stack causes the machine to land in the
ROM boot area (0x168), the ZX Spectrum Next BIOS re-initialises NR 0x0A → sets
`multifaceType = 0`.

Since the mode-switch is a symptom rather than a root cause, fixing Bugs A and B should
prevent this scenario from occurring. However, after the fixes, confirm that the
`multifaceType` in use matches what `enNextMf.rom` expects.

---

### Bug D — `readDisablePort()` fires for ALL port reads, not just during MF execution

When `modeP3 = true`, **every** read of port 0xBF (the disable port address in P3 mode)
calls `readDisablePort()` and clears `nmiActive` / `mfEnabled`, even if MF memory is
already paged out and the read is normal system I/O (not a MF page-out operation).

Addresses like 0x5b8d, 0x5cf5, 0x5d26, 0x5d39 are in normal RAM/system territory — these
reads are the ZX Next BIOS/OS accessing port 0xBF for legitimate reasons (e.g., joystick
reads), not the MF ROM paging itself out.

Per VHDL, `nmi_active` is only cleared by port reads when MF is relevant. Consider
guarding `readDisablePort()`:
```ts
readDisablePort(): number {
  if (this.modeP3 && this.nmiActive) {   // ← guard: only page-out if MF NMI is active
    this.mfEnabled = false;
    this.nmiActive = false;
    this.machine.memoryDevice.updateFastPathFlags();
  }
  return 0xff;
}
```

---

## 4. Code Locations

| File | Key Sections |
|------|-------------|
| `src/emu/machines/zxNext/ZxNextMachine.ts` | NMI state machine (lines ~124–550), `processNmi()` override, `onRetnExecuted()` override, `beforeOpcodeFetch()`, `stepNmiStateMachine()`, `updateNmiSources()` |
| `src/emu/machines/zxNext/MultifaceDevice.ts` | Entire file — `nmiActive`, `nmiHold`, `mfEnabled`, `pressNmiButton()`, `readDisablePort()`, `handleRetn()`, `onFetch0066()` |
| `src/emu/machines/zxNext/DivMmcDevice.ts` | `multifaceType` field (~line 26), `divMmcNmiHold` getter (~line 166), `afterOpcodeFetch()` / `checkAndHandleRetn()` (~lines 453–486) |
| `src/emu/z80/Z80Cpu.ts` | `onRetnExecuted()` virtual method (~line 1001); called from `retn()` function (~line 8026–8028) |
| `src/emu/machines/zxNext/MemoryDevice.ts` | `OFFS_MULTIFACE_MEM = 0x01_4000`, MF slot-0 paging in `updateFastPathFlags()`, `updateSlotFunctions()` |
| `src/public/roms/enNextMf.rom` | The MF ROM binary (loaded in `ZxNextMachine.setup()`) |

---

## 5. Current Implementation State

### What Works

- All 10 tasks from `nmi-plan.md` are implemented.
- All ~16 138 tests pass (`npx vitest run`).
- F9 pipeline reaches HOLD state: hotkey → `_pendingMfNmi` → `_nmiSourceMf` → IDLE→FETCH
  → CPU NMI ack → FETCH→HOLD → `onFetch0066` → MF ROM at 0x006d.
- MF ROM is loaded: `enNextMf.rom` copied to `OFFS_MULTIFACE_MEM` in `setup()`.
- MF ROM byte at 0x0066 = 0xC3 (JP instruction) — confirmed by log.
- `readDisablePort()` is reached at the correct addresses.
- `onRetnExecuted()` is wired: it calls `multifaceDevice.handleRetn()` if `nmiHold=true`,
  then restores PC if `_stacklessNmiProcessed=true`.
- `divMmcDevice.multifaceType` is initialized to 1 in `hardReset()`.

### What Is Broken

1. **HOLD never ends** — `multifaceDevice.nmiHold` stays `true` permanently (Bug A).
2. **Machine goes to boot area (0x0168)** — stackless NMI + corrupt stack (Bug B).
3. **System-code port reads falsely trigger readDisablePort** (Bug D — secondary).

---

## 6. Diagnostic Logging Already in Place

All log lines are prefixed with `[NMI]`. The following exist and are active:

| Log line | File / Location |
|----------|----------------|
| `multifaceNmi hotkey: ...` | `executeCustomCommand` |
| `MF NMI accepted / blocked` | `updateNmiSources()` |
| `IDLE→FETCH: ...` | `stepNmiStateMachine()` |
| `processNmi() acknowledged: stacklessNmi=...` | `processNmi()` override |
| `FETCH→HOLD: ...` | `stepNmiStateMachine()` |
| `onFetch0066: mfEnabled=true MF_ROM[0x0066]=...` | `MultifaceDevice.onFetch0066()` |
| `HOLD tick=N pc=... mfEnabled=... nmiHold=...` | `stepNmiStateMachine()` (every 50 000) |
| `readDisablePort: modeP3=... pc=... → ...` | `MultifaceDevice.readDisablePort()` |
| `writeEnablePort: ...` | `MultifaceDevice.writeEnablePort()` |
| `writeDisablePort: ...` | `MultifaceDevice.writeDisablePort()` |
| `HOLD→END (after N ticks)` | `stepNmiStateMachine()` — **never reached** |
| `END→IDLE: clearing sources` | `stepNmiStateMachine()` — **never reached** |
| `onRetnExecuted: stackless NMI return → ...` | `onRetnExecuted()` override — **never printed** |
| `handleRetn: clearing nmiActive+nmiHold ...` | `MultifaceDevice.handleRetn()` — **never printed** |

---

## 7. Proposed Fix Order (for a New AI Session)

### Step 1 — Fix Bug A: make `nmiHold` mirror `nmiActive`

In `MultifaceDevice.ts`:
1. Remove the `nmiHold: boolean` field declaration.
2. Add a getter:
   ```ts
   get nmiHold(): boolean { return this.nmiActive; }
   ```
3. Remove all `this.nmiHold = true/false` assignments (they are now redundant).
   The places to clean up: `pressNmiButton()`, `handleRetn()`, `reset()`, constructor.
4. Run tests — all should still pass.
5. Manually test F9: `[NMI] HOLD→END` should now appear in the log.

### Step 2 — Fix Bug B: disable stackless NMI for MF NMI

In `ZxNextMachine.ts`, `processNmi()` (around line 488):
```ts
protected override processNmi(): void {
  this.sigNMI = false;
  // MF hardware predates stackless NMI. Standard stack push keeps RETN working.
  const useStackless = this.interruptDevice.enableStacklessNmi && !this._nmiSourceMf;
  console.log(`[NMI] processNmi(): stacklessNmi=${useStackless} (nmiSourceMf=${this._nmiSourceMf})`);

  if (useStackless) {
    this.tactPlusN(4);
    this.removeFromHaltedState();
    this.iff2 = this.iff1;
    this.iff1 = false;
    this.sp = (this.sp - 2) & 0xffff;
    this.interruptDevice.nmiReturnAddress = this.pc;
    this._stacklessNmiProcessed = true;
    this.refreshMemory();
    this.pc = 0x0066;
  } else {
    super.processNmi();   // standard NMI: pushes correct return address to stack
  }
}
```

### Step 3 — Fix Bug D: guard `readDisablePort()` (optional / verify first)

Before applying, verify whether system code legitimately reads the disable port.
If it does, add a guard to only page-out when actually needed:
```ts
readDisablePort(): number {
  if (this.modeP3 && this.nmiActive) {
    this.mfEnabled = false;
    this.nmiActive = false;
    this.machine.memoryDevice.updateFastPathFlags();
  }
  return 0xff;
}
```

### Step 4 — Verify + remove diagnostic logs

Once F9 shows the Multiface menu and returns to the interrupted program correctly:
1. Remove all `console.log([NMI] ...)` lines from `ZxNextMachine.ts` and
   `MultifaceDevice.ts`.
2. Run tests again.
3. Test DivMMC NMI (F10) to confirm it is not broken.

---

## 8. Open Questions

1. **What does `enNextMf.rom` expect for `multifaceType`?**  
   The ROM file is the ZX Spectrum Next's MF firmware. It likely expects type 0 (MF+3,
   `modeP3=true`) since the Next is a +3-based design. `hardReset()` currently initialises
   `multifaceType = 1` (MF128 v87.2). The BIOS changes it via NR 0x0A during boot, but the
   first F9 press before boot completes may run with the wrong mode.  
   **Verify:** After BIOS boot, what value does NR 0x0A hold? Is it 0x00 (type 0, P3)?

2. **Does `enNextMf.rom` use RETN to return from NMI?**  
   Standard MF firmware uses RETN. Verify by disassembling `enNextMf.rom` and checking
   near addresses 0x0100–0x0200 for `0xED 0x45` (RETN).

3. **Does the system ROM at 0x0168 write to NR 0x0A?**  
   If the boot-area code at 0x0168 writes NR 0x0A, that explains the mode switch from
   mode128 to P3. This write is the symptom of the machine having been hijacked.

4. **Is `handleRetn()` still needed after fixing nmiHold?**  
   After the `nmiHold = nmiActive` change, `handleRetn()` only needs to ensure
   `mfEnabled = false` (it already does that). The `nmiHold = false` line can be removed.
   The `nmiActive = false` line should remain so that RETN is the authoritative clear.

---

## 9. Class / Architecture Summary

```
ZxNextMachine (ZxNextMachine.ts)
  extends Z80Machine (through intermediaries)
  extends Z80Cpu (Z80Cpu.ts)
  
  NMI state machine fields:
    _nmiState: 'IDLE'|'FETCH'|'HOLD'|'END'
    _nmiSourceMf, _nmiSourceDivMmc, _nmiSourceExpBus: boolean
    _pendingMfNmi, _pendingDivMmcNmi: boolean
    _stacklessNmiProcessed: boolean
    _nmiHoldTicks: number
  
  Key overrides:
    processNmi()          — stackless NMI path (BUGGY for MF NMI)
    onRetnExecuted()      — calls handleRetn() + PC fix (never reached in current bug)
    beforeOpcodeFetch()   — runs updateNmiSources() + stepNmiStateMachine()
    afterOpcodeFetch()    — delegates to divMmcDevice.afterOpcodeFetch()

MultifaceDevice (MultifaceDevice.ts)
  nmiActive: boolean       — mirrors VHDL nmi_active
  nmiHold: boolean         — BUG: should be alias for nmiActive, not separate field
  mfEnabled: boolean       — mirrors VHDL mf_enable
  invisible: boolean
  
  pressNmiButton()         — sets nmiActive + nmiHold
  onFetch0066()            — sets mfEnabled when nmiActive
  readDisablePort()        — clears mfEnabled + nmiActive in P3 mode (but NOT nmiHold)
  handleRetn()             — clears nmiActive + nmiHold + mfEnabled (called from onRetnExecuted)

DivMmcDevice (DivMmcDevice.ts)
  multifaceType: number    — bits from NR 0x0A [7:6]; determines port addresses
  divMmcNmiHold: boolean   — getter
  afterOpcodeFetch()       → checkAndHandleRetn() → handleRetnExecution()
```
