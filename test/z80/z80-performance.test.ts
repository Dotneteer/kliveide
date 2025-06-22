import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { performance } from "perf_hooks";

// Set timeout to 10 seconds for fast test execution
describe("Z80 CPU Performance Benchmark", { timeout: 10000 }, () => {
  it("should execute a comprehensive mix of Z80 instructions for performance testing", () => {
    // Create the test machine with UntilHalt mode to ensure test completes
    const m = new Z80TestMachine(RunMode.UntilHalt);
    
    // Create a simple benchmark program
    const START_ADDRESS = 0x1000;
    const DATA_ADDRESS = 0x3000;
    const STACK_ADDRESS = 0x8000;
    
    // Ultra-comprehensive Z80 instruction test with a single iteration
    // covering the broadest possible mix of instruction types
    const program = [
      // Initialize registers and memory pointers
      0x21, 0x00, 0x30,     // LD HL,DATA_ADDRESS   
      0x11, 0x00, 0x40,     // LD DE,0x4000
      0x01, 0x34, 0x12,     // LD BC,0x1234
      0x31, 0x00, 0x80,     // LD SP,STACK_ADDRESS
      
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
      0x31, 0x00, 0x80,     // LD SP,0x8000
      0x2A, 0x00, 0x30,     // LD HL,(0x3000)
      0x22, 0x10, 0x30,     // LD (0x3010),HL
      0xF9,                 // LD SP,HL
      
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
      
      // Jump instructions
      0x18, 0x02,           // JR +2
      0x00,                 // NOP (should be skipped)
      0x00,                 // NOP (should be skipped)
      0x28, 0x00,           // JR Z,0 (shouldn't jump if Z=0)
      0x20, 0x02,           // JR NZ,+2 (should jump if Z=0)
      0x00,                 // NOP (might be skipped)
      0x00,                 // NOP (might be skipped)
      0x30, 0x00,           // JR NC,0 (shouldn't jump if C=0)
      0x38, 0x00,           // JR C,0 (shouldn't jump if C=1)
      0xC3, 0x25, 0x11,     // JP 0x1125
      0x00,                 // (padding - shouldn't execute)
      0x00,                 // (padding - shouldn't execute)
      
      // Continue from JP target (address 0x1125)
      0xCA, 0x25, 0x11,     // JP Z,0x1125 (address of this instruction)
      0xC2, 0x30, 0x11,     // JP NZ,0x1130
      0x00,                 // (padding - might be skipped)
      0x00,                 // (padding - might be skipped)
      
      // Continue from conditional JP target (0x1130)
      0xD2, 0x30, 0x11,     // JP NC,0x1130 (address of this instruction)
      0xDA, 0x30, 0x11,     // JP C,0x1130 (address of this instruction)
      0xE2, 0x30, 0x11,     // JP PO,0x1130 (address of this instruction)
      0xEA, 0x30, 0x11,     // JP PE,0x1130 (address of this instruction)
      0xF2, 0x30, 0x11,     // JP P,0x1130 (address of this instruction)
      0xFA, 0x30, 0x11,     // JP M,0x1130 (address of this instruction)
      0xE9,                 // JP (HL)
      
      // Call and return
      0xCD, 0x60, 0x11,     // CALL 0x1160
      0x00,                 // (padding - shouldn't execute during CALL)
      0x00,                 // (padding - shouldn't execute during CALL)
      
      // Return from call and complete
      0x3E, 0xFF,           // LD A,0xFF
      0x76,                 // HALT
      
      // Subroutine at 0x1160
      0x3E, 0x33,           // LD A,0x33
      0x06, 0x44,           // LD B,0x44
      
      // Conditional calls (some will be executed based on flags)
      0xCC, 0x70, 0x11,     // CALL Z,0x1170
      0xC4, 0x70, 0x11,     // CALL NZ,0x1170
      0xDC, 0x70, 0x11,     // CALL C,0x1170
      0xD4, 0x70, 0x11,     // CALL NC,0x1170
      0xF4, 0x70, 0x11,     // CALL P,0x1170
      
      // Conditional returns
      0xC8,                 // RET Z
      0xC0,                 // RET NZ
      0xD8,                 // RET C
      0xD0,                 // RET NC
      0xE8,                 // RET PE
      0xE0,                 // RET PO
      0xF8,                 // RET M
      0xF0,                 // RET P
      
      // Return from main subroutine
      0xC9,                 // RET
      
      // Small subroutine at 0x1170 (for conditional calls)
      0x3E, 0x55,           // LD A,0x55
      
      // IX/IY indexed instructions (DD/FD prefix)
      0xDD, 0x21, 0x00, 0x60, // LD IX,0x6000
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
      0xFD, 0x21, 0x00, 0x70, // LD IY,0x7000
      0xFD, 0x46, 0x00,     // LD B,(IY+0)
      0xFD, 0x70, 0x00,     // LD (IY+0),B
      0xFD, 0x86, 0x00,     // ADD A,(IY+0)
      0xFD, 0xCB, 0x00, 0x06, // RLC (IY+0)
      
      // ED prefix instructions
      0xED, 0x44,           // NEG
      0xED, 0x45,           // RETN
      0xED, 0x4D,           // RETI
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
      0xED, 0xB0,           // LDIR
      0xED, 0xB1,           // CPIR
      0xED, 0xB2,           // INIR
      0xED, 0xB3,           // OTIR
      0xED, 0xB8,           // LDDR
      0xED, 0xB9,           // CPDR
      0xED, 0xBA,           // INDR
      0xED, 0xBB,           // OTDR
      0xED, 0x42,           // SBC HL,BC
      0xED, 0x52,           // SBC HL,DE
      0xED, 0x62,           // SBC HL,HL
      0xED, 0x72,           // SBC HL,SP
      0xED, 0x4A,           // ADC HL,BC
      0xED, 0x5A,           // ADC HL,DE
      0xED, 0x6A,           // ADC HL,HL
      0xED, 0x7A,           // ADC HL,SP
      
      // Reset/restart instructions
      0xC7,                 // RST 0x00
      0xCF,                 // RST 0x08
      0xD7,                 // RST 0x10
      0xDF,                 // RST 0x18
      0xE7,                 // RST 0x20
      0xEF,                 // RST 0x28
      0xF7,                 // RST 0x30
      0xFF,                 // RST 0x38
      
      // Final return
      0xC9                  // RET
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
    console.log("Instructions: Comprehensive mix of all Z80 instruction types (single iteration)");
    
    // Verify program completed successfully
    expect(m.cpu.halted).toBe(true);
    expect(m.cpu.a).toBe(0xFF);
    
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
