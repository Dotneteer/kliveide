# Copper Device Implementation Plan

## Overview

The ZX Spectrum Next **Copper** is a simple coprocessor that executes a list of up to 1024 16-bit instructions from dedicated 2 KB memory. Each instruction is either a **MOVE** (write a value to a NextReg) or a **WAIT** (pause until the raster reaches a specific screen position). The Copper enables cycle-exact register changes synchronized to the video beam, used for palette swaps, scroll effects, and other raster tricks.

### Reference implementations

| Source | Location | Notes |
|--------|----------|-------|
| MAME C++ | `_input/src/mame/sinclair/specnext_copper.cpp/.h` | Two-timer model: execution timer + frame-restart timer |
| FPGA VHDL | `_input/next-fpga/src/device/copper.vhd` | Single-clock process; compares `hcount_i`/`vcount_i` against WAIT target |
| NextReg docs | `_input/next-fpga/nextreg.txt` (regs 0x60–0x64) | Register interface specification |

### Current state in Klive

`src/emu/machines/zxNext/CopperDevice.ts` is a **data-store only**:
- 2 KB instruction memory, register I/O for NextRegs 0x60–0x64.
- No execution engine, no clock integration, no MOVE/WAIT processing.

The machine (`ZxNextMachine.ts`) creates and resets the copper device but **never clocks it**. There is no call from `onTactIncremented()` or `onInitNewFrame()` to drive copper execution.

---

## Instruction set (from FPGA & MAME)

| Bit 15 | Meaning | Encoding |
|--------|---------|----------|
| 0 | **MOVE** reg, val | `0RRRRRRR VVVVVVVV` — write value V to NextReg R (R < 0x80). If R == 0 the instruction is a **NOP**. |
| 1 | **WAIT** line, hc | `1HHHHHH LLLLLLLLL` — wait until vertical line == L and horizontal counter ≥ H×8 + 12 (the `+12` offset matches the FPGA). |

When the instruction pointer reaches the end of the 1024-entry list it **wraps to 0**.

---

## Implementation steps

Each step below is independently **testable**. Steps are ordered so that each builds on the previous, enabling incremental development with green tests at every stage.

---

### Step 1 — Add execution state fields to CopperDevice

**Goal:** Extend the existing data-store device with the internal state needed by the execution engine.

**New fields:**
- `_copperListAddr: number` — current instruction pointer (0–0x3FF), index into the 1024-instruction list.
- `_copperListData: number` — the 16-bit instruction word last fetched.
- `_copperDout: boolean` — `true` when a MOVE result is pending output on the next tick.

**Changes to `reset()`:** Initialize `_copperListAddr = 0`, `_copperListData = 0`, `_copperDout = false`.

**Changes to `set nextReg62Value`:** When the start-mode transitions to `0b01` or `0b11`, reset `_copperListAddr = 0` and `_copperDout = false` (matches MAME `copper_en_w`). Mode `0b10` must **not** reset the pointer.

**Tests:**
- After `reset()`, verify all new fields are at their initial values.
- Write `0b01 << 6` to nextReg62: verify `_copperListAddr` resets to 0.
- Write `0b11 << 6` to nextReg62: verify `_copperListAddr` resets to 0.
- Write `0b10 << 6` to nextReg62: verify `_copperListAddr` is unchanged.
- Write the same start-mode twice: verify the pointer is **not** reset on the second write (per nextreg spec: "Writing the same start control value does not reset the copper").

---

### Step 2 — Implement the MOVE instruction

**Goal:** When `executeTick()` is called and the current instruction is a MOVE, write the value to the target NextReg.

**New method:** `executeTick(vc: number, hc: number): void` — the per-tick step function.

**MOVE logic (bit 15 == 0):**
1. If `_copperDout` is `true` from a previous tick:
   - Execute the pending MOVE: call `machine.nextRegDevice.directSetRegValue(reg, val)` where `reg = (_copperListData >> 8) & 0x7F` and `val = _copperListData & 0xFF`.
   - Clear `_copperDout = false`.
2. If the current instruction's bit 15 is 0:
   - Fetch the instruction word from memory: `_copperListData = (mem[addr*2] << 8) | mem[addr*2+1]`.
   - If `reg != 0` (not NOP), set `_copperDout = true`.
   - Advance `_copperListAddr = (_copperListAddr + 1) % 0x400`.
3. A NOP (MOVE 0, 0) advances the pointer but does **not** set `_copperDout`.

**Tests:**
- Program a single MOVE instruction (e.g., MOVE reg 0x40, value 0xAA). Call `executeTick()` twice. After the second tick the target NextReg should hold 0xAA.
- Program a NOP (0x0000). Call `executeTick()` once. Verify pointer advanced but no NextReg write occurred.
- Program multiple consecutive MOVEs. Verify each is executed in sequence, one MOVE output per two ticks (fetch + output).

---

### Step 3 — Implement the WAIT instruction

**Goal:** When the current instruction is a WAIT, compare the target position against the current beam position and advance only when the condition is met.

**WAIT logic (bit 15 == 1):**
1. Decode the target: `waitLine = instruction & 0x1FF`, `waitHC = ((instruction >> 9) & 0x3F) * 8 + 12`.
2. Compare: if `vc == waitLine && hc >= waitHC`, advance `_copperListAddr` and clear `_copperDout`.
3. Otherwise, do nothing (the copper stalls on this instruction).

**Tests:**
- Program a WAIT for line 100, HC 0. Call `executeTick(100, 12)` — verify pointer advances.
- Call `executeTick(99, 200)` on the same WAIT — verify pointer does **not** advance (wrong line).
- Call `executeTick(100, 4)` — verify pointer does **not** advance (HC too early; 4 < 12).
- Program WAIT followed by MOVE. Step the copper: verify the MOVE only fires after the WAIT line is reached.
- Test edge: WAIT for line 0, HC 0 — should match when `vc == 0 && hc >= 12`.

---

### Step 4 — Implement the stop mode (mode 0b00)

**Goal:** When start-mode is `0b00`, `executeTick()` must do nothing.

**Logic:** At the top of `executeTick()`, if `_startMode == 0`, return immediately.

**Tests:**
- Set mode 0b00, program a MOVE, call `executeTick()` many times — verify no NextReg writes occur.
- Transition from mode 0b01 to 0b00 mid-list — verify execution halts immediately.

---

### Step 5 — Implement wrap-around for modes 0b01 and 0b10

**Goal:** When the instruction pointer reaches 0x400, it wraps to 0 and the copper keeps running.

**Logic:** After every instruction-pointer increment: `_copperListAddr %= 0x400`.

This is already implied in Step 2, but this step adds the explicit test coverage for the wrap scenario.

**Tests:**
- Fill all 1024 slots with NOPs. Start mode 0b01. Step 1024+ times. Verify the pointer wraps to 0 and continues.
- Place a MOVE at slot 0, NOPs everywhere else. Run 1025 ticks. Verify the MOVE at slot 0 executes twice (i.e., the list looped).

---

### Step 6 — Implement frame-restart mode (mode 0b11)

**Goal:** In mode `0b11`, the copper restarts from address 0 every time the beam reaches position (vc=0, hc=0).

**Logic in `executeTick(vc, hc)`:**
- If `_startMode == 0b11 && vc == 0 && hc == 0`: reset `_copperListAddr = 0` and `_copperDout = false`.
- Then proceed with normal MOVE/WAIT execution.

This matches the FPGA:
```vhdl
elsif copper_en_i = "11" and vcount_i = 0 and hcount_i = 0 then
    copper_list_addr_s <= (others=>'0');
    copper_dout_s <= '0';
```

**Tests:**
- Mode 0b11, program MOVE at slot 0 and WAIT-forever at slot 1. Step through a full frame, then call `executeTick(0, 0)`. Verify pointer resets to 0 and the MOVE fires again.
- Mode 0b01 with the same program: stepping through `(0, 0)` does **not** reset the pointer (only mode 0b11 does frame restart).

---

### Step 7 — Implement the vertical line offset (NextReg 0x64)

**Goal:** The copper's beam comparison uses an **offset** vertical count: `copperVC = (vc + verticalLineOffset) % totalVC`.

This allows software to shift the copper's sense of "line 0" (e.g., to start effects relative to the active display area).

**Logic:** In `executeTick()`, before WAIT comparison and frame-restart check, compute:
```
adjustedVC = (vc + this.verticalLineOffset) % this.machine.screenConfig.totalVC
```
Use `adjustedVC` instead of raw `vc` for all position comparisons (WAIT match and frame-restart `vc == 0` check).

**Tests:**
- Set offset = 10. WAIT for line 5. Call `executeTick(vc=totalVC-5, hc=12)`. Since `(totalVC - 5 + 10) % totalVC == 5`, the WAIT should match.
- Set offset = 0 (default). Same test at `vc = 5` — should still match.
- Verify frame-restart (mode 0b11) uses the offset: restart should happen when the **adjusted** VC == 0.

---

### Step 8 — Wire CopperDevice into the machine frame loop

**Goal:** Call `copperDevice.executeTick(vc, hc)` from `ZxNextMachine.onTactIncremented()` so the copper runs in sync with the video beam.

**Changes to `ZxNextMachine.onTactIncremented()`:**
```typescript
onTactIncremented(): void {
  if (this.frameCompleted) return;
  while (this.lastRenderedFrameTact < this.currentFrameTact) {
    // --- Copper executes once per tact
    const vc = this.composedScreenDevice.tactToVC[this.lastRenderedFrameTact];
    const hc = this.composedScreenDevice.tactToHC[this.lastRenderedFrameTact];
    this.copperDevice.executeTick(vc, hc);

    this.composedScreenDevice.renderTact(this.lastRenderedFrameTact++);
  }
  // ... audio samples ...
}
```

The copper runs **before** `renderTact()` so that any register changes it makes (palette, scroll, etc.) take effect on the current tact.

**Changes to `ZxNextMachine.onInitNewFrame()`:** Not strictly required (mode 0b11 frame-restart is handled by the `(vc==0, hc==0)` check in `executeTick()`), but optionally add:
```typescript
this.copperDevice.onNewFrame();
```
as a hook for future cleanup or debugging.

**Tests (integration):**
- Program a WAIT for visible line + a MOVE that changes a palette register. Run a full emulated frame. Verify the palette register value is set after the target line.
- Mode 0b00: run a full frame with copper programmed — verify no register writes occur.
- Mode 0b11: run two full frames — verify the copper list executes fully in each frame (MOVE fires in both frames).

---

### Step 9 — Copper writes to NextRegs must be restricted to 0x00–0x7F

**Goal:** The copper can only write to NextRegs 0x00–0x7F (bit 7 of the register is stripped). Registers above 0x80 are inaccessible (per nextreg.txt: "Registers 0x80 and above are inaccessible to the copper").

**Logic:** Already implicit in the `& 0x7F` mask on the register number, but add an explicit guard that **no** write is emitted for register 0.

**Tests:**
- MOVE to register 0x45 — verify write occurs.
- MOVE to register 0x00 (NOP) — verify no write occurs.
- MOVE with raw register field 0xFF (bit 7 set) — verify the write targets register 0x7F (bit 7 masked off).

---

### Step 10 — Performance: batch consecutive MOVEs

**Goal:** Following MAME's optimization, when multiple consecutive MOVEs are queued with no intervening WAIT, execute them in a batch within a single `executeTick()` call rather than requiring one call per MOVE.

From MAME (`specnext_copper.cpp`):
```cpp
/* This loop has been added for performance reasons. */
++times;
} while (m_copper_dout == 0 && m_copper_list_addr < 0x400);
m_timer->adjust(clocks_to_attotime(times));
```

**Logic:** Inside `executeTick()`, after processing a MOVE output, loop to process additional instructions as long as:
- The next instruction is also a MOVE (not WAIT).
- The list address hasn't wrapped.

Track the number of instructions consumed for timing.

**Tests:**
- Program 10 consecutive MOVEs to different registers. Call `executeTick()` once. Verify all 10 registers are set.
- Program a MOVE, then a WAIT. Verify only the MOVE executes; the WAIT stalls.
- Program 1024 NOPs. A single `executeTick()` should process all of them (pointer wraps to 0) without hanging.

---

### Step 11 — Add CopperDeviceState for IDE diagnostics

**Goal:** Expose a snapshot of the copper's internal state for the Klive debugger/inspector UI.

**New type:** `CopperDeviceState` (in `src/emu/abstractions/` or alongside the device):
```typescript
type CopperDeviceState = {
  startMode: CopperStartMode;
  instructionAddress: number;    // 0–0x3FF
  listData: number;              // last fetched 16-bit instruction
  dout: boolean;                 // pending MOVE output
  verticalLineOffset: number;
  memory: Uint8Array;            // full 2 KB snapshot
};
```

**New method:** `getState(): CopperDeviceState`.

**Tests:**
- After programming and stepping the copper, call `getState()` and verify all fields match expected values.

---

## Summary of files to modify

| File | Changes |
|------|---------|
| `src/emu/machines/zxNext/CopperDevice.ts` | Add execution state, `executeTick()`, mode transitions, MOVE/WAIT logic, batching, `getState()` |
| `src/emu/machines/zxNext/ZxNextMachine.ts` | Wire `copperDevice.executeTick(vc, hc)` into `onTactIncremented()` |
| `test/zxnext/copper-device.test.ts` (new) | Unit tests for all steps above |

## Test file structure

```
test/zxnext/copper-device.test.ts
  describe("CopperDevice")
    describe("Step 1: Execution state initialization")
    describe("Step 2: MOVE instruction")
    describe("Step 3: WAIT instruction")
    describe("Step 4: Stop mode")
    describe("Step 5: Wrap-around")
    describe("Step 6: Frame-restart mode")
    describe("Step 7: Vertical line offset")
    describe("Step 8: Machine integration")
    describe("Step 9: Register restrictions")
    describe("Step 10: MOVE batching")
    describe("Step 11: State snapshot")
```
