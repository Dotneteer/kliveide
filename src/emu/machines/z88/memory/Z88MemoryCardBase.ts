import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88MemoryCard } from "./IZ88MemoryCard";

/**
 * The base class of all Z88 memory cards
 */
export abstract class Z88MemoryCardBase implements IZ88MemoryCard {
  private _chipMask: number;
  private _slot: number;

  /**
   * Initializes the card with the specified size
   * @param host The host Z88 machine
   * @param size The size of the memory card in bytes
   */
  constructor (public readonly host: IZ88Machine, public readonly size: number) {
    // --- Sign the card is not inserted into any slot
    this._slot = -1;

    // --- Calculate the chip (address line) mask
    switch (size) {
      case 0x00_0000:
        this._chipMask = 0x00;
        break;
      case 0x00_8000:
        this._chipMask = 0x01;
        break;
      case 0x01_0000:
        this._chipMask = 0x03;
        break;
      case 0x02_0000:
        this._chipMask = 0x07;
        break;
      case 0x04_0000:
        this._chipMask = 0x0f;
        break;
      case 0x08_0000:
        this._chipMask = 0x1f;
        break;
      case 0x10_0000:
        this._chipMask = 0x3f;
        break;
      default:
        throw new Error("Invalid memory card size");
    }
  }

  /**
   * Gets the chip mask (address line mask) of the card calculated from its size
   */
  get chipMask (): number {
    return this._chipMask;
  }

  /**
   * Inserts the card into the specified slot
   * @memory The object responsible for memory management
   * @param slot The index of the slot to insert the card into
   * @param initialContent The initial content of the card (ROM/EPROM/EEROM, other read-only memory)
   */
  insert (slot: number, initialContent?: Uint8Array): void {
    // --- Check if the card fits into the slot
    if (slot < 0 || slot > 3) {
      throw new Error("Invalid slot index");
    }

    // TODO: Sign the card is inserted into the slot

    if (initialContent) {
      // --- Check for right content size  
      if (initialContent.length !== this.size) {
        throw new Error("Invalid initial content size");
      }

      // --- Write the contents directly into the memory
      const memory = this.host.memory.memory;
      const cardOffset = slot * 0x10_0000;
      for (let i = 0; i < this.size; i++) {
        memory[cardOffset + i] = initialContent[i];
      }
    }
  }

  /**
   * Removes the card from the current slot
   */
  remove (): void {
    if (this._slot < 0) {
      throw new Error("The card is not inserted into any slot");
    }
    // TODO: Implement this
    // --- Set the slot's chip mask to 0 indicating the card is not there
  }

  /**
   * Reads the byte at the specified memory address
   * @param page The 16K page within the card
   * @param offset The address offset within the 16K page (0x0000-0x3fff)
   * @returns The read byte
   */
  abstract readMemory(page: number, offset: number): number;

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param page The 16K page within the card
   * @param offset The address offset within the 16K page (0x0000-0x3fff)
   * @param data Byte to write
   */
  abstract writeMemory(page: number, offset: number, data: number): void;
}
