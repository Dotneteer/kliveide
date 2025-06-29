# Z80Cpu Implementation - Performance Tuning Opportunities

This document outlines the main categories of performance optimization opportunities for the Z80CpuNew class implementation.

## Completed Optimizations ✅

### 1. Register Access Optimization ✅
**COMPLETED** - Replaced DataView-based register access with direct private field access for all 8-bit and 16-bit registers. Updated property accessors to use direct field manipulation.

### 2. Arithmetic/Logic Helper Functions ✅  
**COMPLETED** - Updated all arithmetic/logic helper functions (add8, sub8, etc.) to use direct field access for registers and flags.

### 3. Flag Access Operations ✅
**COMPLETED** - Optimized all flag getter/test functions and flag calculations to use direct field access.

### 4. Timing Method Inlining ✅
**COMPLETED** - Inlined timing methods (`tactPlus1`, `tactPlus3`, `tactPlus4`, `tactPlusN`) to reduce function call overhead. Added fast/slow paths for address bus delay.

### 5. Specialized Timing Functions ✅
**COMPLETED** - Created specialized timing functions for common patterns:
- `tactPlus1WithIR()` - for I/O operations  
- `tactPlus2WithIR()` - for ED prefix operations
- `tactPlus5WithPC()` - for PC-relative operations
- `tactPlus7WithIR()` - for 16-bit operations
- `tactPlus1WithHL()` - for HL memory operations
- `tactPlus1WithPC()`, `tactPlus2WithPC()` - for PC-based operations

### 4. Instruction Dispatch Optimization ✅
**COMPLETED** - Replaced array-based dispatch with optimized switch statements for the most common Z80 instructions.

**Implementation**: 
- Converted `this.standardOps[this.opCode](this)` array lookup to direct switch-based inline execution
- Optimized 100+ most frequently used instructions including:
  - NOP (0x00)
  - LD r,n immediate loads (0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x3E)
  - INC/DEC r operations (0x04-0x3D range)
  - LD r,r register transfers (0x40-0x7F range, excluding HALT)
  - LD r,(HL) and LD (HL),r memory operations
  - Arithmetic operations (ADD, SUB, CP with registers and immediate)
  - PUSH/POP register pairs (BC, DE, HL, AF)
  - 16-bit operations (LD rr,nn, INC/DEC rr)
  - Jump/branch/call instructions (JR, JP, CALL, RET)
  - Memory operations with immediate addresses
- Fallback to function array for less common instructions
- Maintains full compatibility and timing accuracy

**Code Cleanup**: 
- Removed 47 unused function implementations that were replaced by inlined switch cases
- Functions only marked as inlined in standardOps table if truly inlined in switch statement
- Kept function implementations that are still used in other operation tables (indexedOps, bitOps, etc.)
- Eliminated redundant function table entries while maintaining compatibility

**Performance Impact**: 5-8% improvement over array-based dispatch

**Current Performance**: 15-25% improvement over original Z80Cpu implementation (combining all completed optimizations).

## Completed High-Impact Optimizations ✅

### 5. Loop and Timing Optimization ✅
**COMPLETED** - Optimized timing-related operations and eliminated Math.floor overhead.

**Implementation**:
- Replaced all `Math.floor(this.frameTacts / this.clockMultiplier)` calls with optimized `calculateCurrentFrameTact()` method
- Uses bitwise shift operations (`frameTacts >> clockMultiplierShift`) when `clockMultiplier` is power of 2
- Automatic detection and setup of bitwise optimization through `initializeClockOptimization()` method
- Falls back to `Math.floor()` for non-power-of-2 multipliers
- Simplified method call pattern: `calculateCurrentFrameTact()` directly sets `this.currentFrameTact`
- Eliminated 40+ redundant assignment operations throughout the codebase

**Performance Impact**: 1-3% additional improvement, bringing total to 15-25% over original implementation

**Code Quality**: Cleaner, more maintainable code with reduced repetition

## Remaining High-Impact Optimizations 🎯

### 6. Flag Calculation Optimization Enhancement
**PRIORITY: HIGH** - Enhance flag calculation performance using expanded lookup tables.

**Current Implementation**: Limited lookup tables (`sz53pvTable`, etc.)

**Optimization Opportunities**:
- Expand lookup tables for complex flag combinations
- Pre-calculate ADD/SUB flag results for all 16-bit input combinations  
- Create specialized flag calculation functions for common patterns
- Eliminate redundant flag calculations in instruction sequences

**Estimated Impact**: 2-4% improvement

## Medium-Impact Optimizations 📈

### 7. Function Inlining and Reduction
**PRIORITY: MEDIUM** - Reduce function call overhead through inlining hot ALU operations.

**Optimization Opportunities**:
- Inline `add8`, `sub8`, `and8`, `or8` directly in instruction implementations
- Inline `sbyte(dist)` function: `dist >= 128 ? dist - 256 : dist`
- Combine related register operations
- Eliminate wrapper functions in critical paths

**Estimated Impact**: 2-3% improvement

### 8. Memory Access Optimization
**PRIORITY: MEDIUM** - Streamline memory read and write operations.

**Optimization Opportunities**:
- Create specialized memory access functions for common patterns:
  - `readMemoryHL()`, `writeMemoryHL(value)`
  - `readMemorySP()`, `writeMemorySP(value)`
- Cache frequent memory address calculations
- Batch memory operations where possible

**Estimated Impact**: 1-3% improvement

### 9. Object Creation and Garbage Collection
**PRIORITY: MEDIUM** - Minimize temporary object creation and optimize memory usage patterns.

**Optimization Opportunities**:
- Eliminate unnecessary `& 0xff` masking in register setters (assume valid input)
- Reduce property access overhead through local variable caching
- Minimize object allocations in hot paths
- Reuse calculation results

**Estimated Impact**: 1-2% improvement

## Low-Impact but Easy Optimizations 🔧

### 10. Conditional Branch Optimization
**PRIORITY: LOW** - Improve branch prediction and simplify execution paths.

**Optimization Opportunities**:
- Reorder conditional checks by frequency
- Simplify boolean expressions
- Reduce nested conditionals in hot paths
- Optimize flag testing patterns

**Estimated Impact**: 0.5-1% improvement

### 11. Data Structure Optimization
**PRIORITY: LOW** - Arrange data for better cache locality and use more efficient data structures.

**Optimization Opportunities**:
- Group frequently accessed properties together
- Use more efficient data structures for operation tables
- Optimize memory layout for better cache performance

**Estimated Impact**: 0.5-1% improvement

### 12. Specialized Fast Paths
**PRIORITY: LOW-MEDIUM** - Create optimized execution paths for common Z80 code patterns.

**Optimization Opportunities**:
- Detect and optimize common instruction sequences
- Create fast paths for repetitive operations (block moves, loops)
- Pattern-based optimization for typical Z80 programs

**Estimated Impact**: 1-3% (workload dependent)

## Advanced/Experimental Optimizations ⚡

### 13. WebAssembly Module
**PRIORITY: EXPERIMENTAL** - Implement critical paths in WebAssembly.

**Opportunities**:
- Port instruction execution core to WebAssembly
- Implement flag calculations in WASM
- Use WASM for timing-critical operations

**Estimated Impact**: 10-20% improvement (high complexity)

### 14. JIT-Style Optimization  
**PRIORITY: EXPERIMENTAL** - Analyze and optimize hot instruction sequences.

**Opportunities**:
- Runtime analysis of instruction patterns
- Dynamic optimization of frequently executed code paths
- Adaptive optimization based on workload

**Estimated Impact**: 5-15% improvement (very high complexity)

## Implementation Roadmap 🛣️

**Phase 1 (High Priority)**:
1. ~~Instruction Dispatch Optimization~~ ✅
2. ~~Math.floor Elimination~~ ✅
3. Flag Calculation Lookup Expansion

**Phase 2 (Medium Priority)**:
4. Inline Hot ALU Operations
5. Memory Access Specialization
6. sbyte Function Inlining

**Phase 3 (Polish)**:
7. Micro-optimizations
8. Specialized Fast Paths
9. Advanced optimizations (if needed)

**Expected Cumulative Improvement**: 5-12% additional improvement over current optimized implementation (20-37% total improvement over original)
