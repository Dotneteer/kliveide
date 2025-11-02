/**
 * Represents a code to inject into the virtual machine.
 */
export interface CodeToInject {
  model: string;
  entryAddress?: number;
  subroutine?: boolean;
  segments: InjectedSegment[];
  options: { [key: string]: boolean };
}

/**
 * A single segment of the code compilation
 */
interface InjectedSegment {
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
  emittedCode: number[];
}
