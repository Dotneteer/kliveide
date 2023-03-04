import { TzxBodylessBlockBase } from "./TzxBodylessBlockBase";

/**
 * This block indicates the end of the Called Sequence.
 * The next block played will be the block after the last
 * CALL block
 */
export class TzxReturnFromSequenceBlock extends TzxBodylessBlockBase {
  get blockId (): number {
    return 0x27;
  }
}
