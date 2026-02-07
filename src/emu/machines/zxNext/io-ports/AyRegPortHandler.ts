import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * AY Register Port Handler (0xFFFD)
 *
 * Format (based on VHDL hardware):
 * - TurboSound chip select: bit 7=1 AND bits 4:2="111"
 *   - Bits 6:5: Pan control (00=muted, 01=right, 10=left, 11=stereo)
 *   - Bits 1:0: Chip ID (00=reserved, 01=chip2, 10=chip1, 11=chip0)
 * - Normal register select: bits 7:5="000"
 *   - Bits 4:0: Register index (0-15 for AY-3-8912)
 */
export function readAyRegPort(machine: IZxNextMachine, ulaPort: number): number {
  // Reading from register select port returns 0xff (write-only for our implementation)
  return 0xff;
}

export function writeAyRegPort(machine: IZxNextMachine, value: number): void {
  // Check if this is a TurboSound command (bit 7=1, bits 4:2=111)
  // Mask: 0b10011100 = 0x9C (bits 7,4,3,2)
  // Value: 0b10011100 = 0x9C (all must be 1)
  if ((value & 0x9c) === 0x9c) {
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
    // Extract register index from bits 4:0 (hardware uses I_DA(4 downto 0))
    const registerIndex = value & 0x1f; // Bits 4:0 - register index
    machine.audioControlDevice.getTurboSoundDevice().selectRegister(registerIndex);
  }
}
