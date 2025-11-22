import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class CpuSpeedDevice implements IGenericDevice<IZxNextMachine> {
  // --- Requested CPU speed
  private programmedSpeed: number;

  // *** Current effective speed (may be limited by constraints)
  private effectiveSpeed: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    // --- CPU speed is preserved
  }

  hardReset(): void {
    this.programmedSpeed = 0x00;
    this.effectiveSpeed = 0x00;
  }

  set nextReg07Value(value: number) {
    this.programmedSpeed = value & 0x03;
  }

  get nextReg07Value(): number {
    return this.programmedSpeed & 0x03 | (this.effectiveSpeed << 4);
  }
}
