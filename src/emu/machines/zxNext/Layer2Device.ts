import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

export enum Layer2Resolution {
  R256x192x8 = 0,
  R320x256x8 = 1,
  R640x256x4 = 2,
  OTHER = 3
}

export class Layer2Device implements IGenericDevice<IZxNextMachine> {
  bank: number;
  bankOffset: number;
  useShadowScreen: boolean;
  enableMappingForReads: boolean;
  visible: boolean;
  enableMappingForWrites: boolean;

  activeRamBank: number;
  shadowRamBank: number;
  transparencyColor: number;
  resolution: Layer2Resolution;
  paletteOffset: number;

  scrollX: number;
  scrollY: number;

  clipWindowX1: number;
  clipWindowX2: number;
  clipWindowY1: number;
  clipWindowY2: number;
  clipIndex: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.bank = 0x00;
    this.bankOffset = 0;
    this.useShadowScreen = false;
    this.enableMappingForReads = false;
    this.visible = false;
    this.enableMappingForWrites = false;

    this.activeRamBank = 8;
    this.shadowRamBank = 11;
    this.resolution = Layer2Resolution.R256x192x8;
    this.paletteOffset = 0;
    this.scrollX = 0;
    this.scrollY = 0;

    this.clipWindowX1 = 0;
    this.clipWindowX2 = 159;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 255;
    this.clipIndex = 0;
  }

  dispose(): void {}

  /**
   * Gets the value of the 0x123b port
   */
  get port123bValue(): number {
    return (
      (this.bank << 6) |
      (this.useShadowScreen ? 0x08 : 0x00) |
      (this.enableMappingForReads ? 0x04 : 0x00) |
      (this.visible ? 0x02 : 0x00) |
      (this.enableMappingForWrites ? 0x01 : 0x00)
    );
  }

  /**
   * Updates the memory configuration based on the new 0x123b port value
   */
  set port123bValue(value: number) {
    this.bank = (value & 0xc0) >> 6;
    this.useShadowScreen = (value & 0x08) !== 0;
    this.enableMappingForReads = (value & 0x04) !== 0;
    this.visible = (value & 0x02) !== 0;
    this.enableMappingForWrites = (value & 0x01) !== 0;
  }

  /**
   * Gets the clip window coordinate according to the current clip index
   */
  get nextReg18Value(): number {
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
  set nextReg18Value(value: number) {
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

  /**
   * Gets the value of Reg 0x70
   */
  get nextReg70Value(): number {
    return (this.resolution << 4) | this.paletteOffset;
  }

  /**
   * Sets the value of Reg 0x70
   */
  set nextReg70Value(value: number) {
    this.resolution = (value & 0x30) >> 4;
    this.paletteOffset = value & 0x0f;
  }
}
