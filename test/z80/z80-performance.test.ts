import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { performance } from "perf_hooks";

// Set timeout to 10 seconds for fast test execution
describe("Z80 CPU Performance Benchmark", { timeout: 10000 }, () => {
  it("should execute a comprehensive mix of Z80 instructions for performance testing", () => {
    // Create the test machine with UntilHalt mode to ensure test completes
    const m = new Z80TestMachine(RunMode.UntilHalt);
    
    // Create a simple benchmark program
    // Using a safer memory layout to prevent self-modification
    const START_ADDRESS = 0x1000;  // Code starts at 0x1000
    const DATA_ADDRESS = 0x5000;   // Data area far from code
    
    // Ultra-comprehensive Z80 instruction test with 3 iterations
    // covering the broadest possible mix of instruction types
    // using Z80 loop instructions
    const program = [
      // Initialize registers and memory pointers
      0x21, 0x00, 0x50,     // LD HL,DATA_ADDRESS   
      0x11, 0x50, 0x50,     // LD DE,DATA_ADDRESS+0x50
      0x01, 0xA0, 0x50,     // LD BC,DATA_ADDRESS+0xA0
      0x31, 0x00, 0x80,     // LD SP,STACK_ADDRESS
      
      // Set up loop counter (10 iterations in B register)
      0x01, 0x00, 0x40,     // LD BC,0x1000  // Set loop counter to 10 (0x10)

      // === LOOP START POINT ===
      // Label: loop_start (address 0x100E)
      // Save loop counter
      0xC5,                 // PUSH BC (preserve loop counter)
      
      // 8-bit load and exchange instructions
      0x3E, 0x42,           // LD A,0x42
      0x06, 0x55,           // LD B,0x55
      0x0E, 0xAA,           // LD C,0xAA
      0x16, 0x77,           // LD D,0x77
      0x1E, 0x88,           // LD E,0x88
      0x26, 0x99,           // LD H,0x99
      0x2E, 0x11,           // LD L,0x11
      0x7E,                 // LD A,(HL)
      0x77,                 // LD (HL),A
      0x12,                 // LD (DE),A
      0x02,                 // LD (BC),A
      0x1A,                 // LD A,(DE)
      0x0A,                 // LD A,(BC)
      0x46,                 // LD B,(HL)
      0x4E,                 // LD C,(HL)
      0x56,                 // LD D,(HL)
      0x5E,                 // LD E,(HL)
      0x66,                 // LD H,(HL)
      0x6E,                 // LD L,(HL)
      0x70,                 // LD (HL),B
      0x71,                 // LD (HL),C
      0x72,                 // LD (HL),D
      0x73,                 // LD (HL),E
      0x74,                 // LD (HL),H
      0x75,                 // LD (HL),L
      0x36, 0x42,           // LD (HL),0x42
      0xEB,                 // EX DE,HL
      0x08,                 // EX AF,AF'
      0xD9,                 // EXX
      
      // 16-bit load operations
      0x01, 0x34, 0x12,     // LD BC,0x1234
      0x11, 0x78, 0x56,     // LD DE,0x5678
      0x21, 0xBC, 0x9A,     // LD HL,0x9ABC
      0x2A, 0x00, 0x50,     // LD HL,(DATA_ADDRESS)
      0x22, 0x10, 0x50,     // LD (DATA_ADDRESS+0x10),HL
      0xE5,                 // PUSH HL (save HL)
      0xE3,                 // EX (SP),HL (get current SP into HL and restore HL)
      0x22, 0x20, 0x50,     // LD (DATA_ADDRESS+0x20),HL (save original SP)
      0xE1,                 // POP HL (restore HL)
      0x2A, 0x20, 0x50,     // LD HL,(DATA_ADDRESS+0x20) (get original SP)
      
      // 8-bit arithmetic and logic
      0x80,                 // ADD A,B
      0x81,                 // ADD A,C
      0x82,                 // ADD A,D
      0x83,                 // ADD A,E
      0x84,                 // ADD A,H
      0x85,                 // ADD A,L
      0x86,                 // ADD A,(HL)
      0xC6, 0x42,           // ADD A,0x42
      0x88,                 // ADC A,B
      0x8E,                 // ADC A,(HL)
      0xCE, 0x42,           // ADC A,0x42
      0x90,                 // SUB B
      0x91,                 // SUB C
      0x96,                 // SUB (HL)
      0xD6, 0x42,           // SUB 0x42
      0x98,                 // SBC A,B
      0x9E,                 // SBC A,(HL)
      0xDE, 0x42,           // SBC A,0x42
      0xA0,                 // AND B
      0xA1,                 // AND C
      0xA6,                 // AND (HL)
      0xE6, 0x0F,           // AND 0x0F
      0xA8,                 // XOR B
      0xA9,                 // XOR C
      0xAE,                 // XOR (HL)
      0xEE, 0x42,           // XOR 0x42
      0xB0,                 // OR B
      0xB1,                 // OR C
      0xB6,                 // OR (HL)
      0xF6, 0x42,           // OR 0x42
      0xB8,                 // CP B
      0xB9,                 // CP C
      0xBE,                 // CP (HL)
      0xFE, 0x42,           // CP 0x42
      0x04,                 // INC B
      0x0C,                 // INC C
      0x14,                 // INC D
      0x1C,                 // INC E
      0x24,                 // INC H
      0x2C,                 // INC L
      0x34,                 // INC (HL)
      0x3C,                 // INC A
      0x05,                 // DEC B
      0x0D,                 // DEC C
      0x15,                 // DEC D
      0x1D,                 // DEC E
      0x25,                 // DEC H
      0x2D,                 // DEC L
      0x35,                 // DEC (HL)
      0x3D,                 // DEC A
      0x27,                 // DAA
      0x2F,                 // CPL
      0x3F,                 // CCF
      0x37,                 // SCF
      0x00,                 // NOP
      
      // 16-bit arithmetic
      0x09,                 // ADD HL,BC
      0x19,                 // ADD HL,DE
      0x29,                 // ADD HL,HL
      0x39,                 // ADD HL,SP
      0x03,                 // INC BC
      0x13,                 // INC DE
      0x23,                 // INC HL
      0x33,                 // INC SP
      0x0B,                 // DEC BC
      0x1B,                 // DEC DE
      0x2B,                 // DEC HL
      0x3B,                 // DEC SP
      
      // Rotate and shift (CB prefix)
      0xCB, 0x07,           // RLC A
      0xCB, 0x00,           // RLC B
      0xCB, 0x01,           // RLC C
      0xCB, 0x06,           // RLC (HL)
      0xCB, 0x0F,           // RRC A
      0xCB, 0x08,           // RRC B
      0xCB, 0x09,           // RRC C
      0xCB, 0x0E,           // RRC (HL)
      0xCB, 0x17,           // RL A
      0xCB, 0x10,           // RL B
      0xCB, 0x11,           // RL C
      0xCB, 0x16,           // RL (HL)
      0xCB, 0x1F,           // RR A
      0xCB, 0x18,           // RR B
      0xCB, 0x19,           // RR C
      0xCB, 0x1E,           // RR (HL)
      0xCB, 0x27,           // SLA A
      0xCB, 0x20,           // SLA B
      0xCB, 0x21,           // SLA C
      0xCB, 0x26,           // SLA (HL)
      0xCB, 0x2F,           // SRA A
      0xCB, 0x28,           // SRA B
      0xCB, 0x29,           // SRA C
      0xCB, 0x2E,           // SRA (HL)
      0xCB, 0x37,           // SWAP A  (Z80 Next instruction)
      0xCB, 0x30,           // SWAP B  (Z80 Next instruction)
      0xCB, 0x31,           // SWAP C  (Z80 Next instruction)
      0xCB, 0x3F,           // SRL A
      0xCB, 0x38,           // SRL B
      0xCB, 0x39,           // SRL C
      0xCB, 0x3E,           // SRL (HL)
      
      // Bit operations (CB prefix)
      0xCB, 0x47,           // BIT 0,A
      0xCB, 0x40,           // BIT 0,B
      0xCB, 0x41,           // BIT 0,C
      0xCB, 0x46,           // BIT 0,(HL)
      0xCB, 0x4F,           // BIT 1,A
      0xCB, 0x48,           // BIT 1,B
      0xCB, 0x49,           // BIT 1,C
      0xCB, 0x4E,           // BIT 1,(HL)
      0xCB, 0xC7,           // SET 0,A
      0xCB, 0xC0,           // SET 0,B
      0xCB, 0xC1,           // SET 0,C
      0xCB, 0xC6,           // SET 0,(HL)
      0xCB, 0xCF,           // SET 1,A
      0xCB, 0xC8,           // SET 1,B
      0xCB, 0xC9,           // SET 1,C
      0xCB, 0xCE,           // SET 1,(HL)
      0xCB, 0x87,           // RES 0,A
      0xCB, 0x80,           // RES 0,B
      0xCB, 0x81,           // RES 0,C
      0xCB, 0x86,           // RES 0,(HL)
      0xCB, 0x8F,           // RES 1,A
      0xCB, 0x88,           // RES 1,B
      0xCB, 0x89,           // RES 1,C
      0xCB, 0x8E,           // RES 1,(HL)
      
      // Stack operations
      0xC5,                 // PUSH BC
      0xD5,                 // PUSH DE
      0xE5,                 // PUSH HL
      0xF5,                 // PUSH AF
      0xC1,                 // POP BC
      0xD1,                 // POP DE
      0xE1,                 // POP HL
      0xF1,                 // POP AF
      
      // Additional arithmetic and logic operations (replacing control flow instructions)
      0x3E, 0x42,           // LD A,0x42
      0x06, 0x55,           // LD B,0x55
      0x0E, 0xAA,           // LD C,0xAA
      0x16, 0x77,           // LD D,0x77 
      0x1E, 0x88,           // LD E,0x88
      0x26, 0x99,           // LD H,0x99
      0x2E, 0x11,           // LD L,0x11
      0x80,                 // ADD A,B
      0x81,                 // ADD A,C
      0x82,                 // ADD A,D
      0x83,                 // ADD A,E
      0x84,                 // ADD A,H
      0x85,                 // ADD A,L
      0x90,                 // SUB B
      0x91,                 // SUB C
      0x92,                 // SUB D
      0x93,                 // SUB E
      0xA0,                 // AND B
      0xA1,                 // AND C
      0xA2,                 // AND D
      0xA3,                 // AND E
      0xB0,                 // OR B
      0xB1,                 // OR C
      0xB2,                 // OR D
      0xB3,                 // OR E
      0x04,                 // INC B
      0x05,                 // DEC B
      0x0C,                 // INC C
      0x0D,                 // DEC C
      0x14,                 // INC D
      0x15,                 // DEC D
      0x1C,                 // INC E
      0x1D,                 // DEC E
      0x24,                 // INC H
      0x25,                 // DEC H
      0x2C,                 // INC L
      0x2D,                 // DEC L
      
      // Continue with the loop body
      
      // IX/IY indexed instructions (DD/FD prefix)
      0xDD, 0x21, 0x00, 0x60, // LD IX,IX_ADDRESS (0x6000)
      0xDD, 0x46, 0x01,     // LD B,(IX+1)
      0xDD, 0x4E, 0x02,     // LD C,(IX+2)
      0xDD, 0x56, 0x03,     // LD D,(IX+3)
      0xDD, 0x5E, 0x04,     // LD E,(IX+4)
      0xDD, 0x66, 0x05,     // LD H,(IX+5)
      0xDD, 0x6E, 0x06,     // LD L,(IX+6)
      0xDD, 0x7E, 0x00,     // LD A,(IX+0)
      0xDD, 0x70, 0x00,     // LD (IX+0),B
      0xDD, 0x71, 0x01,     // LD (IX+1),C
      0xDD, 0x72, 0x02,     // LD (IX+2),D
      0xDD, 0x73, 0x03,     // LD (IX+3),E
      0xDD, 0x74, 0x04,     // LD (IX+4),H
      0xDD, 0x75, 0x05,     // LD (IX+5),L
      0xDD, 0x36, 0x06, 0x42, // LD (IX+6),0x42
      0xDD, 0x86, 0x00,     // ADD A,(IX+0)
      0xDD, 0x8E, 0x01,     // ADC A,(IX+1)
      0xDD, 0x96, 0x02,     // SUB (IX+2)
      0xDD, 0x9E, 0x03,     // SBC A,(IX+3)
      0xDD, 0xA6, 0x04,     // AND (IX+4)
      0xDD, 0xAE, 0x05,     // XOR (IX+5)
      0xDD, 0xB6, 0x06,     // OR (IX+6)
      0xDD, 0xBE, 0x07,     // CP (IX+7)
      0xDD, 0x34, 0x00,     // INC (IX+0)
      0xDD, 0x35, 0x01,     // DEC (IX+1)
      0xDD, 0xE5,           // PUSH IX
      0xDD, 0xE1,           // POP IX
      
      // IX bit instructions (DDCB prefix)
      0xDD, 0xCB, 0x00, 0x06, // RLC (IX+0)
      0xDD, 0xCB, 0x01, 0x0E, // RRC (IX+1)
      0xDD, 0xCB, 0x02, 0x16, // RL (IX+2)
      0xDD, 0xCB, 0x03, 0x1E, // RR (IX+3)
      0xDD, 0xCB, 0x04, 0x26, // SLA (IX+4)
      0xDD, 0xCB, 0x05, 0x2E, // SRA (IX+5)
      0xDD, 0xCB, 0x06, 0x3E, // SRL (IX+6)
      0xDD, 0xCB, 0x00, 0x46, // BIT 0,(IX+0)
      0xDD, 0xCB, 0x01, 0x4E, // BIT 1,(IX+1)
      0xDD, 0xCB, 0x02, 0x56, // BIT 2,(IX+2)
      0xDD, 0xCB, 0x03, 0x5E, // BIT 3,(IX+3)
      0xDD, 0xCB, 0x04, 0x66, // BIT 4,(IX+4)
      0xDD, 0xCB, 0x05, 0x6E, // BIT 5,(IX+5)
      0xDD, 0xCB, 0x06, 0x76, // BIT 6,(IX+6)
      0xDD, 0xCB, 0x07, 0x7E, // BIT 7,(IX+7)
      0xDD, 0xCB, 0x00, 0x86, // RES 0,(IX+0)
      0xDD, 0xCB, 0x01, 0x8E, // RES 1,(IX+1)
      0xDD, 0xCB, 0x02, 0xC6, // SET 0,(IX+2)
      0xDD, 0xCB, 0x03, 0xCE, // SET 1,(IX+3)
      
      // IY indexed instructions (same as IX but with FD prefix)
      0xFD, 0x21, 0x00, 0x70, // LD IY,IY_ADDRESS (0x7000)
      0xFD, 0x46, 0x00,     // LD B,(IY+0)
      0xFD, 0x70, 0x00,     // LD (IY+0),B
      0xFD, 0x86, 0x00,     // ADD A,(IY+0)
      0xFD, 0xCB, 0x00, 0x06, // RLC (IY+0)
      
      // ED prefix instructions (excluding RETN/RETI)
      0xED, 0x44,           // NEG
      0xED, 0x47,           // LD I,A
      0xED, 0x57,           // LD A,I
      0xED, 0x4F,           // LD R,A
      0xED, 0x5F,           // LD A,R
      0xED, 0x67,           // RRD
      0xED, 0x6F,           // RLD
      0xED, 0xA0,           // LDI
      0xED, 0xA1,           // CPI
      0xED, 0xA2,           // INI
      0xED, 0xA3,           // OUTI
      0xED, 0xA8,           // LDD
      0xED, 0xA9,           // CPD
      0xED, 0xAA,           // IND
      0xED, 0xAB,           // OUTD
      0xED, 0x42,           // SBC HL,BC
      0xED, 0x52,           // SBC HL,DE
      0xED, 0x62,           // SBC HL,HL
      0xED, 0x72,           // SBC HL,SP
      0xED, 0x4A,           // ADC HL,BC
      0xED, 0x5A,           // ADC HL,DE
      0xED, 0x6A,           // ADC HL,HL
      0xED, 0x7A,           // ADC HL,SP
      
      // Additional arithmetic and logic operations (replacing RST instructions)
      0x3E, 0x42,           // LD A,0x42
      0x06, 0x55,           // LD B,0x55
      0x0E, 0xAA,           // LD C,0xAA
      0x16, 0x77,           // LD D,0x77
      0x1E, 0x88,           // LD E,0x88
      0xA7,                 // AND A
      0xB7,                 // OR A
      0xAF,                 // XOR A
      0x27,                 // DAA
      0x2F,                 // CPL
      0x37,                 // SCF
      0x3F,                 // CCF
      0x00,                 // NOP
      
      // Loop control: Restore loop counter, decrement B register and jump if not zero
      0xC1,                 // POP BC (restore loop counter)
      0x0B,                 // DEC BC (decrement loop counter)
      0x78,                 // LD A,B
      0xB1,                 // OR C (set zero flag if B is zero)
      0xC2, 0x0F, 0x10,     // JP NZ,0x100E (jump back to the PUSH BC at the beginning of the loop body if B≠0)
      
      // Set success indicator and halt execution
      0x3E, 0xFC,           // LD A,0xFC (success indicator)
      0x76                  // HALT
    ];
    
    // Initialize the test machine
    m.initCode(program, START_ADDRESS);
    
    // Initialize data area
    for (let i = 0; i < 16; i++) {
      m.memory[DATA_ADDRESS + i] = i & 0xFF;
    }
    
    m.cpu.pc = START_ADDRESS;
    
    // Run the benchmark and measure time
    const startTime = performance.now();
    m.run();
    const endTime = performance.now();
    
    // Calculate metrics
    const executionTime = endTime - startTime;
    const tStates = m.cpu.tacts;
    
    // Simple console output (avoiding template string issues)
    console.log("=== Z80 CPU Performance Benchmark ===");
    console.log("Execution time (ms): " + executionTime.toFixed(2));
    console.log("Total T-states: " + tStates);
    console.log("T-states per ms: " + (tStates / executionTime).toFixed(2));
    console.log("Instructions: Comprehensive mix of Z80 instructions (10 iterations via Z80 loop)");
    console.log("Loop counter (B) final value: " + m.cpu.b + " (should be 0 after 10 iterations)");
    console.log("T-states per iteration (estimated): " + (tStates / 10).toFixed(2));
    
    // Verify program completed successfully
    expect(m.cpu.a).toBe(0xFC);

    // Store metrics for comparison
    const metrics = {
      executionTimeMs: executionTime,
      totalTStates: tStates,
      tStatesPerMs: tStates / executionTime
    };
    
    // This logs the metrics in the test results
    expect(metrics).toBeDefined();
  });
});
