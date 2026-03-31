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

export function readKempstonJoy1Port(ulaPort: number, machine: IZxNextMachine): number {
  return machine.joystickDevice.joy1State & 0xff;
}

export function readKempstonJoy1AliasPort(ulaPort: number, machine: IZxNextMachine): number {
  return machine.joystickDevice.joy1State & 0xff;
}

export function readKempstonJoy2Port(ulaPort: number, machine: IZxNextMachine): number {
  return machine.joystickDevice.joy2State & 0xff;
}

