import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readUartFramePort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.uartDevice.readFramePort();
}

export function writeUartFramePort(machine: IZxNextMachine): (port: number, value: number) => void {
  return (_, value) => machine.uartDevice.writeFramePort(value);
}
