const HEADER_LEN = 19;
const TYPE_OFFS = 1;
const NAME_OFFS = 2;
const NAME_LEN = 10;
const DATA_LEN_OFFS = 12;
const PAR1_OFFS = 14;
const PAR2_OFFS = 16;
const CHK_OFFS = 18;

export class SpectrumTapeHeader {
  private _headerBytes: Uint8Array;

  // The bytes of the header
  get headerBytes (): Uint8Array {
    return this._headerBytes;
  }

  /**
   * @param header The 19 bytes of an existing header block (flag, type, name, length, parameters,
   * checksum) to read. Omitted, the header starts zero-filled for a writer to set up.
   *
   * The argument used to be ignored: every header came out zero-filled, so the class could build a
   * header but never read one. Every writer calls it without an argument, so copying changes nothing
   * for them. The checksum is copied as read, not recalculated, so a reader can tell a bad one.
   */
  constructor (public readonly header?: Uint8Array) {
    this._headerBytes = new Uint8Array(HEADER_LEN);
    if (header) {
      this._headerBytes.set(header.subarray(0, HEADER_LEN));
    } else {
      this.calcChecksum();
    }
  }

  /** The raw bytes of the name, control codes and all (a name can hold `AT` and colour codes) */
  get nameBytes (): Uint8Array {
    return this._headerBytes.slice(NAME_OFFS, NAME_OFFS + NAME_LEN);
  }

  /** Whether the stored checksum matches the header's bytes */
  get checksumValid (): boolean {
    let chk = 0x00;
    for (let i = 0; i < HEADER_LEN - 1; i++) chk ^= this._headerBytes[i];
    return chk === this._headerBytes[CHK_OFFS];
  }

  // Gets or sets the type of the header
  get type (): number {
    return this._headerBytes[TYPE_OFFS];
  }
  set type (value: number) {
    this._headerBytes[TYPE_OFFS] = value & 0xff;
    this.calcChecksum();
  }

  // Gets or sets the program name
  get name (): string {
    let name = "";
    for (let i = NAME_OFFS; i < NAME_OFFS + NAME_LEN; i++) {
      name += String.fromCharCode(this._headerBytes[i]);
    }
    return name.trim();
  }
  set name (value: string) {
    if (value.length > NAME_LEN) {
      value = value.substring(0, NAME_LEN);
    } else if (value.length < NAME_LEN) {
      value = value.padEnd(NAME_LEN, " ");
    }

    for (var i = NAME_OFFS; i < NAME_OFFS + NAME_LEN; i++) {
      this._headerBytes[i] = value.charCodeAt(i - NAME_OFFS) & 0xff;
    }
    this.calcChecksum();
  }

  // Gets or sets the Data Length
  get dataLength (): number {
    return this.getWord(DATA_LEN_OFFS);
  }
  set dataLength (value: number) {
    this.setWord(DATA_LEN_OFFS, value);
  }

  // Gets or sets Parameter1
  get parameter1 (): number {
    return this.getWord(PAR1_OFFS);
  }
  set parameter1 (value: number) {
    this.setWord(PAR1_OFFS, value);
  }

  // Gets or sets Parameter1
  get parameter2 (): number {
    return this.getWord(PAR2_OFFS);
  }
  set parameter2 (value: number) {
    this.setWord(PAR2_OFFS, value);
  }

  // Gets the value of checksum
  get checksum (): number {
    return this._headerBytes[CHK_OFFS];
  }

  // Calculate the checksum
  calcChecksum (): void {
    let chk = 0x00;
    for (var i = 0; i < HEADER_LEN - 1; i++) {
      chk ^= this._headerBytes[i];
    }
    this._headerBytes[CHK_OFFS] = chk & 0xff;
  }

  // Gets the word value from the specified offset
  getWord (offset: number): number {
    return (
      (this._headerBytes[offset] + 256 * this._headerBytes[offset + 1]) & 0xffff
    );
  }

  // Sets the word value at the specified offset
  setWord (offset: number, value: number) {
    this._headerBytes[offset] = value & 0xff;
    this._headerBytes[offset + 1] = (value >> 8) & 0xff;
    this.calcChecksum();
  }
}
