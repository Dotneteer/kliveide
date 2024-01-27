import { CardType } from "./memory/CardType";

export interface IZ88BlinkTestDevice {
  // --- Resets the RTC  
  resetRtc(): void;

  // --- Increments the RTC
  incrementRtc (): void;
}
