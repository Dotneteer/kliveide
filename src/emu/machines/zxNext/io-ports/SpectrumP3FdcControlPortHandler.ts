import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readSpectrumP3FdcControlPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.floppyDevice.readDataRegister();
}

export function writeSpectrumP3FdcControlPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.floppyDevice.writeDataRegister(value);
}
