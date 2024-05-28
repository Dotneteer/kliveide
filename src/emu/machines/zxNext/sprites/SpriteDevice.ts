import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class SpriteDevice implements IGenericDevice<IZxNextMachine> {
  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
  }

  dispose(): void {}
}
