import type { IGenericDevice } from "../../abstractions/IGenericDevice";
import type { IZxNextMachine } from "../../abstractions/IZxNextMachine";

export class MouseDevice implements IGenericDevice<IZxNextMachine> {
  swapButtons: boolean;
  dpi: number;
  
  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
  }

  dispose(): void {}
}
