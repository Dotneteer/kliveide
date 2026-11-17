import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { MachineControllerState } from "@abstractions/MachineControllerState";

/*
 * `useEmulatorKeyboard` - host keys to the emulated keyboard matrix.
 *
 * These tests are about keys that must not stay down. macOS sends no `keyup` for a key released
 * while Command is held, so Cmd+P on a 48K left P pressed in the matrix and the ROM repeated it
 * until reset. Every edge where key-ups stop arriving must let go of what is held.
 */

const mocks = vi.hoisted(() => ({
  machineState: "Running" as unknown,
  modalOpen: false
}));

vi.mock("@renderer/core/RendererProvider", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      keyMappings: undefined,
      emulatorState: { machineState: mocks.machineState },
      dimMenu: mocks.modalOpen
    })
}));

import { useEmulatorKeyboard } from "@renderer/features/emulator/useEmulatorKeyboard";

const CODES = { P: 1, CShift: 2, Space: 3 };
const MAPPING = { KeyP: "P", ShiftLeft: "CShift", Backspace: ["CShift", "P"] } as never;

let down: Set<number>;
let controller: { state: unknown; machine: { setKeyStatus: (c: number, d: boolean) => void } };

beforeEach(() => {
  mocks.machineState = MachineControllerState.Running;
  mocks.modalOpen = false;
  down = new Set();
  controller = {
    state: MachineControllerState.Running,
    machine: {
      setKeyStatus: (code: number, isDown: boolean) => (isDown ? down.add(code) : down.delete(code))
    }
  };
});

afterEach(() => {
  cleanup();
});

function render() {
  const hook = renderHook(() => useEmulatorKeyboard({ current: controller } as never));
  act(() => hook.result.current.setKeyData(CODES as never, MAPPING));
  return hook;
}

function key(code: string, isDown: boolean, metaKey = false): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(isDown ? "keydown" : "keyup", { code, metaKey }));
  });
}

describe("useEmulatorKeyboard", () => {
  it("presses and releases a mapped key", () => {
    render();
    key("KeyP", true);
    expect(down.has(CODES.P)).toBe(true);
    key("KeyP", false);
    expect(down.size).toBe(0);
  });

  it("does not press a key that comes with Command (Cmd+P)", () => {
    render();
    key("MetaLeft", true, true);
    key("KeyP", true, true);
    // --- macOS sends no keyup for P here; only Command's keyup arrives.
    key("MetaLeft", false);
    expect(down.size).toBe(0);
  });

  it("lets go of keys held before Command when Command is released", () => {
    render();
    key("Backspace", true);
    expect(down.has(CODES.CShift) && down.has(CODES.P)).toBe(true);
    key("MetaLeft", true, true);
    // --- Backspace's keyup is swallowed while Command is down.
    key("MetaLeft", false);
    expect(down.size).toBe(0);
  });

  it("lets go of everything when the window loses focus", () => {
    render();
    key("KeyP", true);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(down.size).toBe(0);
  });

  it("lets go when a dialog opens", () => {
    const { rerender } = render();
    key("KeyP", true);
    mocks.modalOpen = true;
    act(() => rerender());
    expect(down.size).toBe(0);
  });

  it("lets go when the machine stops running", () => {
    const { rerender } = render();
    key("KeyP", true);
    mocks.machineState = MachineControllerState.Paused;
    act(() => rerender());
    expect(down.size).toBe(0);
  });
});
