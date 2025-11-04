import { C64Machine } from "@emu/machines/c64/C64Machine";
import { describe, expect, it, beforeEach } from "vitest";

/**
 * These tests demonstrate and document the current IEC bus integration behavior.
 * 
 * IMPLEMENTATION NOTE: 
 * Currently, the CIA2 iecDataLine and iecClockLine getters exist, but they
 * don't appear to be fully integrated with the CPU port's inputs. In a real C64,
 * the IEC lines are connected between the CIA2 and CPU port in a bidirectional way,
 * but the current emulation implementation doesn't fully reflect this connection.
 * 
 * These tests document the current behavior to help future development.
 */
describe("C64 - IEC Bus Integration", () => {
  let c64: C64Machine;
  
  beforeEach(() => {
    c64 = new C64Machine();
  });

  it("CIA2 IEC lines should be controllable from CIA2 registers", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // Set CIA2 Port A bits 1-2 as outputs (for IEC CLOCK and DATA)
    cia2.writeRegister(0x02, 0x06);
    
    // Initially both lines should be high/inactive
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // Set CIA2 IEC lines low (active)
    cia2.writeRegister(0x00, 0x00);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // Set them back to high
    cia2.writeRegister(0x00, 0x06);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
  });

  /**
   * This test now verifies that the CPU port can read the IEC lines from CIA2
   * after our implementation changes.
   */
  it("CPU Port can read IEC line states from CIA2", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    const cpuPort = c64.cpuPortDevice;
    
    // --- Act/Assert
    // Set CPU port data direction to make all bits inputs
    cpuPort.writeDirection(0x00);
    
    // Set CIA2 Port A bits 1-2 as outputs (for IEC CLOCK and DATA)
    cia2.writeRegister(0x02, 0x06);
    
    // Initially both CIA2 lines should be high/inactive
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // Check initial CPU port data register
    const initialPortState = cpuPort.readData();
    // Both bits should be high (0xC0) when IEC lines are inactive
    expect((initialPortState & 0xC0)).toBe(0xC0);
    
    // Set CIA2 IEC lines low (active)
    cia2.writeRegister(0x00, 0x00);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // Check CPU port data register again
    const updatedPortState = cpuPort.readData();
    // Now the bits should be low (0x00) since IEC lines are active
    expect((updatedPortState & 0xC0)).toBe(0x00);
  });

  /**
   * This test verifies that the CPU port correctly reads different states of IEC lines
   */
  it("CPU Port reads correct IEC line states", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    const cpuPort = c64.cpuPortDevice;
    
    // --- Act/Assert
    // Set CIA2 to control IEC lines
    cia2.writeRegister(0x02, 0x06); // Bits 1-2 as outputs
    
    // First read with both lines high
    cia2.writeRegister(0x00, 0x06);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // The CPU port read should show bits 6-7 high
    const highState = cpuPort.readData();
    expect((highState & 0xC0)).toBe(0xC0);
    
    // Now set DATA line low, CLOCK line high
    cia2.writeRegister(0x00, 0x02); // Bit 1 (CLOCK) high, bit 2 (DATA) low
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(true);
    
    // The CPU port should have bit 6 (DATA) low and bit 7 (CLOCK) high
    const mixedState = cpuPort.readData();
    expect((mixedState & 0x40)).toBe(0x00); // DATA line (bit 6)
    expect((mixedState & 0x80)).toBe(0x80); // CLOCK line (bit 7)
  });

  it("IEC ATN line control works in CIA2", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // In a real C64, bit 3 of CIA2 port A controls ATN line
    
    // Set CIA2 to control all IEC lines
    cia2.writeRegister(0x02, 0x0E); // Bits 1-3 as outputs
    
    // Set all lines high initially (inactive)
    cia2.writeRegister(0x00, 0x0E);
    
    // Now simulate ATN sequence by pulling ATN low (bit 3)
    cia2.writeRegister(0x00, 0x06); // Keep DATA/CLOCK high, ATN low
    
    // Then pull DATA low to acknowledge ATN
    cia2.writeRegister(0x00, 0x02); // DATA low, CLOCK high, ATN low
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(true);
    
    // Then end sequence by setting all lines high again
    cia2.writeRegister(0x00, 0x0E);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
  });
  
  it("CIA2 and CPU port interact correctly for complex IEC operations", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    const cpuPort = c64.cpuPortDevice;
    
    // --- Act/Assert
    // 1. Set up CIA2 to control IEC lines
    cia2.writeRegister(0x02, 0x06); // Bits 1-2 as outputs
    cia2.writeRegister(0x00, 0x06); // Set lines inactive (high)
    
    // 2. CPU port reads the IEC lines
    let portData = cpuPort.readData();
    expect((portData & 0xC0)).toBe(0xC0); // Both lines high
    
    // 3. CIA2 sets DATA line low, CLOCK high
    cia2.writeRegister(0x00, 0x02);
    
    // 4. CPU port reads the changed state
    portData = cpuPort.readData();
    expect((portData & 0x40)).toBe(0x00); // DATA line low
    expect((portData & 0x80)).toBe(0x80); // CLOCK line high
    
    // 5. CIA2 sets both lines low
    cia2.writeRegister(0x00, 0x00);
    
    // 6. CPU port reads the new state
    portData = cpuPort.readData();
    expect((portData & 0xC0)).toBe(0x00); // Both lines low
    
    // 7. Change CIA2 data direction to inputs
    cia2.writeRegister(0x02, 0x00);
    
    // 8. CPU port should read lines as high now (pull-ups)
    portData = cpuPort.readData();
    expect((portData & 0xC0)).toBe(0xC0); // Both lines high again
  });
});
