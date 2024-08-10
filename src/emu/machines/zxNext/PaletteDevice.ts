import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export const TBBLUE_DEF_TRANSPARENT_COLOR = 0xe3;

export class PaletteDevice implements IGenericDevice<IZxNextMachine> {
  private _paletteIndex: number;
  private _disablePaletteWriteAutoInc: boolean;
  private _selectedPalette: number;
  private _secondSpritePalette: boolean;
  private _secondLayer2Palette: boolean;
  private _secondUlaPalette: boolean;
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
  ulaNextByteFormat: number;
  storedPaletteValue: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._paletteIndex = 0;
    this._secondWrite = false;
    this.storedPaletteValue = 0;
    for (let i = 0; i < 256; i++) {
      let color = (i << 1) | (i & 2 ? 1 : 0);

      // --- The Layer 2 and sprite palettes follow a strange pattern.
      // --- They set Bit 0 as the initial Bit 1.
      // --- It does not follow the logic of mixing bit 0 and bit 1 used in register 41H.
      this.layer2First[i] = this.layer2Second[i] = color;
      this.spriteFirst[i] = this.spriteSecond[i] = color;
      this.tilemapFirst[i] = this.tilemapSecond[i] = color;
    }

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

    // --- The ULA palette is a bit more complex, it repeats every 16 colors
    // --- Bright magenta is a transparent color by default (1C7H and 1C6H / 2 = E3H)
    // --- Let's change it to 1CF, which is a color FF24FFH. It is not pure magenta,
    // --- but avoids the default transparent problem.
    // --- This is also corrected by NextOS when starting, but if we start TbBlue in
    // --- fast-boot mode, the bright magenta would be transparent.
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < 16; i++) {
        this.ulaFirst[j * 16 + i] = this.ulaSecond[j * 16 + i] =
          i !== 11 ? defaultUlaColors[i] : 0x1cf;
      }
    }
  }

  dispose(): void {}

  get nextReg40Value(): number {
    return this._paletteIndex;
  }

  set nextReg40Value(value: number) {
    this._paletteIndex = value & 0xff;
    this._secondWrite = false;
  }

  get nextReg41Value(): number {
    return this.getCurrentPalette()[this._paletteIndex];
  }

  set nextReg41Value(value: number) {
    this.storedPaletteValue = value & 0xff;
    this.getCurrentPalette()[this._paletteIndex] = value << 1;
    if (!this._disablePaletteWriteAutoInc) {
      this._paletteIndex = (this._paletteIndex + 1) & 0xff;
    }
    this._secondWrite = false;
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
    this._secondUlaPalette = (value & 0x02) !== 0;
    this._enableUlaNextMode = (value & 0x01) !== 0;
    this._secondWrite = false;
  }

  get nextReg44Value(): number {
    const value = this.getCurrentPalette()[this._paletteIndex];
    return ((value & 0x300) >> 2) | (value & 0x01);
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
      if (!this._disablePaletteWriteAutoInc) {
        this._paletteIndex = (this._paletteIndex + 1) & 0xff;
      }
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
}

export const zxNext9BitColors: string[] = [
  "#000000",
  "#000024",
  "#000049",
  "#00006D",
  "#000092",
  "#0000B6",
  "#0000DB",
  "#0000FF",
  "#002400",
  "#002424",
  "#002449",
  "#00246D",
  "#002492",
  "#0024B6",
  "#0024DB",
  "#0024FF",
  "#004900",
  "#004924",
  "#004949",
  "#00496D",
  "#004992",
  "#0049B6",
  "#0049DB",
  "#0049FF",
  "#006D00",
  "#006D24",
  "#006D49",
  "#006D6D",
  "#006D92",
  "#006DB6",
  "#006DDB",
  "#006DFF",
  "#009200",
  "#009224",
  "#009249",
  "#00926D",
  "#009292",
  "#0092B6",
  "#0092DB",
  "#0092FF",
  "#00B600",
  "#00B624",
  "#00B649",
  "#00B66D",
  "#00B692",
  "#00B6B6",
  "#00B6DB",
  "#00B6FF",
  "#00DB00",
  "#00DB24",
  "#00DB49",
  "#00DB6D",
  "#00DB92",
  "#00DBB6",
  "#00DBDB",
  "#00DBFF",
  "#00FF00",
  "#00FF24",
  "#00FF49",
  "#00FF6D",
  "#00FF92",
  "#00FFB6",
  "#00FFDB",
  "#00FFFF",
  "#240000",
  "#240024",
  "#240049",
  "#24006D",
  "#240092",
  "#2400B6",
  "#2400DB",
  "#2400FF",
  "#242400",
  "#242424",
  "#242449",
  "#24246D",
  "#242492",
  "#2424B6",
  "#2424DB",
  "#2424FF",
  "#244900",
  "#244924",
  "#244949",
  "#24496D",
  "#244992",
  "#2449B6",
  "#2449DB",
  "#2449FF",
  "#246D00",
  "#246D24",
  "#246D49",
  "#246D6D",
  "#246D92",
  "#246DB6",
  "#246DDB",
  "#246DFF",
  "#249200",
  "#249224",
  "#249249",
  "#24926D",
  "#249292",
  "#2492B6",
  "#2492DB",
  "#2492FF",
  "#24B600",
  "#24B624",
  "#24B649",
  "#24B66D",
  "#24B692",
  "#24B6B6",
  "#24B6DB",
  "#24B6FF",
  "#24DB00",
  "#24DB24",
  "#24DB49",
  "#24DB6D",
  "#24DB92",
  "#24DBB6",
  "#24DBDB",
  "#24DBFF",
  "#24FF00",
  "#24FF24",
  "#24FF49",
  "#24FF6D",
  "#24FF92",
  "#24FFB6",
  "#24FFDB",
  "#24FFFF",
  "#490000",
  "#490024",
  "#490049",
  "#49006D",
  "#490092",
  "#4900B6",
  "#4900DB",
  "#4900FF",
  "#492400",
  "#492424",
  "#492449",
  "#49246D",
  "#492492",
  "#4924B6",
  "#4924DB",
  "#4924FF",
  "#494900",
  "#494924",
  "#494949",
  "#49496D",
  "#494992",
  "#4949B6",
  "#4949DB",
  "#4949FF",
  "#496D00",
  "#496D24",
  "#496D49",
  "#496D6D",
  "#496D92",
  "#496DB6",
  "#496DDB",
  "#496DFF",
  "#499200",
  "#499224",
  "#499249",
  "#49926D",
  "#499292",
  "#4992B6",
  "#4992DB",
  "#4992FF",
  "#49B600",
  "#49B624",
  "#49B649",
  "#49B66D",
  "#49B692",
  "#49B6B6",
  "#49B6DB",
  "#49B6FF",
  "#49DB00",
  "#49DB24",
  "#49DB49",
  "#49DB6D",
  "#49DB92",
  "#49DBB6",
  "#49DBDB",
  "#49DBFF",
  "#49FF00",
  "#49FF24",
  "#49FF49",
  "#49FF6D",
  "#49FF92",
  "#49FFB6",
  "#49FFDB",
  "#49FFFF",
  "#6D0000",
  "#6D0024",
  "#6D0049",
  "#6D006D",
  "#6D0092",
  "#6D00B6",
  "#6D00DB",
  "#6D00FF",
  "#6D2400",
  "#6D2424",
  "#6D2449",
  "#6D246D",
  "#6D2492",
  "#6D24B6",
  "#6D24DB",
  "#6D24FF",
  "#6D4900",
  "#6D4924",
  "#6D4949",
  "#6D496D",
  "#6D4992",
  "#6D49B6",
  "#6D49DB",
  "#6D49FF",
  "#6D6D00",
  "#6D6D24",
  "#6D6D49",
  "#6D6D6D",
  "#6D6D92",
  "#6D6DB6",
  "#6D6DDB",
  "#6D6DFF",
  "#6D9200",
  "#6D9224",
  "#6D9249",
  "#6D926D",
  "#6D9292",
  "#6D92B6",
  "#6D92DB",
  "#6D92FF",
  "#6DB600",
  "#6DB624",
  "#6DB649",
  "#6DB66D",
  "#6DB692",
  "#6DB6B6",
  "#6DB6DB",
  "#6DB6FF",
  "#6DDB00",
  "#6DDB24",
  "#6DDB49",
  "#6DDB6D",
  "#6DDB92",
  "#6DDBB6",
  "#6DDBDB",
  "#6DDBFF",
  "#6DFF00",
  "#6DFF24",
  "#6DFF49",
  "#6DFF6D",
  "#6DFF92",
  "#6DFFB6",
  "#6DFFDB",
  "#6DFFFF",
  "#920000",
  "#920024",
  "#920049",
  "#92006D",
  "#920092",
  "#9200B6",
  "#9200DB",
  "#9200FF",
  "#922400",
  "#922424",
  "#922449",
  "#92246D",
  "#922492",
  "#9224B6",
  "#9224DB",
  "#9224FF",
  "#924900",
  "#924924",
  "#924949",
  "#92496D",
  "#924992",
  "#9249B6",
  "#9249DB",
  "#9249FF",
  "#926D00",
  "#926D24",
  "#926D49",
  "#926D6D",
  "#926D92",
  "#926DB6",
  "#926DDB",
  "#926DFF",
  "#929200",
  "#929224",
  "#929249",
  "#92926D",
  "#929292",
  "#9292B6",
  "#9292DB",
  "#9292FF",
  "#92B600",
  "#92B624",
  "#92B649",
  "#92B66D",
  "#92B692",
  "#92B6B6",
  "#92B6DB",
  "#92B6FF",
  "#92DB00",
  "#92DB24",
  "#92DB49",
  "#92DB6D",
  "#92DB92",
  "#92DBB6",
  "#92DBDB",
  "#92DBFF",
  "#92FF00",
  "#92FF24",
  "#92FF49",
  "#92FF6D",
  "#92FF92",
  "#92FFB6",
  "#92FFDB",
  "#92FFFF",
  "#B60000",
  "#B60024",
  "#B60049",
  "#B6006D",
  "#B60092",
  "#B600B6",
  "#B600DB",
  "#B600FF",
  "#B62400",
  "#B62424",
  "#B62449",
  "#B6246D",
  "#B62492",
  "#B624B6",
  "#B624DB",
  "#B624FF",
  "#B64900",
  "#B64924",
  "#B64949",
  "#B6496D",
  "#B64992",
  "#B649B6",
  "#B649DB",
  "#B649FF",
  "#B66D00",
  "#B66D24",
  "#B66D49",
  "#B66D6D",
  "#B66D92",
  "#B66DB6",
  "#B66DDB",
  "#B66DFF",
  "#B69200",
  "#B69224",
  "#B69249",
  "#B6926D",
  "#B69292",
  "#B692B6",
  "#B692DB",
  "#B692FF",
  "#B6B600",
  "#B6B624",
  "#B6B649",
  "#B6B66D",
  "#B6B692",
  "#B6B6B6",
  "#B6B6DB",
  "#B6B6FF",
  "#B6DB00",
  "#B6DB24",
  "#B6DB49",
  "#B6DB6D",
  "#B6DB92",
  "#B6DBB6",
  "#B6DBDB",
  "#B6DBFF",
  "#B6FF00",
  "#B6FF24",
  "#B6FF49",
  "#B6FF6D",
  "#B6FF92",
  "#B6FFB6",
  "#B6FFDB",
  "#B6FFFF",
  "#DB0000",
  "#DB0024",
  "#DB0049",
  "#DB006D",
  "#DB0092",
  "#DB00B6",
  "#DB00DB",
  "#DB00FF",
  "#DB2400",
  "#DB2424",
  "#DB2449",
  "#DB246D",
  "#DB2492",
  "#DB24B6",
  "#DB24DB",
  "#DB24FF",
  "#DB4900",
  "#DB4924",
  "#DB4949",
  "#DB496D",
  "#DB4992",
  "#DB49B6",
  "#DB49DB",
  "#DB49FF",
  "#DB6D00",
  "#DB6D24",
  "#DB6D49",
  "#DB6D6D",
  "#DB6D92",
  "#DB6DB6",
  "#DB6DDB",
  "#DB6DFF",
  "#DB9200",
  "#DB9224",
  "#DB9249",
  "#DB926D",
  "#DB9292",
  "#DB92B6",
  "#DB92DB",
  "#DB92FF",
  "#DBB600",
  "#DBB624",
  "#DBB649",
  "#DBB66D",
  "#DBB692",
  "#DBB6B6",
  "#DBB6DB",
  "#DBB6FF",
  "#DBDB00",
  "#DBDB24",
  "#DBDB49",
  "#DBDB6D",
  "#DBDB92",
  "#DBDBB6",
  "#DBDBDB",
  "#DBDBFF",
  "#DBFF00",
  "#DBFF24",
  "#DBFF49",
  "#DBFF6D",
  "#DBFF92",
  "#DBFFB6",
  "#DBFFDB",
  "#DBFFFF",
  "#FF0000",
  "#FF0024",
  "#FF0049",
  "#FF006D",
  "#FF0092",
  "#FF00B6",
  "#FF00DB",
  "#FF00FF",
  "#FF2400",
  "#FF2424",
  "#FF2449",
  "#FF246D",
  "#FF2492",
  "#FF24B6",
  "#FF24DB",
  "#FF24FF",
  "#FF4900",
  "#FF4924",
  "#FF4949",
  "#FF496D",
  "#FF4992",
  "#FF49B6",
  "#FF49DB",
  "#FF49FF",
  "#FF6D00",
  "#FF6D24",
  "#FF6D49",
  "#FF6D6D",
  "#FF6D92",
  "#FF6DB6",
  "#FF6DDB",
  "#FF6DFF",
  "#FF9200",
  "#FF9224",
  "#FF9249",
  "#FF926D",
  "#FF9292",
  "#FF92B6",
  "#FF92DB",
  "#FF92FF",
  "#FFB600",
  "#FFB624",
  "#FFB649",
  "#FFB66D",
  "#FFB692",
  "#FFB6B6",
  "#FFB6DB",
  "#FFB6FF",
  "#FFDB00",
  "#FFDB24",
  "#FFDB49",
  "#FFDB6D",
  "#FFDB92",
  "#FFDBB6",
  "#FFDBDB",
  "#FFDBFF",
  "#FFFF00",
  "#FFFF24",
  "#FFFF49",
  "#FFFF6D",
  "#FFFF92",
  "#FFFFB6",
  "#FFFFDB",
  "#FFFFFF"
];

export const zxNext8BitColors: string[] = [
  "#000000",
  "#000049",
  "#0000B6",
  "#0000FF",
  "#002400",
  "#002449",
  "#0024B6",
  "#0024FF",
  "#004900",
  "#004949",
  "#0049B6",
  "#0049FF",
  "#006D00",
  "#006D49",
  "#006DB6",
  "#006DFF",
  "#009200",
  "#009249",
  "#0092B6",
  "#0092FF",
  "#00B600",
  "#00B649",
  "#00B6B6",
  "#00B6FF",
  "#00DB00",
  "#00DB49",
  "#00DBB6",
  "#00DBFF",
  "#00FF00",
  "#00FF49",
  "#00FFB6",
  "#00FFFF",
  "#240000",
  "#240049",
  "#2400B6",
  "#2400FF",
  "#242400",
  "#242449",
  "#2424B6",
  "#2424FF",
  "#244900",
  "#244949",
  "#2449B6",
  "#2449FF",
  "#246D00",
  "#246D49",
  "#246DB6",
  "#246DFF",
  "#249200",
  "#249249",
  "#2492B6",
  "#2492FF",
  "#24B600",
  "#24B649",
  "#24B6B6",
  "#24B6FF",
  "#24DB00",
  "#24DB49",
  "#24DBB6",
  "#24DBFF",
  "#24FF00",
  "#24FF49",
  "#24FFB6",
  "#24FFFF",
  "#490000",
  "#490049",
  "#4900B6",
  "#4900FF",
  "#492400",
  "#492449",
  "#4924B6",
  "#4924FF",
  "#494900",
  "#494949",
  "#4949B6",
  "#4949FF",
  "#496D00",
  "#496D49",
  "#496DB6",
  "#496DFF",
  "#499200",
  "#499249",
  "#4992B6",
  "#4992FF",
  "#49B600",
  "#49B649",
  "#49B6B6",
  "#49B6FF",
  "#49DB00",
  "#49DB49",
  "#49DBB6",
  "#49DBFF",
  "#49FF00",
  "#49FF49",
  "#49FFB6",
  "#49FFFF",
  "#6D0000",
  "#6D0049",
  "#6D00B6",
  "#6D00FF",
  "#6D2400",
  "#6D2449",
  "#6D24B6",
  "#6D24FF",
  "#6D4900",
  "#6D4949",
  "#6D49B6",
  "#6D49FF",
  "#6D6D00",
  "#6D6D49",
  "#6D6DB6",
  "#6D6DFF",
  "#6D9200",
  "#6D9249",
  "#6D92B6",
  "#6D92FF",
  "#6DB600",
  "#6DB649",
  "#6DB6B6",
  "#6DB6FF",
  "#6DDB00",
  "#6DDB49",
  "#6DDBB6",
  "#6DDBFF",
  "#6DFF00",
  "#6DFF49",
  "#6DFFB6",
  "#6DFFFF",
  "#920000",
  "#920049",
  "#9200B6",
  "#9200FF",
  "#922400",
  "#922449",
  "#9224B6",
  "#9224FF",
  "#924900",
  "#924949",
  "#9249B6",
  "#9249FF",
  "#926D00",
  "#926D49",
  "#926DB6",
  "#926DFF",
  "#929200",
  "#929249",
  "#9292B6",
  "#9292FF",
  "#92B600",
  "#92B649",
  "#92B6B6",
  "#92B6FF",
  "#92DB00",
  "#92DB49",
  "#92DBB6",
  "#92DBFF",
  "#92FF00",
  "#92FF49",
  "#92FFB6",
  "#92FFFF",
  "#B60000",
  "#B60049",
  "#B600B6",
  "#B600FF",
  "#B62400",
  "#B62449",
  "#B624B6",
  "#B624FF",
  "#B64900",
  "#B64949",
  "#B649B6",
  "#B649FF",
  "#B66D00",
  "#B66D49",
  "#B66DB6",
  "#B66DFF",
  "#B69200",
  "#B69249",
  "#B692B6",
  "#B692FF",
  "#B6B600",
  "#B6B649",
  "#B6B6B6",
  "#B6B6FF",
  "#B6DB00",
  "#B6DB49",
  "#B6DBB6",
  "#B6DBFF",
  "#B6FF00",
  "#B6FF49",
  "#B6FFB6",
  "#B6FFFF",
  "#DB0000",
  "#DB0049",
  "#DB00B6",
  "#DB00FF",
  "#DB2400",
  "#DB2449",
  "#DB24B6",
  "#DB24FF",
  "#DB4900",
  "#DB4949",
  "#DB49B6",
  "#DB49FF",
  "#DB6D00",
  "#DB6D49",
  "#DB6DB6",
  "#DB6DFF",
  "#DB9200",
  "#DB9249",
  "#DB92B6",
  "#DB92FF",
  "#DBB600",
  "#DBB649",
  "#DBB6B6",
  "#DBB6FF",
  "#DBDB00",
  "#DBDB49",
  "#DBDBB6",
  "#DBDBFF",
  "#DBFF00",
  "#DBFF49",
  "#DBFFB6",
  "#DBFFFF",
  "#FF0000",
  "#FF0049",
  "#FF00B6",
  "#FF00FF",
  "#FF2400",
  "#FF2449",
  "#FF24B6",
  "#FF24FF",
  "#FF4900",
  "#FF4949",
  "#FF49B6",
  "#FF49FF",
  "#FF6D00",
  "#FF6D49",
  "#FF6DB6",
  "#FF6DFF",
  "#FF9200",
  "#FF9249",
  "#FF92B6",
  "#FF92FF",
  "#FFB600",
  "#FFB649",
  "#FFB6B6",
  "#FFB6FF",
  "#FFDB00",
  "#FFDB49",
  "#FFDBB6",
  "#FFDBFF",
  "#FFFF00",
  "#FFFF49",
  "#FFFFB6",
  "#FFFFFF"
];
