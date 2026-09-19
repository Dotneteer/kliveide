import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/** The port manager's "no answer here": another handler of the address (the $DF joystick alias) may answer. */
const NOT_HANDLED = 0x1ff;

/* zxnext.vhd ~2624-2630: with the mouse port off these addresses are plain $DF reads (the joystick alias) */
export function readKempstonMouseXPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.nextRegDevice.isMouseEnabled() ? machine.mouseDevice.readPortFbdf() : NOT_HANDLED;
}

export function readKempstonMouseYPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.nextRegDevice.isMouseEnabled() ? machine.mouseDevice.readPortFfdf() : NOT_HANDLED;
}

export function readKempstonMouseWheelPort(machine: IZxNextMachine): (port: number) => number {
  return () => machine.nextRegDevice.isMouseEnabled() ? machine.mouseDevice.readPortFadf() : NOT_HANDLED;
}

/** zxnext.vhd ~2630: $1F answers only while a joystick is in Kempston 1 / MD 1 mode; else no device ($FF). */
export function readKempstonJoy1Port(machine: IZxNextMachine): (port: number) => number {
  return () => (machine.joystickDevice.port1fDecoded ? machine.joystickDevice.readPort1f() : 0xff);
}

export function readKempstonJoy1AliasPort(machine: IZxNextMachine): (port: number) => number {
  return () => (machine.joystickDevice.port1fDecoded ? machine.joystickDevice.readPort1f() : 0xff);
}

/** zxnext.vhd ~2631: $37 answers only while a joystick is in Kempston 2 / MD 2 mode. */
export function readKempstonJoy2Port(machine: IZxNextMachine): (port: number) => number {
  return () => (machine.joystickDevice.port37Decoded ? machine.joystickDevice.readPort37() : 0xff);
}
