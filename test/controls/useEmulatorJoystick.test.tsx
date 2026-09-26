import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { DEFAULT_JOYSTICK_BINDINGS } from "@common/settings/joystick-bindings";

/*
 * `useEmulatorJoystick` - host keys and gamepads to connector pins.
 *
 * Everything here is about the *pins*. What they mean is NextReg $05's business and is settled
 * inside the core, so there is deliberately no Kempston/Sinclair/MD case in these tests: if the
 * right bits reach `setJoystickState`, every joystick mode is served.
 */

const mocks = vi.hoisted(() => ({
  bindings: undefined as unknown,
  machineState: "Running" as unknown,
  modalOpen: false
}));

vi.mock("@renderer/core/RendererProvider", () => ({
  useGlobalSetting: () => mocks.bindings,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ emulatorState: { machineState: mocks.machineState }, dimMenu: mocks.modalOpen })
}));

import { useEmulatorJoystick } from "@renderer/features/emulator/useEmulatorJoystick";

let pins: { side: string; bits: number }[];
let controllerRef: { current: { machine: { setJoystickState: (s: string, b: number) => void } } };
let frameCallbacks: FrameRequestCallback[];

beforeEach(() => {
  mocks.bindings = undefined; // --- normalizes to the shipped defaults
  mocks.machineState = MachineControllerState.Running;
  mocks.modalOpen = false;
  pins = [];
  controllerRef = {
    current: {
      machine: { setJoystickState: (side: string, bits: number) => pins.push({ side, bits }) }
    }
  };
  frameCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frameCallbacks.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const render = () => renderHook(() => useEmulatorJoystick(controllerRef as never));

function press(code: string, down = true): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, cancelable: true }));
  });
}

/**
 * The connector word most recently written for a side, or 0 when none was.
 *
 * An unchanged word is deliberately never written, so "no write at all" and "written as 0" both
 * mean the same thing to the machine: nothing is pressed.
 */
const lastPins = (side: string): number =>
  [...pins].reverse().find((p) => p.side === side)?.bits ?? 0;

describe("useEmulatorJoystick", () => {
  it("sets the pin a bound key drives", () => {
    render();
    press("ArrowRight");
    expect(lastPins("left")).toBe(0x001);
  });

  it("holds several pins at once and releases them one at a time", () => {
    render();
    press("ArrowUp");
    press("ControlRight");
    expect(lastPins("left")).toBe(0x008 | 0x010);

    press("ArrowUp", false);
    expect(lastPins("left")).toBe(0x010);
  });

  it("writes nothing when the word has not changed", () => {
    render();
    press("ArrowRight");
    const writes = pins.length;
    // --- Key repeat fires keydown over and over; each one must not reach the machine.
    press("ArrowRight");
    press("ArrowRight");
    expect(pins.length).toBe(writes);
  });

  it("leaves a connector alone while its source is off", () => {
    // --- Joystick 2 ships with keys but not connected: binding WASD would take it from the
    // --- emulated keyboard, which is not something to do to someone who never asked.
    render();
    press("KeyD");
    expect(lastPins("right")).toBe(0);
    expect(pins.some((p) => p.side === "right"), "never written at all").toBe(false);
  });

  it("drives the second connector once it is switched on", () => {
    mocks.bindings = {
      ...DEFAULT_JOYSTICK_BINDINGS,
      right: { ...DEFAULT_JOYSTICK_BINDINGS.right, source: "keyboard" }
    };
    render();
    press("KeyD");
    expect(lastPins("right")).toBe(0x001);
  });

  it("claims its keys so the emulated keyboard cannot also see them", () => {
    const { result } = render();
    expect(result.current.claimsKey("ArrowRight")).toBe(true);
    // --- Joystick 2 is off, so its keys are still the keyboard's.
    expect(result.current.claimsKey("KeyD")).toBe(false);
  });

  it("stops a claimed key from travelling any further", () => {
    render();
    const event = new KeyboardEvent("keydown", { code: "ArrowRight", cancelable: true });
    const stopped = vi.spyOn(event, "stopImmediatePropagation");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(stopped).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("lets an unbound key through untouched", () => {
    render();
    const event = new KeyboardEvent("keydown", { code: "KeyG", cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets go of everything when the window loses focus", () => {
    render();
    press("ArrowRight");
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    // --- A held direction would otherwise run the game into a wall for ever.
    expect(lastPins("left")).toBe(0);
  });

  it("lets go when the machine stops running", () => {
    const { rerender } = render();
    press("ArrowRight");

    mocks.machineState = MachineControllerState.Paused;
    act(() => rerender());
    expect(lastPins("left")).toBe(0);
  });

  it("lets go when a dialog takes over, and ignores keys behind it", () => {
    const { rerender } = render();
    press("ArrowRight");

    mocks.modalOpen = true;
    act(() => rerender());
    expect(lastPins("left")).toBe(0);

    press("ArrowLeft");
    expect(lastPins("left")).toBe(0);
  });

  it("does not throw on a machine with no joystick connectors", () => {
    const notANext = { current: { machine: {} } };
    renderHook(() => useEmulatorJoystick(notANext as never));
    expect(() => press("ArrowRight")).not.toThrow();
  });

  describe("on a machine with no joystick connectors (issue #1374)", () => {
    // --- A Cambridge Z88 or a ZX Spectrum: bound keys are the emulated keyboard's there.
    const noConnectors = () => ({ current: { machine: { setKeyStatus: vi.fn() } } });

    it("claims no key, bound or not", () => {
      const { result } = renderHook(() => useEmulatorJoystick(noConnectors() as never));
      for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftRight", "ControlRight"]) {
        expect(result.current.claimsKey(code), code).toBe(false);
      }
    });

    it("lets a bound key travel on to the keyboard hook", () => {
      renderHook(() => useEmulatorJoystick(noConnectors() as never));
      const event = new KeyboardEvent("keydown", { code: "ArrowLeft", cancelable: true });
      const stopped = vi.spyOn(event, "stopImmediatePropagation");
      act(() => {
        window.dispatchEvent(event);
      });
      expect(stopped).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("starts claiming once the panel's machine gains connectors", () => {
      // --- A machine-type switch replaces the machine under a mounted panel.
      const ref = noConnectors() as { current: { machine: object } };
      const { result } = renderHook(() => useEmulatorJoystick(ref as never));
      expect(result.current.claimsKey("ArrowRight")).toBe(false);

      ref.current.machine = controllerRef.current.machine;
      expect(result.current.claimsKey("ArrowRight")).toBe(true);
      press("ArrowRight");
      expect(lastPins("left")).toBe(0x001);
    });

    it("hands the cursor keys to the machine's keyboard matrix", async () => {
      const { useEmulatorKeyboard } = await import(
        "@renderer/features/emulator/useEmulatorKeyboard"
      );
      const setKeyStatus = vi.fn();
      const ref = {
        current: { machine: { setKeyStatus }, state: MachineControllerState.Running }
      };
      const { result } = renderHook(() => {
        const { claimsKey } = useEmulatorJoystick(ref as never);
        return useEmulatorKeyboard(ref as never, undefined, claimsKey);
      });
      act(() => {
        result.current.setKeyData(
          { Left: 38, ShRight: 1 } as never,
          { ArrowLeft: "Left", ShiftRight: "ShRight" } as never
        );
      });

      press("ArrowLeft");
      press("ArrowLeft", false);
      press("ShiftRight");
      expect(setKeyStatus.mock.calls).toEqual([
        [38, true],
        [38, false],
        [1, true]
      ]);
    });
  });

  describe("gamepads", () => {
    const withPad = (pad: Partial<Gamepad>) => {
      mocks.bindings = {
        ...DEFAULT_JOYSTICK_BINDINGS,
        left: { ...DEFAULT_JOYSTICK_BINDINGS.left, source: "gamepad", padIndex: 0 }
      };
      vi.stubGlobal("navigator", {
        getGamepads: () => [{ buttons: [], axes: [], ...pad } as Gamepad]
      });
    };
    const pollFrame = () => {
      const due = frameCallbacks;
      frameCallbacks = [];
      act(() => due.forEach((cb) => cb(0)));
    };

    it("reads a pushed stick as a direction", () => {
      withPad({ axes: [1, 0] });
      render();
      pollFrame();
      expect(lastPins("left")).toBe(0x001);
    });

    it("ignores a stick resting off centre", () => {
      // --- A worn analogue stick never quite returns to zero.
      withPad({ axes: [0.2, 0] });
      render();
      pollFrame();
      expect(lastPins("left")).toBe(0);
    });

    it("reads the D-pad as well as the stick, since a pad may report either", () => {
      withPad({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 14 })) as never });
      render();
      pollFrame();
      expect(lastPins("left")).toBe(0x002);
    });

    it("maps the face buttons to the Mega Drive layout the Next expects", () => {
      withPad({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 || i === 9 })) as never });
      render();
      pollFrame();
      expect(lastPins("left")).toBe(0x010 | 0x080);
    });

    it("releases the connector when the pad disappears", () => {
      withPad({ axes: [1, 0] });
      render();
      pollFrame();

      vi.stubGlobal("navigator", { getGamepads: () => [] });
      pollFrame();
      expect(lastPins("left")).toBe(0);
    });
  });
});
