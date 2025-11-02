export class FatLongFileName {
  private _view: DataView;

  constructor(public readonly buffer: Uint8Array) {
    this._view = new DataView(buffer.buffer);
  }

  // Order
  // Offset: 0x00, 1 byte
  get LDIR_Ord(): number {
    return this._view.getUint8(0);
  }

  set LDIR_Ord(value: number) {
    this._view.setUint8(0, value);
  }

  // Name 1
  // Offset: 0x01, 10 bytes
  get LDIR_Name1(): number[] {
    const result = [];
    for (let i = 0; i < 5; i++) {
      result.push(this._view.getUint16(1 + i * 2, true));
    }
    return result;
  }

  set LDIR_Name1(value: number[]) {
    for (let i = 0; i < 5; i++) {
      this._view.setUint16(1 + i * 2, value[i], true);
    }
  }

  // Attributes
  // Offset: 0x0b, 1 byte
  get LDIR_Attr(): number {
    return this._view.getUint8(11);
  }

  set LDIR_Attr(value: number) {
    this._view.setUint8(11, value);
  }

  // Type
  // Offset: 0x0c, 1 byte
  get LDIR_Type(): number {
    return this._view.getUint8(12);
  }

  set LDIR_Type(value: number) {
    this._view.setUint8(12, value);
  }

  // Checksum
  // Offset: 0x0d, 1 byte
  get LDIR_Chksum(): number {
    return this._view.getUint8(13);
  }

  set LDIR_Chksum(value: number) {
    this._view.setUint8(13, value);
  }

  // Name 2
  // Offset: 0x0e, 12 bytes
  get LDIR_Name2(): number[] {
    const result = [];
    for (let i = 0; i < 6; i++) {
      result.push(this._view.getUint16(14 + i * 2, true));
    }
    return result;
  }

  set LDIR_Name2(value: number[]) {
    for (let i = 0; i < 6; i++) {
      this._view.setUint16(14 + i * 2, value[i], true);
    }
  }

  // First cluster
  // Offset: 0x1a, 2 bytes
  get LDIR_FstClusLO(): number {
    return this._view.getUint16(26, true);
  }

  set LDIR_FstClusLO(value: number) {
    this._view.setUint16(26, value, true);
  }

  // Name 3
  // Offset: 0x1c, 4 bytes
  get LDIR_Name3(): number[] {
    const result = [];
    for (let i = 0; i < 2; i++) {
      result.push(this._view.getUint16(28 + i * 2, true));
    }
    return result;
  }

  set LDIR_Name3(value: number[]) {
    for (let i = 0; i < 2; i++) {
      this._view.setUint16(28 + i * 2, value[i], true);
    }
  }
}
