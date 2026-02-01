import { DmaMode } from "../DmaDevice";
import { IZxNextMachine } from "../IZxNextMachine";

/**
 * Read from Z80 DMA port (0x0B) - Legacy mode
 * Sets DMA to legacy mode and reads status/register byte
 */
export function readZ80DmaPort(machine: IZxNextMachine): number {
  machine.dmaDevice.setDmaMode(DmaMode.LEGACY);
  return machine.dmaDevice.readStatusByte();
}

/**
 * Write to Z80 DMA port (0x0B) - Legacy mode
 * Sets DMA to legacy mode and writes register/command byte
 */
export function writeZ80DmaPort(machine: IZxNextMachine, value: number): void {
  machine.dmaDevice.setDmaMode(DmaMode.LEGACY);
  machine.dmaDevice.writePort(value);
}
