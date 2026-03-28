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
