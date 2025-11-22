import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

export class DmaDevice implements IGenericDevice<IZxNextMachine> {
  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {}
}
