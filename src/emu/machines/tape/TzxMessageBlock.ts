import { BinaryReader } from "@/common/utils/BinaryReader";
import { BinaryWriter } from "@/common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This will enable the emulators to display a message for a given time.
 *
 * This should not stop the tape and it should not make silence. If the
 * time is 0 then the emulator should wait for the user to press a key.
 */
export class TzxMessageBlock extends TzxBlockBase {
  /**
   * Time (in seconds) for which the message should be displayed
   */
  time: number;

  /**
   * Length of the description
   */
  messageLength: number;

  /**
   * The description bytes
   */
  message: Uint8Array;

  /**
   * The string form of description
   */
  get messageText (): string {
    return TzxBlockBase.toAsciiString(this.message);
  }

  get blockId (): number {
    return 0x31;
  }

  readFrom (reader: BinaryReader): void {
    this.time = reader.readByte();
    this.messageLength = reader.readByte();
    this.message = new Uint8Array(reader.readBytes(this.messageLength));
  }

  writeTo (writer: BinaryWriter): void {
    writer.writeByte(this.time);
    writer.writeByte(this.messageLength);
    writer.writeBytes(this.message);
  }
}
