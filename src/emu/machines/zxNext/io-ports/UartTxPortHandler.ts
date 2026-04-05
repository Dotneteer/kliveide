import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readUartTxPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.uartDevice.readTxPort();
}

export function writeUartTxPort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.uartDevice.writeTxPort(value);
}
