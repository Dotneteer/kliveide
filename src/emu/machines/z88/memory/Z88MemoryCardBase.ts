import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88MemoryCard } from "./IZ88MemoryCard";
import { CardType } from "@emu/machines/z88/memory/CardType";

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
   * @param memOffset Memory offset where the card is inserted
   */
  onInserted (memOffset: number): void {
    // --- This method is intentionally empty; override in derived classes
  }

  /**
   * This method is invoked when the card is removed from the memory
   */
  onRemoved (): void {
    // --- This method is intentionally empty; override in derived classes
  }
}
