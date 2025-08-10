import { describe, test, expect, beforeEach, vi } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";
import { M6510Cpu } from "@emu/m6510/M6510Cpu";

/**
 * Tests for CPU stalling behavior during instruction fetch, memory read, and memory write operations.
 * These tests verify that the 6510 CPU correctly handles being stalled by the VIC-II chip.
 */
describe("M6510 - CPU Stalling", () => {
  let machine: M6510TestMachine;

  beforeEach(() => {
    machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.tactIncrementHandler = undefined;
  });

  test("should stall and release CPU correctly", () => {
    // --- Arrange
    // Initialize CPU with a simple NOP instruction
    machine.initCode([0xea], 0x1000, 0x1000);
    
    // Stall the CPU
    machine.cpu.stallCpu();
    expect(machine.cpu.stalled).toBe(1);
    
    // Release the CPU
    machine.cpu.releaseCpu();
    expect(machine.cpu.stalled).toBe(0);
  });
  
  test("should always set stalled value to 1 regardless of multiple calls", () => {
    // Stall the CPU twice
    machine.cpu.stallCpu();
    machine.cpu.stallCpu(); // This will set _stalled to 1 again, not increment it
    expect(machine.cpu.stalled).toBe(1); // The expected value is 1
    
    // Release once, should be fully released
    machine.cpu.releaseCpu();
    expect(machine.cpu.stalled).toBe(0);
  });

  test("tactIncrementHandler should be called during instruction execution", () => {
    // --- Arrange
    machine.initCode([0xea], 0x1000, 0x1000); // Single NOP instruction
    
    // Set up a handler to count tacts and manage stalling
    let handlerCallCount = 0;
    machine.tactIncrementHandler = (cpu: M6510Cpu) => {
      handlerCallCount++;
      // Always release CPU if it's stalled to prevent hanging
      if (cpu.stalled) {
        cpu.releaseCpu();
      }
    };
    
    // --- Act
    machine.run();
    
    // --- Assert
    expect(handlerCallCount).toBeGreaterThan(0); // Handler should have been called
    expect(machine.cpu.pc).toBe(0x1001); // Should have executed the NOP
  });

  test("should use tactIncrementHandler to control stalling during execution", () => {
    // --- Arrange
    // Setup a simple store operation: LDA #$42, STA $2000
    machine.initCode([0xa9, 0x42, 0x8d, 0x00, 0x20], 0x1000, 0x1000);
    
    // Setup a flag to track if we ever stalled the CPU
    let wasEverStalled = false;
    
    // Setup tact increment handler to stall the CPU during execution
    // and release it automatically to prevent hanging
    machine.tactIncrementHandler = (cpu: M6510Cpu) => {
      // Stall the CPU on the first instruction
      if (cpu.pc === 0x1000 && !cpu.stalled) {
        cpu.stallCpu();
        wasEverStalled = true;
      }
      
      // Always release the CPU if stalled to avoid test hanging
      if (cpu.stalled) {
        cpu.releaseCpu();
      }
    };
    
    // --- Act
    // Run the first instruction (LDA #$42)
    machine.run();
    
    // Run the second instruction (STA $2000)
    machine.run();
    
    // --- Assert
    expect(machine.readMemory(0x2000)).toBe(0x42); // Store should have happened
    expect(wasEverStalled).toBe(true); // CPU should have been stalled
  });

  test("should eventually release CPU after numerous CPU cycles", () => {
    // --- Arrange
    // Initialize code to ensure the CPU runs
    machine.initCode([0xea], 0x1000, 0x1000); // NOP instruction
    
    // Setup tracking variables
    let tactCount = 0;
    
    // Clear any previous stalled state
    while (machine.cpu.stalled > 0) {
      machine.cpu.releaseCpu();
    }
    
    // Stall the CPU
    machine.cpu.stallCpu();
    expect(machine.cpu.stalled).toBe(1);
    
    // Set up a handler to count tact increments while stalled
    machine.tactIncrementHandler = (cpu: M6510Cpu) => {
      if (cpu.stalled > 0) {
        tactCount++;
      }
    };
    
    // --- Act
    // Execute waitForCpuRelease in a loop to simulate many tact increments
    for (let i = 0; i < 1100; i++) {
      if (machine.cpu.stalled === 0) break; // Exit once CPU is released
      
      // Call incrementTacts directly to make sure onTactIncremented is triggered
      (machine.cpu as any).incrementTacts();
      
      // Every 100 tacts, check if CPU is still stalled
      if (i % 100 === 0 && machine.cpu.stalled > 0) {
        machine.cpu.waitForCpuRelease();
      }
    }
    
    // --- Assert
    expect(machine.cpu.stalled).toBe(0); // CPU should be released automatically
    expect(tactCount).toBeGreaterThan(900); // Should have tracked tacts while stalled
  });
});
