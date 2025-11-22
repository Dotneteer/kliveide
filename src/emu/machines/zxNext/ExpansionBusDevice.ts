import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Represents the expansion but device of the ZX Spectrum Next.
 * This implementation does not support external ROMs or expansion devices.
 */
export class ExpansionBusDevice implements IGenericDevice<IZxNextMachine> {
  private enabled: boolean;
  private romcsReplacement: boolean;
  private disableIoCycles: boolean;
  private disableMemCycles: boolean;
  private softResetPersistence: number;
  private romcsStatus: boolean;
  private ulaOverrideEnabled: boolean;
  private nmiDebounceDisabled: boolean;
  private clockAlwaysOn: boolean;
  private p3FDCEnabled: boolean;
  private reservedBits: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.hardReset();
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
    this.enabled = (value & 0x80) !== 0;
    this.romcsReplacement = (value & 0x40) !== 0;
    this.disableIoCycles = (value & 0x20) !== 0;
    this.disableMemCycles = (value & 0x10) !== 0;
    this.softResetPersistence = value & 0x0f;
  }

  get nextReg80Value(): number {
    return (
      (this.enabled ? 0x80 : 0) |
      (this.romcsReplacement ? 0x40 : 0) |
      (this.disableIoCycles ? 0x20 : 0) |
      (this.disableMemCycles ? 0x10 : 0) |
      (this.softResetPersistence & 0x0f)
    );
  }

  set nextReg81Value(value: number) {
    this.romcsStatus = (value & 0x80) !== 0;
    this.ulaOverrideEnabled = (value & 0x40) !== 0;
    this.nmiDebounceDisabled = (value & 0x20) !== 0;
    this.clockAlwaysOn = (value & 0x10) !== 0;
    this.p3FDCEnabled = (value & 0x08) !== 0;
    this.reservedBits = value & 0x07;
  }

  get nextReg81Value(): number {
    return (
      (this.romcsStatus ? 0x80 : 0) |
      (this.ulaOverrideEnabled ? 0x40 : 0) |
      (this.nmiDebounceDisabled ? 0x20 : 0) |
      (this.clockAlwaysOn ? 0x10 : 0) |
      (this.p3FDCEnabled ? 0x08 : 0) |
      (this.reservedBits & 0x07)
    );
  }
}
