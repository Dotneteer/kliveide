import type { NextMachine } from "../core/machines";

/*
 * The two joystick connectors, as md6_joystick_connector_x2.vhd reports them to the core: 12 bits,
 * active high, MODE X Z Y START A C B U D L R. B is fire 1 (pin 6), C fire 2 (pin 9); A, START and
 * X Y Z MODE exist on MD (Mega Drive) 3/6-button pads only.
 */

export const JOY_BUTTONS = ["RIGHT", "LEFT", "DOWN", "UP", "B", "C", "A", "START", "Y", "Z", "X", "MODE"] as const;
export type JoyButton = (typeof JOY_BUTTONS)[number];
export type JoySide = "left" | "right";

export function joyBits(buttons: JoyButton[]): number {
  let bits = 0;
  for (const b of buttons) {
    const i = JOY_BUTTONS.indexOf(b);
    if (i < 0) throw new Error(`Unknown joystick button '${b}'`);
    bits |= 1 << i;
  }
  return bits;
}

export function setJoystickState(machine: NextMachine, side: JoySide, bits: number): void {
  const x = machine.wasmV2Runtime!.exports;
  if (side === "left") x.zxnextSetJoystickLeftState(bits);
  else x.zxnextSetJoystickRightState(bits);
}
