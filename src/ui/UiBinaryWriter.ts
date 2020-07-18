const CHUNK_INCREMENT = 4096;

/**
 * This class implements a writer to a binary stream
 */
export class UiBinaryWriter {
  private _position: number = 0;
  private _buffer: Uint8Array = new Uint8Array(0);

  /**
   * Writes a byte value to the stream
   * @param value Value to write
   */
  writeByte(value: number): void {
    this._extend(1);
    this._buffer[this._position++] = value;
  }

  /**
   * Writes an array of bytes to the stream
   * @param value Value to write
   */
  writeBytes(value: Uint8Array): void {
    this._extend(value.length + 4);
    this.writeUint32(value.length);
    for (let i = 0; i < value.length; i++) {
      this._buffer[this._position++] = value[i];
    }
  }

  /**
   * Writes an u16 value to the stream
   * @param value Value to write
   */
  writeUint16(value: number): void {
    this._extend(2);
    this._buffer[this._position++] = value;
    this._buffer[this._position++] = (value >> 8);
  }

  /**
   * Writes an u32 value to the stream
   * @param value Value to write
   */
  writeUint32(value: number): void {
    this._extend(4);
    this._buffer[this._position++] = value;
    this._buffer[this._position++] = (value >> 8);
    this._buffer[this._position++] = (value >> 16);
    this._buffer[this._position++] = (value >> 24);
  }

  /**
   * Writes an u64 value to the stream
   * @param value Value to write
   */
  writeUint64(value: number): void {
    this.writeUint32(value & 0xffffffff);
    this.writeUint32(value >> 32);
  }

  /**
   * Gets the buffer of the writer
   */
  get buffer(): Uint8Array {
    const clone = new Uint8Array(this._position);
    for (let i = 0; i < clone.length; i++) {
      clone[i] = this._buffer[i];
    }
    return clone;
  }

  /**
   * Extensd the buffer to the specified size
   * @param size Required buffer size
   */
  private _extend(size: number): void {
    if (this._buffer.length >= this._position + size) return;
    const newBuff = new Uint8Array(this._position + size + CHUNK_INCREMENT);
    for (let i = 0; i < this._buffer.length; i++) {
      newBuff[i] = this._buffer[i];
    }
    this._buffer = newBuff;
  }
}
