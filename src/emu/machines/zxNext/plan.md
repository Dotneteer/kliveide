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

---

## Cross-Check: Klive DmaDevice vs MAME specnext_dma / z80dma

Final cross-check performed against:
- `_input/mame/devices/machine/z80dma.cpp` (base class, 947 lines)
- `_input/mame/devices/machine/z80dma.h` (base header, 202 lines)
- `_input/mame/mame/sinclair/specnext_dma.cpp` (specnext override, ~140 lines)
- `_input/mame/mame/sinclair/specnext_dma.h` (specnext header)

### Severity Legend

- 🔴 **Critical** — Causes wrong behavior for common DMA programming patterns
- 🟡 **Moderate** — Affects specific features or edge cases that real programs may use
- 🟢 **Low** — Minor difference, cosmetic, or already handled via alternative approach

---

### Step 18: Fix WR0 Direction Bit (PORTA_IS_SOURCE)

**Severity**: 🔴 Critical

**MAME** (`z80dma.cpp`):
```c
#define PORTA_IS_SOURCE  ((WR0 >> 2) & 0x01)   // bit 2 of WR0
```

**Klive** (`DmaDevice.ts`):
```ts
const MASK_WR0_DIRECTION = 0x40;    // bit 6 of WR0 — WRONG
```

In the Z80 DMA spec, WR0 D7=0 (identifier), D6-D3 are follow-byte selectors, D2 is PORTA_IS_SOURCE (direction), D1-D0 is transfer mode. Klive misinterprets D6 (which is "block length high byte follows") as the direction bit.

**Why existing tests pass**: Most tests use WR0=`0x7D` (A→B, all follow bytes) where D2=1 and D6=1, or `0x39` (B→A) where D2=0 and D6=0 — both bits happen to agree. But for values like `0x79` (D2=0, D6=1), MAME says B→A while Klive says A→B.

**Fix**:
1. Change `MASK_WR0_DIRECTION` from `0x40` to `0x04` (bit 2).
2. Update `writeWR0()` to extract direction from D2: `(value & 0x04) !== 0`.
3. Update `portaIsSource()` accordingly: `registers.directionAtoB` will now reflect D2.
4. Audit and update the `writeWR0()` comment (currently says "D6: Direction bit").
5. Also fix the wrong WR0 D5/D4-D3 decoding (searchControl from D5, interruptControl from D4-D3 — see Step 18b).
6. Update all tests that check `directionAtoB` or use WR0 values where D2 ≠ D6. For example, `DmaDevice-z80-registers.test.ts` uses `0x79` (D6=1, D2=0) and expects A→B — this must be updated.

---

### Step 18b: Fix WR0 Decoded Semantic Bit Fields

**Severity**: 🟢 Low (fields are decoded but never read by transfer logic)

**MAME** (`z80dma.cpp`):
```
WR0 bit layout:
  D7   = 0 (WR0 identifier)
  D6   = Block Length High byte follows
  D5   = Block Length Low byte follows
  D4   = Port A Address High byte follows
  D3   = Port A Address Low byte follows
  D2   = PORTA_IS_SOURCE (direction: 0=B→A, 1=A→B)
  D1-D0 = Transfer Mode (01=Transfer, 10=Search, 11=Search+Transfer)
```

**Klive** incorrect decoding:
```
  D6 → directionAtoB          (should be: follow-byte indicator only)
  D5 → searchControl          (should be: follow-byte indicator only)
  D4-D3 → interruptControl    (should be: follow-byte indicators only)
  D2-D0 → "parameters"        (should be: D2=direction, D1-D0=transfer mode)
```

The follow-byte queue (`setupFollowQueue`) correctly interprets D3-D6. Only the decoded `RegisterState` fields map wrong bits. Since `searchControl` and `interruptControl` are never read by the transfer logic, this has no functional impact. But it should be fixed for correctness.

**Fix**:
1. Decode D2 as `directionAtoB` (see Step 18).
2. No longer decode D5 as `searchControl` or D4-D3 as `interruptControl` from WR0 — these are follow-byte indicators only. If search/interrupt fields are needed, they should come from the correct registers (WR0 D1-D0 for transfer mode, WR4 for interrupt control).
3. Optionally add `transferModeWR0` decoded from D1-D0 to `RegisterState` for completeness.

---

### Step 19: Fix WR4 Operating Mode Bit (OPERATING_MODE)

**Severity**: 🔴 Critical

**MAME** (`z80dma.cpp`):
```c
#define OPERATING_MODE  ((WR4 >> 5) & 0x03)
// 0b00=Byte, 0b01=Continuous, 0b10=Burst, 0b11=Do not program
```
Uses D6-D5 of WR4.

**Klive** (`DmaDevice.ts` `writeWR4()`):
```ts
const modeValue = (value >> 4) & 0x01;   // uses D4 — WRONG
this.registers.transferMode = modeValue === 0 ? TransferMode.BURST : TransferMode.CONTINUOUS;
```
Uses D4 of WR4, which in MAME is "INTERRUPT_CTRL follows".

**Why existing tests pass**: For commonly used values like `0xBD` (10**11**1101), D6-D5=01 (Continuous in MAME) and D4=1 (Continuous in Klive) — both agree. But for `0xDD` (11**01**1101), MAME says Burst (D6D5=10) while Klive says Continuous (D4=1).

**Fix**:
1. Change to `(value >> 5) & 0x03` to extract D6-D5.
2. Map `0b00` to Byte mode (currently not supported — add `TransferMode.BYTE`), `0b01` to Continuous, `0b10` to Burst, `0b11` to "do not program" / undefined.
3. The `executeTransferByte()` mode dispatch already uses the correct 2-bit encoding internally, so `configuredOpMode` derivation should work once the register decoding is fixed.
4. Update tests that use WR4 values where D4 ≠ (D6-D5 mapped mode).

---

### Step 20: Fix WR4 Follow-Byte Queue (Missing INTERRUPT_CTRL)

**Severity**: 🟡 Moderate

**MAME** (`z80dma.cpp` `write()`):
```c
// WR4 follow bytes
if (data & 0x04) m_regs_follow[m_num_follow++] = PORTB_ADDRESS_L;   // D2
if (data & 0x08) m_regs_follow[m_num_follow++] = PORTB_ADDRESS_H;   // D3
if (data & 0x10) m_regs_follow[m_num_follow++] = INTERRUPT_CTRL;     // D4
```

**Klive** (`setupFollowQueue` case 4):
```ts
if (baseValue & 0x04) this.regsFollow[this.numFollow++] = RNUM_PORT_B_ADDR_L;
if (baseValue & 0x08) this.regsFollow[this.numFollow++] = RNUM_PORT_B_ADDR_H;
// Missing: if (baseValue & 0x10) → RNUM_INTERRUPT_CTRL
```

When WR4 has D4=1, MAME expects an INTERRUPT_CTRL follow byte. Klive doesn't enqueue it. For a program sending WR4 with D4=1 plus portB address plus an interrupt control byte, the interrupt byte would be misinterpreted as the next register base byte, breaking the command sequence.

Additionally, MAME's interrupt control byte handler re-initializes the follow queue:
```c
if (nreg == REGNUM(4,3)) {
    m_num_follow = 0;
    if (data & 0x08) m_regs_follow[m_num_follow++] = PULSE_CTRL;
    if (data & 0x10) m_regs_follow[m_num_follow++] = INTERRUPT_VECTOR;
    m_cur_follow = 0;
}
```
This chained follow-byte mechanism (INTERRUPT_CTRL → PULSE_CTRL / INTERRUPT_VECTOR) is not implemented in Klive.

**Fix**:
1. Add `if (baseValue & 0x10) this.regsFollow[this.numFollow++] = RNUM_INTERRUPT_CTRL;` to WR4 setup.
2. In `handleFollowByte`, when `RNUM_INTERRUPT_CTRL` is received, reset the follow queue and conditionally enqueue `RNUM_PULSE_CTRL` (D3 set) and `RNUM_INTERRUPT_VECTOR` (D4 set), mirroring MAME.

---

### Step 21: Fix Burst Mode Dispatch (Keep Bus While Ready)

**Severity**: 🟡 Moderate

**MAME** (`z80dma.cpp` `clock_w` at `SEQ_TRANS1_WRITE_DEST`):
```c
case 0b10: // Burst/Demand
    if (is_ready())
        m_dma_seq = SEQ_TRANS1_INC_DEC_SOURCE_ADDRESS;  // stay on bus
    else {
        set_busrq(CLEAR_LINE);
        m_dma_seq = SEQ_WAIT_READY;
    }
    break;
```

**Klive** (`executeTransferByte()` mode dispatch):
```ts
case 0b10: // Burst: release bus after each byte
    this.releaseBus();
    this.dmaSeq = DmaSeq.SEQ_WAIT_READY;
    break;
```

In MAME, burst mode keeps the bus and continues to the next byte while ready. In Klive, burst mode releases the bus after every byte, behaving like byte mode. This matters for the specnext prescaler logic: burst mode timing relies on continuous bus ownership with prescaler-timed delays between bytes.

**Fix**:
1. Change burst case to mirror MAME: if ready, continue to `SEQ_TRANS1_INC_DEC_SOURCE`; else release bus and go to `SEQ_WAIT_READY`.
2. Verify that `executeBurstTransfer()` still works correctly with this change (the outer loop gives the T-state budget; the inner state machine should naturally stop when the budget is exhausted or the block completes).

---

### Step 22: Add Missing WR6 Interrupt Commands

**Severity**: 🟡 Moderate

**MAME** handles these WR6 commands that Klive ignores:

| Command | Code | MAME Action |
|---------|------|-------------|
| DISABLE_INTERRUPTS | `0xAF` | `WR3 &= ~0x20` |
| ENABLE_INTERRUPTS | `0xAB` | `WR3 \|= 0x20` |
| RESET_AND_DISABLE_INTERRUPTS | `0xA3` | `WR3 &= ~0x20; m_ip=0; m_ius=0; m_force_ready=0; m_status\|=0x08;` |
| ENABLE_AFTER_RETI | `0xB7` | `fatalerror` (not implemented in MAME either) |

**Fix**: Add cases for `0xAF`, `0xAB`, and `0xA3` in `writeWR6()`. `0xB7` can remain unimplemented (matches MAME).

---

### Step 23: Fix Interrupt Trigger Gating

**Severity**: 🟢 Low (interrupt-driven DMA is rarely used on the Next)

**MAME** `trigger_interrupt()`:
```c
if (!m_ius && INTERRUPT_ENABLE) {
    m_ip = 1;
    if (STATUS_AFFECTS_VECTOR)
        m_vector = (INTERRUPT_VECTOR & 0xf9) | (level << 1);
    else
        m_vector = INTERRUPT_VECTOR;
    m_status &= ~0x08;
    interrupt_check();
}
```

**Klive** `handleTransferFinish()`:
```ts
if (this.regs[RNUM_INTERRUPT_CTRL] & 0x02) {
    this.ip = 1;
    this.m_status &= ~0x08;
}
```

Differences:
1. Missing `!m_ius` guard — interrupt should not fire if one is already under service.
2. Missing `INTERRUPT_ENABLE` (WR3 bit 5) guard — interrupts must be globally enabled.
3. Missing `STATUS_AFFECTS_VECTOR` logic for dynamic vector computation.
4. Missing `interrupt_check()` call to drive INT output line.

**Fix**: Add the missing guards and vector logic to `handleTransferFinish()`. Factor out a `triggerInterrupt(level)` method mirroring MAME.

---

### Step 24: Fix count=0 Behavior

**Severity**: 🟢 Low

**MAME**: When `m_count=0`, `is_final` is always false (`m_count && ...` short-circuits). Transfer runs indefinitely (acknowledged as a "hack" in MAME comments).

**Klive**: When `_count=0`, `stepDma()` at `SEQ_WAIT_READY` immediately calls `handleTransferFinish()`, terminating the transfer with 0 bytes.

This is arguably more correct behavior. Document as intentional deviation if keeping. The `_count=0` check in `SEQ_WAIT_READY` mirrors the practical reality that transferring 0 bytes should be a no-op.

**Fix**: Keep current behavior but document the deviation. Add a comment referencing the MAME "hack" comment.

---

### Summary Table

| Step | Issue | Severity | Category |
|------|-------|----------|----------|
| 18 | WR0 direction bit: D6 → should be D2 | 🔴 Critical | Register decode |
| 18b | WR0 D5/D4-D3 semantic fields wrong | 🟢 Low | Register decode |
| 19 | WR4 operating mode: D4 → should be D6-D5 | 🔴 Critical | Register decode |
| 20 | WR4 missing INTERRUPT_CTRL follow byte | 🟡 Moderate | Follow-byte queue |
| 21 | Burst mode releases bus instead of keeping it | 🟡 Moderate | State machine |
| 22 | Missing WR6 interrupt commands (0xAF, 0xAB, 0xA3) | 🟡 Moderate | Commands |
| 23 | Interrupt trigger missing guards and vector logic | 🟢 Low | Interrupts |
| 24 | count=0 immediate finish vs MAME infinite loop | 🟢 Low | Edge case |

### Recommended Fix Order

1. **Step 18** + **Step 19** (Critical register decode fixes — must be done together with test updates)
2. **Step 21** (Burst mode fix)
3. **Step 20** (WR4 follow-byte chain)
4. **Step 22** (Missing commands)
5. **Step 23** (Interrupt gating)
6. **Step 18b** + **Step 24** (Low priority cleanup)

---

## Final Cross-Check: Post-Implementation Gap Analysis

*Performed after Steps 18–24 were completed and all 16 740 tests pass.*  
*Source of truth: `_input/mame/mame/sinclair/specnext_dma.cpp` + knowledge of z80dma base class.*

---

### Step 25: Connect DMA Interrupt Pending to Z80 INT Line

**Severity**: 🟡 Moderate

**MAME** (`z80dma.cpp` `trigger_interrupt()`):
```cpp
m_ip = 1;
interrupt_check();   // drives the physical INT output pin
```
`interrupt_check()` asserts the INT output line, which the Z80 CPU samples at the start of each instruction.

**Klive** (`triggerInterrupt()`):
```ts
this.ip = 1;
// Note: interrupt_check() drives the INT output line; not applicable
```
`ip` is set to `1` but `ZxNextMachine.shouldRaiseInterrupt()` only checks `this.composedScreenDevice.pulseIntActive` — it never reads `dmaDevice.getIp()`. Therefore a DMA end-of-block interrupt never reaches the Z80.

**Fix**: In `ZxNextMachine.shouldRaiseInterrupt()`, OR the DMA pending flag into the result:
```ts
shouldRaiseInterrupt(): boolean {
  return this.composedScreenDevice.pulseIntActive
      || (this.dmaDevice.getIp() === 1);
}
```
Optionally also clear `ip` once the Z80 acknowledges the interrupt (IACKcycle) by hooking  `afterInstruction` or the IM2 vector read. For now, simply ORing the flag makes DMA interrupts visible to the CPU.

**Tests to add**: Verify that after `executeContinuousTransfer()` with INTERRUPT_ENABLE=1 and INT_ON_END_OF_BLOCK=1, `shouldRaiseInterrupt()` returns `true`.

---

### Step 26: Implement Search Mode (WR0 D1-D0 = 10 / 11)

**Severity**: 🟢 Low  
*(Search mode is very rarely used on ZX Spectrum Next; practically all DMA use is pure transfer.)*

**MAME** (`z80dma.cpp`):
When `TRANSFER_MODE = TM_SEARCH (0b10)` or `TM_SEARCH_TRANSFER (0b11)`:
- After each read byte, compare `(data & MASK_BYTE) == MATCH_BYTE`.
- On match: set `m_status` match-found bit; call `trigger_interrupt(INT_MATCH)` (level 1); stop transfer.
- `STOP_ON_MATCH` (WR5 D2): if set, the transfer halts on a match even if not end-of-block.

**Klive**: `transferModeWR0` is decoded from WR0 D1-D0 (Step 18b) but `performReadCycle()` and `executeTransferByte()` ignore it entirely — all transfers are treated as pure Transfer mode.

**Fix** (when implementing):
1. After `performReadCycle()` in `executeTransferByte()`, check `transferModeWR0`:
   - If 2 or 3 (search mode active): compare `(_transferDataByte & regs[RNUM_MASK_BYTE]) === regs[RNUM_MATCH_BYTE]`.
   - On match: set status match bit, call `triggerInterrupt(1)` (INT_MATCH level), set `isFinal=true`.
2. For pure Search mode (mode=2), skip the write phase entirely when executing a search.
3. For Search+Transfer (mode=3), write the byte AND check for match.

---

### Step 27: Fix performReadCycle() Misleading Docstring

**Severity**: 🟢 Low (documentation/maintenance)

**Issue**: The docstring of `performReadCycle()` states:
> *"Includes specnext_dma do_read override: in zxnDMA mode, if (byteCounter+1)==count the byte counter is pre-incremented here, which causes the is_final check in executeTransferSequence() to trigger at the right time."*

This is **incorrect** — the function does NOT pre-increment the byte counter. The MAME `specnext_dma::do_read()` pre-increment was deliberately **not** ported because Klive achieves the same effect via the `isFinal` check computed in `executeTransferByte()` between the read and write phases:
```ts
const isFinal = this._count !== 0 &&
                (this.transferState.byteCounter + 1) === this._count;
```
The two approaches are semantically equivalent: MAME: counter is `count` before the write → `is_final` triggers. Klive: counter is `count-1` before the write → `(count-1)+1 == count` → `isFinal` triggers.

**Fix**: Update the `performReadCycle()` docstring to accurately describe that no pre-increment happens and explain why the behavior is equivalent.

---

### Step 28: Prescaler Timing Applies to All Modes (Minor MAME Deviation)

**Severity**: 🟢 Low  
*(Prescaler is only ever programmed for audio DMA, which exclusively uses Burst mode.)*

**MAME** (`specnext_dma_device::clock_w()`):
```cpp
const bool may_prescaled = m_dma_seq == SEQ_TRANS1_WRITE_DEST && m_r2_portB_preescaler_s;
// ...
if (may_prescaled && m_dma_seq != SEQ_FINISH) {
    // prescaler delay — active for ALL operating modes when prescaler != 0
    if (OPERATING_MODE == 0b10) // Burst only: also release bus during wait
        set_busrq(CLEAR_LINE);
    // reschedule timer for prescaler interval
}
```
When `ZXN_PRESCALER != 0`, MAME inserts a prescaler delay between bytes regardless of operating mode (Continuous, Burst, or Byte). The bus is only released for Burst mode.

**Klive** (`executeTransferByte()` T-state return):
```ts
if (configuredOpMode === 0b10) {   // Burst only
    const prescalar = this.registers.portBPrescalar || 1;
    return Math.floor((prescalar * PRESCALAR_REFERENCE_FREQ) / PRESCALAR_AUDIO_FREQ);
}
return this.calculateDmaTransferTiming();   // other modes: no prescaler
```
Klive only applies the prescaler formula for Burst mode.

**Impact**: Minimal. The ZXN prescaler register is populated exclusively via the WR2 timing-byte follow path (D5=1 in the timing byte), which is a Next-specific audio-DMA extension designed for Burst mode. No real Next software programs the prescaler with Continuous or Byte mode.

**Fix** (if needed for completeness): When `registers.portBPrescalar !== 0`, use the prescaler formula for all modes, not just Burst. Keep the current Burst-specific bus-release behavior unchanged.

---

### Updated Summary Table

| Step | Issue | Severity | Status |
|------|-------|----------|--------|
| 18   | WR0 direction bit: D6 → D2 | 🔴 Critical | ✅ Done |
| 18b  | WR0 semantic fields: removed searchControl/interruptControl, added transferModeWR0 | 🟢 Low | ✅ Done |
| 19   | WR4 operating mode: D4 → D6-D5 | 🔴 Critical | ✅ Done |
| 20   | WR4 INTERRUPT_CTRL follow byte missing from queue | 🟡 Moderate | ✅ Done |
| 21   | Burst mode: release bus → keep bus while ready | 🟡 Moderate | ✅ Done |
| 22   | Missing WR6 interrupt commands 0xAF/0xAB/0xA3 | 🟡 Moderate | ✅ Done |
| 23   | Interrupt trigger missing !ius / INTERRUPT_ENABLE guards | 🟢 Low | ✅ Done |
| 24   | count=0 immediate finish vs MAME infinite loop | 🟢 Low | ✅ Done (documented intentional deviation) |
| 25   | DMA `ip` flag not connected to Z80 INT line | 🟡 Moderate | ✅ Done |
| 26   | Search mode (WR0 D1-D0=10/11) not implemented | 🟢 Low | ✅ Done |
| 27   | performReadCycle() docstring incorrectly claims pre-increment | 🟢 Low | ✅ Done |
| 28   | Prescaler timing only applied for Burst, not all modes | 🟢 Low | ✅ Done |
| 29   | Search match formula: AND vs OR mask semantics | 🔴 Critical | ✅ Done |
| 30   | INT_ON_MATCH gate missing before match interrupt | 🟡 Moderate | ✅ Done |
| 31   | Status bit 2 (0x04) "match found" is non-standard | 🟢 Low | ✅ Done |

---

## Second Final Cross-Check: Post-Steps-25-31 Gap Analysis

*Performed after Steps 25–31 are complete (16,758 tests passing).*  
*Full re-read of `z80dma.cpp` (947 lines) and `specnext_dma.cpp` (148 lines) against current `DmaDevice.ts`.*

---

### Step 32: Fix `resetPointer` Not Reset on New Base Byte

**Severity**: 🟡 Moderate

**MAME** (`z80dma.cpp` `write()`, lines ~688-689):
```cpp
if (m_num_follow == 0)
{
    m_reset_pointer = 0;   // reset at the START of every new base byte
    // ... dispatch WR0-WR6 ...
    m_cur_follow = 0;
}
```
Every time a new base byte is received (outside follow mode), `m_reset_pointer` is reset to **0**. This means that the progressive-reset column pointer only advances while the device is in follow mode between base bytes; receiving any new base byte resets the counter.

**Klive** (`writePort()`, `setupFollowQueue()`):
`resetPointer` is **never reset to 0** when a new base byte arrives. It is only incremented inside `executeReset()`. This means that after partial reset sequences (e.g., fewer than 6 RESET commands), writing any other WR register byte will not reset the pointer to 0.

**Impact**: MAME semantics: `resetPointer` is effectively a "how many RESET commands in a row have been received" counter that resets the moment any other base byte is written. In Klive, `resetPointer` drifts permanently once incremented, even after unrelated register writes. For programs that rely on issuing exactly N consecutive RESET commands to clear N columns, any intervening non-RESET write between RESET commands would break the column pattern differently in Klive vs MAME.

**Fix**:
In `writePort()`, at the start of the base-byte dispatch (i.e., after the `numFollow > 0` and `registerWriteSeq != IDLE` checks, before the dispatch), add `this.resetPointer = 0`. This mirrors MAME's behavior exactly.

```ts
// At the top of base-byte dispatch in writePort():
this.resetPointer = 0;
// then continue with the WR0-WR6 dispatch...
```

**Tests to add**: Test that writing WR0 between two RESET commands resets the pointer back to column 0.

---

### Step 33: Fix `resetPointer` Not Incremented After Follow Bytes

**Severity**: 🟢 Low

**MAME** (`z80dma.cpp` `write()`, follow-byte branch, lines ~860-869):
```cpp
else  // m_num_follow > 0
{
    // ... store follow byte, advance cur_follow, handle special cases ...

    m_reset_pointer++;
    if (m_reset_pointer >= 6)
        m_reset_pointer = 0;
}
```
After processing **every** follow byte, `m_reset_pointer` is incremented (and wraps at 6).

**Klive** (`writePort()`, follow-byte branch):
After `handleFollowByte()` is called, `resetPointer` is **never touched**. It stays at whatever value it had before.

**Impact**: Combined with Step 32, `resetPointer` in MAME tracks "which column has been written most recently" across all register writes (base bytes always reset it to 0; follow bytes increment it). In practice, this affects only the extremely rare case of exercising the progressive RESET mechanism while interleaved with multi-byte register writes. Low practical impact.

**Fix**:
In `writePort()`, in the follow-byte path (after `handleFollowByte(nreg, value)` returns), add:
```ts
this.resetPointer = (this.resetPointer + 1) % 6;
```

---

### Step 34: Fix `RESET_PORT_A_TIMING` and `RESET_PORT_B_TIMING` Not Zeroing Raw Registers

**Severity**: 🟢 Low

**MAME** (`z80dma.cpp` `write()`):
```cpp
case COMMAND_RESET_PORT_A_TIMING:
    PORTA_TIMING = 0;   // REG(1,1) = 0
    break;
case COMMAND_RESET_PORT_B_TIMING:
    PORTB_TIMING = 0;   // REG(2,1) = 0
    break;
```
Both commands write **zero** to the respective raw timing register `REG(1,1)` / `REG(2,1)`.

**Klive** (`executeResetPortATiming()`, `executeResetPortBTiming()`):
```ts
// executeResetPortATiming:
this.registers.portATimingCycleLength = CycleLength.CYCLES_3;

// executeResetPortBTiming:
this.registers.portBTimingCycleLength = CycleLength.CYCLES_3;
this.registers.portBPrescalar = 0;
this.prescalarTimer = 0;
```
Neither method writes `0` to the corresponding raw register index (`regs[RNUM_PORT_A_TIMING]` or `regs[RNUM_PORT_B_TIMING]`). The raw registers retain their old values, so a `REINITIALIZE_READ_SEQUENCE` + `read()` call would return stale timing values.

Note: MAME's `PORTA_TIMING = 0` maps to `CycleLength.CYCLES_3` (i.e., the 3-cycle base), so the decoded field is correct. Only the raw register is wrong.

**Fix**:
```ts
// executeResetPortATiming():
this.regs[RNUM_PORT_A_TIMING] = 0;
this.registers.portATimingCycleLength = CycleLength.CYCLES_3;

// executeResetPortBTiming():
this.regs[RNUM_PORT_B_TIMING] = 0;
this.registers.portBTimingCycleLength = CycleLength.CYCLES_3;
// (prescaler clear already present — keep it)
```

**Tests to add**: After `RESET_PORT_A_TIMING`, verify `getRawReg(1, 1) === 0`. After `RESET_PORT_B_TIMING`, verify `getRawReg(2, 1) === 0`.

---

### Step 35: Fix `READ_MASK_FOLLOWS` Missing `setupNextRead(0)` After Follow Byte

**Severity**: 🟡 Moderate

**MAME** (`z80dma.cpp` `write()`, follow-byte branch, lines ~855-859):
```cpp
else if (m_regs_follow[m_num_follow] == GET_REGNUM(READ_MASK))
{
    setup_next_read(0);
}
```
After the READ_MASK follow byte is consumed (queue becomes empty, `m_num_follow` now 0), MAME checks `m_regs_follow[0]` — which still holds `GET_REGNUM(READ_MASK)` from the `READ_MASK_FOLLOWS (0xBB)` command. When true, it calls `setup_next_read(0)`, which advances `m_read_cur_follow` to the first bit set in the new `READ_MASK`.

This means that writing a new read mask via `READ_MASK_FOLLOWS` automatically re-initialises the read pointer, just as `INIT_READ_SEQUENCE (0xA7)` would. Without this, the read pointer may be left pointing at a position that is no longer valid for the new mask, causing `read()` to return the wrong register on the very next read operation.

**Klive** (`handleFollowByte()`, `case RNUM_READ_MASK:`):
```ts
case RNUM_READ_MASK:
    this.registers.readMask = value & 0x7f;
    break;
```
`setupNextRead(0)` is **not called** after writing the READ_MASK follow byte. The `registerReadSeq` / `readCurFollow` position is unchanged.

**Fix**:
In `handleFollowByte()`, after updating `registers.readMask`, call `setupNextRead(0)`:
```ts
case RNUM_READ_MASK:
    this.registers.readMask = value & 0x7f;
    this.regs[RNUM_READ_MASK] = value;   // also sync raw reg (already done by caller, but explicit)
    this.setupNextRead(0);
    break;
```

**Tests to add**:
1. Write `READ_MASK_FOLLOWS (0xBB)` + mask byte `0x03` (status + byte counter low). Verify that `readPort()` returns the status byte first (read pointer at 0). 
2. Advance the read pointer by reading once. Write a new `READ_MASK_FOLLOWS` + `0x01`. Verify `readPort()` returns status byte (position reset to 0, not the advanced position).

---

### Updated Summary Table (Steps 32–35)

| Step | Issue | Severity | Status |
|------|-------|----------|--------|
| 32   | `resetPointer` not reset to 0 on new base byte | 🟡 Moderate | ✅ Done |
| 33   | `resetPointer` not incremented after follow bytes | 🟢 Low | ✅ Done |
| 34   | `RESET_PORT_A/B_TIMING` not zeroing raw registers | 🟢 Low | ✅ Done |
| 35   | `READ_MASK_FOLLOWS` missing `setupNextRead(0)` after follow byte | 🟡 Moderate | ✅ Done |

---

## Final Cross-Check (Cross-Check #3) — Steps 36

This cross-check compared the complete MAME `z80dma.cpp` + `specnext_dma.cpp` source against the current Klive `DmaDevice.ts`. Areas examined:
- `device_reset()` / `reset()` initial state
- `COMMAND_READ_STATUS_BYTE` → `readCurFollow = 0` vs `registerReadSeq = RD_STATUS`
- `readStatusByte()` single-bit READ_MASK advance guard
- `specnext write()` follow-byte path: prescaler injection ordering vs parent call
- `device_reset()` `m_status = 0` vs Klive field initializer `0x38`
- All WR6 commands: RESET, LOAD, CONTINUE, ENABLE_DMA, READ_MASK_FOLLOWS
- `enable()` / `disable()` semantics

**All areas matched correctly except one (Step 36).**

---

### Step 36: Fix `reset()` initial `m_status` — must be `0`, not `0x38`

**File**: `src/emu/machines/zxNext/DmaDevice.ts`

**MAME behavior** (`z80dma_device::device_reset()`):
```cpp
void z80dma_device::device_reset()
{
    m_timer->reset();
    m_status = 0;       // <-- hardware reset sets status to 0
    m_dma_seq = ~0;
    m_rdy = 0;
    m_force_ready = 0;
    // ...
}
```
`specnext_dma_device::device_reset()` calls `z80dma_device::device_reset()`, so also starts with `m_status = 0`.

`m_status = 0x38` is set by `COMMAND_RESET` (software reset), not by hardware power-on reset.

**Klive behavior**:
- Field initializer: `private m_status: number = 0x38;`
- `reset()` does NOT set `m_status` — it retains `0x38` from the field initializer after object construction.

**Impact**: After power-on (hardware) reset but before any COMMAND_RESET, reading the status byte returns `0x38` instead of `0`. In practice the ZX Next firmware always issues COMMAND_RESET before reading status, so this has minimal real-world impact. However, it is a semantic discrepancy.

**Fix**:
```ts
reset(): void {
  // ...
  this.m_status = 0;   // MAME device_reset() sets m_status = 0 (NOT 0x38)
  // ...
}
```

Also update the field initializer comment to clarify:
```ts
private m_status: number = 0;   // Raw status byte; set to 0x38 only by COMMAND_RESET
```

**Tests to add** (in `DmaDevice-step7-8.test.ts`):
1. After `new TestZxNextMachine()` (hardware reset), `getStatus()` must return `0`.
2. After `reset()` call (no COMMAND_RESET), `getStatus()` must return `0`.
3. After `COMMAND_RESET`, `getStatus()` must return `0x38` (existing test 23 covers this indirectly).

---

### Step 37: `triggerInterrupt()` uses wrong bit for STATUS_AFFECTS_VECTOR

**File**: `src/emu/machines/zxNext/DmaDevice.ts`

**MAME behavior** (`z80dma.cpp`):
```cpp
#define STATUS_AFFECTS_VECTOR   (INTERRUPT_CTRL & 0x20)   // bit D5

void z80dma_device::trigger_interrupt(int level)
{
    if (!m_ius && INTERRUPT_ENABLE)
    {
        // ...
        if (STATUS_AFFECTS_VECTOR)  // INTERRUPT_CTRL bit D5 = 0x20
            m_vector = (INTERRUPT_VECTOR & 0xf9) | (level << 1);
        else
            m_vector = INTERRUPT_VECTOR;
        // ...
    }
}
```

Z80 DMA INTERRUPT_CTRL byte bit assignments (from MAME macros):
- D0 (0x01) = `INT_ON_MATCH`
- D1 (0x02) = `INT_ON_END_OF_BLOCK`
- D2 (0x04) = `PULSE_GENERATED`
- D5 (0x20) = `STATUS_AFFECTS_VECTOR`
- D6 (0x40) = `INT_ON_READY`

**Klive behavior** (`triggerInterrupt()` at ~line 1671):
```ts
// STATUS_AFFECTS_VECTOR — INTERRUPT_CTRL bit D2 (WR4 interrupt control byte)
const statusAffectsVector = (this.regs[RNUM_INTERRUPT_CTRL] & 0x04) !== 0;
```

Klive uses **bit D2 (0x04)** — which is actually `PULSE_GENERATED` in MAME, not `STATUS_AFFECTS_VECTOR`. The correct check should use **bit D5 (0x20)**.

**Impact**: When `PULSE_GENERATED` (D2) is set in INTERRUPT_CTRL, Klive incorrectly modifies the interrupt vector to encode the interrupt level. When `STATUS_AFFECTS_VECTOR` (D5) is actually programmed, Klive does NOT modify the vector. In practice ZX Next firmware rarely uses this feature, so real-world impact is minimal.

**Fix**:
```ts
// WRONG:
const statusAffectsVector = (this.regs[RNUM_INTERRUPT_CTRL] & 0x04) !== 0;
// CORRECT (MAME: STATUS_AFFECTS_VECTOR = INTERRUPT_CTRL & 0x20):
const statusAffectsVector = (this.regs[RNUM_INTERRUPT_CTRL] & 0x20) !== 0;
```

Also correct the docstring comment on `triggerInterrupt()`:
```ts
// STATUS_AFFECTS_VECTOR (INTERRUPT_CTRL bit D5 of WR4 follow byte):
```

---

### Step 38: `reset()` does not clear `ip`, `ius`, `forceReady`, and `resetPointer`

**File**: `src/emu/machines/zxNext/DmaDevice.ts`

**MAME behavior** (`z80dma_device::device_reset()`):
```cpp
void z80dma_device::device_reset()
{
    m_timer->reset();
    m_status = 0;
    // ...
    m_force_ready = 0;     // ← hardware reset clears force_ready
    // ...
    m_num_follow = 0;
    m_read_cur_follow = 0;
    m_reset_pointer = 0;   // ← hardware reset clears the progressive column pointer
    // ...
    WR3 &= ~0x20;
    m_ip = 0;              // ← hardware reset clears interrupt pending
    m_ius = 0;             // ← hardware reset clears interrupt under service
    m_vector = 0;
}
```

**Klive behavior** (`reset()` method):
```ts
reset(): void {
    this.registers = this.initializeRegisters();
    // ...
    this.regs.fill(0);      // clears WR3 D5 (interrupt enable) ✅
    this.m_status = 0;      // ✅ (Step 36)
    // Missing:
    // this.ip = 0;          ← NOT reset
    // this.ius = 0;         ← NOT reset
    // this.forceReady = false; ← NOT reset
    // this.resetPointer = 0; ← NOT reset
}
```

These fields are only 0 after `new DmaDevice()` construction (from TypeScript field initializers). If `reset()` is called after the device has been running (e.g., hardware reset while interrupts were active), stale `ip`, `ius`, `forceReady`, and `resetPointer` values persist.

**Fix**: Add the following lines to `reset()`:
```ts
// Step 38: MAME device_reset() explicitly clears these (not just field-initialised).
this.ip = 0;
this.ius = 0;
this.forceReady = false;
this.resetPointer = 0;
```

---

## Final Cross-Check (Cross-Check #4) — Steps 37–38

This cross-check compared the complete MAME `z80dma.cpp` + `specnext_dma.cpp` source against the current Klive `DmaDevice.ts` (after Step 36 was applied). Areas examined:
- `device_reset()` / `reset()` — ip, ius, forceReady, resetPointer cleared?
- `triggerInterrupt()` — STATUS_AFFECTS_VECTOR bit mask
- `COMMAND_RESET` progressive column reset mechanics
- `COMMAND_LOAD` / `COMMAND_CONTINUE` / `COMMAND_ENABLE_DMA` semantics
- `specnext_dma::write()` — prescaler inject-before-parent ordering
- SEQ_FINISH / `handleTransferFinish()` — m_status construction
- `readStatusByte()` / `setupNextRead()` — READ_MASK advance guard
- `COMMAND_REINITIALIZE_STATUS_BYTE` / `COMMAND_RESET_AND_DISABLE_INTERRUPTS`
- Daisy-chain interrupt (z80daisy_irq_ack / z80daisy_irq_reti) — not applicable in emulator context

**All areas matched correctly except two (Steps 37 and 38).**

---

### Step 39: `triggerInterrupt()` modifies `regs[RNUM_INTERRUPT_VECTOR]` directly instead of a separate `m_vector` field

**File**: `src/emu/machines/zxNext/DmaDevice.ts`

**MAME behavior** (`z80dma_device::trigger_interrupt()`):
```cpp
void z80dma_device::trigger_interrupt(int level)
{
    if (!m_ius && INTERRUPT_ENABLE)
    {
        m_ip = 1;
        if (STATUS_AFFECTS_VECTOR)
            m_vector = (INTERRUPT_VECTOR & 0xf9) | (level << 1);  // ← writes to m_vector
        else
            m_vector = INTERRUPT_VECTOR;                           // ← writes to m_vector
        // INTERRUPT_VECTOR register (REG(4,4)) is NEVER modified here
    }
}
```

`m_vector` is a separate `uint8_t` field in MAME, reset to 0 in `device_reset()`. The INTERRUPT_VECTOR register itself is never touched by `trigger_interrupt()`.

**Klive behavior**:
```ts
if (statusAffectsVector) {
    this.regs[RNUM_INTERRUPT_VECTOR] =            // ← modifies the register directly!
        (this.regs[RNUM_INTERRUPT_VECTOR] & 0xF9) | ((level & 0x03) << 1);
}
```

Klive writes back into the stored INTERRUPT_VECTOR register. If `trigger_interrupt` is called multiple times with STATUS_AFFECTS_VECTOR set, subsequent calls start from the already-modified register (although for level=0 the result converges to the same value). More importantly, a subsequent `z80daisy_irq_ack()` (if added) would need to read `m_vector`, not the register.

**Fix**: Add `private m_vector: number = 0;` field, compute the vector into it in `triggerInterrupt()` without modifying the register, and clear it in `reset()`.

```ts
// In triggerInterrupt():
if (statusAffectsVector) {
    this.m_vector = (this.regs[RNUM_INTERRUPT_VECTOR] & 0xF9) | ((level & 0x03) << 1);
} else {
    this.m_vector = this.regs[RNUM_INTERRUPT_VECTOR];
}
```

---

### Step 40: Address mode 0b11 (WR1/WR2 D5=1/D4=1, "do not program") treated as Decrement instead of Fixed

**File**: `src/emu/machines/zxNext/DmaDevice.ts`

**MAME behavior** (`z80dma.cpp` macros):
```cpp
#define PORTA_FIXED  (((WR1 >> 4) & 0x02) == 0x02)  // true when D5=1, regardless of D4
#define PORTA_INC    (WR1 & 0x10)                    // D4
```

So for WR1 D5-D4 = 0b11: `PORTA_FIXED = 1` → address delta = 0 (Fixed). Same for 0b10.

**Klive behavior** (`performWriteCycle()`):
```ts
const portADelta = this.registers.portAAddressMode === AddressMode.FIXED ? 0  // only exact 2
                 : this.registers.portAAddressMode === AddressMode.INCREMENT ? 1 : -1;
// If portAAddressMode = 3 (D5=1,D4=1) → falls through to -1 (Decrement) ← wrong
```

`getAddressUpdateFunction()` already handles mode 3 correctly (via `default:` → `noOpAddressUpdate`). Only the direct `_addressA`/`_addressB` delta computation in `performWriteCycle()` is wrong.

**Fix**: Change `=== AddressMode.FIXED` to `>= AddressMode.FIXED` in `performWriteCycle()`:
```ts
const portADelta = this.registers.portAAddressMode >= AddressMode.FIXED ? 0   // 2 or 3 = Fixed
                 : this.registers.portAAddressMode === AddressMode.INCREMENT ? 1 : -1;
const portBDelta = this.registers.portBAddressMode >= AddressMode.FIXED ? 0
                 : this.registers.portBAddressMode === AddressMode.INCREMENT ? 1 : -1;
```

**Impact**: Only triggers when WR1/WR2 D5-D4 = 0b11, which is a "do not program" encoding. No valid ZX Next firmware programs this, so real-world impact is nil. Severity: 🟢 Very Low.

---

## Final Cross-Check (Cross-Check #5) — Steps 39–40

This cross-check compared the complete MAME `z80dma.cpp` + `specnext_dma.cpp` source against the current Klive `DmaDevice.ts` (after Steps 36–38 applied). Areas examined:
- `triggerInterrupt()` — vector storage: separate `m_vector` field vs. in-place register modification
- `performWriteCycle()` — address mode 0b11 Fixed vs. Decrement
- `rdy_write_callback` — m_status bit 1 (no RDY in emulator, intentional)
- `specnext write()` follow-byte ordering — prescaler inject before parent ✓
- `specnext COMMAND_ENABLE_DMA` — byte counter zeroed after parent ✓
- `specnext device_reset()` — dma_mode, dma_delay, prescaler, timer_0 all cleared ✓
- Auto-restart address reload ✓
- `COMMAND_RESET_AND_DISABLE_INTERRUPTS` — all fields ✓
- SEQ_FINISH `is_final` with count=0 (documented intentional deviation, Step 24) ✓
- WR5 AUTO_RESTART and READY_ACTIVE_HIGH bits ✓

**All areas matched correctly except two (Steps 39 and 40).**

---

### Updated Summary Table (Steps 36–40)

| Step | Issue | Severity | Status |
|------|-------|----------|--------|
| 36   | `reset()` leaves `m_status = 0x38` instead of `0` (MAME: `device_reset` sets 0) | 🟢 Low | ✅ Done |
| 37   | `triggerInterrupt()` uses `INTERRUPT_CTRL & 0x04` (PULSE_GENERATED) instead of `& 0x20` (STATUS_AFFECTS_VECTOR) | 🟢 Low | ✅ Done |
| 38   | `reset()` does not clear `ip`, `ius`, `forceReady`, `resetPointer` (MAME `device_reset` zeros all) | 🟢 Low | ✅ Done |
| 39   | `triggerInterrupt()` modifies `regs[RNUM_INTERRUPT_VECTOR]` directly; MAME uses separate `m_vector` field | 🟢 Low | ✅ Done |
| 40   | Address mode 0b11 (WR1/WR2 D5=1/D4=1) treated as Decrement instead of Fixed in `performWriteCycle()` | 🟢 Very Low | ✅ Done |

---

## Cross-Check #6 — Step 41

Exhaustive element-by-element comparison of every function, state transition, register handler,
command handler, follow-byte path, and specnext override against MAME sources.

### Areas verified (all matched):

- `device_reset()` / `reset()` — all field clears ✓
- `enable()` / `disable()` — timer vs seq, bus release conditions ✓
- `is_ready()` — always-true in Klive (no RDY pin), intentional ✓
- `trigger_interrupt()` — guards, vector computation, status bit clear ✓
- `do_read()` / `performReadCycle()` — PORTA_IS_SOURCE dispatch, memory/IO ✓
- `do_transfer_write()` — dest selection, memory/IO ✓
- `do_search()` — OR-mask semantics, INT_ON_MATCH gate ✓
- `do_write()` — TRANSFER_MODE dispatch, address delta, byte counter ✓
- `clock_w()` / `stepDma()` state machine:
  - SEQ_WAIT_READY bus-skip for continuous after first byte ✓
  - SEQ_REQUEST_BUS / SEQ_WAITING_ACK ✓
  - SEQ_TRANS1_WRITE_DEST mode dispatch (byte/continuous/burst/final) ✓
  - SEQ_FINISH → disable + status + INT_ON_END_OF_BLOCK + AUTO_RESTART ✓
- `write()` / `writePort()` base-byte dispatch masks and ordering ✓
- Follow-byte mechanism: curFollow/numFollow, REGNUM(4,3) chain, READ_MASK ✓
- specnext `write()` override: ENABLE_DMA bc=0, RESET prescaler=0, timing D5 prescaler ✓
- specnext `do_read()` pre-increment — equivalent via `(bc+1)===count` formula ✓
- specnext `clock_w()` dma_delay at WAIT_READY + post-write intercept ✓
- specnext prescaler timing (different formula, same intent) ✓
- All WR6 commands: RESET, LOAD, CONTINUE, ENABLE/DISABLE_DMA,
  READ_STATUS_BYTE, INITIATE_READ_SEQUENCE, REINITIALIZE_STATUS_BYTE,
  RESET_PORT_A/B_TIMING, FORCE_READY, ENABLE/DISABLE_INTERRUPTS,
  RESET_AND_DISABLE_INTERRUPTS, READ_MASK_FOLLOWS ✓
- `read()` / `readStatusByte()` — positions 0-6, advance condition, setup_next_read ✓
- PULSE_GENERATED — not implemented (not used by ZXN DMA), intentional ✓
- Daisy chain (irq_ack/irq_reti) — not needed (Klive reads ip/ius directly) ✓

### Step 41: Final byte_counter value off by 1 after transfer completion

**MAME behaviour** (`z80dma.cpp` `clock_w` + `do_write` + `specnext_dma::do_read`):

In zxnDMA mode:
```cpp
// specnext_dma::do_read() — pre-increments on last byte:
if (m_dma_mode == 0 && (m_byte_counter + 1) == m_count)
    m_byte_counter++;

// clock_w SEQ_TRANS1_WRITE_DEST:
const bool is_final = m_count && m_byte_counter == m_count;
do_write();          // always increments m_byte_counter
```

Trace for count=3 (zxnDMA):
- Byte 1: do_read (0+1≠3), is_final=(0==3)?No, do_write→bc=1
- Byte 2: do_read (1+1≠3), is_final=(1==3)?No, do_write→bc=2
- Byte 3: do_read (2+1==3 → pre-incr → bc=3), is_final=(3==3)?YES, do_write→bc=4
- Final byte_counter = **4** (count + 1)

In legacy (base z80dma, no pre-increment):
- Byte 3: is_final=(2==3)?No, do_write→bc=3
- Byte 4: is_final=(3==3)?YES, do_write→bc=4
- Final byte_counter = **4** (count + 1), total bytes = count + 1

**Klive behaviour** (`DmaDevice.ts` `executeTransferByte` + `performWriteCycle`):

```typescript
const isFinal = (this._count !== 0 &&
                 (this.transferState.byteCounter + 1) === this._count);
this.performWriteCycle(doWrite);  // increments byteCounter
```

Trace for count=3 (zxnDMA):
- Byte 1: isFinal=(0+1==3)?No, write→bc=1
- Byte 2: isFinal=(1+1==3)?No, write→bc=2
- Byte 3: isFinal=(2+1==3)?YES, write→bc=3
- Final byte_counter = **3** (count), missing the extra increment

**Root cause**: Klive's `(bc+1)===count` formula correctly determines is_final (transferring
exactly the right number of bytes), but the final byte_counter value is one less than MAME because
MAME's `do_write()` always runs after the `is_final` check, adding one final increment that Klive
does not replicate.

**Fix**: After `performWriteCycle()` in `executeTransferByte()`, when `isFinal` is true,
add one extra byte_counter increment:
```typescript
if (isFinal) {
  this.transferState.byteCounter = (this.transferState.byteCounter + 1) & MASK_16BIT;
}
```

This makes `byte_counter` end at `count + 1` (matching MAME) without changing the transfer count.

**Impact**: Observable via `readStatusByte()` positions 1-2 (byte counter lo/hi) if software
reads the DMA byte counter after transfer completion. Auto-restart resets byte_counter to 0,
so the difference is only visible when auto-restart is off. Severity: 🟢 Low.

### Updated Summary Table (Steps 36–41)

| Step | Issue | Severity | Status |
|------|-------|----------|--------|
| 36   | `reset()` leaves `m_status = 0x38` instead of `0` | 🟢 Low | ✅ Done |
| 37   | `triggerInterrupt()` uses wrong bit mask for STATUS_AFFECTS_VECTOR | 🟢 Low | ✅ Done |
| 38   | `reset()` does not clear `ip`, `ius`, `forceReady`, `resetPointer` | 🟢 Low | ✅ Done |
| 39   | `triggerInterrupt()` modifies register directly; needs separate `m_vector` | 🟢 Low | ✅ Done |
| 40   | Address mode 0b11 treated as Decrement instead of Fixed | 🟢 Very Low | ✅ Done |
| 41   | Final byte_counter = count (should be count+1 per MAME) | 🟢 Low | ✅ Done |
