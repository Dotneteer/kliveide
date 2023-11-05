import { TzxBlockBase } from "./TzxBlockBase";

/**
 * Base class for all TZX block type with data length of 3 bytes
 */
export abstract class Tzx3ByteBlockBase extends TzxBlockBase {
  /**
   * Used bits in the last byte (other bits should be 0)
   *
   * (e.g. if this is 6, then the bits used(x) in the last byte are:
   * xxxxxx00, where MSb is the leftmost bit, LSb is the rightmost bit)
   */
  lastByteUsedBits: number;

  /**
   * Lenght of block data
   */
  dataLength: number[];

  /**
   * Block Data
   */
  data: number[];

  get isValid (): boolean {
    return this.getLength() === this.data?.length;
  }

  /**
   * Calculates data length
   */
  protected getLength (): number {
    return (
      this.dataLength![0] +
      (this.dataLength[1] << 8) +
      (this.dataLength[2] << 16)
    );
  }
}
