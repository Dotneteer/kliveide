/*
 * The debug info the Klive Z80 Assembler records for `.copper` pragmas (plan D8).
 *
 * A Copper block is a maximal run of consecutive `.copper` emissions (consecutive in memory and in
 * source order). The IDE matches live Copper RAM against these blocks by instruction shape
 * (`copperShapeOf`), so a list the CPU patches at runtime still maps back to its source.
 */

/** One instruction of an assembled Copper block. */
export type CopperBlockEntry = {
  /** The assembled word (high byte first, as the Copper reads it) */
  word: number;
  /** Index of the source file in the compilation's `sourceFileList` */
  fileIndex: number;
  /** 1-based source line */
  line: number;
};

/** A maximal run of consecutive `.copper` emissions. */
export type CopperBlock = {
  /** Z80 address of the block's first byte */
  address: number;
  /** Number of instructions (words) in the block */
  length: number;
  entries: CopperBlockEntry[];
};
