import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class SpriteDevice implements IGenericDevice<IZxNextMachine> {
  spriteIdLockstep: boolean;
  sprite0OnTop: boolean;
  enableSprites: boolean;
  enableSpriteClipping: boolean;
  enableSpritesOverBorder: boolean;

  // --- Sprite clip window coordinates (sprite coordinate space)
  // --- Written via NextReg 0x19 in sequence: X1, X2, Y1, Y2
  clipWindowX1: number;  // Range 0-255, default 0
  clipWindowX2: number;  // Range 0-255, default 255
  clipWindowY1: number;  // Range 0-191, default 0
  clipWindowY2: number;  // Range 0-191, default 191
  clipIndex: number;     // Write sequence index (0-3)

  transparencyIndex: number;

  patternIndex: number;
  patternSubIndex: number;
  spriteIndex: number;
  spriteSubIndex: number;
  spriteMirrorIndex: number;

  tooManySpritesPerLine: boolean;
  collisionDetected: boolean;

  // --- 64 patterns × 8 transformation variants × 256 bytes = 128KB
  // --- Variant index = (patternIdx << 3) | (rotate << 2) | (mirrorX << 1) | mirrorY
  patternMemoryVariants: Uint8Array[];
  spriteMemory: SpriteAttributes[];

  lastVisibileSpriteIndex: number;

  // --- Anchor sprite properties for relative sprite chains
  // --- These store the transformation state of the last anchor sprite
  private anchorX: number = 0;
  private anchorY: number = 0;
  private anchorRotate: boolean = false;
  private anchorMirrorX: boolean = false;
  private anchorMirrorY: boolean = false;

  constructor(public readonly machine: IZxNextMachine) {
    // --- Allocate pattern memory: 64 patterns × 8 variants = 512 arrays of 256 bytes each
    this.patternMemoryVariants = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.patternMemoryVariants[i] = new Uint8Array(256);
    }
    
    // --- Allocate sprite attribute memory
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
        scaleY: 0,
        pattern7Bit: 0,
        is4BitPattern: false,
        transformVariant: 0
      };
    }

    this.patternIndex = 0;
    this.patternSubIndex = 0;
    this.spriteIndex = 0;
    this.spriteMirrorIndex = 0;
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
    this.lastVisibileSpriteIndex = -1;
  }

  /**
   * Gets the anchor sprite's X coordinate.
   * Used for relative sprite positioning (colorMode = 0x01).
   */
  getAnchorX(): number {
    return this.anchorX;
  }

  /**
   * Gets the anchor sprite's Y coordinate.
   * Used for relative sprite positioning (colorMode = 0x01).
   */
  getAnchorY(): number {
    return this.anchorY;
  }

  /**
   * Gets the anchor sprite's rotation flag.
   * Used for relative sprite transformations (colorMode = 0x01).
   */
  isAnchorRotated(): boolean {
    return this.anchorRotate;
  }

  /**
   * Gets the anchor sprite's horizontal mirror flag.
   * Used for relative sprite transformations (colorMode = 0x01).
   */
  isAnchorMirroredX(): boolean {
    return this.anchorMirrorX;
  }

  /**
   * Gets the anchor sprite's vertical mirror flag.
   * Used for relative sprite transformations (colorMode = 0x01).
   */
  isAnchorMirroredY(): boolean {
    return this.anchorMirrorY;
  }

  /**
   * Gets the full 7-bit pattern index for a sprite.
   * Pattern index uses 6 bits from attr3[5:0] and 1 bit from attr4[6] (attributeFlag2).
   * Valid range: 0-127 (7-bit)
   * 
   * @param sprite The sprite attributes to get the pattern index from
   * @returns The full 7-bit pattern index (0-127)
   */
  getFullPatternIndex(sprite: SpriteAttributes): number {
    return sprite.patternIndex | (sprite.attributeFlag2 ? 64 : 0);
  }

  readPort303bValue(): number {
    const result = (this.tooManySpritesPerLine ? 0x02 : 0) | (this.collisionDetected ? 0x01 : 0);
    this.tooManySpritesPerLine = false;
    this.collisionDetected = false;
    return result;
  }

  writePort303bValue(value: number): void {
    this.patternIndex = value & 0x3f;
    this.patternSubIndex = value & 0x80;
    this.spriteIndex = value & 0x7f;
    this.spriteSubIndex = 0;
  }

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

  get nextReg34Value(): number {
    return this.spriteMirrorIndex;
  }

  set nextReg34Value(value: number) {
    if (this.spriteIdLockstep) {
      this.writePort303bValue(value);
    } else {
      this.spriteMirrorIndex = value & 0x7f;
    }
  }

  writeSpriteAttribute(value: number): void {
    this.writeIndexedSpriteAttribute(this.spriteIndex, this.spriteSubIndex, value);
    const attributes = this.spriteMemory[this.spriteIndex];
    if (this.spriteSubIndex === 3 && !attributes.has5AttributeBytes) {
      this.spriteSubIndex++;
      attributes.colorMode = 0x00;
      attributes.attributeFlag2 = false;
      attributes.scaleX = 0;
      attributes.scaleY = 0;
    }

    // --- Increment subindex and sprite index
    this.spriteSubIndex++;
    if (this.spriteSubIndex >= 5) {
      this.spriteSubIndex = 0;
      this.spriteIndex = (this.spriteIndex + 1) & 0x7f;
    }
  }

  writeSpriteAttributeDirect(attrIndex: number, value: number): void {
    const spriteIndex = this.spriteIdLockstep ? this.spriteIndex : this.spriteMirrorIndex;
    this.writeIndexedSpriteAttribute(spriteIndex, attrIndex, value);
  }

  writeSpriteAttributeDirectWithAutoInc(attrIndex: number, value: number): void {
    this.writeSpriteAttributeDirect(attrIndex, value);
    if (this.spriteIdLockstep) {
      this.spriteIndex = (this.spriteIndex + 1) & 0x7f;
      this.spriteSubIndex = 0;
    } else {
      this.spriteMirrorIndex = (this.spriteMirrorIndex + 1) & 0x7f;
    }
  }

  writeSpritePattern(value: number): void {
    const srcIdx = this.patternSubIndex;  // 0-255
    const baseVariantIdx = this.patternIndex << 3;  // patternIndex * 8
    
    // --- Extract X,Y coordinates from linear index
    const srcY = srcIdx >> 4;     // srcIdx / 16 (row 0-15)
    const srcX = srcIdx & 0x0f;   // srcIdx % 16 (col 0-15)
    
    // --- Write to all 8 transformation variants immediately
    // --- Each variant uses different coordinate mapping
    
    // Variant 0 (000): No transform - [y][x] → [y][x]
    this.patternMemoryVariants[baseVariantIdx][srcIdx] = value;
    
    // Variant 1 (001): mirrorY - [y][x] → [15-y][x]
    const dstIdx1 = ((15 - srcY) << 4) | srcX;
    this.patternMemoryVariants[baseVariantIdx + 1][dstIdx1] = value;
    
    // Variant 2 (010): mirrorX - [y][x] → [y][15-x]
    const dstIdx2 = (srcY << 4) | (15 - srcX);
    this.patternMemoryVariants[baseVariantIdx + 2][dstIdx2] = value;
    
    // Variant 3 (011): mirrorX + mirrorY - [y][x] → [15-y][15-x]
    const dstIdx3 = ((15 - srcY) << 4) | (15 - srcX);
    this.patternMemoryVariants[baseVariantIdx + 3][dstIdx3] = value;
    
    // Variant 4 (100): rotate 90° CW - [y][x] → [x][15-y]
    const dstIdx4 = (srcX << 4) | (15 - srcY);
    this.patternMemoryVariants[baseVariantIdx + 4][dstIdx4] = value;
    
    // Variant 5 (101): rotate + mirrorY - [y][x] → [x][y]
    const dstIdx5 = (srcX << 4) | srcY;
    this.patternMemoryVariants[baseVariantIdx + 5][dstIdx5] = value;
    
    // Variant 6 (110): rotate + mirrorX - [y][x] → [15-x][15-y]
    const dstIdx6 = ((15 - srcX) << 4) | (15 - srcY);
    this.patternMemoryVariants[baseVariantIdx + 6][dstIdx6] = value;
    
    // Variant 7 (111): rotate + mirrorX + mirrorY - [y][x] → [15-x][y]
    const dstIdx7 = ((15 - srcX) << 4) | srcY;
    this.patternMemoryVariants[baseVariantIdx + 7][dstIdx7] = value;
    
    // --- Increment the pattern index
    this.patternSubIndex = (this.patternSubIndex + 1) & 0xff;
    if (!this.patternSubIndex) {
      this.patternIndex = (this.patternIndex + 1) & 0x3f;
    }
  }

  writeIndexedSpriteAttribute(spriteIdx: number, attridx: number, value: number): void {
    // --- Bounds check sprite index
    if (spriteIdx < 0 || spriteIdx >= this.spriteMemory.length) {
      return;
    }

    // --- Update the spite attributes
    const attributes = this.spriteMemory[spriteIdx];
    switch (attridx) {
      case 0:
        // --- X position (lower 8 bits)
        attributes.x = ((attributes.x & 0x100) | (value & 0xff)) & 0x1ff;
        break;
      case 1:
        // --- Y position (lower 8 bits)
        attributes.y = ((attributes.y & 0x100) | (value & 0xff)) & 0x1ff;
        break;
      case 2:
        attributes.paletteOffset = (value & 0xf0) >> 4;
        attributes.mirrorX = (value & 0x08) !== 0;
        attributes.mirrorY = (value & 0x04) !== 0;
        attributes.rotate = (value & 0x02) !== 0;
        attributes.attributeFlag1 = (value & 0x01) !== 0;
        // --- Cache transformation variant (0-7) for fast renderer lookup
        attributes.transformVariant = 
          (attributes.rotate ? 4 : 0) | 
          (attributes.mirrorX ? 2 : 0) | 
          (attributes.mirrorY ? 1 : 0);
        // --- Track anchor sprite if this is an anchor sprite (non-relative with 5 attribute bytes)
        if (attributes.has5AttributeBytes && attributes.colorMode !== 0x01) {
          this.anchorX = attributes.x;
          this.anchorY = attributes.y;
          this.anchorRotate = attributes.rotate;
          this.anchorMirrorX = attributes.mirrorX;
          this.anchorMirrorY = attributes.mirrorY;
        }
        break;
      case 3:
        attributes.enableVisibility = (value & 0x80) !== 0;
        attributes.has5AttributeBytes = (value & 0x40) !== 0;
        attributes.patternIndex = value & 0x3f;
        // --- Update computed 7-bit pattern index
        attributes.pattern7Bit = attributes.patternIndex | (attributes.attributeFlag2 ? 64 : 0);
        break;
      default:
        // --- attr4 (5th attribute byte)
        attributes.colorMode = (value & 0xc0) >> 6;
        attributes.attributeFlag2 = (value & 0x20) !== 0;
        attributes.is4BitPattern = (value & 0x80) !== 0;
        attributes.scaleX = (value & 0x18) >> 3;
        attributes.scaleY = (value & 0x06) >> 1;
        // --- Update computed 7-bit pattern index (bit 6 of attr4 extends patternIndex)
        attributes.pattern7Bit = attributes.patternIndex | (attributes.attributeFlag2 ? 64 : 0);
        if (attributes.colorMode !== 0x01) {
          // --- Anchor sprite: set X MSB (bit 0 of attr4)
          attributes.x = (((value & 0x01) << 8) | (attributes.x & 0xff)) & 0x1ff;
        }
        break;
    }

    // --- Select the last visible sprite
    if (attridx === 3 && attributes.enableVisibility) {
      if (spriteIdx > this.lastVisibileSpriteIndex) {
        // --- This is the last visible sprite
        this.lastVisibileSpriteIndex = spriteIdx;
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
  // --- Computed fields for renderer optimization
  pattern7Bit: number;      // Full 7-bit pattern index: patternIndex | (attributeFlag2 ? 64 : 0)
  is4BitPattern: boolean;   // 4-bit color mode flag
  transformVariant: number; // Cached transformation variant (0-7): (rotate << 2) | (mirrorX << 1) | mirrorY
};

export type SpriteInfo = {
  attributes: SpriteAttributes;
};
