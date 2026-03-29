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

  // --- Anchor sprite state for relative sprite chains (updated at render time)
  anchorRelType: boolean = false;
  anchorH: boolean = false;
  anchorVis: boolean = false;
  anchorX: number = 0;        // 9-bit X
  anchorY: number = 0;        // 9-bit Y
  anchorPattern: number = 0;  // 7-bit pattern index (patternIndex[5:0] & N6)
  anchorPaloff: number = 0;   // 4-bit palette offset
  anchorRotate: boolean = false;
  anchorXmirror: boolean = false;
  anchorYmirror: boolean = false;
  anchorXscale: number = 0;   // 2-bit X scale
  anchorYscale: number = 0;   // 2-bit Y scale

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
        patternVariantIndex: 0,
        width: 16,
        height: 16,
        rawAttr0: 0,
        rawAttr1: 0,
        rawAttr2: 0,
        rawAttr3: 0,
        rawAttr4: 0
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
      this.attributes[i].patternVariantIndex = 0;
      this.attributes[i].width = 16;
      this.attributes[i].height = 16;
      this.attributes[i].rawAttr0 = 0;
      this.attributes[i].rawAttr1 = 0;
      this.attributes[i].rawAttr2 = 0;
      this.attributes[i].rawAttr3 = 0;
      this.attributes[i].rawAttr4 = 0;
    }
  }

  /**
   * Resets the anchor state at the start of each scanline.
   * Called by the renderer at the start of sprite rendering for a new scanline.
   * (FPGA: anchor_vis <= '0' in S_START)
   */
  resetAnchorState(): void {
    this.anchorVis = false;
  }

  /**
   * Updates the anchor state from a non-relative sprite during the QUALIFY phase.
   * Called by the renderer for each non-relative sprite encountered.
   * (FPGA: state_s = S_QUALIFY and spr_relative = '0')
   */
  updateAnchorState(spriteIdx: number): void {
    const a = this.attributes[spriteIdx];
    const attr3 = a.rawAttr3;
    const attr4 = a.rawAttr4;
    const has5bytes = (attr3 & 0x40) !== 0;
    
    this.anchorRelType = has5bytes && ((attr4 & 0x20) !== 0);
    this.anchorH = has5bytes && ((attr4 & 0x80) !== 0);
    this.anchorVis = (attr3 & 0x80) !== 0;
    this.anchorX = a.x;
    this.anchorY = a.y;
    this.anchorPaloff = (a.rawAttr2 >> 4) & 0x0f;
    
    // Compute pattern: (patternIndex[5:0] & N6) where N6 = attr4[6] AND h
    const n6 = this.anchorH ? ((attr4 >> 6) & 1) : 0;
    this.anchorPattern = ((attr3 & 0x3f) << 1) | n6;
    
    // Only store transforms when has5bytes AND attr4[5]=1 (rel_type)
    // (FPGA: sprite_attr_3(6) = '1' and sprite_attr_4(5) = '1')
    if (has5bytes && ((attr4 & 0x20) !== 0)) {
      this.anchorRotate = (a.rawAttr2 & 0x02) !== 0;
      this.anchorXmirror = (a.rawAttr2 & 0x08) !== 0;
      this.anchorYmirror = (a.rawAttr2 & 0x04) !== 0;
      this.anchorXscale = (attr4 >> 3) & 0x03;
      this.anchorYscale = (attr4 >> 1) & 0x03;
    } else {
      this.anchorRotate = false;
      this.anchorXmirror = false;
      this.anchorYmirror = false;
      this.anchorXscale = 0;
      this.anchorYscale = 0;
    }
  }

  /**
   * Checks if a sprite is a relative sprite (attr3[6]=1 AND attr4[7:6]="01")
   */
  isRelativeSprite(spriteIdx: number): boolean {
    const a = this.attributes[spriteIdx];
    return (a.rawAttr3 & 0x40) !== 0 && ((a.rawAttr4 & 0xc0) === 0x40);
  }

  /**
   * Resolves a relative sprite's effective attributes at render time.
   * Returns an object with resolved X, Y, visible, paletteOffset, transformVariant,
   * patternVariantIndex, is4BitPattern, scaleX, scaleY, has5AttributeBytes.
   * 
   * Implements the FPGA combinatorial logic from sprites.vhd lines 762-798.
   */
  resolveRelativeSprite(spriteIdx: number): ResolvedSpriteAttrs {
    const a = this.attributes[spriteIdx];
    const attr0 = a.rawAttr0; // X offset (signed 8-bit)
    const attr1 = a.rawAttr1; // Y offset (signed 8-bit)
    const attr2 = a.rawAttr2;
    const attr3 = a.rawAttr3;
    const attr4 = a.rawAttr4;
    
    // Step 1: Swap X/Y offsets if anchor is rotated
    const relX0 = this.anchorRotate ? attr1 : attr0;
    const relY0 = this.anchorRotate ? attr0 : attr1;
    
    // Step 2: Negate offsets based on anchor mirror/rotate
    // FPGA: spr_rel_x1 <= spr_rel_x0 when (anchor_rotate xor anchor_xmirror) = '0' else (not(spr_rel_x0) + 1)
    const negateX = this.anchorRotate !== this.anchorXmirror;
    const negateY = this.anchorYmirror;
    const relX1 = negateX ? ((~relX0 + 1) & 0xff) : relX0;
    const relY1 = negateY ? ((~relY0 + 1) & 0xff) : relY0;
    
    // Step 3: Scale offsets by anchor scale
    // Sign-extend 8-bit to 9-bit, then shift left by scale
    const signExtX = (relX1 & 0x80) ? (relX1 | 0x100) : relX1; // 9-bit signed
    const signExtY = (relY1 & 0x80) ? (relY1 | 0x100) : relY1;
    const relX2 = (signExtX << this.anchorXscale) & 0x1ff;
    const relY2 = (signExtY << this.anchorYscale) & 0x1ff;
    
    // Step 4: Add anchor position
    const relX3 = (this.anchorX + relX2) & 0x1ff;
    const relY3 = (this.anchorY + relY2) & 0x1ff;
    
    // Palette offset: replace or add depending on attr2[0]
    const relPaloff = (attr2 & 0x01) === 0
      ? (attr2 >> 4) & 0x0f
      : ((this.anchorPaloff + ((attr2 >> 4) & 0x0f)) & 0x0f);
    
    // Effective mirror/rotate depends on anchor_rel_type
    let effRotate: boolean;
    let effMirrorX: boolean;
    let effMirrorY: boolean;
    let effXscale: number;
    let effYscale: number;
    
    if (!this.anchorRelType) {
      // rel_type=0: relative sprite uses its own transforms from attr2/attr4
      effRotate = (attr2 & 0x02) !== 0;
      effMirrorX = (attr2 & 0x08) !== 0;
      effMirrorY = (attr2 & 0x04) !== 0;
      effXscale = (attr4 >> 3) & 0x03;
      effYscale = (attr4 >> 1) & 0x03;
    } else {
      // rel_type=1: XOR sprite's transforms with anchor's
      // FPGA: spr_rel_xm <= sprite_attr_2(3) when anchor_rotate='0' else sprite_attr_2(2) xor sprite_attr_2(1)
      const relXm = !this.anchorRotate ? ((attr2 & 0x08) !== 0) : (((attr2 & 0x04) !== 0) !== ((attr2 & 0x02) !== 0));
      const relYm = !this.anchorRotate ? ((attr2 & 0x04) !== 0) : (((attr2 & 0x08) !== 0) !== ((attr2 & 0x02) !== 0));
      effRotate = this.anchorRotate !== ((attr2 & 0x02) !== 0);
      effMirrorX = this.anchorXmirror !== relXm;
      effMirrorY = this.anchorYmirror !== relYm;
      effXscale = this.anchorXscale;
      effYscale = this.anchorYscale;
    }
    
    // Visibility: anchor_vis AND sprite_attr_3(7)
    const effVisible = this.anchorVis && ((attr3 & 0x80) !== 0);
    
    // H flag: anchor_h (the anchor's 4-bit mode flag)
    const effH = this.anchorH;
    const effIs4Bit = effH;
    
    // Pattern: (attr3[5:0] & N6) possibly + anchor_pattern
    const n6 = effH ? ((attr4 >> 6) & 1) : 0;
    let effPattern = ((attr3 & 0x3f) << 1) | n6;
    if ((attr4 & 0x01) !== 0) {
      // Add to anchor pattern when attr4[0]=1
      // FPGA: spr_rel_pattern <= ((sprite_attr_3 & spr_cur_n6) + anchor_pattern) when spr_relative='1' and sprite_attr_4(0)='1'
      effPattern = (effPattern + this.anchorPattern) & 0x7f;
    }
    
    // Transform variant
    const effTransformVariant = (effRotate ? 4 : 0) | (effMirrorX ? 2 : 0) | (effMirrorY ? 1 : 0);
    
    // Pattern variant index for memory lookup
    let effPatternVariantIndex: number;
    if (effIs4Bit) {
      effPatternVariantIndex = (effPattern << 3) | effTransformVariant;
    } else {
      // 8-bit: use upper 6 bits of pattern
      effPatternVariantIndex = ((effPattern >> 1) << 3) | effTransformVariant;
    }
    
    return {
      x: relX3,
      y: relY3,
      visible: effVisible,
      paletteOffset: relPaloff,
      rotate: effRotate,
      mirrorX: effMirrorX,
      mirrorY: effMirrorY,
      scaleX: effXscale,
      scaleY: effYscale,
      is4BitPattern: effIs4Bit,
      has5AttributeBytes: true,
      transformVariant: effTransformVariant,
      patternVariantIndex: effPatternVariantIndex
    };
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

  writeSpriteAttribute(_port: number, value: number): void {
    // --- Sequential write using spriteSubIndex
    // --- (FPGA: flat 10-bit attr_index into raw byte RAM, no port address decoding)
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
        attributes.rawAttr0 = value & 0xff;
        break;
      case 1:
        // --- Y position (lower 8 bits)
        attributes.y = ((attributes.y & 0x100) | (value & 0xff)) & 0x1ff;
        attributes.rawAttr1 = value & 0xff;
        break;
      case 2:
        attributes.paletteOffset = (value & 0xf0) >> 4;
        attributes.mirrorX = (value & 0x08) !== 0;
        attributes.mirrorY = (value & 0x04) !== 0;
        attributes.rotate = (value & 0x02) !== 0;
        attributes.attributeFlag1 = (value & 0x01) !== 0;
        // --- X MSB comes from attr2[0] (FPGA: spr_cur_x <= spr_cur_attr_2(0) & spr_cur_attr_0)
        attributes.x = ((value & 0x01) << 8) | (attributes.x & 0xff);
        attributes.rawAttr2 = value & 0xff;
        // --- Cache transformation variant (0-7) for fast renderer lookup
        attributes.transformVariant =
          (attributes.rotate ? 4 : 0) | (attributes.mirrorX ? 2 : 0) | (attributes.mirrorY ? 1 : 0);
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
        // --- Recalculate width and height
        this.updateSpriteDimensions(attributes);
        break;
      case 3:
        attributes.visible = (value & 0x80) !== 0;
        attributes.has5AttributeBytes = (value & 0x40) !== 0;
        attributes.patternIndex = value & 0x3f;
        // --- Update computed 7-bit pattern index
        attributes.pattern7Bit = attributes.patternIndex | (attributes.attributeFlag2 ? 64 : 0);
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
        // --- Y MSB is only valid when has5AttributeBytes; reset to 0 when 4-byte sprite
        // --- (FPGA: spr_y8 <= '0' when sprite_attr_3(6) = '0')
        if (!attributes.has5AttributeBytes) {
          attributes.y = attributes.y & 0xff;
        }
        attributes.rawAttr3 = value & 0xff;
        break;
      default:
        // --- attr4 (5th attribute byte)
        attributes.colorMode = (value & 0xc0) >> 6;
        attributes.attributeFlag2 = (value & 0x20) !== 0;
        attributes.is4BitPattern = (value & 0x80) !== 0;
        attributes.scaleX = (value & 0x18) >> 3;
        attributes.rawAttr4 = value & 0xff;
        attributes.scaleY = (value & 0x06) >> 1;
        // --- Update computed 7-bit pattern index (bit 6 of attr4 extends patternIndex)
        attributes.pattern7Bit = attributes.patternIndex | (attributes.attributeFlag2 ? 64 : 0);
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
        // --- Recalculate width and height
        this.updateSpriteDimensions(attributes);
        // --- Y MSB comes from attr4[0] (FPGA: spr_y8 <= spr_cur_attr_4(0) when sprite_attr_3(6)='1')
        if (attributes.has5AttributeBytes) {
          attributes.y = ((value & 0x01) << 8) | (attributes.y & 0xff);
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
   * Update the cached pattern variant index for direct lookup in pattern memory.
   * Called whenever sprite attributes affecting pattern selection change.
   */
  private updatePatternVariantIndex(attributes: SpriteAttributes): void {
    // Combined variant index = (patternIndex << 3) | transformVariant
    // For 4-bit sprites, pattern index is 7-bit (includes attributeFlag2 as LSB)
    if (attributes.is4BitPattern) {
      const pattern7bit = (attributes.patternIndex << 1) | (attributes.attributeFlag2 ? 1 : 0);
      attributes.patternVariantIndex = (pattern7bit << 3) | attributes.transformVariant;
    } else {
      attributes.patternVariantIndex = (attributes.patternIndex << 3) | attributes.transformVariant;
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
  patternVariantIndex: number; // Cached pattern variant index for direct lookup in patternMemory arrays
  width: number; // Effective sprite width in pixels after scaling and rotation
  height: number; // Effective sprite height in pixels after scaling and rotation
  // --- Raw attribute bytes for render-time relative sprite resolution
  rawAttr0: number; // attr0: X position lower 8 bits
  rawAttr1: number; // attr1: Y position lower 8 bits
  rawAttr2: number; // attr2: palette|mirrorX|mirrorY|rotate|X_MSB
  rawAttr3: number; // attr3: visible|has5bytes|patternIndex[5:0]
  rawAttr4: number; // attr4: colorMode|N6|xscale|yscale|Y_MSB
};

export type SpriteInfo = {
  attributes: SpriteAttributes;
};

/**
 * Resolved sprite attributes for rendering (used after relative sprite resolution)
 */
export type ResolvedSpriteAttrs = {
  x: number;
  y: number;
  visible: boolean;
  paletteOffset: number;
  rotate: boolean;
  mirrorX: boolean;
  mirrorY: boolean;
  scaleX: number;
  scaleY: number;
  is4BitPattern: boolean;
  has5AttributeBytes: boolean;
  transformVariant: number;
  patternVariantIndex: number;
};
