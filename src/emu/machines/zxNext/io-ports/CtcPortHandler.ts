import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readCtcPort(machine: IZxNextMachine): (port: number) => number {
  return (port: number) => machine.ctcDevice.readPort(port);
}

export function writeCtcPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (port: number, value: number) => machine.ctcDevice.writePort(port, value);
}
