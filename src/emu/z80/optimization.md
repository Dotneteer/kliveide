# Z80 CPU Emulator Performance Optimization Opportunities

## Register Access Optimization

### Issue: Getter/Setter Overhead
Every register pair (AF, BC, DE, HL, IX, IY, WZ) uses getters/setters that split/combine bytes:
```typescript
get bc(): number { return (this._b << 8) | this._c; }
set bc(value: number) { 
  this._b = (value >> 8) & 0xff;
  this._c = value & 0xff;
}
```
Called thousands of times per frame with bit operations on every access.

**Impact**: High frequency operations (register reads/writes happen in nearly every instruction)

**Optimization**: 
- Store register pairs as single 16-bit values alongside 8-bit views
- Use typed arrays (Uint8Array + Uint16Array with shared buffer) for zero-copy access
- Cache frequently accessed values within instruction execution

### Issue: Redundant Masking
Individual 8-bit register setters mask with `& 0xff` even though TypeScript/JavaScript handles this:
```typescript
set a(value: number) { this._a = value & 0xff; }
```

**Impact**: Medium (called on every 8-bit register write)

**Optimization**: Remove masking in setters; ensure proper masking only at operation boundaries

## Memory Access Pattern

### Issue: Array Indirection for Last Operations
Tracking arrays rebuilt on every instruction:
```typescript
lastMemoryReads: number[] = [];
lastMemoryWrites: number[] = [];
```

**Impact**: Medium (allocation churn, GC pressure)

**Optimization**: 
- Use fixed-size circular buffers
- Only track when debugging is active
- Use bit flags instead of arrays where possible

## Lookup Table Access

### Issue: Function Table Indirection
Four operation tables (`standardOps`, `bitOps`, `indexedOps`, `indexedBitOps`) with 256 entries each of function pointers.

**Impact**: Medium (indirect call overhead on every instruction)

**Optimization**:
- Inline frequently used operations
- Use switch statements for hot paths
- Profile to identify most common opcodes and optimize those

## Timing and Clock Management

### Issue: Repetitive Contention Checks
Functions like `tactPlus4WithAddress` repeat the same pattern:
```typescript
tactPlus4WithAddress(address: number): void {
  if (this.delayedAddressBus) this.delayAddressBusAccess(address);
  this.tactPlus1();
  if (this.delayedAddressBus) this.delayAddressBusAccess(address);
  this.tactPlus1();
  // ... repeated 4 times
}
```

**Impact**: High (called extensively during instruction execution)

**Optimization**: 
- Unroll loops and optimize for common case (delayedAddressBus === false)
- Use branch prediction hints
- Combine tact increments where possible

### Issue: Frame Tact Calculation
Every tact increment recalculates frame state:
```typescript
tactPlusN(n: number): void {
  this.tacts += n;
  this.frameTacts += n;
  if (this.frameTacts >= this.tactsInCurrentFrame) { /* ... */ }
  this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
  this.onTactIncremented();
}
```

**Impact**: Very High (called hundreds of times per instruction cycle)

**Optimization Details**:

#### 1. Fast Path for Common Case (clockMultiplier === 1)
Create specialized version that avoids division:
```typescript
tactPlusN(n: number): void {
  this.tacts += n;
  this.frameTacts += n;
  
  // Fast path: no clock multiplier
  if (this.clockMultiplier === 1) {
    this.currentFrameTact = this.frameTacts;
    if (this.frameTacts >= this.tactsInCurrentFrame) {
      this.frames++;
      this.frameTacts -= this.tactsInCurrentFrame;
      this.currentFrameTact = this.frameTacts;
      this.frameCompleted = true;
    }
    if (this.onTactIncrementedEnabled) {
      this.onTactIncremented();
    }
    return;
  }
  
  // Slow path for multiplier != 1
  // ... existing code
}
```

#### 2. Defer Frame Completion Check
Frame completion is rare relative to tact increments. Check only when close to boundary:
```typescript
tactPlusN(n: number): void {
  this.tacts += n;
  const newFrameTacts = this.frameTacts + n;
  this.frameTacts = newFrameTacts;
  
  // Only check frame completion if we might have crossed boundary
  if (newFrameTacts >= this.tactsInCurrentFrame) {
    this.frames++;
    this.frameTacts = newFrameTacts - this.tactsInCurrentFrame;
    this.frameCompleted = true;
  }
  
  // Defer this calculation or make it lazy
  this.currentFrameTact = this.frameTacts; // when clockMultiplier === 1
}
```

#### 3. Batch Increment Variants
Replace individual `tactPlus1()` calls with direct increments:
```typescript
// Instead of:
tactPlus4WithAddress(address: number): void {
  if (this.delayedAddressBus) this.delayAddressBusAccess(address);
  this.tactPlus1();  // 4 separate calls to tactPlusN(1)
  if (this.delayedAddressBus) this.delayAddressBusAccess(address);
  this.tactPlus1();
  // ... repeated
}

// Use:
tactPlus4WithAddress(address: number): void {
  if (this.delayedAddressBus) {
    // Handle all contention in one loop
    for (let i = 0; i < 4; i++) {
      this.delayAddressBusAccess(address);
      this.tactPlusN(1);
    }
  } else {
    // Fast path: no contention, single increment
    this.tactPlusN(4);
  }
}
```

#### 4. Conditional onTactIncremented
Only call callback when actually needed (e.g., for screen rendering):
```typescript
// Add flag to enable/disable
private onTactIncrementedEnabled = false;

tactPlusN(n: number): void {
  this.tacts += n;
  this.frameTacts += n;
  
  // ... frame completion check
  
  // Only invoke if enabled
  if (this.onTactIncrementedEnabled) {
    this.onTactIncremented();
  }
}
```

#### 5. Optimize tactPlus1/3/4 Variants
Create truly optimized versions instead of delegating to tactPlusN:
```typescript
// Direct implementation instead of calling tactPlusN(1)
tactPlus1(): void {
  this.tacts++;
  const ft = ++this.frameTacts;
  if (ft >= this.tactsInCurrentFrame) {
    this.frames++;
    this.frameTacts = ft - this.tactsInCurrentFrame;
    this.frameCompleted = true;
  }
  // Skip currentFrameTact calculation if not needed
}

tactPlus3(): void {
  this.tacts += 3;
  const ft = this.frameTacts += 3;
  if (ft >= this.tactsInCurrentFrame) {
    this.frames++;
    this.frameTacts = ft - this.tactsInCurrentFrame;
    this.frameCompleted = true;
  }
}
```

#### 6. Lazy currentFrameTact Update
Only calculate when actually read:
```typescript
private _frameTacts: number;
private _currentFrameTactDirty = true;
private _currentFrameTact: number;

get currentFrameTact(): number {
  if (this._currentFrameTactDirty) {
    this._currentFrameTact = Math.floor(this._frameTacts / this.clockMultiplier);
    this._currentFrameTactDirty = false;
  }
  return this._currentFrameTact;
}

tactPlusN(n: number): void {
  this.tacts += n;
  this._frameTacts += n;
  this._currentFrameTactDirty = true; // Mark for recalculation
  // ... rest of logic without calculating currentFrameTact
}
```

**Estimated Impact**: 20-30% reduction in tactPlusN overhead, potentially 5-10% overall emulation speedup

## Flag Calculation

### Issue: Table Lookups vs. Direct Calculation
Flag operations use pre-computed tables (`sz53Table`, `incFlags`, `decFlags`, `parityTable`) which is good, but table access has overhead.

**Impact**: Medium

**Optimization**:
- Ensure tables are monomorphic (always same shape)
- Consider WebAssembly for ALU operations
- Cache flag calculation results when possible

## Operation Implementation

### Issue: Repeated Pattern Matching
Main execution loop has nested switch on prefix:
```typescript
switch (this.prefix) {
  case OpCodePrefix.None:
    // Another switch on opCode
  case OpCodePrefix.CB:
    // ...
}
```

**Impact**: Medium

**Optimization**:
- Use computed goto pattern (combined prefix+opcode index)
- Flatten common cases
- Profile to identify hot instruction sequences

## String/Number Conversions

### Issue: Signed Byte Conversion
`sbyte()` function called for every relative jump:
```typescript
function sbyte(dist: number): number {
  return dist >= 128 ? dist - 256 : dist;
}
```

**Impact**: Low-Medium

**Optimization**: Use Int8Array view for automatic sign extension

## Method Call Overhead

### Issue: Deep Call Chains
Instruction execution → operation function → core method → register setter/getter

**Impact**: Medium-High

**Optimization**:
- Inline critical paths
- Reduce abstraction layers for hot operations
- Use direct field access in performance-critical code

## Memory Allocation

### Issue: Step-Out Stack Management
Array operations in hot path:
```typescript
pushToStepOutStack(returnAddress: number): void {
  this.stepOutStack.push(returnAddress);
  if (this.stepOutStack.length > MAX_STEP_OUT_STACK_SIZE) {
    this.stepOutStack.shift();  // O(n) operation
  }
}
```

**Impact**: Low-Medium (only during CALL/RST instructions)

**Optimization**: Use circular buffer instead of array shift

## Type Optimization

### Issue: Number Type Usage
JavaScript numbers are 64-bit floats; bitwise operations convert to 32-bit integers internally.

**Impact**: Low (V8 optimizes this well)

**Optimization**: 
- Use TypedArrays where beneficial
- Ensure integer fast paths are hit
- Avoid mixing integer and float operations

## Recommendations Priority

### High Priority
1. ~~Optimize `tactPlusN` and related timing methods~~ **[TESTED - CAUSED REGRESSION]**
2. ~~Reduce register getter/setter overhead via typed arrays~~ **[TESTED - NO GAIN]**
3. Skip debug tracking when not debugging
4. Optimize frame completion check

**Note on #1**: The timing method optimizations were implemented but caused performance regression. The added branch complexity and code duplication likely interfered with JavaScript JIT optimization. The original simple delegation pattern performs better.

**Note on #2**: TypedArray-based register implementation showed no performance improvement over simple number fields with bit operations. Modern JavaScript engines already optimize the getter/setter pattern effectively, and the overhead of array indexing likely negates any benefit from eliminating bit shifts.

### Medium Priority
5. Flatten operation dispatch mechanism
6. Inline hot instruction implementations
7. Optimize address bus access checks
8. Cache flag values where possible

### Low Priority
9. Use circular buffer for step-out stack
10. Optimize sbyte conversion
11. Reduce memory allocation in debug paths

## Profiling Recommendations

Before implementing optimizations:
1. Profile with real workloads (games, demos)
2. Identify hottest instructions (likely: LD, INC/DEC, JR/JP, CALL/RET)
3. Measure impact of each optimization
4. Consider JIT-friendly patterns (monomorphic types, predictable branches)
5. Test on multiple JavaScript engines (V8, SpiderMonkey, JavaScriptCore)
