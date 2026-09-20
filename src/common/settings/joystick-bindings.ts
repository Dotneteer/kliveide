/**
 * THE registry of the ZX Spectrum Next joystick bindings, a sibling of `mouse-capture.ts`.
 *
 * A binding maps one of the connector's twelve pins to a host key. That is the whole model, and it
 * is deliberately the *only* model: the host sets pins, and NextReg `$05` decides inside the core
 * whether those pins reach a Kempston port, the MD registers, or the keyboard matrix through the
 * joymap. So one table serves every joystick mode, and it keeps working when a program changes
 * `$05` mid-game. Nothing here knows or cares which mode is selected.
 */

/**
 * The connector's pins, in bit order. Matches `IZxNextHostInputMachine`'s `JOY_*` constants and the
 * order `md6_joystick_connector_x2.vhd` reports: MODE X Z Y START A C B U D L R.
 */
export const JOYSTICK_BUTTONS = [
  "RIGHT",
  "LEFT",
  "DOWN",
  "UP",
  "B",
  "C",
  "A",
  "START",
  "Y",
  "Z",
  "X",
  "MODE"
] as const;

export type JoystickButton = (typeof JOYSTICK_BUTTONS)[number];

/** What a pin is called in the UI. `B` and `C` are pins 6 and 9 - fire 1 and fire 2. */
export const JOYSTICK_BUTTON_LABELS: Record<JoystickButton, string> = {
  RIGHT: "Right",
  LEFT: "Left",
  DOWN: "Down",
  UP: "Up",
  B: "Fire 1 (B)",
  C: "Fire 2 (C)",
  A: "A (MD)",
  START: "Start (MD)",
  Y: "Y (MD 6-button)",
  Z: "Z (MD 6-button)",
  X: "X (MD 6-button)",
  MODE: "Mode (MD 6-button)"
};

/** The bit a pin occupies in the 12-bit connector word. */
export function joystickButtonBit(button: JoystickButton): number {
  return 1 << JOYSTICK_BUTTONS.indexOf(button);
}

/** Which connector: `left` is joystick 1 in NextReg `$05`, `right` is joystick 2. */
export type JoystickSide = "left" | "right";
export const JOYSTICK_SIDES: JoystickSide[] = ["left", "right"];

export const JOYSTICK_SIDE_LABELS: Record<JoystickSide, string> = {
  left: "Joystick 1 (left)",
  right: "Joystick 2 (right)"
};

/** Where a connector's pins come from. */
export type JoystickSource = "off" | "keyboard" | "gamepad";

export const JOYSTICK_SOURCES: { label: string; value: JoystickSource }[] = [
  { label: "Not connected", value: "off" },
  { label: "Host keyboard", value: "keyboard" },
  { label: "Host gamepad", value: "gamepad" }
];

export type JoystickSideBindings = {
  source: JoystickSource;
  /** Pin to `KeyboardEvent.code`. A pin with no entry is simply never pressed. */
  keys: Partial<Record<JoystickButton, string>>;
  /** Which pad drives this connector when the source is a gamepad. */
  padIndex: number;
};

export type JoystickBindings = Record<JoystickSide, JoystickSideBindings>;

/**
 * Joystick 1 on the arrow cluster, joystick 2 on WASD but not connected until asked for.
 *
 * Only joystick 1 is live out of the box: every binding takes its host key *away* from the emulated
 * keyboard (see the arbitration in `useEmulatorKeyboard`), and silently stealing WASD from someone
 * typing into a BASIC listing would be a poor welcome. The keys are there so switching the source
 * on is all it takes.
 *
 * The MD-only pins are unbound by default - a 3-button pad has no X, Y, Z or MODE, and the bindings
 * dialog is where someone who wants them says so.
 */
export const DEFAULT_JOYSTICK_BINDINGS: JoystickBindings = {
  left: {
    source: "keyboard",
    padIndex: 0,
    keys: {
      RIGHT: "ArrowRight",
      LEFT: "ArrowLeft",
      DOWN: "ArrowDown",
      UP: "ArrowUp",
      B: "ControlRight",
      C: "ShiftRight",
      A: "Backslash",
      START: "NumpadEnter"
    }
  },
  right: {
    source: "off",
    padIndex: 1,
    keys: {
      RIGHT: "KeyD",
      LEFT: "KeyA",
      DOWN: "KeyS",
      UP: "KeyW",
      B: "ShiftLeft",
      C: "Tab",
      A: "KeyQ",
      START: "KeyE"
    }
  }
};

function normalizeSide(value: unknown, fallback: JoystickSideBindings): JoystickSideBindings {
  const raw = (value ?? {}) as Partial<JoystickSideBindings>;
  const source = JOYSTICK_SOURCES.some((s) => s.value === raw.source)
    ? (raw.source as JoystickSource)
    : fallback.source;

  const keys: Partial<Record<JoystickButton, string>> = {};
  const stored = (raw.keys ?? {}) as Record<string, unknown>;
  for (const button of JOYSTICK_BUTTONS) {
    const code = stored[button];
    // --- An explicitly empty string means "unbound", which is not the same as "not stored".
    if (typeof code === "string") {
      if (code) keys[button] = code;
    } else if (!(button in stored)) {
      const fromDefault = fallback.keys[button];
      if (fromDefault) keys[button] = fromDefault;
    }
  }

  const padIndex =
    typeof raw.padIndex === "number" && raw.padIndex >= 0 ? Math.trunc(raw.padIndex) : fallback.padIndex;

  return { source, keys, padIndex };
}

/**
 * Coerce a persisted (or hand-edited, or missing) binding set.
 *
 * Settings files are editable by hand and older ones lack the key entirely, so every field falls
 * back to the default rather than reaching the hook. A pin the file does not mention keeps its
 * default key; a pin set to an empty string is deliberately unbound and stays that way.
 */
export function normalizeJoystickBindings(value: unknown): JoystickBindings {
  const raw = (value ?? {}) as Partial<JoystickBindings>;
  return {
    left: normalizeSide(raw.left, DEFAULT_JOYSTICK_BINDINGS.left),
    right: normalizeSide(raw.right, DEFAULT_JOYSTICK_BINDINGS.right)
  };
}

/**
 * Every host key a live connector claims, and the pin it drives.
 *
 * Built per side rather than merged, because the two connectors are independent words. A code bound
 * on both sides therefore presses a pin on each, which is what a user who did that asked for.
 */
export function keyBindingsFor(side: JoystickSideBindings): Map<string, number> {
  const map = new Map<string, number>();
  if (side.source !== "keyboard") return map;
  for (const button of JOYSTICK_BUTTONS) {
    const code = side.keys[button];
    if (code) map.set(code, (map.get(code) ?? 0) | joystickButtonBit(button));
  }
  return map;
}
