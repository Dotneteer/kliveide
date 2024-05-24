import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class Layer2Device implements IGenericDevice<IZxNextMachine> {
  lastPortValue = 0x00;
  layer2SecondByte = 0x00; 
  activeRamBank = 0x00;
  shadowRamBank = 0x00;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.lastPortValue = 0x00;
    this.layer2SecondByte = 0x00;
    this.activeRamBank = 0x08;  
    this.shadowRamBank = 0x11;
  }

  dispose(): void {}
}
