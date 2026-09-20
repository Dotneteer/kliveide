import type { IZ88DeviceHost } from "../IZ88DeviceHost";
import { IZ88MemoryCard } from "./IZ88MemoryCard";
import { CardType, z88ChipMaskForSize } from "@emu/machines/z88/z88CardCatalog";

/**
 * The base class of all Z88 memory cards
 */
export abstract class Z88MemoryCardBase implements IZ88MemoryCard {
  private _chipMask: number;

  /**
   * Initializes the card with the specified size
   * @param host The host Z88 machine
   * @param size The size of the memory card in bytes
   */
  constructor (public readonly host: IZ88DeviceHost, public readonly size: number) {
    // --- Calculate the chip (address line) mask
    this._chipMask = z88ChipMaskForSize(size);
  }

  /**
   * Gets the type of the memory card
   */
  abstract readonly type: CardType;

  /**
   * Gets the chip mask (address line mask) of the card calculated from its size
   */
  get chipMask (): number {
    return this._chipMask;
  }

  /**
   * Reads the byte at the specified memory address
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @returns The read byte
   */
  abstract readMemory(memOffset: number, bank: number, address: number): number;

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @param data Byte to write
   */
  abstract writeMemory(
    memOffset: number,
    bank: number,
    address: number,
    data: number
  ): void;

  /**
   * This method is invoked when the card is inserted into the memory
   * @param _memOffset Memory offset where the card is inserted
   */
  onInserted (_memOffset: number): void {
    // --- This method is intentionally empty; override in derived classes
  }

  /**
   * This method is invoked when the card is removed from the memory
   */
  onRemoved (): void {
    // --- This method is intentionally empty; override in derived classes
  }
}
