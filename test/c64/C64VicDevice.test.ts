import { C64Machine } from "@emu/machines/c64/C64Machine";
import { describe, expect, it, beforeEach } from "vitest";

describe("C64 - VIC-II Device", () => {
  let c64: C64Machine;
  
  beforeEach(() => {
    c64 = new C64Machine();
  });

  it("Reset works with correct default values", () => {
    // --- Act
    const vic = c64.vicDevice;
    vic.reset();

    // --- Assert
    expect(vic).toBeDefined();
    
    // Check that all 47 VIC registers are initialized to 0x00
    expect(vic.registers).toBeDefined();
    expect(vic.registers.length).toBe(0x40); // 47 registers ($D000-$D02E) + filler bytes
    
    for (let i = 0; i < vic.registers.length; i++) {
      expect(vic.registers[i]).toBe(0x00);
    }
    
    // Check that counters are reset to 0
    expect(vic.currentRasterLine).toBe(0);
    expect(vic.currentCycle).toBe(0);
    expect(vic.videoMatrixCounter).toBe(0);
    expect(vic.videoCounterBase).toBe(0);
    
    // Check that composed values are properly initialized
    expect(vic.rasterInterruptLine).toBe(0); // RST8=0 from $d011 + $d012=0
    
    // Check that DMA lines are initialized based on RSEL=0 (24 rows mode)
    // RSEL=0 means 24 rows, so DMA lines should be offset by 4
    expect(vic.firstDmaLine).toBe(vic.configuration.firstDisplayedLine + 4);
    expect(vic.lastDmaLine).toBe(vic.configuration.lastDisplayedLine - 4);
    
    // Check that timing values are properly set from configuration
    expect(vic.rasterLines).toBe(vic.configuration.numRasterLines);
    expect(vic.tactsInDisplayLine).toBe(vic.configuration.cyclesPerLine);
    
    // Check that sprite data is properly initialized
    expect(vic.spriteData).toBeDefined();
    expect(vic.spriteData.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      expect(vic.spriteData[i].enabled).toBe(false);
      expect(vic.spriteData[i].x).toBe(0);
      expect(vic.spriteData[i].y).toBe(0);
      expect(vic.spriteData[i].yExpand).toBe(false);
      expect(vic.spriteData[i].xExpand).toBe(false);
      expect(vic.spriteData[i].color).toBe(0);
      expect(vic.spriteData[i].multicolor).toBe(false);
      expect(vic.spriteData[i].priority).toBe(false);
    }

    // Check that $d016 register fields are properly initialized
    expect(vic.mcm).toBe(false);      // MCM (Multicolor Mode) = 0
    expect(vic.csel).toBe(false);     // CSEL (Column Select) = 0 (38 columns)
    expect(vic.xScroll).toBe(0);      // XSCROLL (Horizontal fine scroll) = 0

    // Check that $d018 memory pointers are properly initialized
    expect(vic.videoMatrixBase).toBe(0x0000);   // VM13-VM10 = 0000
    expect(vic.characterBase).toBe(0x0000);     // CB13-CB11 = 000

    // Check that interrupt system is properly initialized
    expect(vic.interruptLatch).toBe(0x00);      // No interrupts pending
    expect(vic.interruptEnable).toBe(0x00);     // All interrupts disabled

    // Check that sprite priority is properly initialized
    expect(vic.spritePriority).toBe(0x00);      // All sprites behind foreground graphics

    // Check that sprite multicolor is properly initialized
    expect(vic.spriteMulticolor).toBe(0x00);    // All sprites in standard mode (not multicolor)

    // Check that colors are properly initialized
    expect(vic.borderColor).toBe(0x00);         // Border color = black (color index 0)
    expect(vic.backgroundColor0).toBe(0x00);    // Background color 0 = black (color index 0)
    expect(vic.backgroundColor1).toBe(0x00);    // Background color 1 = black (color index 0)
    expect(vic.backgroundColor2).toBe(0x00);    // Background color 2 = black (color index 0)
    expect(vic.backgroundColor3).toBe(0x00);    // Background color 3 = black (color index 0)
  });

  describe("$D011 register tests", () => {
    it("Sets individual bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test RST8 bit (bit 7)
      vic.writeRegister(0x11, 0x80); // RST8=1, all others=0
      expect(vic.rst8).toBe(true);
      expect(vic.ecm).toBe(false);
      expect(vic.bmm).toBe(false);
      expect(vic.den).toBe(false);
      expect(vic.rsel).toBe(false);
      expect(vic.yScroll).toBe(0);
      expect(vic.registers[0x11]).toBe(0x80);

      // --- Test ECM bit (bit 6)
      vic.writeRegister(0x11, 0x40); // ECM=1, all others=0
      expect(vic.rst8).toBe(false);
      expect(vic.ecm).toBe(true);
      expect(vic.bmm).toBe(false);
      expect(vic.den).toBe(false);
      expect(vic.rsel).toBe(false);
      expect(vic.yScroll).toBe(0);
      expect(vic.registers[0x11]).toBe(0x40);

      // --- Test BMM bit (bit 5)
      vic.writeRegister(0x11, 0x20); // BMM=1, all others=0
      expect(vic.rst8).toBe(false);
      expect(vic.ecm).toBe(false);
      expect(vic.bmm).toBe(true);
      expect(vic.den).toBe(false);
      expect(vic.rsel).toBe(false);
      expect(vic.yScroll).toBe(0);
      expect(vic.registers[0x11]).toBe(0x20);

      // --- Test DEN bit (bit 4)
      vic.writeRegister(0x11, 0x10); // DEN=1, all others=0
      expect(vic.rst8).toBe(false);
      expect(vic.ecm).toBe(false);
      expect(vic.bmm).toBe(false);
      expect(vic.den).toBe(true);
      expect(vic.rsel).toBe(false);
      expect(vic.yScroll).toBe(0);
      expect(vic.registers[0x11]).toBe(0x10);

      // --- Test RSEL bit (bit 3)
      vic.writeRegister(0x11, 0x08); // RSEL=1, all others=0
      expect(vic.rst8).toBe(false);
      expect(vic.ecm).toBe(false);
      expect(vic.bmm).toBe(false);
      expect(vic.den).toBe(false);
      expect(vic.rsel).toBe(true);
      expect(vic.yScroll).toBe(0);
      expect(vic.registers[0x11]).toBe(0x08);

      // --- Test YSCROLL bits (bits 2-0)
      vic.writeRegister(0x11, 0x07); // YSCROLL=7, all others=0
      expect(vic.rst8).toBe(false);
      expect(vic.ecm).toBe(false);
      expect(vic.bmm).toBe(false);
      expect(vic.den).toBe(false);
      expect(vic.rsel).toBe(false);
      expect(vic.yScroll).toBe(7);
      expect(vic.registers[0x11]).toBe(0x07);
    });

    it("Sets multiple bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test common configuration: DEN=1, RSEL=1, YSCROLL=3
      vic.writeRegister(0x11, 0x1B); // 00011011 binary
      expect(vic.rst8).toBe(false);
      expect(vic.ecm).toBe(false);
      expect(vic.bmm).toBe(false);
      expect(vic.den).toBe(true);
      expect(vic.rsel).toBe(true);
      expect(vic.yScroll).toBe(3);
      expect(vic.registers[0x11]).toBe(0x1B);

      // --- Test all bits set
      vic.writeRegister(0x11, 0xFF); // All bits on
      expect(vic.rst8).toBe(true);
      expect(vic.ecm).toBe(true);
      expect(vic.bmm).toBe(true);
      expect(vic.den).toBe(true);
      expect(vic.rsel).toBe(true);
      expect(vic.yScroll).toBe(7);
      expect(vic.registers[0x11]).toBe(0xFF);
    });

    it("RSEL bit affects DMA lines correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Initial state: RSEL=0 (24 rows), DMA lines should be offset by 4
      expect(vic.rsel).toBe(false);
      expect(vic.firstDmaLine).toBe(vic.configuration.firstDisplayedLine + 4);
      expect(vic.lastDmaLine).toBe(vic.configuration.lastDisplayedLine - 4);

      // --- Set RSEL=1 (25 rows), DMA lines should use full display area
      vic.writeRegister(0x11, 0x08); // RSEL=1
      expect(vic.rsel).toBe(true);
      expect(vic.firstDmaLine).toBe(vic.configuration.firstDisplayedLine);
      expect(vic.lastDmaLine).toBe(vic.configuration.lastDisplayedLine);

      // --- Clear RSEL=0 again, DMA lines should be offset by 4 again
      vic.writeRegister(0x11, 0x00); // RSEL=0
      expect(vic.rsel).toBe(false);
      expect(vic.firstDmaLine).toBe(vic.configuration.firstDisplayedLine + 4);
      expect(vic.lastDmaLine).toBe(vic.configuration.lastDisplayedLine - 4);
    });

    it("RST8 bit affects raster interrupt line correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Initial state: RST8=0, $d012=0, interrupt line should be 0
      expect(vic.rst8).toBe(false);
      expect(vic.registers[0x12]).toBe(0);
      expect(vic.rasterInterruptLine).toBe(0);

      // --- Set RST8=1, interrupt line should be 256
      vic.writeRegister(0x11, 0x80); // RST8=1
      expect(vic.rst8).toBe(true);
      expect(vic.rasterInterruptLine).toBe(256);

      // --- Clear RST8=0, interrupt line should return to 0
      vic.writeRegister(0x11, 0x00); // RST8=0
      expect(vic.rst8).toBe(false);
      expect(vic.rasterInterruptLine).toBe(0);
    });

    it("Preserves non-modified bits when changing others", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial state
      vic.writeRegister(0x11, 0x1B); // DEN=1, RSEL=1, YSCROLL=3
      expect(vic.den).toBe(true);
      expect(vic.rsel).toBe(true);
      expect(vic.yScroll).toBe(3);

      // --- Change only ECM bit
      vic.writeRegister(0x11, 0x5B); // ECM=1, DEN=1, RSEL=1, YSCROLL=3
      expect(vic.ecm).toBe(true);
      expect(vic.den).toBe(true);
      expect(vic.rsel).toBe(true);
      expect(vic.yScroll).toBe(3);

      // --- Change only YSCROLL
      vic.writeRegister(0x11, 0x5D); // ECM=1, DEN=1, RSEL=1, YSCROLL=5
      expect(vic.ecm).toBe(true);
      expect(vic.den).toBe(true);
      expect(vic.rsel).toBe(true);
      expect(vic.yScroll).toBe(5);
    });
  });

  describe("$D012 register tests", () => {
    it("Sets raster interrupt line lower 8 bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test with RST8=0
      vic.writeRegister(0x12, 0x80); // $d012 = 128
      expect(vic.registers[0x12]).toBe(0x80);
      expect(vic.rasterInterruptLine).toBe(128); // 0 * 256 + 128

      vic.writeRegister(0x12, 0xFF); // $d012 = 255
      expect(vic.registers[0x12]).toBe(0xFF);
      expect(vic.rasterInterruptLine).toBe(255); // 0 * 256 + 255

      vic.writeRegister(0x12, 0x00); // $d012 = 0
      expect(vic.registers[0x12]).toBe(0x00);
      expect(vic.rasterInterruptLine).toBe(0); // 0 * 256 + 0
    });

    it("Combines with RST8 from $d011 correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set RST8=1 first
      vic.writeRegister(0x11, 0x80); // RST8=1
      expect(vic.rst8).toBe(true);
      expect(vic.rasterInterruptLine).toBe(256); // 1 * 256 + 0

      // --- Set $d012 to various values
      vic.writeRegister(0x12, 0x50); // $d012 = 80
      expect(vic.registers[0x12]).toBe(0x50);
      expect(vic.rasterInterruptLine).toBe(336); // 1 * 256 + 80

      vic.writeRegister(0x12, 0xFF); // $d012 = 255
      expect(vic.registers[0x12]).toBe(0xFF);
      expect(vic.rasterInterruptLine).toBe(511); // 1 * 256 + 255

      // --- Clear RST8, keeping $d012
      vic.writeRegister(0x11, 0x00); // RST8=0
      expect(vic.rst8).toBe(false);
      expect(vic.rasterInterruptLine).toBe(255); // 0 * 256 + 255
    });

    it("Updates interrupt line when changed multiple times", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of changes
      const testValues = [0x00, 0x32, 0x80, 0xC8, 0xFF, 0x01];
      
      for (const value of testValues) {
        vic.writeRegister(0x12, value);
        expect(vic.registers[0x12]).toBe(value);
        expect(vic.rasterInterruptLine).toBe(value); // RST8=0, so just the low 8 bits
      }

      // --- Now test with RST8=1
      vic.writeRegister(0x11, 0x80); // Set RST8=1
      
      for (const value of testValues) {
        vic.writeRegister(0x12, value);
        expect(vic.registers[0x12]).toBe(value);
        expect(vic.rasterInterruptLine).toBe(256 + value); // RST8=1, so 256 + low 8 bits
      }
    });
  });

  describe("Cross-register dependencies", () => {
    it("RST8 and $D012 work together for full 9-bit raster interrupt line", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all combinations of RST8 and $d012
      const testCases = [
        { rst8: false, d012: 0x00, expected: 0 },
        { rst8: false, d012: 0xFF, expected: 255 },
        { rst8: true, d012: 0x00, expected: 256 },
        { rst8: true, d012: 0xFF, expected: 511 },
        { rst8: false, d012: 0x80, expected: 128 },
        { rst8: true, d012: 0x80, expected: 384 },
      ];

      for (const testCase of testCases) {
        // Set RST8 through $d011
        vic.writeRegister(0x11, testCase.rst8 ? 0x80 : 0x00);
        // Set lower 8 bits through $d012
        vic.writeRegister(0x12, testCase.d012);

        expect(vic.rst8).toBe(testCase.rst8);
        expect(vic.registers[0x12]).toBe(testCase.d012);
        expect(vic.rasterInterruptLine).toBe(testCase.expected);
      }
    });

    it("Changing RST8 preserves $D012 value in composed interrupt line", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set $d012 to a specific value
      vic.writeRegister(0x12, 0xAB);
      expect(vic.rasterInterruptLine).toBe(0xAB); // RST8=0

      // --- Toggle RST8 multiple times
      vic.writeRegister(0x11, 0x80); // Set RST8=1
      expect(vic.rasterInterruptLine).toBe(256 + 0xAB);
      expect(vic.registers[0x12]).toBe(0xAB); // $d012 unchanged

      vic.writeRegister(0x11, 0x00); // Clear RST8=0
      expect(vic.rasterInterruptLine).toBe(0xAB);
      expect(vic.registers[0x12]).toBe(0xAB); // $d012 still unchanged

      vic.writeRegister(0x11, 0x80); // Set RST8=1 again
      expect(vic.rasterInterruptLine).toBe(256 + 0xAB);
      expect(vic.registers[0x12]).toBe(0xAB); // $d012 still unchanged
    });

    it("Changing $D012 preserves RST8 value in composed interrupt line", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set RST8=1
      vic.writeRegister(0x11, 0x80);
      expect(vic.rasterInterruptLine).toBe(256); // $d012=0

      // --- Change $d012 multiple times
      vic.writeRegister(0x12, 0x10);
      expect(vic.rasterInterruptLine).toBe(256 + 0x10);
      expect(vic.rst8).toBe(true); // RST8 unchanged

      vic.writeRegister(0x12, 0xCD);
      expect(vic.rasterInterruptLine).toBe(256 + 0xCD);
      expect(vic.rst8).toBe(true); // RST8 still unchanged

      vic.writeRegister(0x12, 0x00);
      expect(vic.rasterInterruptLine).toBe(256);
      expect(vic.rst8).toBe(true); // RST8 still unchanged
    });
  });

  describe("$D015 register tests", () => {
    it("Sets individual sprite enable bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test each sprite individually
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const bitValue = 1 << spriteIndex;
        
        // Enable only this sprite
        vic.writeRegister(0x15, bitValue);
        
        // Check that only this sprite is enabled
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].enabled).toBe(i === spriteIndex);
        }
        expect(vic.registers[0x15]).toBe(bitValue);
        
        // Disable all sprites for next iteration
        vic.writeRegister(0x15, 0x00);
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].enabled).toBe(false);
        }
      }
    });

    it("Sets multiple sprite enable bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test various combinations
      const testCases = [
        { value: 0x01, expected: [true, false, false, false, false, false, false, false] }, // Sprite 0 only
        { value: 0x80, expected: [false, false, false, false, false, false, false, true] }, // Sprite 7 only
        { value: 0x81, expected: [true, false, false, false, false, false, false, true] }, // Sprites 0 and 7
        { value: 0x55, expected: [true, false, true, false, true, false, true, false] }, // Sprites 0, 2, 4, 6
        { value: 0xAA, expected: [false, true, false, true, false, true, false, true] }, // Sprites 1, 3, 5, 7
        { value: 0xFF, expected: [true, true, true, true, true, true, true, true] }, // All sprites
        { value: 0x00, expected: [false, false, false, false, false, false, false, false] }, // No sprites
      ];

      for (const testCase of testCases) {
        vic.writeRegister(0x15, testCase.value);
        
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].enabled).toBe(testCase.expected[i]);
        }
        expect(vic.registers[0x15]).toBe(testCase.value);
      }
    });

    it("Preserves non-modified sprite states when changing others", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial state: sprites 0, 2, 4 enabled
      vic.writeRegister(0x15, 0x15); // 00010101 binary
      expect(vic.spriteData[0].enabled).toBe(true);
      expect(vic.spriteData[1].enabled).toBe(false);
      expect(vic.spriteData[2].enabled).toBe(true);
      expect(vic.spriteData[3].enabled).toBe(false);
      expect(vic.spriteData[4].enabled).toBe(true);
      expect(vic.spriteData[5].enabled).toBe(false);
      expect(vic.spriteData[6].enabled).toBe(false);
      expect(vic.spriteData[7].enabled).toBe(false);

      // --- Enable sprite 1, keeping others unchanged
      vic.writeRegister(0x15, 0x17); // 00010111 binary (added sprite 1)
      expect(vic.spriteData[0].enabled).toBe(true);  // Still enabled
      expect(vic.spriteData[1].enabled).toBe(true);  // Now enabled
      expect(vic.spriteData[2].enabled).toBe(true);  // Still enabled
      expect(vic.spriteData[3].enabled).toBe(false); // Still disabled
      expect(vic.spriteData[4].enabled).toBe(true);  // Still enabled
      expect(vic.spriteData[5].enabled).toBe(false); // Still disabled
      expect(vic.spriteData[6].enabled).toBe(false); // Still disabled
      expect(vic.spriteData[7].enabled).toBe(false); // Still disabled

      // --- Disable sprite 2, keeping others unchanged
      vic.writeRegister(0x15, 0x13); // 00010011 binary (removed sprite 2)
      expect(vic.spriteData[0].enabled).toBe(true);  // Still enabled
      expect(vic.spriteData[1].enabled).toBe(true);  // Still enabled
      expect(vic.spriteData[2].enabled).toBe(false); // Now disabled
      expect(vic.spriteData[3].enabled).toBe(false); // Still disabled
      expect(vic.spriteData[4].enabled).toBe(true);  // Still enabled
      expect(vic.spriteData[5].enabled).toBe(false); // Still disabled
      expect(vic.spriteData[6].enabled).toBe(false); // Still disabled
      expect(vic.spriteData[7].enabled).toBe(false); // Still disabled
    });

    it("Handles rapid enable/disable changes correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test rapid changes to the same sprite
      const sprite3Bit = 0x08; // Bit 3 for sprite 3
      
      // Enable sprite 3
      vic.writeRegister(0x15, sprite3Bit);
      expect(vic.spriteData[3].enabled).toBe(true);
      expect(vic.registers[0x15]).toBe(sprite3Bit);

      // Disable sprite 3
      vic.writeRegister(0x15, 0x00);
      expect(vic.spriteData[3].enabled).toBe(false);
      expect(vic.registers[0x15]).toBe(0x00);

      // Enable sprite 3 again
      vic.writeRegister(0x15, sprite3Bit);
      expect(vic.spriteData[3].enabled).toBe(true);
      expect(vic.registers[0x15]).toBe(sprite3Bit);
    });

    it("Updates register value correctly for all bit patterns", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible byte values (0-255)
      for (let value = 0; value <= 255; value++) {
        vic.writeRegister(0x15, value);
        
        // Check register value
        expect(vic.registers[0x15]).toBe(value);
        
        // Check individual sprite enable states
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          const expectedEnabled = !!(value & (1 << spriteIndex));
          expect(vic.spriteData[spriteIndex].enabled).toBe(expectedEnabled);
        }
      }
    });

    it("State changes are detected correctly for individual sprites", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test state change detection by checking before/after states
      const testSequence = [
        0x00, // All disabled
        0x01, // Enable sprite 0
        0x03, // Enable sprite 1 (sprite 0 stays enabled)
        0x02, // Disable sprite 0 (sprite 1 stays enabled)
        0x82, // Enable sprite 7 (sprite 1 stays enabled)
        0x80, // Disable sprite 1 (sprite 7 stays enabled)
        0xFF, // Enable all sprites
        0x00, // Disable all sprites
      ];

      for (let i = 0; i < testSequence.length; i++) {
        const value = testSequence[i];
        vic.writeRegister(0x15, value);
        
        // Verify the state matches the expected bit pattern
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          const expectedState = !!(value & (1 << spriteIndex));
          expect(vic.spriteData[spriteIndex].enabled).toBe(expectedState);
        }
        expect(vic.registers[0x15]).toBe(value);
      }
    });
  });

  describe("Sprite X Coordinate Registers ($D000-$D00E, $D010)", () => {
    it("Initializes sprite X coordinates to 0", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        expect(vic.spriteData[spriteIndex].x).toBe(0);
      }
    });

    it("Sets individual sprite X coordinate LSB correctly", () => {
      // --- Test each sprite individually with isolated tests
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        // --- Arrange (reset for each sprite to ensure isolation)
        const vic = c64.vicDevice;
        vic.reset();
        
        const regIndex = spriteIndex * 2; // $d000, $d002, $d004, etc.
        const testValue = 100 + spriteIndex * 10; // Different values for each sprite
        
        // --- Act
        vic.writeRegister(regIndex, testValue);

        // --- Assert
        expect(vic.spriteData[spriteIndex].x).toBe(testValue);
        expect(vic.registers[regIndex]).toBe(testValue);
        
        // Verify other sprites remain at 0
        for (let otherIndex = 0; otherIndex < 8; otherIndex++) {
          if (otherIndex !== spriteIndex) {
            expect(vic.spriteData[otherIndex].x).toBe(0);
          }
        }
      }
    });

    it("Handles X coordinate LSB register mirroring correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test register indices with upper bits set (mirroring behavior)
      const testCases = [
        { reg: 0x40, expectedSpriteIndex: 0 }, // $d040 should mirror $d000
        { reg: 0x42, expectedSpriteIndex: 1 }, // $d042 should mirror $d002
        { reg: 0x80, expectedSpriteIndex: 0 }, // $d080 should mirror $d000
        { reg: 0xce, expectedSpriteIndex: 7 }, // $d0ce should mirror $d00e
      ];

      testCases.forEach(({ reg, expectedSpriteIndex }) => {
        vic.reset();
        const testValue = 123;
        
        // --- Act
        vic.writeRegister(reg, testValue);

        // --- Assert
        expect(vic.spriteData[expectedSpriteIndex].x).toBe(testValue);
      });
    });

    it("Sets sprite X coordinate MSB correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set some LSB values first
      for (let i = 0; i < 8; i++) {
        vic.writeRegister(i * 2, 100); // Set LSBs to 100
      }

      // --- Test MSB combinations
      const testCases = [
        { msbValue: 0x00, expectedCoords: [100, 100, 100, 100, 100, 100, 100, 100] },
        { msbValue: 0x01, expectedCoords: [356, 100, 100, 100, 100, 100, 100, 100] }, // Sprite 0: 256 + 100
        { msbValue: 0x02, expectedCoords: [100, 356, 100, 100, 100, 100, 100, 100] }, // Sprite 1: 256 + 100
        { msbValue: 0x80, expectedCoords: [100, 100, 100, 100, 100, 100, 100, 356] }, // Sprite 7: 256 + 100
        { msbValue: 0xFF, expectedCoords: [356, 356, 356, 356, 356, 356, 356, 356] }, // All sprites: 256 + 100
      ];

      testCases.forEach(({ msbValue, expectedCoords }) => {
        // --- Act
        vic.writeRegister(0x10, msbValue);

        // --- Assert
        expect(vic.registers[0x10]).toBe(msbValue);
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          expect(vic.spriteData[spriteIndex].x).toBe(expectedCoords[spriteIndex]);
        }
      });
    });

    it("Handles combined LSB and MSB changes correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence: LSB first, then MSB
      vic.writeRegister(0x00, 255); // Sprite 0 X LSB = 255
      expect(vic.spriteData[0].x).toBe(255);

      vic.writeRegister(0x10, 0x01); // Set sprite 0 MSB
      expect(vic.spriteData[0].x).toBe(511); // 256 + 255

      // --- Test sequence: MSB first, then LSB
      vic.writeRegister(0x02, 0); // Reset sprite 1 X LSB = 0
      vic.writeRegister(0x10, 0x03); // Set MSB for sprites 0 and 1
      expect(vic.spriteData[0].x).toBe(511); // Still 256 + 255
      expect(vic.spriteData[1].x).toBe(256); // 256 + 0

      vic.writeRegister(0x02, 128); // Change sprite 1 X LSB = 128
      expect(vic.spriteData[1].x).toBe(384); // 256 + 128
    });

    it("Tests full X coordinate range (0-511)", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test boundary values for sprite 0
      const testCases = [
        { lsb: 0, msb: false, expected: 0 },
        { lsb: 255, msb: false, expected: 255 },
        { lsb: 0, msb: true, expected: 256 },
        { lsb: 255, msb: true, expected: 511 },
        { lsb: 128, msb: true, expected: 384 },
        { lsb: 64, msb: false, expected: 64 },
      ];

      testCases.forEach(({ lsb, msb, expected }) => {
        // Reset to ensure clean state for each test case
        vic.reset();
        
        // Set LSB
        vic.writeRegister(0x00, lsb);
        // Set/clear MSB  
        vic.writeRegister(0x10, msb ? 0x01 : 0x00);
        
        expect(vic.spriteData[0].x).toBe(expected);
      });
    });

    it("Updates X coordinates independently for each sprite", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set different coordinates for each sprite
      const expectedCoords = [100, 200, 300, 400, 156, 256, 356, 456];
      
      // First, set all LSB values
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const coord = expectedCoords[spriteIndex];
        const lsb = coord & 0xFF;
        vic.writeRegister(spriteIndex * 2, lsb);
      }
      
      // Then, build and set the complete MSB register value
      let msbRegisterValue = 0;
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const coord = expectedCoords[spriteIndex];
        const msb = (coord & 0x100) >> 8;
        if (msb) {
          msbRegisterValue |= (1 << spriteIndex);
        }
      }
      vic.writeRegister(0x10, msbRegisterValue);

      // --- Assert all coordinates are set correctly
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        expect(vic.spriteData[spriteIndex].x).toBe(expectedCoords[spriteIndex]);
      }
    });

    it("Preserves existing MSB bits when changing individual sprite coordinates", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial state: sprites 1, 3, 5 have MSB set
      vic.writeRegister(0x10, 0x2A); // Binary: 00101010 (sprites 1, 3, 5)
      
      // Set LSB values
      for (let i = 0; i < 8; i++) {
        vic.writeRegister(i * 2, 50);
      }

      // --- Verify initial state
      const expectedInitial = [50, 306, 50, 306, 50, 306, 50, 50]; // 50 or 256+50
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].x).toBe(expectedInitial[i]);
      }

      // --- Change LSB for sprite 0 (MSB should remain 0)
      vic.writeRegister(0x00, 100);
      expect(vic.spriteData[0].x).toBe(100); // Still no MSB
      expect(vic.spriteData[1].x).toBe(306); // MSB preserved

      // --- Change LSB for sprite 1 (MSB should remain 1)  
      vic.writeRegister(0x02, 150);
      expect(vic.spriteData[1].x).toBe(406); // 256 + 150, MSB preserved
      expect(vic.spriteData[0].x).toBe(100); // Previous change preserved
    });

    it("Byte value masking works correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test values > 255 are masked to byte range
      vic.writeRegister(0x00, 0x1FF); // 511, should become 255
      expect(vic.spriteData[0].x).toBe(255);
      expect(vic.registers[0x00]).toBe(255);

      vic.writeRegister(0x10, 0x1FF); // 511, should become 255
      expect(vic.registers[0x10]).toBe(255);
      
      // Verify all MSB bits are set (255 = 0xFF)
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].x).toBe(i === 0 ? 511 : 256); // Sprite 0 has LSB 255, others have LSB 0
      }
    });
  });

  describe("Sprite Y Coordinate Registers ($D001, $D003, $D005, $D007, $D009, $D00B, $D00D, $D00F)", () => {
    it("Initializes sprite Y coordinates to 0", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        expect(vic.spriteData[spriteIndex].y).toBe(0);
      }
    });

    it("Sets individual sprite Y coordinate correctly", () => {
      // --- Test each sprite individually with isolated tests
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        // --- Arrange (reset for each sprite to ensure isolation)
        const vic = c64.vicDevice;
        vic.reset();
        
        const regIndex = spriteIndex * 2 + 1; // $d001, $d003, $d005, etc.
        const testValue = 50 + spriteIndex * 15; // Different values for each sprite
        
        // --- Act
        vic.writeRegister(regIndex, testValue);

        // --- Assert
        expect(vic.spriteData[spriteIndex].y).toBe(testValue);
        expect(vic.registers[regIndex]).toBe(testValue);
        
        // Verify other sprites remain at 0
        for (let otherIndex = 0; otherIndex < 8; otherIndex++) {
          if (otherIndex !== spriteIndex) {
            expect(vic.spriteData[otherIndex].y).toBe(0);
          }
        }
      }
    });

    it("Handles Y coordinate register mirroring correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test register indices with upper bits set (mirroring behavior)
      const testCases = [
        { reg: 0x41, expectedSpriteIndex: 0 }, // $d041 should mirror $d001
        { reg: 0x43, expectedSpriteIndex: 1 }, // $d043 should mirror $d003
        { reg: 0x81, expectedSpriteIndex: 0 }, // $d081 should mirror $d001
        { reg: 0xcf, expectedSpriteIndex: 7 }, // $d0cf should mirror $d00f
      ];

      testCases.forEach(({ reg, expectedSpriteIndex }) => {
        vic.reset();
        const testValue = 150;
        
        // --- Act
        vic.writeRegister(reg, testValue);

        // --- Assert
        expect(vic.spriteData[expectedSpriteIndex].y).toBe(testValue);
      });
    });

    it("Handles full Y coordinate range (0-255)", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test boundary values for sprite 0
      const testCases = [0, 1, 50, 100, 150, 200, 254, 255];

      testCases.forEach((testValue) => {
        // Reset for each test case to ensure clean state
        vic.reset();
        
        // --- Act
        vic.writeRegister(0x01, testValue); // Sprite 0 Y position

        // --- Assert
        expect(vic.spriteData[0].y).toBe(testValue);
        expect(vic.registers[0x01]).toBe(testValue);
      });
    });

    it("Sets Y coordinates independently for each sprite", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set different Y coordinates for each sprite
      const expectedCoords = [50, 75, 100, 125, 150, 175, 200, 225];
      
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const regIndex = spriteIndex * 2 + 1; // $d001, $d003, $d005, etc.
        vic.writeRegister(regIndex, expectedCoords[spriteIndex]);
      }

      // --- Assert all coordinates are set correctly
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        expect(vic.spriteData[spriteIndex].y).toBe(expectedCoords[spriteIndex]);
      }
    });

    it("Updates Y coordinates without affecting X coordinates", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial X coordinates for all sprites
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        vic.writeRegister(spriteIndex * 2, 100); // Set X LSB to 100
      }
      vic.writeRegister(0x10, 0xFF); // Set all X MSBs
      
      // Verify initial state
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        expect(vic.spriteData[spriteIndex].x).toBe(356); // 256 + 100
        expect(vic.spriteData[spriteIndex].y).toBe(0);
      }

      // --- Act: Set Y coordinates
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const yValue = 50 + spriteIndex * 10;
        vic.writeRegister(spriteIndex * 2 + 1, yValue);
      }

      // --- Assert: Y coordinates updated, X coordinates preserved
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        expect(vic.spriteData[spriteIndex].x).toBe(356); // X unchanged
        expect(vic.spriteData[spriteIndex].y).toBe(50 + spriteIndex * 10); // Y updated
      }
    });

    it("Handles rapid Y coordinate changes correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test rapid changes to the same sprite
      const sprite2RegIndex = 0x05; // $d005 - sprite 2 Y position
      const testSequence = [100, 150, 75, 200, 25, 255, 0];
      
      testSequence.forEach((yValue) => {
        // --- Act
        vic.writeRegister(sprite2RegIndex, yValue);

        // --- Assert
        expect(vic.spriteData[2].y).toBe(yValue);
        expect(vic.registers[sprite2RegIndex]).toBe(yValue);
        
        // Verify other sprites are unaffected
        for (let otherIndex = 0; otherIndex < 8; otherIndex++) {
          if (otherIndex !== 2) {
            expect(vic.spriteData[otherIndex].y).toBe(0);
          }
        }
      });
    });

    it("Byte value masking works correctly for Y coordinates", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test values > 255 are masked to byte range
      vic.writeRegister(0x01, 0x1FF); // 511, should become 255
      expect(vic.spriteData[0].y).toBe(255);
      expect(vic.registers[0x01]).toBe(255);

      vic.writeRegister(0x03, 0x300); // 768, should become 0 (768 & 0xFF = 0)
      expect(vic.spriteData[1].y).toBe(0);
      expect(vic.registers[0x03]).toBe(0);

      vic.writeRegister(0x05, 0x1AB); // 427, should become 171 (427 & 0xFF = 171)
      expect(vic.spriteData[2].y).toBe(171);
      expect(vic.registers[0x05]).toBe(171);
    });

    it("Y coordinate mapping to sprite indices is correct", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test register-to-sprite mapping
      const registerToSpriteMap = [
        { reg: 0x01, sprite: 0 }, // $d001 -> sprite 0
        { reg: 0x03, sprite: 1 }, // $d003 -> sprite 1
        { reg: 0x05, sprite: 2 }, // $d005 -> sprite 2
        { reg: 0x07, sprite: 3 }, // $d007 -> sprite 3
        { reg: 0x09, sprite: 4 }, // $d009 -> sprite 4
        { reg: 0x0b, sprite: 5 }, // $d00b -> sprite 5
        { reg: 0x0d, sprite: 6 }, // $d00d -> sprite 6
        { reg: 0x0f, sprite: 7 }, // $d00f -> sprite 7
      ];

      registerToSpriteMap.forEach(({ reg, sprite }, index) => {
        vic.reset();
        const testValue = 100 + index * 10;
        
        // --- Act
        vic.writeRegister(reg, testValue);

        // --- Assert: Only the expected sprite is affected
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          if (spriteIndex === sprite) {
            expect(vic.spriteData[spriteIndex].y).toBe(testValue);
          } else {
            expect(vic.spriteData[spriteIndex].y).toBe(0);
          }
        }
      });
    });
  });

  describe("$D016 Register (Control Register 2) Tests", () => {
    it("Initializes $D016 register fields to correct default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.mcm).toBe(false);     // MCM (Multicolor Mode) = 0
      expect(vic.csel).toBe(false);    // CSEL (Column Select) = 0 (38 columns)
      expect(vic.xScroll).toBe(0);     // XSCROLL (Horizontal fine scroll) = 0
      expect(vic.registers[0x16]).toBe(0);
    });

    it("Sets MCM bit correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test MCM bit (bit 4)
      vic.writeRegister(0x16, 0x10); // MCM=1, all others=0
      expect(vic.mcm).toBe(true);
      expect(vic.csel).toBe(false);
      expect(vic.xScroll).toBe(0);
      expect(vic.registers[0x16]).toBe(0x10);

      // Clear MCM bit
      vic.writeRegister(0x16, 0x00);
      expect(vic.mcm).toBe(false);
      expect(vic.csel).toBe(false);
      expect(vic.xScroll).toBe(0);
      expect(vic.registers[0x16]).toBe(0x00);
    });

    it("Sets CSEL bit correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test CSEL bit (bit 3)
      vic.writeRegister(0x16, 0x08); // CSEL=1, all others=0
      expect(vic.mcm).toBe(false);
      expect(vic.csel).toBe(true);
      expect(vic.xScroll).toBe(0);
      expect(vic.registers[0x16]).toBe(0x08);

      // Clear CSEL bit
      vic.writeRegister(0x16, 0x00);
      expect(vic.mcm).toBe(false);
      expect(vic.csel).toBe(false);
      expect(vic.xScroll).toBe(0);
      expect(vic.registers[0x16]).toBe(0x00);
    });

    it("Sets XSCROLL field correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all XSCROLL values (bits 2-0)
      for (let xScrollValue = 0; xScrollValue <= 7; xScrollValue++) {
        vic.writeRegister(0x16, xScrollValue);
        expect(vic.mcm).toBe(false);
        expect(vic.csel).toBe(false);
        expect(vic.xScroll).toBe(xScrollValue);
        expect(vic.registers[0x16]).toBe(xScrollValue);
      }
    });

    it("Sets multiple bits simultaneously", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test combinations
      const testCases = [
        { value: 0x00, mcm: false, csel: false, xScroll: 0 }, // All bits clear
        { value: 0x10, mcm: true,  csel: false, xScroll: 0 }, // MCM only
        { value: 0x08, mcm: false, csel: true,  xScroll: 0 }, // CSEL only
        { value: 0x07, mcm: false, csel: false, xScroll: 7 }, // XSCROLL only
        { value: 0x18, mcm: true,  csel: true,  xScroll: 0 }, // MCM + CSEL
        { value: 0x15, mcm: true,  csel: false, xScroll: 5 }, // MCM + XSCROLL
        { value: 0x0B, mcm: false, csel: true,  xScroll: 3 }, // CSEL + XSCROLL
        { value: 0x1F, mcm: true,  csel: true,  xScroll: 7 }, // All bits set
      ];

      testCases.forEach(({ value, mcm, csel, xScroll }) => {
        vic.writeRegister(0x16, value);
        expect(vic.mcm).toBe(mcm);
        expect(vic.csel).toBe(csel);
        expect(vic.xScroll).toBe(xScroll);
        expect(vic.registers[0x16]).toBe(value);
      });
    });

    it("Ignores RES bit (bit 5) correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test that RES bit (bit 5) has no effect
      vic.writeRegister(0x16, 0x20); // RES=1, all others=0
      expect(vic.mcm).toBe(false);
      expect(vic.csel).toBe(false);
      expect(vic.xScroll).toBe(0);
      expect(vic.registers[0x16]).toBe(0x20); // Register stores the bit

      // Test RES combined with other bits
      vic.writeRegister(0x16, 0x3F); // RES=1, MCM=1, CSEL=1, XSCROLL=7
      expect(vic.mcm).toBe(true);
      expect(vic.csel).toBe(true);
      expect(vic.xScroll).toBe(7);
      expect(vic.registers[0x16]).toBe(0x3F);
    });

    it("Ignores upper bits (6-7) correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test that upper bits are properly masked
      vic.writeRegister(0x16, 0xFF); // All bits set
      expect(vic.mcm).toBe(true);
      expect(vic.csel).toBe(true);
      expect(vic.xScroll).toBe(7);
      expect(vic.registers[0x16]).toBe(0xFF); // Register stores all bits

      vic.writeRegister(0x16, 0xC0); // Only upper bits set
      expect(vic.mcm).toBe(false);
      expect(vic.csel).toBe(false);
      expect(vic.xScroll).toBe(0);
      expect(vic.registers[0x16]).toBe(0xC0);
    });

    it("Handles state changes correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial state
      vic.writeRegister(0x16, 0x15); // MCM=1, CSEL=0, XSCROLL=5
      expect(vic.mcm).toBe(true);
      expect(vic.csel).toBe(false);
      expect(vic.xScroll).toBe(5);

      // --- Change to different state
      vic.writeRegister(0x16, 0x0A); // MCM=0, CSEL=1, XSCROLL=2
      expect(vic.mcm).toBe(false);
      expect(vic.csel).toBe(true);
      expect(vic.xScroll).toBe(2);
      expect(vic.registers[0x16]).toBe(0x0A);

      // --- Change individual bits
      vic.writeRegister(0x16, 0x1A); // MCM=1, CSEL=1, XSCROLL=2
      expect(vic.mcm).toBe(true);
      expect(vic.csel).toBe(true);
      expect(vic.xScroll).toBe(2);
    });

    it("Handles rapid register changes", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of rapid changes
      const testSequence = [0x00, 0x10, 0x08, 0x18, 0x07, 0x1F, 0x00];
      
      testSequence.forEach((value) => {
        vic.writeRegister(0x16, value);
        const expectedMcm = !!(value & 0x10);
        const expectedCsel = !!(value & 0x08);
        const expectedXScroll = value & 0x07;
        
        expect(vic.mcm).toBe(expectedMcm);
        expect(vic.csel).toBe(expectedCsel);
        expect(vic.xScroll).toBe(expectedXScroll);
        expect(vic.registers[0x16]).toBe(value);
      });
    });

    it("Register mirroring works correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test register mirroring (registers repeat every 64 bytes)
      const testValue = 0x1B; // MCM=1, CSEL=1, XSCROLL=3
      const mirroredAddresses = [0x16, 0x56, 0x96, 0xD6]; // $d016, $d056, $d096, $d0d6
      
      mirroredAddresses.forEach((address) => {
        vic.reset();
        vic.writeRegister(address, testValue);
        
        expect(vic.mcm).toBe(true);
        expect(vic.csel).toBe(true);
        expect(vic.xScroll).toBe(3);
        // Note: only the base register stores the value
        expect(vic.registers[0x16]).toBe(testValue);
      });
    });

    it("Byte value masking works correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test values > 255 are masked to byte range
      vic.writeRegister(0x16, 0x11B); // 283, should become 27 (283 & 0xFF = 27)
      expect(vic.mcm).toBe(true);   // Bit 4 of 27 is 1
      expect(vic.csel).toBe(true);  // Bit 3 of 27 is 1  
      expect(vic.xScroll).toBe(3);  // Bits 2-0 of 27 are 3
      expect(vic.registers[0x16]).toBe(27);
    });

    it("Does not affect other register states", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set some other register values first
      vic.writeRegister(0x11, 0x9B); // Set $d011 values
      vic.writeRegister(0x15, 0xFF); // Enable all sprites
      
      // Store initial states
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialSpriteStates = vic.spriteData.map(s => ({ enabled: s.enabled, x: s.x, y: s.y }));

      // --- Act: Change $d016
      vic.writeRegister(0x16, 0x1F);

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      
      // Verify sprite states unchanged
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].enabled).toBe(initialSpriteStates[i].enabled);
        expect(vic.spriteData[i].x).toBe(initialSpriteStates[i].x);
        expect(vic.spriteData[i].y).toBe(initialSpriteStates[i].y);
      }

      // Verify $d016 was set correctly
      expect(vic.mcm).toBe(true);
      expect(vic.csel).toBe(true);
      expect(vic.xScroll).toBe(7);
    });
  });

  describe("$D017 Register (Sprite Y Expansion) Tests", () => {
    it("Initializes $D017 register and sprite Y expansion to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x17]).toBe(0x00);
      
      // Verify all sprites have Y expansion disabled by default
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].yExpand).toBe(false);
      }
    });

    it("Sets individual sprite Y expansion bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test each sprite bit individually
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const bitValue = 1 << spriteIndex;
        
        // --- Act: Set bit for current sprite
        vic.writeRegister(0x17, bitValue);
        
        // --- Assert: Only the target sprite has Y expansion enabled
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].yExpand).toBe(i === spriteIndex);
        }
        
        // Verify register value
        expect(vic.registers[0x17]).toBe(bitValue);
        
        // Clear for next test
        vic.writeRegister(0x17, 0x00);
      }
    });

    it("Sets multiple sprite Y expansion bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test various combinations
      const testCases = [
        { value: 0x03, sprites: [0, 1] },           // Sprites 0, 1
        { value: 0x0F, sprites: [0, 1, 2, 3] },     // Sprites 0-3
        { value: 0xF0, sprites: [4, 5, 6, 7] },     // Sprites 4-7
        { value: 0xAA, sprites: [1, 3, 5, 7] },     // Odd sprites
        { value: 0x55, sprites: [0, 2, 4, 6] },     // Even sprites
        { value: 0xFF, sprites: [0, 1, 2, 3, 4, 5, 6, 7] }, // All sprites
        { value: 0x81, sprites: [0, 7] },           // First and last sprites
      ];

      testCases.forEach(({ value, sprites }) => {
        // --- Act
        vic.writeRegister(0x17, value);

        // --- Assert
        for (let i = 0; i < 8; i++) {
          const expectedExpanded = sprites.includes(i);
          expect(vic.spriteData[i].yExpand).toBe(expectedExpanded);
        }
        
        expect(vic.registers[0x17]).toBe(value);
      });
    });

    it("Preserves non-modified sprite states when changing Y expansion", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial state: sprites 0, 2, 4 Y-expanded
      vic.writeRegister(0x17, 0x15); // 00010101 binary
      
      // Verify initial state
      expect(vic.spriteData[0].yExpand).toBe(true);
      expect(vic.spriteData[1].yExpand).toBe(false);
      expect(vic.spriteData[2].yExpand).toBe(true);
      expect(vic.spriteData[3].yExpand).toBe(false);
      expect(vic.spriteData[4].yExpand).toBe(true);
      expect(vic.spriteData[5].yExpand).toBe(false);
      expect(vic.spriteData[6].yExpand).toBe(false);
      expect(vic.spriteData[7].yExpand).toBe(false);

      // --- Act: Add sprite 1
      vic.writeRegister(0x17, 0x17); // 00010111 binary (added sprite 1)
      
      // --- Assert: Previous states preserved, sprite 1 added
      expect(vic.spriteData[0].yExpand).toBe(true);  // Preserved
      expect(vic.spriteData[1].yExpand).toBe(true);  // Added
      expect(vic.spriteData[2].yExpand).toBe(true);  // Preserved
      expect(vic.spriteData[3].yExpand).toBe(false); // Preserved
      expect(vic.spriteData[4].yExpand).toBe(true);  // Preserved
      expect(vic.spriteData[5].yExpand).toBe(false); // Preserved
      expect(vic.spriteData[6].yExpand).toBe(false); // Preserved
      expect(vic.spriteData[7].yExpand).toBe(false); // Preserved

      // --- Act: Remove sprite 2
      vic.writeRegister(0x17, 0x13); // 00010011 binary (removed sprite 2)
      
      // --- Assert: Other states preserved, sprite 2 removed
      expect(vic.spriteData[0].yExpand).toBe(true);  // Preserved
      expect(vic.spriteData[1].yExpand).toBe(true);  // Preserved
      expect(vic.spriteData[2].yExpand).toBe(false); // Removed
      expect(vic.spriteData[3].yExpand).toBe(false); // Preserved
      expect(vic.spriteData[4].yExpand).toBe(true);  // Preserved
      expect(vic.spriteData[5].yExpand).toBe(false); // Preserved
      expect(vic.spriteData[6].yExpand).toBe(false); // Preserved
      expect(vic.spriteData[7].yExpand).toBe(false); // Preserved
    });

    it("Handles repeated writes to same value correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      const sprite3Bit = 0x08; // Bit 3 for sprite 3

      // --- First write
      vic.writeRegister(0x17, sprite3Bit);
      expect(vic.spriteData[3].yExpand).toBe(true);
      expect(vic.registers[0x17]).toBe(sprite3Bit);

      // --- Second write (same value)
      vic.writeRegister(0x17, sprite3Bit);
      expect(vic.spriteData[3].yExpand).toBe(true);
      expect(vic.registers[0x17]).toBe(sprite3Bit);
    });

    it("State changes are detected correctly for Y expansion", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of changes
      const testSequence = [
        0x01, // Enable sprite 0 Y expansion
        0x03, // Enable sprite 1 (sprite 0 stays expanded)
        0x02, // Disable sprite 0 (sprite 1 stays expanded)
        0x82, // Enable sprite 7 (sprite 1 stays expanded)
        0x80, // Disable sprite 1 (sprite 7 stays expanded)
        0x00, // Disable all sprites
      ];

      testSequence.forEach((value, step) => {
        vic.writeRegister(0x17, value);
        
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          const expectedState = !!(value & (1 << spriteIndex));
          expect(vic.spriteData[spriteIndex].yExpand).toBe(expectedState);
        }
        
        expect(vic.registers[0x17]).toBe(value);
      });
    });

    it("Handles all possible register values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 8-bit values (0x00 to 0xFF)
      for (let value = 0; value <= 0xFF; value++) {
        const expectedEnabled = [
          !!(value & 0x01), // Sprite 0
          !!(value & 0x02), // Sprite 1
          !!(value & 0x04), // Sprite 2
          !!(value & 0x08), // Sprite 3
          !!(value & 0x10), // Sprite 4
          !!(value & 0x20), // Sprite 5
          !!(value & 0x40), // Sprite 6
          !!(value & 0x80)  // Sprite 7
        ];

        // --- Act
        vic.writeRegister(0x17, value);

        // --- Assert
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          expect(vic.spriteData[spriteIndex].yExpand).toBe(expectedEnabled[spriteIndex]);
        }
        
        expect(vic.registers[0x17]).toBe(value);
      }
    });

    it("Y expansion changes do not affect other sprite properties", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial sprite states
      vic.writeRegister(0x15, 0x0F); // Enable sprites 0-3
      
      // Store initial states of other properties
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialSpriteStates = vic.spriteData.map(s => ({ 
        enabled: s.enabled, 
        x: s.x, 
        y: s.y 
      }));

      // --- Act: Change $d017
      vic.writeRegister(0x17, 0xF0); // Enable Y expansion for sprites 4-7

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      
      // Verify other sprite properties unchanged
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].enabled).toBe(initialSpriteStates[i].enabled);
        expect(vic.spriteData[i].x).toBe(initialSpriteStates[i].x);
        expect(vic.spriteData[i].y).toBe(initialSpriteStates[i].y);
      }

      // Verify $d017 was set correctly
      expect(vic.spriteData[4].yExpand).toBe(true);
      expect(vic.spriteData[5].yExpand).toBe(true);
      expect(vic.spriteData[6].yExpand).toBe(true);
      expect(vic.spriteData[7].yExpand).toBe(true);
      expect(vic.spriteData[0].yExpand).toBe(false);
      expect(vic.spriteData[1].yExpand).toBe(false);
      expect(vic.spriteData[2].yExpand).toBe(false);
      expect(vic.spriteData[3].yExpand).toBe(false);
    });
  });

  describe("$D01D Register (Sprite X Expansion) Tests", () => {
    it("Initializes $D01D register and sprite X expansion to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x1d]).toBe(0x00);
      
      // Verify all sprites have X expansion disabled by default
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].xExpand).toBe(false);
      }
    });

    it("Sets individual sprite X expansion bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test each sprite bit individually
      for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
        const bitValue = 1 << spriteIndex;
        
        // --- Act: Set bit for current sprite
        vic.writeRegister(0x1d, bitValue);
        
        // --- Assert: Only the target sprite has X expansion enabled
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].xExpand).toBe(i === spriteIndex);
        }
        
        // Verify register value
        expect(vic.registers[0x1d]).toBe(bitValue);
        
        // Clear for next test
        vic.writeRegister(0x1d, 0x00);
      }
    });

    it("Sets multiple sprite X expansion bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test various combinations
      const testCases = [
        { value: 0x03, sprites: [0, 1] },           // Sprites 0, 1
        { value: 0x0F, sprites: [0, 1, 2, 3] },     // Sprites 0-3
        { value: 0xF0, sprites: [4, 5, 6, 7] },     // Sprites 4-7
        { value: 0xAA, sprites: [1, 3, 5, 7] },     // Odd sprites
        { value: 0x55, sprites: [0, 2, 4, 6] },     // Even sprites
        { value: 0xFF, sprites: [0, 1, 2, 3, 4, 5, 6, 7] }, // All sprites
        { value: 0x81, sprites: [0, 7] },           // First and last sprites
      ];

      testCases.forEach(({ value, sprites }) => {
        // --- Act
        vic.writeRegister(0x1d, value);

        // --- Assert
        for (let i = 0; i < 8; i++) {
          const expectedExpanded = sprites.includes(i);
          expect(vic.spriteData[i].xExpand).toBe(expectedExpanded);
        }
        
        expect(vic.registers[0x1d]).toBe(value);
      });
    });

    it("Preserves non-modified sprite states when changing X expansion", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Set initial state: sprites 0, 2, 4 X-expanded
      vic.writeRegister(0x1d, 0x15); // 00010101 binary
      
      // Verify initial state
      expect(vic.spriteData[0].xExpand).toBe(true);
      expect(vic.spriteData[1].xExpand).toBe(false);
      expect(vic.spriteData[2].xExpand).toBe(true);
      expect(vic.spriteData[3].xExpand).toBe(false);
      expect(vic.spriteData[4].xExpand).toBe(true);
      expect(vic.spriteData[5].xExpand).toBe(false);
      expect(vic.spriteData[6].xExpand).toBe(false);
      expect(vic.spriteData[7].xExpand).toBe(false);

      // --- Act: Add sprite 1
      vic.writeRegister(0x1d, 0x17); // 00010111 binary (added sprite 1)
      
      // --- Assert: Previous states preserved, sprite 1 added
      expect(vic.spriteData[0].xExpand).toBe(true);  // Preserved
      expect(vic.spriteData[1].xExpand).toBe(true);  // Added
      expect(vic.spriteData[2].xExpand).toBe(true);  // Preserved
      expect(vic.spriteData[3].xExpand).toBe(false); // Preserved
      expect(vic.spriteData[4].xExpand).toBe(true);  // Preserved
      expect(vic.spriteData[5].xExpand).toBe(false); // Preserved
      expect(vic.spriteData[6].xExpand).toBe(false); // Preserved
      expect(vic.spriteData[7].xExpand).toBe(false); // Preserved

      // --- Act: Remove sprite 2
      vic.writeRegister(0x1d, 0x13); // 00010011 binary (removed sprite 2)
      
      // --- Assert: Other states preserved, sprite 2 removed
      expect(vic.spriteData[0].xExpand).toBe(true);  // Preserved
      expect(vic.spriteData[1].xExpand).toBe(true);  // Preserved
      expect(vic.spriteData[2].xExpand).toBe(false); // Removed
      expect(vic.spriteData[3].xExpand).toBe(false); // Preserved
      expect(vic.spriteData[4].xExpand).toBe(true);  // Preserved
      expect(vic.spriteData[5].xExpand).toBe(false); // Preserved
      expect(vic.spriteData[6].xExpand).toBe(false); // Preserved
      expect(vic.spriteData[7].xExpand).toBe(false); // Preserved
    });

    it("Handles repeated writes to same value correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      const sprite3Bit = 0x08; // Bit 3 for sprite 3

      // --- First write
      vic.writeRegister(0x1d, sprite3Bit);
      expect(vic.spriteData[3].xExpand).toBe(true);
      expect(vic.registers[0x1d]).toBe(sprite3Bit);

      // --- Second write (same value)
      vic.writeRegister(0x1d, sprite3Bit);
      expect(vic.spriteData[3].xExpand).toBe(true);
      expect(vic.registers[0x1d]).toBe(sprite3Bit);
    });

    it("State changes are detected correctly for X expansion", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of changes
      const testSequence = [
        0x01, // Enable sprite 0 X expansion
        0x03, // Enable sprite 1 (sprite 0 stays expanded)
        0x02, // Disable sprite 0 (sprite 1 stays expanded)
        0x82, // Enable sprite 7 (sprite 1 stays expanded)
        0x80, // Disable sprite 1 (sprite 7 stays expanded)
        0x00, // Disable all sprites
      ];

      testSequence.forEach((value, step) => {
        vic.writeRegister(0x1d, value);
        
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          const expectedState = !!(value & (1 << spriteIndex));
          expect(vic.spriteData[spriteIndex].xExpand).toBe(expectedState);
        }
        
        expect(vic.registers[0x1d]).toBe(value);
      });
    });

    it("Handles all possible register values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 8-bit values (0x00 to 0xFF)
      for (let value = 0; value <= 0xFF; value++) {
        const expectedEnabled = [
          !!(value & 0x01), // Sprite 0
          !!(value & 0x02), // Sprite 1
          !!(value & 0x04), // Sprite 2
          !!(value & 0x08), // Sprite 3
          !!(value & 0x10), // Sprite 4
          !!(value & 0x20), // Sprite 5
          !!(value & 0x40), // Sprite 6
          !!(value & 0x80)  // Sprite 7
        ];

        // --- Act
        vic.writeRegister(0x1d, value);

        // --- Assert
        for (let spriteIndex = 0; spriteIndex < 8; spriteIndex++) {
          expect(vic.spriteData[spriteIndex].xExpand).toBe(expectedEnabled[spriteIndex]);
        }
        
        expect(vic.registers[0x1d]).toBe(value);
      }
    });

    it("X expansion changes do not affect other sprite properties", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial sprite states
      vic.writeRegister(0x15, 0x0F); // Enable sprites 0-3
      vic.writeRegister(0x17, 0xF0); // Enable Y expansion for sprites 4-7
      
      // Store initial states of other properties
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialD017 = vic.registers[0x17];
      const initialSpriteStates = vic.spriteData.map(s => ({ 
        enabled: s.enabled, 
        x: s.x, 
        y: s.y,
        yExpand: s.yExpand
      }));

      // --- Act: Change $d01d
      vic.writeRegister(0x1d, 0x33); // Enable X expansion for sprites 0, 1, 4, 5

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      expect(vic.registers[0x17]).toBe(initialD017);
      
      // Verify other sprite properties unchanged
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].enabled).toBe(initialSpriteStates[i].enabled);
        expect(vic.spriteData[i].x).toBe(initialSpriteStates[i].x);
        expect(vic.spriteData[i].y).toBe(initialSpriteStates[i].y);
        expect(vic.spriteData[i].yExpand).toBe(initialSpriteStates[i].yExpand);
      }

      // Verify $d01d was set correctly
      expect(vic.spriteData[0].xExpand).toBe(true);  // Bit 0 set
      expect(vic.spriteData[1].xExpand).toBe(true);  // Bit 1 set
      expect(vic.spriteData[2].xExpand).toBe(false); // Bit 2 clear
      expect(vic.spriteData[3].xExpand).toBe(false); // Bit 3 clear
      expect(vic.spriteData[4].xExpand).toBe(true);  // Bit 4 set
      expect(vic.spriteData[5].xExpand).toBe(true);  // Bit 5 set
      expect(vic.spriteData[6].xExpand).toBe(false); // Bit 6 clear
      expect(vic.spriteData[7].xExpand).toBe(false); // Bit 7 clear
    });
  });

  describe("$D018 Register (Memory Pointers) Tests", () => {
    it("Initializes $D018 register and memory pointers to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x18]).toBe(0x00);
      expect(vic.videoMatrixBase).toBe(0x0000);    // VM13-VM10 = 0000
      expect(vic.characterBase).toBe(0x0000);      // CB13-CB11 = 000
    });

    it("Sets video matrix base address correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test different VM13-VM10 values (bits 7-4)
      const testCases = [
        { regValue: 0x10, vmBits: 0x1, expectedBase: 0x0400 },  // VM = 0001 -> $0400
        { regValue: 0x20, vmBits: 0x2, expectedBase: 0x0800 },  // VM = 0010 -> $0800
        { regValue: 0x40, vmBits: 0x4, expectedBase: 0x1000 },  // VM = 0100 -> $1000
        { regValue: 0x80, vmBits: 0x8, expectedBase: 0x2000 },  // VM = 1000 -> $2000
        { regValue: 0xF0, vmBits: 0xF, expectedBase: 0x3C00 },  // VM = 1111 -> $3C00
        { regValue: 0x50, vmBits: 0x5, expectedBase: 0x1400 },  // VM = 0101 -> $1400
        { regValue: 0xA0, vmBits: 0xA, expectedBase: 0x2800 },  // VM = 1010 -> $2800
      ];

      testCases.forEach(({ regValue, expectedBase }) => {
        // --- Act
        vic.writeRegister(0x18, regValue);

        // --- Assert
        expect(vic.videoMatrixBase).toBe(expectedBase);
        expect(vic.registers[0x18]).toBe(regValue & 0xFE); // Bit 0 unused
      });
    });

    it("Sets character base address correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test different CB13-CB11 values (bits 3-1)
      const testCases = [
        { regValue: 0x02, cbBits: 0x1, expectedBase: 0x0800 },  // CB = 001 -> $0800
        { regValue: 0x04, cbBits: 0x2, expectedBase: 0x1000 },  // CB = 010 -> $1000
        { regValue: 0x06, cbBits: 0x3, expectedBase: 0x1800 },  // CB = 011 -> $1800
        { regValue: 0x08, cbBits: 0x4, expectedBase: 0x2000 },  // CB = 100 -> $2000
        { regValue: 0x0A, cbBits: 0x5, expectedBase: 0x2800 },  // CB = 101 -> $2800
        { regValue: 0x0C, cbBits: 0x6, expectedBase: 0x3000 },  // CB = 110 -> $3000
        { regValue: 0x0E, cbBits: 0x7, expectedBase: 0x3800 },  // CB = 111 -> $3800
      ];

      testCases.forEach(({ regValue, expectedBase }) => {
        // --- Act
        vic.writeRegister(0x18, regValue);

        // --- Assert
        expect(vic.characterBase).toBe(expectedBase);
        expect(vic.registers[0x18]).toBe(regValue & 0xFE); // Bit 0 unused
      });
    });

    it("Sets both video matrix and character base simultaneously", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test combinations of VM and CB bits
      const testCases = [
        { 
          regValue: 0x12,           // VM=0001, CB=001
          expectedVM: 0x0400,       // Video matrix at $0400
          expectedCB: 0x0800        // Character base at $0800
        },
        { 
          regValue: 0x34,           // VM=0011, CB=010
          expectedVM: 0x0C00,       // Video matrix at $0C00
          expectedCB: 0x1000        // Character base at $1000
        },
        { 
          regValue: 0x56,           // VM=0101, CB=011
          expectedVM: 0x1400,       // Video matrix at $1400
          expectedCB: 0x1800        // Character base at $1800
        },
        { 
          regValue: 0x78,           // VM=0111, CB=100
          expectedVM: 0x1C00,       // Video matrix at $1C00
          expectedCB: 0x2000        // Character base at $2000
        },
        { 
          regValue: 0x9A,           // VM=1001, CB=101
          expectedVM: 0x2400,       // Video matrix at $2400
          expectedCB: 0x2800        // Character base at $2800
        },
        { 
          regValue: 0xBC,           // VM=1011, CB=110
          expectedVM: 0x2C00,       // Video matrix at $2C00
          expectedCB: 0x3000        // Character base at $3000
        },
        { 
          regValue: 0xFE,           // VM=1111, CB=111
          expectedVM: 0x3C00,       // Video matrix at $3C00
          expectedCB: 0x3800        // Character base at $3800
        },
      ];

      testCases.forEach(({ regValue, expectedVM, expectedCB }) => {
        // --- Act
        vic.writeRegister(0x18, regValue);

        // --- Assert
        expect(vic.videoMatrixBase).toBe(expectedVM);
        expect(vic.characterBase).toBe(expectedCB);
        expect(vic.registers[0x18]).toBe(regValue & 0xFE); // Bit 0 unused
      });
    });

    it("Handles bit 0 correctly (unused bit always reads as 0)", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test that bit 0 is always masked out
      const testValues = [0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0xFF];

      testValues.forEach((value) => {
        // --- Act
        vic.writeRegister(0x18, value);

        // --- Assert: Bit 0 should always be 0 in the register
        expect(vic.registers[0x18]).toBe(value & 0xFE);
        
        // Memory pointers should be calculated correctly regardless
        const expectedVM = (value & 0xF0) << 6;
        const expectedCB = (value & 0x0E) << 10;
        expect(vic.videoMatrixBase).toBe(expectedVM);
        expect(vic.characterBase).toBe(expectedCB);
      });
    });

    it("Preserves existing state when writing same value", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      const testValue = 0x34; // VM=0011, CB=010

      // --- First write
      vic.writeRegister(0x18, testValue);
      const firstVM = vic.videoMatrixBase;
      const firstCB = vic.characterBase;

      // --- Second write (same value)
      vic.writeRegister(0x18, testValue);

      // --- Assert: Values should remain the same
      expect(vic.videoMatrixBase).toBe(firstVM);
      expect(vic.characterBase).toBe(firstCB);
      expect(vic.registers[0x18]).toBe(testValue & 0xFE);
    });

    it("Handles all possible register values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 8-bit values
      for (let value = 0; value <= 0xFF; value++) {
        const expectedVM = (value & 0xF0) << 6;   // VM13-VM10 to bits 13-10
        const expectedCB = (value & 0x0E) << 10;  // CB13-CB11 to bits 13-11

        // --- Act
        vic.writeRegister(0x18, value);

        // --- Assert
        expect(vic.videoMatrixBase).toBe(expectedVM);
        expect(vic.characterBase).toBe(expectedCB);
        expect(vic.registers[0x18]).toBe(value & 0xFE); // Bit 0 always 0
      }
    });

    it("Memory pointer changes do not affect other registers", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial states
      vic.writeRegister(0x11, 0x1B); // Set $d011
      vic.writeRegister(0x15, 0x0F); // Enable sprites 0-3
      vic.writeRegister(0x16, 0x08); // Set $d016
      vic.writeRegister(0x17, 0xF0); // Y expansion for sprites 4-7
      vic.writeRegister(0x1d, 0x33); // X expansion for sprites 0,1,4,5

      // Store initial states
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialD016 = vic.registers[0x16];
      const initialD017 = vic.registers[0x17];
      const initialD01D = vic.registers[0x1d];
      const initialSpriteStates = vic.spriteData.map(s => ({
        enabled: s.enabled,
        x: s.x,
        y: s.y,
        yExpand: s.yExpand,
        xExpand: s.xExpand
      }));

      // --- Act: Change $d018
      vic.writeRegister(0x18, 0xBC); // VM=1011, CB=110

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      expect(vic.registers[0x16]).toBe(initialD016);
      expect(vic.registers[0x17]).toBe(initialD017);
      expect(vic.registers[0x1d]).toBe(initialD01D);

      // Verify other properties unchanged
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].enabled).toBe(initialSpriteStates[i].enabled);
        expect(vic.spriteData[i].x).toBe(initialSpriteStates[i].x);
        expect(vic.spriteData[i].y).toBe(initialSpriteStates[i].y);
        expect(vic.spriteData[i].yExpand).toBe(initialSpriteStates[i].yExpand);
        expect(vic.spriteData[i].xExpand).toBe(initialSpriteStates[i].xExpand);
      }

      // Verify $d018 was set correctly
      expect(vic.videoMatrixBase).toBe(0x2C00);  // VM=1011
      expect(vic.characterBase).toBe(0x3000);    // CB=110
    });

    it("Standard C64 memory configurations work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test common C64 configurations
      const standardConfigs = [
        {
          name: "Default configuration",
          regValue: 0x14,           // VM=0001, CB=010 (standard C64 setup)
          expectedVM: 0x0400,       // Video matrix at $0400
          expectedCB: 0x1000        // Character ROM at $1000
        },
        {
          name: "Alternate screen",
          regValue: 0x54,           // VM=0101, CB=010
          expectedVM: 0x1400,       // Video matrix at $1400  
          expectedCB: 0x1000        // Character ROM at $1000
        },
        {
          name: "Custom charset",
          regValue: 0x18,           // VM=0001, CB=100
          expectedVM: 0x0400,       // Video matrix at $0400
          expectedCB: 0x2000        // Custom charset at $2000
        },
        {
          name: "Upper case charset",
          regValue: 0x16,           // VM=0001, CB=011
          expectedVM: 0x0400,       // Video matrix at $0400
          expectedCB: 0x1800        // Upper case charset at $1800
        }
      ];

      standardConfigs.forEach(({ name, regValue, expectedVM, expectedCB }) => {
        // --- Act
        vic.writeRegister(0x18, regValue);

        // --- Assert
        expect(vic.videoMatrixBase).toBe(expectedVM);
        expect(vic.characterBase).toBe(expectedCB);
        expect(vic.registers[0x18]).toBe(regValue);
      });
    });
  });

  describe("$D019 Register (Interrupt Register/Latch) Tests", () => {
    it("Initializes $D019 register and interrupt latch to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x19]).toBe(0x00);
      expect(vic.interruptLatch).toBe(0x00);  // No interrupts pending
    });

    it("Clears individual interrupt latch bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Simulate all interrupt bits being set
      vic.interruptLatch = 0x0F; // Set all interrupt bits (IRST, IMBC, IMMC, ILP)
      vic.registers[0x19] = vic.interruptLatch;

      // --- Test clearing each bit individually
      const testCases = [
        { writeBit: 0x01, clearBit: 0x01, name: "IRST (Raster)" },
        { writeBit: 0x02, clearBit: 0x02, name: "IMBC (Sprite-Background)" },
        { writeBit: 0x04, clearBit: 0x04, name: "IMMC (Sprite-Sprite)" },
        { writeBit: 0x08, clearBit: 0x08, name: "ILP (Light Pen)" },
      ];

      testCases.forEach(({ writeBit, clearBit, name }) => {
        // Set all bits again
        vic.interruptLatch = 0x0F;
        
        // --- Act: Write 1 to clear specific bit
        vic.writeRegister(0x19, writeBit);
        
        // --- Assert: Only the specific bit should be cleared
        expect(vic.interruptLatch).toBe(0x0F & ~clearBit);
        expect(vic.registers[0x19]).toBe((0x0F & ~clearBit) & 0x8F);
      });
    });

    it("Clears multiple interrupt latch bits simultaneously", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set all interrupt bits
      vic.interruptLatch = 0x0F;

      // --- Test clearing multiple bits
      const testCases = [
        { writeValue: 0x03, clearedBits: 0x03, name: "IRST + IMBC" },
        { writeValue: 0x05, clearedBits: 0x05, name: "IRST + IMMC" },
        { writeValue: 0x0A, clearedBits: 0x0A, name: "IMBC + ILP" },
        { writeValue: 0x0F, clearedBits: 0x0F, name: "All interrupts" },
        { writeValue: 0x06, clearedBits: 0x06, name: "IMBC + IMMC" },
      ];

      testCases.forEach(({ writeValue, clearedBits, name }) => {
        // Set all bits again
        vic.interruptLatch = 0x0F;
        
        // --- Act
        vic.writeRegister(0x19, writeValue);
        
        // --- Assert
        expect(vic.interruptLatch).toBe(0x0F & ~clearedBits);
        expect(vic.registers[0x19]).toBe((0x0F & ~clearedBits) & 0x8F);
      });
    });

    it("IRQ bit (bit 7) reflects interrupt state correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Enable raster interrupts
      vic.interruptEnable = 0x01;

      // --- Test: No interrupts pending -> IRQ bit clear
      vic.interruptLatch = 0x00;
      vic.writeRegister(0x19, 0x00); // Trigger register update
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ bit clear

      // --- Test: Interrupt pending and enabled -> IRQ bit set
      vic.interruptLatch = 0x01; // Set raster interrupt
      vic.writeRegister(0x19, 0x00); // Trigger register update
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ bit set

      // --- Test: Interrupt pending but disabled -> IRQ bit clear
      vic.interruptEnable = 0x00; // Disable all interrupts
      vic.writeRegister(0x19, 0x00); // Trigger register update
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ bit clear
    });

    it("Writing 0 to interrupt bits does not clear them", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set all interrupt bits
      vic.interruptLatch = 0x0F;

      // --- Act: Write 0 to all bits
      vic.writeRegister(0x19, 0x00);

      // --- Assert: No bits should be cleared
      expect(vic.interruptLatch).toBe(0x0F);
      expect(vic.registers[0x19] & 0x0F).toBe(0x0F);
    });

    it("Upper bits (7-4) behave correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: Writing to upper bits should not affect anything except triggering IRQ update
      vic.writeRegister(0x19, 0xF0); // Write 1s to upper bits
      
      // --- Assert: Only bit 7 (IRQ) is affected, bits 6-4 remain 0
      expect(vic.registers[0x19] & 0x70).toBe(0x00); // Bits 6-4 read as 0
    });
  });

  describe("$D01A Register (Interrupt Enable) Tests", () => {
    it("Initializes $D01A register and interrupt enable to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x1a]).toBe(0x00);
      expect(vic.interruptEnable).toBe(0x00);  // All interrupts disabled
    });

    it("Sets individual interrupt enable bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test each enable bit individually
      const testCases = [
        { bit: 0x01, name: "ERST (Raster enable)" },
        { bit: 0x02, name: "EMBC (Sprite-Background enable)" },
        { bit: 0x04, name: "EMMC (Sprite-Sprite enable)" },
        { bit: 0x08, name: "ELP (Light Pen enable)" },
      ];

      testCases.forEach(({ bit, name }) => {
        // --- Act
        vic.writeRegister(0x1a, bit);
        
        // --- Assert
        expect(vic.interruptEnable).toBe(bit);
        expect(vic.registers[0x1a]).toBe(bit);
        
        // Clear for next test
        vic.writeRegister(0x1a, 0x00);
      });
    });

    it("Sets multiple interrupt enable bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test various combinations
      const testCases = [
        { value: 0x03, name: "ERST + EMBC" },
        { value: 0x05, name: "ERST + EMMC" },
        { value: 0x0A, name: "EMBC + ELP" },
        { value: 0x0F, name: "All interrupts" },
        { value: 0x06, name: "EMBC + EMMC" },
        { value: 0x09, name: "ERST + ELP" },
      ];

      testCases.forEach(({ value, name }) => {
        // --- Act
        vic.writeRegister(0x1a, value);
        
        // --- Assert
        expect(vic.interruptEnable).toBe(value);
        expect(vic.registers[0x1a]).toBe(value);
      });
    });

    it("IRQ triggering works correctly with enable mask", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set raster interrupt pending
      vic.interruptLatch = 0x01;

      // --- Test: Interrupt pending but disabled -> No IRQ
      vic.writeRegister(0x1a, 0x00); // All disabled
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ bit clear

      // --- Test: Enable raster interrupt -> IRQ triggered
      vic.writeRegister(0x1a, 0x01); // Enable raster
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ bit set

      // --- Test: Disable raster interrupt -> IRQ cleared
      vic.writeRegister(0x1a, 0x00); // Disable all
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ bit clear
    });

    it("Multiple interrupt sources work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set multiple interrupts pending
      vic.interruptLatch = 0x05; // Raster + Sprite-Sprite

      // --- Test: Enable only one -> IRQ triggered
      vic.writeRegister(0x1a, 0x01); // Enable only raster
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ set

      // --- Test: Enable only the other -> IRQ still triggered
      vic.writeRegister(0x1a, 0x04); // Enable only sprite-sprite
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ set

      // --- Test: Enable both -> IRQ still triggered
      vic.writeRegister(0x1a, 0x05); // Enable both
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ set

      // --- Test: Disable all -> IRQ cleared
      vic.writeRegister(0x1a, 0x00); // Disable all
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ clear
    });

    it("Upper bits (7-4) are ignored", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Act: Write to upper bits
      vic.writeRegister(0x1a, 0xF5); // Upper bits set + valid lower bits

      // --- Assert: Only lower 4 bits are stored
      expect(vic.interruptEnable).toBe(0x05);
      expect(vic.registers[0x1a]).toBe(0x05);
    });

    it("Handles all possible enable values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 4-bit combinations
      for (let value = 0; value <= 0x0F; value++) {
        // --- Act
        vic.writeRegister(0x1a, value);

        // --- Assert
        expect(vic.interruptEnable).toBe(value);
        expect(vic.registers[0x1a]).toBe(value);
      }
    });

    it("Interrupt enable changes do not affect other registers", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial states
      vic.writeRegister(0x11, 0x1B); // Set $d011
      vic.writeRegister(0x18, 0x34); // Set $d018
      vic.interruptLatch = 0x02; // Set sprite-background collision

      // Store initial states
      const initialD011 = vic.registers[0x11];
      const initialD018 = vic.registers[0x18];
      const initialLatch = vic.interruptLatch;

      // --- Act: Change $d01a
      vic.writeRegister(0x1a, 0x0F); // Enable all interrupts

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x18]).toBe(initialD018);
      expect(vic.interruptLatch & 0x0F).toBe(initialLatch); // Latch unchanged (except IRQ bit)

      // Verify $d01a was set correctly
      expect(vic.interruptEnable).toBe(0x0F);
      expect(vic.registers[0x1a]).toBe(0x0F);
    });
  });

  describe("$D019/$D01A Interrupt System Integration Tests", () => {
    it("Complete interrupt cycle works correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Step 1: Enable raster interrupt
      vic.writeRegister(0x1a, 0x01);
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // No IRQ yet

      // --- Step 2: Simulate raster interrupt occurring
      vic.interruptLatch = 0x01; // Set raster interrupt bit
      vic.writeRegister(0x1a, 0x01); // Trigger IRQ update
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ should be active
      expect(vic.registers[0x19] & 0x01).toBe(0x01); // Raster bit set

      // --- Step 3: Clear interrupt
      vic.writeRegister(0x19, 0x01); // Clear raster interrupt
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ should be clear
      expect(vic.registers[0x19] & 0x01).toBe(0x00); // Raster bit clear

      // --- Step 4: Disable interrupt
      vic.writeRegister(0x1a, 0x00);
      expect(vic.interruptEnable).toBe(0x00);
    });

    it("Multiple interrupts with selective enable/disable", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set multiple interrupts pending
      vic.interruptLatch = 0x07; // Raster + Sprite-Background + Sprite-Sprite

      // --- Test: Enable subset -> IRQ triggered
      vic.writeRegister(0x1a, 0x03); // Enable raster + sprite-background
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ active

      // --- Test: Clear enabled interrupts -> IRQ remains due to other pending
      vic.writeRegister(0x19, 0x01); // Clear only raster
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ still active (sprite-background pending)

      // --- Test: Clear all enabled interrupts -> IRQ cleared
      vic.writeRegister(0x19, 0x02); // Clear sprite-background
      expect(vic.registers[0x19] & 0x80).toBe(0x00); // IRQ cleared

      // --- Test: Enable previously disabled interrupt -> IRQ triggered again
      vic.writeRegister(0x1a, 0x04); // Enable sprite-sprite (still pending)
      expect(vic.registers[0x19] & 0x80).toBe(0x80); // IRQ active again
    });
  });

  describe("$D01B Register (Sprite Data Priority) Tests", () => {
    it("Initializes $D01B register and sprite priority to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x1b]).toBe(0x00);
      expect(vic.spritePriority).toBe(0x00);  // All sprites behind foreground graphics
    });

    it("Sets individual sprite priority bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test each sprite priority bit individually
      const testCases = [
        { bit: 0x01, spriteNum: 0, name: "Sprite 0 priority" },
        { bit: 0x02, spriteNum: 1, name: "Sprite 1 priority" },
        { bit: 0x04, spriteNum: 2, name: "Sprite 2 priority" },
        { bit: 0x08, spriteNum: 3, name: "Sprite 3 priority" },
        { bit: 0x10, spriteNum: 4, name: "Sprite 4 priority" },
        { bit: 0x20, spriteNum: 5, name: "Sprite 5 priority" },
        { bit: 0x40, spriteNum: 6, name: "Sprite 6 priority" },
        { bit: 0x80, spriteNum: 7, name: "Sprite 7 priority" },
      ];

      testCases.forEach(({ bit, spriteNum, name }) => {
        // --- Act: Set single bit
        vic.writeRegister(0x1b, bit);
        
        // --- Assert
        expect(vic.spritePriority).toBe(bit);
        expect(vic.registers[0x1b]).toBe(bit);
        
        // Clear for next test
        vic.writeRegister(0x1b, 0x00);
        expect(vic.spritePriority).toBe(0x00);
      });
    });

    it("Sets multiple sprite priority bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test various combinations
      const testCases = [
        { value: 0x03, name: "Sprites 0-1 in front" },
        { value: 0x0F, name: "Sprites 0-3 in front" },
        { value: 0xF0, name: "Sprites 4-7 in front" },
        { value: 0xFF, name: "All sprites in front" },
        { value: 0x55, name: "Alternate sprites (0,2,4,6) in front" },
        { value: 0xAA, name: "Alternate sprites (1,3,5,7) in front" },
        { value: 0x81, name: "First and last sprites in front" },
        { value: 0x7E, name: "Middle sprites (1-6) in front" },
      ];

      testCases.forEach(({ value, name }) => {
        // --- Act
        vic.writeRegister(0x1b, value);
        
        // --- Assert
        expect(vic.spritePriority).toBe(value);
        expect(vic.registers[0x1b]).toBe(value);
      });
    });

    it("Handles all possible priority values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 8-bit combinations
      for (let value = 0; value <= 0xFF; value++) {
        // --- Act
        vic.writeRegister(0x1b, value);

        // --- Assert
        expect(vic.spritePriority).toBe(value);
        expect(vic.registers[0x1b]).toBe(value);
      }
    });

    it("Priority changes affect individual sprite behavior correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: All sprites behind foreground (default)
      vic.writeRegister(0x1b, 0x00);
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        expect((vic.spritePriority & spriteBit) === 0).toBe(true); // Sprite behind foreground
      }

      // --- Test: All sprites in front of foreground
      vic.writeRegister(0x1b, 0xFF);
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        expect((vic.spritePriority & spriteBit) !== 0).toBe(true); // Sprite in front of foreground
      }

      // --- Test: Mixed priorities
      vic.writeRegister(0x1b, 0x55); // Sprites 0,2,4,6 in front, 1,3,5,7 behind
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        const expectedInFront = (sprite % 2) === 0; // Even sprites in front
        expect((vic.spritePriority & spriteBit) !== 0).toBe(expectedInFront);
      }
    });

    it("Priority register changes do not affect other registers", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial states in other registers
      vic.writeRegister(0x11, 0x1B); // Set $d011
      vic.writeRegister(0x15, 0x3F); // Set sprite enable
      vic.writeRegister(0x1a, 0x0F); // Set interrupt enable
      vic.writeRegister(0x17, 0x55); // Set sprite Y expansion

      // Store initial states
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialD01A = vic.registers[0x1a];
      const initialD017 = vic.registers[0x17];

      // --- Act: Change sprite priority
      vic.writeRegister(0x1b, 0xAA);

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      expect(vic.registers[0x1a]).toBe(initialD01A);
      expect(vic.registers[0x17]).toBe(initialD017);

      // Verify sprite priority was set correctly
      expect(vic.spritePriority).toBe(0xAA);
      expect(vic.registers[0x1b]).toBe(0xAA);
    });

    it("Multiple consecutive writes work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of writes
      const sequence = [0x00, 0xFF, 0x55, 0xAA, 0x0F, 0xF0, 0x81, 0x7E];

      sequence.forEach((value) => {
        // --- Act
        vic.writeRegister(0x1b, value);

        // --- Assert
        expect(vic.spritePriority).toBe(value);
        expect(vic.registers[0x1b]).toBe(value);
      });
    });

    it("Priority bit interpretation is correct", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test bit meanings
      const testCases = [
        { value: 0x01, description: "Bit 0 = Sprite 0 in front" },
        { value: 0x02, description: "Bit 1 = Sprite 1 in front" },
        { value: 0x04, description: "Bit 2 = Sprite 2 in front" },
        { value: 0x08, description: "Bit 3 = Sprite 3 in front" },
        { value: 0x10, description: "Bit 4 = Sprite 4 in front" },
        { value: 0x20, description: "Bit 5 = Sprite 5 in front" },
        { value: 0x40, description: "Bit 6 = Sprite 6 in front" },
        { value: 0x80, description: "Bit 7 = Sprite 7 in front" },
      ];

      testCases.forEach(({ value, description }) => {
        // --- Act
        vic.writeRegister(0x1b, value);

        // --- Assert: Only the specific sprite bit is set
        expect(vic.spritePriority).toBe(value);
        
        // Check each sprite's priority state
        for (let sprite = 0; sprite < 8; sprite++) {
          const spriteBit = 1 << sprite;
          const expectedState = (value & spriteBit) !== 0;
          const actualState = (vic.spritePriority & spriteBit) !== 0;
          expect(actualState).toBe(expectedState);
        }
      });
    });

    it("Edge case values work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test edge cases
      const edgeCases = [
        { value: 0x00, name: "All sprites behind (minimum)" },
        { value: 0xFF, name: "All sprites in front (maximum)" },
        { value: 0x01, name: "Only first sprite in front" },
        { value: 0x80, name: "Only last sprite in front" },
        { value: 0xFE, name: "All except first sprite in front" },
        { value: 0x7F, name: "All except last sprite in front" },
      ];

      edgeCases.forEach(({ value, name }) => {
        // --- Act
        vic.writeRegister(0x1b, value);

        // --- Assert
        expect(vic.spritePriority).toBe(value);
        expect(vic.registers[0x1b]).toBe(value);
      });
    });

    it("Updates individual sprite priority flags in spriteData correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: Initial state - all sprites should have priority false
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].priority).toBe(false);
      }

      // --- Test: Set individual sprite priority bits and verify spriteData updates
      const testCases = [
        { bit: 0x01, spriteNum: 0, name: "Sprite 0 priority" },
        { bit: 0x02, spriteNum: 1, name: "Sprite 1 priority" },
        { bit: 0x04, spriteNum: 2, name: "Sprite 2 priority" },
        { bit: 0x08, spriteNum: 3, name: "Sprite 3 priority" },
        { bit: 0x10, spriteNum: 4, name: "Sprite 4 priority" },
        { bit: 0x20, spriteNum: 5, name: "Sprite 5 priority" },
        { bit: 0x40, spriteNum: 6, name: "Sprite 6 priority" },
        { bit: 0x80, spriteNum: 7, name: "Sprite 7 priority" },
      ];

      testCases.forEach(({ bit, spriteNum, name }) => {
        // --- Act: Set single sprite priority bit
        vic.writeRegister(0x1b, bit);
        
        // --- Assert: Check that only the target sprite has priority=true
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].priority).toBe(i === spriteNum);
        }
        
        // Clear for next test
        vic.writeRegister(0x1b, 0x00);
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].priority).toBe(false);
        }
      });

      // --- Test: Multiple bits set simultaneously
      vic.writeRegister(0x1b, 0x55); // Sprites 0,2,4,6 have priority
      for (let i = 0; i < 8; i++) {
        const expectedPriority = (i % 2) === 0; // Even sprites have priority
        expect(vic.spriteData[i].priority).toBe(expectedPriority);
      }

      // --- Test: All bits set
      vic.writeRegister(0x1b, 0xFF);
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].priority).toBe(true);
      }

      // --- Test: All bits cleared
      vic.writeRegister(0x1b, 0x00);
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].priority).toBe(false);
      }
    });
  });

  describe("$D01C Register (Sprite Multicolor) Tests", () => {
    it("Initializes $D01C register and sprite multicolor to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x1c]).toBe(0x00);
      expect(vic.spriteMulticolor).toBe(0x00);  // All sprites in standard mode
    });

    it("Sets individual sprite multicolor bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test each sprite multicolor bit individually
      const testCases = [
        { bit: 0x01, spriteNum: 0, name: "Sprite 0 multicolor" },
        { bit: 0x02, spriteNum: 1, name: "Sprite 1 multicolor" },
        { bit: 0x04, spriteNum: 2, name: "Sprite 2 multicolor" },
        { bit: 0x08, spriteNum: 3, name: "Sprite 3 multicolor" },
        { bit: 0x10, spriteNum: 4, name: "Sprite 4 multicolor" },
        { bit: 0x20, spriteNum: 5, name: "Sprite 5 multicolor" },
        { bit: 0x40, spriteNum: 6, name: "Sprite 6 multicolor" },
        { bit: 0x80, spriteNum: 7, name: "Sprite 7 multicolor" },
      ];

      testCases.forEach(({ bit, spriteNum, name }) => {
        // --- Act: Set single bit
        vic.writeRegister(0x1c, bit);
        
        // --- Assert
        expect(vic.spriteMulticolor).toBe(bit);
        expect(vic.registers[0x1c]).toBe(bit);
        
        // Clear for next test
        vic.writeRegister(0x1c, 0x00);
        expect(vic.spriteMulticolor).toBe(0x00);
      });
    });

    it("Sets multiple sprite multicolor bits correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test various combinations
      const testCases = [
        { value: 0x03, name: "Sprites 0-1 multicolor" },
        { value: 0x0F, name: "Sprites 0-3 multicolor" },
        { value: 0xF0, name: "Sprites 4-7 multicolor" },
        { value: 0xFF, name: "All sprites multicolor" },
        { value: 0x55, name: "Alternate sprites (0,2,4,6) multicolor" },
        { value: 0xAA, name: "Alternate sprites (1,3,5,7) multicolor" },
        { value: 0x81, name: "First and last sprites multicolor" },
        { value: 0x7E, name: "Middle sprites (1-6) multicolor" },
      ];

      testCases.forEach(({ value, name }) => {
        // --- Act
        vic.writeRegister(0x1c, value);
        
        // --- Assert
        expect(vic.spriteMulticolor).toBe(value);
        expect(vic.registers[0x1c]).toBe(value);
      });
    });

    it("Handles all possible multicolor values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 8-bit combinations
      for (let value = 0; value <= 0xFF; value++) {
        // --- Act
        vic.writeRegister(0x1c, value);

        // --- Assert
        expect(vic.spriteMulticolor).toBe(value);
        expect(vic.registers[0x1c]).toBe(value);
      }
    });

    it("Multicolor mode flags affect individual sprite behavior correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: All sprites in standard mode (default)
      vic.writeRegister(0x1c, 0x00);
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        expect((vic.spriteMulticolor & spriteBit) === 0).toBe(true); // Sprite in standard mode
      }

      // --- Test: All sprites in multicolor mode
      vic.writeRegister(0x1c, 0xFF);
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        expect((vic.spriteMulticolor & spriteBit) !== 0).toBe(true); // Sprite in multicolor mode
      }

      // --- Test: Mixed modes
      vic.writeRegister(0x1c, 0x55); // Sprites 0,2,4,6 multicolor, 1,3,5,7 standard
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        const expectedMulticolor = (sprite % 2) === 0; // Even sprites multicolor
        expect((vic.spriteMulticolor & spriteBit) !== 0).toBe(expectedMulticolor);
      }
    });

    it("Sprite mode interpretation is correct", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test standard mode behavior
      vic.writeRegister(0x1c, 0x00); // All sprites standard mode
      
      // In standard mode (MxMC=0):
      // - 8 pixels per byte (1 bit per pixel)
      // - "0": Transparent, "1": Sprite color
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        expect((vic.spriteMulticolor & spriteBit) === 0).toBe(true);
      }

      // --- Test multicolor mode behavior
      vic.writeRegister(0x1c, 0xFF); // All sprites multicolor mode
      
      // In multicolor mode (MxMC=1):
      // - 4 pixels per byte (2 bits per pixel)
      // - "00": Transparent, "01": Multicolor 0, "10": Sprite color, "11": Multicolor 1
      for (let sprite = 0; sprite < 8; sprite++) {
        const spriteBit = 1 << sprite;
        expect((vic.spriteMulticolor & spriteBit) !== 0).toBe(true);
      }
    });

    it("Multicolor register changes do not affect other registers", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial states in other registers
      vic.writeRegister(0x11, 0x1B); // Set $d011
      vic.writeRegister(0x15, 0x3F); // Set sprite enable
      vic.writeRegister(0x1a, 0x0F); // Set interrupt enable
      vic.writeRegister(0x1b, 0xAA); // Set sprite priority

      // Store initial states
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialD01A = vic.registers[0x1a];
      const initialD01B = vic.registers[0x1b];

      // --- Act: Change sprite multicolor
      vic.writeRegister(0x1c, 0x55);

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      expect(vic.registers[0x1a]).toBe(initialD01A);
      expect(vic.registers[0x1b]).toBe(initialD01B);

      // Verify sprite multicolor was set correctly
      expect(vic.spriteMulticolor).toBe(0x55);
      expect(vic.registers[0x1c]).toBe(0x55);
    });

    it("Multiple consecutive writes work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of writes
      const sequence = [0x00, 0xFF, 0x55, 0xAA, 0x0F, 0xF0, 0x81, 0x7E];

      sequence.forEach((value) => {
        // --- Act
        vic.writeRegister(0x1c, value);

        // --- Assert
        expect(vic.spriteMulticolor).toBe(value);
        expect(vic.registers[0x1c]).toBe(value);
      });
    });

    it("Bit interpretation for sprite multicolor is correct", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test bit meanings
      const testCases = [
        { value: 0x01, description: "Bit 0 = Sprite 0 multicolor" },
        { value: 0x02, description: "Bit 1 = Sprite 1 multicolor" },
        { value: 0x04, description: "Bit 2 = Sprite 2 multicolor" },
        { value: 0x08, description: "Bit 3 = Sprite 3 multicolor" },
        { value: 0x10, description: "Bit 4 = Sprite 4 multicolor" },
        { value: 0x20, description: "Bit 5 = Sprite 5 multicolor" },
        { value: 0x40, description: "Bit 6 = Sprite 6 multicolor" },
        { value: 0x80, description: "Bit 7 = Sprite 7 multicolor" },
      ];

      testCases.forEach(({ value, description }) => {
        // --- Act
        vic.writeRegister(0x1c, value);

        // --- Assert: Only the specific sprite bit is set
        expect(vic.spriteMulticolor).toBe(value);
        
        // Check each sprite's multicolor state
        for (let sprite = 0; sprite < 8; sprite++) {
          const spriteBit = 1 << sprite;
          const expectedState = (value & spriteBit) !== 0;
          const actualState = (vic.spriteMulticolor & spriteBit) !== 0;
          expect(actualState).toBe(expectedState);
        }
      });
    });

    it("Edge case values work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test edge cases
      const edgeCases = [
        { value: 0x00, name: "All sprites standard mode (minimum)" },
        { value: 0xFF, name: "All sprites multicolor mode (maximum)" },
        { value: 0x01, name: "Only first sprite multicolor" },
        { value: 0x80, name: "Only last sprite multicolor" },
        { value: 0xFE, name: "All except first sprite multicolor" },
        { value: 0x7F, name: "All except last sprite multicolor" },
      ];

      edgeCases.forEach(({ value, name }) => {
        // --- Act
        vic.writeRegister(0x1c, value);

        // --- Assert
        expect(vic.spriteMulticolor).toBe(value);
        expect(vic.registers[0x1c]).toBe(value);
      });
    });

    it("Color palette behavior with multicolor mode", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: Standard mode uses 2 colors per sprite
      vic.writeRegister(0x1c, 0x00); // All sprites standard mode
      
      // Standard mode colors:
      // - Transparent (background shows through)
      // - Sprite individual color ($D027-$D02E)
      expect(vic.spriteMulticolor).toBe(0x00);

      // --- Test: Multicolor mode uses 4 colors per sprite
      vic.writeRegister(0x1c, 0xFF); // All sprites multicolor mode
      
      // Multicolor mode colors:
      // - Transparent (background shows through)
      // - Sprite multicolor 0 ($D025) - shared by all multicolor sprites
      // - Sprite individual color ($D027-$D02E) - unique per sprite
      // - Sprite multicolor 1 ($D026) - shared by all multicolor sprites
      expect(vic.spriteMulticolor).toBe(0xFF);
    });

    it("Updates individual sprite multicolor flags in spriteData correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: Initial state - all sprites should have multicolor false
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].multicolor).toBe(false);
      }

      // --- Test: Set individual sprite multicolor bits and verify spriteData updates
      const testCases = [
        { bit: 0x01, spriteNum: 0, name: "Sprite 0 multicolor" },
        { bit: 0x02, spriteNum: 1, name: "Sprite 1 multicolor" },
        { bit: 0x04, spriteNum: 2, name: "Sprite 2 multicolor" },
        { bit: 0x08, spriteNum: 3, name: "Sprite 3 multicolor" },
        { bit: 0x10, spriteNum: 4, name: "Sprite 4 multicolor" },
        { bit: 0x20, spriteNum: 5, name: "Sprite 5 multicolor" },
        { bit: 0x40, spriteNum: 6, name: "Sprite 6 multicolor" },
        { bit: 0x80, spriteNum: 7, name: "Sprite 7 multicolor" },
      ];

      testCases.forEach(({ bit, spriteNum, name }) => {
        // --- Act: Set single sprite multicolor bit
        vic.writeRegister(0x1c, bit);
        
        // --- Assert: Check that only the target sprite has multicolor=true
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].multicolor).toBe(i === spriteNum);
        }
        
        // Clear for next test
        vic.writeRegister(0x1c, 0x00);
        for (let i = 0; i < 8; i++) {
          expect(vic.spriteData[i].multicolor).toBe(false);
        }
      });

      // --- Test: Multiple bits set simultaneously
      vic.writeRegister(0x1c, 0x55); // Sprites 0,2,4,6 are multicolor
      for (let i = 0; i < 8; i++) {
        const expectedMulticolor = (i % 2) === 0; // Even sprites are multicolor
        expect(vic.spriteData[i].multicolor).toBe(expectedMulticolor);
      }

      // --- Test: All bits set
      vic.writeRegister(0x1c, 0xFF);
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].multicolor).toBe(true);
      }

      // --- Test: All bits cleared
      vic.writeRegister(0x1c, 0x00);
      for (let i = 0; i < 8; i++) {
        expect(vic.spriteData[i].multicolor).toBe(false);
      }
    });
  });

  describe("$D020 Register (Border Color) Tests", () => {
    it("Initializes $D020 register and border color to default values", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Assert
      expect(vic.registers[0x20]).toBe(0x00);
      expect(vic.borderColor).toBe(0x00);  // Black (color index 0)
    });

    it("Sets valid color values correctly (0-15)", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all valid 4-bit color values (0-15)
      for (let color = 0; color <= 15; color++) {
        // --- Act
        vic.writeRegister(0x20, color);
        
        // --- Assert
        expect(vic.borderColor).toBe(color);
        expect(vic.registers[0x20]).toBe(color);
      }
    });

    it("Masks upper bits correctly (only lower 4 bits used)", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test values with upper bits set
      const testCases = [
        { input: 0x10, expected: 0x00, name: "0x10 -> 0x00 (bit 4 masked)" },
        { input: 0x1F, expected: 0x0F, name: "0x1F -> 0x0F (bit 4 masked)" },
        { input: 0x25, expected: 0x05, name: "0x25 -> 0x05 (bits 7-4 masked)" },
        { input: 0x3A, expected: 0x0A, name: "0x3A -> 0x0A (bits 7-4 masked)" },
        { input: 0x4C, expected: 0x0C, name: "0x4C -> 0x0C (bits 7-4 masked)" },
        { input: 0x77, expected: 0x07, name: "0x77 -> 0x07 (bits 7-4 masked)" },
        { input: 0x8E, expected: 0x0E, name: "0x8E -> 0x0E (bit 7 masked)" },
        { input: 0xFF, expected: 0x0F, name: "0xFF -> 0x0F (bits 7-4 masked)" },
      ];

      testCases.forEach(({ input, expected, name }) => {
        // --- Act
        vic.writeRegister(0x20, input);
        
        // --- Assert
        expect(vic.borderColor).toBe(expected);
        expect(vic.registers[0x20]).toBe(expected);
      });
    });

    it("Sets specific C64 colors correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test C64 color palette values
      const c64Colors = [
        { value: 0x00, name: "Black" },
        { value: 0x01, name: "White" },
        { value: 0x02, name: "Red" },
        { value: 0x03, name: "Cyan" },
        { value: 0x04, name: "Purple/Magenta" },
        { value: 0x05, name: "Green" },
        { value: 0x06, name: "Blue" },
        { value: 0x07, name: "Yellow" },
        { value: 0x08, name: "Orange" },
        { value: 0x09, name: "Brown" },
        { value: 0x0A, name: "Light Red" },
        { value: 0x0B, name: "Dark Gray" },
        { value: 0x0C, name: "Medium Gray" },
        { value: 0x0D, name: "Light Green" },
        { value: 0x0E, name: "Light Blue" },
        { value: 0x0F, name: "Light Gray" },
      ];

      c64Colors.forEach(({ value, name }) => {
        // --- Act
        vic.writeRegister(0x20, value);
        
        // --- Assert
        expect(vic.borderColor).toBe(value);
        expect(vic.registers[0x20]).toBe(value);
      });
    });

    it("Border color changes do not affect other registers", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // Set up some initial states in other registers
      vic.writeRegister(0x11, 0x1B); // Set $d011
      vic.writeRegister(0x15, 0x3F); // Set sprite enable
      vic.writeRegister(0x1a, 0x0F); // Set interrupt enable
      vic.writeRegister(0x1c, 0x55); // Set sprite multicolor

      // Store initial states
      const initialD011 = vic.registers[0x11];
      const initialD015 = vic.registers[0x15];
      const initialD01A = vic.registers[0x1a];
      const initialD01C = vic.registers[0x1c];

      // --- Act: Change border color
      vic.writeRegister(0x20, 0x0A); // Light Red

      // --- Assert: Other registers unchanged
      expect(vic.registers[0x11]).toBe(initialD011);
      expect(vic.registers[0x15]).toBe(initialD015);
      expect(vic.registers[0x1a]).toBe(initialD01A);
      expect(vic.registers[0x1c]).toBe(initialD01C);

      // Verify border color was set correctly
      expect(vic.borderColor).toBe(0x0A);
      expect(vic.registers[0x20]).toBe(0x0A);
    });

    it("Multiple consecutive writes work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test sequence of color changes
      const colorSequence = [0x00, 0x01, 0x02, 0x05, 0x0E, 0x0F, 0x07, 0x04];

      colorSequence.forEach((color) => {
        // --- Act
        vic.writeRegister(0x20, color);

        // --- Assert
        expect(vic.borderColor).toBe(color);
        expect(vic.registers[0x20]).toBe(color);
      });
    });

    it("Handles all possible 8-bit input values correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test all possible 8-bit input values
      for (let value = 0; value <= 0xFF; value++) {
        const expectedColor = value & 0x0F; // Expected 4-bit masked result

        // --- Act
        vic.writeRegister(0x20, value);

        // --- Assert
        expect(vic.borderColor).toBe(expectedColor);
        expect(vic.registers[0x20]).toBe(expectedColor);
      }
    });

    it("Color transitions work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: Start with black
      vic.writeRegister(0x20, 0x00);
      expect(vic.borderColor).toBe(0x00);

      // --- Test: Change to white
      vic.writeRegister(0x20, 0x01);
      expect(vic.borderColor).toBe(0x01);

      // --- Test: Change to each primary color
      vic.writeRegister(0x20, 0x02); // Red
      expect(vic.borderColor).toBe(0x02);

      vic.writeRegister(0x20, 0x05); // Green
      expect(vic.borderColor).toBe(0x05);

      vic.writeRegister(0x20, 0x06); // Blue
      expect(vic.borderColor).toBe(0x06);

      // --- Test: Back to black
      vic.writeRegister(0x20, 0x00);
      expect(vic.borderColor).toBe(0x00);
    });

    it("Edge case values work correctly", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test edge cases
      const edgeCases = [
        { value: 0x00, expected: 0x00, name: "Minimum valid color (black)" },
        { value: 0x0F, expected: 0x0F, name: "Maximum valid color (light gray)" },
        { value: 0x10, expected: 0x00, name: "Just above valid range" },
        { value: 0xF0, expected: 0x00, name: "High byte, low nibble 0" },
        { value: 0xFF, expected: 0x0F, name: "Maximum input value" },
      ];

      edgeCases.forEach(({ value, expected, name }) => {
        // --- Act
        vic.writeRegister(0x20, value);

        // --- Assert
        expect(vic.borderColor).toBe(expected);
        expect(vic.registers[0x20]).toBe(expected);
      });
    });

    it("Border color property reflects register state accurately", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      vic.reset();

      // --- Test: Property and register should always be in sync
      const testColors = [0x00, 0x07, 0x0E, 0x02, 0x0B, 0x0F];

      testColors.forEach((color) => {
        // --- Act
        vic.writeRegister(0x20, color);

        // --- Assert: Property matches register
        expect(vic.borderColor).toBe(vic.registers[0x20]);
        expect(vic.borderColor).toBe(color);
      });
    });
  });

  describe("$D021-$D024 Background Color Registers Tests", () => {
    describe("$D021 Register (Background Color 0) Tests", () => {
      it("Initializes $D021 register and background color 0 to default values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Assert
        expect(vic.registers[0x21]).toBe(0x00);
        expect(vic.backgroundColor0).toBe(0x00);  // Black (color index 0)
      });

      it("Sets valid color values correctly (0-15)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test all valid 4-bit color values (0-15)
        for (let color = 0; color <= 15; color++) {
          // --- Act
          vic.writeRegister(0x21, color);
          
          // --- Assert
          expect(vic.backgroundColor0).toBe(color);
          expect(vic.registers[0x21]).toBe(color);
        }
      });

      it("Masks upper bits correctly (only lower 4 bits used)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test values with upper bits set
        const testCases = [
          { input: 0x10, expected: 0x00 },
          { input: 0x1F, expected: 0x0F },
          { input: 0x25, expected: 0x05 },
          { input: 0xFF, expected: 0x0F },
        ];

        testCases.forEach(({ input, expected }) => {
          // --- Act
          vic.writeRegister(0x21, input);
          
          // --- Assert
          expect(vic.backgroundColor0).toBe(expected);
          expect(vic.registers[0x21]).toBe(expected);
        });
      });
    });

    describe("$D022 Register (Background Color 1) Tests", () => {
      it("Initializes $D022 register and background color 1 to default values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Assert
        expect(vic.registers[0x22]).toBe(0x00);
        expect(vic.backgroundColor1).toBe(0x00);  // Black (color index 0)
      });

      it("Sets valid color values correctly (0-15)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test all valid 4-bit color values (0-15)
        for (let color = 0; color <= 15; color++) {
          // --- Act
          vic.writeRegister(0x22, color);
          
          // --- Assert
          expect(vic.backgroundColor1).toBe(color);
          expect(vic.registers[0x22]).toBe(color);
        }
      });

      it("Masks upper bits correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test values with upper bits set
        vic.writeRegister(0x22, 0xFF);
        expect(vic.backgroundColor1).toBe(0x0F);
        expect(vic.registers[0x22]).toBe(0x0F);
      });
    });

    describe("$D023 Register (Background Color 2) Tests", () => {
      it("Initializes $D023 register and background color 2 to default values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Assert
        expect(vic.registers[0x23]).toBe(0x00);
        expect(vic.backgroundColor2).toBe(0x00);  // Black (color index 0)
      });

      it("Sets valid color values correctly (0-15)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test all valid 4-bit color values (0-15)
        for (let color = 0; color <= 15; color++) {
          // --- Act
          vic.writeRegister(0x23, color);
          
          // --- Assert
          expect(vic.backgroundColor2).toBe(color);
          expect(vic.registers[0x23]).toBe(color);
        }
      });

      it("Masks upper bits correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test values with upper bits set
        vic.writeRegister(0x23, 0xFF);
        expect(vic.backgroundColor2).toBe(0x0F);
        expect(vic.registers[0x23]).toBe(0x0F);
      });
    });

    describe("$D024 Register (Background Color 3) Tests", () => {
      it("Initializes $D024 register and background color 3 to default values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Assert
        expect(vic.registers[0x24]).toBe(0x00);
        expect(vic.backgroundColor3).toBe(0x00);  // Black (color index 0)
      });

      it("Sets valid color values correctly (0-15)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test all valid 4-bit color values (0-15)
        for (let color = 0; color <= 15; color++) {
          // --- Act
          vic.writeRegister(0x24, color);
          
          // --- Assert
          expect(vic.backgroundColor3).toBe(color);
          expect(vic.registers[0x24]).toBe(color);
        }
      });

      it("Masks upper bits correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test values with upper bits set
        vic.writeRegister(0x24, 0xFF);
        expect(vic.backgroundColor3).toBe(0x0F);
        expect(vic.registers[0x24]).toBe(0x0F);
      });
    });

    describe("Background Colors Integration Tests", () => {
      it("All background colors can be set independently", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Act: Set each background color to a different value
        vic.writeRegister(0x21, 0x01); // Background 0 = White
        vic.writeRegister(0x22, 0x02); // Background 1 = Red  
        vic.writeRegister(0x23, 0x05); // Background 2 = Green
        vic.writeRegister(0x24, 0x06); // Background 3 = Blue

        // --- Assert: Each color is independent
        expect(vic.backgroundColor0).toBe(0x01);
        expect(vic.backgroundColor1).toBe(0x02);
        expect(vic.backgroundColor2).toBe(0x05);
        expect(vic.backgroundColor3).toBe(0x06);

        expect(vic.registers[0x21]).toBe(0x01);
        expect(vic.registers[0x22]).toBe(0x02);
        expect(vic.registers[0x23]).toBe(0x05);
        expect(vic.registers[0x24]).toBe(0x06);
      });

      it("Background color changes do not affect other color registers", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // Set border color
        vic.writeRegister(0x20, 0x0E); // Light Blue border

        // --- Act: Change each background color
        vic.writeRegister(0x21, 0x07); // Background 0 = Yellow
        vic.writeRegister(0x22, 0x04); // Background 1 = Purple
        vic.writeRegister(0x23, 0x03); // Background 2 = Cyan
        vic.writeRegister(0x24, 0x09); // Background 3 = Brown

        // --- Assert: Border color unchanged
        expect(vic.borderColor).toBe(0x0E);
        expect(vic.registers[0x20]).toBe(0x0E);

        // All background colors set correctly
        expect(vic.backgroundColor0).toBe(0x07);
        expect(vic.backgroundColor1).toBe(0x04);
        expect(vic.backgroundColor2).toBe(0x03);
        expect(vic.backgroundColor3).toBe(0x09);
      });

      it("Graphics mode usage scenarios work correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test: Standard text mode (only background 0 used)
        vic.writeRegister(0x21, 0x06); // Blue background
        expect(vic.backgroundColor0).toBe(0x06);

        // --- Test: Multicolor text mode (background 0-2 used)
        vic.writeRegister(0x21, 0x00); // Background 0 = Black
        vic.writeRegister(0x22, 0x01); // Background 1 = White  
        vic.writeRegister(0x23, 0x02); // Background 2 = Red
        expect(vic.backgroundColor0).toBe(0x00);
        expect(vic.backgroundColor1).toBe(0x01);
        expect(vic.backgroundColor2).toBe(0x02);

        // --- Test: Extended Color Mode (all 4 backgrounds used)
        vic.writeRegister(0x21, 0x00); // Background 0 = Black
        vic.writeRegister(0x22, 0x0B); // Background 1 = Dark Gray
        vic.writeRegister(0x23, 0x0C); // Background 2 = Medium Gray
        vic.writeRegister(0x24, 0x0F); // Background 3 = Light Gray
        expect(vic.backgroundColor0).toBe(0x00);
        expect(vic.backgroundColor1).toBe(0x0B);
        expect(vic.backgroundColor2).toBe(0x0C);
        expect(vic.backgroundColor3).toBe(0x0F);
      });

      it("Color palette compatibility works correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test: Set all backgrounds to different C64 palette colors
        const c64Colors = [
          { reg: 0x21, color: 0x00, name: "Black" },
          { reg: 0x22, color: 0x07, name: "Yellow" },
          { reg: 0x23, color: 0x0D, name: "Light Green" },
          { reg: 0x24, color: 0x0E, name: "Light Blue" },
        ];

        c64Colors.forEach(({ reg, color, name }) => {
          // --- Act
          vic.writeRegister(reg, color);

          // --- Assert
          const bgIndex = reg - 0x21;
          const bgProperty = [vic.backgroundColor0, vic.backgroundColor1, vic.backgroundColor2, vic.backgroundColor3][bgIndex];
          expect(bgProperty).toBe(color);
          expect(vic.registers[reg]).toBe(color);
        });
      });

      it("Handles all possible 8-bit input values correctly for all registers", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test each background register with various input values
        const registers = [0x21, 0x22, 0x23, 0x24];
        const properties = ['backgroundColor0', 'backgroundColor1', 'backgroundColor2', 'backgroundColor3'];

        registers.forEach((reg, index) => {
          const property = properties[index];

          // Test a few representative values
          const testValues = [0x00, 0x0F, 0x10, 0x1F, 0x80, 0xFF];
          
          testValues.forEach((value) => {
            const expectedColor = value & 0x0F;

            // --- Act
            vic.writeRegister(reg, value);

            // --- Assert
            expect((vic as any)[property]).toBe(expectedColor);
            expect(vic.registers[reg]).toBe(expectedColor);
          });
        });
      });
    });
  });

  // =============================================================================================
  // $D025-$D026 Sprite Multicolor Color Registers Tests
  // =============================================================================================
  
  describe("$D025-$D026 Sprite Multicolor Color Registers Tests", () => {
    describe("$D025 Register (Sprite Multicolor 0) Tests", () => {
      it("Initializes to 0 after reset", () => {
        // --- Arrange
        const vic = c64.vicDevice;

        // --- Act
        vic.reset();

        // --- Assert
        expect(vic.spriteMulticolor0).toBe(0);
        expect(vic.registers[0x25]).toBe(0);
      });

      it("Sets sprite multicolor 0 correctly for valid color values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        const testCases = [
          { value: 0x00, expected: 0x00, description: "Black" },
          { value: 0x01, expected: 0x01, description: "White" },
          { value: 0x02, expected: 0x02, description: "Red" },
          { value: 0x05, expected: 0x05, description: "Green" },
          { value: 0x06, expected: 0x06, description: "Blue" },
          { value: 0x07, expected: 0x07, description: "Yellow" },
          { value: 0x0F, expected: 0x0F, description: "Light Gray" },
        ];

        testCases.forEach(({ value, expected, description }) => {
          // --- Act
          vic.writeRegister(0x25, value);

          // --- Assert
          expect(vic.spriteMulticolor0).toBe(expected);
          expect(vic.registers[0x25]).toBe(expected);
        });
      });

      it("Masks high nibble correctly (only bits 0-3 are used)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        const testCases = [
          { input: 0x10, expected: 0x00 }, // High bit set
          { input: 0x1F, expected: 0x0F }, // All bits set
          { input: 0xA5, expected: 0x05 }, // Mixed bits
          { input: 0xFF, expected: 0x0F }, // All bits set
          { input: 0x80, expected: 0x00 }, // Only high bit
          { input: 0x9A, expected: 0x0A }, // High bits + valid color
        ];

        testCases.forEach(({ input, expected }) => {
          // --- Act
          vic.writeRegister(0x25, input);

          // --- Assert
          expect(vic.spriteMulticolor0).toBe(expected);
          expect(vic.registers[0x25]).toBe(expected);
        });
      });

      it("Handles boundary values correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test minimum value
        vic.writeRegister(0x25, 0x00);
        expect(vic.spriteMulticolor0).toBe(0x00);

        // --- Test maximum valid color value
        vic.writeRegister(0x25, 0x0F);
        expect(vic.spriteMulticolor0).toBe(0x0F);

        // --- Test maximum 8-bit value
        vic.writeRegister(0x25, 0xFF);
        expect(vic.spriteMulticolor0).toBe(0x0F);
      });

      it("Subsequent writes overwrite previous values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Act & Assert: Multiple writes
        vic.writeRegister(0x25, 0x01); // White
        expect(vic.spriteMulticolor0).toBe(0x01);

        vic.writeRegister(0x25, 0x02); // Red
        expect(vic.spriteMulticolor0).toBe(0x02);

        vic.writeRegister(0x25, 0x07); // Yellow
        expect(vic.spriteMulticolor0).toBe(0x07);

        vic.writeRegister(0x25, 0x00); // Black
        expect(vic.spriteMulticolor0).toBe(0x00);
      });
    });

    describe("$D026 Register (Sprite Multicolor 1) Tests", () => {
      it("Initializes to 0 after reset", () => {
        // --- Arrange
        const vic = c64.vicDevice;

        // --- Act
        vic.reset();

        // --- Assert
        expect(vic.spriteMulticolor1).toBe(0);
        expect(vic.registers[0x26]).toBe(0);
      });

      it("Sets sprite multicolor 1 correctly for valid color values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        const testCases = [
          { value: 0x00, expected: 0x00, description: "Black" },
          { value: 0x01, expected: 0x01, description: "White" },
          { value: 0x02, expected: 0x02, description: "Red" },
          { value: 0x05, expected: 0x05, description: "Green" },
          { value: 0x06, expected: 0x06, description: "Blue" },
          { value: 0x07, expected: 0x07, description: "Yellow" },
          { value: 0x0F, expected: 0x0F, description: "Light Gray" },
        ];

        testCases.forEach(({ value, expected, description }) => {
          // --- Act
          vic.writeRegister(0x26, value);

          // --- Assert
          expect(vic.spriteMulticolor1).toBe(expected);
          expect(vic.registers[0x26]).toBe(expected);
        });
      });

      it("Masks high nibble correctly (only bits 0-3 are used)", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        const testCases = [
          { input: 0x10, expected: 0x00 }, // High bit set
          { input: 0x1F, expected: 0x0F }, // All bits set
          { input: 0xB3, expected: 0x03 }, // Mixed bits
          { input: 0xFF, expected: 0x0F }, // All bits set
          { input: 0x80, expected: 0x00 }, // Only high bit
          { input: 0xC7, expected: 0x07 }, // High bits + valid color
        ];

        testCases.forEach(({ input, expected }) => {
          // --- Act
          vic.writeRegister(0x26, input);

          // --- Assert
          expect(vic.spriteMulticolor1).toBe(expected);
          expect(vic.registers[0x26]).toBe(expected);
        });
      });

      it("Handles boundary values correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test minimum value
        vic.writeRegister(0x26, 0x00);
        expect(vic.spriteMulticolor1).toBe(0x00);

        // --- Test maximum valid color value
        vic.writeRegister(0x26, 0x0F);
        expect(vic.spriteMulticolor1).toBe(0x0F);

        // --- Test maximum 8-bit value
        vic.writeRegister(0x26, 0xFF);
        expect(vic.spriteMulticolor1).toBe(0x0F);
      });

      it("Subsequent writes overwrite previous values", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Act & Assert: Multiple writes
        vic.writeRegister(0x26, 0x05); // Green
        expect(vic.spriteMulticolor1).toBe(0x05);

        vic.writeRegister(0x26, 0x0A); // Light Red
        expect(vic.spriteMulticolor1).toBe(0x0A);

        vic.writeRegister(0x26, 0x0E); // Light Blue
        expect(vic.spriteMulticolor1).toBe(0x0E);

        vic.writeRegister(0x26, 0x08); // Orange
        expect(vic.spriteMulticolor1).toBe(0x08);
      });
    });

    describe("Sprite Multicolor Colors Integration Tests", () => {
      it("Both sprite multicolor colors work independently", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Act: Set both multicolor colors to different values
        vic.writeRegister(0x25, 0x01); // Sprite multicolor 0 = White
        vic.writeRegister(0x26, 0x02); // Sprite multicolor 1 = Red

        // --- Assert: Each color is independent
        expect(vic.spriteMulticolor0).toBe(0x01);
        expect(vic.spriteMulticolor1).toBe(0x02);

        expect(vic.registers[0x25]).toBe(0x01);
        expect(vic.registers[0x26]).toBe(0x02);
      });

      it("Sprite multicolor changes do not affect other color registers", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // Set other colors
        vic.writeRegister(0x20, 0x0E); // Light Blue border
        vic.writeRegister(0x21, 0x07); // Yellow background

        // --- Act: Change sprite multicolor colors
        vic.writeRegister(0x25, 0x05); // Green multicolor 0
        vic.writeRegister(0x26, 0x0A); // Light Red multicolor 1

        // --- Assert: Other colors unchanged
        expect(vic.borderColor).toBe(0x0E);
        expect(vic.backgroundColor0).toBe(0x07);
        expect(vic.registers[0x20]).toBe(0x0E);
        expect(vic.registers[0x21]).toBe(0x07);

        // Sprite multicolor colors set correctly
        expect(vic.spriteMulticolor0).toBe(0x05);
        expect(vic.spriteMulticolor1).toBe(0x0A);
      });

      it("Sprite multicolor usage scenarios work correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test: Standard sprite mode (multicolor registers not used)
        vic.writeRegister(0x25, 0x08); // Orange multicolor 0
        vic.writeRegister(0x26, 0x09); // Brown multicolor 1
        expect(vic.spriteMulticolor0).toBe(0x08);
        expect(vic.spriteMulticolor1).toBe(0x09);

        // --- Test: Multicolor sprite mode setup
        // In multicolor mode, sprites use these shared colors:
        // 00 = transparent, 01 = multicolor 0, 10 = individual sprite color, 11 = multicolor 1
        vic.writeRegister(0x25, 0x01); // Multicolor 0 = White (01 pattern)
        vic.writeRegister(0x26, 0x02); // Multicolor 1 = Red (11 pattern)
        expect(vic.spriteMulticolor0).toBe(0x01);
        expect(vic.spriteMulticolor1).toBe(0x02);

        // Individual sprite colors would be set in $D027-$D02E (10 pattern)
        // Sprite multicolor enable is controlled by $D01C
      });

      it("Color palette compatibility works correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test: Set multicolor colors to different C64 palette colors
        const c64Colors = [
          { reg: 0x25, color: 0x04, name: "Purple", property: "spriteMulticolor0" },
          { reg: 0x26, color: 0x0D, name: "Light Green", property: "spriteMulticolor1" },
        ];

        c64Colors.forEach(({ reg, color, name, property }) => {
          // --- Act
          vic.writeRegister(reg, color);

          // --- Assert
          expect((vic as any)[property]).toBe(color);
          expect(vic.registers[reg]).toBe(color);
        });
      });

      it("Handles all possible 8-bit input values correctly for both registers", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test each sprite multicolor register with various input values
        const registers = [0x25, 0x26];
        const properties = ['spriteMulticolor0', 'spriteMulticolor1'];

        registers.forEach((reg, index) => {
          const property = properties[index];

          // Test a few representative values
          const testValues = [0x00, 0x0F, 0x10, 0x1F, 0x80, 0xFF];
          
          testValues.forEach((value) => {
            const expectedColor = value & 0x0F;

            // --- Act
            vic.writeRegister(reg, value);

            // --- Assert
            expect((vic as any)[property]).toBe(expectedColor);
            expect(vic.registers[reg]).toBe(expectedColor);
          });
        });
      });
    });
  });

  // =============================================================================================
  // $D027-$D02E Individual Sprite Color Registers Tests  
  // =============================================================================================
  
  describe("$D027-$D02E Individual Sprite Color Registers Tests", () => {
    describe("Individual Sprite Color Register Tests", () => {
      const spriteTests = [
        { reg: 0x27, spriteIndex: 0, name: "Sprite 0" },
        { reg: 0x28, spriteIndex: 1, name: "Sprite 1" },
        { reg: 0x29, spriteIndex: 2, name: "Sprite 2" },
        { reg: 0x2A, spriteIndex: 3, name: "Sprite 3" },
        { reg: 0x2B, spriteIndex: 4, name: "Sprite 4" },
        { reg: 0x2C, spriteIndex: 5, name: "Sprite 5" },
        { reg: 0x2D, spriteIndex: 6, name: "Sprite 6" },
        { reg: 0x2E, spriteIndex: 7, name: "Sprite 7" },
      ];

      spriteTests.forEach(({ reg, spriteIndex, name }) => {
        describe(`$D0${reg.toString(16).toUpperCase()} Register (${name} Color) Tests`, () => {
          it("Initializes to 0 after reset", () => {
            // --- Arrange
            const vic = c64.vicDevice;

            // --- Act
            vic.reset();

            // --- Assert
            expect(vic.spriteData[spriteIndex].color).toBe(0);
            expect(vic.registers[reg]).toBe(0);
          });

          it("Sets sprite color correctly for valid color values", () => {
            // --- Arrange
            const vic = c64.vicDevice;
            vic.reset();

            const testCases = [
              { value: 0x00, expected: 0x00, description: "Black" },
              { value: 0x01, expected: 0x01, description: "White" },
              { value: 0x02, expected: 0x02, description: "Red" },
              { value: 0x05, expected: 0x05, description: "Green" },
              { value: 0x06, expected: 0x06, description: "Blue" },
              { value: 0x07, expected: 0x07, description: "Yellow" },
              { value: 0x0F, expected: 0x0F, description: "Light Gray" },
            ];

            testCases.forEach(({ value, expected, description }) => {
              // --- Act
              vic.writeRegister(reg, value);

              // --- Assert
              expect(vic.spriteData[spriteIndex].color).toBe(expected);
              expect(vic.registers[reg]).toBe(expected);
            });
          });

          it("Masks high nibble correctly (only bits 0-3 are used)", () => {
            // --- Arrange
            const vic = c64.vicDevice;
            vic.reset();

            const testCases = [
              { input: 0x10, expected: 0x00 }, // High bit set
              { input: 0x1F, expected: 0x0F }, // All bits set
              { input: 0xA5, expected: 0x05 }, // Mixed bits
              { input: 0xFF, expected: 0x0F }, // All bits set
              { input: 0x80, expected: 0x00 }, // Only high bit
              { input: 0x90 + spriteIndex, expected: spriteIndex }, // High bits + sprite index
            ];

            testCases.forEach(({ input, expected }) => {
              // --- Act
              vic.writeRegister(reg, input);

              // --- Assert
              expect(vic.spriteData[spriteIndex].color).toBe(expected);
              expect(vic.registers[reg]).toBe(expected);
            });
          });

          it("Handles boundary values correctly", () => {
            // --- Arrange
            const vic = c64.vicDevice;
            vic.reset();

            // --- Test minimum value
            vic.writeRegister(reg, 0x00);
            expect(vic.spriteData[spriteIndex].color).toBe(0x00);

            // --- Test maximum valid color value
            vic.writeRegister(reg, 0x0F);
            expect(vic.spriteData[spriteIndex].color).toBe(0x0F);

            // --- Test maximum 8-bit value
            vic.writeRegister(reg, 0xFF);
            expect(vic.spriteData[spriteIndex].color).toBe(0x0F);
          });

          it("Subsequent writes overwrite previous values", () => {
            // --- Arrange
            const vic = c64.vicDevice;
            vic.reset();

            // --- Act & Assert: Multiple writes
            vic.writeRegister(reg, 0x01); // White
            expect(vic.spriteData[spriteIndex].color).toBe(0x01);

            vic.writeRegister(reg, 0x02); // Red
            expect(vic.spriteData[spriteIndex].color).toBe(0x02);

            vic.writeRegister(reg, 0x07); // Yellow
            expect(vic.spriteData[spriteIndex].color).toBe(0x07);

            vic.writeRegister(reg, 0x00); // Black
            expect(vic.spriteData[spriteIndex].color).toBe(0x00);
          });
        });
      });
    });

    describe("Sprite Color Integration Tests", () => {
      it("All sprite colors work independently", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Act: Set each sprite to a different color
        const colors = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
        colors.forEach((color, index) => {
          vic.writeRegister(0x27 + index, color);
        });

        // --- Assert: Each sprite has its own color
        expect(vic.spriteData[0].color).toBe(0x01);
        expect(vic.spriteData[1].color).toBe(0x02);
        expect(vic.spriteData[2].color).toBe(0x03);
        expect(vic.spriteData[3].color).toBe(0x04);
        expect(vic.spriteData[4].color).toBe(0x05);
        expect(vic.spriteData[5].color).toBe(0x06);
        expect(vic.spriteData[6].color).toBe(0x07);
        expect(vic.spriteData[7].color).toBe(0x08);

        // Check register values
        colors.forEach((color, index) => {
          expect(vic.registers[0x27 + index]).toBe(color);
        });
      });

      it("Sprite color changes do not affect other color registers", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // Set other colors
        vic.writeRegister(0x20, 0x0E); // Light Blue border
        vic.writeRegister(0x21, 0x07); // Yellow background
        vic.writeRegister(0x25, 0x05); // Green sprite multicolor 0
        vic.writeRegister(0x26, 0x0A); // Light Red sprite multicolor 1

        // --- Act: Change sprite colors
        vic.writeRegister(0x27, 0x01); // White sprite 0
        vic.writeRegister(0x28, 0x02); // Red sprite 1

        // --- Assert: Other colors unchanged
        expect(vic.borderColor).toBe(0x0E);
        expect(vic.backgroundColor0).toBe(0x07);
        expect(vic.spriteMulticolor0).toBe(0x05);
        expect(vic.spriteMulticolor1).toBe(0x0A);

        // Sprite colors set correctly
        expect(vic.spriteData[0].color).toBe(0x01);
        expect(vic.spriteData[1].color).toBe(0x02);
      });

      it("Sprite color usage scenarios work correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test: Standard sprite mode setup
        // In standard mode, sprite pixels use individual sprite colors (bit pattern "1")
        const standardColors = [0x01, 0x07, 0x05, 0x0A, 0x04, 0x0E, 0x0C, 0x09];
        standardColors.forEach((color, index) => {
          vic.writeRegister(0x27 + index, color);
        });

        standardColors.forEach((color, index) => {
          expect(vic.spriteData[index].color).toBe(color);
        });

        // --- Test: Multicolor sprite mode setup
        // In multicolor mode, individual sprite colors are used for "10" bit pattern
        // Set different colors for multicolor mode
        const multicolorColors = [0x0F, 0x00, 0x03, 0x0D, 0x06, 0x08, 0x0B, 0x02];
        multicolorColors.forEach((color, index) => {
          vic.writeRegister(0x27 + index, color);
        });

        multicolorColors.forEach((color, index) => {
          expect(vic.spriteData[index].color).toBe(color);
        });
      });

      it("Color palette compatibility works correctly", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test: Set sprite colors to different C64 palette colors
        const c64Colors = [
          { reg: 0x27, color: 0x00, name: "Black", spriteIndex: 0 },
          { reg: 0x28, color: 0x01, name: "White", spriteIndex: 1 },
          { reg: 0x29, color: 0x02, name: "Red", spriteIndex: 2 },
          { reg: 0x2A, color: 0x03, name: "Cyan", spriteIndex: 3 },
          { reg: 0x2B, color: 0x04, name: "Purple", spriteIndex: 4 },
          { reg: 0x2C, color: 0x05, name: "Green", spriteIndex: 5 },
          { reg: 0x2D, color: 0x06, name: "Blue", spriteIndex: 6 },
          { reg: 0x2E, color: 0x07, name: "Yellow", spriteIndex: 7 },
        ];

        c64Colors.forEach(({ reg, color, name, spriteIndex }) => {
          // --- Act
          vic.writeRegister(reg, color);

          // --- Assert
          expect(vic.spriteData[spriteIndex].color).toBe(color);
          expect(vic.registers[reg]).toBe(color);
        });
      });

      it("Handles all possible 8-bit input values correctly for all sprite registers", () => {
        // --- Arrange
        const vic = c64.vicDevice;
        vic.reset();

        // --- Test each sprite color register with various input values
        const registers = [0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E];

        registers.forEach((reg, index) => {
          // Test a few representative values
          const testValues = [0x00, 0x0F, 0x10, 0x1F, 0x80, 0xFF];
          
          testValues.forEach((value) => {
            const expectedColor = value & 0x0F;

            // --- Act
            vic.writeRegister(reg, value);

            // --- Assert
            expect(vic.spriteData[index].color).toBe(expectedColor);
            expect(vic.registers[reg]).toBe(expectedColor);
          });
        });
      });

      it("Sprite color register mapping is correct", () => {
        // --- Arrange
        const vic = c64.vicDevice;

        // --- Test: Verify each register maps to the correct sprite
        const mappings = [
          { reg: 0x27, sprite: 0 },
          { reg: 0x28, sprite: 1 },
          { reg: 0x29, sprite: 2 },
          { reg: 0x2A, sprite: 3 },
          { reg: 0x2B, sprite: 4 },
          { reg: 0x2C, sprite: 5 },
          { reg: 0x2D, sprite: 6 },
          { reg: 0x2E, sprite: 7 },
        ];

        mappings.forEach(({ reg, sprite }) => {
          // Reset for each sprite test to ensure clean state
          vic.reset();
          
          const testColor = sprite + 1; // Use sprite index + 1 as test color

          // --- Act
          vic.writeRegister(reg, testColor);

          // --- Assert
          expect(vic.spriteData[sprite].color).toBe(testColor);
          expect(vic.registers[reg]).toBe(testColor);
          
          // Verify other sprites are not affected
          mappings.forEach(({ sprite: otherSprite }) => {
            if (otherSprite !== sprite) {
              expect(vic.spriteData[otherSprite].color).toBe(0); // Should still be 0 from reset
            }
          });
        });
      });
    });
  });

  describe("CIA2-VIC Bank Integration", () => {
    it("Should have default VIC bank 0 on reset", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      const cia2 = c64.cia2Device;
      
      // --- Act
      vic.reset();
      cia2.reset();
      
      // --- Assert
      expect(vic.getBaseBank()).toBe(0x0000); // Bank 0 = $0000
      expect(cia2.vicMemoryBank).toBe(0); // CIA2 should default to bank 0
    });

    it("Should update VIC base address when CIA2 VIC bank changes via Port A", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      const cia2 = c64.cia2Device;
      vic.reset();
      cia2.reset();
      
      // --- Act & Assert for each bank
      
      // Bank 0: CIA2 Port A bits 4-5 = 11 (inverted) -> bank 0
      cia2.writeRegister(0x00, 0x30); // Set bits 4-5 to 11
      expect(cia2.vicMemoryBank).toBe(0);
      expect(vic.getBaseBank()).toBe(0x0000);
      
      // Bank 1: CIA2 Port A bits 4-5 = 10 (inverted) -> bank 1
      cia2.writeRegister(0x00, 0x20); // Set bits 4-5 to 10
      expect(cia2.vicMemoryBank).toBe(1);
      expect(vic.getBaseBank()).toBe(0x4000);
      
      // Bank 2: CIA2 Port A bits 4-5 = 01 (inverted) -> bank 2
      cia2.writeRegister(0x00, 0x10); // Set bits 4-5 to 01
      expect(cia2.vicMemoryBank).toBe(2);
      expect(vic.getBaseBank()).toBe(0x8000);
      
      // Bank 3: CIA2 Port A bits 4-5 = 00 (inverted) -> bank 3
      cia2.writeRegister(0x00, 0x00); // Set bits 4-5 to 00
      expect(cia2.vicMemoryBank).toBe(3);
      expect(vic.getBaseBank()).toBe(0xC000);
    });

    it("Should update VIC base address when CIA2 VIC bank changes via vicMemoryBank property", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      const cia2 = c64.cia2Device;
      vic.reset();
      cia2.reset();
      
      // --- Act & Assert for each bank
      
      // Bank 0
      cia2.vicMemoryBank = 0;
      expect(vic.getBaseBank()).toBe(0x0000);
      
      // Bank 1
      cia2.vicMemoryBank = 1;
      expect(vic.getBaseBank()).toBe(0x4000);
      
      // Bank 2
      cia2.vicMemoryBank = 2;
      expect(vic.getBaseBank()).toBe(0x8000);
      
      // Bank 3
      cia2.vicMemoryBank = 3;
      expect(vic.getBaseBank()).toBe(0xC000);
    });

    it("Should handle invalid bank values gracefully", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      
      // --- Act & Assert
      vic.setBaseBank(4); // Invalid bank (> 3)
      expect(vic.getBaseBank()).toBe(0x0000); // Should wrap to bank 0
      
      vic.setBaseBank(7); // Invalid bank (> 3)
      expect(vic.getBaseBank()).toBe(0xC000); // Should wrap to bank 3 (7 & 3 = 3)
      
      vic.setBaseBank(-1); // Negative bank
      expect(vic.getBaseBank()).toBe(0xC000); // Should wrap to bank 3 (-1 & 3 = 3)
    });

    it("Should not affect other CIA2 Port A bits when changing VIC bank", () => {
      // --- Arrange
      const vic = c64.vicDevice;
      const cia2 = c64.cia2Device;
      vic.reset();
      cia2.reset();
      
      // --- Set some IEC bus bits (bits 0-2) and other bits
      cia2.writeRegister(0x00, 0x47); // Set bits 0, 1, 2, 6 and VIC bank bits to 10 (bank 1)
      
      // --- Act
      cia2.vicMemoryBank = 2; // Change VIC bank to 2
      
      // --- Assert
      const portAValue = cia2.readRegister(0x00);
      expect(portAValue & 0x07).toBe(0x07); // IEC bits (0-2) should be preserved
      expect(portAValue & 0x40).toBe(0x40); // Bit 6 should be preserved
      expect((portAValue & 0x30) >> 4).toBe(0x01); // VIC bank bits should be 01 (inverted bank 2)
      expect(vic.getBaseBank()).toBe(0x8000); // VIC should be at bank 2
    });
  });
});
