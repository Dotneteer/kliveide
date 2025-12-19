import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export const TBBLUE_DEF_TRANSPARENT_COLOR = 0xe3;

const defaultUlaColors = [
  0x000, // 000_000_000
  0x005, // 000_000_101
  0x140, // 101_000_000
  0x145, // 101_000_101
  0x028, // 000_101_000
  0x02d, // 000_101_101
  0x168, // 101_101_000
  0x16d, // 101_101_101
  0x000, // 000_000_000
  0x007, // 000_000_111
  0x1c0, // 111_000_000
  0x1c7, // 111_000_111
  0x038, // 000_111_000
  0x03f, // 000_111_111
  0x1f8, // 111_111_000
  0x1ff //  111_111_111
];

export class PaletteDevice implements IGenericDevice<IZxNextMachine> {
  private _paletteIndex: number;
  private _disablePaletteWriteAutoInc: boolean;
  private _selectedPalette: number;
  private _secondSpritePalette: boolean;
  private _secondLayer2Palette: boolean;
  private _secondUlaPalette: boolean;
  private _secondTilemapPalette: boolean;
  private _enableUlaNextMode: boolean;
  private _secondWrite: boolean;

  ulaFirst: number[] = [];
  ulaSecond: number[] = [];
  private ulaRgbFirst: number[] = [];
  private ulaRgbSecond: number[] = [];
  layer2First: number[] = [];
  layer2Second: number[] = [];
  private layer2RgbFirst: number[] = [];
  private layer2RgbSecond: number[] = [];
  spriteFirst: number[] = [];
  spriteSecond: number[] = [];
  private spriteRgbFirst: number[] = [];
  private spriteRgbSecond: number[] = [];
  tilemapFirst: number[] = [];
  tilemapSecond: number[] = [];
  private tilemapRgbFirst: number[] = [];
  private tilemapRgbSecond: number[] = [];
  ulaNextByteFormat: number;
  storedPaletteValue: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._paletteIndex = 0;
    this._disablePaletteWriteAutoInc = false;
    this._selectedPalette = 0;
    this._secondUlaPalette = false;
    this._secondLayer2Palette = false;
    this._secondSpritePalette = false;
    this._secondTilemapPalette = false;
    this._enableUlaNextMode = false;
    this._secondWrite = false;
    this.storedPaletteValue = 0;
    for (let i = 0; i < 256; i++) {
      let color = (i << 1) | (i & 2 ? 1 : 0);

      // --- The Layer 2 and sprite palettes follow a strange pattern.
      // --- They set Bit 0 as the initial Bit 1.
      // --- It does not follow the logic of mixing bit 0 and bit 1 used in register 41H.
      this.layer2First[i] = this.layer2Second[i] = color;
      this.layer2RgbFirst[i] = this.layer2RgbSecond[i] = zxNext9BitColorCodes[color];
      this.spriteFirst[i] = this.spriteSecond[i] = color;
      this.spriteRgbFirst[i] = this.spriteRgbSecond[i] = zxNext9BitColorCodes[color];
      this.tilemapFirst[i] = this.tilemapSecond[i] = color;
      this.tilemapRgbFirst[i] = this.tilemapRgbSecond[i] = zxNext9BitColorCodes[color];
    }

    // --- The ULA palette is a bit more complex, it repeats every 16 colors
    // --- Bright magenta is a transparent color by default (1C7H and 1C6H / 2 = E3H)
    // --- Let's change it to 1CF, which is a color FF24FFH. It is not pure magenta,
    // --- but avoids the default transparent problem.
    // --- This is also corrected by NextOS when starting, but if we start TbBlue in
    // --- fast-boot mode, the bright magenta would be transparent.
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 16; i++) {
        const idx = j * 16 + i;
        const colorValue = i !== 11 ? defaultUlaColors[i] : 0x1cf;
        this.ulaFirst[idx] = this.ulaSecond[idx] = colorValue;
        this.ulaRgbFirst[idx] = this.ulaRgbSecond[idx] = zxNext9BitColorCodes[colorValue];
      }
    }
  }

  get nextReg40Value(): number {
    return this._paletteIndex;
  }

  set nextReg40Value(value: number) {
    this._paletteIndex = value & 0xff;
    this._secondWrite = false;
  }

  get nextReg41Value(): number {
    return this.getCurrentPalette()[this._paletteIndex] >> 1;
  }

  set nextReg41Value(value: number) {
    this.storedPaletteValue = value & 0xff;
    const regValue = (value << 1) | (value & 0x03 ? 1 : 0);
    this.getCurrentPalette()[this._paletteIndex] = regValue;
    // Update RGB arrays based on selected palette
    switch (this._selectedPalette) {
      case 0:
        this.ulaRgbFirst[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        // Update border cache if ULA first palette changed
        this.machine.composedScreenDevice.updateBorderRgbCache();
        break;
      case 1:
        this.layer2RgbFirst[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        break;
      case 2:
        this.spriteRgbFirst[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        break;
      case 3:
        this.tilemapRgbFirst[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        break;
      case 4:
        this.ulaRgbSecond[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        // Update border cache if ULA second palette changed
        this.machine.composedScreenDevice.updateBorderRgbCache();
        break;
      case 5:
        this.layer2RgbSecond[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        break;
      case 6:
        this.spriteRgbSecond[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        break;
      case 7:
        this.tilemapRgbSecond[this._paletteIndex] = zxNext9BitColorCodes[regValue];
        break;
    }
    if (!this._disablePaletteWriteAutoInc) {
      this._paletteIndex = (this._paletteIndex + 1) & 0xff;
    }
    this._secondWrite = false;
    this.updateUlaPalette();
  }

  get nextReg43Value(): number {
    return (
      (this._disablePaletteWriteAutoInc ? 0x80 : 0) |
      (this._selectedPalette << 4) |
      (this._secondSpritePalette ? 0x08 : 0) |
      (this._secondLayer2Palette ? 0x04 : 0) |
      (this._secondUlaPalette ? 0x02 : 0) |
      (this._enableUlaNextMode ? 0x01 : 0)
    );
  }

  set nextReg43Value(value: number) {
    this._disablePaletteWriteAutoInc = (value & 0x80) !== 0;
    this._selectedPalette = (value & 0x70) >> 4;
    this._secondSpritePalette = (value & 0x08) !== 0;
    this._secondLayer2Palette = (value & 0x04) !== 0;
    const oldSecondUlaPalette = this._secondUlaPalette;
    this._secondUlaPalette = (value & 0x02) !== 0;
    this._enableUlaNextMode = (value & 0x01) !== 0;
    this._secondWrite = false;
    this.updateUlaPalette();
    // Update border cache if active ULA palette switched
    if (oldSecondUlaPalette !== this._secondUlaPalette) {
      this.machine.composedScreenDevice.updateBorderRgbCache();
    }
  }

  get nextReg44Value(): number {
    const value = this.getCurrentPalette()[this._paletteIndex];
    return value & 0x01;
  }

  set nextReg44Value(value: number) {
    this.storedPaletteValue = value & 0xff;
    const palette = this.getCurrentPalette();
    if (!this._secondWrite) {
      palette[this._paletteIndex] = (value & 0xff) << 1;
    } else {
      palette[this._paletteIndex] = palette[this._paletteIndex] | (value & 0x01);
      if (palette === this.layer2First || palette === this.layer2Second) {
        if (value & 0x80) {
          // --- Sign priority color for Layer 2 palettes
          palette[this._paletteIndex] |= 0x200;
        }
      }
      // --- Update RGB arrays after the second write
      switch (this._selectedPalette) {
        case 0:
          this.ulaRgbFirst[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex]];
          // Update border cache if ULA first palette changed
          this.machine.composedScreenDevice.updateBorderRgbCache();
          break;
        case 1:
          this.layer2RgbFirst[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex] & 0x1ff];
          break;
        case 2:
          this.spriteRgbFirst[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex]];
          break;
        case 3:
          this.tilemapRgbFirst[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex]];
          break;
        case 4:
          this.ulaRgbSecond[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex]];
          // Update border cache if ULA second palette changed
          this.machine.composedScreenDevice.updateBorderRgbCache();
          break;
        case 5:
          this.layer2RgbSecond[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex] & 0x1ff];
          break;
        case 6:
          this.spriteRgbSecond[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex]];
          break;
        case 7:
          this.tilemapRgbSecond[this._paletteIndex] = zxNext9BitColorCodes[palette[this._paletteIndex]];
          break;
      }
      if (!this._disablePaletteWriteAutoInc) {
        this._paletteIndex = (this._paletteIndex + 1) & 0xff;
      }
    }
    this._secondWrite = !this._secondWrite;
    this.updateUlaPalette();
  }

  get paletteIndex(): number {
    return this._paletteIndex;
  }

  get disablePaletteWriteAutoInc(): boolean {
    return this._disablePaletteWriteAutoInc;
  }

  get selectedPalette(): number {
    return this._selectedPalette;
  }

  get secondSpritePalette(): boolean {
    return this._secondSpritePalette;
  }

  get secondLayer2Palette(): boolean {
    return this._secondLayer2Palette;
  }

  get secondUlaPalette(): boolean {
    return this._secondUlaPalette;
  }

  get secondTilemapPalette(): boolean {
    return this._secondTilemapPalette;  
  }

  set secondTilemapPalette(value: boolean) {
    this._secondTilemapPalette = value;
  }

  get enableUlaNextMode(): boolean {
    return this._enableUlaNextMode;
  }

  get secondWrite(): boolean {
    return this._secondWrite;
  }

  getCurrentPalette(): number[] {
    switch (this._selectedPalette) {
      case 0:
        return this.ulaFirst;
      case 1:
        return this.layer2First;
      case 2:
        return this.spriteFirst;
      case 3:
        return this.tilemapFirst;
      case 4:
        return this.ulaSecond;
      case 5:
        return this.layer2Second;
      case 6:
        return this.spriteSecond;
      default:
        return this.tilemapSecond;
    }
  }

  getUlaRgb(index: number): number {
    return this._secondUlaPalette
      ? this.ulaRgbSecond[index & 0xff]
      : this.ulaRgbFirst[index & 0xff];
  }

  getLayer2Rgb(index: number): number {
    return this._secondLayer2Palette
      ? this.layer2RgbSecond[index & 0xff]
      : this.layer2RgbFirst[index & 0xff];
  }

  getSpriteRgb(index: number): number {
    return this._secondSpritePalette
      ? this.spriteRgbSecond[index & 0xff]
      : this.spriteRgbFirst[index & 0xff];
  }

  getTilemapRgb(index: number): number {
    return this.tilemapRgbSecond[index & 0xff];
  }

  private updateUlaPalette(): void {
    if (this._selectedPalette === 0) {
      this.machine.screenDevice.setCurrentUlaColorsFromPalette(
        this.ulaFirst,
        this._enableUlaNextMode,
        this.ulaNextByteFormat
      );
    } else if (this._selectedPalette === 4) {
      this.machine.screenDevice.setCurrentUlaColorsFromPalette(
        this.ulaSecond,
        this._enableUlaNextMode,
        this.ulaNextByteFormat
      );
    }
  }
}

export const zxNext9BitColorCodes: number[] = [
  0x000000, 0x000024, 0x000049, 0x00006d, 0x000092, 0x0000b6, 0x0000db, 0x0000ff, 0x002400,
  0x002424, 0x002449, 0x00246d, 0x002492, 0x0024b6, 0x0024db, 0x0024ff, 0x004900, 0x004924,
  0x004949, 0x00496d, 0x004992, 0x0049b6, 0x0049db, 0x0049ff, 0x006d00, 0x006d24, 0x006d49,
  0x006d6d, 0x006d92, 0x006db6, 0x006ddb, 0x006dff, 0x009200, 0x009224, 0x009249, 0x00926d,
  0x009292, 0x0092b6, 0x0092db, 0x0092ff, 0x00b600, 0x00b624, 0x00b649, 0x00b66d, 0x00b692,
  0x00b6b6, 0x00b6db, 0x00b6ff, 0x00db00, 0x00db24, 0x00db49, 0x00db6d, 0x00db92, 0x00dbb6,
  0x00dbdb, 0x00dbff, 0x00ff00, 0x00ff24, 0x00ff49, 0x00ff6d, 0x00ff92, 0x00ffb6, 0x00ffdb,
  0x00ffff, 0x240000, 0x240024, 0x240049, 0x24006d, 0x240092, 0x2400b6, 0x2400db, 0x2400ff,
  0x242400, 0x242424, 0x242449, 0x24246d, 0x242492, 0x2424b6, 0x2424db, 0x2424ff, 0x244900,
  0x244924, 0x244949, 0x24496d, 0x244992, 0x2449b6, 0x2449db, 0x2449ff, 0x246d00, 0x246d24,
  0x246d49, 0x246d6d, 0x246d92, 0x246db6, 0x246ddb, 0x246dff, 0x249200, 0x249224, 0x249249,
  0x24926d, 0x249292, 0x2492b6, 0x2492db, 0x2492ff, 0x24b600, 0x24b624, 0x24b649, 0x24b66d,
  0x24b692, 0x24b6b6, 0x24b6db, 0x24b6ff, 0x24db00, 0x24db24, 0x24db49, 0x24db6d, 0x24db92,
  0x24dbb6, 0x24dbdb, 0x24dbff, 0x24ff00, 0x24ff24, 0x24ff49, 0x24ff6d, 0x24ff92, 0x24ffb6,
  0x24ffdb, 0x24ffff, 0x490000, 0x490024, 0x490049, 0x49006d, 0x490092, 0x4900b6, 0x4900db,
  0x4900ff, 0x492400, 0x492424, 0x492449, 0x49246d, 0x492492, 0x4924b6, 0x4924db, 0x4924ff,
  0x494900, 0x494924, 0x494949, 0x49496d, 0x494992, 0x4949b6, 0x4949db, 0x4949ff, 0x496d00,
  0x496d24, 0x496d49, 0x496d6d, 0x496d92, 0x496db6, 0x496ddb, 0x496dff, 0x499200, 0x499224,
  0x499249, 0x49926d, 0x499292, 0x4992b6, 0x4992db, 0x4992ff, 0x49b600, 0x49b624, 0x49b649,
  0x49b66d, 0x49b692, 0x49b6b6, 0x49b6db, 0x49b6ff, 0x49db00, 0x49db24, 0x49db49, 0x49db6d,
  0x49db92, 0x49dbb6, 0x49dbdb, 0x49dbff, 0x49ff00, 0x49ff24, 0x49ff49, 0x49ff6d, 0x49ff92,
  0x49ffb6, 0x49ffdb, 0x49ffff, 0x6d0000, 0x6d0024, 0x6d0049, 0x6d006d, 0x6d0092, 0x6d00b6,
  0x6d00db, 0x6d00ff, 0x6d2400, 0x6d2424, 0x6d2449, 0x6d246d, 0x6d2492, 0x6d24b6, 0x6d24db,
  0x6d24ff, 0x6d4900, 0x6d4924, 0x6d4949, 0x6d496d, 0x6d4992, 0x6d49b6, 0x6d49db, 0x6d49ff,
  0x6d6d00, 0x6d6d24, 0x6d6d49, 0x6d6d6d, 0x6d6d92, 0x6d6db6, 0x6d6ddb, 0x6d6dff, 0x6d9200,
  0x6d9224, 0x6d9249, 0x6d926d, 0x6d9292, 0x6d92b6, 0x6d92db, 0x6d92ff, 0x6db600, 0x6db624,
  0x6db649, 0x6db66d, 0x6db692, 0x6db6b6, 0x6db6db, 0x6db6ff, 0x6ddb00, 0x6ddb24, 0x6ddb49,
  0x6ddb6d, 0x6ddb92, 0x6ddbb6, 0x6ddbdb, 0x6ddbff, 0x6dff00, 0x6dff24, 0x6dff49, 0x6dff6d,
  0x6dff92, 0x6dffb6, 0x6dffdb, 0x6dffff, 0x920000, 0x920024, 0x920049, 0x92006d, 0x920092,
  0x9200b6, 0x9200db, 0x9200ff, 0x922400, 0x922424, 0x922449, 0x92246d, 0x922492, 0x9224b6,
  0x9224db, 0x9224ff, 0x924900, 0x924924, 0x924949, 0x92496d, 0x924992, 0x9249b6, 0x9249db,
  0x9249ff, 0x926d00, 0x926d24, 0x926d49, 0x926d6d, 0x926d92, 0x926db6, 0x926ddb, 0x926dff,
  0x929200, 0x929224, 0x929249, 0x92926d, 0x929292, 0x9292b6, 0x9292db, 0x9292ff, 0x92b600,
  0x92b624, 0x92b649, 0x92b66d, 0x92b692, 0x92b6b6, 0x92b6db, 0x92b6ff, 0x92db00, 0x92db24,
  0x92db49, 0x92db6d, 0x92db92, 0x92dbb6, 0x92dbdb, 0x92dbff, 0x92ff00, 0x92ff24, 0x92ff49,
  0x92ff6d, 0x92ff92, 0x92ffb6, 0x92ffdb, 0x92ffff, 0xb60000, 0xb60024, 0xb60049, 0xb6006d,
  0xb60092, 0xb600b6, 0xb600db, 0xb600ff, 0xb62400, 0xb62424, 0xb62449, 0xb6246d, 0xb62492,
  0xb624b6, 0xb624db, 0xb624ff, 0xb64900, 0xb64924, 0xb64949, 0xb6496d, 0xb64992, 0xb649b6,
  0xb649db, 0xb649ff, 0xb66d00, 0xb66d24, 0xb66d49, 0xb66d6d, 0xb66d92, 0xb66db6, 0xb66ddb,
  0xb66dff, 0xb69200, 0xb69224, 0xb69249, 0xb6926d, 0xb69292, 0xb692b6, 0xb692db, 0xb692ff,
  0xb6b600, 0xb6b624, 0xb6b649, 0xb6b66d, 0xb6b692, 0xb6b6b6, 0xb6b6db, 0xb6b6ff, 0xb6db00,
  0xb6db24, 0xb6db49, 0xb6db6d, 0xb6db92, 0xb6dbb6, 0xb6dbdb, 0xb6dbff, 0xb6ff00, 0xb6ff24,
  0xb6ff49, 0xb6ff6d, 0xb6ff92, 0xb6ffb6, 0xb6ffdb, 0xb6ffff, 0xdb0000, 0xdb0024, 0xdb0049,
  0xdb006d, 0xdb0092, 0xdb00b6, 0xdb00db, 0xdb00ff, 0xdb2400, 0xdb2424, 0xdb2449, 0xdb246d,
  0xdb2492, 0xdb24b6, 0xdb24db, 0xdb24ff, 0xdb4900, 0xdb4924, 0xdb4949, 0xdb496d, 0xdb4992,
  0xdb49b6, 0xdb49db, 0xdb49ff, 0xdb6d00, 0xdb6d24, 0xdb6d49, 0xdb6d6d, 0xdb6d92, 0xdb6db6,
  0xdb6ddb, 0xdb6dff, 0xdb9200, 0xdb9224, 0xdb9249, 0xdb926d, 0xdb9292, 0xdb92b6, 0xdb92db,
  0xdb92ff, 0xdbb600, 0xdbb624, 0xdbb649, 0xdbb66d, 0xdbb692, 0xdbb6b6, 0xdbb6db, 0xdbb6ff,
  0xdbdb00, 0xdbdb24, 0xdbdb49, 0xdbdb6d, 0xdbdb92, 0xdbdbb6, 0xdbdbdb, 0xdbdbff, 0xdbff00,
  0xdbff24, 0xdbff49, 0xdbff6d, 0xdbff92, 0xdbffb6, 0xdbffdb, 0xdbffff, 0xff0000, 0xff0024,
  0xff0049, 0xff006d, 0xff0092, 0xff00b6, 0xff00db, 0xff00ff, 0xff2400, 0xff2424, 0xff2449,
  0xff246d, 0xff2492, 0xff24b6, 0xff24db, 0xff24ff, 0xff4900, 0xff4924, 0xff4949, 0xff496d,
  0xff4992, 0xff49b6, 0xff49db, 0xff49ff, 0xff6d00, 0xff6d24, 0xff6d49, 0xff6d6d, 0xff6d92,
  0xff6db6, 0xff6ddb, 0xff6dff, 0xff9200, 0xff9224, 0xff9249, 0xff926d, 0xff9292, 0xff92b6,
  0xff92db, 0xff92ff, 0xffb600, 0xffb624, 0xffb649, 0xffb66d, 0xffb692, 0xffb6b6, 0xffb6db,
  0xffb6ff, 0xffdb00, 0xffdb24, 0xffdb49, 0xffdb6d, 0xffdb92, 0xffdbb6, 0xffdbdb, 0xffdbff,
  0xffff00, 0xffff24, 0xffff49, 0xffff6d, 0xffff92, 0xffffb6, 0xffffdb, 0xffffff
];

export const zxNext8BitColorCodes: number[] = [
  0x000000, 0x000049, 0x0000b6, 0x0000ff, 0x002400, 0x002449, 0x0024b6, 0x0024ff, 0x004900,
  0x004949, 0x0049b6, 0x0049ff, 0x006d00, 0x006d49, 0x006db6, 0x006dff, 0x009200, 0x009249,
  0x0092b6, 0x0092ff, 0x00b600, 0x00b649, 0x00b6b6, 0x00b6ff, 0x00db00, 0x00db49, 0x00dbb6,
  0x00dbff, 0x00ff00, 0x00ff49, 0x00ffb6, 0x00ffff, 0x240000, 0x240049, 0x2400b6, 0x2400ff,
  0x242400, 0x242449, 0x2424b6, 0x2424ff, 0x244900, 0x244949, 0x2449b6, 0x2449ff, 0x246d00,
  0x246d49, 0x246db6, 0x246dff, 0x249200, 0x249249, 0x2492b6, 0x2492ff, 0x24b600, 0x24b649,
  0x24b6b6, 0x24b6ff, 0x24db00, 0x24db49, 0x24dbb6, 0x24dbff, 0x24ff00, 0x24ff49, 0x24ffb6,
  0x24ffff, 0x490000, 0x490049, 0x4900b6, 0x4900ff, 0x492400, 0x492449, 0x4924b6, 0x4924ff,
  0x494900, 0x494949, 0x4949b6, 0x4949ff, 0x496d00, 0x496d49, 0x496db6, 0x496dff, 0x499200,
  0x499249, 0x4992b6, 0x4992ff, 0x49b600, 0x49b649, 0x49b6b6, 0x49b6ff, 0x49db00, 0x49db49,
  0x49dbb6, 0x49dbff, 0x49ff00, 0x49ff49, 0x49ffb6, 0x49ffff, 0x6d0000, 0x6d0049, 0x6d00b6,
  0x6d00ff, 0x6d2400, 0x6d2449, 0x6d24b6, 0x6d24ff, 0x6d4900, 0x6d4949, 0x6d49b6, 0x6d49ff,
  0x6d6d00, 0x6d6d49, 0x6d6db6, 0x6d6dff, 0x6d9200, 0x6d9249, 0x6d92b6, 0x6d92ff, 0x6db600,
  0x6db649, 0x6db6b6, 0x6db6ff, 0x6ddb00, 0x6ddb49, 0x6ddbb6, 0x6ddbff, 0x6dff00, 0x6dff49,
  0x6dffb6, 0x6dffff, 0x920000, 0x920049, 0x9200b6, 0x9200ff, 0x922400, 0x922449, 0x9224b6,
  0x9224ff, 0x924900, 0x924949, 0x9249b6, 0x9249ff, 0x926d00, 0x926d49, 0x926db6, 0x926dff,
  0x929200, 0x929249, 0x9292b6, 0x9292ff, 0x92b600, 0x92b649, 0x92b6b6, 0x92b6ff, 0x92db00,
  0x92db49, 0x92dbb6, 0x92dbff, 0x92ff00, 0x92ff49, 0x92ffb6, 0x92ffff, 0xb60000, 0xb60049,
  0xb600b6, 0xb600ff, 0xb62400, 0xb62449, 0xb624b6, 0xb624ff, 0xb64900, 0xb64949, 0xb649b6,
  0xb649ff, 0xb66d00, 0xb66d49, 0xb66db6, 0xb66dff, 0xb69200, 0xb69249, 0xb692b6, 0xb692ff,
  0xb6b600, 0xb6b649, 0xb6b6b6, 0xb6b6ff, 0xb6db00, 0xb6db49, 0xb6dbb6, 0xb6dbff, 0xb6ff00,
  0xb6ff49, 0xb6ffb6, 0xb6ffff, 0xdb0000, 0xdb0049, 0xdb00b6, 0xdb00ff, 0xdb2400, 0xdb2449,
  0xdb24b6, 0xdb24ff, 0xdb4900, 0xdb4949, 0xdb49b6, 0xdb49ff, 0xdb6d00, 0xdb6d49, 0xdb6db6,
  0xdb6dff, 0xdb9200, 0xdb9249, 0xdb92b6, 0xdb92ff, 0xdbb600, 0xdbb649, 0xdbb6b6, 0xdbb6ff,
  0xdbdb00, 0xdbdb49, 0xdbdbb6, 0xdbdbff, 0xdbff00, 0xdbff49, 0xdbffb6, 0xdbffff, 0xff0000,
  0xff0049, 0xff00b6, 0xff00ff, 0xff2400, 0xff2449, 0xff24b6, 0xff24ff, 0xff4900, 0xff4949,
  0xff49b6, 0xff49ff, 0xff6d00, 0xff6d49, 0xff6db6, 0xff6dff, 0xff9200, 0xff9249, 0xff92b6,
  0xff92ff, 0xffb600, 0xffb649, 0xffb6b6, 0xffb6ff, 0xffdb00, 0xffdb49, 0xffdbb6, 0xffdbff,
  0xffff00, 0xffff49, 0xffffb6, 0xffffff
];
