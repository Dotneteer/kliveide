import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readKempstonMouseXPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.nextRegDevice.isMouseEnabled() ? machine.mouseDevice.readPortFbdf() : 0xff;
}

export function readKempstonMouseYPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.nextRegDevice.isMouseEnabled() ? machine.mouseDevice.readPortFfdf() : 0xff;
}

export function readKempstonMouseWheelPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.nextRegDevice.isMouseEnabled() ? machine.mouseDevice.readPortFadf() : 0xff;
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

