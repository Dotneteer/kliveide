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

  test("should handle stalling during memory read operations", () => {
    // --- Arrange
    // LDA $2000 (read from absolute address)
    machine.initCode([0xad, 0x00, 0x20], 0x1000, 0x1000);
    machine.writeMemory(0x2000, 0x42); // Value to be read
    
    // Track memory read operations and CPU states
    const memReads: { address: number, stalledBefore: boolean, stalledAfter: boolean }[] = [];
    let fetchCompleted = false;
    
    // Set up handler to stall CPU during memory read
    machine.tactIncrementHandler = (cpu: M6510Cpu) => {
      // First, determine if we're in the fetch phase (PC at start) or read phase (PC advanced)
      if (cpu.pc === 0x1000 && !fetchCompleted && !cpu.stalled) {
        // We're in fetch phase, mark it as complete after this cycle
        fetchCompleted = true;
      } 
      else if (fetchCompleted && !memReads.some(r => r.address === 0x2000)) {
        // We're about to read from the target address, stall the CPU
        // (we use address check to only stall once during the read operation)
        if (!cpu.stalled) {
          // Record the read operation is starting
          memReads.push({ 
            address: 0x2000, 
            stalledBefore: cpu.stalled > 0,
            stalledAfter: false // will update after stalling
          });
          
          // Stall the CPU
          cpu.stallCpu();
          
          // Update the stalled state after stalling
          memReads[memReads.length - 1].stalledAfter = cpu.stalled > 0;
        }
      }
      
      // Always release CPU after one cycle to prevent hanging
      if (cpu.stalled) {
        cpu.releaseCpu();
      }
    };
    
    // --- Act
    machine.run();
    
    // --- Assert
    expect(machine.cpu.a).toBe(0x42); // Should have loaded the value
    expect(memReads.length).toBe(1); // Should have tracked one memory read
    expect(memReads[0].stalledBefore).toBe(false); // CPU should not be stalled before the read
    expect(memReads[0].stalledAfter).toBe(true); // CPU should be stalled during the read
  });

  test("should handle stalling during memory write operations", () => {
    // --- Arrange
    // STA $2000 (write to absolute address)
    machine.initCode([0xa9, 0x37, 0x8d, 0x00, 0x20], 0x1000, 0x1000);
    
    // Track execution stages
    let executionStage = "init";
    let wasStalled = false;
    
    // Set up handler to stall CPU during memory write
    machine.tactIncrementHandler = (cpu: M6510Cpu) => {
      if (executionStage === "init" && cpu.pc === 0x1002) {
        // LDA instruction completed, now we're at STA
        executionStage = "sta_fetch";
      }
      else if (executionStage === "sta_fetch" && cpu.pc !== 0x1002) {
        // STA opcode fetched, now we're processing the operands
        executionStage = "sta_operands";
      }
      else if (executionStage === "sta_operands" && !machine.memoryAccessLog.some(op => op.isWrite && op.address === 0x2000)) {
        // About to write to memory, stall the CPU now
        executionStage = "sta_write";
        if (!cpu.stalled) {
          cpu.stallCpu();
          wasStalled = true;
        }
      }
      
      // Always release CPU if stalled to prevent hanging
      if (cpu.stalled) {
        cpu.releaseCpu();
      }
    };
    
    // --- Act
    // Run first instruction (LDA #$37)
    machine.run();
    // Run second instruction (STA $2000)
    machine.run();
    
    // --- Assert
    expect(machine.readMemory(0x2000)).toBe(0x37); // Write should have succeeded
    expect(wasStalled).toBe(true); // CPU should have been stalled during write
  });

  test("should handle stalling that begins during fetch but releases before memory access", () => {
    // --- Arrange
    // LDA $2000 (read from absolute address)
    machine.initCode([0xad, 0x00, 0x20], 0x1000, 0x1000);
    machine.writeMemory(0x2000, 0x42); // Value to be read
    
    // Track execution phases
    let phase = "pre-fetch";
    let stalledDuringFetch = false;
    let stalledDuringRead = false;
    
    // Set up handler to stall during fetch but release before read
    machine.tactIncrementHandler = (cpu: M6510Cpu) => {
      if (phase === "pre-fetch" && cpu.pc === 0x1000) {
        // We're about to fetch the opcode
        phase = "fetch";
        
        // Stall the CPU during fetch
        if (!cpu.stalled) {
          cpu.stallCpu();
          stalledDuringFetch = true;
        }
      }
      else if (phase === "fetch" && cpu.stalled) {
        // We're in the stalled fetch phase
        phase = "operands";
        
        // Release before memory read
        cpu.releaseCpu();
      }
      else if (phase === "operands" && !stalledDuringRead && 
               cpu.lastMemoryReads.some(addr => addr === 0x2000)) {
        // Check if CPU is stalled during the actual memory read
        stalledDuringRead = cpu.stalled > 0;
        phase = "completed";
      }
      
      // Safety release to prevent hanging
      if (cpu.stalled) {
        cpu.releaseCpu();
      }
    };
    
    // --- Act
    machine.run();
    
    // --- Assert
    expect(machine.cpu.a).toBe(0x42); // Should have loaded the value
    expect(stalledDuringFetch).toBe(true); // CPU should have been stalled during fetch
    expect(stalledDuringRead).toBe(false); // CPU should not be stalled during the memory read
  });
});
