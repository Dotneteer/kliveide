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

  constructor (public readonly header?: Uint8Array) {
    this._headerBytes = new Uint8Array[HEADER_LEN]();
    for (let i = 0; i < HEADER_LEN; i++) this._headerBytes[i] = 0x00;
    this.calcChecksum();
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
      this._headerBytes[i] = value.at[i - NAME_OFFS] & 0xff;
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
