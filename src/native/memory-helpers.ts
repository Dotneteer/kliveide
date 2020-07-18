import { CpuApi } from "./api";

/**
 * This class provides operations to work with
 */
export class MemoryHelper {
  private readonly _memory: Uint8Array;

  /**
   * Instantiates a helper object
   * @param wasmApi WASM instance to use
   * @param ptr Memory pointer this helper works with
   */
  constructor(public wasmApi: CpuApi, public ptr: number) {
    this._memory = new Uint8Array(wasmApi.memory.buffer, 0);
  }

  /**
   * Reads a byte from the memory
   * @param offs Offset value
   */
  readByte(offs: number): number {
    offs += this.ptr;
    return this._memory[offs];
  }

  /**
   * Writes a byte to the memory
   * @param offs Offset value
   */
  writeByte(offs: number, value: number): void {
    offs += this.ptr;
    this._memory[offs] = value & 0xff;
  }

  /**
   * Reads a boolean from the memory
   * @param offs Offset value
   */
  readBool(offs: number): boolean {
    offs += this.ptr;
    return this._memory[offs] !== 0;
  }

  /**
   * Writes a boolean to the memory
   * @param offs Offset value
   */
  writeBool(offs: number, value: boolean): void {
    offs += this.ptr;
    this._memory[offs] = value ? 1 : 0;
  }

  /**
   * Reads an Uint16 value from the memory
   * @param offs Offset value
   */
  readUint16(offs: number): number {
    offs += this.ptr;
    return this._memory[offs] + (this._memory[offs + 1] << 8);
  }

  /**
   * Writes an Uint16 value to the memory
   * @param offs Offset value
   */
  writeUint16(offs: number, value: number): void {
    offs += this.ptr;
    this._memory[offs] = value & 0xff;
    this._memory[offs + 1] = (value >> 8) & 0xff;
  }

  /**
   * Reads an Uint32 value from the memory
   * @param offs Offset value
   */
  readUint32(offs: number): number {
    offs += this.ptr;
    return (
      this._memory[offs] +
      (this._memory[offs + 1] << 8) +
      (this._memory[offs + 2] << 16) +
      (this._memory[offs + 3] << 24)
    );
  }

  /**
   * Writes an Uint16 value to the memory
   * @param offs Offset value
   */
  writeUint32(offs: number, value: number): void {
    offs += this.ptr;
    this._memory[offs] = value & 0xff;
    this._memory[offs + 1] = (value >> 8) & 0xff;
    this._memory[offs + 2] = (value >> 16) & 0xff;
    this._memory[offs + 3] = (value >> 24) & 0xff;
  }
}
