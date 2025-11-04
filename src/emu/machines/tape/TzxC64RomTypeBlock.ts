import { BinaryReader } from "../../../common/utils/BinaryReader";
import { TzxDeprecatedBlockBase } from "./TzxDeprecatedBlockBase";

/**
 * This block was created to support the Commodore 64 standard
 * ROM and similar tape blocks.
 */
export class TzxC64RomTypeBlock extends TzxDeprecatedBlockBase {
  get blockId (): number {
    return 0x16;
  }

  readThrough (reader: BinaryReader): void {
    const length = reader.readUint32();
    reader.readBytes(length - 4);
  }
}
