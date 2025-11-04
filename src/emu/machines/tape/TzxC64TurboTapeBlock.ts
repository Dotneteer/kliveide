import { BinaryReader } from "../../../common/utils/BinaryReader";
import { TzxDeprecatedBlockBase } from "./TzxDeprecatedBlockBase";

/**
 * This block is made to support another type of encoding that is
 * commonly used by the C64.
 */
export class TzxC64TurboTapeBlock extends TzxDeprecatedBlockBase {
  get blockId (): number {
    return 0x17;
  }

  readThrough (reader: BinaryReader): void {
    const length = reader.readUint16();
    reader.readBytes(length - 4);
  }
}
