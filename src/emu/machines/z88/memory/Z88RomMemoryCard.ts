import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardType } from "../IZ88BlinkDevice";
import { Z88MemoryCardBase } from "./Z88MemoryCardBase";

export class Z88RomMemoryCard extends Z88MemoryCardBase {
  type: CardType = CardType.Rom;

  constructor (public readonly host: IZ88Machine, public readonly size: number) {
    super(host, size);
  }

  /**
   * Reads the byte at the specified memory address
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param _bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @returns The read byte
   */
  readMemory (memOffset: number, _bank: number, address: number): number {
    return this.host.z88Memory.memory[memOffset + (address & 0x1fff)];
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   */
  writeMemory (): void {
    // --- This is a ROM, do not wwrite memory
  }
}
