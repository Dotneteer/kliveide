import { FatPartitionEntry } from "./FatPartitionEntry";

export class FatMasterBootRecord {
  private _view: DataView;

  constructor(
    public readonly buffer: Uint8Array,
  ) {
    this._view = new DataView(buffer.buffer);
  }

  // Boot code
  // Offset: 0x00, 446 bytes
  get bootCode(): Uint8Array {
    return this.buffer.slice(0, 446);
  }

  set bootCode(value: Uint8Array) {
    this.buffer.set(value, 0);
  }

  // Disk partition #1
  // Offset: 0x1be, 16 bytes
  get partition1(): FatPartitionEntry {
    return new FatPartitionEntry(this.buffer, 446);
  }

  set partition1(value: FatPartitionEntry) {
    this.buffer.set(value.buffer, 446);
  }

  // Disk partition #2
  // Offset: 0x1ce, 16 bytes
  get partition2(): FatPartitionEntry {
    return new FatPartitionEntry(this.buffer, 462);
  } 

  set partition2(value: FatPartitionEntry) {
    this.buffer.set(value.buffer, 462);
  }

  // Disk partition #3
  // Offset: 0x1de, 16 bytes
  get partition3(): FatPartitionEntry {
    return new FatPartitionEntry(this.buffer, 478);
  }

  set partition3(value: FatPartitionEntry) {
    this.buffer.set(value.buffer, 478);
  }

  // Disk partition #4
  // Offset: 0x1ee, 16 bytes
  get partition4(): FatPartitionEntry {
    return new FatPartitionEntry(this.buffer, 494);
  }

  set partition4(value: FatPartitionEntry) {
    this.buffer.set(value.buffer, 494);
  }

  // Boot sector signature
  // Offset: 0x1fe, 2 bytes
  get bootSignature(): number {
    return this._view.getUint16(510, true);
  }

  set bootSignature(value: number) {
    this._view.setUint16(510, value, true);
  }
}
