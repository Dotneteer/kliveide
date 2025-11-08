import { C64Machine } from "@emu/machines/c64/C64Machine";
import { describe, expect, it, beforeEach } from "vitest";

describe("C64 - CIA2 IEC Bus Lines", () => {
  let c64: C64Machine;
  
  beforeEach(() => {
    c64 = new C64Machine();
  });

  it("Initialization sets IEC lines to default state", () => {
    // --- Arrange/Act
    const cia2 = c64.cia2Device;
    
    // --- Assert
    // By default, both lines should be high (inactive)
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
  });

  it("Setting IEC Data line works", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // First, set the data direction register for Port A
    // Set bit 2 (DATA OUT) as output
    cia2.writeRegister(0x02, 0x04);
    
    // Check initial state (should be high/inactive by default)
    expect(cia2.iecDataLine).toBe(true);
    
    // Set DATA line low (active)
    cia2.writeRegister(0x00, 0x00); // Write 0 to bit 2
    expect(cia2.iecDataLine).toBe(false);
    
    // Set DATA line high (inactive) again
    cia2.writeRegister(0x00, 0x04); // Write 1 to bit 2
    expect(cia2.iecDataLine).toBe(true);
  });

  it("Setting IEC Clock line works", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // First, set the data direction register for Port A
    // Set bit 1 (CLK OUT) as output
    cia2.writeRegister(0x02, 0x02);
    
    // Check initial state (should be high/inactive by default)
    expect(cia2.iecClockLine).toBe(true);
    
    // Set CLOCK line low (active)
    cia2.writeRegister(0x00, 0x00); // Write 0 to bit 1
    expect(cia2.iecClockLine).toBe(false);
    
    // Set CLOCK line high (inactive) again
    cia2.writeRegister(0x00, 0x02); // Write 1 to bit 1
    expect(cia2.iecClockLine).toBe(true);
  });

  it("Setting both IEC lines simultaneously works", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // Set both bits 1-2 (CLK OUT and DATA OUT) as outputs
    cia2.writeRegister(0x02, 0x06);
    
    // Check initial state (should be high/inactive by default)
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // Set both lines low (active)
    cia2.writeRegister(0x00, 0x00);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // Set DATA high, keep CLOCK low
    cia2.writeRegister(0x00, 0x04);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(false);
    
    // Set CLOCK high, keep DATA high
    cia2.writeRegister(0x00, 0x06);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // Set CLOCK high, DATA low
    cia2.writeRegister(0x00, 0x02);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(true);
  });

  it("IEC lines respect data direction register", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // Start with all pins as inputs
    cia2.writeRegister(0x02, 0x00);
    
    // Try to set lines active by writing to Port A
    // In the current implementation, when pins are configured as inputs,
    // the getters return true (inactive) regardless of Port A value
    cia2.writeRegister(0x00, 0x00);
    
    // The lines should be high (inactive) as pins are configured as inputs
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // Now set them as outputs
    cia2.writeRegister(0x02, 0x06);
    
    // Try again to set them active
    cia2.writeRegister(0x00, 0x00);
    
    // Now they should respond
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // Set the lines high
    cia2.writeRegister(0x00, 0x06);
    
    // Now they should be inactive
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // Change direction back to inputs with high latch values
    cia2.writeRegister(0x02, 0x00);
    
    // Lines should return to inactive state
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
  });

  it("Direct Port A access methods work for IEC lines", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // Set direction register
    cia2.writeRegister(0x02, 0x06); // Bits 1-2 as outputs
    
    // Use port getter/setter
    const initialPort = cia2.portA;
    
    // Lines should be high by default
    expect(initialPort & 0x06).toBe(0x06);
    
    // Set both lines low via port setter
    cia2.portA = initialPort & ~0x06;
    
    // Check via the getters
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // Set only DATA high via port setter
    cia2.portA = (cia2.portA & ~0x02) | 0x04;
    
    // Check via the getters
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(false);
  });

  it("Simulates IEC bus ATN sequence", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // Set bits 0-2 as outputs (ATN, CLK, DATA)
    cia2.writeRegister(0x02, 0x07);
    
    // 1. Set all lines high (idle state)
    cia2.writeRegister(0x00, 0x07);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // 2. Pull ATN low (computer wants to talk)
    cia2.writeRegister(0x00, 0x06);
    
    // 3. Pull DATA low to acknowledge ATN
    cia2.writeRegister(0x00, 0x02);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(true);
    
    // 4. Start sending data - Clock goes low
    cia2.writeRegister(0x00, 0x00);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // 5. Send bit (clock high = ready, data high/low = bit value)
    cia2.writeRegister(0x00, 0x02);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(true);
    
    // 6. End of bit (clock low again)
    cia2.writeRegister(0x00, 0x00);
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // 7. Send next bit (clock high, data high = bit 1)
    cia2.writeRegister(0x00, 0x06);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
    
    // 8. End of communication - all lines high
    cia2.writeRegister(0x00, 0x07);
    expect(cia2.iecDataLine).toBe(true);
    expect(cia2.iecClockLine).toBe(true);
  });

  it("Preserves other Port A bits when changing IEC lines", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    
    // --- Act/Assert
    // Set all bits as outputs
    cia2.writeRegister(0x02, 0xFF);
    
    // Set a specific pattern in Port A including VIC bank bits
    // 10101111 - VIC bank 1, IEC lines high
    cia2.writeRegister(0x00, 0xAF);
    
    // Check VIC bank is set correctly
    expect(cia2.vicMemoryBank).toBe(1);
    
    // Now change just the IEC lines
    // Clear bits 1-2 (CLK and DATA) while preserving others
    cia2.writeRegister(0x00, 0xA9); // 10101001
    
    // Check IEC lines changed
    expect(cia2.iecDataLine).toBe(false);
    expect(cia2.iecClockLine).toBe(false);
    
    // Check VIC bank is preserved
    expect(cia2.vicMemoryBank).toBe(1);
  });
});
