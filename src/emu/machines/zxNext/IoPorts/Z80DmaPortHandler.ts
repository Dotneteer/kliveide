import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readZ80DmaPort(machine: IZxNextMachine, ulaPort: number): number {
  // TODO: Implement this
  return 0xff;
}

export function writeZ80DmaPort(machine: IZxNextMachine, value: number): void {
  // TODO: Implement this
}
