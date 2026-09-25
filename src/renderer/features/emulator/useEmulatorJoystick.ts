import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { IZxNextHostInputMachine } from "@emu/machines/zxNext/IZxNextHostInputMachine";
import {
  JOYSTICK_SIDES,
  keyBindingsFor,
  normalizeJoystickBindings,
  type JoystickSide
} from "@common/settings/joystick-bindings";
import { SETTING_EMU_JOYSTICK_BINDINGS } from "@common/settings/setting-const";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";

/**
 * Drives the machine's two joystick connectors from the host keyboard and gamepads.
 *
 * The hook sets **pins**, nothing more. Twelve bits per connector, active high, handed to
 * `setJoystickState`; NextReg `$05` then decides inside the core whether they surface on a Kempston
 * port, in the MD registers, or as membrane key presses through the joymap. That is why there is no
 * per-mode code here, and why a program switching `$05` mid-game needs no cooperation from the
 * host: the same pins simply mean something else.
 *
 * Mounted *before* `useEmulatorKeyboard` in `EmulatorPanel`, and it hands that hook a test for the
 * key codes it has claimed - see `claimsKey`.
 *
 * Only a machine with joystick connectors (one implementing `setJoystickState`) claims anything.
 * The bindings are a global setting, so on any other machine - a Spectrum, a Cambridge Z88 - the
 * same arrow keys, right Shift and right Ctrl belong to the emulated keyboard. Claiming them there
 * swallowed the Z88's cursor keys and its right Shift (issue #1374).
 */

export type EmulatorJoystickApi = {
  /**
   * Whether a host key is bound to a live connector of the *current* machine.
   *
   * `useEmulatorKeyboard` skips such keys, so a key cannot press a joystick pin *and* a Spectrum
   * key at once. Asked at event time, never cached: the machine can change under a mounted panel
   * (a machine-type switch), and whether it has connectors is only known by looking at it. The
   * function is stable across renders, so a change of bindings does not re-bind the keyboard
   * hook's listeners.
   */
  claimsKey: (code: string) => boolean;
};

export function useEmulatorJoystick(
  controllerRef: MutableRefObject<IMachineController>
): EmulatorJoystickApi {
  const bindings = normalizeJoystickBindings(useGlobalSetting(SETTING_EMU_JOYSTICK_BINDINGS));
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const modalOpen = useSelector((s) => s.dimMenu ?? false);

  /** Host code to the pins it drives, per connector. Rebuilt only when the bindings change. */
  const keyMaps = useMemo(
    () => ({ left: keyBindingsFor(bindings.left), right: keyBindingsFor(bindings.right) }),
    [bindings]
  );

  const state = useRef<Record<JoystickSide, number>>({ left: 0, right: 0 });
  const keyMapsRef = useRef(keyMaps);
  keyMapsRef.current = keyMaps;

  const machine = useCallback((): IZxNextHostInputMachine | undefined => {
    const current = controllerRef.current?.machine as Partial<IZxNextHostInputMachine> | undefined;
    return typeof current?.setJoystickState === "function"
      ? (current as IZxNextHostInputMachine)
      : undefined;
  }, [controllerRef]);

  const claimsKey = useCallback(
    (code: string): boolean =>
      machine() !== undefined &&
      (keyMapsRef.current.left.has(code) || keyMapsRef.current.right.has(code)),
    [machine]
  );

  const applyPins = useCallback(
    (side: JoystickSide, pins: number): void => {
      if (pins === state.current[side]) return;
      state.current[side] = pins;
      machine()?.setJoystickState(side, pins);
    },
    [machine]
  );

  /**
   * Lets go of everything.
   *
   * A direction left pressed is far more visible than a stuck letter - the game simply keeps
   * running to the right - so this is called on every edge where key-ups stop arriving: focus loss,
   * a dialog opening, the machine leaving `Running`, and a change of bindings.
   */
  const releaseAll = useCallback((): void => {
    for (const side of JOYSTICK_SIDES) applyPins(side, 0);
  }, [applyPins]);

  useEffect(() => {
    const running = machineState === MachineControllerState.Running;
    if (!running || modalOpen) {
      releaseAll();
      return undefined;
    }

    const handle = (e: KeyboardEvent, down: boolean): void => {
      // --- No connectors, no claim: the key is the emulated keyboard's (see the header comment).
      if (!machine()) return;
      let claimed = false;
      for (const side of JOYSTICK_SIDES) {
        const pins = keyMaps[side].get(e.code);
        if (pins === undefined) continue;
        claimed = true;
        applyPins(side, down ? state.current[side] | pins : state.current[side] & ~pins);
      }
      /*
       * A bound key belongs to the joystick and nothing else. `useEmulatorKeyboard` checks
       * `claimsKey` for the same reason, but stopping the event here as well keeps anything else
       * on `window` - now or later - from seeing a keystroke the user aimed at a joystick.
       */
      if (claimed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => handle(e, true);
    const onKeyUp = (e: KeyboardEvent): void => handle(e, false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [applyPins, keyMaps, machine, machineState, modalOpen, releaseAll]);

  /*
   * Gamepads, polled rather than delivered: the Gamepad API has no input events, so the only way to
   * read a pad is to look at it. Once per animation frame, ORed into the same connector word the
   * keyboard writes - a pad and the keyboard can drive one connector together, exactly as two
   * hands on one stick would.
   */
  useEffect(() => {
    const sides = JOYSTICK_SIDES.filter((side) => bindings[side].source === "gamepad");
    if (sides.length === 0 || machineState !== MachineControllerState.Running) return undefined;

    let frame = 0;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pads = navigator.getGamepads?.() ?? [];
      for (const side of sides) {
        const pad = pads[bindings[side].padIndex];
        applyPins(side, pad ? padPins(pad) : 0);
      }
    };
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      for (const side of sides) applyPins(side, 0);
    };
  }, [applyPins, bindings, machineState]);

  // --- A binding change can strand a pin that was down under the old table.
  useEffect(() => releaseAll(), [keyMaps, releaseAll]);

  return { claimsKey };
}

/** Past this, a stick counts as pushed. Generous: a worn analogue stick rarely reaches its edge. */
const AXIS_DEAD_ZONE = 0.5;

/**
 * A standard-mapping pad as connector pins.
 *
 * Both the D-pad buttons and the left stick are read and ORed together, because which one a pad
 * reports is not something the user should have to know. The face buttons follow the Mega Drive
 * layout the Next expects: B and C are the two fires, A and Start the MD extras.
 */
function padPins(pad: Gamepad): number {
  const pressed = (index: number): boolean => pad.buttons[index]?.pressed === true;
  const axis = (index: number): number => pad.axes[index] ?? 0;

  let pins = 0;
  if (pressed(15) || axis(0) > AXIS_DEAD_ZONE) pins |= 0x001; // --- RIGHT
  if (pressed(14) || axis(0) < -AXIS_DEAD_ZONE) pins |= 0x002; // --- LEFT
  if (pressed(13) || axis(1) > AXIS_DEAD_ZONE) pins |= 0x004; // --- DOWN
  if (pressed(12) || axis(1) < -AXIS_DEAD_ZONE) pins |= 0x008; // --- UP
  if (pressed(0)) pins |= 0x010; // --- B, fire 1
  if (pressed(1)) pins |= 0x020; // --- C, fire 2
  if (pressed(2)) pins |= 0x040; // --- A
  if (pressed(9)) pins |= 0x080; // --- START
  if (pressed(3)) pins |= 0x100; // --- Y
  if (pressed(5)) pins |= 0x200; // --- Z
  if (pressed(4)) pins |= 0x400; // --- X
  if (pressed(8)) pins |= 0x800; // --- MODE
  return pins;
}
