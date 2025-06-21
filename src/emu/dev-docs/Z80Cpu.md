# Z80 CPU Implementation

This document describes the implementation details of the Z80 CPU emulator in the Klive IDE project.

## Overview

The Z80 CPU implementation in `Z80Cpu.ts` provides a cycle-accurate emulation of the Zilog Z80 processor. The implementation focuses on:

1. Accurate register and flag behavior
2. Correct instruction timing
3. High performance through optimization
4. Memory and I/O interfacing

## Register Implementation

### Optimized TypedArray Pattern

The Z80 CPU registers are implemented using JavaScript's TypedArray (Uint8Array) for maximum performance. This approach provides:

- Fast direct access to 8-bit registers
- Optimized register access with minimal overhead
- Elimination of DataView-based access overhead

```typescript
// Register implementation using TypedArray
private _registers = new Uint8Array(16);   // 8-bit register array

// Register offsets in the array
private static REG_A = 0;
private static REG_F = 1;
private static REG_B = 2;
// ... other registers
```

### Register Access

Registers are accessed through direct array indexing or through getters and setters for clarity:

```typescript
// 8-bit register direct access example
this._registers[Z80Cpu.REG_A] = value;

// 8-bit register access through getter/setter
get a(): number {
  return this._registers[Z80Cpu.REG_A];
}
set a(value: number) {
  this._registers[Z80Cpu.REG_A] = value;
}

// 16-bit register access example
get bc(): number {
  return this._registers[Z80Cpu.REG_B] << 8 | this._registers[Z80Cpu.REG_C];
}
set bc(value: number) {
  this._registers[Z80Cpu.REG_B] = value >> 8;
  this._registers[Z80Cpu.REG_C] = value & 0xFF;
}
```

### Benefits of this Approach

1. **Maximum Performance**: Direct Uint8Array access is faster than DataView or property access
2. **Reduced Overhead**: Eliminates unnecessary function calls and type conversions
3. **JIT-Friendly**: Better optimization in JavaScript engines

## Instruction Execution

The CPU executes instructions in the `executeCpuCycle()` method, which handles:

1. Instruction fetch
2. Decoding and execution
3. Timing (T-state counting)
4. Interrupt handling

## Instruction Execution Strategy

The Z80 CPU emulator uses a comprehensive optimization strategy to maximize performance:

### 1. Extensive Fast Path Inlining

The most common instructions are directly inlined in the main execution switch statement rather than dispatched via function tables. This eliminates function call overhead, which is particularly important in JavaScript.

```typescript
// Fast path for common instructions to minimize function call overhead
switch (this.opCode) {
  // 0x00: NOP - most common instruction
  case 0x00:
    break;
    
  // 0x3E: LD A,N - very common for loading immediate values
  case 0x3E:
    this._registers[Z80Cpu.REG_A] = this.fetchCodeByte();
    break;
    
  // 0xAF: XOR A - commonly used to clear A register
  case 0xAF:
    this._registers[Z80Cpu.REG_A] = 0;
    this._registers[Z80Cpu.REG_F] = sz53pvTable[0];
    break;
    
  // Use the function table for less common operations
  default:
    this.standardOps[this.opCode](this);
    break;
}
```

### 2. Extended Instructions Inlining

ED-prefixed instructions are extensively optimized using the same inlining approach. A wide range of extended instructions including:

- NEG, RETN, RETI instructions
- Interrupt mode setting instructions
- 16-bit arithmetic and logic operations
- Block transfer operations (LDI, LDIR, LDD, LDDR)
- Block comparison operations (CPI, CPIR, CPD, CPDR)
- Register exchange and transfer instructions (LD A,I; LD A,R; etc.)
- I/O operations (IN, OUT, block I/O)

```typescript
case OpCodePrefix.ED:
  this.tacts++;
  this.opCode = this.fetchCodeByte();
  
  switch (this.opCode) {
    // 0x44: NEG - negate accumulator
    case 0x44:
      const oldA = this._registers[Z80Cpu.REG_A];
      this._registers[Z80Cpu.REG_A] = 0;
      this.sub8(oldA);
      break;
      
    // 0x57: LD A,I
    case 0x57:
      this.tactPlus1();
      this._registers[Z80Cpu.REG_A] = this.i;
      this._registers[Z80Cpu.REG_F] = (this._registers[Z80Cpu.REG_F] & FlagsSetMask.C) | 
                                      sz53Table[this.i] | 
                                      (this.iff2 ? FlagsSetMask.PV : 0);
      break;
      
    // Many more extended instructions...
      
    default:
      this.getExtendedOpsTable()[this.opCode](this);
      break;
  }
  break;
```

### 3. Comprehensive Lookup Tables

Pre-calculated lookup tables are used for almost all common operations to avoid redundant flag calculations at runtime:

```typescript
// Flag calculation tables
const sz53Table: number[] = new Array(256);       // S, Z, 5, and 3 flags for each value
const sz53pvTable: number[] = new Array(256);     // S, Z, 5, 3, and P/V flags for parity
const incTable: number[] = new Array(256);        // INC operation flags
const decTable: number[] = new Array(256);        // DEC operation flags

// Rotate and shift operation tables
const rlcTable: number[] = new Array(256);        // RLC result value lookup
const rrcTable: number[] = new Array(256);        // RRC result value lookup
const rlTable: number[] = new Array(0x200);       // RL result lookup with carry input 
const rrTable: number[] = new Array(0x200);       // RR result lookup with carry input

// Flag result tables for rotate operations
const rlcFlagTable: number[] = new Array(256);    // RLC flag results
const rrcFlagTable: number[] = new Array(256);    // RRC flag results  
const rlFlagTable: number[] = new Array(0x200);   // RL flags with carry input
const rrFlagTable: number[] = new Array(0x200);   // RR flags with carry input

// Arithmetic operation flag tables
const addFlagTable: number[][] = Array.from(      // ADD operation flags
  {length: 256}, () => new Array(256)); 
const subFlagTable: number[][] = Array.from(      // SUB operation flags
  {length: 256}, () => new Array(256));
const cpFlagTable: number[][] = Array.from(       // CP operation flags
  {length: 256}, () => new Array(256));

// Block operations flag tables
const ldiLddrFlagTable: number[] = new Array(0x10000);  // LDI/LDDR flags
```

These tables are initialized during CPU creation and directly used in the instruction implementations:

```typescript
// Using lookup tables in rotate instructions
this._registers[Z80Cpu.REG_F] = rlcFlagTable[value];
value = rlcTable[value];

// Using lookup tables in arithmetic operations
const operValue = this._registers[Z80Cpu.REG_C];
const a = this._registers[Z80Cpu.REG_A];
this._registers[Z80Cpu.REG_F] = addFlagTable[a][operValue];
this._registers[Z80Cpu.REG_A] = (a + operValue) & 0xFF;

// Using lookup tables in block operations
tmpValue = (this.a + ldiValue) & 0xFF;
this._registers[Z80Cpu.REG_F] = (this._registers[Z80Cpu.REG_F] & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
                                ldiLddrFlagTable[(bc << 8) | tmpValue];
```

### 4. Block Operations Implementation

Block transfer instructions (LDIR, LDDR, CPIR, etc.) are implemented without batching to preserve debugging capabilities. Each iteration of these operations correctly represents the CPU state, allowing for accurate debugging:

```typescript
// 0xB0: LDIR - load, increment, repeat
case 0xB0: {
  // Single iteration implementation to preserve debugging
  const ldiValue = this.readMemory(this.hl);
  this.writeMemory(this.de, ldiValue);
  this.tactPlus2WithAddress(this.de);
  
  // Update registers
  this.hl = (this.hl + 1) & 0xFFFF;
  this.de = (this.de + 1) & 0xFFFF;
  this.bc = (this.bc - 1) & 0xFFFF;
  
  // Use lookup table for optimized flag calculation
  const tmpValue = (this.a + ldiValue) & 0xFF;
  this._registers[Z80Cpu.REG_F] = (this._registers[Z80Cpu.REG_F] & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
                                  ldiLddrFlagTable[(this.bc << 8) | tmpValue];
  
  // Handle repeat logic
  if (this.bc !== 0) {
    this.pc = (this.pc - 2) & 0xFFFF;
    this.tactPlus5();
  }
  break;
}
```

This multi-faceted optimization strategy significantly improves performance by:

- Eliminating function call overhead in hot paths
- Using pre-calculated lookup tables to avoid complex runtime flag calculations
- Improving JIT compiler optimizations with predictable code paths
- Enhancing instruction cache locality
- Maintaining full debugging capabilities

## Memory Access

Memory access is optimized and abstracted through methods that allow different memory models:

```typescript
// Read from memory - called on hot paths
readMemory(address: number): number {
  return this.memoryDevice.read(address);
}

// Write to memory - called on hot paths
writeMemory(address: number, value: number): void {
  this.memoryDevice.write(address, value);
}
```

## Block Operations Implementation

Block transfer instructions (LDIR, LDDR, CPIR, etc.) are important for Z80 performance but need special consideration for debugging:

### Block Transfer Implementation Strategy

1. **Debugging-Friendly Approach**:
   - Block operations are NOT batched
   - Each iteration runs separately with correct CPU state
   - This preserves step-by-step debugging capabilities
   - All register updates happen on each iteration

2. **Performance Optimizations**:
   - Lookup tables are used for flag calculations
   - Direct register access minimizes overhead
   - Proper timing is preserved with T-state counting

```typescript
// Optimized flag computation for block operations
tmpValue = (this.a + value) & 0xFF;
this._registers[Z80Cpu.REG_F] = (this._registers[Z80Cpu.REG_F] & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
                                ldiLddrFlagTable[(this.bc << 8) | tmpValue];
```

> **Note**: The current implementation prioritizes debugging capabilities over maximum raw performance for block operations. Each iteration correctly represents the CPU state for step-by-step debugging while still using lookup tables for optimized flag calculations.

## Performance Optimization Summary

The Z80 CPU implementation employs multiple optimization techniques to maximize performance:

### 1. Register Access Optimization
- Replaced DataView-based register access with direct Uint8Array access
- Eliminated unnecessary function call overhead for register access
- Used direct array indexing in hot paths

### 2. Instruction Execution Optimization
- Inlined most common instructions in the main execution switch
- Inlined ED-prefixed instructions to avoid function dispatch overhead
- Optimized the execution path for prefixed instructions (CB, DD, FD)

### 3. Flag Calculation Optimization
- Implemented comprehensive lookup tables for flag calculations
- Pre-calculated all possible flag outcomes for:
  - Rotate and shift operations (RLC, RRC, RL, RR)
  - Arithmetic operations (ADD, SUB, CP)
  - Bit operations
  - Block instruction flag calculations
- Eliminated complex bit manipulation during execution

### 4. Memory Access Pattern
- Maintained abstraction while optimizing the critical path
- Ensured consistent interface for memory and I/O operations

### 5. Testing and Validation
- All optimizations are thoroughly tested
- Full Z80 test suite validates correctness
- Preserved cycle-accurate timing

These optimizations significantly improve performance while maintaining complete accuracy and compatibility with the Z80 instruction set.
