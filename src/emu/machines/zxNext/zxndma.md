# ZX Spectrum Next DMA (zxnDMA) Implementation Plan

## Overview

The ZX Spectrum Next DMA (zxnDMA) is a single-channel DMA device that provides high-performance memory-to-memory, memory-to-IO, and IO-to-memory transfers with support for burst mode and fixed-rate audio sampling.

### Key Features

- **Single-channel DMA** with ports A and B
- **Two operating modes**: zxnDMA mode (port 0x6B) and legacy mode (port 0x0B)
- **Transfer directions**: A→B or B→A
- **Port types**: Memory or I/O for each port
- **Address modes**: Increment, decrement, or fixed
- **Transfer modes**: Continuous or burst
- **Audio support**: Fixed-rate transfers via prescalar (875kHz / prescalar)
- **Auto-restart**: Automatic transfer repetition
- **Status monitoring**: Transfer completion and byte counter

### Hardware Integration

- Operates at CPU speed: 3.5MHz, 7MHz, 14MHz, or 28MHz
- Takes control of the bus during transfers
- Burst mode allows CPU execution during idle periods
- No interrupt generation capability (current cores)

### Key Implementation Notes

1. **Simple, non-pipelined design** - transfers are straightforward
2. **Transfer length** is exact in zxnDMA mode (legacy mode adds +1 for compatibility)
3. **Fixed-time transfers** for audio sampling (prescalar)
4. **Only continuous or burst modes** - no byte-at-a-time mode
5. **No interrupt generation** in current cores

## Implementation Process

Each step follows this strict workflow:

### Pre-Implementation
1. **Verify baseline** - Ensure all existing ZX Spectrum Next unit tests pass
2. **Review step goals** - Understand what needs to be implemented
3. **Get approval** - Wait for confirmation to proceed with the step

### Implementation Phase
4. **Implement the step** - Write the code for the current step
5. **Check for linting errors** - Verify no errors in VS Code Problems panel
6. **Fix any issues** - Resolve linting errors immediately

### Testing Phase
7. **Create unit tests** - Write tests for the new functionality
   - Include **positive test cases** (expected behavior)
   - Include **negative test cases** (error handling, edge cases)
8. **Run new tests** - Verify new tests pass
9. **Fix failures** - Debug and fix any failing tests
10. **Run all tests** - Ensure no regressions in existing tests

### Completion
11. **Final verification** - All tests pass, no linting errors
12. **Mark as completed** - Update the step title with ✓ COMPLETED
13. **Request approval** - Wait for confirmation before proceeding to next step

**Testing Framework**: Vitest (tests located in `test/` folder)

**Quality Gates**:
- ✓ No linting errors
- ✓ All new tests pass
- ✓ All existing tests still pass
- ✓ Code follows project conventions

## Architecture

### Register Groups (WR0-WR6)

1. **WR0** - Direction, operation, Port A configuration
2. **WR1** - Port A configuration (memory/IO, address mode, timing)
3. **WR2** - Port B configuration (memory/IO, address mode, timing, prescalar)
4. **WR3** - Activation (legacy, prefer WR6)
5. **WR4** - Port B, timing, interrupt configuration
6. **WR5** - Ready and stop configuration
7. **WR6** - Command register (control operations)

### Internal State

- **Port A/B start addresses** (16-bit)
- **Block length** (16-bit)
- **Current source/destination pointers** (16-bit)
- **Byte counter** (16-bit)
- **Status flags**: end-of-block, at-least-one-byte
- **Timing configuration**: cycle lengths, prescalar
- **Mode flags**: continuous/burst, auto-restart

## Implementation Steps

### Step 1: Core Data Structures and Register Definitions ✓ COMPLETED

**Goal**: Define all DMA registers, internal state, and basic structure.

**Implementation**:
- Create register enums for WR0-WR6 fields
- Define `DmaState` enum (IDLE, WAITING_ACK, TRANSFERRING, etc.)
- Create internal state properties for:
  - Register values (WR0-WR6)
  - Transfer counters and addresses
  - Status flags
  - State machine state

**Tests**:
- Verify register structure initialization
- Test state enum values
- Validate default reset values

---

### Step 2: Register Write Sequencing (WR0) ✓ COMPLETED

**Goal**: Implement WR0 register parsing and parameter sequencing.

**Implementation**:
- Parse WR0 base byte (direction, parameter bits)
- Implement parameter sequencing state machine
- Handle Port A starting address (low/high)
- Handle block length (low/high)
- Store values in internal registers

**Tests**:
- Write WR0 with different parameter combinations
- Verify parameter sequence ordering (D3→D4→D5→D6)
- Test partial parameter writes
- Verify direction flag storage

**Status**: ✓ All 63 tests passing, no linting errors

---

### Step 3: Register Write Sequencing (WR1-WR2) ✓ COMPLETED

**Goal**: Implement Port A and Port B configuration.

**Implementation**:
- Parse WR1 base byte (Port A memory/IO, address mode, timing)
- Handle optional timing byte parameter
- Parse WR2 base byte (Port B memory/IO, address mode, timing)
- Handle optional timing byte and prescalar parameters
- Store configuration values

**Tests**:
- Configure Port A as memory with increment
- Configure Port A as I/O with fixed address
- Configure Port B with prescalar value
- Test all address modes (increment, decrement, fixed)
- Verify timing cycle configurations (2, 3, 4 cycles)

**Status**: ✓ All 40 tests passing, no linting errors

---

### Step 4: Register Write Sequencing (WR3-WR5) ✓ COMPLETED

**Goal**: Implement activation and control configuration.

**Implementation**:
- Parse WR3 (DMA enable - prefer WR6 instead)
- Parse WR4 (mode: continuous/burst, Port B address)
- Parse WR5 (auto-restart, CE/WAIT configuration)
- Store mode and control flags

**Tests**:
- Configure continuous mode
- Configure burst mode
- Enable auto-restart
- Test Port B address loading

**Status**: ✓ All 40 tests passing, no linting errors

---

### Step 5: Command Register (WR6) - Basic Commands ✓ COMPLETED

**Goal**: Implement essential WR6 commands.

**Implementation**:
- Parse WR6 command byte
- Implement RESET (0xC3) command
- Implement RESET_PORT_A_TIMING (0xC7)
- Implement RESET_PORT_B_TIMING (0xCB)
- Implement DISABLE_DMA (0x83)
- Implement READ_MASK_FOLLOWS (0xBB)
- Reset prescalar and timing on reset commands

**Tests**:
- Execute RESET and verify all state cleared
- Execute timing resets
- Disable DMA during transfer
- Verify prescalar reset behavior
- Test READ_MASK_FOLLOWS command

**Status**: ✓ 57 tests in DmaDevice-commands.test.ts passing, 143 tests in DmaDevice.test.ts passing (200 total), no linting errors

---

### Step 6: Command Register (WR6) - Transfer Commands ✓ COMPLETED

**Goal**: Implement LOAD, CONTINUE, and ENABLE commands.

**Implementation**:
- Implement LOAD (0xCF): Copy register addresses to internal pointers
- Implement CONTINUE (0xD3): Reset counter, keep pointers
- Implement ENABLE_DMA (0x87): Start transfer
- Handle direction-dependent address loading
- Implement zxnDMA vs legacy mode counter initialization (0 vs -1)

**Tests**:
- LOAD with A→B direction
- LOAD with B→A direction
- CONTINUE after partial transfer
- ENABLE to start transfer
- Test counter initialization in both modes

**Status**: ✓ 29 new tests in DmaDevice-commands.test.ts (86 total), 229 tests passing overall, no linting errors

---

### Step 7: Command Register (WR6) - Read Operations ✓ COMPLETED

**Goal**: Implement status reading and read mask configuration.

**Implementation**:
- Implement READ_STATUS_BYTE (0xBF)
- Implement READ_MASK_FOLLOWS (0xBB) - already done in Step 5
- Implement INITIALIZE_READ_SEQUENCE (0xA7)
- Implement REINITIALIZE_STATUS_BYTE (0x8B)
- Parse read mask byte
- Set up read sequence state machine
- Implement readStatusByte() method with read mask filtering
- Implement advanceReadSequence() to skip disabled registers

**Tests**:
- Read status byte (verify E and T bits)
- Configure read mask
- Initialize read sequence with different masks
- Reinitialize status byte
- Read mask filtering (counter only, Port A only, Port B only, combinations)

**Status**: ✓ 34 new tests in DmaDevice-commands.test.ts (120 total), 263 tests passing overall, no linting errors

---

### Step 8: Register Read Operations ✓ COMPLETED

**Goal**: Implement reading of DMA registers via read sequence.

**Implementation**:
- Implement read sequence state machine (completed in Step 7)
- Read status byte (format: 00E1101T) ✓
- Read counter (low/high - swapped in current core) ✓
- Read Port A address (low/high) ✓
- Read Port B address (low/high) ✓
- Handle read mask filtering ✓
- Implement read sequence wraparound ✓

**Tests**:
- Read full sequence with mask 0x7F
- Read partial sequence with custom mask
- Verify counter byte order
- Read addresses after transfer
- Test wraparound behavior
- Status byte format verification
- Read after state changes (LOAD, CONTINUE, ENABLE_DMA)
- Edge cases (all bits set, zero addresses, multiple cycles)

**Status**: ✓ 32 new tests in DmaDevice-regread.test.ts, 295 tests passing overall (143 + 120 + 32), no linting errors

---

### Step 9: Bus Control and Handshaking ✓ COMPLETED

**Goal**: Implement bus request/acknowledge protocol.

**Implementation**:
- Implement `busreq` signal assertion ✓
- Wait for `busak` signal ✓
- Handle bus arbitration with other DMA devices ✓
- Respect `dma_delay` signal ✓
- Implement bus release in burst mode ✓

**Tests**:
- Request bus and verify BUSREQ signal ✓
- Wait for BUSAK before transfer ✓
- Test bus arbitration with multiple requests ✓
- Verify bus release in burst mode ✓

**Status**: ✓ 32 new tests in DmaDevice-buscontrol.test.ts, 327 tests passing overall (143 + 120 + 32 + 32), no linting errors

---

### Step 10: Memory/IO Read Cycle ✓ COMPLETED

**Goal**: Implement the read phase of a transfer.

**Implementation**:
- Set up source address based on transfer direction ✓
- Determine read source (memory or IO) based on port configuration ✓
- Read from memory using machine.memoryDevice.readMemory() ✓
- Read from IO port using machine.portManager.readPort() ✓
- Store data byte in _transferDataByte for write cycle ✓
- Handle both A→B and B→A transfer directions ✓

**Tests**:
- Read from memory address in A→B direction ✓
- Read from memory address in B→A direction ✓
- Read sequential memory addresses ✓
- Read from IO port in A→B direction ✓
- Read from IO port in B→A direction ✓
- Distinguish between memory and IO reads ✓
- Read with increment/fixed address modes ✓
- Transfer state integration ✓
- Edge cases (zero values, 0xFF, consecutive reads, direction changes) ✓

**Status**: ✓ 19 new tests in DmaDevice-readcycle.test.ts, 346 tests passing overall (143 + 120 + 32 + 32 + 19), no linting errors

---

### Step 11: Memory/IO Write Cycle ✓ COMPLETED

**Goal**: Implement the write phase of a transfer.

**Implementation**:
- Set up destination address based on transfer direction ✓
- Determine write destination (memory or IO) based on port configuration ✓
- Write to memory using machine.memoryDevice.writeMemory() ✓
- Write to IO port using machine.portManager.writePort() ✓
- Update addresses based on address mode (increment, decrement, fixed) ✓
- Increment byte counter after each write ✓
- Handle both A→B and B→A transfer directions ✓

**Tests**:
- Write to memory address in A→B direction ✓
- Write to memory address in B→A direction ✓
- Write sequential memory addresses ✓
- Write to IO port in A→B direction ✓
- Write to IO port in B→A direction ✓
- Distinguish between memory and IO writes ✓
- Increment destination address ✓
- Decrement destination address ✓
- Fixed address mode (no change) ✓
- Increment source address simultaneously ✓
- Handle address wraparound at 0xFFFF ✓
- Handle address wraparound at 0x0000 with decrement ✓
- Increment byte counter on each write ✓
- Handle counter overflow at 65536 ✓
- Mixed address modes (increment source, fixed dest) ✓
- Complete read-write cycle integration ✓
- Multiple read-write cycles ✓

**Status**: ✓ 26 new tests in DmaDevice-writecycle.test.ts, 372 tests passing overall (143 + 120 + 32 + 32 + 19 + 26), no linting errors

---

### Step 12: Continuous Transfer Mode ✓ COMPLETED

**Goal**: Implement continuous (non-burst) transfer mode.

**Implementation**:
- Execute read-write cycles without CPU intervention ✓
- Continue until block length reached ✓
- Update addresses and counter each iteration ✓
- Check for transfer completion ✓
- Keep bus control throughout transfer ✓
- Added `executeContinuousTransfer()` method that loops read→write cycles

**Implementation Details**:
- Method checks `dmaEnabled` and `transferMode === CONTINUOUS` before starting
- Calls `requestBus()` at start, `releaseBus()` at end
- Loop performs `performReadCycle()` then `performWriteCycle()` for each byte
- Increments `bytesTransferred` counter
- Returns total number of bytes transferred
- Address updates handled by existing `updateAddress()` method

**Tests**:
- Basic transfers (A→B, B→A, single byte) ✓
- Block length variations (256 bytes, zero-length) ✓
- Transfer state management (counter, addresses) ✓  
- DMA enable requirements (disabled, wrong mode) ✓
- Edge cases (memory boundary 0xFFFF, wraparound, data integrity) ✓
- Bus control (request/release) ✓

**Status**: ✓ 13 new tests in DmaDevice-continuous.test.ts, 385 tests passing overall (143 + 120 + 32 + 32 + 19 + 26 + 13), no linting errors

---

### Step 13: Burst Transfer Mode with Prescalar ✓ COMPLETED

**Goal**: Implement burst mode with timed delays between transfers.

**Implementation**:
- Implement prescalar timer (875kHz reference) ✓
- Calculate delay based on prescalar value ✓
- Release bus during wait period in burst mode ✓
- Resume transfer when timer expires ✓
- Account for CPU speed and T-state budgets ✓
- Added `executeBurstTransfer(tStatesToExecute)` method

**Implementation Details**:
- Method checks `dmaEnabled` and `transferMode === BURST` before starting
- Calculates T-states per byte: `(prescalar * 3500000) / 875000`
- Formula based on 875kHz reference frequency at 3.5MHz base clock
- Tracks bytes remaining: `blockLength - byteCounter` to avoid over-transfer
- Releases bus between bytes via `releaseBusForBurst()` for CPU interleaving
- Stops when T-state budget exhausted or block complete
- Returns number of bytes transferred in this execution slice

**Tests**:
- Basic burst transfers (A→B, B→A, single byte) ✓
- Prescalar timing (55=16kHz, 110=8kHz, 220=4kHz audio rates) ✓
- T-state budget management (partial, resume, zero T-states) ✓
- Mode validation (disabled, wrong mode) ✓
- Bus control (release between bytes) ✓
- Large blocks (256 bytes, partial across calls) ✓
- Edge cases (zero-length, prescalar 0/255) ✓
- Transfer state updates (counter, addresses) ✓

**Status**: ✓ 19 new tests in DmaDevice-burst.test.ts, 404 tests passing overall (143 + 120 + 32 + 32 + 19 + 26 + 13 + 19), no linting errors

---

### Step 14: Auto-Restart Feature  ✓ COMPLETED

**Goal**: Implement automatic transfer restart on completion.

**Implementation**:
- Check auto-restart flag on transfer completion
- Reload source/destination addresses from registers
- Reset byte counter
- Restart transfer without CPU intervention
- Handle mode-dependent counter initialization (0 for zxnDMA, -1 for legacy)
- Add safety limit (1000 iterations) to prevent infinite loops in test scenarios

**Tests**:
- Enable auto-restart and verify multiple transfers
- Verify addresses reload correctly
- Verify counter resets properly
- Test with both transfer directions
- Disable auto-restart and verify single transfer
- Test auto-restart in burst mode
- Test auto-restart in continuous mode
- Verify isTransferComplete() helper method

---

### Step 15: Status Flags and Completion ✓ COMPLETED

**Goal**: Implement status flag updates and transfer completion.

**Implementation**:
- Set `atLeastOneByteTransferred` flag after first byte ✓
- Clear `endOfBlockReached` flag when transfer starts ✓
- Set `endOfBlockReached` flag when transfer completes (only if not auto-restarting) ✓
- Format status byte correctly: 0x36 (complete, no transfer), 0x37 (complete, transferred), 0x1A (in-progress, no transfer), 0x1B (in-progress, transferred) ✓
- Status byte uses conditional logic: `if (endOfBlockReached) 0x36|T else 0x1A|T` ✓
- Handle REINITIALIZE_STATUS_BYTE command to reset flags ✓
- Update flags during transfer lifecycle in continuous and burst modes ✓
- Fixed all old tests that had incorrect status byte expectations ✓

**Tests**:
- Initial Status: endOfBlockReached=true, atLeastOneByteTransferred=false, status=0x36 ✓
- After First Byte: Flags update correctly, status=0x1B (in-progress with transfer) ✓
- After Block Completion: endOfBlockReached=true, atLeastOneByteTransferred=true, status=0x37 ✓
- REINITIALIZE_STATUS_BYTE: Resets flags to initial state (0x36) ✓
- Burst Mode Status: Flags work correctly with burst transfers ✓
- Auto-Restart Status: Status maintained correctly across restart iterations ✓
- Status Byte Format: Verified all bit patterns (bits 7-6=00, bits 4-1 vary by state) ✓
- RESET Command: Properly resets status flags to initial state ✓

**Status**: ✓ 20 new tests in DmaDevice-status.test.ts, 440 tests passing overall (143 + 120 + 32 + 32 + 19 + 26 + 13 + 19 + 16 + 20), no linting errors

---

### Step 16: Port Handler Integration (0x6B - zxnDMA mode)

**Goal**: Connect DMA to port 0x6B for zxnDMA mode.

**Implementation**:
- Implement `readZxnDmaPort` in `ZxnDmaPortHandler.ts`
- Implement `writeZxnDmaPort` in `ZxnDmaPortHandler.ts`
- Route read to `DmaDevice.readPort()`
- Route write to `DmaDevice.writePort()`
- Set `dmaMode` flag to zxnDMA mode

**Tests**:
- Write to port 0x6B and verify register update
- Read from port 0x6B and verify status/register read
- Test complete transfer via port 0x6B
- Verify length is exact (not length+1)

---

### Step 17: Port Handler Integration (0x0B - Zilog mode)
Legacy mode)

**Goal**: Connect DMA to port 0x0B for legacy compatibility mode.

**Implementation**:
- Implement `readZ80DmaPort` in `Z80DmaPortHandler.ts`
- Implement `writeZ80DmaPort` in `Z80DmaPortHandler.ts`
- Route to same `DmaDevice` methods
- Set `dmaMode` flag to legacy mode
- Handle length+1 behavior in legacy mode for compatibility

**Tests**:
- Write to port 0x0B and verify register update
- Read from port 0x0B
- Test transfer via port 0x0B
- Verify length+1 behavior in legacy

---

### Step 18: Machine Integration and Bus Arbitration

**Goal**: Integrate DMA with Z80 execution and bus control.

**Implementation**:
- Add DMA step to machine frame execution
- Handle BUSREQ/BUSAK signals
- Suspend CPU when DMA has bus
- Allow CPU execution during burst mode waits
- Handle DMA clock synchronization
- Integrate with turbo mode speeds

**Tests**:
- Run transfer and verify CPU halts
- Verify CPU resumes after transfer
- Test burst mode CPU interleaving
- Test at different CPU speeds
- Verify T-state accounting

---

### Step 19: Memory Contention and Timing

**Goal**: Implement accurate timing with memory contention.

**Implementation**:
- Apply ULA contention during DMA transfers
- Handle Layer 2 contention
- Adjust timing based on address being accessed
- Account for CPU speed variations
- Implement proper T-state consumption

**Tests**:
- Transfer during contended memory period
- Transfer during uncontended memory
- Test with Layer 2 active
- Verify timing at different CPU speeds
- Measure actual transfer duration

---

### Step 20: DMA Audio Sampling

**Goal**: Support fixed-rate audio transfers via prescalar.

**Implementation**:
- Calculate accurate prescalar timing
- Support audio DAC port transfers
- Implement fixed-rate sample playback
- Handle different sample rates (8kHz, 16kHz, etc.)
- Account for video timing variations (HDMI, VGA)

**Tests**:
- Transfer audio samples at 16kHz (prescalar=55)
- Transfer to DAC port 0xDF
- Verify timing accuracy
- Test burst vs continuous mode for audio
- Test different sample rates

---

### Step 21: Edge Cases and Error Handling

**Goal**: Handle edge cases and malformed commands.

**Implementation**:
- Handle zero-length transfers
- Handle invalid register writes
- Ignore unimplemented commands gracefully
- Handle mode switches mid-transfer
- Protect against invalid state transitions
- Handle disabled DMA mid-transfer

**Tests**:
- Attempt zero-length transfer
- Write invalid command codes
- Change mode during active transfer
- Disable DMA mid-transfer
- Send malformed register sequences

---

### Step 22: Optimization and Performance

**Goal**: Optimize DMA transfer performance.

**Implementation**:
- Optimize hot path (transfer loop)
- Minimize state checks during transfer
- Use efficient address calculations
- Cache frequently accessed values
- Profile and optimize critical sections

**Tests**:
- Benchmark large memory transfers
- Profile CPU time during DMA
- Compare performance to native code
- Measure frame impact of DMA transfers

---

### Step 23: Integration Tests - Memory Transfers

**Goal**: Test realistic memory-to-memory transfers.

**Implementation**:
- Test screen clearing (8KB transfer)
- Test sprite data loading
- Test pattern fills
- Test large block moves
- Test overlapping source/destination

**Tests**:
- Clear screen with DMA (0x4000-0x5800)
- Copy ROM to RAM
- Load 256-byte sprite
- Copy 16KB bank
- Test wraparound transfers

---

### Step 24: Integration Tests - I/O Transfers

**Goal**: Test realistic I/O port transfers.

**Implementation**:
- Test sprite pattern upload (port 0x5B)
- Test palette upload
- Test audio sampling to DAC
- Test UART data transfer
- Test register block writes

**Tests**:
- Upload sprite patterns via DMA
- Upload 512-byte palette
- Stream audio samples to DAC
- Transfer to multiple I/O ports
- Test fixed address I/O transfers

---

### Step 25: Debugging Support and Observability

**Goal**: Add debugging aids for DMA operations.

**Implementation**:
- Add DMA state visualization
- Log register writes in debug mode
- Track transfer progress
- Export DMA statistics
- Add breakpoint support for DMA operations

**Tests**:
- Verify debug output format
- Test state visualization
- Monitor transfer progress
- Check statistics accuracy

---

## Testing Strategy

### Unit Test Categories

1. **Register Tests**: Each WR0-WR6 register group
2. **Command Tests**: Each WR6 command
3. **State Machine Tests**: All state transitions
4. **Transfer Tests**: All transfer modes and directions
5. **Timing Tests**: Prescalar and cycle timing
6. **Integration Tests**: Complete transfer scenarios

### Test Data Sources

- Use assembly examples from ZX Next wiki
- Reference VHDL implementation behavior
- Compare with documented expected behavior

### Validation Criteria

- Each step must have passing unit tests
- No step proceeds without tests passing
- Integration tests validate multi-step scenarios
- Performance tests ensure reasonable speed

## Implementation Notes

### Critical Timing Behaviors

1. **Prescalar formula**: `Frate = 875kHz / prescalar`
2. **System clock variations**: Adjust for video timing (nextreg 0x11)
3. **14MHz wait states**: Special handling in read/write cycles
4. **Burst mode CPU scheduling**: Release bus during prescalar waits

### Known Core Differences

- Core 3.0.5: Counter bytes swapped in read-back
- Core 3.1.2+: Port selection determines mode (0x6B vs 0x0B)
- Core 3.1.4: Counter byte order fixed
- Core 3.1.8+: Interrupt support added (opt-in via NextRegs)

### VHDL Reference Mapping

- State machine: Lines 268-495 (dma.vhd)
- Register writes: Lines 500-800 (dma.vhd)
- Register reads: Lines 850-1050 (dma.vhd)
- Bus control: Lines 170-190 (dma.vhd)
- Timing: Lines 155-180 (dma.vhd)

## Future Enhancements

1. **Interrupt support** (core 3.1.8+): NextReg $CC, $CD, $CE
2. **Multiple channels**: If future cores support
3. **DMA tracing**: Detailed operation logging
4. **Performance profiling**: Transfer time measurement
5. **Visual debugger**: Real-time transfer visualization

## Resources

- **Wiki**: https://wiki.specnext.dev/DMA
- **VHDL Source**: `next-fpga/src/device/dma.vhd`
- **Ports Reference**: `next-fpga/ports.txt`
- **NextReg**: https://wiki.specnext.dev/NextReg
- **Assembly Examples**: ZX Next wiki DMA article

## Success Criteria

✓ All 25 steps implemented with passing tests  
✓ Compatible with existing Spectrum DMA software  
✓ Accurate timing at all CPU speeds  
✓ Correct behavior in both zxnDMA and legacy modes  
✓ Audio sampling works at standard rates  
✓ Integration with emulator framework complete  
✓ Performance acceptable for real-time emulation  
✓ Memory and I/O transfers work correctly in all modes
---

**Document Version**: 1.0  
**Date**: January 31, 2026  
**Status**: Planning Complete - Ready for Implementation
