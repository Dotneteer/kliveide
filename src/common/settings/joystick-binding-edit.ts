import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";

import {
  DEFAULT_JOYSTICK_BINDINGS,
  JOYSTICK_BUTTONS,
  type JoystickBindings,
  type JoystickButton,
  type JoystickSide
} from "./joystick-bindings";

/**
 * The editing rules behind the bindings dialog.
 *
 * Pure functions on purpose: these are the decisions worth testing, and none of them needs React.
 * The dialog itself is then a form with no logic in it, which is why it stays on the plain dialog
 * pattern rather than the MVC one - there is no async orchestration here to isolate.
 */

/**
 * Bind a host key to a pin.
 *
 * A key already used by another pin **on the same connector** is taken from it. One key pressing
 * two pins of one stick is never what someone means - it would be an obscure way to hold two
 * directions - and silently leaving the old binding in place is how a dialog ends up disagreeing
 * with the emulator. Across the two connectors the same key is left alone: driving a pin on each is
 * unusual but coherent, and a two-player setup that shares a fire button is a real thing.
 */
export function assignKey(
  bindings: JoystickBindings,
  side: JoystickSide,
  button: JoystickButton,
  code: string
): JoystickBindings {
  const keys = { ...bindings[side].keys };
  for (const other of JOYSTICK_BUTTONS) {
    if (other !== button && keys[other] === code) delete keys[other];
  }
  keys[button] = code;
  return { ...bindings, [side]: { ...bindings[side], keys } };
}

/** Unbind a pin. It simply stops being pressed; the connector keeps working. */
export function clearKey(
  bindings: JoystickBindings,
  side: JoystickSide,
  button: JoystickButton
): JoystickBindings {
  const keys = { ...bindings[side].keys };
  delete keys[button];
  return { ...bindings, [side]: { ...bindings[side], keys } };
}

/** Put one connector back to the shipped bindings, leaving the other alone. */
export function resetSide(bindings: JoystickBindings, side: JoystickSide): JoystickBindings {
  return {
    ...bindings,
    [side]: {
      ...bindings[side],
      keys: { ...DEFAULT_JOYSTICK_BINDINGS[side].keys }
    }
  };
}

/**
 * The machine keys a host key would stop producing if it were bound to a joystick pin.
 *
 * Binding is not additive: `useEmulatorKeyboard` skips a claimed code entirely, so binding
 * `ArrowUp` takes the machine's cursor-up with it. That is the right behaviour and a surprising
 * one, so the dialog says which keys are being given up rather than letting the user find out in a
 * BASIC listing. Empty means the key was doing nothing for the machine anyway.
 */
export function machineKeysTakenBy(code: string): string[] {
  const mapping = spectrumKeyMappings[code];
  if (!mapping) return [];
  return typeof mapping === "string" ? [mapping] : [...mapping];
}

/**
 * The pins on *other* connectors already using this key.
 *
 * Not an error - see `assignKey` - but worth showing, because a shared key is far more often a slip
 * than a deliberate two-player arrangement.
 */
export function sharedWith(
  bindings: JoystickBindings,
  side: JoystickSide,
  code: string
): { side: JoystickSide; button: JoystickButton }[] {
  const found: { side: JoystickSide; button: JoystickButton }[] = [];
  for (const other of ["left", "right"] as JoystickSide[]) {
    if (other === side) continue;
    for (const button of JOYSTICK_BUTTONS) {
      if (bindings[other].keys[button] === code) found.push({ side: other, button });
    }
  }
  return found;
}

/**
 * A host key code as a person would recognise it.
 *
 * `KeyboardEvent.code` is a physical-position name, so `KeyD` is the D key and `ArrowUp` is the up
 * arrow; stripping the prefixes gets most of the way there, and the rest read well enough as they
 * are.
 */
export function describeKeyCode(code: string | undefined): string {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return `${code.slice(5)} arrow`;
  if (code.startsWith("Numpad")) return `Numpad ${code.slice(6) || "·"}`;
  return code.replace(/([a-z])([A-Z])/g, "$1 $2");
}
