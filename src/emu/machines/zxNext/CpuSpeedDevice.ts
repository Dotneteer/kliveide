import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * This device is responsible for managing the CPU speed settings of the ZX Spectrum Next.
 * 
 * Registers involved:
 * 0x07 - CPU Speed
 * Hard Reset: 0x00 (3.5 MHz)  
 * Soft Reset: Unchanged
 * Read:
 *   Bits 5:4 = Current actual speed
 *   Bits 1:0 = Programmed speed
 * Write:
 *   Bits 1:0 = Set CPU speed
 *    00 = 3.5 MHz
 *    01 = 7 MHz
 *    10 = 14 MHz
 *    11 = 28 MHz
 * 
 * The effective CPU speed is influenced by the Expansion Bus state:
 * - If the Expansion Bus is enabled, the CPU speed is forced to 3.5 MHz.
 * - If the Expansion Bus is disabled, the CPU runs at the programmed speed.
 */
export class CpuSpeedDevice implements IGenericDevice<IZxNextMachine> {
  private _programmedSpeed: number;
  private _effectiveSpeed: number;
  private _effectiveClockMultiplier: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  get programmedSpeed(): number {
    return this._programmedSpeed;
  }

  get effectiveSpeed(): number {
    return this._effectiveSpeed;
  }

  get effectiveClockMultiplier(): number {
    return this._effectiveClockMultiplier;
  }

  reset(): void {
    // --- CPU speed is preserved
  }

  hardReset(): void {
    this._programmedSpeed = 0x00;
    this._effectiveSpeed = 0x00;
    this._effectiveClockMultiplier = 1;
  }

  set nextReg07Value(value: number) {
    this._programmedSpeed = value & 0x03;
    this.requestSpeedUpdate();
  }

  get nextReg07Value(): number {
    return (this._programmedSpeed & 0x03) | (this._effectiveSpeed << 4);
  }

  requestSpeedUpdate() : void {
    this._effectiveSpeed = this.machine.expansionBusDevice.enabled
      ? 0x00 // Always 3.5MHz when expansion bus enabled
      : this._programmedSpeed;
    this._effectiveClockMultiplier = 1 << this._effectiveSpeed;
  }
}
