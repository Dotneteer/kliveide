import type { IGenericDevice } from "../../abstractions/IGenericDevice";
import type { IZxNextMachine } from "../../abstractions/IZxNextMachine";

export class DmaDevice implements IGenericDevice<IZxNextMachine> {
  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {}

  dispose(): void {}
}
