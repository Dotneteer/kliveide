import path from "path";
import fs from "fs";
import { C64Machine } from "../../src/emu/machines/c64/C64Machine";
import { C64MemoryDevice } from "../../src/emu/machines/c64/C64MemoryDevice";

// ROM file paths
const BASIC_ROM_PATH = path.join(__dirname, "../../src/public/roms/c64-basic.rom");
const KERNAL_ROM_PATH = path.join(__dirname, "../../src/public/roms/c64-kernal-pal.rom");
const CHAR_GEN_ROM_PATH = path.join(__dirname, "../../src/public/roms/c64-chargen.rom");

// Load ROM data once
const BASIC_ROM = new Uint8Array(fs.readFileSync(BASIC_ROM_PATH));
const KERNAL_ROM = new Uint8Array(fs.readFileSync(KERNAL_ROM_PATH));
const CHAR_GEN_ROM = new Uint8Array(fs.readFileSync(CHAR_GEN_ROM_PATH));

/**
 * Sets up a C64 machine for testing by uploading the ROM contents.
 * @param c64 The C64 machine instance to set up
 */
export function createTestC64Machine(c64: C64Machine): void {
  c64.memoryDevice.uploadBasicRom(BASIC_ROM);
  c64.memoryDevice.uploadKernalRom(KERNAL_ROM);
  c64.memoryDevice.uploadChargenRom(CHAR_GEN_ROM);
}

/**
 * Checks if the BASIC ROM signature matches.
 * @param mem The memory device to check
 * @returns true if the BASIC ROM signature "CBMBASIC" is found at 0xA004-0xA00B
 */
export function checkBasicRomSignature(mem: C64MemoryDevice): boolean {
  return mem.readMemory(0xa004) === 0x43 && // 'C'
         mem.readMemory(0xa005) === 0x42 && // 'B'
         mem.readMemory(0xa006) === 0x4d && // 'M'
         mem.readMemory(0xa007) === 0x42 && // 'B'
         mem.readMemory(0xa008) === 0x41 && // 'A'
         mem.readMemory(0xa009) === 0x53 && // 'S'
         mem.readMemory(0xa00a) === 0x49 && // 'I'
         mem.readMemory(0xa00b) === 0x43;   // 'C'
}

/**
 * Checks if the KERNAL ROM signature matches.
 * @param mem The memory device to check
 * @returns true if the KERNAL ROM signature is found at 0xFFFE-0xFFFF
 */
export function checkKernalRomSignature(mem: C64MemoryDevice): boolean {
  return mem.readMemory(0xfffe) === 0x48 &&
         mem.readMemory(0xffff) === 0xff;
}

/**
 * Checks if the CHARGEN ROM signature matches.
 * @param mem The memory device to check
 * @returns true if CHARGEN ROM is accessible (when CHAREN is disabled)
 */
export function checkChargenRomSignature(mem: C64MemoryDevice): boolean {
  // CHARGEN ROM is visible at 0xD000-0xDFFF when CHAREN is false (chargen property is false)
  // Check for typical character patterns - the '@' character at position 0 should be 0x3C, 0x66, etc.
  if (mem.chargen) {
    // I/O area is visible, not CHARGEN ROM
    return false;
  }
  
  // Check a few bytes of the '@' character (character 0) pattern
  return mem.readMemory(0xd000) === 0x3c && // First byte of '@' character
         mem.readMemory(0xd001) === 0x66 && // Second byte of '@' character
         mem.readMemory(0xd002) === 0x6e;   // Third byte of '@' character
}

/**
 * Sets the memory configuration bits (LORAM, HIRAM, CHAREN) via CPU port.
 * @param c64 The C64 machine instance
 * @param loram LORAM bit value (controls BASIC ROM)
 * @param hiram HIRAM bit value (controls KERNAL ROM)  
 * @param charen CHAREN bit value (controls CHARGEN ROM vs I/O)
 */
export function setMemoryConfiguration(c64: C64Machine, loram: boolean, hiram: boolean, charen: boolean): void {
  // Set CPU port direction to output for bits 0-2
  c64.cpuPortDevice.writeDirection(0x07);
  
  // Build configuration value
  const configValue = (loram ? 0x01 : 0) | (hiram ? 0x02 : 0) | (charen ? 0x04 : 0);
  
  // Write configuration to CPU port
  c64.cpuPortDevice.writeData(configValue);
  
  // Update memory configuration
  c64.memoryDevice.updateConfiguration();
}
