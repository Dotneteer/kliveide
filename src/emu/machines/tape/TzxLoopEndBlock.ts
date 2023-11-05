import { TzxBodylessBlockBase } from "./TzxBodylessBlockBase";

/**
 * It means that the utility should jump back to the start
 * of the loop if it hasn't been run for the specified number
 * of times.
 */
export class TzxLoopEndBlock extends TzxBodylessBlockBase {
  get blockId (): number {
    return 0x25;
  }
}
