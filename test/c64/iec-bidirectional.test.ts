import { C64Machine } from "@emu/machines/c64/C64Machine";
import { describe, expect, it, beforeEach } from "vitest";

/**
 * These tests verify the bidirectional communication between the CPU port and CIA2
 * for the IEC bus lines.
 */
describe("C64 - IEC Bus Bidirectional Communication", () => {
  let c64: C64Machine;
  
  beforeEach(() => {
    c64 = new C64Machine();
  });

  it("CPU port can drive IEC lines when configured as outputs", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    const cpuPort = c64.cpuPortDevice;
    
    // --- Act/Assert
    // Set CIA2 to use IEC lines as inputs
    cia2.writeRegister(0x02, 0x00); // All Port A bits as inputs
    
    // Configure CPU port to drive the IEC lines
    cpuPort.writeDirection(0xC0); // Bits 6-7 as outputs
    
    // Initially, keep lines high (in CPU port, writing 1 means high)
    cpuPort.writeData(0xC0);
    
    // Let's see the state of the CIA2 internal properties
    console.log("CIA2 _cpuPortDrivingDataLow:", (cia2 as any)._cpuPortDrivingDataLow);
    console.log("CIA2 _cpuPortDrivingClockLow:", (cia2 as any)._cpuPortDrivingClockLow);
    
    // CIA2 should read the lines as high (no device pulling them low)
    const initialRead = cia2.readRegister(0x00);
    console.log("CIA2 initial read:", initialRead.toString(16), "bits 6-7:", (initialRead & 0xC0).toString(16));
    expect((initialRead & 0xC0)).toBe(0xC0);
    
    // Now pull the DATA line low from the CPU port (writing 0 means pull low)
    cpuPort.writeData(0x80); // Bit 6 low, bit 7 high
    
    // Let's check the CIA2 internal properties again
    console.log("After setting bit 6 low:");
    console.log("CPU port data:", cpuPort.readData().toString(16));
    console.log("CIA2 _cpuPortDrivingDataLow:", (cia2 as any)._cpuPortDrivingDataLow);
    console.log("CIA2 _cpuPortDrivingClockLow:", (cia2 as any)._cpuPortDrivingClockLow);
    
    // CIA2 should read the DATA line as low
    const dataLowRead = cia2.readRegister(0x00);
    console.log("CIA2 data low read:", dataLowRead.toString(16), "bits 6-7:", (dataLowRead & 0xC0).toString(16));
    expect((dataLowRead & 0x40)).toBe(0x00);
    expect((dataLowRead & 0x80)).toBe(0x80);
    
    // Pull both lines low from CPU port
    cpuPort.writeData(0x00);
    
    // Check CIA2 internal properties again
    console.log("After setting both bits low:");
    console.log("CIA2 _cpuPortDrivingDataLow:", (cia2 as any)._cpuPortDrivingDataLow);
    console.log("CIA2 _cpuPortDrivingClockLow:", (cia2 as any)._cpuPortDrivingClockLow);
    
    // CIA2 should read both lines as low
    const bothLowRead = cia2.readRegister(0x00);
    console.log("CIA2 both low read:", bothLowRead.toString(16), "bits 6-7:", (bothLowRead & 0xC0).toString(16));
    expect((bothLowRead & 0xC0)).toBe(0x00);
  });
  
  it("Demonstrates wired-AND behavior of IEC bus", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    const cpuPort = c64.cpuPortDevice;
    
    // --- Act/Assert
    // Configure both devices to use IEC lines
    cia2.writeRegister(0x02, 0x06); // CIA2: Bits 1-2 as outputs (CLK OUT, DATA OUT)
    cpuPort.writeDirection(0xC0);   // CPU port: Bits 6-7 as outputs (DATA IN, CLK IN)
    
    // Set all lines high initially
    cia2.writeRegister(0x00, 0xFF);
    cpuPort.writeData(0xC0);
    
    // CIA2 pulls DATA OUT low (bit 2 = 0)
    cia2.writeRegister(0x00, 0xFB); // Clear bit 2 (DATA OUT)
    
    // This doesn't directly affect the CPU port reading of DATA IN (bit 6)
    // since they're different lines, but in a real C64 they would be connected
    // on the actual IEC bus
    expect((cpuPort.readData() & 0x40)).toBe(0x40);
    
    // When CPU port pulls DATA IN low (bit 6 = 0)
    cpuPort.writeData(0x80); // Bit 6 low, bit 7 high
    
    // Let's check the state
    console.log("In wired-AND test:");
    console.log("CIA2 _cpuPortDrivingDataLow:", (cia2 as any)._cpuPortDrivingDataLow);
    console.log("CIA2 _cpuPortDrivingClockLow:", (cia2 as any)._cpuPortDrivingClockLow);
    
    // CIA2 reads DATA IN as low because CPU port is driving it low
    const cia2Read = cia2.readRegister(0x00);
    console.log("CIA2 read:", cia2Read.toString(16), "bits 6-7:", (cia2Read & 0xC0).toString(16));
    expect((cia2Read & 0x40)).toBe(0x00);
    
    // CPU port should still read DATA IN as low (its own output)
    expect((cpuPort.readData() & 0x40)).toBe(0x00);
    
    // Only when both devices release their respective lines will they go high
    cia2.writeRegister(0x00, 0xFF); // All CIA2 bits high
    cpuPort.writeData(0xC0);        // All CPU port bits high
    
    // Now both lines should be high in both devices
    expect((cia2.readRegister(0x00) & 0xC0)).toBe(0xC0);
    expect((cpuPort.readData() & 0xC0)).toBe(0xC0);
  });

  it("Both devices can drive the same IEC line low", () => {
    // --- Arrange
    const cia2 = c64.cia2Device;
    const cpuPort = c64.cpuPortDevice;
    
    // Set up both devices to control the IEC lines
    cia2.writeRegister(0x02, 0x06); // CIA2: Bits 1-2 as outputs (CLK OUT, DATA OUT)
    cpuPort.writeDirection(0xC0);   // CPU port: Bits 6-7 as outputs (DATA IN, CLK IN)
    
    // --- Act & Assert
    
    // 1. Start with all lines high
    cia2.writeRegister(0x00, 0xFF);
    cpuPort.writeData(0xC0);
    
    // 2. CIA2 pulls DATA line low
    cia2.writeRegister(0x00, 0xFB); // Clear bit 2 (DATA OUT)
    
    // 3. CPU port also pulls DATA line low
    cpuPort.writeData(0x80); // Bit 6 low (DATA IN)
    
    // 4. Verify DATA line is low in both devices
    expect(cia2.iecDataLine).toBe(false);
    expect((cpuPort.readData() & 0x40)).toBe(0x00);
    
    // 5. CIA2 releases DATA line (sets high)
    cia2.writeRegister(0x00, 0xFF);
    
    // Let's check the state
    console.log("In both devices test:");
    console.log("CIA2 _cpuPortDrivingDataLow:", (cia2 as any)._cpuPortDrivingDataLow);
    console.log("CIA2 _cpuPortDrivingClockLow:", (cia2 as any)._cpuPortDrivingClockLow);
    
    // 6. DATA line should still be low because CPU port is still driving it low
    expect(cia2.iecDataLine).toBe(true); // CIA2's output line is high
    
    const cia2Read = cia2.readRegister(0x00);
    console.log("CIA2 read:", cia2Read.toString(16), "bits 6-7:", (cia2Read & 0xC0).toString(16));
    expect((cia2Read & 0x40)).toBe(0x00); // But it reads DATA IN as low
    expect((cpuPort.readData() & 0x40)).toBe(0x00);
    
    // 7. CPU port releases DATA line
    cpuPort.writeData(0xC0);
    
    // 8. Now DATA line should be high in both devices
    expect((cia2.readRegister(0x00) & 0x40)).toBe(0x40);
    expect((cpuPort.readData() & 0x40)).toBe(0x40);
  });
});
