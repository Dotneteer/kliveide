export class FatFsInfo {
  private _view: DataView;
  constructor(
    public readonly buffer: Uint8Array,
    public readonly offset = 0
  ) {
    this._view = new DataView(buffer.buffer);
  }

  // Signature
  // Offset: 0x00, 4 bytes
  get FSI_LeadSig(): number {
    return this._view.getUint32(this.offset, true);
  }

  set FSI_LeadSig(value: number) {
    this._view.setUint32(this.offset, value, true);
  }

  // Reserved
  // Offset: 0x04, 480 bytes
  get FSI_Reserved1(): Uint8Array {
    return this.buffer.slice(4, 484);
  }

  set FSI_Reserved1(value: Uint8Array) {
    this.buffer.set(value, 4);
  }

  // Signature
  // Offset: 0x1e4, 4 bytes
  get FSI_StrucSig(): number {
    return this._view.getUint32(this.offset + 484, true);
  }

  set FSI_StrucSig(value: number) {
    this._view.setUint32(this.offset + 484, value, true);
  }

  // Free cluster count
  // Offset: 0x1e8, 4 bytes
  get FSI_Free_Count(): number {
    return this._view.getUint32(this.offset + 488, true);
  }

  set FSI_Free_Count(value: number) {
    this._view.setUint32(this.offset + 488, value, true);
  }

  // Next free cluster
  // Offset: 0x1ec, 4 bytes
  get FSI_Nxt_Free(): number {
    return this._view.getUint32(this.offset + 492, true);
  }

  set FSI_Nxt_Free(value: number) {
    this._view.setUint32(this.offset + 492, value, true);
  }

  // Reserved
  // Offset: 0x1f0, 12 bytes
  get FSI_Reserved2(): Uint8Array {
    return this.buffer.slice(496, 508);
  }

  set FSI_Reserved2(value: Uint8Array) {
    this.buffer.set(value, 496);
  }

  // Signature
  // Offset: 0x1fc, 4 bytes
  get FSI_TrailSig(): number {
    return this._view.getUint32(this.offset + 508, true);
  }

  set FSI_TrailSig(value: number) {
    this._view.setUint32(this.offset + 508, value, true);
  }
}
