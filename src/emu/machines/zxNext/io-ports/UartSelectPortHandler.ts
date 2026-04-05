import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readUartSelectPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.uartDevice.readSelectPort();
}

export function writeUartSelectPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.uartDevice.writeSelectPort(value);
}
