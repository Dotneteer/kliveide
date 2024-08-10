import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class TilemapDevice implements IGenericDevice<IZxNextMachine> {
  enableTilemap: boolean;
  clipWindowX1: number;
  clipWindowX2: number;
  clipWindowY1: number;
  clipWindowY2: number;
  clipIndex: number;
  scrollX: number;
  scrollY: number;
  transparencyIndex: number;
  mode80x32: boolean;
  eliminateAttribute: boolean;
  paletteSelect: boolean;
  selectTextMode: boolean;
  activate512TileMode: boolean;
  forceTilemapOnTop: boolean;
  paletteOffset: number;
  mirrorX: boolean;
  mirrorY: boolean;
  rotate: boolean;
  ulaOverTilemap: boolean;
  baseAddressUseBank7: boolean;
  baseAddressMsb: number;
  definitionAddressUseBank7: boolean;
  definitionAddressMsb: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.enableTilemap = false;
    this.clipIndex = 0;
    this.clipWindowX1 = 0;
    this.clipWindowX2 = 159;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 255;
    this.scrollX = 0;
    this.scrollY = 0;
    this.transparencyIndex = 0x0f;
    this.mode80x32 = false;
    this.eliminateAttribute = false;
    this.paletteSelect = false;
    this.selectTextMode = false;
    this.activate512TileMode = false;
    this.forceTilemapOnTop = false;
    this.paletteOffset = 0;
    this.mirrorX = false;
    this.mirrorY = false;
    this.rotate = false;
    this.ulaOverTilemap = false;
    this.baseAddressUseBank7 = false;
    this.baseAddressMsb = 0;
    this.definitionAddressUseBank7 = false;
    this.definitionAddressMsb = 0;
  }

  dispose(): void {}

  /**
   * Gets the clip window coordinate according to the current clip index
   */
  get nextReg1bValue(): number {
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
  set nextReg1bValue(value: number) {
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

  get nextReg6bValue(): number {
    return (
      (this.enableTilemap ? 0x80 : 0) |
      (this.mode80x32 ? 0x40 : 0) |
      (this.eliminateAttribute ? 0x20 : 0) |
      (this.paletteSelect ? 0x10 : 0) |
      (this.selectTextMode ? 0x08 : 0) |
      (this.activate512TileMode ? 0x02 : 0) |
      (this.forceTilemapOnTop ? 0x01 : 0)
    );
  }

  set nextReg6bValue(value: number) {
    this.enableTilemap = (value & 0x80) !== 0;
    this.mode80x32 = (value & 0x40) !== 0;
    this.eliminateAttribute = (value & 0x20) !== 0;
    this.paletteSelect = (value & 0x10) !== 0;
    this.selectTextMode = (value & 0x08) !== 0;
    this.activate512TileMode = (value & 0x02) !== 0;
    this.forceTilemapOnTop = (value & 0x01) !== 0;
  }

  get nextReg6cValue(): number {
    return (
      (this.paletteOffset << 4) |
      (this.mirrorX ? 0x08 : 0) |
      (this.mirrorY ? 0x04 : 0) |
      (this.rotate ? 0x02 : 0) |
      (this.ulaOverTilemap ? 0x01 : 0)
    );
  }

  set nextReg6cValue(value: number) {
    this.paletteOffset = (value & 0xf0) >> 4;
    this.mirrorX = (value & 0x08) !== 0;
    this.mirrorY = (value & 0x04) !== 0;
    this.rotate = (value & 0x02) !== 0;
    this.ulaOverTilemap = (value & 0x01) !== 0;
  }

  get nextReg6eValue(): number {
    return (this.baseAddressUseBank7 ? 0x80 : 0) | this.baseAddressMsb;
  }

  set nextReg6eValue(value: number) {
    this.baseAddressUseBank7 = (value & 0x80) !== 0;
    this.baseAddressMsb = value & 0x01f;
  }

  get nextReg6fValue(): number {
    return (this.definitionAddressUseBank7 ? 0x80 : 0) | this.definitionAddressMsb;
  }

  set nextReg6fValue(value: number) {
    this.definitionAddressUseBank7 = (value & 0x80) !== 0;
    this.definitionAddressMsb = value & 0x01f;
  }
}
