import { BinaryReader } from "@utils/BinaryReader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxBlockBase } from "./TzxBlockBase";

/**
 * This class represents a deprecated TZX block
 */
export abstract class TzxDeprecatedBlockBase extends TzxBlockBase {
  readThrough (_: BinaryReader): void {}
  readFrom (_: BinaryReader): void {}
  writeTo (_: BinaryWriter): void {
    throw new Error("Deprecated TZX data blocks cannot be written.");
  }
}
