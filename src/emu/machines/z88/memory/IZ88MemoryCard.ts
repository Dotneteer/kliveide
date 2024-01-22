import { CardType } from "../IZ88BlinkDevice";
import { IZ88MemoryOperation } from "./IZ88MemoryOperation";

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
}
