import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { DEFAULT_JOYSTICK_BINDINGS } from "@common/settings/joystick-bindings";
import { SETTING_EMU_JOYSTICK_BINDINGS } from "@common/settings/setting-const";

import { renderWithProviders } from "../react-test-utils";

/*
 * The joystick bindings dialog.
 *
 * The editing *rules* are pure functions tested in test/common/joystick-bindings.test.ts; what is
 * worth rendering for is the behaviour that only exists once there is a keyboard in the room - key
 * capture, and the fact that nothing is written until Save.
 */

const setGlobalSettingsValue = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@renderer/core/MainApi", () => ({ useMainApi: () => ({ setGlobalSettingsValue }) }));

import { JoystickBindingsDialog } from "@renderer/appEmu/dialogs/joystick/JoystickBindingsDialog";

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const render = (onSave = vi.fn()) => {
  renderWithProviders(<JoystickBindingsDialog onSave={onSave} onClose={vi.fn()} />);
  return onSave;
};

/** The capture button for a pin, found by the key it currently shows. */
const keyButton = (label: string) => screen.getAllByText(label)[0];

describe("JoystickBindingsDialog", () => {
  it("shows the bindings in force", () => {
    render();
    // --- Codes are shown as a person would name the key, not as `ArrowRight`.
    expect(screen.getAllByText("Right arrow").length).toBeGreaterThan(0);
  });

  it("warns which machine keys a binding takes away", () => {
    // --- Binding is not additive: the emulated keyboard stops seeing the key entirely.
    render();
    expect(screen.getAllByText(/takes CShift \+ N8/).length).toBeGreaterThan(0);
  });

  it("captures the next key pressed onto the pin", () => {
    render();
    fireEvent.click(keyButton("Right arrow"));
    expect(screen.getAllByText("Press a key…").length).toBe(1);

    fireEvent.keyDown(window, { code: "KeyL" });
    expect(screen.getAllByText("L").length).toBeGreaterThan(0);
  });

  it("keeps the keystroke away from the machine behind the dialog", () => {
    render();
    fireEvent.click(keyButton("Right arrow"));

    const event = new KeyboardEvent("keydown", { code: "KeyL", cancelable: true, bubbles: true });
    const stopped = vi.spyOn(event, "stopImmediatePropagation");
    window.dispatchEvent(event);

    // --- Otherwise choosing a binding would type into the running program.
    expect(stopped).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("backs out of a capture on Escape without binding it", () => {
    render();
    fireEvent.click(keyButton("Right arrow"));
    fireEvent.keyDown(window, { code: "Escape" });

    expect(screen.queryByText("Press a key…")).toBeNull();
    expect(screen.getAllByText("Right arrow").length).toBeGreaterThan(0);
  });

  it("writes nothing until Save", () => {
    render();
    fireEvent.click(keyButton("Right arrow"));
    fireEvent.keyDown(window, { code: "KeyL" });

    // --- Writing per keystroke would re-bind the live joystick mid-capture.
    expect(setGlobalSettingsValue).not.toHaveBeenCalled();
  });

  it("saves the whole edited set at once", async () => {
    const onSave = render();
    fireEvent.click(keyButton("Right arrow"));
    fireEvent.keyDown(window, { code: "KeyL" });
    fireEvent.click(screen.getByText("Save"));

    await vi.waitFor(() => expect(setGlobalSettingsValue).toHaveBeenCalled());
    const [id, written] = setGlobalSettingsValue.mock.calls[0];
    expect(id).toBe(SETTING_EMU_JOYSTICK_BINDINGS);
    expect(written.left.keys.RIGHT).toBe("KeyL");
    expect(written.left.keys.UP, "untouched pins survive").toBe(
      DEFAULT_JOYSTICK_BINDINGS.left.keys.UP
    );
    expect(onSave).toHaveBeenCalled();
  });

  it("puts one connector back without touching the other", () => {
    render();
    fireEvent.click(keyButton("Right arrow"));
    fireEvent.keyDown(window, { code: "KeyL" });
    fireEvent.click(screen.getAllByText("Reset")[0]);

    expect(screen.queryAllByText("L")).toHaveLength(0);
  });
});
