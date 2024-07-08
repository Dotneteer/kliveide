import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class SpriteDevice implements IGenericDevice<IZxNextMachine> {
  spriteIdLockstep: boolean;
  sprite0OnTop: boolean;
  enableSprites: boolean;
  enableSpriteClipping: boolean;
  enableSpritesOverBorder: boolean;

  clipWindowX1: number;
  clipWindowX2: number;
  clipWindowY1: number;
  clipWindowY2: number;
  clipIndex: number;

  transparencyIndex: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.spriteIdLockstep = false;
    this.sprite0OnTop = false;
    this.enableSpriteClipping = false;
    this.enableSprites = false;
    this.enableSpritesOverBorder = false;
    this.clipIndex = 0;
    this.clipWindowX1 = 0;
    this.clipWindowX2 = 255;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 191;
    this.transparencyIndex = 0xe3;
  }

  dispose(): void {}

  /**
   * Gets the clip window coordinate according to the current clip index
   */
  get nextReg19Value(): number {
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
  set nextReg19Value(value: number) {
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
