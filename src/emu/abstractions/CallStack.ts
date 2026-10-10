/**
 * Represents the call stack of the CPU.
 */
export type CallStackInfo = {
  sp: number;
  frames: number[];
  /**
   * The partition at each 8K slot now (`getPartition`), so the IDE can name each return address
   * through the bank space (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.4).
   */
  slotPartitions?: (number | undefined)[];
  /**
   * Set while the history cursor is in the past (`.plans/LITE_STEP_BACK_PLAN.md` D6, D10): the
   * memory above SP is the present's, so the frames are reconstructed from the history records
   * instead, and `frames` is empty.
   */
  historical?: HistoricalCallStackInfo;
};

/** The call stack at a point in the history, innermost first */
export type HistoricalCallStackInfo = {
  frames: {
    /** The call instruction's address (for an interrupt: the interrupted address) */
    callSite: number;
    returnAddress: number;
    kind: "call" | "rst" | "int" | "nmi";
    /** SP before the call */
    sp: number;
    /** The partition of the call site, when the machine has partitions */
    partition?: number;
    /** The record of the call */
    sequence: number;
  }[];
  /** Outer frames older than the recorded history are not known */
  incomplete: boolean;
};
