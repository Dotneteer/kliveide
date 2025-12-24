import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Reads Port 0xFF3B (ULA+ Data/Enable Register)
 * 
 * Behavior depends on mode (from Port 0xBF3B bits [7:6]):
 * - Mode 00: Returns palette data in 8-bit RRRGGGBB format from current index
 * - Mode 01/10/11: Returns ULA+ enable flag in bit 0
 * 
 * @param machine The ZX Next machine instance
 * @returns The port value
 */
export function readUlaPlusDataPort(machine: IZxNextMachine): number {
  const mode = machine.composedScreenDevice.ulaPlusMode;
  
  if (mode === 0x00) {
    // Palette access mode: read palette data at current index
    const paletteIndex = machine.composedScreenDevice.ulaPlusPaletteIndex;
    const rgb333 = machine.paletteDevice.getUlaRgb333(paletteIndex);
    
    // Convert from internal 9-bit RGB333 to 8-bit RRRGGGBB format
    // Bit layout: RGB333 = [R2 R1 R0 G2 G1 G0 B2 B1 B0]
    // Output: RRRGGGBB = [R2 R1 R0 G2 G1 G0 B2 B1]
    const red = (rgb333 >> 6) & 0x07;    // Bits [8:6]
    const green = (rgb333 >> 3) & 0x07;  // Bits [5:3]
    const blue = (rgb333 >> 1) & 0x03;   // Bits [2:1] (upper 2 bits only)
    
    return (red << 5) | (green << 2) | blue;
  } else {
    // Control mode (01/10/11): return enable flag in bit 0
    return machine.composedScreenDevice.ulaPlusEnabled ? 0x01 : 0x00;
  }
}

/**
 * Writes Port 0xFF3B (ULA+ Data/Enable Register)
 * 
 * Behavior depends on mode (from Port 0xBF3B bits [7:6]):
 * - Mode 00: Writes palette data in 8-bit RRRGGGBB format to current index
 * - Mode 01: Writes ULA+ enable flag (bit 0)
 * - Mode 10/11: Write ignored (reserved modes)
 * 
 * @param machine The ZX Next machine instance
 * @param value The value to write
 */
export function writeUlaPlusDataPort(machine: IZxNextMachine, value: number): void {
  const mode = machine.composedScreenDevice.ulaPlusMode;
  
  if (mode === 0x00) {
    // Palette access mode: write palette data at current index
    const paletteIndex = machine.composedScreenDevice.ulaPlusPaletteIndex;
    
    // Convert from 8-bit RRRGGGBB to internal 9-bit RGB333 format
    // Input: RRRGGGBB = [R2 R1 R0 G2 G1 G0 B2 B1]
    // Output: RGB333 = [R2 R1 R0 G2 G1 G0 B2 B1 B0]
    const red = (value >> 5) & 0x07;   // Bits [7:5]
    const green = (value >> 2) & 0x07; // Bits [4:2]
    const blue = value & 0x03;         // Bits [1:0]
    
    // Replicate bit 0 as LSB for blue channel (as per VHDL)
    const rgb333 = (red << 6) | (green << 3) | (blue << 1) | (blue & 0x01);
    
    // Write to the active ULA palette (respects first/second palette selection)
    const palette = machine.paletteDevice.secondUlaPalette 
      ? machine.paletteDevice.ulaSecond 
      : machine.paletteDevice.ulaFirst;
    palette[paletteIndex] = rgb333;
    
    // Update border cache if border color was modified (palette index 0-7 PAPER colors)
    if (paletteIndex < 8) {
      machine.composedScreenDevice.updateBorderRgbCache();
    }
  } else if (mode === 0x01) {
    // Control mode: update enable flag (bit 0 only)
    machine.composedScreenDevice.ulaPlusEnabled = (value & 0x01) !== 0;
  }
  // Mode 10/11: write ignored (reserved)
}
