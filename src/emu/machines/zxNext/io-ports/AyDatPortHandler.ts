import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * AY Data Port Handler (0xBFFD for write, 0xBFF5 for info read)
 *
 * 0xBFFD (AY data port):
 * - Write: Write data to currently selected register
 * - Read: Read data from currently selected register
 *
 * 0xBFF5 (AY info port):
 * - Read: Bits 7:4 = Chip ID (1=chip 0, 2=chip 1, 4=chip 2), Bits 3:0 = Register index
 * - Write: Not used, ignored
 */
export function readAyDatPort(machine: IZxNextMachine, ulaPort: number): number {
  const turboSound = machine.audioControlDevice.getTurboSoundDevice();
  const turbosoundEnabled = machine.soundDevice.enableTurbosound;

  if (ulaPort === 0xbff5) {
    // Info port - return chip ID and register index
    // FPGA format: AY_ID(1) & AY_ID(0) & '0' & addr(4 downto 0)
    // AY_ID: "11"=chip0, "10"=chip1, "01"=chip2
    if (!turbosoundEnabled) return 0;
    const chipId = turboSound.getSelectedChipId();
    const registerIndex = turboSound.getSelectedRegister();
    // Map chipId to FPGA AY_ID: 0->"11"(3), 1->"10"(2), 2->"01"(1)
    const ayId = 3 - chipId; // 0->3, 1->2, 2->1
    return ((ayId & 0x03) << 6) | (registerIndex & 0x1f);
  } else {
    // Data port - return current register value
    // When turbosound disabled, always read from chip 0
    if (turbosoundEnabled) {
      return turboSound.readSelectedRegister();
    } else {
      return turboSound.getChip(0).readPsgRegisterValue();
    }
  }
}

export function writeAyDatPort(machine: IZxNextMachine, value: number): void {
  const turboSound = machine.audioControlDevice.getTurboSoundDevice();
  
  // Write to currently selected register
  // When turbosound disabled, always write to chip 0
  if (machine.soundDevice.enableTurbosound) {
    turboSound.writeSelectedRegister(value);
  } else {
    turboSound.getChip(0).writePsgRegisterValue(value);
  }
}
