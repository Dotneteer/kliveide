import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class PaletteDevice implements IGenericDevice<IZxNextMachine> {
  ulaFirst: number[] = [];
  ulaSecond: number[] = [];
  layer2First: number[] = [];
  layer2Second: number[] = [];
  spriteFirst: number[] = [];
  spriteSecond: number[] = [];
  tilemapFirst: number[] = [];
  tilemapSecond: number[] = [];

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    for (let i = 0; i < 256; i++) {
      let color = (i << 1) | (i & 2 ? 1 : 0);

      // --- The Layer 2 and sprite palettes follow a strange pattern.
      // --- They set Bit 0 as the initial Bit 1.
      // --- It does not follow the logic of mixing bit 0 and bit 1 used in register 41H.
      this.layer2First[i] = this.layer2Second[i] = color;
      this.spriteFirst[i] = this.spriteSecond[i] = color;
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
}
