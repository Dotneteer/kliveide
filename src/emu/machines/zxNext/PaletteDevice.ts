import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

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
  layer2First: number[] = [];
  layer2Second: number[] = [];
  spriteFirst: number[] = [];
  spriteSecond: number[] = [];
  tilemapFirst: number[] = [];
  tilemapSecond: number[] = [];
  storedPaletteValue: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.hardReset();
  }

  /**
   * Soft reset: the palette registers only. zxnext.vhd ~4977-4989 clears the index, the $44 byte
   * pending flag, $43 and the stored first byte; the palette RAMs (dpram2, no reset port) keep their
   * contents.
   */
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
  }

  /**
   * Hard reset: the registers, and the palette contents the firmware leaves after power-on (the FPGA
   * palette RAM has no reset contents of its own).
   */
  hardReset(): void {
    this.reset();
    for (let i = 0; i < 256; i++) {
      let color = (i << 1) | (i & 2 ? 1 : 0);

      // --- The Layer 2 and sprite palettes follow a strange pattern.
      // --- They set Bit 0 as the initial Bit 1.
      // --- It does not follow the logic of mixing bit 0 and bit 1 used in register 41H.
      this.layer2First[i] = this.layer2Second[i] = color;
      this.spriteFirst[i] = this.spriteSecond[i] = color;
      this.tilemapFirst[i] = this.tilemapSecond[i] = color;
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
    return (this.getCurrentPalette()[this._paletteIndex] >> 1) & 0xff;
  }

  set nextReg41Value(value: number) {
    const regValue = (value << 1) | (value & 0x03 ? 1 : 0);
    this.getCurrentPalette()[this._paletteIndex] = regValue;
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
    return ((value & 0x200) !== 0 ? 0x80 : 0) | ((value & 0x400) !== 0 ? 0x40 : 0) | (value & 0x01);
  }

  /**
   * zxnext.vhd ~4896-4898, ~5374-5380: the first byte is only stored ($28); the second writes the
   * entry - colour = stored byte & bit 0, and bits 7-6 into the word's priority bits (0x200 / 0x400
   * here; only Layer 2 displays bit 7, $44 reads both back) - then moves the index on.
   */
  set nextReg44Value(value: number) {
    if (!this._secondWrite) {
      this.storedPaletteValue = value & 0xff;
    } else {
      this.getCurrentPalette()[this._paletteIndex] =
        (this.storedPaletteValue << 1) |
        (value & 0x01) |
        ((value & 0x80) !== 0 ? 0x200 : 0) |
        ((value & 0x40) !== 0 ? 0x400 : 0);
      if (!this._disablePaletteWriteAutoInc) {
        this._paletteIndex = (this._paletteIndex + 1) & 0xff;
      }
      this.updateUlaPalette();
    }
    this._secondWrite = !this._secondWrite;
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

  /*
   * The colour getters return RAM word bits 8-0 (zxnext.vhd ~6933, ~6948, ~6997): the priority bits of
   * a $44 write are not part of a ULA, LoRes, tilemap or sprite colour, nor of the $14 compare.
   */

  getUlaRgb333(index: number): number {
    return (this._secondUlaPalette ? this.ulaSecond : this.ulaFirst)[index & 0xff] & 0x1ff;
  }

  /** The 9-bit colour with the Layer 2 priority bit (0x200, zxnext.vhd ~6985 `layer2_prgb_1`). */
  getLayer2Rgb333(index: number): number {
    return (this._secondLayer2Palette ? this.layer2Second : this.layer2First)[index & 0xff] & 0x3ff;
  }

  getSpriteRgb333(index: number): number {
    return (this._secondSpritePalette ? this.spriteSecond : this.spriteFirst)[index & 0xff] & 0x1ff;
  }

  getTilemapRgb333(index: number): number {
    return (this._secondTilemapPalette ? this.tilemapSecond : this.tilemapFirst)[index & 0xff] & 0x1ff;
  }

  /** The 9-bit tilemap colour (kept for callers that name the entry; same as `getTilemapRgb333`). */
  getTilemapPaletteEntry(index: number): number {
    return this.getTilemapRgb333(index);
  }

  /**
   * Called after every palette write ($41, $44) and palette control change ($43).
   *
   * The border has no palette entries of its own: border colour n is drawn with ULA entry 16+n
   * (128+n with ULANext, 200+n with ULA+; zxula.vhd), and the screen device caches that colour. A write
   * to one of those entries must refresh the cache, or the border keeps the old colour - which is what
   * happened when only a $43 palette switch refreshed it. Refreshing costs one palette lookup.
   */
  private updateUlaPalette(): void {
    this.machine.composedScreenDevice?.updateBorderRgbCache();
  }

}

