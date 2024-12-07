import { FS_DIR_SIZE } from "./Fat32Types";

export class FatDirEntry {
  private _view: DataView;
  constructor(public readonly buffer: Uint8Array) {
    this._view = new DataView(buffer.subarray(FS_DIR_SIZE).buffer);
  }

  clone(): FatDirEntry {
    return new FatDirEntry(new Uint8Array(this.buffer));
  }

  // Short name
  // Offset: 0x00, 11 bytes
  get DIR_Name(): string {
    return String.fromCharCode(
      this._view.getUint8(0),
      this._view.getUint8(1),
      this._view.getUint8(2),
      this._view.getUint8(3),
      this._view.getUint8(4),
      this._view.getUint8(5),
      this._view.getUint8(6),
      this._view.getUint8(7),
      this._view.getUint8(8),
      this._view.getUint8(9),
      this._view.getUint8(10)
    );
  }

  set DIR_Name(value: string) {
    for (let i = 0; i < 11; i++) {
      this._view.setUint8(i, value.charCodeAt(i));
    }
  }

  // Attributes
  // Offset: 0x0b, 1 byte
  get DIR_Attr(): number {
    return this._view.getUint8(11);
  }

  set DIR_Attr(value: number) {
    this._view.setUint8(11, value);
  }

  // Reserved
  // Offset: 0x0c, 1 byte
  get DIR_NTRes(): number {
    return this._view.getUint8(12);
  }

  set DIR_NTRes(value: number) {
    this._view.setUint8(12, value);
  }

  // Creation time
  // Offset: 0x0d, 1 byte
  get DIR_CrtTimeTenth(): number {
    return this._view.getUint8(13);
  }

  set DIR_CrtTimeTenth(value: number) {
    this._view.setUint8(13, value);
  }

  get DIR_CrtTime(): number {
    return this._view.getUint16(14, true);
  }

  set DIR_CrtTime(value: number) {
    this._view.setUint16(14, value, true);
  }

  get DIR_CrtDate(): number {
    return this._view.getUint16(16, true);
  }

  set DIR_CrtDate(value: number) {
    this._view.setUint16(16, value, true);
  }

  get DIR_LstAccDate(): number {
    return this._view.getUint16(18, true);
  }

  set DIR_LstAccDate(value: number) {
    this._view.setUint16(18, value, true);
  }

  get DIR_FstClusHI(): number {
    return this._view.getUint16(20, true);
  }

  set DIR_FstClusHI(value: number) {
    this._view.setUint16(20, value, true);
  }

  get DIR_WrtTime(): number {
    return this._view.getUint16(22, true);
  }

  set DIR_WrtTime(value: number) {
    this._view.setUint16(22, value, true);
  }

  get DIR_WrtDate(): number {
    return this._view.getUint16(24, true);
  }

  set DIR_WrtDate(value: number) {
    this._view.setUint16(24, value, true);
  }

  get DIR_FstClusLO(): number {
    return this._view.getUint16(26, true);
  }

  set DIR_FstClusLO(value: number) {
    this._view.setUint16(26, value, true);
  }

  get DIR_FileSize(): number {
    return this._view.getUint32(28, true);
  }

  set DIR_FileSize(value: number) {
    this._view.setUint32(28, value, true);
  }
}
