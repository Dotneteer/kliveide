import { TzxBodylessBlockBase } from "./TzxBodylessBlockBase";

/**
 * This indicates the end of a group. This block has no body.
 */
export class TzxGroupEndBlock extends TzxBodylessBlockBase {
  get blockId (): number {
    return 0x22;
  }
}
