/**
 * Represents a FAT32 partition entry in the MBR.
 */
export class FatPartitionEntry {
  private _view: DataView;
  constructor(public readonly buffer: Uint8Array, public readonly offset = 0) {
    this._view = new DataView(buffer.buffer);
  }

  // Boot indicator
  // Offset: 0x00, 1 byte
  get bootIndicator(): number {
    return this._view.getUint8(this.offset);
  }

  set bootIndicator(value: number) {
    this._view.setUint8(this.offset, value);
  }

  // Starting CHS address
  // Offset: 0x01, 3 bytes
  get beginChs(): [number, number, number] {
    return [
      this._view.getUint8(this.offset + 1),
      this._view.getUint8(this.offset + 2),
      this._view.getUint8(this.offset + 3)
    ];
  } 

  set beginChs(value: [number, number, number]) {
    this._view.setUint8(this.offset + 1, value[0]);
    this._view.setUint8(this.offset + 2, value[1]);
    this._view.setUint8(this.offset + 3, value[2]);
  }

  // Partition type
  // Offset: 0x04, 1 byte
  get partType(): number {
    return this._view.getUint8(this.offset + 4);
  }

  set partType(value: number) {
    this._view.setUint8(this.offset + 4, value);
  }

  // Ending CHS address
  // Offset: 0x05, 3 bytes
  get endChs(): [number, number, number] {
    return [
      this._view.getUint8(this.offset + 5),
      this._view.getUint8(this.offset + 6),
      this._view.getUint8(this.offset + 7)
    ];
  }

  set endChs(value: [number, number, number]) {
    this._view.setUint8(this.offset + 5, value[0]);
    this._view.setUint8(this.offset + 6, value[1]);
    this._view.setUint8(this.offset + 7, value[2]);
  }

  // Starting LBA address
  // Offset: 0x08, 4 bytes
  get relativeSectors(): number {
    return this._view.getUint32(this.offset + 8, true);
  }

  set relativeSectors(value: number) {
    this._view.setUint32(this.offset + 8, value, true);
  }

  // Total sectors in partition
  // Offset: 0x0c, 4 bytes
  get totalSectors(): number {
    return this._view.getUint32(this.offset + 12, true);
  }

  set totalSectors(value: number) {
    this._view.setUint32(this.offset + 12, value, true);
  }
}
