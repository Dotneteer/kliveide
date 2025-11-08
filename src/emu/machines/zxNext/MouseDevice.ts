import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

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
