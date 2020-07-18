/**
 * This class allows you to read binary information from a file or a buffer
 */
export class UiBinaryReader {
  private _buffer: Uint8Array;
  private _position: number;

  /**
   * Initializes a binary reader that reads information from a buffer
   * @param buffer Buffer or file name to read form
   */
  constructor(buffer: Uint8Array) {
    this._buffer = buffer;
    this._position = 0;
  }

  /**
   * Gets the current stream position
   */
  get position(): number {
    return this._position;
  }

  /**
   * Seeks the specified position
   * @param position Position to seek foor
   */
  seek(position: number): void {
    if (position < 0) {
      throw new Error("Stream position cannot be negative");
    }
    if (position > this._buffer.length) {
      throw new Error("Stream position is over the end of the stream");
    } else {
      this._position = position;
    }
  }

  /**
   * Get the length of the stream
   */
  get length(): number {
    return this._buffer.length;
  }

  /**
   * Tests if the reader has contents at all
   */
  get hasContent(): boolean {
    return this._buffer.length > 0;
  }

  /**
   * Test is the current position is at the end of the file
   */
  get eof(): boolean {
    return this._position >= this._buffer.length;
  }

  /**
   * Reads a single byte from the stream
   */
  readByte(): number {
    this._testEof();
    return this._buffer[this._position++];
  }

  /**
   * Reads a byte array from the stream. The subsequent 4 bytes defines
   * the length of the array
   */
  readBytes(): number[] {
    const length = this.readUint32();
    const result: number[] = [];
    for (let i = 0; i < length; i++) {
      result[i] = this.readByte();
    }
    return result;
  }

  /**
   * Reads a 16-bit unsigned integer from the stream
   */
  readUint16(): number {
    return this.readByte() + (this.readByte() << 8);
  }

  /**
   * Reads a 32-bit unsigned integer from the stream
   */
  readUint32(): number {
    return (
      this.readByte() +
      (this.readByte() << 8) +
      (this.readByte() << 16) +
      (this.readByte() << 24)
    );
  }

  /**
   * Reads a 32-bit unsigned integer from the stream
   */
  readUint64(): number {
    return ((this.readUint32()) << 32) | (this.readUint32());
  }

  /**
   * Tests if end of file is reached
   */
  private _testEof(): void {
    if (this.eof) {
      throw new Error("End of file reached");
    }
  }
}
