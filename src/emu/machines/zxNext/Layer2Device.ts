import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export enum Layer2Resolution {
  R256x192x8 = 0,
  R320x256x8 = 1,
  R640x256x4 = 2
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
  resolution: Layer2Resolution;

  scrollXLsb: number;
  scrollXMsb: number;
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
    this.scrollXLsb = 0;
    this.scrollXMsb = 0;
    this.scrollY = 0;

    this.clipWindowX1 = 0;
    this.clipWindowX2 = 255;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 191;
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
}
