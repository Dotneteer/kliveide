# Z80 CPU Performance Benchmark Tests

This directory contains performance benchmark tests for the Z80 CPU emulation. These tests are designed to:

1. Establish a performance baseline for both Z80Cpu and Z80CpuNew implementations
2. Test a comprehensive mix of Z80 instructions
3. Measure execution speed in terms of T-states per millisecond
4. Compare performance between the original Z80Cpu and the new Z80CpuNew implementation

## Comprehensive Benchmark

The main performance test (`z80-performance.test.ts`) executes a synthetic benchmark program for both Z80Cpu and Z80CpuNew implementations that:

- Runs 10 iterations of a comprehensive instruction mix
- Executes almost every Z80 instruction category at least once
- Implements loop control using the Z80's own instructions
- Verifies correct execution through final register state validation

### Instruction Categories Covered

The benchmark includes a thorough mix of:

- **8-bit load and exchange operations** - Register loads, memory transfers, exchanges
- **16-bit load operations** - Register pair loads, stack operations
- **8-bit arithmetic and logic** - ADD, ADC, SUB, SBC, AND, OR, XOR, CP, INC, DEC, DAA
- **16-bit arithmetic** - ADD HL,rr, INC/DEC register pairs
- **Rotate and shift instructions** - RLC, RRC, RL, RR, SLA, SRA, SRL, SWAP (Z80 Next)
- **Bit manipulation** - BIT, SET, RES operations on registers and memory
- **Stack operations** - PUSH/POP register pairs
- **IX/IY indexed operations** - All major variants with displacement
- **CB prefix operations** - All primary bit, rotate and shift operations
- **DDCB/FDCB prefix operations** - Indexed bit manipulation
- **ED prefix instructions** - Block operations, extended arithmetic

## Running the Tests

To run the performance benchmark:

```bash
npx vitest run test/z80/z80-performance.test.ts
```

The test outputs detailed metrics to the console:
- Execution time in milliseconds
- Total T-states executed
- T-states per millisecond (higher is better)
- T-states per iteration

## Using for Performance Comparison

The benchmark tests both the original Z80Cpu and the new Z80CpuNew implementations, allowing direct comparison:

1. Both tests run the same comprehensive instruction mix
2. The console output shows metrics for each implementation separately
3. Compare the T-states per millisecond metric to evaluate relative performance

When optimizing either Z80 CPU implementation:

1. Run the benchmark with the current implementations
2. Make your optimization changes
3. Run the benchmark again
4. Compare the T-states per millisecond metric for both implementations

## Notes

- The benchmark is designed to complete in under 10 seconds on most systems
- Memory areas are carefully segregated to prevent self-modification issues
- The test has a built-in verification that all iterations completed successfully
- Performance results will vary between different machines and environments
