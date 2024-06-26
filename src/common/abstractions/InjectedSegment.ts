/**
 * A single segment of the code compilation
 */
export class InjectedSegment {
  /**
   * The bank of the segment
   */
  bank?: number;

  /**
   * Start offset used for banks
   */
  bankOffset = 0;

  /**
   * Start address of the compiled block
   */
  startAddress = 0;

  /**
   * Emitted Z80 binary code
   */
  emittedCode: number[] = [];
}
