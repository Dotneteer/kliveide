# DMA Device Rewrite Plan

## Sources of Truth

- **Official specification**: https://wiki.specnext.dev/DMA  
- **MAME reference implementation**: `_input/mame/devices/machine/z80dma.cpp` (parent) + `_input/mame/mame/sinclair/specnext_dma.cpp` (zxnDMA overrides)

## Architecture Overview

MAME's z80dma stores **raw register bytes** in a flat array `m_regs[(6 << 3) + 1 + 1]` (49 entries). Each register group (WR0–WR6) occupies 8 slots: slot 0 is the base byte, slots 1+ are parameter bytes. Macros/accessors decode bit fields on-the-fly. A "follow" queue (`m_regs_follow[]`, `m_num_follow`, `m_cur_follow`) tracks which parameter bytes are expected next.

The specnext_dma subclass adds: prescaler support, a `dma_mode` flag (0=zxnDMA, 1=z80 DMA), and a `dma_delay` mechanism. It overrides `write()`, `do_read()`, and `clock_w()`.

---

## Critical Issues in Current DmaDevice.ts

### Issue 1 – Register Write Dispatch Order & Bit Masks Are Wrong

**MAME** dispatch order (z80dma.cpp `write()`):

| Order | Condition | Target |
|-------|-----------|--------|
| 1 | `(data & 0x87) == 0x00` | WR2 |
| 2 | `(data & 0x87) == 0x04` | WR1 |
| 3 | `(data & 0x80) == 0x00` | WR0 (catch-all for D7=0) |
| 4 | `(data & 0x83) == 0x80` | WR3 |
| 5 | `(data & 0x83) == 0x81` | WR4 |
| 6 | `(data & 0xc7) == 0x82` | WR5 |
| 7 | `(data & 0x83) == 0x83` | WR6 |

**Current code** splits on D7 first, then uses wrong masks (`0x07`, `0x0F`, `0x17`). The check order is different and the bitmasks do not match the Z80 DMA specification.

### Issue 2 – Follow Byte Mechanism Is Fundamentally Different

**MAME**: Only parameters whose indicator bits are set in the base byte are enqueued. For WR0, bits D3–D6 individually gate each parameter (Port A addr low, Port A addr high, block length low, block length high). You can write WR0 with only some parameters.

**Current code**: Always expects all 4 parameter bytes for WR0, all 2 for WR4, etc. This breaks programs that only write a subset of parameters.

### Issue 3 – Address Model Is Wrong

**MAME**: Maintains `m_addressA` and `m_addressB` as independent running addresses. Both are always updated (incremented/decremented/fixed) after every byte transfer. The `PORTA_IS_SOURCE` flag determines which address is used for reads vs writes, but both addresses advance.

**Current code**: Maps addresses to "source" and "destination" at LOAD time based on direction, and only updates them through direction-sensitive function pointers. This loses the independent A/B model.

### Issue 4 – WR4 Transfer Mode Extraction Is Wrong

**MAME**: `OPERATING_MODE = ((WR4 >> 5) & 0x03)` — bits 6–5 of WR4.  
Values: `0b00` = Byte, `0b01` = Continuous, `0b10` = Burst, `0b11` = Do not program.

**Current code**: `(value >> 4) & 0x01` — extracts only 1 bit from wrong position. Incorrectly maps modes.

### Issue 5 – WR4 Parameter Follow Bits Are Wrong

**MAME WR4**: `(data & 0x83) == 0x81`. Parameters follow based on bits:
- D2 → Port B address low
- D3 → Port B address high  
- D4 → Interrupt control (ignored by zxnDMA)

**Current code**: Always expects 2 parameter bytes for port B address.

### Issue 6 – WR2 Prescaler Follow Logic Is Wrong

**MAME specnext_dma**: The prescaler byte follows only if bit D5 of the WR2 *timing byte* (not the base byte) is set. When `nreg == REGNUM(2, 1)` and `data & 0x20`, a new register `REGNUM(2, 2)` is enqueued.

**Current code**: Always expects prescaler byte after timing byte in WR2.

### Issue 7 – LOAD Command Behavior Differs

**MAME**: `m_addressA = PORTA_ADDRESS; m_addressB = PORTB_ADDRESS; m_count = BLOCKLEN; m_byte_counter = 0;` — always loads both addresses from registers regardless of direction. Sets `m_status |= 0x30`.

**Current code**: Swaps source/dest based on direction at LOAD time. Doesn't maintain separate A/B addresses.

### Issue 8 – ENABLE_DMA Byte Counter Reset

**MAME specnext_dma**: Overrides write() to set `m_byte_counter = 0` on ENABLE_DMA. The parent just calls `enable()`.

**Current code**: Sets byte counter based on mode (0 or 0xFFFF). The 0xFFFF init for legacy mode is incorrect — MAME doesn't do that.

### Issue 9 – RESET Command Is Completely Different

**MAME**: Uses progressive column-based register reset (6 RESET commands clear all columns). Sets `m_status = 0x38`. Clears `m_force_ready`, `m_ip`, `m_ius`. Calls `interrupt_check()`.

**Current code**: Resets timing, prescaler, and control flags but doesn't match MAME behavior.

### Issue 10 – READ_STATUS_BYTE Command Behavior Differs

**MAME**: `READ_MASK = 1; m_read_cur_follow = 0;` — sets read mask to 1 (only status byte).

**Current code**: Just sets read sequence position without changing read mask.

### Issue 11 – Status Byte Format Is Wrong

**MAME**: Uses `m_status` directly. Initial = 0x38. After completion: `m_status = 0x09` + flags. `EOB_F_SET` clears bit 5 (`m_status &= ~0x20`), `EOB_F_CLEAR` sets bit 5 (`m_status |= 0x20`).

**Spec**: Format `00E1101T`. E=1 means not reached end, E=0 means reached. Note: spec says "Status byte doesn't have bit 0 set (the T bit)" in technical details.

**Current code**: Computes status byte with wrong constants (0x36, 0x1A).

### Issue 12 – Transfer Completion Check

**MAME**: `is_final = m_count && m_byte_counter == m_count`. Transfer completes when byte_counter equals count (after increment in do_write).

**zxnDMA override**: In `do_read()`, if `(m_byte_counter + 1) == m_count` then `m_byte_counter++`, effectively cutting the transfer one byte short in zxnDMA mode.

**Current code**: Uses various methods (`shouldContinueTransfer`, `isTransferComplete`) with different comparison logic.

### Issue 13 – State Machine Structure

**MAME**: Timer-driven with clear sequence: WAIT_READY → REQUEST_BUS → WAITING_ACK → INC_DEC_SOURCE_ADDRESS (timing setup) → READ_SOURCE → INC_DEC_DEST_ADDRESS (timing setup) → WRITE_DEST → (mode check) → FINISH.

**Current code**: Has a DmaState enum with 13 states but stepDma() doesn't actually use most of them — it inlines read+write in a single call.

### Issue 14 – WR3 Enable Via D6

**MAME**: `if (BIT(data, 6)) { enable(); }` — WR3 D6=1 triggers DMA enable.

**Current code**: Only checks D0 for enable flag. Misses D6 trigger.

### Issue 15 – Read Register Uses addressA/addressB, Not source/dest

**MAME read()**: Returns `m_addressA` and `m_addressB` directly (positions 3–6). These are the raw A/B addresses.

**Current code**: Returns sourceAddress/destAddress, which are mapped by direction and no longer correspond to port A / port B.

---

## Rewrite Steps

Each step is designed to be small, independently testable, and keeps existing tests passing until they are intentionally changed.

---

### Step 1: Introduce Raw Register Array

**Goal**: Replace the decoded `RegisterState` interface with a raw register storage model matching MAME.

**Changes**:
- Add a `regs: Uint16Array` of size 49 (= `(6 << 3) + 1 + 1`) to store raw register bytes.
- Add helper method `REG(m, s)` → index into `regs[(m << 3) + s]`.
- Add named accessor methods/getters that decode from raw registers, equivalent to MAME macros:
  - `get WR0()`, `get WR1()`, etc.
  - `get PORTA_ADDRESS()`, `get PORTB_ADDRESS()`, `get BLOCKLEN()`
  - `get PORTA_IS_SOURCE()`, `get PORTA_INC()`, `get PORTA_FIXED()`, `get PORTA_MEMORY()`
  - `get PORTB_INC()`, `get PORTB_FIXED()`, `get PORTB_MEMORY()`
  - `get OPERATING_MODE()`, `get TRANSFER_MODE()`
  - `get AUTO_RESTART()`, `get READ_MASK()`
- Keep old `RegisterState` getters temporarily for test compatibility, delegating to raw array.
- Add `addressA`, `addressB`, `count`, `byteCounter` as separate fields (like MAME).

**Test**: Verify `getRegisters()` still returns correct values after writing raw registers.

---

### Step 2: Implement Follow-Byte Mechanism

**Goal**: Replace fixed `RegisterWriteSequence` enum with MAME's dynamic follow queue.

**Changes**:
- Add fields: `numFollow: number`, `curFollow: number`, `regsFollow: number[]` (max 5 entries).
- Replace `registerWriteSeq` with the follow mechanism.
- `writePort()` checks `numFollow == 0` for base byte, else writes to `regs[regsFollow[curFollow]]` and advances.

**Test**: Write WR0 with various parameter bit combinations (e.g., only address low + block length high). Verify that exactly the indicated parameters are consumed.

---

### Step 3: Fix Write Dispatch Bit Patterns

**Goal**: Match MAME's register detection order and masks exactly.

**Changes in `writePort()`**:
```
if numFollow == 0:
  if (data & 0x87) == 0x00 → WR2
  if (data & 0x87) == 0x04 → WR1
  if (data & 0x80) == 0x00 → WR0 (catch-all D7=0)
  if (data & 0x83) == 0x80 → WR3
  if (data & 0x83) == 0x81 → WR4
  if (data & 0xc7) == 0x82 → WR5
  if (data & 0x83) == 0x83 → WR6
else:
  write follow byte to regs[regsFollow[curFollow]]
```

**Test**: Send bytes that should be routed to different registers (0x00→WR2, 0x04→WR1, 0x7D→WR0, 0x80→WR3, 0x81→WR4, 0x82→WR5, 0x83→WR6). Verify target register receives the base byte value.

---

### Step 4: Rewrite WR0 Handler with Conditional Parameters

**Goal**: WR0 parameter bytes are only expected when their indicator bits are set.

**Changes**:
- On WR0 base byte: store in `regs[REGNUM(0,0)]`.
- If D3 set → enqueue `REGNUM(0,1)` (PORTA_ADDRESS_L)
- If D4 set → enqueue `REGNUM(0,2)` (PORTA_ADDRESS_H)
- If D5 set → enqueue `REGNUM(0,3)` (BLOCKLEN_L)
- If D6 set → enqueue `REGNUM(0,4)` (BLOCKLEN_H)

**Test**: Write WR0=0x79 (D6,D5,D4,D3 all set + transfer mode) followed by 4 bytes. Verify all 4 parameters stored. Then write WR0=0x09 (only D3 set) followed by 1 byte. Verify only PORTA_ADDRESS_L stored.

---

### Step 5: Rewrite WR1, WR2 Handlers with Conditional Parameters

**Goal**: Match MAME's follow logic for WR1 (timing byte) and WR2 (timing byte + optional prescaler).

**WR1 changes**:
- Store base byte in `regs[REGNUM(1,0)]`.
- If D6 set → enqueue `REGNUM(1,1)` (PORTA_TIMING).

**WR2 changes**:
- Store base byte in `regs[REGNUM(2,0)]`.
- If D6 set → enqueue `REGNUM(2,1)` (PORTB_TIMING).
- When PORTB_TIMING follow byte is written: if its D5 set → enqueue `REGNUM(2,2)` (prescaler).
  (This matches specnext_dma.cpp `write()` override.)

**Test**: Write WR2 base with D6=1, then timing byte with D5=0 → no prescaler expected. Write WR2 base with D6=1, then timing byte with D5=1 → prescaler byte expected next.

---

### Step 6: Rewrite WR3, WR4, WR5 Handlers

**WR3 changes**:
- Store in `regs[REGNUM(3,0)]`.
- D3 → enqueue MASK_BYTE (`REGNUM(3,1)`)
- D4 → enqueue MATCH_BYTE (`REGNUM(3,2)`)
- D6 → call `enable()` (like MAME)

**WR4 changes**:
- Store in `regs[REGNUM(4,0)]`.
- D2 → enqueue `REGNUM(4,1)` (PORTB_ADDRESS_L)
- D3 → enqueue `REGNUM(4,2)` (PORTB_ADDRESS_H)
- D4 → enqueue `REGNUM(4,3)` (INTERRUPT_CTRL)
  Note: When INTERRUPT_CTRL follow byte is received, check D3→PULSE_CTRL, D4→INTERRUPT_VECTOR.

**WR5 changes**:
- Store in `regs[REGNUM(5,0)]`. No follow bytes.

**Test**: Write WR4 with only D2 set (port B addr low only). Verify one parameter consumed. Write WR3 with D6=1, verify DMA is enabled.

---

### Step 7: Rewrite WR6 Command Handler

**Goal**: Match MAME's command implementations exactly.

**Changes**: Rewrite each command handler:

| Command | Code | Key behavior |
|---------|------|-------------|
| RESET | 0xC3 | Progressive column reset, `status = 0x38`, clear force_ready/ip/ius |
| RESET_PORT_A_TIMING | 0xC7 | `PORTA_TIMING = 0` |
| RESET_PORT_B_TIMING | 0xCB | `PORTB_TIMING = 0` + clear prescaler |
| LOAD | 0xCF | `addressA = PORTA_ADDRESS; addressB = PORTB_ADDRESS; count = BLOCKLEN; byteCounter = 0; status |= 0x30` |
| CONTINUE | 0xD3 | `count = BLOCKLEN; byteCounter = 0; status |= 0x30` |
| ENABLE_DMA | 0x87 | Call `enable()` + specnext override: `byteCounter = 0` |
| DISABLE_DMA | 0x83 | Call `disable()` |
| READ_STATUS_BYTE | 0xBF | `READ_MASK = 1; readCurFollow = 0` |
| INIT_READ_SEQUENCE | 0xA7 | `setupNextRead(0)` |
| READ_MASK_FOLLOWS | 0xBB | Enqueue `REGNUM(6,1)` as follow byte |
| REINIT_STATUS_BYTE | 0x8B | `status |= 0x30; ip = 0` |
| FORCE_READY | 0xB3 | `forceReady = 1` |

**Test**: Each command individually — verify register state changes match expected MAME behavior.

---

### Step 8: Fix Address Update Model (addressA/addressB Independent)

**Goal**: Both addresses always update after every byte, matching MAME's `do_write()`.

**Changes**:
- Remove `sourceAddress`/`destAddress` from TransferState.
- Use `addressA` and `addressB` directly.
- After each transfer byte:
  ```
  addressA += PORTA_FIXED ? 0 : PORTA_INC ? 1 : -1
  addressB += PORTB_FIXED ? 0 : PORTB_INC ? 1 : -1
  byteCounter++
  ```

**Test**: Set up A→B transfer with Port A incrementing and Port B decrementing. After N bytes, verify both addressA and addressB have moved by N in their respective directions.

---

### Step 9: Fix Read/Write Cycle (do_read/do_write)

**Goal**: Match MAME's source/destination selection logic.

**do_read** (matching MAME):
```
if PORTA_IS_SOURCE:
  read from addressA (memory or IO based on PORTA_MEMORY)
else:
  read from addressB (memory or IO based on PORTB_MEMORY)
```

**specnext_dma do_read override**: After parent's do_read, if zxnDMA mode and `(byteCounter + 1) == count`, increment byteCounter. This is the off-by-one fix.

**do_write**:
```
if PORTA_IS_SOURCE:
  write to addressB
else:
  write to addressA
```
Then update both addresses and increment byteCounter.

**Test**: Set up B→A transfer. Verify reads come from addressB, writes go to addressA.

---

### Step 10: Implement State Machine Matching MAME Sequences

**Goal**: Replace current state machine with MAME's sequence: WAIT_READY → REQUEST_BUS → WAITING_ACK → INC_DEC_SOURCE → READ_SOURCE → INC_DEC_DEST → WRITE_DEST → mode dispatch → FINISH.

**Changes**:
- Replace `DmaState` enum with MAME's sequence enum.
- Implement `enable()`: starts the state machine at `SEQ_WAIT_READY`.
- Implement `disable()`: stops the state machine, releases bus.
- Implement `stepDma()` as a single clock tick through the state machine.
- After WRITE_DEST, handle operating modes:
  - Byte mode (0b00): release bus, go to WAIT_READY
  - Continuous (0b01): stay on bus, go to INC_DEC_SOURCE (skip bus request after first byte)
  - Burst (0b10): if ready → continue, else release bus → WAIT_READY
  - Final (byteCounter == count): go to FINISH

**Test**: Step through a 3-byte continuous transfer one tick at a time. Verify the sequence of states matches expected order.

---

### Step 11: Implement Prescaler Timing (specnext_dma clock_w)

**Goal**: Match prescaler behavior from specnext_dma.cpp.

**Changes**:
- After WRITE_DEST, if prescaler is non-zero, calculate delay based on prescaler value.
- In burst mode during prescaler wait, release bus (CPU gets control).
- Formula: prescaler delay = prescaler value × base period, where base period derives from 875kHz reference.

**Test**: Set prescaler to 55 (16kHz). Verify the T-state delay between byte transfers matches expected value. Verify burst mode releases bus during prescaler wait.

---

### Step 12: Fix DMA Delay Mechanism

**Goal**: Match specnext_dma's `m_dma_delay` behavior.

**Changes**:
- When `dma_delay` is active and state is WAIT_READY: skip (stay waiting).
- When `dma_delay` is active and state is WRITE_DEST: after parent's clock_w, if state advanced to INC_DEC_SOURCE → release bus, go to WAIT_READY.
- This implements single-byte-at-a-time transfer when delay is enabled.

**Test**: Enable DMA delay, start transfer. Verify only one byte transfers before bus is released.

---

### Step 13: Fix Read Register / Status Byte

**Goal**: Match MAME's `read()` and `setup_next_read()`.

**Changes**:
- Use `readCurFollow` indexed 0–6:
  - 0 → status byte
  - 1 → byteCounter low
  - 2 → byteCounter high
  - 3 → addressA low
  - 4 → addressA high
  - 5 → addressB low
  - 6 → addressB high
- `setupNextRead(rr)`: advance to next position where `READ_MASK` bit is set.
- READ_MASK is stored in `regs[REGNUM(6,1)]`, bit positions 0–6 correspond to read registers.

**Test**: Set READ_MASK = 0x7F (all), read all 7 values. Set READ_MASK = 0x03 (only status + counter low), verify loop only returns those two.

---

### Step 14: Fix Auto-Restart

**Goal**: Match MAME's auto-restart in SEQ_FINISH handler.

**Changes**:
- After transfer completes (FINISH state):
  - Set `status = 0x09 | (!is_ready << 1)`. If transfer mode, set bit 4.
  - If `AUTO_RESTART`: reload `addressA = PORTA_ADDRESS`, `addressB = PORTB_ADDRESS`, `count = BLOCKLEN`, `byteCounter = 0`, `status |= 0x30`, call `enable()`.
  - If `INT_ON_END_OF_BLOCK`: trigger interrupt.

**Test**: Enable auto-restart, run 4-byte transfer, verify addresses are reloaded and transfer restarts.

---

### Step 15: Remove Legacy Code & Clean Up

**Goal**: Remove now-unused types, interfaces, and methods.

**Changes**:
- Remove `RegisterState`, `TransferState`, `StatusFlags`, `BusControlState` interfaces.
- Remove old `RegisterWriteSequence`, `DmaState` enums.
- Remove decoded-field getters that are no longer needed.
- Remove `executeContinuousTransfer()` and `executeBurstTransfer()` — state machine handles both.
- Update `getRegisters()`, `getTransferState()`, etc., to return from raw registers.
- Keep test-helper methods (like `setDmaMode()`) but adapt them.

**Test**: Run full test suite. Fix any broken tests.

---

### Step 16: Update Port Handler Integration

**Goal**: Update ZxnDmaPortHandler and Z80DmaPortHandler for new API.

**Changes**:
- `writePort()` / `readPort()` signatures stay the same — internal changes only.
- Update `beforeInstructionExecuted()` in ZxNextMachine.ts to use the new state machine — call `stepDma()` which does one clock tick.
- Remove explicit bus request/acknowledge/release from machine code — the state machine handles it internally.

**Test**: Integration test — write a standard DMA program sequence (disable, WR0, WR1, WR2, WR4, WR5, LOAD, ENABLE) and verify transfer completes correctly.

---

### Step 17: Update Existing Tests

**Goal**: Update all 26 test files to use the new API.

**Changes per test file**:
- Replace decoded-field assertions with raw-register or accessor-based assertions.
- Update test helper sequences to use correct parameter bit patterns.
- Fix expected status byte values.
- Adjust state machine step counts.

**Test**: All existing tests pass with new implementation.

---

## Implementation Order & Dependencies

```
Step 1  (raw registers)
  ↓
Step 2  (follow mechanism)
  ↓
Step 3  (write dispatch)
  ↓
Step 4  (WR0)  ←──┐
Step 5  (WR1/WR2) │  Can be parallelized
Step 6  (WR3-5)───┘
  ↓
Step 7  (WR6 commands)
  ↓
Step 8  (address model) ←─┐
Step 9  (do_read/do_write) │  Depend on each other
  ↓                        │
Step 10 (state machine) ───┘
  ↓
Step 11 (prescaler)
Step 12 (DMA delay)
  ↓
Step 13 (read registers)
Step 14 (auto-restart)
  ↓
Step 15 (cleanup)
Step 16 (port integration)
Step 17 (update tests)
```

## Notes

- **Backward compatibility**: The external API (`writePort`, `readStatusByte`, `stepDma`, `setDmaMode`) should remain stable. Internal restructuring should be transparent to callers.
- **MAME's progressive RESET**: Requires 6 RESET commands to fully clear all register columns. This is a Z80 DMA quirk we must replicate.
- **zxnDMA vs Zilog mode**: Selected by port (0x6B vs 0x0B). Key difference: zxnDMA transfers exactly `blockLength` bytes; Zilog mode transfers `blockLength + 1`. The `do_read` override in specnext_dma handles this.
- **T bit in status**: Per technical details, the T bit (bit 0) is not set in zxnDMA. This is an intentional deviation from the Z80 DMA spec.
