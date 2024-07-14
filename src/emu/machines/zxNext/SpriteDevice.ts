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

  patternIndex: number;
  patternSubIndex: number;
  spriteIndex: number;
  spriteSubIndex: number;

  tooManySpritesPerLine: boolean;
  collisionDetected: boolean;

  patternMemory8Bit: Uint8Array;
  pattermMemory4Bit: Uint8Array;
  spriteMemory: SpriteAttributes[];

  lastVisibileSpriteIndex: number;

  constructor(public readonly machine: IZxNextMachine) {
    // --- Allocate pattern memory
    this.patternMemory8Bit = new Uint8Array(0x4000);
    this.pattermMemory4Bit = new Uint8Array(0x8000);
    this.spriteMemory = new Array(128);
    for (let i = 0; i < 128; i++) {
      this.spriteMemory[i] = {
        x: 0,
        y: 0,
        paletteOffset: 0,
        mirrorX: false,
        mirrorY: false,
        rotate: false,
        attributeFlag1: false,
        enableVisibility: false,
        has5AttributeBytes: false,
        patternIndex: 0,
        colorMode: 0,
        attributeFlag2: false,
        scaleX: 0,
        scaleY: 0
      };
    }

    this.patternIndex = 0;
    this.patternSubIndex = 0;
    this.spriteIndex = 0;
    this.spriteSubIndex = 0;
    this.lastVisibileSpriteIndex = -1;
    this.tooManySpritesPerLine = false;
    this.collisionDetected = false;
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

  writeSpriteAttribute(value: number): void {
    // --- Update the spite attributes
    const attributes = this.spriteMemory[this.spriteIndex];
    switch (this.spriteSubIndex) {
      case 0:
        attributes.x = (attributes.x & 0x100) | (value & 0xff);
        break;
      case 1:
        attributes.y = (attributes.y & 0x100) | (value & 0xff);
        break;
      case 2:
        attributes.paletteOffset = (value & 0xf0) >> 4;
        attributes.mirrorX = (value & 0x08) !== 0;
        attributes.mirrorY = (value & 0x04) !== 0;
        attributes.rotate = (value & 0x02) !== 0;
        attributes.attributeFlag1 = (value & 0x01) !== 0;
        break;
      case 3:
        attributes.enableVisibility = (value & 0x80) !== 0;
        attributes.has5AttributeBytes = (value & 0x40) !== 0;
        attributes.patternIndex = value & 0x3f;
        if (!attributes.has5AttributeBytes) {
          this.spriteSubIndex++;
          attributes.colorMode = 0x00;
          attributes.attributeFlag2 = false;
          attributes.scaleX = 0;
          attributes.scaleY = 0;
        }
        break;
      default:
        attributes.colorMode = (value & 0xc0) >> 6;
        attributes.attributeFlag2 = (value & 0x20) !== 0;
        attributes.scaleX = (value & 0x18) >> 3;
        attributes.scaleY = (value & 0x06) >> 1;
        if (attributes.colorMode !== 0x01) {
          // --- Anchor sprite
          attributes.x = ((value & 0x01) << 8) | (attributes.x & 0xff);
        }
        break;
    }

    // --- Select the last visible sprite
    if (this.spriteSubIndex === 3 && attributes.enableVisibility) {
      if (this.spriteIndex > this.lastVisibileSpriteIndex) {
        // --- This is the last visible sprite
        this.lastVisibileSpriteIndex = this.spriteIndex;
      } else {
        // --- Search for the last visible sprites
        this.lastVisibileSpriteIndex = -1;
        for (let i = 127; i > 0; i++) {
          if (this.spriteMemory[i].enableVisibility) {
            this.lastVisibileSpriteIndex = i;
            break;
          }
        }
      }
    }

    // --- Increment subindex and sprite index
    this.spriteSubIndex++;
    if (this.spriteSubIndex >= 5) {
      this.spriteSubIndex = 0;
      this.spriteIndex = (this.spriteSubIndex + 1) & 0x1f;
    }
  }

  writeSpritePattern(value: number): void {
    // --- Write the pattern byte
    const memIndex = (this.patternIndex << 8) + this.patternSubIndex;
    this.patternMemory8Bit[memIndex] = value;
    this.pattermMemory4Bit[memIndex * 2] = (value & 0xf0) >> 4;
    this.pattermMemory4Bit[memIndex * 2 + 1] = value & 0x0f;

    // --- Increment the pattern index
    this.patternSubIndex = (this.patternSubIndex + 1) & 0xff;
    if (!this.patternSubIndex) {
      this.patternIndex = (this.patternIndex + 1) & 0x3f;
    }
  }
}

export type SpriteAttributes = {
  x: number;
  y: number;
  paletteOffset: number;
  mirrorX: boolean;
  mirrorY: boolean;
  rotate: boolean;
  attributeFlag1: boolean;
  enableVisibility: boolean;
  has5AttributeBytes: boolean;
  patternIndex: number;
  colorMode: number;
  attributeFlag2: boolean;
  scaleX: number;
  scaleY: number;
};

export type SpriteInfo = {
  attributes: SpriteAttributes;
};
