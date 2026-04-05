import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readSpectrumP3FdcStatusPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.floppyDevice.readMainStatusRegister();
}

