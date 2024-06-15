import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

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
