import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readUartRxPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.uartDevice.readRxPort();
}

export function writeUartRxPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.uartDevice.writeRxPort(value);
}
