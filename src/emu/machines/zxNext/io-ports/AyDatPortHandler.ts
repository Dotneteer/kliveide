import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * AY Data Port Handler (0xBFFD for write, 0xBFF5 for info read)
 *
 * 0xBFFD (AY data port):
 * - Write: Write data to currently selected register
 * - Read: Read data from currently selected register
 *
 * 0xBFF5 (AY info port):
 * - Read: FPGA ym2149.vhd returns AY_ID & '0' & addr
 *   - Bits 7:6 = AY_ID (chip0=11, chip1=10, chip2=01)
 *   - Bit 5 = 0
 *   - Bits 4:0 = 5-bit register address
 * - Write: Not used, ignored
 */
export function readAyDatPort(machine: IZxNextMachine, ulaPort: number): number {
  const turboSound = machine.audioControlDevice.getTurboSoundDevice();

  if (ulaPort === 0xbff5) {
    // Info port - return AY_ID & '0' & addr (FPGA ym2149.vhd format)
    const chipId = turboSound.getSelectedChipId();
    const registerIndex = turboSound.getSelectedRegister();

    // AY_ID encoding: chip0="11"(3), chip1="10"(2), chip2="01"(1)
    const ayId = [3, 2, 1][chipId];

    return (ayId << 6) | (registerIndex & 0x1f);
  } else {
    // Data port - return current register value
    return turboSound.readSelectedRegister();
  }
}

export function writeAyDatPort(machine: IZxNextMachine, value: number): void {
  const turboSound = machine.audioControlDevice.getTurboSoundDevice();
  
  // Write to currently selected register
  turboSound.writeSelectedRegister(value);
}
