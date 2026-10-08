import type { UnitTestLabels } from "@common/unit-tests/discovery";

/**
 * Represents a code to inject into the virtual machine.
 */
export interface CodeToInject {
  model: string;
  entryAddress?: number;
  subroutine?: boolean;
  segments: InjectedSegment[];
  options: { [key: string]: boolean };
  /**
   * Debug one unit test (`.plans/Z80_UNIT_TESTS_PLAN.md` D12): after the injection the controller
   * runs the init code, patches the wrapper's CALL with the test's address and starts the debugger
   * at the wrapper.
   */
  unitTest?: UnitTestDebugInfo;
}

/** What the controller needs to debug one unit test */
export type UnitTestDebugInfo = {
  /** The test's id, for the stop messages */
  id: string;
  /** The test's first instruction */
  testAddress: number;
  testPartition?: number;
  /** The runner's labels */
  labels: UnitTestLabels;
  /** Stop at the test's first instruction (`unitTests.stopAtStart`, default on) */
  stopAtStart: boolean;
};

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
