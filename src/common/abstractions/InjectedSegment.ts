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
  bankOffset: number;

  /**
   * Start address of the compiled block
   */
  startAddress: number;

  /**
   * Emitted Z80 binary code
   */
  emittedCode: number[] = [];
}
