# Z80 CPU Performance Benchmark Tests

This directory contains performance benchmark tests for the Z80 CPU emulation. These tests are designed to:

1. Establish a performance baseline for the Z80 CPU implementation
2. Test a wide variety of Z80 instructions
3. Measure execution speed in terms of T-states per millisecond and instructions per millisecond

## Benchmarks Included

### General Performance Benchmark
This test runs a synthetic benchmark program with a mix of instructions that simulate real workloads.
It includes memory operations, arithmetic, bit manipulation, and loop control.

### Instruction Mix Benchmark
This test specifically focuses on executing every type of Z80 instruction at least once:
- Standard 8-bit operations
- 16-bit operations
- Memory operations
- Bit manipulation (CB prefix)
- IX/IY indexed operations (DD/FD prefix)
- Extended instructions (ED prefix)

## Running the Tests

To run these performance tests:

```bash
npx vitest run test/z80/z80-performance.test.ts
```

The tests will output detailed performance metrics to the console, including:
- Execution time in milliseconds
- Total T-states executed
- T-states per millisecond (higher is better)
- Estimated instructions executed
- Estimated instructions per millisecond

## Using as a Baseline

When making optimizations to the Z80 CPU implementation, run these tests before and after your changes to measure the performance impact.

## Adjusting Test Duration

The test duration can be adjusted by modifying the `ITERATIONS`, `OUTER_LOOPS`, or `INNER_LOOPS` constants in the test file. If you need the tests to complete more quickly, reduce these values. For more accurate results on faster machines, increase these values.

## Notes

- Performance results will vary between different machines and environments
- These tests are designed to complete in under one minute on most systems
- The tests include verification of final CPU state to ensure the emulation is correct
