import { Z88PagedMemory } from "./Z88PagedMemory";

/**
 * Repesents a Z88 memory card
 */
export interface IZ88MemoryCard {
  /**
   * Gets the size of the memory card in bytes
   */
  readonly size: number;

  /**
   * Gets the chip mask (address line mask) of the card calculated from its size
   */
  readonly chipMask: number;

  /**
   * Inserts the card into the specified slot
   * @param slot The index of the slot to insert the card into
   * @param initialContent The initial content of the card (ROM/EPROM/EEROM, other read-only memory)
   */
  insert(slot: number, initialContent?: Uint8Array): void;

  /**
   * Removes the card from the current slot
   */
  remove(): void;

  /**
   * Reads the byte at the specified memory address
   * @param page The 16K page within the card
   * @param offset The address offset within the 16K page (0x0000-0x3fff)
   * @returns The read byte
   */
  readMemory(page: number, offset: number): number;

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param page The 16K page within the card
   * @param offset The address offset within the 16K page (0x0000-0x3fff)
   * @param data Byte to write
   */
  writeMemory(page: number, offset: number, data: number): void;
}
