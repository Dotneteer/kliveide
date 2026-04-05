import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readI2cSdaPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.i2cDevice.readSdaPort();
}

export function writeI2cSdaPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.i2cDevice.writeSdaPort(value);
}
