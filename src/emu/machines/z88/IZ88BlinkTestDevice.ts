export interface IZ88BlinkTestDevice {
  // --- Resets the RTC  
  resetRtc(): void;

  // --- Increments the RTC
  incrementRtc (): void;
}
