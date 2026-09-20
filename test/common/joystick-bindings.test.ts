import { describe, expect, it } from "vitest";

import {
  DEFAULT_JOYSTICK_BINDINGS,
  keyBindingsFor,
  normalizeJoystickBindings
} from "@common/settings/joystick-bindings";
import {
  assignKey,
  clearKey,
  describeKeyCode,
  machineKeysTakenBy,
  resetSide,
  sharedWith
} from "@common/settings/joystick-binding-edit";

describe("joystick bindings", () => {
  describe("normalizing what was stored", () => {
    it("falls back to the shipped bindings when nothing is stored", () => {
      expect(normalizeJoystickBindings(undefined)).toEqual(DEFAULT_JOYSTICK_BINDINGS);
    });

    it("keeps a default for a pin the file never mentions", () => {
      // --- An older settings file simply lacks the newer pins.
      const stored = { left: { source: "keyboard", padIndex: 0, keys: { UP: "KeyI" } } };
      const result = normalizeJoystickBindings(stored);
      expect(result.left.keys.UP).toBe("KeyI");
      expect(result.left.keys.DOWN).toBe(DEFAULT_JOYSTICK_BINDINGS.left.keys.DOWN);
    });

    it("honours a pin deliberately unbound", () => {
      // --- An empty string is a decision; a missing key is an omission. They must not be confused.
      const stored = { left: { source: "keyboard", padIndex: 0, keys: { DOWN: "" } } };
      expect(normalizeJoystickBindings(stored).left.keys.DOWN).toBeUndefined();
    });

    it("rejects a source it does not recognise", () => {
      const stored = { left: { source: "telepathy", padIndex: 0, keys: {} } };
      expect(normalizeJoystickBindings(stored).left.source).toBe("keyboard");
    });

    it("rejects a nonsense pad index", () => {
      const stored = { right: { source: "gamepad", padIndex: -3, keys: {} } };
      expect(normalizeJoystickBindings(stored).right.padIndex).toBe(
        DEFAULT_JOYSTICK_BINDINGS.right.padIndex
      );
    });
  });

  describe("turning bindings into a lookup", () => {
    it("maps each bound key to its pin", () => {
      const map = keyBindingsFor(DEFAULT_JOYSTICK_BINDINGS.left);
      expect(map.get("ArrowRight")).toBe(0x001);
      expect(map.get("ControlRight")).toBe(0x010);
    });

    it("claims nothing while the connector is not driven by the keyboard", () => {
      // --- Otherwise a disconnected joystick would still be stealing keys from the machine.
      expect(keyBindingsFor(DEFAULT_JOYSTICK_BINDINGS.right).size).toBe(0);
      expect(keyBindingsFor({ ...DEFAULT_JOYSTICK_BINDINGS.left, source: "gamepad" }).size).toBe(0);
    });
  });

  describe("editing", () => {
    it("takes a key from the pin that had it, on the same connector", () => {
      // --- One key pressing two pins of one stick is never what anyone means.
      const edited = assignKey(DEFAULT_JOYSTICK_BINDINGS, "left", "UP", "ArrowRight");
      expect(edited.left.keys.UP).toBe("ArrowRight");
      expect(edited.left.keys.RIGHT).toBeUndefined();
    });

    it("leaves the other connector's identical key alone", () => {
      // --- Two players sharing a fire button is unusual but coherent.
      const shared = assignKey(DEFAULT_JOYSTICK_BINDINGS, "right", "B", "ControlRight");
      expect(shared.right.keys.B).toBe("ControlRight");
      expect(shared.left.keys.B).toBe("ControlRight");
      expect(sharedWith(shared, "right", "ControlRight")).toEqual([{ side: "left", button: "B" }]);
    });

    it("unbinds a pin without disturbing the rest", () => {
      const edited = clearKey(DEFAULT_JOYSTICK_BINDINGS, "left", "START");
      expect(edited.left.keys.START).toBeUndefined();
      expect(edited.left.keys.UP).toBe("ArrowUp");
    });

    it("resets one connector and only that one", () => {
      const messed = assignKey(
        assignKey(DEFAULT_JOYSTICK_BINDINGS, "left", "UP", "KeyI"),
        "right",
        "UP",
        "KeyO"
      );
      const reset = resetSide(messed, "left");
      expect(reset.left.keys.UP).toBe("ArrowUp");
      expect(reset.right.keys.UP, "the other side keeps the edit").toBe("KeyO");
    });
  });

  describe("warning about what a binding costs", () => {
    it("names the machine keys a host key would stop producing", () => {
      // --- Binding is not additive: the emulated keyboard stops seeing the key entirely.
      expect(machineKeysTakenBy("ArrowUp")).toEqual(["CShift", "N7"]);
      expect(machineKeysTakenBy("KeyA")).toEqual(["A"]);
    });

    it("says nothing for a key the machine never used", () => {
      expect(machineKeysTakenBy("F13")).toEqual([]);
    });
  });

  describe("naming keys for people", () => {
    it("reads physical key codes back as their labels", () => {
      expect(describeKeyCode("KeyD")).toBe("D");
      expect(describeKeyCode("Digit5")).toBe("5");
      expect(describeKeyCode("ArrowUp")).toBe("Up arrow");
      expect(describeKeyCode("ControlRight")).toBe("Control Right");
      expect(describeKeyCode(undefined)).toBe("—");
    });
  });
});
