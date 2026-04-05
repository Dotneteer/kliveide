import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readKempstonMouseXPort(ulaPort: number): number {
  // TODO: Implement this
  return 0xff;
}

export function readKempstonMouseYPort(ulaPort: number): number {
  // TODO: Implement this
  return 0xff;
}

export function readKempstonMouseWheelPort(ulaPort: number): number {
  // TODO: Implement this
  return 0xff;
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

