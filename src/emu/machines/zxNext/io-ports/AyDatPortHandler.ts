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

  if (ulaPort === 0xbff5) {
    // Info port - return chip ID and register index
    const chipId = turboSound.getSelectedChipId();
    const registerIndex = turboSound.getSelectedRegister();

    // Encode chip ID: 1=chip0, 2=chip1, 4=chip2
    const encodedChipId = 1 << chipId;

    return ((encodedChipId & 0x0f) << 4) | (registerIndex & 0x0f);
  } else {
    // Data port - return current register value
    return turboSound.readSelectedRegister();
  }
}

export function writeAyDatPort(machine: IZxNextMachine, value: number): void {
  // Write to currently selected register
  machine.audioControlDevice.getTurboSoundDevice().writeSelectedRegister(value);
}
