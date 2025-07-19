/**
 * This interface represents the behavior and state of the MOS 6510 CPU that is available from outside by other components.
 */
export interface IM6510Cpu {
  /**
   * The A register (accumulator)
   */
  a: number;

  /**
   * The X register (index register)
   */
  x: number;

  /**
   * The Y register (index register)
   */
  y: number;

  /**
   * The S register (stack pointer)
   */
  s: number;

  /**
   * The P register (processor status register)
   * Bit 7: N - Negative flag
   * Bit 6: V - Overflow flag
   * Bit 5: - (always 1)
   * Bit 4: B - Break flag
   * Bit 3: D - Decimal mode flag
   * Bit 2: I - Interrupt disable flag
   * Bit 1: Z - Zero flag
   * Bit 0: C - Carry flag
   */
  p: number;

  /**
   * The Program Counter register
   */
  pc: number;
  
  /**
   * The clock multiplier of the CPU
   */
  clockMultiplier: number;
  
  /**
   * The number of T-states (clock cycles) elapsed since the last reset
   */
  tacts: number;

  /**
   * Show the number of machine frames completed since the CPU started.
   */
  frames: number;

  /**
   * The number of T-states within the current frame
   */
  frameTacts: number;
  
  /**
   * The number of T-states in a current frame taking clock multiplier into account
   */
  tactsInCurrentFrame: number;

  /**
   * Get the number of T-states in a machine frame.
   */
  tactsInFrame: number;

  /**
   * Tests if the Negative flag is set
   */
  isNFlagSet(): boolean;

  /**
   * Tests if the Overflow flag is set
   */
  isVFlagSet(): boolean;

  /**
   * Tests if the Break flag is set
   */
  isBFlagSet(): boolean;

  /**
   * Tests if the Decimal mode flag is set
   */
  isDFlagSet(): boolean;

  /**
   * Tests if the Interrupt disable flag is set
   */
  isIFlagSet(): boolean;

  /**
   * Tests if the Zero flag is set
   */
  isZFlagSet(): boolean;

  /**
   * Tests if the Carry flag is set
   */
  isCFlagSet(): boolean;
  
  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  tactsInDisplayLine: number;
  
  /**
   * Sets the number of tacts within a single machine frame
   * @param tacts Tacts to set
   */
  setTactsInFrame(tacts: number): void;
  
  /**
   * The T-states (clock cycles) when the CPU execution was started last time
   */
  tactsAtLastStart: number;
  
  /**
   * Executes a hard reset as if the machine and the CPU had just been turned on.
   */
  hardReset(): void;
  
  /**
   * Handles the active RESET signal of the CPU.
   */
  reset(): void;
}
