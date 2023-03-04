import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This class represents a TZX data block with empty body
 */
export abstract class TzxBodylessBlockBase extends TzxBlockBase {
  readFrom (reader: BinaryReader): void {}
  writeTo (writer: BinaryWriter): void {}
}
