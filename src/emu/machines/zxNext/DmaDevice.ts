import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class DmaDevice implements IGenericDevice<IZxNextMachine> {
  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {}

  dispose(): void {}
}
