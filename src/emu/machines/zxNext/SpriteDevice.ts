import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class SpriteDevice implements IGenericDevice<IZxNextMachine> {
  spriteIdLockstep: boolean;
  sprite0OnTop: boolean;
  spritesEnabled: boolean;
  spriteClippingEnabled: boolean;
  spritesOverBorderEnabled: boolean;

  // --- Sprite clip window coordinates (sprite coordinate space)
  // --- Written via NextReg 0x19 in sequence: X1, X2, Y1, Y2
  clipWindowX1: number; // Range 0-255, default 0
  clipWindowX2: number; // Range 0-255, default 255
  clipWindowY1: number; // Range 0-191, default 0
  clipWindowY2: number; // Range 0-191, default 191
  clipIndex: number; // Write sequence index (0-3)

  transparencyIndex: number;

  patternIndex: number;
  patternSubIndex: number;
  spriteIndex: number;
  spriteSubIndex: number;
  spriteMirrorIndex: number;

  tooManySpritesPerLine: boolean;
  collisionDetected: boolean;

  // --- Pattern memory: separate storage for 8-bit and 4-bit sprites
  // --- 8-bit: 64 patterns × 8 variants × 256 bytes = 128KB
  // --- 4-bit: 128 patterns × 8 variants × 256 bytes = 256KB (lower nibble only)
  // --- Variant index = (patternIdx << 3) | (rotate << 2) | (mirrorX << 1) | mirrorY
  patternMemory8bit: Uint8Array[];   // 512 entries (64 × 8)
  patternMemory4bit: Uint8Array[];   // 1024 entries (128 × 8)
  attributes: SpriteAttributes[];

  lastVisibileSpriteIndex: number;

  // --- Anchor sprite properties for relative sprite chains
  // --- These store the transformation state of the last anchor sprite
  private anchorX: number = 0;
  private anchorY: number = 0;
  private anchorRotate: boolean = false;
  private anchorMirrorX: boolean = false;
  private anchorMirrorY: boolean = false;

  constructor(public readonly machine: IZxNextMachine) {
    // --- Allocate 8-bit pattern memory: 64 patterns × 8 variants = 512 arrays of 256 bytes each
    this.patternMemory8bit = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.patternMemory8bit[i] = new Uint8Array(256);
    }

    // --- Allocate 4-bit pattern memory: 128 patterns × 8 variants = 1024 arrays of 256 bytes each
    // --- (only lower nibble used per byte, upper nibble ignored)
    this.patternMemory4bit = new Array(1024);
    for (let i = 0; i < 1024; i++) {
      this.patternMemory4bit[i] = new Uint8Array(256);
    }

    // --- Allocate sprite attribute memory
    this.attributes = new Array(128);
    for (let i = 0; i < 128; i++) {
      this.attributes[i] = {
        x: 0,
        y: 0,
        paletteOffset: 0,
        mirrorX: false,
        mirrorY: false,
        rotate: false,
        attributeFlag1: false,
        visible: false,
        has5AttributeBytes: false,
        patternIndex: 0,
        colorMode: 0,
        attributeFlag2: false,
        scaleX: 0,
        scaleY: 0,
        pattern7Bit: 0,
        is4BitPattern: false,
        transformVariant: 0,
        width: 16,
        height: 16
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
    this.spriteClippingEnabled = false;
    this.spritesEnabled = false;
    this.spritesOverBorderEnabled = false;
    this.clipIndex = 0;
    this.clipWindowX1 = 0;
    this.clipWindowX2 = 255;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 191;
    this.transparencyIndex = 0xe3;
    this.lastVisibileSpriteIndex = -1;
    
    // --- Reset all sprite attributes to default values
    for (let i = 0; i < 128; i++) {
      this.attributes[i].x = 0;
      this.attributes[i].y = 0;
      this.attributes[i].paletteOffset = 0;
      this.attributes[i].mirrorX = false;
      this.attributes[i].mirrorY = false;
      this.attributes[i].rotate = false;
      this.attributes[i].attributeFlag1 = false;
      this.attributes[i].visible = false;
      this.attributes[i].has5AttributeBytes = false;
      this.attributes[i].patternIndex = 0;
      this.attributes[i].colorMode = 0;
      this.attributes[i].attributeFlag2 = false;
      this.attributes[i].scaleX = 0;
      this.attributes[i].scaleY = 0;
      this.attributes[i].pattern7Bit = 0;
      this.attributes[i].is4BitPattern = false;
      this.attributes[i].transformVariant = 0;
      this.attributes[i].width = 16;
      this.attributes[i].height = 16;
    }
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

  writeSpriteAttribute(port: number, value: number): void {
    // --- Check if upper byte specifies a direct attribute index
    // --- Upper nibble must be 0x3, and lower nibble 0x1-0x5 maps to attribute 0-4
    const upperByte = (port >> 8) & 0xFF;
    const upperNibble = (upperByte >> 4) & 0x0F;
    const lowerNibble = upperByte & 0x0F;
    
    // --- Determine if this is a direct write (port indicates specific attr that doesn't match current subIndex)
    const portAttrIndex = lowerNibble - 1;
    const isDirect = upperNibble === 0x3 && 
                     lowerNibble >= 0x01 && 
                     lowerNibble <= 0x05 && 
                     portAttrIndex !== this.spriteSubIndex;
    
    if (isDirect) {
      // --- Direct attribute write
      // --- If spriteSubIndex is 0 but we're writing to a non-zero attribute,
      // --- check if we just completed a sprite (by seeing if we can write attr0 to current sprite)
      // --- If so, target the previous sprite. Otherwise, target current sprite.
      let targetSpriteIndex = this.spriteIndex;
      
      // --- If subIndex is 0 and we're accessing a later attribute (2, 3, 4),
      // --- we might be modifying the just-completed sprite
      if (this.spriteSubIndex === 0 && portAttrIndex >= 2) {
        // --- Check if the current sprite has already been configured (has non-default values)
        // --- If X or Y is still 0 and other attrs are default, we're on a fresh sprite
        const currentAttrs = this.attributes[this.spriteIndex];
        const prevAttrs = this.attributes[(this.spriteIndex - 1) & 0x7f];
        
        // --- If previous sprite has been configured recently (non-zero X or has scaling),
        // --- assume we want to modify it
        if (prevAttrs.scaleX !== 0 || prevAttrs.scaleY !== 0 || prevAttrs.x !== 0) {
          targetSpriteIndex = (this.spriteIndex - 1) & 0x7f;
        }
      }
      
      this.writeIndexedSpriteAttribute(targetSpriteIndex, portAttrIndex, value);
    } else {
      // --- Sequential write using spriteSubIndex
      this.writeIndexedSpriteAttribute(this.spriteIndex, this.spriteSubIndex, value);
      const attributes = this.attributes[this.spriteIndex];
      if (this.spriteSubIndex === 3 && !attributes.has5AttributeBytes) {
        this.spriteSubIndex++;
        attributes.colorMode = 0x00;
        attributes.attributeFlag2 = false;
        attributes.scaleX = 0;
        attributes.scaleY = 0;
        // --- Update dimensions for 4-byte sprites (no scaling)
        this.updateSpriteDimensions(attributes);
      }

      // --- Increment subindex and sprite index
      this.spriteSubIndex++;
      if (this.spriteSubIndex >= 5) {
        this.spriteSubIndex = 0;
        this.spriteIndex = (this.spriteIndex + 1) & 0x7f;
      }
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
    const srcIdx = this.patternSubIndex; // 0-255
    const baseVariantIdx8bit = this.patternIndex << 3; // For 8-bit: patternIndex (0-63) * 8

    // --- Extract X,Y coordinates from linear index
    const srcY = srcIdx >> 4; // srcIdx / 16 (row 0-15)
    const srcX = srcIdx & 0x0f; // srcIdx % 16 (col 0-15)

    // --- Calculate destination indices for all 8 transformation variants
    const dstIdx0 = srcIdx;                               // Variant 0 (000): No transform
    const dstIdx1 = ((15 - srcY) << 4) | srcX;            // Variant 1 (001): mirrorY
    const dstIdx2 = (srcY << 4) | (15 - srcX);            // Variant 2 (010): mirrorX
    const dstIdx3 = ((15 - srcY) << 4) | (15 - srcX);     // Variant 3 (011): mirrorX + mirrorY
    const dstIdx4 = (srcX << 4) | (15 - srcY);            // Variant 4 (100): rotate 90° CW
    const dstIdx5 = (srcX << 4) | srcY;                   // Variant 5 (101): rotate + mirrorY
    const dstIdx6 = ((15 - srcX) << 4) | (15 - srcY);     // Variant 6 (110): rotate + mirrorX
    const dstIdx7 = ((15 - srcX) << 4) | srcY;            // Variant 7 (111): rotate + mirrorX + mirrorY

    // --- Write to 8-bit pattern memory (64 patterns: 0-63)
    // --- Use full byte value
    this.patternMemory8bit[baseVariantIdx8bit][dstIdx0] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 1][dstIdx1] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 2][dstIdx2] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 3][dstIdx3] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 4][dstIdx4] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 5][dstIdx5] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 6][dstIdx6] = value;
    this.patternMemory8bit[baseVariantIdx8bit + 7][dstIdx7] = value;

    // --- Write to 4-bit pattern memory (128 patterns: 0-127)
    // --- Pattern index for 4-bit = (patternIndex << 1) | patternSubIndex[7]
    // --- This maps: patternIndex 0-63, subIndex 0-127 → pattern 0-63
    // ---            patternIndex 0-63, subIndex 128-255 → pattern 64-127
    const pattern4bitIndex = (this.patternIndex << 1) | ((this.patternSubIndex >> 7) & 1);
    const baseVariantIdx4bit = pattern4bitIndex << 3;
    const value4bit = value & 0x0f;  // Use only lower nibble

    this.patternMemory4bit[baseVariantIdx4bit][dstIdx0] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 1][dstIdx1] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 2][dstIdx2] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 3][dstIdx3] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 4][dstIdx4] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 5][dstIdx5] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 6][dstIdx6] = value4bit;
    this.patternMemory4bit[baseVariantIdx4bit + 7][dstIdx7] = value4bit;

    // --- Increment the pattern index
    this.patternSubIndex = (this.patternSubIndex + 1) & 0xff;
    if (!this.patternSubIndex) {
      this.patternIndex = (this.patternIndex + 1) & 0x3f;
    }
  }

  writeIndexedSpriteAttribute(spriteIdx: number, attridx: number, value: number): void {
    // --- Bounds check sprite index
    if (spriteIdx < 0 || spriteIdx >= this.attributes.length) {
      return;
    }

    // --- Update the spite attributes
    const attributes = this.attributes[spriteIdx];
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
          (attributes.rotate ? 4 : 0) | (attributes.mirrorX ? 2 : 0) | (attributes.mirrorY ? 1 : 0);
        // --- Recalculate width and height
        this.updateSpriteDimensions(attributes);
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
        attributes.visible = (value & 0x80) !== 0;
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
        // --- Recalculate width and height
        this.updateSpriteDimensions(attributes);
        if (attributes.colorMode !== 0x01) {
          // --- Anchor sprite: set X MSB (bit 0 of attr4)
          attributes.x = (((value & 0x01) << 8) | (attributes.x & 0xff)) & 0x1ff;
        }
        break;
    }

    // --- Select the last visible sprite
    if (attridx === 3 && attributes.visible) {
      if (spriteIdx > this.lastVisibileSpriteIndex) {
        // --- This is the last visible sprite
        this.lastVisibileSpriteIndex = spriteIdx;
      } else {
        // --- Search for the last visible sprites
        this.lastVisibileSpriteIndex = -1;
        for (let i = 127; i > 0; i--) {
          if (this.attributes[i].visible) {
            this.lastVisibileSpriteIndex = i;
            break;
          }
        }
      }
    }
  }

  /**
   * Recalculates sprite width and height based on scaling and rotation flags.
   * Base sprite size is 16x16 pixels.
   * 
   * Scaling multipliers:
   * - scale = 0: 1x (16 pixels)
   * - scale = 1: 2x (32 pixels)
   * - scale = 2: 4x (64 pixels)
   * - scale = 3: 8x (128 pixels)
   * 
   * Rotation swaps width and height dimensions.
   * Mirroring does not affect dimensions (only visual appearance).
   */
  private updateSpriteDimensions(attributes: SpriteAttributes): void {
    const baseSize = 16;
    
    // --- Calculate scaled dimensions
    const scaledWidth = baseSize << attributes.scaleX; // 16 * (2^scaleX)
    const scaledHeight = baseSize << attributes.scaleY; // 16 * (2^scaleY)
    
    // --- Apply rotation (swaps width/height)
    if (attributes.rotate) {
      attributes.width = scaledHeight;
      attributes.height = scaledWidth;
    } else {
      attributes.width = scaledWidth;
      attributes.height = scaledHeight;
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
  visible: boolean;
  has5AttributeBytes: boolean;
  patternIndex: number;
  colorMode: number;
  attributeFlag2: boolean;
  scaleX: number;
  scaleY: number;
  // --- Computed fields for renderer optimization
  pattern7Bit: number; // Full 7-bit pattern index: patternIndex | (attributeFlag2 ? 64 : 0)
  is4BitPattern: boolean; // 4-bit color mode flag
  transformVariant: number; // Cached transformation variant (0-7): (rotate << 2) | (mirrorX << 1) | mirrorY
  width: number; // Effective sprite width in pixels after scaling and rotation
  height: number; // Effective sprite height in pixels after scaling and rotation
};

export type SpriteInfo = {
  attributes: SpriteAttributes;
};
