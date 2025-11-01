import { BinaryReader } from "@utils/BinaryReader";
import { TzxDeprecatedBlockBase } from "./TzxDeprecatedBlockBase";

/**
 * This block was created to support the Commodore 64 standard
 * ROM and similar tape blocks.
 */
export class TzxSnapshotBlock extends TzxDeprecatedBlockBase {
  get blockId (): number {
    return 0x40;
  }

  readThrough (reader: BinaryReader): void {
    length = reader.readUint32() & 0x00ffffff;
    reader.readBytes(length);
  }
}
