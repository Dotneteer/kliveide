import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class SpriteDevice implements IGenericDevice<IZxNextMachine> {
  /** D6: Bidirectional sync flag (MAME mirror_tie / NR $09 bit 4). */
  mirrorTie: boolean;
  /** D6: Mirror's selected sprite number (MAME mirror_sprite_q / formerly spriteMirrorIndex). */
  mirrorSpriteQ: number;
  /** D6: Which attribute byte (0-4) or sprite-number mode (7) the mirror targets. Reset default: 7. */
  mirrorIndex: number;
  /** D6: Auto-increment mirrorSpriteQ after each attribute write. Set by NR $75-$79. */
  mirrorInc: boolean;

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

  tooManySpritesPerLine: boolean;
  collisionDetected: boolean;

  // --- Pattern memory: separate storage for 8-bit and 4-bit sprites
  // --- 8-bit: 64 patterns × 8 variants × 256 bytes = 128KB
  // --- 4-bit: 128 patterns × 8 variants × 256 bytes = 256KB (lower nibble only)
  // --- Variant index = (patternIdx << 3) | (rotate << 2) | (mirrorX << 1) | mirrorY
  patternMemory8bit: Uint8Array[];   // 512 entries (64 × 8)
  patternMemory4bit: Uint8Array[];   // 1024 entries (128 × 8)
  attributes: SpriteAttributes[];
  resolvedAttributes: SpriteAttributes[]; // post-relative-compositing snapshot used by renderer

  lastVisibileSpriteIndex: number;

  // --- Dirty flag: set whenever sprite attributes change; cleared by resolveRelativeSprites()
  private _attrsDirty: boolean;

  // --- Anchor sprite properties for relative sprite chains (legacy cached fields)
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
    const makeBlankAttr = (): SpriteAttributes => ({
      x: 0, y: 0, paletteOffset: 0, mirrorX: false, mirrorY: false, rotate: false,
      attributeFlag1: false, visible: false, has5AttributeBytes: false, patternIndex: 0,
      colorMode: 0, attributeFlag2: false, scaleX: 0, scaleY: 0, pattern7Bit: 0,
      is4BitPattern: false, transformVariant: 0, patternVariantIndex: 0,
      width: 16, height: 16, patternRelative: false
    });
    this.attributes = new Array(128);
    this.resolvedAttributes = new Array(128);
    for (let i = 0; i < 128; i++) {
      this.attributes[i] = makeBlankAttr();
      this.resolvedAttributes[i] = makeBlankAttr();
    }
    this._attrsDirty = true;

    this.patternIndex = 0;
    this.patternSubIndex = 0;
    this.spriteIndex = 0;
    this.mirrorSpriteQ = 0;
    this.mirrorIndex = 7;
    this.mirrorInc = false;
    this.spriteSubIndex = 0;
    this.lastVisibileSpriteIndex = -1;
    this.tooManySpritesPerLine = false;
    this.collisionDetected = false;
    this.reset();
  }

  reset(): void {
    this.mirrorTie = false;
    this.mirrorSpriteQ = 0;
    this.mirrorIndex = 7; // default: sprite-number mode (MAME reset: mirror_index_w(0b111))
    this.mirrorInc = false;
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
      this.attributes[i].patternRelative = false;
      this.resolvedAttributes[i].visible = false;
    }
    this._attrsDirty = true;
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
    // MAME mirror_num_r(): lower 7 bits of mirror_sprite_q
    return this.mirrorSpriteQ & 0x7f;
  }

  set nextReg34Value(value: number) {
    // NR $34 write → mirror_data_w with current mirrorIndex
    this.mirrorDataW(value & 0xff);
  }

  /**
   * D6: Full MAME mirror_data_w protocol.
   *
   * - mirrorIndex 0-4: write data to sprite attribute [mirrorSpriteQ][mirrorIndex];
   *   then if mirrorInc, advance mirrorSpriteQ.
   * - mirrorIndex 7: set mirrorSpriteQ = data (sprite-number mode).
   * - On mirrorSpriteQ change: if mirrorTie, sync spriteIndex + patternIndex.
   */
  mirrorDataW(data: number): void {
    if (this.mirrorIndex <= 4) {
      this.writeIndexedSpriteAttribute(this.mirrorSpriteQ, this.mirrorIndex, data);
    }

    let mirrorNumChange = false;
    if (this.mirrorIndex === 7) {
      this.mirrorSpriteQ = data & 0x7f;
      mirrorNumChange = true;
    } else if (this.mirrorInc) {
      this.mirrorSpriteQ = (this.mirrorSpriteQ + 1) & 0x7f;
      mirrorNumChange = true;
    }

    if (mirrorNumChange && this.mirrorTie) {
      // Sync main-port sprite+pattern indices from new mirrorSpriteQ
      this.spriteIndex = this.mirrorSpriteQ;
      this.patternIndex = this.mirrorSpriteQ & 0x3f;
      this.patternSubIndex = 0;
      this.spriteSubIndex = 0;
    }
  }

  writeSpriteAttribute(_port: number, value: number): void {
    // D7: sequential write only — the upper-byte "direct write" heuristic was dead code
    // (port 0x57 is matched by lower 8 bits only, upper byte is always 0x00)
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
      // D6: MAME io_w attr_num_change — sync mirrorSpriteQ from spriteIndex when mirrorTie
      if (this.mirrorTie) {
        this.mirrorSpriteQ = this.spriteIndex;
      }
    }
  }

  writeSpriteAttributeDirect(attrIndex: number, value: number): void {
    // D6: Set mirrorInc=false, mirrorIndex=attrIndex, call mirrorDataW
    this.mirrorInc = false;
    this.mirrorIndex = attrIndex;
    this.mirrorDataW(value);
  }

  writeSpriteAttributeDirectWithAutoInc(attrIndex: number, value: number): void {
    // D6: Set mirrorInc=true, mirrorIndex=attrIndex, call mirrorDataW
    this.mirrorInc = true;
    this.mirrorIndex = attrIndex;
    this.mirrorDataW(value);
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
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
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
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
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
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
        // --- Recalculate width and height
        this.updateSpriteDimensions(attributes);
        if (attributes.colorMode !== 0x01) {
          // --- Anchor sprite: set X MSB (bit 0 of attr4)
          attributes.x = (((value & 0x01) << 8) | (attributes.x & 0xff)) & 0x1ff;
        } else {
          // --- Relative sprite: bit 0 = pattern-relative flag (add anchor's pattern index)
          attributes.patternRelative = (value & 0x01) !== 0;
        }
        break;
    }

    // --- Invalidate resolved-sprite cache whenever raw attributes change
    this._attrsDirty = true;

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
   * Resolve all 128 sprites into resolvedAttributes[], compositing relative sprites
   * onto their anchor's position and transforms (mirrors MAME update_sprites_cache()).
   * Called once per scanline batch before the sprite render loop begins.
   * The result is cached until any sprite attribute write marks _attrsDirty.
   */
  resolveRelativeSprites(): void {
    if (!this._attrsDirty) return;
    this._attrsDirty = false;

    let anchorIdx = -1;
    let anchorVisible = false;

    for (let i = 0; i < 128; i++) {
      const src = this.attributes[i];
      const dst = this.resolvedAttributes[i];

      // A sprite is relative when has5AttributeBytes AND colorMode === 0b01
      const isRelative = src.has5AttributeBytes && src.colorMode === 0x01;

      let isVisible = src.visible;
      if (isRelative) {
        isVisible = isVisible && anchorVisible;
      } else {
        anchorVisible = isVisible;
      }

      if (!isVisible) {
        dst.visible = false;
        if (!isRelative) anchorIdx = -1; // anchor lost visibility — no anchor for relatives
        continue;
      }

      if (!isRelative) {
        // ── Anchor sprite: copy as-is ───────────────────────────────────────
        Object.assign(dst, src);
        dst.visible = true;
        anchorIdx = i;
      } else {
        // ── Relative sprite: composite onto anchor ─────────────────────────
        if (anchorIdx < 0) { dst.visible = false; continue; }
        const anchor = this.attributes[anchorIdx];

        // rel_type: bit 5 of anchor's attr4 AND anchor has 5 bytes
        const relType = anchor.attributeFlag2 && anchor.has5AttributeBytes;

        // Effective anchor transforms (zeroed when uniform rel_type)
        const aRotate  = relType ? anchor.rotate   : false;
        const aMirrorX = relType ? anchor.mirrorX  : false;
        const aMirrorY = relType ? anchor.mirrorY  : false;
        const aScaleX  = relType ? anchor.scaleX   : 0;
        const aScaleY  = relType ? anchor.scaleY   : 0;

        // Raw 8-bit signed offsets from relative sprite attr0 / attr1
        const rawX = src.x & 0xff;
        const rawY = src.y & 0xff;

        // Rotate swaps X/Y (MAME: spr_rel_x0/y0)
        const x0 = aRotate ? rawY : rawX;
        const y0 = aRotate ? rawX : rawY;

        // Mirror negates (MAME: spr_rel_x1/y1; negate = two's complement)
        const x1 = (aRotate !== aMirrorX) ? ((~x0 + 1) & 0xff) : x0;
        const y1 = aMirrorY              ? ((~y0 + 1) & 0xff) : y0;

        // Sign-extend 8→9-bit and scale (MAME: spr_rel_x2/y2)
        const x1s = x1 | (x1 >= 0x80 ? 0x100 : 0);
        const y1s = y1 | (y1 >= 0x80 ? 0x100 : 0);
        const x2 = (x1s << aScaleX) & 0x1ff;
        const y2 = (y1s << aScaleY) & 0x1ff;

        // Add anchor position (MAME: spr_rel_x3/y3)
        const x3 = (anchor.x + x2) & 0x1ff;
        const y3 = (anchor.y + y2) & 0x1ff;

        // Palette offset composition (MAME: spr_rel_paloff)
        // attributeFlag1 = attr2 bit 0 = "use anchor palette + relative palette"
        const palOff = src.attributeFlag1
          ? (anchor.paletteOffset + src.paletteOffset) & 0x0f
          : src.paletteOffset;

        // Mirror / rotate composition
        let finalMirrorX: boolean, finalMirrorY: boolean, finalRotate: boolean;
        if (relType) {
          // Composite: XOR anchor transforms with relative sprite's pre-rotated mirrors
          // MAME: spr_rel_xm = anchor_rotate ? (ymirror xor rotate) : xmirror
          //        spr_rel_ym = anchor_rotate ? (xmirror xor rotate) : ymirror
          const relXm = aRotate ? (src.mirrorY !== src.rotate) : src.mirrorX;
          const relYm = aRotate ? (src.mirrorX !== src.rotate) : src.mirrorY;
          finalMirrorX = aMirrorX !== relXm;
          finalMirrorY = aMirrorY !== relYm;
          finalRotate  = aRotate  !== src.rotate;
        } else {
          // Uniform: take relative sprite's own transforms unchanged
          finalMirrorX = src.mirrorX;
          finalMirrorY = src.mirrorY;
          finalRotate  = src.rotate;
        }

        // Scale: inherited from anchor when composite, own when uniform
        const finalScaleX = relType ? anchor.scaleX : src.scaleX;
        const finalScaleY = relType ? anchor.scaleY : src.scaleY;

        // 4-bit mode is always inherited from anchor
        const is4Bit = anchor.is4BitPattern;

        // Pattern 7-bit index (MAME: uses N6 bit; Klive stores bit 5 as attributeFlag2 proxy)
        //   N6 proxy for relative sprite = src.attributeFlag2 && is4Bit (matches MAME attr4 bit 6
        //   synthesised from relative-sprite bit 5 when building spr_cur_attr[4])
        const relN6 = src.attributeFlag2 && is4Bit;
        let resolvedPat7: number;

        if (src.patternRelative) {
          // MAME: (relPat + anchorPat) & 0x7f — both in MAME 7-bit encoding
          // Anchor 7-bit MAME pattern: (patternIndex<<1) | (anchorN6 && is4Bit)
          const anchorN6 = anchor.attributeFlag2 && anchor.is4BitPattern;
          const anchorPat7 = (anchor.patternIndex << 1) | (anchorN6 ? 1 : 0);
          const relPat7    = (src.patternIndex   << 1) | (relN6    ? 1 : 0);
          resolvedPat7 = (relPat7 + anchorPat7) & 0x7f;
        } else {
          resolvedPat7 = (src.patternIndex << 1) | (relN6 ? 1 : 0);
        }

        // Fill resolved attributes
        dst.x = x3;
        dst.y = y3;
        dst.paletteOffset = palOff;
        dst.mirrorX = finalMirrorX;
        dst.mirrorY = finalMirrorY;
        dst.rotate  = finalRotate;
        dst.attributeFlag1 = src.attributeFlag1;
        dst.visible = true;
        dst.has5AttributeBytes = true;
        dst.patternIndex = src.patternIndex;
        dst.colorMode = src.colorMode;
        dst.attributeFlag2 = src.attributeFlag2;
        dst.scaleX = finalScaleX;
        dst.scaleY = finalScaleY;
        dst.is4BitPattern = is4Bit;
        dst.patternRelative = src.patternRelative;

        // Derived transform variant
        dst.transformVariant =
          (finalRotate ? 4 : 0) | (finalMirrorX ? 2 : 0) | (finalMirrorY ? 1 : 0);

        // Pattern variant index for lookup in patternMemory4bit / patternMemory8bit
        if (is4Bit) {
          // resolvedPat7 is a 7-bit index into 128 × 8 = 1024 entries of patternMemory4bit
          dst.patternVariantIndex = (resolvedPat7 << 3) | dst.transformVariant;
        } else {
          // For 8-bit, resolvedPat7 = patternIndex<<1; divide by 2 to get 0-63 index
          // (consistent with how updatePatternVariantIndex stores 8-bit sprites)
          dst.patternVariantIndex = ((resolvedPat7 >> 1) << 3) | dst.transformVariant;
        }
        dst.pattern7Bit = resolvedPat7;

        // Effective dimensions
        const baseSize = 16;
        const scaledW = baseSize << finalScaleX;
        const scaledH = baseSize << finalScaleY;
        dst.width  = finalRotate ? scaledH : scaledW;
        dst.height = finalRotate ? scaledW : scaledH;
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
  patternVariantIndex: number; // Cached pattern variant index for direct lookup in patternMemory arrays
  width: number; // Effective sprite width in pixels after scaling and rotation
  height: number; // Effective sprite height in pixels after scaling and rotation
  patternRelative: boolean; // (relative sprites only) add anchor's pattern index to own
};

export type SpriteInfo = {
  attributes: SpriteAttributes;
};
