import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class TilemapDevice implements IGenericDevice<IZxNextMachine> {
  clipWindowX1: number;
  clipWindowX2: number;
  clipWindowY1: number;
  clipWindowY2: number;
  clipIndex: number;
  scrollX: number;
  scrollY: number;
  transparencyIndex: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.clipIndex = 0;
    this.clipWindowX1 = 0;
    this.clipWindowX2 = 159;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 255;
    this.scrollX = 0;
    this.scrollY = 0;
    this.transparencyIndex = 0x0f;
  }

  dispose(): void {}

  /**
   * Gets the clip window coordinate according to the current clip index
   */
  get nextReg1bValue(): number {
    switch (this.clipIndex) {
      case 0:
        return this.clipWindowX1;
      case 1:
        return this.clipWindowX2;
      case 2:
        return this.clipWindowY1;
      default:
        return this.clipWindowY2;
    }
  }

  /**
   * Sets the clip window cordinate according to the current clip index
   */
  set nextReg1bValue(value: number) {
    switch (this.clipIndex) {
      case 0:
        this.clipWindowX1 = value;
        break;
      case 1:
        this.clipWindowX2 = value;
        break;
      case 2:
        this.clipWindowY1 = value;
        break;
      default:
        this.clipWindowY2 = value;
        break;
    }
    this.clipIndex = (this.clipIndex + 1) & 0x03;
  }
}
