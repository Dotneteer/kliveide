export class FatBootSector {
  private _view: DataView;
  constructor(
    public readonly buffer: Uint8Array,
    public readonly offset = 0
  ) {
    this._view = new DataView(buffer.buffer);
  }

  get BS_JmpBoot(): number {
    return (
      (this._view.getUint8(this.offset) <<  16) +
      (this._view.getUint8(this.offset + 1) << 8) +
      this._view.getUint8(this.offset + 2)
    );
  }

  set BS_JmpBoot(value: number) {
    this._view.setUint8(this.offset, (value >> 16) & 0xff);
    this._view.setUint8(this.offset + 1, (value >> 8) & 0xff);
    this._view.setUint8(this.offset + 2, value & 0xff);
  }

  get BS_OEMName(): string {
    return String.fromCharCode(
      this._view.getUint8(this.offset + 3),
      this._view.getUint8(this.offset + 4),
      this._view.getUint8(this.offset + 5),
      this._view.getUint8(this.offset + 6),
      this._view.getUint8(this.offset + 7),
      this._view.getUint8(this.offset + 8),
      this._view.getUint8(this.offset + 9),
      this._view.getUint8(this.offset + 10)
    );
  }

  set BS_OEMName(value: string) {
    for (let i = 0; i < 8; i++) {
      this._view.setUint8(this.offset + 3 + i, value.charCodeAt(i));
    }
  }

  get BPB_BytsPerSec(): number {
    return this._view.getUint16(this.offset + 11, true);
  }

  set BPB_BytsPerSec(value: number) {
    this._view.setUint16(this.offset + 11, value, true);
  }

  get BPB_SecPerClus(): number {
    return this._view.getUint8(this.offset + 13);
  }

  set BPB_SecPerClus(value: number) {
    this._view.setUint8(this.offset + 13, value);
  }

  get BPB_ResvdSecCnt(): number {
    return this._view.getUint16(this.offset + 14, true);
  }

  set BPB_ResvdSecCnt(value: number) {
    this._view.setUint16(this.offset + 14, value, true);
  }

  get BPB_NumFATs(): number {
    return this._view.getUint8(this.offset + 16);
  }

  set BPB_NumFATs(value: number) {
    this._view.setUint8(this.offset + 16, value);
  }

  get BPB_RootEntCnt(): number {
    return this._view.getUint16(this.offset + 17, true);
  }

  set BPB_RootEntCnt(value: number) {
    this._view.setUint16(this.offset + 17, value, true);
  }

  get BPB_TotSec16(): number {
    return this._view.getUint16(this.offset + 19, true);
  }

  set BPB_TotSec16(value: number) {
    this._view.setUint16(this.offset + 19, value, true);
  }

  get BPB_Media(): number {
    return this._view.getUint8(this.offset + 21);
  }

  set BPB_Media(value: number) {
    this._view.setUint8(this.offset + 21, value);
  }

  get BPB_FATSz16(): number {
    return this._view.getUint16(this.offset + 22, true);
  }

  set BPB_FATSz16(value: number) {
    this._view.setUint16(this.offset + 22, value, true);
  }

  get BPB_SecPerTrk(): number {
    return this._view.getUint16(this.offset + 24, true);
  }

  set BPB_SecPerTrk(value: number) {
    this._view.setUint16(this.offset + 24, value, true);
  }

  get BPB_NumHeads(): number {
    return this._view.getUint16(this.offset + 26, true);
  }

  set BPB_NumHeads(value: number) {
    this._view.setUint16(this.offset + 26, value, true);
  }

  get BPB_HiddSec(): number {
    return this._view.getUint32(this.offset + 28, true);
  }

  set BPB_HiddSec(value: number) {
    this._view.setUint32(this.offset + 28, value, true);
  }

  get BPB_TotSec32(): number {
    return this._view.getUint32(this.offset + 32, true);
  }

  set BPB_TotSec32(value: number) {
    this._view.setUint32(this.offset + 32, value, true);
  }

  get BPB_FATSz32(): number {
    return this._view.getUint32(this.offset + 36, true);
  }

  set BPB_FATSz32(value: number) {
    this._view.setUint32(this.offset + 36, value, true);
  }

  get BPB_ExtFlags(): number {
    return this._view.getUint16(this.offset + 40, true);
  }

  set BPB_ExtFlags(value: number) {
    this._view.setUint16(this.offset + 40, value, true);
  }

  get BPB_FSVer(): number {
    return this._view.getUint16(this.offset + 42, true);
  }

  set BPB_FSVer(value: number) {
    this._view.setUint16(this.offset + 42, value, true);
  }

  get BPB_RootClus(): number {
    return this._view.getUint32(this.offset + 44, true);
  }

  set BPB_RootClus(value: number) {
    this._view.setUint32(this.offset + 44, value, true);
  }

  get BPB_FSInfo(): number {
    return this._view.getUint16(this.offset + 48, true);
  }

  set BPB_FSInfo(value: number) {
    this._view.setUint16(this.offset + 48, value, true);
  }

  get BPB_BkBootSec(): number {
    return this._view.getUint16(this.offset + 50, true);
  }

  set BPB_BkBootSec(value: number) {
    this._view.setUint16(this.offset + 50, value, true);
  }

  get BPB_Reserved(): Uint8Array {
    return new Uint8Array(this.buffer.buffer, this.offset + 52, 12);
  }

  set BPB_Reserved(value: Uint8Array) {
    this.buffer.set(value, this.offset + 52);
  }

  get BS_DrvNum(): number {
    return this._view.getUint8(this.offset + 64);
  }

  set BS_DrvNum(value: number) {
    this._view.setUint8(this.offset + 64, value);
  }

  get BS_Reserved1(): number {
    return this._view.getUint8(this.offset + 65);
  }

  set BS_Reserved1(value: number) {
    this._view.setUint8(this.offset + 65, value);
  }

  get BS_BootSig(): number {
    return this._view.getUint8(this.offset + 66);
  }

  set BS_BootSig(value: number) {
    this._view.setUint8(this.offset + 66, value);
  }

  get BS_VolID(): number {
    return this._view.getUint32(this.offset + 67, true);
  }

  set BS_VolID(value: number) {
    this._view.setUint32(this.offset + 67, value, true);
  }

  get BS_VolLab(): string {
    return String.fromCharCode(
      this._view.getUint8(this.offset + 71),
      this._view.getUint8(this.offset + 72),
      this._view.getUint8(this.offset + 73),
      this._view.getUint8(this.offset + 74),
      this._view.getUint8(this.offset + 75),
      this._view.getUint8(this.offset + 76),
      this._view.getUint8(this.offset + 77),
      this._view.getUint8(this.offset + 78),
      this._view.getUint8(this.offset + 79),
      this._view.getUint8(this.offset + 80),
      this._view.getUint8(this.offset + 81)
    );
  }

  set BS_VolLab(value: string) {
    for (let i = 0; i < 11; i++) {
      this._view.setUint8(this.offset + 71 + i, value.charCodeAt(i));
    }
  }

  get BS_FileSysType(): string {
    return String.fromCharCode(
      this._view.getUint8(this.offset + 82),
      this._view.getUint8(this.offset + 83),
      this._view.getUint8(this.offset + 84),
      this._view.getUint8(this.offset + 85),
      this._view.getUint8(this.offset + 86),
      this._view.getUint8(this.offset + 87),
      this._view.getUint8(this.offset + 88),
      this._view.getUint8(this.offset + 89)
    );
  }

  set BS_FileSysType(value: string) {
    for (let i = 0; i < 8; i++) {
      this._view.setUint8(this.offset + 82 + i, value.charCodeAt(i));
    }
  }

  get BootCode(): Uint8Array {
    return new Uint8Array(this.buffer.buffer, this.offset + 90, 420);
  }

  set BootCode(value: Uint8Array) {
    this.buffer.set(value, this.offset + 90);
  }

  get BootSectorSignature(): number {
    return this._view.getUint16(this.offset + 510, true);
  }

  set BootSectorSignature(value: number) {
    this._view.setUint16(this.offset + 510, value, true);
  }
}
