import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { performance } from "perf_hooks";

// Set a quick timeout - this test should be fast
describe("Z80 CPU Minimal Test", { timeout: 5000 }, () => {
  it("should execute a simple halt instruction", () => {
    // Create test machine with UntilHalt mode
    const m = new Z80TestMachine(RunMode.UntilHalt);

    // Ultra simple program: just load a value in A and halt
    const program = [
      0x3E, 0x42,  // LD A, 0x42
      0x76         // HALT
    ];

    // Initialize and run
    m.initCode(program);
    m.cpu.pc = 0;
    
    // Run the program
    m.run();
    
    // Verify
    expect(m.cpu.halted).toBe(true);
    expect(m.cpu.a).toBe(0x42);
    console.log("Minimal test completed successfully!");
  });
});
