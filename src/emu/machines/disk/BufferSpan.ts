/**
 * This class is used to represent a span of a buffer
 */
export class BufferSpan {
  constructor (
    // --- The buffer that stores the data
    public readonly buffer: Uint8Array,
    // --- The start offset of the span
    public readonly startOffset: number,
    // --- The length of the span
    public readonly length: number
  ) {
    this.buffer = buffer;
    this.startOffset = startOffset;
    this.length = length;
  }

  /**
   * Gets the byte at the specified index
   * @param index Byte index
   * @returns Data value
   */
  get (index: number) {
    if (index < 0 || index >= this.length) {
      throw new Error("Index out of range");
    }
    return this.buffer[this.startOffset + index];
  }

  /**
   * Gets the bit at the specified index
   * @param bitIndex Bit index
   * @returns Bit value
   */
  getBit (bitIndex: number): boolean {
    const byteIndex = bitIndex >> 3;
    const bitMask = 1 << (bitIndex & 0x07);
    if (byteIndex < 0 || byteIndex >= this.length) {
      throw new Error("Index out of range");
    }
    return (this.get(byteIndex) & bitMask) !== 0;
  }

  /**
   * Sets the byte at the specified index
   * @param index Byte index
   * @param value Data value
   */
  set (index: number, value: number) {
    if (index < 0 || index >= this.length) {
      throw new Error("Index out of range");
    }
    this.buffer[this.startOffset + index] = value;
  }

  /**
   * Sets the bit at the specified index
   * @param bitIndex Bit index
   * @param value Bit value
   */
  setBit (bitIndex: number, value: boolean): void {
    const byteIndex = bitIndex >> 3;
    const bitMask = 1 << (bitIndex & 0x07);
    if (byteIndex < 0 || byteIndex >= this.length) {
      throw new Error("Index out of range");
    }
    if (value) {
      this.buffer[this.startOffset + byteIndex] |= bitMask;
    } else {
      this.buffer[this.startOffset + byteIndex] &= ~bitMask;
    }
  }

  /**
   * Tests the bit at the specified index
   * @param bitIndex Bit index
   * @returns Bit value
   */
  testBit (bitIndex: number): boolean {
    const byteIndex = bitIndex >> 3;
    const bitMask = 1 << (bitIndex & 0x07);
    if (byteIndex < 0 || byteIndex >= this.length) {
      throw new Error("Index out of range");
    }
    return (this.buffer[this.startOffset + byteIndex] & bitMask) !== 0;
  }
}
