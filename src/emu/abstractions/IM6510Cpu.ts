import { IAnyCpu } from "./IAnyCpu";

/**
 * This interface represents the behavior and state of the MOS 6510 CPU that is available from outside by other components.
 */
export interface IM6510Cpu extends IAnyCpu {
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
   * Sets the CPU into the stalled state.
   */
  setStalled(value: boolean): void;

  /**
   * Sets the CPU into the stalled state.
   */
  stallCpu(): void;

  /**
   * Resumes the CPU from the stalled state.
   */
  releaseCpu(): void;

  /**
   * Waits while the CPU gets released from the stalled state.
   */
  waitForCpuRelease(): void;
}
