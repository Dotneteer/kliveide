import { BinaryReader } from "@/common/utils/BinaryReader";
import { BinaryWriter } from "@/common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";
import { TzxHwInfo } from "./TzxHwInfo";

/**
 * Hardware information block
 */
export class TzxHardwareInfoBlock extends TzxBlockBase {
  /**
   * Number of machines and hardware types for which info is supplied
   */
  hwCount: number;

  /**
   * List of machines and hardware
   */
  hwInfo: TzxHwInfo[];

  /**
   * The ID of the block
   */
  get blockId (): number {
    return 0x33;
  }

  readFrom (reader: BinaryReader): void {
    this.hwCount = reader.readByte();
    this.hwInfo = [];
    for (let i = 0; i < this.hwCount; i++) {
      const hw = new TzxHwInfo();
      hw.readFrom(reader);
      this.hwInfo[i] = hw;
    }
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.hwCount);
    if (!this.hwInfo) return;
    for (const hw of this.hwInfo) {
      hw.writeTo(writer);
    }
  }
}
