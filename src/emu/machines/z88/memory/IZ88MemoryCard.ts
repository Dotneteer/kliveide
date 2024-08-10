import type { IZ88MemoryOperation } from "./IZ88MemoryOperation";
import type { CardType } from "./CardType";

/**
 * Repesents a Z88 memory card
 */
export interface IZ88MemoryCard extends IZ88MemoryOperation {
  /**
   * Gets the type of the memory card
   */
  readonly type: CardType;
  
  /**
   * Gets the size of the memory card in bytes
   */
  readonly size: number;

  /**
   * Gets the chip mask (address line mask) of the card calculated from its size
   */
  readonly chipMask: number;

  /**
   * This method is invoked when the card is inserted into the memory
   * @param memOffset Memory offset where the card is inserted
   */
  onInserted(memOffset: number): void;

  /**
   * This method is invoked when the card is removed from the memory
   */
  onRemoved(): void;
}
