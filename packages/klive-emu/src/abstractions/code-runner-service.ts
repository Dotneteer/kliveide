/**
 * Represents the code to inject into a virtual machine
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

export type CodeInjectionType = "inject" | "run" | "debug";

/**
 * Defines the behavior of the service that can run the code from the IDE
 * 
 */
export interface ICodeRunnerService {
  /**
   * Compiles the code and injects or runs
   * @param resource Resource to compile
   * @param operationType Type of operation
   */
  manageCodeInjection(resource: string, operationType: CodeInjectionType): Promise<void>;
}
