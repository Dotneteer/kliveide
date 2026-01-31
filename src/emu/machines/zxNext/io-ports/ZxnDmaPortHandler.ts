import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { DmaMode } from "@emu/machines/zxNext/DmaDevice";

/**
 * Read from port 0x6B (zxnDMA mode)
 * Routes to DmaDevice.readStatusByte() and ensures zxnDMA mode is set
 * 
 * @param machine The ZX Next machine instance
 * @returns The status or register value from DMA device
 */
export function readZxnDmaPort(machine: IZxNextMachine): number {
  // Ensure DMA is in zxnDMA mode
  machine.dmaDevice.setDmaMode(DmaMode.ZXNDMA);
  
  // Read status byte from DMA device
  return machine.dmaDevice.readStatusByte();
}

/**
 * Write to port 0x6B (zxnDMA mode)
 * Routes to DmaDevice.writePort() and ensures zxnDMA mode is set
 * 
 * @param machine The ZX Next machine instance
 * @param value The value to write to the DMA device
 */
export function writeZxnDmaPort(machine: IZxNextMachine, value: number): void {
  // Ensure DMA is in zxnDMA mode
  machine.dmaDevice.setDmaMode(DmaMode.ZXNDMA);
  
  // Route write to DMA port dispatcher
  machine.dmaDevice.writePort(value);
}
