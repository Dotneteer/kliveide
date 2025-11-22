import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Represents the expansion but device of the ZX Spectrum Next.
 * This implementation does not support external ROMs or expansion devices.
 */
export class ExpansionBusDevice implements IGenericDevice<IZxNextMachine> {
  private _enabled: boolean;
  private _romcsReplacement: boolean;
  private _disableIoCycles: boolean;
  private _disableMemCycles: boolean;
  private _softResetPersistence: number;
  private _romcsStatus: boolean;
  private _ulaOverrideEnabled: boolean;
  private _nmiDebounceDisabled: boolean;
  private _clockAlwaysOn: boolean;
  private _p3FDCEnabled: boolean;
  private _reservedBits: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.hardReset();
  }

  get enabled(): boolean {
    return this._enabled;
  }
  
  get romcsReplacement(): boolean {
    return this._romcsReplacement;
  }

  get disableIoCycles(): boolean {
    return this._disableIoCycles;
  }

  get disableMemCycles(): boolean {
    return this._disableMemCycles;
  }
  
  get softResetPersistence(): number {
    return this._softResetPersistence;
  }

  get romcsStatus(): boolean {
    return this._romcsStatus;
  }

  get ulaOverrideEnabled(): boolean {
    return this._ulaOverrideEnabled;
  }

  get nmiDebounceDisabled(): boolean {
    return this._nmiDebounceDisabled;
  }

  get clockAlwaysOn(): boolean {
    return this._clockAlwaysOn;
  }
  
  get p3FDCEnabled(): boolean {
    return this._p3FDCEnabled;
  }

  get reservedBits(): number {
    return this._reservedBits;
  }

  hardReset(): void {
    this.nextReg80Value = 0x00;
    this.nextReg81Value = 0x00;
  }

  reset(): void {
    const persistence = this.nextReg80Value & 0x0f;
    this.nextReg80Value = (persistence << 4) | persistence;
  }

  set nextReg80Value(value: number) {
    this._enabled = (value & 0x80) !== 0;
    this._romcsReplacement = (value & 0x40) !== 0;
    this._disableIoCycles = (value & 0x20) !== 0;
    this._disableMemCycles = (value & 0x10) !== 0;
    this._softResetPersistence = value & 0x0f;
    this.machine.cpuSpeedDevice?.requestSpeedUpdate();
  }

  get nextReg80Value(): number {
    return (
      (this._enabled ? 0x80 : 0) |
      (this._romcsReplacement ? 0x40 : 0) |
      (this._disableIoCycles ? 0x20 : 0) |
      (this._disableMemCycles ? 0x10 : 0) |
      (this._softResetPersistence & 0x0f)
    );
  }

  set nextReg81Value(value: number) {
    this._romcsStatus = (value & 0x80) !== 0;
    this._ulaOverrideEnabled = (value & 0x40) !== 0;
    this._nmiDebounceDisabled = (value & 0x20) !== 0;
    this._clockAlwaysOn = (value & 0x10) !== 0;
    this._p3FDCEnabled = (value & 0x08) !== 0;
    this._reservedBits = value & 0x07;
  }

  get nextReg81Value(): number {
    return (
      (this._romcsStatus ? 0x80 : 0) |
      (this._ulaOverrideEnabled ? 0x40 : 0) |
      (this._nmiDebounceDisabled ? 0x20 : 0) |
      (this._clockAlwaysOn ? 0x10 : 0) |
      (this._p3FDCEnabled ? 0x08 : 0) |
      (this._reservedBits & 0x07)
    );
  }
}
