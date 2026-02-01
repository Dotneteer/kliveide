import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * AY Register Port Handler (0xFFFD)
 *
 * Format:
 * - Bits 7-2: Register index to select (0-63, AY-3-8912 has 16 registers)
 * - Bits 1-0: PSG chip to select (for TurboSound)
 *
 * For ZX Spectrum Next TurboSound:
 * - Bit 7: 1 (always 1 for valid command)
 * - Bits 4-2: 111 (chip select command)
 * - Bits 1-0: Chip ID (00=reserved, 01=chip2, 10=chip1, 11=chip0)
 * - Bits 6-5: Pan control (00=muted, 01=right, 10=left, 11=stereo)
 */
export function readAyRegPort(machine: IZxNextMachine, ulaPort: number): number {
  // Reading from register select port returns 0xff (write-only for our implementation)
  return 0xff;
}

export function writeAyRegPort(machine: IZxNextMachine, value: number): void {
  // Check if this is a TurboSound command (bit 7 = 1, bits 4:2 = 111)
  if ((value & 0b10010100) === 0b10010100) {
    // This is a TurboSound chip selection command
    const chipSelect = value & 0x03; // Bits 1:0 - chip ID
    const panControl = (value >> 5) & 0x03; // Bits 6:5 - panning

    // Convert chip select bits to chip ID:
    // 00 = reserved
    // 01 = chip 2
    // 10 = chip 1
    // 11 = chip 0
    if (chipSelect !== 0b00) {
      const chipId = 2 - (chipSelect - 1); // 01->2, 10->1, 11->0
      machine.audioControlDevice.getTurboSoundDevice().selectChip(chipId);
      machine.audioControlDevice.getTurboSoundDevice().setChipPanning(chipId, panControl);
    }
  } else {
    // This is a standard AY register select command
    const registerIndex = (value >> 2) & 0x3f; // Bits 7:2 - register index
    machine.audioControlDevice.getTurboSoundDevice().selectRegister(registerIndex);
  }
}
