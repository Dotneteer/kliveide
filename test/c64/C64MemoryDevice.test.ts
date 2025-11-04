import { C64Machine } from "../../src/emu/machines/c64/C64Machine";
import { describe, expect, it, beforeEach } from "vitest";
import { C64MemoryDevice } from "../../src/emu/machines/c64/C64MemoryDevice";
import { C64IoExpansionDevice } from "../../src/emu/machines/c64/C64IoExpansionDevice";
import { 
  createTestC64Machine, 
  checkBasicRomSignature, 
  checkKernalRomSignature, 
  checkChargenRomSignature,
} from "./test-helper";

describe("C64 - Memory Device", () => {
  let c64: C64Machine;
  let mem: C64MemoryDevice;
  let io: C64IoExpansionDevice;
  
  beforeEach(() => {
    c64 = new C64Machine();
    createTestC64Machine(c64);
    mem = c64.memoryDevice;
    io = c64.ioExpansionDevice;
  });

  it("Reset works", () => {
    // --- Act
    mem.reset();

    // --- Assert
    expect(mem.currentConfig).toBe(0x1f);

    // --- BASIC ROM is paged in
    expect(mem.loram).toBe(true);
    expect(checkBasicRomSignature(mem)).toBe(true);

    // --- KERNAL ROM is paged in
    expect(mem.hiram).toBe(true);
    expect(checkKernalRomSignature(mem)).toBe(true);

    // --- Chargen is not paged in (I/O area is visible)
    expect(mem.chargen).toBe(true);
    expect(checkChargenRomSignature(mem)).toBe(false);
    
    expect(io.gameLine).toBe(true);
    expect(io.exromLine).toBe(true);
  });

  describe("CPU Port Configuration Bits", () => {
    beforeEach(() => {
      // Set CPU port direction to output for bits 0-2 (memory configuration)
      c64.cpuPortDevice.writeDirection(0x07); // Bits 0, 1, 2 as output
    });

    it("LORAM bit controls BASIC ROM visibility", () => {
      // Test LORAM=0 (BASIC ROM disabled)
      c64.cpuPortDevice.writeData(0x06); // HIRAM=1, CHAREN=1, LORAM=0

      expect(mem.loram).toBe(false);
      expect(checkBasicRomSignature(mem)).toBe(false);

      // Test LORAM=1 (BASIC ROM enabled)
      c64.cpuPortDevice.writeData(0x07); // HIRAM=1, CHAREN=1, LORAM=1

      expect(mem.loram).toBe(true);
      expect(checkBasicRomSignature(mem)).toBe(true);
    });

    it("HIRAM bit controls KERNAL ROM visibility", () => {
      // Test HIRAM=0 (KERNAL ROM disabled)
      c64.cpuPortDevice.writeData(0x05); // HIRAM=0, CHAREN=1, LORAM=1

      expect(mem.hiram).toBe(false);
      expect(checkKernalRomSignature(mem)).toBe(false);

      // Test HIRAM=1 (KERNAL ROM enabled)
      c64.cpuPortDevice.writeData(0x07); // HIRAM=1, CHAREN=1, LORAM=1

      expect(mem.hiram).toBe(true);
      expect(checkKernalRomSignature(mem)).toBe(true);
    });

    it("CHAREN bit controls Character ROM vs I/O area", () => {
      // Test CHAREN=0 (Character ROM visible)
      c64.cpuPortDevice.writeData(0x03); // HIRAM=1, CHAREN=0, LORAM=1

      expect(mem.chargen).toBe(false);
      expect(checkChargenRomSignature(mem)).toBe(true);

      // Test CHAREN=1 (I/O area visible, Character ROM hidden)
      c64.cpuPortDevice.writeData(0x07); // HIRAM=1, CHAREN=1, LORAM=1

      expect(mem.chargen).toBe(true);
      expect(checkChargenRomSignature(mem)).toBe(false);
    });

    it("All combinations of LORAM/HIRAM/CHAREN work correctly", () => {
      const testCases = [
        { value: 0x00, loram: false, hiram: false, charen: false, desc: "All ROMs off, CHARGEN visible" },
        { value: 0x01, loram: true,  hiram: false, charen: false, desc: "BASIC on, KERNAL off, CHARGEN visible" },
        { value: 0x02, loram: false, hiram: true,  charen: false, desc: "BASIC off, KERNAL on, CHARGEN visible" },
        { value: 0x03, loram: true,  hiram: true,  charen: false, desc: "Both ROMs on, CHARGEN visible" },
        { value: 0x04, loram: false, hiram: false, charen: true,  desc: "All ROMs off, I/O visible" },
        { value: 0x05, loram: true,  hiram: false, charen: true,  desc: "BASIC on, KERNAL off, I/O visible" },
        { value: 0x06, loram: false, hiram: true,  charen: true,  desc: "BASIC off, KERNAL on, I/O visible" },
        { value: 0x07, loram: true,  hiram: true,  charen: true,  desc: "All ROMs on, I/O visible (standard)" }
      ];

      testCases.forEach(testCase => {
        c64.cpuPortDevice.writeData(testCase.value);

        expect(mem.loram, `LORAM failed for ${testCase.desc}`).toBe(testCase.loram);
        expect(mem.hiram, `HIRAM failed for ${testCase.desc}`).toBe(testCase.hiram);
        expect(mem.chargen, `CHAREN failed for ${testCase.desc}`).toBe(testCase.charen);

        // Check ROM signatures based on configuration
        expect(checkBasicRomSignature(mem), `BASIC ROM signature failed for ${testCase.desc}`).toBe(testCase.loram);
        expect(checkKernalRomSignature(mem), `KERNAL ROM signature failed for ${testCase.desc}`).toBe(testCase.hiram);
        expect(checkChargenRomSignature(mem), `CHARGEN ROM signature failed for ${testCase.desc}`).toBe(!testCase.charen);
      });
    });

    it("CPU port direction register affects memory configuration", () => {
      // Test with bits as inputs (direction = 0) - should read as 1
      c64.cpuPortDevice.writeDirection(0x00); // All bits as input
      c64.cpuPortDevice.writeData(0x00);      // Try to write 0

      // When bits are inputs, they should read as 1 (pulled high)
      expect(mem.loram).toBe(true);
      expect(mem.hiram).toBe(true);
      expect(mem.chargen).toBe(true);

      // Test with bits as outputs (direction = 1) - should use written data
      c64.cpuPortDevice.writeDirection(0x07); // Bits 0-2 as output
      c64.cpuPortDevice.writeData(0x00);      // Write 0

      expect(mem.loram).toBe(false);
      expect(mem.hiram).toBe(false);
      expect(mem.chargen).toBe(false);
    });

    it("Memory configuration updates automatically trigger table rebuilding", () => {
      // Start with standard configuration
      c64.cpuPortDevice.writeData(0x07); // All ROMs enabled
      const initialConfig = mem.currentConfig;
      
      // Change configuration
      c64.cpuPortDevice.writeData(0x04); // All ROMs disabled, I/O visible
      const newConfig = mem.currentConfig;

      // Configuration should have changed
      expect(newConfig).not.toBe(initialConfig);
      expect(mem.loram).toBe(false);
      expect(mem.hiram).toBe(false);
      expect(mem.chargen).toBe(true);

      // Memory reads should reflect new configuration
      expect(checkBasicRomSignature(mem)).toBe(false);
      expect(checkKernalRomSignature(mem)).toBe(false);
    });
  });
});

