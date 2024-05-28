import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class Layer2Device implements IGenericDevice<IZxNextMachine> {
  enable: boolean;
  resolution: number;
  lastPortValue: number;
  layer2SecondByte: number;
  activeRamBank: number;
  shadowRamBank: number;
  clipIndex: number;
  clipWindowX1: number;
  clipWindowX2: number;
  clipWindowY1: number;
  clipWindowY2: number;
  scrollX: number;
  scrollY: number;
  useSecondPalette: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.lastPortValue = 0x00;
    this.layer2SecondByte = 0x00;
    this.activeRamBank = 0x08;
    this.shadowRamBank = 0x11;
    this.clipIndex = 0;
    this.clipWindowX1 = 0;
    this.clipWindowX2 = 0xff;
    this.clipWindowY1 = 0;
    this.clipWindowY2 = 0xbf;

  }

  dispose(): void {}
}
