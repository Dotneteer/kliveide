import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";

/**
 * This blocks contains information about the hardware that the programs on this tape use.
 */
export class TzxHwInfo {
  /**
   * Hardware type
   */
  hwType: number;

  /**
   * Hardwer Id
   */
  hwId: number;

  /**
   * Information about the tape
   *
   * 00 - The tape RUNS on this machine or with this hardware,
   *      but may or may not use the hardware or special features of the machine.
   * 01 - The tape USES the hardware or special features of the machine,
   *      such as extra memory or a sound chip.
   * 02 - The tape RUNS but it DOESN'T use the hardware
   *      or special features of the machine.
   * 03 - The tape DOESN'T RUN on this machine or with this hardware.
   */
  tapeInfo: number;

  readFrom (reader: BinaryReader): void {
    this.hwType = reader.readByte();
    this.hwId = reader.readByte();
    this.tapeInfo = reader.readByte();
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.hwType);
    writer.writeByte(this.hwId);
    writer.writeByte(this.tapeInfo);
  }
}
