import { BinaryReader } from "../../../common/utils/BinaryReader";
import { BinaryWriter } from "../../../common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

// --- TZX signature header
const tzxSignature = new Uint8Array([0x5a, 0x58, 0x54, 0x61, 0x70, 0x65, 0x21]);

/**
 * Represents the header of the TZX file
 */
export class TzxHeader extends TzxBlockBase {
    signature: Uint8Array;
    eot: number;
    majorVersion: number;
    minorVersion: number;
  
    constructor (majorVersion = 1, minorVersion = 20) {
      super();
      this.signature = new Uint8Array(tzxSignature);
      this.eot = 0x1a;
      this.majorVersion = majorVersion;
      this.minorVersion = minorVersion;
    }
  
    get blockId (): number {
      return 0x00;
    }
  
    readFrom (reader: BinaryReader): void {
      this.signature = new Uint8Array(reader.readBytes(7));
      this.eot = reader.readByte();
      this.majorVersion = reader.readByte();
      this.minorVersion = reader.readByte();
    }
  
    writeTo (writer: BinaryWriter): void {
      writer.writeBytes(this.signature);
      writer.writeByte(this.eot);
      writer.writeByte(this.majorVersion);
      writer.writeByte(this.minorVersion);
    }
  
    get isValid (): boolean {
      return (
        this.signature.length === tzxSignature.length &&
        this.eot === 0x1a &&
        this.majorVersion === 1
      );
    }
  }
  
  