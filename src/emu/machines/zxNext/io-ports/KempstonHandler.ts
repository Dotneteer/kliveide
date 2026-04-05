import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readKempstonMouseXPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.mouseDevice.readPortFbdf();
}

export function readKempstonMouseYPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.mouseDevice.readPortFfdf();
}

export function readKempstonMouseWheelPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.mouseDevice.readPortFadf();
}

export function readKempstonJoy1Port(machine: IZxNextMachine): (port: number) => number {
  return () => machine.joystickDevice.readPort1f();
}

export function readKempstonJoy1AliasPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.joystickDevice.readPort1f();
}

export function readKempstonJoy2Port(machine: IZxNextMachine): (port: number) => number {
  return () => machine.joystickDevice.readPort37();
}

