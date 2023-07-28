import { BinaryReader } from "@/common/utils/BinaryReader";
import { TzxDeprecatedBlockBase } from "./TzxDeprecatedBlockBase";

/**
 * This is a special block that would normally be generated only by emulators.
 */
export class TzxEmulationInfoBlock extends TzxDeprecatedBlockBase {
  get blockId (): number {
    return 0x34;
  }

  readThrough (reader: BinaryReader): void {
    reader.readBytes(8);
  }
}
