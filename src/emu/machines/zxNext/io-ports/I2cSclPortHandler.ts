import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readI2cSclPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.i2cDevice.readSclPort();
}

export function writeI2cSclPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.i2cDevice.writeSclPort(value);
}
