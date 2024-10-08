import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class UlaDevice implements IGenericDevice<IZxNextMachine> {
  clipWindowX1: number;
  clipWindowX2: number;
  clipWindowY1: number;
  clipWindowY2: number;
  clipIndex: number;
  scrollX: number;
  scrollY: number;
  disableUlaOutput: boolean;
  blendingInSluMode: number;
  enableUlaPlus: boolean;
  halfPixelScroll: boolean;
  enableStencilMode: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.clipIndex = 0;
    this.clipWindowX1 = 0;
    this.clipWindowX2 = 255;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 191;
    this.scrollX = 0;
    this.scrollY = 0;
  }

  dispose(): void {}

  /**
   * Gets the clip window coordinate according to the current clip index
   */
  get nextReg1aValue(): number {
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
  set nextReg1aValue(value: number) {
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

  get nextReg68Value(): number {
    return (this.disableUlaOutput ? 0x80 : 0) |
      ((this.blendingInSluMode & 0x03) << 5) |
      (this.enableUlaPlus ? 0x08 : 0) |
      (this.halfPixelScroll ? 0x04 : 0) |
      (this.enableStencilMode ? 0x01 : 0);
  }

  set nextReg68Value(value: number) {
    this.disableUlaOutput = (value & 0x80) !== 0;
    this.blendingInSluMode = (value & 0x60) >> 5;
    this.enableUlaPlus = (value & 0x08) !== 0;
    this.halfPixelScroll = (value & 0x04) !== 0;
    this.enableStencilMode = (value & 0x01) !== 0;
  }
}
