import { CardType } from "./memory/CardType";

export interface IZ88BlinkTestDevice {
  // --- Resets the RTC  
  resetRtc(): void;

  // --- Sets the chip mask for the specified chip
  setChipMask (chip: number, mask: number): void;

  // --- Gets the chip mask for the specified chip
  getChipMask (chip: number): number;

  // --- Sets the slot mask for the specified slot
  setSlotMask (slot: number, cardType: CardType): void

  // --- Increments the RTC
  incrementRtc (): void;
}
