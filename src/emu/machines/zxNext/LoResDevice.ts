import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

export class LoResDevice implements IGenericDevice<IZxNextMachine> {
  scrollX: number;
  scrollY: number;
  isRadastanMode: boolean;
  radastanTimexXor: boolean;
  paletteOffset: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.scrollX = 0;
    this.scrollY = 0;
    this.isRadastanMode = false;
    this.radastanTimexXor = false;
    this.paletteOffset = 0;
  }

  dispose(): void {}

  get nextReg6aValue(): number {
    return (
      (this.isRadastanMode ? 0x20 : 0) |
      (this.radastanTimexXor ? 0x10 : 0) |
      (this.paletteOffset & 0x0f)
    );
  }

  set nextReg6aValue(value: number) {
    this.isRadastanMode = (value & 0x20) !== 0;
    this.radastanTimexXor = (value & 0x10) !== 0;
    this.paletteOffset = value & 0x0f;
  }
}
