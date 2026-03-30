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
  // Reading port 0xFFFD returns the currently selected register value from the
  // active PSG chip (FPGA: psg_d_o via turbosound module; MAME: data_r()).
  // When turbosound is disabled, always read from chip 0.
  const soundConfig = machine.soundDevice;
  const turboSound = machine.audioControlDevice.getTurboSoundDevice();
  if (soundConfig.enableTurbosound) {
    return turboSound.readSelectedRegister();
  } else {
    return turboSound.getChip(0).readPsgRegisterValue();
  }
}

export function writeAyRegPort(machine: IZxNextMachine, value: number): void {
  // Check if this is a TurboSound command (bit 7=1, bits 4:2=111)
  // Mask: 0b10011100 = 0x9C (bits 7,4,3,2)
  // Value: 0b10011100 = 0x9C (all must be 1)
  if ((value & 0x9c) === 0x9c) {
    // This is a TurboSound chip selection command
    // Only processed when turbosound is enabled (FPGA: turbosound_en_i='1')
    if (machine.soundDevice.enableTurbosound) {
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
      // When turbosound is disabled, treat as register select if bits 7:5 = 000
      // (but 0x9C has bit 7=1, so this path never matches register select — ignore)
    }
  } else if ((value & 0xe0) === 0) {
    // Register selection: bits 7:5 must be "000" (FPGA: psg_d_i(7 downto 5) = "000")
    // Extract register index from bits 4:0
    const registerIndex = value & 0x1f;
    const turboSound = machine.audioControlDevice.getTurboSoundDevice();
    if (machine.soundDevice.enableTurbosound) {
      turboSound.selectRegister(registerIndex);
    } else {
      // When turbosound is disabled, always address chip 0
      turboSound.getChip(0).setPsgRegisterIndex(registerIndex & 0x0f);
    }
  }
}
