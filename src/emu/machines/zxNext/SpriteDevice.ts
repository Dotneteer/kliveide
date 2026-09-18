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
      colorMode: 0, attributeFlag2: false, patternN6: false, scaleX: 0, scaleY: 0, pattern7Bit: 0,
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
      this.attributes[i].patternN6 = false;
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
    // --- N6 is attr4 bit 6; bit 5 (`attributeFlag2`) is the anchor's relative type.
    return sprite.patternIndex | (sprite.patternN6 ? 64 : 0);
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
    // --- zxnext.vhd ~4807/~4833: a $34 write always uses mirror index "111" (select the sprite). It
    // --- used the index a previous $35-$39/$75-$79 write left behind, and wrote an attribute instead.
    this.mirrorIndex = 7;
    this.mirrorInc = false;
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
      attributes.patternN6 = false;
      // --- A 4-byte sprite is never 4-bit (FPGA `spr_cur_h <= attr_4(7) and attr_3(6)`), and has no
      // --- Y MSB; left set by an earlier five-byte write, both leaked into this sprite.
      attributes.is4BitPattern = false;
      attributes.patternRelative = false;
      attributes.y &= 0xff;
      attributes.scaleX = 0;
      attributes.scaleY = 0;
      attributes.pattern7Bit = spritePattern7Bit(attributes);
      this.updatePatternVariantIndex(attributes);
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

  /**
   * One byte written to pattern memory through port $5B.
   *
   * The hardware has a single 16K pattern memory addressed by `patternIndex << 8 | subIndex`, read two
   * ways (`_input/next-fpga/src/video/sprites.vhd`, `spr_pat_addr`, `spr_nibble_data`):
   *
   * - **8-bit** pattern N is the 256 bytes at N * 256, one byte per pixel.
   * - **4-bit** pattern P is the **128 bytes** at P * 128 (P = N * 2 + N6). Byte b holds two pixels:
   *   the **high nibble** at pixel address 2b and the low nibble at 2b + 1.
   *
   * So one write is a pixel of 8-bit pattern N and two pixels of 4-bit pattern `address >> 7`, each
   * fanned out to the 8 precomputed transform variants. It used to store only the low nibble, once,
   * at the 8-bit pixel address — so a 4-bit pattern uploaded as packed nibbles rendered wrongly.
   */
  writeSpritePattern(value: number): void {
    const subIndex = this.patternSubIndex; // 0-255
    const byteValue = value & 0xff;

    const base8 = this.patternIndex << 3;
    const row8 = subIndex >> 4;
    const col8 = subIndex & 0x0f;

    const pattern4 = (this.patternIndex << 1) | ((subIndex >> 7) & 1);
    const base4 = pattern4 << 3;
    const pixelHigh = (subIndex & 0x7f) << 1;
    const pixelLow = pixelHigh | 1;

    for (let variant = 0; variant < 8; variant++) {
      this.patternMemory8bit[base8 + variant][spriteVariantScreenOffset(variant, row8, col8)] =
        byteValue;
      this.patternMemory4bit[base4 + variant][
        spriteVariantScreenOffset(variant, pixelHigh >> 4, pixelHigh & 0x0f)
      ] = byteValue >> 4;
      this.patternMemory4bit[base4 + variant][
        spriteVariantScreenOffset(variant, pixelLow >> 4, pixelLow & 0x0f)
      ] = byteValue & 0x0f;
    }

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
        // --- Bit 0 is X's ninth bit (FPGA `spr_cur_x <= attr_2(0) & attr_0`). For a relative sprite
        // --- it means "add the anchor's palette offset" instead; the resolver reads only X's low byte.
        attributes.x = (((value & 0x01) << 8) | (attributes.x & 0xff)) & 0x1ff;
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
        attributes.pattern7Bit = spritePattern7Bit(attributes);
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
        break;
      default:
        // --- attr4 (5th attribute byte)
        /*
         * attr4, per the FPGA: anchor `H N6 T XX YY Y8`; relative `0 1 N6 0 XX YY PR`.
         *
         * - bit 7 (H) selects 4-bit patterns, bit 6 is N6 — the 7th pattern bit — for an anchor.
         * - bit 5 is the relative type T for an anchor, and N6 for a relative sprite
         *   (`attributeFlag2` holds it for both, and the resolver reads it per role).
         * - bit 0 is Y's ninth bit for an anchor, and "pattern relative" for a relative sprite.
         *
         * N6 was read from bit 5 and X's ninth bit from bit 0 here; both were wrong.
         */
        attributes.colorMode = (value & 0xc0) >> 6;
        attributes.attributeFlag2 = (value & 0x20) !== 0;
        attributes.patternN6 = (value & 0x40) !== 0;
        attributes.is4BitPattern = (value & 0x80) !== 0;
        attributes.scaleX = (value & 0x18) >> 3;
        attributes.scaleY = (value & 0x06) >> 1;
        attributes.pattern7Bit = spritePattern7Bit(attributes);
        // --- Cache complete pattern variant index for direct memory lookup
        this.updatePatternVariantIndex(attributes);
        // --- Recalculate width and height
        this.updateSpriteDimensions(attributes);
        if (attributes.colorMode !== 0x01) {
          // --- Y's ninth bit exists only for a sprite with five attribute bytes (FPGA `spr_y8`).
          const yMsb = attributes.has5AttributeBytes ? value & 0x01 : 0;
          attributes.y = ((yMsb << 8) | (attributes.y & 0xff)) & 0x1ff;
          attributes.patternRelative = false;
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
      const pattern7 = (attributes.patternIndex << 1) | (attributes.patternN6 ? 1 : 0);
      attributes.patternVariantIndex = (pattern7 << 3) | attributes.transformVariant;
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

    /*
     * Follows `_input/next-fpga/src/video/sprites.vhd` ("sort out relative sprite characteristics" and
     * the anchor latch in `S_QUALIFY`), the same rules as the WASM engine's `zxnextUlaResolveSprites`:
     *
     * - A sprite is **relative** when it has five attribute bytes and attr4 bits 7:6 are `01`. Every
     *   other sprite — visible or not — becomes the anchor for the relatives after it; a relative is
     *   visible only when its anchor is.
     * - An anchor is 4-bit only with five bytes and attr4 bit 7; its N6 is attr4 bit 6, its relative
     *   type T attr4 bit 5. With T clear, no anchor transform or scale reaches its relatives.
     * - A relative inherits 4-bit mode, takes N6 from its own attr4 bit 5, adds the anchor's pattern
     *   when its attr4 bit 0 is set and the anchor's palette offset when its attr2 bit 0 is set.
     */
    let anchorVisible = false;
    let anchorRelType = false;
    let anchorH = false;
    let anchorX = 0;
    let anchorY = 0;
    let anchorPattern = 0;
    let anchorPaletteOffset = 0;
    let anchorRotate = false;
    let anchorMirrorX = false;
    let anchorMirrorY = false;
    let anchorScaleX = 0;
    let anchorScaleY = 0;

    for (let i = 0; i < 128; i++) {
      const src = this.attributes[i];
      const dst = this.resolvedAttributes[i];
      const has5 = src.has5AttributeBytes;
      const isRelative = has5 && src.colorMode === 0x01;

      if (!isRelative) {
        const h = has5 && src.is4BitPattern;
        const pattern7 = (src.patternIndex << 1) | (h && src.patternN6 ? 1 : 0);
        const scaleX = has5 ? src.scaleX : 0;
        const scaleY = has5 ? src.scaleY : 0;

        Object.assign(dst, src);
        dst.x = src.x & 0x1ff;
        dst.y = has5 ? src.y & 0x1ff : src.y & 0xff;
        dst.scaleX = scaleX;
        dst.scaleY = scaleY;
        dst.is4BitPattern = h;
        dst.pattern7Bit = pattern7;
        dst.transformVariant = (src.rotate ? 4 : 0) | (src.mirrorX ? 2 : 0) | (src.mirrorY ? 1 : 0);
        dst.patternVariantIndex = h
          ? (pattern7 << 3) | dst.transformVariant
          : (src.patternIndex << 3) | dst.transformVariant;
        dst.width = 16 << scaleX;
        dst.height = 16 << scaleY;

        anchorVisible = src.visible;
        anchorRelType = has5 && src.attributeFlag2;
        anchorH = h;
        anchorX = dst.x;
        anchorY = dst.y;
        anchorPattern = pattern7;
        anchorPaletteOffset = src.paletteOffset;
        anchorRotate = anchorRelType && src.rotate;
        anchorMirrorX = anchorRelType && src.mirrorX;
        anchorMirrorY = anchorRelType && src.mirrorY;
        anchorScaleX = anchorRelType ? scaleX : 0;
        anchorScaleY = anchorRelType ? scaleY : 0;
        continue;
      }

      // --- Relative sprite (`spr_rel_*`)
      const rawX = src.x & 0xff;
      const rawY = src.y & 0xff;
      const x0 = anchorRotate ? rawY : rawX;
      const y0 = anchorRotate ? rawX : rawY;
      const x1 = anchorRotate !== anchorMirrorX ? (~x0 + 1) & 0xff : x0;
      const y1 = anchorMirrorY ? (~y0 + 1) & 0xff : y0;
      const signExtendScale = (value8: number, scale: number) =>
        ((value8 & 0x80 ? value8 | 0x100 : value8) << scale) & 0x1ff;
      const x3 = (anchorX + signExtendScale(x1, anchorScaleX)) & 0x1ff;
      const y3 = (anchorY + signExtendScale(y1, anchorScaleY)) & 0x1ff;

      let mirrorX: boolean;
      let mirrorY: boolean;
      let rotate: boolean;
      let scaleX: number;
      let scaleY: number;
      if (anchorRelType) {
        const relXm = anchorRotate ? src.mirrorY !== src.rotate : src.mirrorX;
        const relYm = anchorRotate ? src.mirrorX !== src.rotate : src.mirrorY;
        mirrorX = anchorMirrorX !== relXm;
        mirrorY = anchorMirrorY !== relYm;
        rotate = anchorRotate !== src.rotate;
        scaleX = anchorScaleX;
        scaleY = anchorScaleY;
      } else {
        mirrorX = src.mirrorX;
        mirrorY = src.mirrorY;
        rotate = src.rotate;
        scaleX = src.scaleX;
        scaleY = src.scaleY;
      }

      const n6 = anchorH && src.attributeFlag2;
      let pattern7 = (src.patternIndex << 1) | (n6 ? 1 : 0);
      if (src.patternRelative) pattern7 = (pattern7 + anchorPattern) & 0x7f;

      Object.assign(dst, src);
      dst.visible = anchorVisible && src.visible;
      dst.x = x3;
      dst.y = y3;
      dst.paletteOffset = src.attributeFlag1
        ? (anchorPaletteOffset + src.paletteOffset) & 0x0f
        : src.paletteOffset;
      dst.mirrorX = mirrorX;
      dst.mirrorY = mirrorY;
      dst.rotate = rotate;
      dst.scaleX = scaleX;
      dst.scaleY = scaleY;
      dst.is4BitPattern = anchorH;
      dst.pattern7Bit = pattern7;
      dst.transformVariant = (rotate ? 4 : 0) | (mirrorX ? 2 : 0) | (mirrorY ? 1 : 0);
      dst.patternVariantIndex = anchorH
        ? (pattern7 << 3) | dst.transformVariant
        : ((pattern7 >> 1) << 3) | dst.transformVariant;
      dst.width = 16 << scaleX;
      dst.height = 16 << scaleY;
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
    // --- Scale is applied in screen space and is not swapped by rotation: the FPGA counts the width
    // --- with the X scale and the height with the Y scale whatever the rotate bit says.
    attributes.width = 16 << attributes.scaleX;
    attributes.height = 16 << attributes.scaleY;
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
  /** attr4 bit 5: an anchor's relative type, or a relative sprite's N6. */
  attributeFlag2: boolean;
  /** attr4 bit 6: an anchor's N6, the 7th pattern bit of a 4-bit pattern. */
  patternN6: boolean;
  scaleX: number;
  scaleY: number;
  // --- Computed fields for renderer optimization
  pattern7Bit: number; // Full 7-bit pattern index: patternIndex | (N6 ? 64 : 0), N6 = attr4 bit 6
  is4BitPattern: boolean; // 4-bit color mode flag
  transformVariant: number; // Cached transformation variant (0-7): (rotate << 2) | (mirrorX << 1) | mirrorY
  patternVariantIndex: number; // Cached pattern variant index for direct lookup in patternMemory arrays
  width: number; // Sprite width in pixels after scaling (rotation does not swap it)
  height: number; // Sprite height in pixels after scaling (rotation does not swap it)
  patternRelative: boolean; // (relative sprites only) add anchor's pattern index to own
};

export type SpriteInfo = {
  attributes: SpriteAttributes;
};

/**
 * Where a pattern pixel lands on screen for one of the 8 transform variants.
 *
 * Pattern memories hold every variant precomputed, indexed by the *screen* pixel of the 16x16 cell,
 * so this is the inverse of the FPGA's read address (`spr_pattern_addr_start`/`_delta`):
 *
 *   no rotate: pattern row = ymirror ? 15 - sy : sy,   pattern col = xmirror ? 15 - sx : sx
 *   rotate:    pattern row = xmirror ? sx : 15 - sx,   pattern col = ymirror ? 15 - sy : sy
 *
 * i.e. rotate 90° clockwise, then mirror in screen space. Variants 5 and 6 (rotate with one mirror)
 * used to be swapped. `variant` is `rotate << 2 | xmirror << 1 | ymirror`.
 */
export function spriteVariantScreenOffset(variant: number, row: number, col: number): number {
  const rotate = (variant & 4) !== 0;
  const xmirror = (variant & 2) !== 0;
  const ymirror = (variant & 1) !== 0;
  let sx: number;
  let sy: number;
  if (rotate) {
    sx = xmirror ? row : 15 - row;
    sy = ymirror ? 15 - col : col;
  } else {
    sx = xmirror ? 15 - col : col;
    sy = ymirror ? 15 - row : row;
  }
  return (sy << 4) | sx;
}

/**
 * `pattern7Bit` as this device has always encoded it: the 6-bit pattern index, plus 64 for N6.
 *
 * Only the *source* of N6 changed — attr4 bit 6, not bit 5. `resolvedAttributes[].pattern7Bit` has
 * always used the hardware's own order instead, `N5..N0 & N6`, and still does.
 */
function spritePattern7Bit(attributes: SpriteAttributes): number {
  return attributes.patternIndex | (attributes.patternN6 ? 64 : 0);
}
