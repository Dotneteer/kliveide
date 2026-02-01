# DMA Device Optimization & Refactoring

## Performance Optimizations

### Hot Path - stepDma() Method
**Issue**: Redundant calculations per byte transfer
- `bytesAlreadyTransferred` calculated twice (lines 933-939, 967-973)
- `bytesToTransfer` calculated on every call (line 926-928)
- Legacy mode check repeated 4 times per call

**Action**:
1. Cache `bytesToTransfer` as instance field when ENABLE_DMA executed
2. Create single `getBytesTransferred()` helper method
3. Move mode check outside loop

### Memory Timing Calculation
**Issue**: Bank lookup on every read (line 1041)
- `machine.memoryDevice.bank8kLookup` accessed per byte

**Action**:
1. Pre-calculate source/dest memory attributes on LOAD command
2. Cache: `sourceIsBank7`, `sourceNeedsWait`, `destIsBank7`, `destNeedsWait`
3. Update cache when addresses cross bank boundaries

### Address Update
**Issue**: Conditional branching in hot path (lines 1180-1196)
- String comparison `'source' | 'dest'` per byte
- Address mode switch per port per byte

**Action**:
1. Create 4 specialized methods: `incrementSource()`, `decrementSource()`, `incrementDest()`, `decrementDest()`
2. Store function references in `TransferState`: `updateSourceFn`, `updateDestFn`
3. Set function pointers on LOAD command based on address mode
4. Replace `updateAddress()` call with direct function call

### Transfer Data Byte
**Issue**: Instance field for temporary value (line 1082)

**Action**:
1. Remove `_transferDataByte` field
2. Pass data directly from `performReadCycle()` to `performWriteCycle()`
3. Return data byte from read, accept as parameter in write

## Stability Improvements

### Bus State Machine
**Issue**: Partial bus release states possible
- `releaseBus()` clears both flags atomically (line 864)
- But `releaseBusForBurst()` calls it conditionally (line 896)

**Action**:
1. Add state validation in `releaseBus()`: assert `busRequested` before clearing
2. Add `getBusState()` enum return: `IDLE`, `REQUESTING`, `GRANTED`, `RELEASED`
3. Replace boolean flags with single `busState` enum

### Transfer Counter Overflow
**Issue**: 16-bit counter wraps without detection (line 1169)
- Legacy mode: `0xFFFF → 0` is intentional
- zxnDMA mode: Could indicate bug if wraps

**Action**:
1. Add overflow detection in `performWriteCycle()`
2. Log warning if counter wraps in zxnDMA mode
3. Add max transfer size validation (64KB limit)

### Invalid State Transitions
**Issue**: No validation when changing state
- `dmaState` can be set directly
- Register changes during active transfer not validated

**Action**:
1. Make `dmaState` private, add `setDmaState()` with validation
2. Add `isTransferActive()` helper
3. Validate critical register writes reject during active transfer

## Code Readability

### Duplicate Transfer Length Logic
**Issue**: Same calculation 6 times (lines 926, 950, 1214, 1264, 1292, 1328)
```typescript
const bytesToTransfer = this.dmaMode === DmaMode.LEGACY 
  ? this.registers.blockLength + 1 
  : this.registers.blockLength;
```

**Action**:
1. Create `getTransferLength()` method
2. Replace all 6 occurrences

### Duplicate Bytes Transferred Logic
**Issue**: Same calculation 3 times (lines 933-939, 967-973, 1279-1285)
```typescript
const bytesTransferred = this.dmaMode === DmaMode.LEGACY && this.transferState.byteCounter === 0xFFFF
  ? 0
  : this.dmaMode === DmaMode.LEGACY
  ? this.transferState.byteCounter + 1
  : this.transferState.byteCounter;
```

**Action**:
1. Create `getBytesTransferred()` method
2. Replace all 3 occurrences

### Magic Numbers
**Issue**: Hardcoded values throughout
- `3500000`, `875000` (prescalar calculation - 3 occurrences)
- `0xFFFF`, `0x7f`, `0x40`, etc. (bit masks)
- Status byte patterns `0x36`, `0x1a`

**Action**:
1. Define constants at top:
   - `CPU_BASE_FREQ = 3500000`
   - `PRESCALAR_REF_FREQ = 875000`
   - `STATUS_COMPLETE = 0x36`
   - `STATUS_ACTIVE = 0x1a`
   - `LEGACY_COUNTER_INIT = 0xFFFF`
2. Replace all occurrences

### Register Write Sequence State Machine
**Issue**: 16-state enum with sequential integer values
- Hard to understand flow from values
- No grouping by register

**Action**:
1. Group states: `WR0_BASE`, `WR0_ADDR_LO`, `WR0_ADDR_HI`, `WR0_LEN_LO`, `WR0_LEN_HI`
2. Use constants: `WR0_STATES = { BASE: 1, ADDR_LO: 2, ... }`
3. Document expected sequence in comments

### Method Organization
**Issue**: 1386 lines, methods not grouped logically
- Command execution methods scattered (lines 587-748)
- Read/write cycles far apart (lines 1030, 1109)
- Helper methods mixed with public API

**Action**:
1. Group by category with section comments:
   - Public API (write/read port methods)
   - Command Execution (all `execute*` methods)
   - Transfer Engine (stepDma, perform*, update*)
   - Bus Arbitration (request/release/acknowledge)
   - State Queries (all getters)
   - Helper Methods (private utilities)
2. Move related methods adjacent

### Direction Flag Confusion
**Issue**: `directionAtoB` boolean requires mental flip
- Port A vs Port B not intuitive
- Source/destination clearer

**Action**:
1. Add computed properties:
   ```typescript
   get sourcePort() { return this.registers.directionAtoB ? 'A' : 'B'; }
   get sourceAddress() { return this.registers.directionAtoB 
     ? this.registers.portAStartAddress 
     : this.registers.portBStartAddress; }
   ```
2. Use throughout instead of ternary checks

### Comments vs Self-Documenting Code
**Issue**: Over-commenting obvious code
- Line 1169: `// Increment byte counter (16-bit with wraparound)` before simple `+1 & 0xFFFF`
- Lines 926-928: 3-line comment for 2-line ternary

**Action**:
1. Remove comments that restate code
2. Keep only non-obvious comments (legacy mode reasoning, hardware behavior)
3. Move complex logic to named helper methods

## Execution Steps

### Phase 1: Extract Methods (No Behavior Change)
1. Extract `getTransferLength()`
2. Extract `getBytesTransferred()`
3. Extract `shouldContinueTransfer()`
4. Run tests: 548 passing

### Phase 2: Cache Calculations
1. Add `cachedTransferLength` field, set in `executeEnableDma()`
2. Add `cachedBankAttributes` field, set in `executeLoad()`
3. Update `calculateDmaTransferTiming()` to use cache
4. Run tests: 548 passing

### Phase 3: Optimize Address Updates
1. Create `incrementSource/Dest()`, `decrementSource/Dest()` methods
2. Add function pointer fields to `TransferState`
3. Set pointers in `executeLoad()` based on address modes
4. Replace `updateAddress()` calls with function pointers
5. Run tests: 548 passing

### Phase 4: Replace Magic Numbers
1. Define constants
2. Replace all occurrences
3. Run tests: 548 passing

### Phase 5: Improve Bus State
1. Create `BusState` enum
2. Replace boolean flags with enum
3. Update all bus methods
4. Run tests: 548 passing

### Phase 6: Reorganize Code
1. Reorder methods by category (maintain line-for-line equivalence)
2. Add section headers
3. Run tests: 548 passing

### Phase 7: Add Validation
1. Add state transition validation
2. Add overflow detection
3. Add transfer size limits
4. Run tests: 548+ passing (new validation tests)

## Success Metrics
- **Performance**: 10-15% faster stepDma() execution
- **Stability**: Zero state corruption bugs in validation
- **Readability**: 30% fewer lines, grouped logically
- **Maintainability**: All magic numbers named, duplicated code eliminated
